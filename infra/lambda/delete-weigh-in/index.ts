import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

type ErrorBody = {
  error: string;
};

const ISO_8601_UTC_MS =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function jsonResponse(
  statusCode: number,
  body: unknown,
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: body === undefined ? '' : JSON.stringify(body),
  };
}

function parseKey(
  event: APIGatewayProxyEvent,
): { username: string; dateTime: string } | { error: string } {
  const username = event.queryStringParameters?.Username?.trim();
  if (!username) {
    return { error: 'Username query parameter is required' };
  }

  const dateTime = event.pathParameters?.dateTime?.trim();
  if (!dateTime) {
    return { error: 'DateTime path parameter is required' };
  }

  if (!ISO_8601_UTC_MS.test(dateTime)) {
    return {
      error:
        'DateTime must be ISO 8601 UTC with millisecond precision (e.g. 2026-05-31T14:30:00.000Z)',
    };
  }

  return { username, dateTime };
}

export async function handler(
  event: APIGatewayProxyEvent,
  _context: Context,
): Promise<APIGatewayProxyResult> {
  const tableName = process.env.TABLE_NAME;
  if (!tableName) {
    console.error('TABLE_NAME environment variable is not set');
    return jsonResponse(500, { error: 'Internal server error' });
  }

  const key = parseKey(event);
  if ('error' in key) {
    return jsonResponse(400, { error: key.error } satisfies ErrorBody);
  }

  try {
    const result = await client.send(
      new DeleteCommand({
        TableName: tableName,
        Key: {
          Username: key.username,
          DateTime: key.dateTime,
        },
        ReturnValues: 'ALL_OLD',
      }),
    );

    if (!result.Attributes) {
      return jsonResponse(404, { error: 'Weigh-in not found' });
    }

    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: '',
    };
  } catch (err) {
    console.error('Failed to delete weigh-in', err);
    return jsonResponse(500, { error: 'Failed to delete weigh-in' });
  }
}
