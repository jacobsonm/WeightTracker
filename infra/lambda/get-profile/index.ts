import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';
import { getAuthenticatedUserId } from '../shared/auth';
import { computeIdealWeight } from '../shared/ideal-weight';
import { jsonResponse } from '../shared/http';
import type { UserProfile, UserProfileResponse } from '../shared/profile';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

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

  try {
    const result = await client.send(
      new GetCommand({
        TableName: tableName,
        Key: { UserId: userId },
      }),
    );

    if (!result.Item) {
      return jsonResponse(404, { error: 'Profile not found' });
    }

    const profile = result.Item as UserProfile;
    const ideal = computeIdealWeight(profile);
    const response: UserProfileResponse = {
      ...profile,
      idealWeight: ideal.idealWeight,
      idealWeightRange: ideal.idealWeightRange,
    };

    return jsonResponse(200, response);
  } catch (err) {
    console.error('Failed to get profile', err);
    return jsonResponse(500, { error: 'Failed to get profile' });
  }
}
