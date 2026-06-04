# DynamoDB Schema — Weight Tracker

This document defines the DynamoDB table design for weigh-in data. See [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) for overall application scope.

## Overview

| Decision | Choice |
|----------|--------|
| Tables | `WeighIns`, `UserProfiles` |
| Authentication | Amazon Cognito (self sign-up off; admin create user enabled) |
| Weight unit | Always stored in **pounds (lbs)** |
| Uniqueness | One weigh-in per user per timestamp |

See [`AUTH.md`](./AUTH.md) for sign-in and creating users.

## Table: WeighIns

Stores body weight entries keyed by subject and timestamp.

### Keys

| Key | Attribute | Type | Description |
|-----|-----------|------|-------------|
| Partition key | `Username` | String | Owner of the weigh-in (Cognito **`sub`** after auth; legacy free-text values may exist from earlier testing) |
| Sort key | `DateTime` | String | Date and time of the weigh-in (ISO 8601 UTC) |

### Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `weight` | Number | Yes | Body weight in pounds (lbs) |

Additional attributes may be added in later phases (e.g. notes, sync metadata, units). None are defined at this time.

### DateTime format

Store `DateTime` as an **ISO 8601 UTC string** with millisecond precision so items sort chronologically when queried by sort key.

Example: `2026-05-31T14:30:00.000Z`

Clients and the API should use UTC consistently to support offline entry and sync.

### Uniqueness

The primary key `(Username, DateTime)` enforces at most one weigh-in per user per timestamp. A duplicate `PutItem` with the same key overwrites the existing item.

### Example item

```json
{
  "Username": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
  "DateTime": "2026-05-31T14:30:00.000Z",
  "weight": 185.4
}
```

(`Username` holds the Cognito `sub`.)

## Access patterns

All current access patterns are served by the base table primary key. No GSIs are required for the initial design.

| Pattern | Operation |
|---------|-----------|
| Create or replace a weigh-in | `PutItem` (via `POST /weigh-ins`) |
| Read one weigh-in | `GetItem` (via `GET /weigh-ins/{dateTime}`) |
| List all weigh-ins for a user | `Query` on `Username` |
| List weigh-ins in a date range (table / graph) | `Query` on `Username` with `DateTime` condition (e.g. `BETWEEN`) |
| Update a weigh-in | `UpdateItem` |
| Delete a weigh-in | `DeleteItem` (via `DELETE /weigh-ins/{dateTime}`) |

## Table: UserProfiles

One profile per authenticated user (Cognito `sub`).

### Keys

| Key | Attribute | Type | Description |
|-----|-----------|------|-------------|
| Partition key | `UserId` | String | Cognito `sub` |

### Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `username` | String | Yes | Display name (not the weigh-in partition key) |
| `birthdate` | String | Yes | `YYYY-MM-DD` |
| `sex` | String | Yes | `male`, `female`, or `other` |
| `heightInches` | Number | Yes | Height in inches (36–96) |
| `timezone` | String | Yes | IANA timezone (e.g. `America/New_York`); used by the web client to display UTC weigh-in times |
| `targetWeight` | Number | No | User’s goal weight (lbs, 50–600) |
| `intermediateGoals` | List | No | Milestones `{ weight, label? }`, max 10, sorted by weight on save |

**GET only (computed, not stored):**

| Field | Description |
|-------|-------------|
| `idealWeight` | Estimate from Devine formula (lbs); `other` sex uses average of male/female |
| `idealWeightRange` | Healthy BMI band 18.5–24.9 converted to lbs for height |

### Example item

```json
{
  "UserId": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
  "username": "mike",
  "birthdate": "1985-06-15",
  "sex": "male",
  "heightInches": 70,
  "timezone": "America/New_York",
  "targetWeight": 175,
  "intermediateGoals": [
    { "weight": 180, "label": "First milestone" },
    { "weight": 170 }
  ]
}
```

## Future considerations

- **Additional weigh-in attributes** — Notes, device/source, sync metadata
- **Table settings** — On-demand billing (`PAY_PER_REQUEST`); default AWS-owned encryption; point-in-time recovery not enabled initially.

## API

REST API: **WeightTrackerApi** (API Gateway). **All endpoints require** `Authorization: Bearer <id_token>` (Cognito ID token).

After deploy, CDK outputs `ApiUrl`, `ProfileEndpoint`, `WeighInsEndpoint`, and `WebUrl`.

### User profile

| | |
|---|---|
| **GET** | `/profile` — returns profile or `404` |
| **PUT** | `/profile` — create or replace (full body) |

**PUT body** (full replace). Optional goal fields; omit `targetWeight` or send `intermediateGoals: []` to clear.

```json
{
  "username": "mike",
  "birthdate": "1985-06-15",
  "sex": "male",
  "heightInches": 70,
  "timezone": "America/New_York",
  "targetWeight": 175,
  "intermediateGoals": [
    { "weight": 180, "label": "First milestone" },
    { "weight": 170 }
  ]
}
```

**GET response** also includes computed `idealWeight` and `idealWeightRange`. The web chart draws horizontal lines for target, ideal, and each intermediate goal.

Handlers: [`infra/lambda/get-profile/`](./infra/lambda/get-profile/), [`infra/lambda/put-profile/`](./infra/lambda/put-profile/), [`infra/lambda/shared/ideal-weight.ts`](./infra/lambda/shared/ideal-weight.ts).

