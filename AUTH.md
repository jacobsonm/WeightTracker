# Authentication — Weight Tracker

Amazon **Cognito User Pool** secures the API and web client.

## Current configuration

| Setting | Value |
|---------|--------|
| Self sign-up | **Off** (admin-provisioned only for now) |
| Admin create user | **Enabled** (console, CLI, or `AdminCreateUser`) |
| Sign-in | Username or email + password |
| Web login | Cognito Hosted UI (OAuth authorization code + PKCE) |
| API | API Gateway **Cognito authorizer**; send `Authorization: Bearer <id_token>` (ID token, not access token) |
| Data ownership | JWT claim **`sub`** is stored in DynamoDB partition key `Username` |

Self sign-up can be enabled later on the same user pool without replacing infrastructure.

## Deploy

```bash
cd infra
npx cdk deploy
```

Note outputs: `UserPoolId`, `UserPoolClientId`, `CognitoDomain`, `WebUrl`.

## Create your first user (admin)

Replace placeholders with your `UserPoolId` and region.

```bash
aws cognito-idp admin-create-user \
  --user-pool-id YOUR_USER_POOL_ID \
  --username mike \
  --user-attributes Name=email,Value=mike@example.com Name=email_verified,Value=true \
  --temporary-password "TempPass123!" \
  --message-action SUPPRESS
```

On first sign-in through the web app, Cognito prompts for a **new password**.

### PowerShell example

```powershell
aws cognito-idp admin-create-user `
  --user-pool-id YOUR_USER_POOL_ID `
  --username mike `
  --user-attributes Name=email,Value=mike@example.com Name=email_verified,Value=true `
  --temporary-password "TempPass123!" `
  --message-action SUPPRESS
```

## Using the web app

1. Open **`WebUrl`** from CDK output.
2. Click **Sign in** → Cognito Hosted UI.
3. Enter username/email and password (set a new password if prompted).
4. After redirect, the app loads your weigh-ins automatically.

## Local development

1. Copy [`web/config.example.js`](./web/config.example.js) to `web/config.js`.
2. Fill in `apiBaseUrl` and `auth` from CDK outputs.
3. Set `redirectUri` and `logoutUri` to `http://localhost:3000/...`.
4. Add `http://localhost:3000/auth/callback.html` to the Cognito app client callback URLs if you change ports (already included for port 3000 in CDK).
5. Serve the `web/` folder: `npx serve web`
6. Create a user in the pool as above.

## Enable self sign-up later

In CDK, set `selfSignUpEnabled: true` on the User Pool (or toggle in the AWS Console). Existing users and the API authorizer stay the same; add a “Create account” path in the UI when ready.

## Migration note

Weigh-ins created **before** auth used a free-text `Username` (e.g. `"mike"`). After auth, new data is keyed by Cognito **`sub`**. Old rows are not visible to authenticated users unless you migrate them.

### Migrate legacy rows (script)

From `infra/` (uses dependencies in that folder):

```powershell
$env:OLD_USERNAME = "mike"
$env:NEW_USERNAME = "YOUR_COGNITO_SUB"
$env:DRY_RUN = "1"
npm run migrate-weigh-ins
```

Remove `DRY_RUN` (or set to `0`) to perform Put + Delete for each item.

```bash
OLD_USERNAME=mike NEW_USERNAME=your-sub npm run migrate-weigh-ins
```
