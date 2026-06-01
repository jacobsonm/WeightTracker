# Weight Tracker Web Client

Static single-page app for the Weight Tracker API.

## Local development

1. Copy `config.example.js` to `config.js` (or edit `config.js`).
2. Set `apiBaseUrl` to your API Gateway base URL (include trailing slash), from `cdk deploy` output `ApiUrl`.
3. Serve this folder with any static server, for example:

   ```bash
   npx --yes serve .
   ```

4. Open the URL shown (e.g. http://localhost:3000).

CORS is enabled on the API for browser access.

## Deployed hosting

The CDK stack uploads these files to S3 and serves them via CloudFront. The API URL is written into `config.js` automatically at deploy time.

See the root [`DYNAMODB_SCHEMA.md`](../DYNAMODB_SCHEMA.md) for API details.
