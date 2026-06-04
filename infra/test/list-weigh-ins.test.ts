import { handler } from '../lambda/list-weigh-ins/index';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { Context } from 'aws-lambda';
import { TEST_USER_SUB, withAuth } from './test-auth';

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const send = jest.fn();
  return {
    DynamoDBDocumentClient: {
      from: jest.fn(() => ({ send })),
    },
    QueryCommand: jest.fn((input) => input),
    __mockSend: send,
  };
});

const mockSend = (
  jest.requireMock('@aws-sdk/lib-dynamodb') as { __mockSend: jest.Mock }
).__mockSend;

const context = {} as Context;

function makeEvent(queryStringParameters: Record<string, string> | null) {
  return withAuth({ queryStringParameters });
}

describe('list-weigh-ins handler', () => {
  const originalTableName = process.env.TABLE_NAME;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TABLE_NAME = 'WeighIns';
  });

  afterAll(() => {
    process.env.TABLE_NAME = originalTableName;
  });

  it('returns 200 with all weigh-ins for the authenticated user', async () => {
    const items = [
      {
        Username: TEST_USER_SUB,
        DateTime: '2026-05-01T08:00:00.000Z',
        weight: 190,
      },
      {
        Username: TEST_USER_SUB,
        DateTime: '2026-05-31T14:30:00.000Z',
        weight: 185.4,
      },
    ];
    mockSend.mockResolvedValueOnce({ Items: items });

    const result = await handler(makeEvent({}), context);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body!)).toEqual({ weighIns: items });
    expect(QueryCommand).toHaveBeenCalledWith({
      TableName: 'WeighIns',
      KeyConditionExpression: '#username = :username',
      ExpressionAttributeNames: { '#username': 'Username' },
      ExpressionAttributeValues: { ':username': TEST_USER_SUB },
      ExclusiveStartKey: undefined,
    });
  });

  it('queries with a date range when start and end are provided', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });

    await handler(
      makeEvent({
        startDateTime: '2026-05-01T00:00:00.000Z',
        endDateTime: '2026-05-31T23:59:59.999Z',
      }),
      context,
    );

    expect(QueryCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        ExpressionAttributeValues: expect.objectContaining({
          ':username': TEST_USER_SUB,
        }),
      }),
    );
  });

  it('returns 401 without auth claims', async () => {
    const result = await handler({ queryStringParameters: {} } as never, context);

    expect(result.statusCode).toBe(401);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('returns 400 when startDateTime is after endDateTime', async () => {
    const result = await handler(
      makeEvent({
        startDateTime: '2026-06-01T00:00:00.000Z',
        endDateTime: '2026-05-01T00:00:00.000Z',
      }),
      context,
    );

    expect(result.statusCode).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
