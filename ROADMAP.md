# Weight Tracker — Product Roadmap

Prioritized plan for future work. This document can change as requirements evolve; [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) remains the stable description of overall purpose and architecture.

**Last updated:** 2026-05-31

## How to use this document

| Column | Meaning |
|--------|---------|
| **Priority** | Order to tackle (1 = next) |
| **Status** | `planned` · `in progress` · `done` |
| **Scope** | What “done” roughly means |

---

## Prioritized backlog

### 1. Add user authentication

| | |
|---|---|
| **Priority** | 1 |
| **Status** | done |
| **Scope** | Users sign in before using the app; API rejects unauthenticated requests; web client uses Cognito Hosted UI. |

**Decisions**
- **Amazon Cognito** user pool + app client + Hosted UI domain
- **Self sign-up off** initially; **admin create user** enabled (console/CLI)
- Self sign-up can be turned on later on the same pool
- Weigh-ins keyed by JWT **`sub`** (stored in DynamoDB `Username` attribute)
- API Gateway **Cognito authorizer** on all `/weigh-ins` methods

**Docs** — [`AUTH.md`](./AUTH.md)

---

### 2. Create a user profile table

| | |
|---|---|
| **Priority** | 2 |
| **Status** | done |
| **Scope** | `UserProfiles` table; **GET/PUT `/profile`**; web profile form. |

**Decisions**
- Partition key `UserId` = Cognito `sub`
- `username` = display name only (weigh-ins still keyed by `sub`)
- `birthdate` as `YYYY-MM-DD`; `sex` = `male` | `female` | `other`
- `heightInches` (36–96), consistent with lbs for US-style units

**Docs** — [`DYNAMODB_SCHEMA.md`](./DYNAMODB_SCHEMA.md) (UserProfiles + API)

---

### 3. Target weight, ideal weight estimate, and intermediate goals

| | |
|---|---|
| **Priority** | 3 |
| **Status** | done |
| **Scope** | Target weight + intermediate goals on profile; ideal weight estimate on GET/PUT; goal lines on web chart. |

**Decisions**
- `targetWeight` and `intermediateGoals[]` stored on `UserProfiles` (no separate Goals table)
- `idealWeight` / `idealWeightRange` computed on read (Devine + BMI band); not stored
- Chart: horizontal reference lines — target (red), ideal (blue), intermediate (amber)

**Docs** — [`DYNAMODB_SCHEMA.md`](./DYNAMODB_SCHEMA.md)

---

### 4. Progress summary on web

| | |
|---|---|
| **Priority** | 4 (next) |
| **Status** | planned |
| **Scope** | A web view (section or dashboard) showing key progress metrics. |

**Metrics to display**

| Metric | Definition (to confirm when building) |
|--------|----------------------------------------|
| **Starting weight** | Earliest weigh-in in range, or weight at start of current goal period |
| **Current weight** | Most recent weigh-in |
| **Total weight lost** | Starting weight − current weight (handle gain as negative “lost”) |
| **% progress to next goal** | Progress toward the next intermediate goal from #3 |
| **% progress to ideal weight** | Progress toward ideal weight estimate from #3 (profile-based) |

**Depends on**  
#3 (target weight, intermediate goals, ideal weight estimate). Needs weigh-in history (#1) and profile (#2).

**Likely direction**  
- Compute in web from existing `GET /weigh-ins` + profile/goals APIs, or add a `GET /progress` summary endpoint if logic grows.  
- Show as a card above the chart/history; clarify labels (e.g. “since first weigh-in” vs “since goal start”).

**Open questions**  
- How is “starting weight” defined if the user has a long history?  
- Show progress when total change is a gain?  
- What if ideal weight or next goal is not set yet (hide vs placeholder)?

**Touches**  
Web UI (`web/`), possibly goals API from #3, [`DYNAMODB_SCHEMA.md`](./DYNAMODB_SCHEMA.md).

---

### 5. Single CloudFront hostname for web + API

| | |
|---|---|
| **Priority** | 5 |
| **Status** | planned |
| **Scope** | One CloudFront URL serves the static web app and proxies API traffic (no separate API Gateway URL in the browser). |

**Why**  
Today the web app on CloudFront calls API Gateway on a different hostname (CORS + two URLs in `config.js`). A single origin simplifies the client and matches a production-style setup.

**Likely direction**  
- CloudFront distribution with two behaviors: default → S3 (web); `/prod/*` or `/api/*` → API Gateway origin.  
- Update `config.js` / `app.js` to use relative API paths or same-origin base URL.  
- Cognito callback URLs and CORS may need updates for the unified domain.

**Open questions**  
- Path pattern for API (`/api/...` vs stage prefix `/prod/...`)?  
- Custom domain (Route 53 + ACM) now or later?

**Touches**  
CDK (`infra/lib/infra-stack.ts`), web `config.js` generation, [`AUTH.md`](./AUTH.md) callback URLs.

