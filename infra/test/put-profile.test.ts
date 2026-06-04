import { handler } from '../lambda/put-profile/index';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import type { Context } from 'aws-lambda';
import { TEST_USER_SUB, withAuth } from './test-auth';

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const send = jest.fn();
  return {
    DynamoDBDocumentClient: { from: jest.fn(() => ({ send })) },
    PutCommand: jest.fn((input) => input),
    __mockSend: send,
  };
});

const mockSend = (
  jest.requireMock('@aws-sdk/lib-dynamodb') as { __mockSend: jest.Mock }
).__mockSend;

const context = {} as Context;

const validBody = {
  username: 'mike',
  birthdate: '1985-06-15',
  sex: 'male',
  heightInches: 70,
  timezone: 'America/New_York',
};

describe('put-profile handler', () => {
  const originalTable = process.env.PROFILE_TABLE_NAME;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PROFILE_TABLE_NAME = 'UserProfiles';
    mockSend.mockResolvedValue({});
  });

  afterAll(() => {
    process.env.PROFILE_TABLE_NAME = originalTable;
  });

  it('returns 200 and saves profile with goals for authenticated user', async () => {
    const body = {
      ...validBody,
      targetWeight: 175,
      intermediateGoals: [
        { weight: 180, label: 'First milestone' },
        { weight: 170 },
      ],
    };

    const result = await handler(
      withAuth({ body: JSON.stringify(body) }),
      context,
    );

    expect(result.statusCode).toBe(200);
    const response = JSON.parse(result.body!);
    expect(response.targetWeight).toBe(175);
    expect(response.intermediateGoals).toEqual([
      { weight: 170 },
      { weight: 180, label: 'First milestone' },
    ]);
    expect(response.idealWeight).toBe(160.9);
    expect(PutCommand).toHaveBeenCalledWith({
      TableName: 'UserProfiles',
      Item: {
        UserId: TEST_USER_SUB,
        ...validBody,
        targetWeight: 175,
        intermediateGoals: [
          { weight: 170 },
          { weight: 180, label: 'First milestone' },
        ],
      },
    });
  });

  it('returns 400 for invalid timezone', async () => {
    const result = await handler(
      withAuth({
        body: JSON.stringify({ ...validBody, timezone: 'Invalid/Zone' }),
      }),
      context,
    );

    expect(result.statusCode).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid sex', async () => {
    const result = await handler(
      withAuth({
        body: JSON.stringify({ ...validBody, sex: 'unknown' }),
      }),
      context,
    );

    expect(result.statusCode).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
