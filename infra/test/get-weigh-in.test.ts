import { handler } from '../lambda/get-weigh-in/index';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import type { Context } from 'aws-lambda';
import { TEST_USER_SUB, withAuth } from './test-auth';

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const send = jest.fn();
  return {
    DynamoDBDocumentClient: {
      from: jest.fn(() => ({ send })),
    },
    GetCommand: jest.fn((input) => input),
    __mockSend: send,
  };
});

const mockSend = (
  jest.requireMock('@aws-sdk/lib-dynamodb') as { __mockSend: jest.Mock }
).__mockSend;

const context = {} as Context;

function makeEvent(dateTime: string | undefined) {
  return withAuth({
    pathParameters: dateTime === undefined ? null : { dateTime },
  });
}

describe('get-weigh-in handler', () => {
  const originalTableName = process.env.TABLE_NAME;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TABLE_NAME = 'WeighIns';
  });

  afterAll(() => {
    process.env.TABLE_NAME = originalTableName;
  });

  it('returns 200 with the weigh-in when found', async () => {
    const item = {
      Username: TEST_USER_SUB,
      DateTime: '2026-05-31T14:30:00.000Z',
      weight: 185.4,
    };
    mockSend.mockResolvedValueOnce({ Item: item });

    const result = await handler(
      makeEvent('2026-05-31T14:30:00.000Z'),
      context,
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body!)).toEqual(item);
    expect(GetCommand).toHaveBeenCalledWith({
      TableName: 'WeighIns',
      Key: {
        Username: TEST_USER_SUB,
        DateTime: '2026-05-31T14:30:00.000Z',
      },
    });
  });

  it('returns 404 when the weigh-in does not exist', async () => {
    mockSend.mockResolvedValueOnce({});

    const result = await handler(
      makeEvent('2026-05-31T14:30:00.000Z'),
      context,
    );

    expect(result.statusCode).toBe(404);
  });

  it('returns 401 without auth claims', async () => {
    const result = await handler(
      { pathParameters: { dateTime: '2026-05-31T14:30:00.000Z' } } as never,
      context,
    );

    expect(result.statusCode).toBe(401);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
