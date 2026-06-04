import type { APIGatewayProxyResult } from 'aws-lambda';

export function jsonResponse(
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

export function getRequestBody(event: {
  body: string | null;
  isBase64Encoded?: boolean;
}): string | undefined {
  if (!event.body) {
    return undefined;
  }

  if (event.isBase64Encoded) {
    return Buffer.from(event.body, 'base64').toString('utf-8');
  }

  return event.body;
}
