import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  type QueryCommandInput,
} from '@aws-sdk/lib-dynamodb';
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

type WeighIn = {
  Username: string;
  DateTime: string;
  weight: number;
};

type ListResponse = {
  weighIns: WeighIn[];
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

function parseDateTimeParam(
  value: string | undefined,
  paramName: string,
): string | undefined | { error: string } {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { error: `${paramName} must not be empty` };
  }

  if (!ISO_8601_UTC_MS.test(trimmed)) {
    return {
      error: `${paramName} must be ISO 8601 UTC with millisecond precision (e.g. 2026-05-31T14:30:00.000Z)`,
    };
  }

  return trimmed;
}

function parseQuery(
  event: APIGatewayProxyEvent,
):
  | { username: string; startDateTime?: string; endDateTime?: string }
  | { error: string } {
  const params = event.queryStringParameters ?? {};
  const username = params.Username?.trim();

  if (!username) {
    return { error: 'Username query parameter is required' };
  }

  const startResult = parseDateTimeParam(
    params.startDateTime,
    'startDateTime',
  );
  if (typeof startResult === 'object' && startResult !== undefined) {
    return startResult;
  }

  const endResult = parseDateTimeParam(params.endDateTime, 'endDateTime');
  if (typeof endResult === 'object' && endResult !== undefined) {
    return endResult;
  }

  const startDateTime = startResult;
  const endDateTime = endResult;

  if (startDateTime && endDateTime && startDateTime > endDateTime) {
    return {
      error: 'startDateTime must be less than or equal to endDateTime',
    };
  }

  return { username, startDateTime, endDateTime };
}

const ATTR_NAMES = {
  '#username': 'Username',
  '#dateTime': 'DateTime',
} as const;

function buildQueryInput(
  _tableName: string,
  username: string,
  startDateTime?: string,
  endDateTime?: string,
): Pick<
  QueryCommandInput,
  | 'KeyConditionExpression'
  | 'ExpressionAttributeNames'
  | 'ExpressionAttributeValues'
> {
  const values: Record<string, string> = {
    ':username': username,
  };

  if (startDateTime && endDateTime) {
    return {
      KeyConditionExpression:
        '#username = :username AND #dateTime BETWEEN :start AND :end',
      ExpressionAttributeNames: { ...ATTR_NAMES },
      ExpressionAttributeValues: {
        ...values,
        ':start': startDateTime,
        ':end': endDateTime,
      },
    };
  }

  if (startDateTime) {
    return {
      KeyConditionExpression:
        '#username = :username AND #dateTime >= :start',
      ExpressionAttributeNames: { ...ATTR_NAMES },
      ExpressionAttributeValues: {
        ...values,
        ':start': startDateTime,
      },
    };
  }

  if (endDateTime) {
    return {
      KeyConditionExpression:
        '#username = :username AND #dateTime <= :end',
      ExpressionAttributeNames: { ...ATTR_NAMES },
      ExpressionAttributeValues: {
        ...values,
        ':end': endDateTime,
      },
    };
  }

  return {
    KeyConditionExpression: '#username = :username',
    ExpressionAttributeNames: {
      '#username': ATTR_NAMES['#username'],
    },
    ExpressionAttributeValues: values,
  };
}

async function queryAllWeighIns(
  tableName: string,
  username: string,
  startDateTime?: string,
  endDateTime?: string,
): Promise<WeighIn[]> {
  const queryBase = buildQueryInput(
    tableName,
    username,
    startDateTime,
    endDateTime,
  );

  const weighIns: WeighIn[] = [];
  let exclusiveStartKey: QueryCommandInput['ExclusiveStartKey'];

  do {
    const result = await client.send(
      new QueryCommand({
        TableName: tableName,
        ...queryBase,
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );

    for (const item of result.Items ?? []) {
      weighIns.push(item as WeighIn);
    }

    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return weighIns;
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

  const parsed = parseQuery(event);
  if ('error' in parsed) {
    return jsonResponse(400, { error: parsed.error } satisfies ErrorBody);
  }

  try {
    const weighIns = await queryAllWeighIns(
      tableName,
      parsed.username,
      parsed.startDateTime,
      parsed.endDateTime,
    );

    return jsonResponse(200, { weighIns } satisfies ListResponse);
  } catch (err) {
    console.error('Failed to list weigh-ins', err);
    return jsonResponse(500, { error: 'Failed to list weigh-ins' });
  }
}
