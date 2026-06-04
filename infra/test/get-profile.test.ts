import { handler } from '../lambda/get-profile/index';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import type { Context } from 'aws-lambda';
import { TEST_USER_SUB, withAuth } from './test-auth';

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const send = jest.fn();
  return {
    DynamoDBDocumentClient: { from: jest.fn(() => ({ send })) },
    GetCommand: jest.fn((input) => input),
    __mockSend: send,
  };
});

const mockSend = (
  jest.requireMock('@aws-sdk/lib-dynamodb') as { __mockSend: jest.Mock }
).__mockSend;

const context = {} as Context;

describe('get-profile handler', () => {
  const originalTable = process.env.PROFILE_TABLE_NAME;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PROFILE_TABLE_NAME = 'UserProfiles';
  });

  afterAll(() => {
    process.env.PROFILE_TABLE_NAME = originalTable;
  });

  it('returns 200 with profile and ideal weight when found', async () => {
    const profile = {
      UserId: TEST_USER_SUB,
      username: 'mike',
      birthdate: '1985-06-15',
      sex: 'male',
      heightInches: 70,
      targetWeight: 175,
      intermediateGoals: [{ weight: 180, label: 'Step 1' }],
    };
    mockSend.mockResolvedValueOnce({ Item: profile });

    const result = await handler(withAuth(), context);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body!);
    expect(body.username).toBe('mike');
    expect(body.targetWeight).toBe(175);
    expect(body.idealWeight).toBe(160.9);
    expect(body.idealWeightRange).toBeDefined();
  });

  it('returns 404 when profile is missing', async () => {
    mockSend.mockResolvedValueOnce({});

    const result = await handler(withAuth(), context);

    expect(result.statusCode).toBe(404);
  });
});
