import type { APIGatewayProxyEvent } from 'aws-lambda';

export function getAuthenticatedUserId(
  event: APIGatewayProxyEvent,
): string | { error: string } {
  const sub = event.requestContext?.authorizer?.claims?.sub;
  if (typeof sub !== 'string' || sub.trim() === '') {
    return { error: 'Unauthorized' };
  }

  return sub.trim();
}
