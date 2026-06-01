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
| Create or replace a weigh-in | `PutItem` |
| Read one weigh-in | `GetItem` (`Username`, `DateTime`) |
| List all weigh-ins for a user | `Query` on `Username` |
| List weigh-ins in a date range (table / graph) | `Query` on `Username` with `DateTime` condition (e.g. `BETWEEN`) |
| Update a weigh-in | `UpdateItem` |
| Delete a weigh-in | `DeleteItem` |

## Future considerations

- **Authentication** — When added, `Username` may be tied to or derived from the authenticated identity; schema may gain GSIs or a separate table for users/profiles.
- **Additional attributes** — Likely for notes, device/source, sync versioning, or audit fields.
- **Table settings** — Billing mode, encryption, and point-in-time recovery to be chosen when the table is created.
