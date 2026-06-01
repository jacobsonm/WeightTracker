import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

type WeighInPayload = {
  Username: string;
  DateTime: string;
  weight: number;
};

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
    body: JSON.stringify(body),
  };
}

function getRequestBody(event: APIGatewayProxyEvent): string | undefined {
  if (!event.body) {
    return undefined;
  }

  if (event.isBase64Encoded) {
    return Buffer.from(event.body, 'base64').toString('utf-8');
  }

  return event.body;
}

function parsePayload(
  event: APIGatewayProxyEvent,
): WeighInPayload | { error: string } {
  const rawBody = getRequestBody(event);
  if (!rawBody) {
    return { error: 'Request body is required' };
  }

  const body = rawBody.trim();
  if (!body) {
    return { error: 'Request body is required' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    console.error('JSON parse failed', {
      isBase64Encoded: event.isBase64Encoded,
      bodyPreview: body.slice(0, 200),
    });
    return { error: 'Request body must be valid JSON' };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { error: 'Request body must be a JSON object' };
  }

  const { Username, DateTime, weight } = parsed as Record<string, unknown>;

  if (typeof Username !== 'string' || Username.trim() === '') {
    return { error: 'Username is required and must be a non-empty string' };
  }

  if (typeof DateTime !== 'string' || !ISO_8601_UTC_MS.test(DateTime)) {
    return {
      error:
        'DateTime is required and must be ISO 8601 UTC with millisecond precision (e.g. 2026-05-31T14:30:00.000Z)',
    };
  }

  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0) {
    return { error: 'weight is required and must be a positive number' };
  }

  return {
    Username: Username.trim(),
    DateTime,
    weight,
  };
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

  const payload = parsePayload(event);
  if ('error' in payload) {
    return jsonResponse(400, { error: payload.error } satisfies ErrorBody);
  }

  const item = {
    Username: payload.Username,
    DateTime: payload.DateTime,
    weight: payload.weight,
  };

  try {
    await client.send(
      new PutCommand({
        TableName: tableName,
        Item: item,
      }),
    );
  } catch (err) {
    console.error('Failed to write weigh-in', err);
    return jsonResponse(500, { error: 'Failed to save weigh-in' });
  }

  return jsonResponse(201, item);
}
