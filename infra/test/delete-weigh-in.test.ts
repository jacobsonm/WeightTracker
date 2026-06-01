import { handler } from '../lambda/delete-weigh-in/index';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const send = jest.fn();
  return {
    DynamoDBDocumentClient: {
      from: jest.fn(() => ({ send })),
    },
    DeleteCommand: jest.fn((input) => input),
    __mockSend: send,
  };
});

const mockSend = (
  jest.requireMock('@aws-sdk/lib-dynamodb') as { __mockSend: jest.Mock }
).__mockSend;

const context = {} as Context;

function makeEvent(
  username: string | undefined,
  dateTime: string | undefined,
): APIGatewayProxyEvent {
  return {
    queryStringParameters: username === undefined ? null : { Username: username },
    pathParameters: dateTime === undefined ? null : { dateTime },
  } as APIGatewayProxyEvent;
}

describe('delete-weigh-in handler', () => {
  const originalTableName = process.env.TABLE_NAME;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TABLE_NAME = 'WeighIns';
  });

  afterAll(() => {
    process.env.TABLE_NAME = originalTableName;
  });

  it('returns 204 when a weigh-in is deleted', async () => {
    mockSend.mockResolvedValueOnce({
      Attributes: {
        Username: 'mike',
        DateTime: '2026-05-31T14:30:00.000Z',
        weight: 185.4,
      },
    });

    const result = await handler(
      makeEvent('mike', '2026-05-31T14:30:00.000Z'),
      context,
    );

    expect(result.statusCode).toBe(204);
    expect(result.body).toBe('');
    expect(DeleteCommand).toHaveBeenCalledWith({
      TableName: 'WeighIns',
      Key: {
        Username: 'mike',
        DateTime: '2026-05-31T14:30:00.000Z',
      },
      ReturnValues: 'ALL_OLD',
    });
  });

  it('returns 404 when the weigh-in does not exist', async () => {
    mockSend.mockResolvedValueOnce({});

    const result = await handler(
      makeEvent('mike', '2026-05-31T14:30:00.000Z'),
      context,
    );

    expect(result.statusCode).toBe(404);
  });

  it('returns 400 when DateTime path parameter is missing', async () => {
    const result = await handler(makeEvent('mike', undefined), context);

    expect(result.statusCode).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
