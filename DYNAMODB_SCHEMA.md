# DynamoDB Schema — Weight Tracker

This document defines the DynamoDB table design for weigh-in data. See [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) for overall application scope.

## Overview

| Decision | Choice |
|----------|--------|
| Tables | Single table |
| Authentication | None for now; planned for a later phase |
| Weight unit | Always stored in **pounds (lbs)** |
| Uniqueness | One weigh-in per user per timestamp |

## Table: WeighIns

Stores body weight entries keyed by subject and timestamp.

### Keys

| Key | Attribute | Type | Description |
|-----|-----------|------|-------------|
| Partition key | `Username` | String | Identifies the subject of the weigh-in |
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
  "Username": "mike",
  "DateTime": "2026-05-31T14:30:00.000Z",
  "weight": 185.4
}
```

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

## Future considerations

- **Authentication** — When added, `Username` may be tied to or derived from the authenticated identity; schema may gain GSIs or a separate table for users/profiles.
- **Additional attributes** — Likely for notes, device/source, sync versioning, or audit fields.
- **Table settings** — On-demand billing (`PAY_PER_REQUEST`); default AWS-owned encryption; point-in-time recovery not enabled initially.

## API

REST API: **WeightTrackerApi** (API Gateway)

After deploy, CDK outputs `ApiUrl`, `WeighInsEndpoint`, and `WeighInByDateTimeEndpoint`.

### Add weigh-in

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/weigh-ins` |
| **Lambda** | `AddWeighInFunction` |

Handler: [`infra/lambda/add-weigh-in/index.ts`](./infra/lambda/add-weigh-in/index.ts)

**Request body** (`Content-Type: application/json`):

```json
{
  "Username": "mike",
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

**Example — Git Bash / WSL / macOS / Linux** (replace the URL with your `WeighInsEndpoint` output):

```bash
curl -X POST "https://xxxxxxxx.execute-api.region.amazonaws.com/prod/weigh-ins" \
  -H "Content-Type: application/json" \
  -d "{\"Username\":\"mike\",\"DateTime\":\"2026-05-31T14:30:00.000Z\",\"weight\":185.4}"
```

**Example — Windows PowerShell** — use `curl.exe` (not `curl`, which is an alias for `Invoke-WebRequest` and often breaks JSON):

```powershell
curl.exe -X POST "https://xxxxxxxx.execute-api.region.amazonaws.com/prod/weigh-ins" `
  -H "Content-Type: application/json" `
  -d '{"Username":"mike","DateTime":"2026-05-31T14:30:00.000Z","weight":185.4}'
```

Or use `Invoke-RestMethod`:

```powershell
$body = @{
  Username = "mike"
  DateTime = "2026-05-31T14:30:00.000Z"
  weight   = 185.4
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "https://xxxxxxxx.execute-api.region.amazonaws.com/prod/weigh-ins" `
  -Body $body -ContentType "application/json"
```

CORS is enabled for browser clients (`Access-Control-Allow-Origin: *` on responses; `OPTIONS` preflight on `/weigh-ins`).

### List weigh-ins

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/weigh-ins` |
| **Lambda** | `ListWeighInsFunction` |

Handler: [`infra/lambda/list-weigh-ins/index.ts`](./infra/lambda/list-weigh-ins/index.ts)

**Query parameters**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `Username` | Yes | User whose weigh-ins to return |
| `startDateTime` | No | Inclusive range start (ISO 8601 UTC, ms precision) |
| `endDateTime` | No | Inclusive range end (ISO 8601 UTC, ms precision) |

If both `startDateTime` and `endDateTime` are provided, results are filtered with `BETWEEN`. If only one is provided, results are filtered with `>=` or `<=` respectively. Omit both to return all weigh-ins for the user. Results are sorted ascending by `DateTime` (oldest first).

Wrap the URL in quotes in shells like PowerShell and bash so `&` is not interpreted as a command separator.

| Response | Meaning |
|----------|---------|
| `200` | Success; body contains `{ "weighIns": [ ... ] }` |
| `400` | Validation error (missing/invalid parameters) |
| `500` | DynamoDB or configuration error |

**Example — list all weigh-ins for a user**

```bash
curl "https://xxxxxxxx.execute-api.region.amazonaws.com/prod/weigh-ins?Username=mike"
```

**Example — list weigh-ins in a date range (graph / filtered table)**

```bash
curl "https://xxxxxxxx.execute-api.region.amazonaws.com/prod/weigh-ins?Username=mike&startDateTime=2026-05-01T00:00:00.000Z&endDateTime=2026-05-31T23:59:59.999Z"
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
| `Username` | Query | Yes | User who owns the weigh-in |

| Response | Meaning |
|----------|---------|
| `200` | Weigh-in object |
| `400` | Validation error |
| `404` | No matching record |
| `500` | DynamoDB or configuration error |

**Example**

```bash
curl "https://xxxxxxxx.execute-api.region.amazonaws.com/prod/weigh-ins/2026-05-31T14%3A30%3A00.000Z?Username=mike"
```

### Delete one weigh-in

| | |
|---|---|
| **Method** | `DELETE` |
| **Path** | `/weigh-ins/{dateTime}` |
| **Lambda** | `DeleteWeighInFunction` |

Handler: [`infra/lambda/delete-weigh-in/index.ts`](./infra/lambda/delete-weigh-in/index.ts)

Same path and query parameters as **Get one weigh-in**.

| Response | Meaning |
|----------|---------|
| `204` | Deleted successfully (empty body) |
| `400` | Validation error |
| `404` | No matching record |
| `500` | DynamoDB or configuration error |

**Example**

```bash
curl -X DELETE "https://xxxxxxxx.execute-api.region.amazonaws.com/prod/weigh-ins/2026-05-31T14%3A30%3A00.000Z?Username=mike"
```

## Web client

Static app in [`web/`](./web/). Deployed to **S3** and served over **HTTPS** via **CloudFront** (not API Gateway—API Gateway is for the REST API only).

After `cdk deploy`, open the **`WebUrl`** output. `config.js` is generated at deploy time with your `ApiUrl`.

| Feature | Implementation |
|---------|----------------|
| Add / update weigh-in | Form → `POST /weigh-ins` |
| History table | `GET /weigh-ins?Username=...` |
| Line graph | Chart.js from CDN |
| Delete row | `DELETE /weigh-ins/{dateTime}?Username=...` |

Local development: see [`web/README.md`](./web/README.md).

## Infrastructure

The table, Lambda, API Gateway, and web hosting are defined in AWS CDK under [`infra/`](./infra/). Deploy from that directory:

```bash
npm install
npm run build
npx cdk bootstrap   # once per account/region
npx cdk deploy
```
