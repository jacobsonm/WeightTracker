import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';
import { getAuthenticatedUserId } from '../shared/auth';
import { getRequestBody, jsonResponse } from '../shared/http';
import { computeIdealWeight } from '../shared/ideal-weight';
import { parseIntermediateGoals, parseOptionalWeight } from '../shared/parse-goals';
import type { UserProfile, UserProfileResponse } from '../shared/profile';
import { isValidTimezone } from '../shared/timezone';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SEX_VALUES = new Set(['male', 'female', 'other']);

type ProfileInput = Omit<UserProfile, 'UserId'>;

function parseProfileBody(
  event: APIGatewayProxyEvent,
): ProfileInput | { error: string } {
  const rawBody = getRequestBody(event);
  if (!rawBody?.trim()) {
    return { error: 'Request body is required' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody.trim());
  } catch {
    return { error: 'Request body must be valid JSON' };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { error: 'Request body must be a JSON object' };
  }

  const {
    username,
    birthdate,
    sex,
    heightInches,
    timezone,
    targetWeight,
    intermediateGoals,
  } = parsed as Record<string, unknown>;

  if (typeof username !== 'string' || username.trim() === '') {
    return { error: 'username is required and must be a non-empty string' };
  }

  if (typeof birthdate !== 'string' || !ISO_DATE.test(birthdate)) {
    return {
      error: 'birthdate is required and must be YYYY-MM-DD (e.g. 1985-06-15)',
    };
  }

  if (typeof sex !== 'string' || !SEX_VALUES.has(sex)) {
    return { error: 'sex is required and must be male, female, or other' };
  }

  if (
    typeof heightInches !== 'number' ||
    !Number.isFinite(heightInches) ||
    heightInches < 36 ||
    heightInches > 96
  ) {
    return {
      error: 'heightInches is required and must be between 36 and 96',
    };
  }

  if (typeof timezone !== 'string' || !isValidTimezone(timezone)) {
    return {
      error:
        'timezone is required and must be a valid IANA name (e.g. America/New_York)',
    };
  }

  const parsedTarget = parseOptionalWeight(targetWeight, 'targetWeight');
  if (typeof parsedTarget === 'object') {
    return parsedTarget;
  }

  const parsedGoals = parseIntermediateGoals(intermediateGoals);
  if ('error' in parsedGoals) {
    return parsedGoals;
  }

  const profileFields: Omit<UserProfile, 'UserId'> = {
    username: username.trim(),
    birthdate,
    sex: sex as ProfileInput['sex'],
    heightInches,
    timezone,
  };

  if (parsedTarget !== undefined) {
    profileFields.targetWeight = parsedTarget;
  }

  if (parsedGoals.length > 0) {
    profileFields.intermediateGoals = parsedGoals;
  }

  return profileFields;
}

export async function handler(
  event: APIGatewayProxyEvent,
  _context: Context,
): Promise<APIGatewayProxyResult> {
  const tableName = process.env.PROFILE_TABLE_NAME;
  if (!tableName) {
    console.error('PROFILE_TABLE_NAME environment variable is not set');
    return jsonResponse(500, { error: 'Internal server error' });
  }

  const userId = getAuthenticatedUserId(event);
  if (typeof userId === 'object') {
    return jsonResponse(401, { error: userId.error });
  }

  const payload = parseProfileBody(event);
  if ('error' in payload) {
    return jsonResponse(400, { error: payload.error });
  }

  const profile: UserProfile = {
    UserId: userId,
    ...payload,
  };

  try {
    await client.send(
      new PutCommand({
        TableName: tableName,
        Item: profile,
      }),
    );
  } catch (err) {
    console.error('Failed to save profile', err);
    return jsonResponse(500, { error: 'Failed to save profile' });
  }

  const ideal = computeIdealWeight(profile);
  const response: UserProfileResponse = {
    ...profile,
    idealWeight: ideal.idealWeight,
    idealWeightRange: ideal.idealWeightRange,
  };

  return jsonResponse(200, response);
}