### Add weigh-in

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/weigh-ins` |
| **Lambda** | `AddWeighInFunction` |

Handler: [`infra/lambda/add-weigh-in/index.ts`](./infra/lambda/add-weigh-in/index.ts)

**Request body** (`Content-Type: application/json`). Owner is taken from the JWT (`sub`); do not send `Username`:

```json
{
  "DateTime": "2026-05-31T14:30:00.000Z",
  "weight": 185.4
}
```

| Response | Meaning |
|----------|---------|
| `201` | Record created or replaced (`PutItem`) |
| `400` | Validation error (missing/invalid fields) |
| `500` | DynamoDB or configuration error |

`weight` must be a positive number (lbs). `DateTime` must match ISO 8601 UTC with millisecond precision and a `Z` suffix.

**Example — curl** (replace URL and `$ACCESS_TOKEN`):

```bash
curl -X POST "https://xxxxxxxx.execute-api.region.amazonaws.com/prod/weigh-ins" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{\"DateTime\":\"2026-05-31T14:30:00.000Z\",\"weight\":185.4}"
```

CORS allows `Authorization` for browser clients. For manual API testing, obtain an access token after signing in via the web app (browser dev tools → Application → Session storage) or use Cognito CLI/API.

### List weigh-ins

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/weigh-ins` |
| **Lambda** | `ListWeighInsFunction` |

Handler: [`infra/lambda/list-weigh-ins/index.ts`](./infra/lambda/list-weigh-ins/index.ts)

**Query parameters** (optional date range). User is determined from the JWT.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `startDateTime` | No | Inclusive range start (ISO 8601 UTC, ms precision) |
| `endDateTime` | No | Inclusive range end (ISO 8601 UTC, ms precision) |

If both `startDateTime` and `endDateTime` are provided, results are filtered with `BETWEEN`. If only one is provided, results are filtered with `>=` or `<=` respectively. Omit both to return all weigh-ins for the user. Results are sorted ascending by `DateTime` (oldest first).

Wrap the URL in quotes in shells like PowerShell and bash so `&` is not interpreted as a command separator.

| Response | Meaning |
|----------|---------|
| `200` | Success; body contains `{ "weighIns": [ ... ] }` |
| `400` | Validation error (missing/invalid parameters) |
| `500` | DynamoDB or configuration error |

```bash
curl -H "Authorization: Bearer $ACCESS_TOKEN" \
  "https://xxxxxxxx.execute-api.region.amazonaws.com/prod/weigh-ins"
```

**Example — date range**

```bash
curl -H "Authorization: Bearer $ACCESS_TOKEN" \
  "https://xxxxxxxx.execute-api.region.amazonaws.com/prod/weigh-ins?startDateTime=2026-05-01T00:00:00.000Z&endDateTime=2026-05-31T23:59:59.999Z"
```

### Get one weigh-in

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/weigh-ins/{dateTime}` |
| **Lambda** | `GetWeighInFunction` |

Handler: [`infra/lambda/get-weigh-in/index.ts`](./infra/lambda/get-weigh-in/index.ts)

**Parameters**

| Parameter | Location | Required | Description |
|-----------|----------|----------|-------------|
| `dateTime` | Path | Yes | Weigh-in timestamp (ISO 8601 UTC; URL-encode `:` as `%3A`) |

Owner is determined from the JWT.

**Example**

```bash
curl -H "Authorization: Bearer $ACCESS_TOKEN" \
  "https://xxxxxxxx.execute-api.region.amazonaws.com/prod/weigh-ins/2026-05-31T14%3A30%3A00.000Z"
```

### Delete one weigh-in

| | |
|---|---|
| **Method** | `DELETE` |
| **Path** | `/weigh-ins/{dateTime}` |
| **Lambda** | `DeleteWeighInFunction` |

Handler: [`infra/lambda/delete-weigh-in/index.ts`](./infra/lambda/delete-weigh-in/index.ts)

Same path parameter as get. Owner from JWT.

**Example**

```bash
curl -X DELETE -H "Authorization: Bearer $ACCESS_TOKEN" \
  "https://xxxxxxxx.execute-api.region.amazonaws.com/prod/weigh-ins/2026-05-31T14%3A30%3A00.000Z"
```

## Web client

Static app in [`web/`](./web/). Deployed to **S3** and served over **HTTPS** via **CloudFront**. Sign-in via Cognito Hosted UI. See [`AUTH.md`](./AUTH.md).

After `cdk deploy`, open the **`WebUrl`** output. `config.js` is generated at deploy time with API and Cognito settings.

| Feature | Implementation |
|---------|----------------|
| Sign in / out | Cognito Hosted UI (OAuth + PKCE) |
| Add / update weigh-in | Form → `POST /weigh-ins` |
| History table | `GET /weigh-ins` |
| Line graph | Chart.js from CDN |
| Delete row | `DELETE /weigh-ins/{dateTime}` |

Local development: see [`web/README.md`](./web/README.md).

## Infrastructure

The table, Lambda, API Gateway, and web hosting are defined in AWS CDK under [`infra/`](./infra/). Deploy from that directory:

```bash
npm install
npm run build
npx cdk bootstrap   # once per account/region
npx cdk deploy
```