---

### 6. Separate AWS environments (production and development)

| | |
|---|---|
| **Priority** | 6 |
| **Status** | planned |
| **Scope** | Isolated **dev** and **prod** stacks (or accounts), each with its own Cognito pool, DynamoDB tables, API, and CloudFront site. |

**Why**  
Safe experimentation and testing without affecting live data or users.

**Likely direction**  
- CDK **stages** or separate stacks/context (`dev`, `prod`) with env-specific naming.  
- Different AWS accounts (recommended) or same account with distinct resource names.  
- Separate deploy commands / CI parameters; dev-only Cognito users and smaller blast radius.  
- Document which outputs/URLs to use per environment.

**Open questions**  
- Two AWS accounts vs one account with prefixed resources?  
- Shared CDK bootstrap vs per-environment?  
- How to promote changes dev → prod (manual deploy vs pipeline)?

**Touches**  
CDK app entry, stack props, docs, possibly GitHub Actions (future).

---

### 7. Android app

| | |
|---|---|
| **Priority** | 7 |
| **Status** | planned |
| **Scope** | Native **Android** client: sign in, record weigh-ins, view history/chart, sync with existing API. |

**Why**  
[`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) targets mobile/desktop clients; Android is the first native app.

**Likely direction**  
- Reuse Cognito auth (Hosted UI or embedded sign-in) and existing REST API.  
- Offline + sync deferred per original context, or minimal offline queue in a later iteration.  
- Technology TBD (Kotlin/Jetpack Compose is a common default).

**Depends on**  
Stable API and auth (#1); profile (#2) optional at v1; #5 (single hostname) may simplify base URL configuration.

**Open questions**  
- Minimum v1 feature set vs parity with web?  
- Same Cognito app client or separate mobile client?  
- When to add offline storage (separate roadmap item)?

**Touches**  
New `android/` (or similar) project; no backend change required for basic parity.

---

### 8. IBW and BMI improvements

| | |
|---|---|
| **Priority** | 8 |
| **Status** | planned |
| **Scope** | Improve how ideal body weight (IBW) and BMI reference information is presented on web; keep current behavior until this item is built. |

**Current state (good for now)**

- `idealWeight` (Devine formula) → single blue reference line on the chart
- `idealWeightRange` (BMI 18.5–24.9 converted to lbs) → shown in profile text only, not on the chart
- Weigh-ins are not used to compute or display the user’s current BMI

**Likely direction**

- Show the BMI healthy range as a **band or shaded region** on the chart (reuse existing `idealWeightRange` from profile GET/PUT — visualization only, no new stored fields)
- Label **Devine** vs **BMI range** clearly in the profile UI so users know they are two different methods
- Show **current BMI** from latest weigh-in + profile height
- Optional: let the user choose which references appear on the chart (Devine line, BMI band, or both)
- Additional reference bands (e.g. stricter targets such as Fuhrman-style cutoffs) only if explicitly added later — separate from the WHO 18.5–24.9 band

**Depends on**  
#3 (ideal weight estimate and `idealWeightRange` already computed on read).

**Open questions**  
- Band styling vs legend clutter when target and intermediate goal lines are also shown  
- Whether current BMI belongs on the chart, progress summary (#4), or both

**Touches**  
Web UI (`web/`), possibly progress summary (#4); [`DYNAMODB_SCHEMA.md`](./DYNAMODB_SCHEMA.md), [`infra/lambda/shared/ideal-weight.ts`](./infra/lambda/shared/ideal-weight.ts).

---

## Completed (reference)

Milestones already in place:

- DynamoDB `WeighIns` table and CDK
- REST API: create/list/get/delete weigh-ins
- Web client (S3 + CloudFront) with table, chart, delete, and Cognito sign-in
- Cognito authentication (admin-provisioned; self sign-up disabled)
- User profiles table, API, and web form
- Target weight, intermediate goals, ideal weight estimate, chart goal lines

See [`DYNAMODB_SCHEMA.md`](./DYNAMODB_SCHEMA.md) and [`web/README.md`](./web/README.md).

---

## Not yet prioritized

Ideas from [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) not ordered above; add priorities when ready:

- iOS app
- Windows desktop app
- Offline storage and sync on mobile/desktop
- Point-in-time recovery / production hardening
- PATCH-style partial updates, duplicate detection on POST
- Enable Cognito self sign-up

---

## Revision log

| Date | Change |
|------|--------|
| 2026-05-31 | Auth v1 shipped: Cognito, admin-only sign-up, secured API + web login |
| 2026-05-31 | Roadmap: ideal-weight inputs documented under item 3 |
| 2026-05-31 | User profiles: UserProfiles table, GET/PUT /profile, web form |
| 2026-05-31 | Goals + ideal weight (#3): profile fields, API, chart reference lines |
| 2026-05-31 | Added #8 IBW and BMI improvements (chart band, clearer labels, current BMI) |
