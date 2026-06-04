import type { APIGatewayProxyEvent } from 'aws-lambda';

export const TEST_USER_SUB = 'test-user-sub';

export function withAuth(
  partial: Partial<APIGatewayProxyEvent> = {},
): APIGatewayProxyEvent {
  return {
    requestContext: {
      authorizer: {
        claims: { sub: TEST_USER_SUB },
      },
    },
    ...partial,
  } as APIGatewayProxyEvent;
}
