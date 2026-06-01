import { handler } from '../lambda/list-weigh-ins/index';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

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

function makeEvent(
  queryStringParameters: Record<string, string> | null,
): APIGatewayProxyEvent {
  return {
    queryStringParameters,
  } as APIGatewayProxyEvent;
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

  it('returns 200 with all weigh-ins for a user', async () => {
    const items = [
      {
        Username: 'mike',
        DateTime: '2026-05-01T08:00:00.000Z',
        weight: 190,
      },
      {
        Username: 'mike',
        DateTime: '2026-05-31T14:30:00.000Z',
        weight: 185.4,
      },
    ];
    mockSend.mockResolvedValueOnce({ Items: items });

    const result = await handler(
      makeEvent({ Username: 'mike' }),
      context,
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body!)).toEqual({ weighIns: items });
    expect(QueryCommand).toHaveBeenCalledWith({
      TableName: 'WeighIns',
      KeyConditionExpression: '#username = :username',
      ExpressionAttributeNames: { '#username': 'Username' },
      ExpressionAttributeValues: { ':username': 'mike' },
      ExclusiveStartKey: undefined,
    });
  });

  it('queries with a date range when start and end are provided', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });

    await handler(
      makeEvent({
        Username: 'mike',
        startDateTime: '2026-05-01T00:00:00.000Z',
        endDateTime: '2026-05-31T23:59:59.999Z',
      }),
      context,
    );

    expect(QueryCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        KeyConditionExpression:
          '#username = :username AND #dateTime BETWEEN :start AND :end',
        ExpressionAttributeNames: {
          '#username': 'Username',
          '#dateTime': 'DateTime',
        },
        ExpressionAttributeValues: {
          ':username': 'mike',
          ':start': '2026-05-01T00:00:00.000Z',
          ':end': '2026-05-31T23:59:59.999Z',
        },
      }),
    );
  });

  it('paginates through query results', async () => {
    const page1 = [
      {
        Username: 'mike',
        DateTime: '2026-05-01T08:00:00.000Z',
        weight: 190,
      },
    ];
    const page2 = [
      {
        Username: 'mike',
        DateTime: '2026-05-31T14:30:00.000Z',
        weight: 185.4,
      },
    ];
    mockSend
      .mockResolvedValueOnce({
        Items: page1,
        LastEvaluatedKey: { Username: 'mike', DateTime: page1[0].DateTime },
      })
      .mockResolvedValueOnce({ Items: page2 });

    const result = await handler(makeEvent({ Username: 'mike' }), context);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body!).weighIns).toEqual([...page1, ...page2]);
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('returns 400 when Username is missing', async () => {
    const result = await handler(makeEvent({}), context);

    expect(result.statusCode).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('returns 400 when startDateTime is after endDateTime', async () => {
    const result = await handler(
      makeEvent({
        Username: 'mike',
        startDateTime: '2026-06-01T00:00:00.000Z',
        endDateTime: '2026-05-01T00:00:00.000Z',
      }),
      context,
    );

    expect(result.statusCode).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
