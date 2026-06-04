/**
 * Copy weigh-ins from a legacy partition key (e.g. "mike") to Cognito sub.
 *
 * Run from infra/ (uses infra/node_modules):
 *   npm run migrate-weigh-ins
 *
 * Env (required):
 *   OLD_USERNAME  - legacy partition key value
 *   NEW_USERNAME  - Cognito sub (JWT claim)
 *
 * Optional:
 *   TABLE_NAME    - default WeighIns
 *   AWS_REGION    - default us-west-2
 *   DRY_RUN       - set to 1 to list items without writing
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';

const TABLE_NAME = process.env.TABLE_NAME ?? 'WeighIns';
const OLD_USERNAME = 'mike';//process.env.OLD_USERNAME;
const NEW_USERNAME = 'b8d11340-3071-70a8-fa21-971ad1b05aca';//process.env.NEW_USERNAME;
const REGION = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-west-2';
const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

if (!OLD_USERNAME || !NEW_USERNAME) {
  console.error(
    'Set OLD_USERNAME and NEW_USERNAME, e.g.\n' +
      '  $env:OLD_USERNAME="mike"; $env:NEW_USERNAME="your-cognito-sub"; npm run migrate-weigh-ins',
  );
  process.exit(1);
}

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
);

const { Items = [] } = await client.send(
  new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'Username = :u',
    ExpressionAttributeValues: { ':u': OLD_USERNAME },
  }),
);

console.log(`Table: ${TABLE_NAME} (${REGION})`);
console.log(`Migrate: ${OLD_USERNAME} -> ${NEW_USERNAME}`);
console.log(`Found ${Items.length} item(s)${DRY_RUN ? ' (DRY_RUN)' : ''}`);

for (const item of Items) {
  if (DRY_RUN) {
    console.log(`  would migrate ${item.DateTime} weight=${item.weight}`);
    continue;
  }

  await client.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...item, Username: NEW_USERNAME },
    }),
  );
  await client.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { Username: OLD_USERNAME, DateTime: item.DateTime },
    }),
  );
  console.log(`Migrated ${item.DateTime}`);
}

console.log('Done');
