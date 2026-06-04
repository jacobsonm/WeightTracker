import { handler } from '../lambda/add-weigh-in/index';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import type { Context } from 'aws-lambda';
import { TEST_USER_SUB, withAuth } from './test-auth';

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const send = jest.fn();
  return {
    DynamoDBDocumentClient: {
      from: jest.fn(() => ({ send })),
    },
    PutCommand: jest.fn((input) => input),
    __mockSend: send,
  };
});

const mockSend = (
  jest.requireMock('@aws-sdk/lib-dynamodb') as { __mockSend: jest.Mock }
).__mockSend;

const context = {} as Context;

function makeEvent(body: unknown) {
  return withAuth({
    body: body === undefined ? null : JSON.stringify(body),
  });
}

describe('add-weigh-in handler', () => {
  const originalTableName = process.env.TABLE_NAME;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TABLE_NAME = 'WeighIns';
    mockSend.mockResolvedValue({});
  });

  afterAll(() => {
    process.env.TABLE_NAME = originalTableName;
  });

  it('returns 201 and writes a valid weigh-in for the authenticated user', async () => {
    const payload = {
      DateTime: '2026-05-31T14:30:00.000Z',
      weight: 185.4,
    };

    const result = await handler(makeEvent(payload), context);

    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body!)).toEqual({
      Username: TEST_USER_SUB,
      ...payload,
    });
    expect(PutCommand).toHaveBeenCalledWith({
      TableName: 'WeighIns',
      Item: {
        Username: TEST_USER_SUB,
        ...payload,
      },
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('returns 401 without auth claims', async () => {
    const result = await handler(
      { body: JSON.stringify({ DateTime: '2026-05-31T14:30:00.000Z', weight: 180 }) } as never,
      context,
    );

    expect(result.statusCode).toBe(401);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('returns 400 when DateTime format is invalid', async () => {
    const result = await handler(
      makeEvent({
        DateTime: '2026-05-31',
        weight: 180,
      }),
      context,
    );

    expect(result.statusCode).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('parses a base64-encoded request body', async () => {
    const payload = {
      DateTime: '2026-05-31T14:30:00.000Z',
      weight: 185.4,
    };
    const json = JSON.stringify(payload);
    const result = await handler(
      withAuth({
        body: Buffer.from(json, 'utf-8').toString('base64'),
        isBase64Encoded: true,
      }),
      context,
    );

    expect(result.statusCode).toBe(201);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('returns 400 when weight is not positive', async () => {
    const result = await handler(
      makeEvent({
        DateTime: '2026-05-31T14:30:00.000Z',
        weight: 0,
      }),
      context,
    );

    expect(result.statusCode).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
