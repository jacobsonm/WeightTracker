# Weight Tracker Web Client

Static single-page app for the Weight Tracker API.

Authentication uses **Amazon Cognito** (Hosted UI). See [`../AUTH.md`](../AUTH.md) for creating users and auth configuration.

## Local development

1. Copy `config.example.js` to `config.js` (or edit `config.js`).
2. Set `apiBaseUrl` to **`ApiGatewayUrl`** from `cdk deploy` (direct API Gateway URL).
3. Set `auth` from other CDK outputs.
4. Serve this folder:

   ```bash
   npx --yes serve .
   ```

4. Open the URL shown (e.g. http://localhost:3000).
5. Sign in with a user created via Cognito admin (see AUTH.md).

## Deployed hosting

CDK uploads these files to S3 and serves them via CloudFront. `config.js` is generated at deploy time with **`apiBaseUrl: '/api/'`** (same-origin) and Cognito settings.

Open the **`WebUrl`** output after deploy. API calls go to **`/api/...`** on the same hostname (no separate API Gateway URL in the browser).

## Features

- **Home** — add weigh-in form and progress summary
- **History** — trend chart and weigh-in table
- **Profile** — goals, target weight, timezone, and related fields
- Progress metrics computed in the browser (`progress.js`)

## API details

See [`../DYNAMODB_SCHEMA.md`](../DYNAMODB_SCHEMA.md).
