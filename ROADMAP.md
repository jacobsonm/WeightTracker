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
| **Priority** | 4 |
| **Status** | done |
| **Scope** | A web view (section or dashboard) showing key progress metrics. |

**Metrics to display**

| Metric | Definition (to confirm when building) |
|--------|----------------------------------------|
| **Starting weight** | Weight from the **first weigh-in** in history (all time) |
| **Current weight** | Most recent weigh-in |
| **Total change since first weigh-in** | `starting weight − current weight`; UI shows **weight lost** or **weight gained** (absolute value) with wording that matches the direction—not a negative “lost” when the user gained |
| **% progress to next goal** | Progress toward the next intermediate goal from #3; if none configured, show prompt text instead of a value (see **Decisions**) |
| **% progress to target weight** | Progress toward user-set `targetWeight` from #3 (not Devine `idealWeight`); if unset, show prompt text instead of a value (see **Decisions**) |

**Decisions (v1)**  
- Even with a long history, **total change** always uses the **first recorded weigh-in** as the starting point—not a rolling “goal period” start date.  
- UI should say explicitly that the figure is **since first measurement** so it is not confused with progress toward the current target.  
- If current weight is **above** starting weight, show a **gain** (e.g. “Gained 3.2 lbs since first weigh-in”); if **below**, show a **loss**. Labels and copy must reflect gain vs loss, not always “lost.”  
- If **no intermediate goals** are set, do not show a % for goal progress—show copy such as **“Add a goal to show goal progress”** (exact wording can be tuned in UI).  
- If **`targetWeight`** is not set, do not show target progress %—show copy such as **“Add a target weight to show progress”**.

**Depends on**  
#3 (`targetWeight`, intermediate goals). Needs weigh-in history (#1) and profile (#2). Computed `idealWeight` / `idealWeightRange` remain reference-only (chart/profile), not used for this metric.

**Likely direction**  
- Compute in web from existing `GET /weigh-ins` + profile/goals APIs, or add a `GET /progress` summary endpoint if logic grows.  
- Implement as a reusable progress summary block; **#5** places it on the home view (below the add weigh-in form).

**Future enhancement (after #4)**  
- When history grows past a threshold (TBD), **prompt the user** to set a **new starting weight** for progress summaries—e.g. a prior intermediate goal they met, so total change (lost/gained) and related metrics can reflect the **current journey** without losing all-time stats.  
- Likely needs a stored field on profile (e.g. `progressStartDateTime` / `progressStartWeight`) and UI to accept or dismiss the prompt; design TBD.

**Touches**  
Web UI (`web/`), possibly goals API from #3, [`DYNAMODB_SCHEMA.md`](./DYNAMODB_SCHEMA.md).

---

### 5. Web layout and navigation

| | |
|---|---|
| **Priority** | 5 |
| **Status** | done |
| **Scope** | Reorganize the signed-in web app into a **home** landing view plus **Profile** and **History** destinations with clear navigation. |

**Decisions**

| View | Contents |
|------|----------|
| **Home (default)** | **Add weigh-in form** at the top, then **progress summary** (#4) directly underneath |
| **History** | **Trend chart** and **tabular weigh-in history** (and delete actions) together on one view |
| **Profile** | Existing profile form: display name, birthdate, sex, height, timezone, target weight, intermediate goals, ideal-weight estimate text |

- Add **navigation** in the UI to move between Home, Profile, and History (tabs, header links, or similar—choose during implementation).
- Account / sign-in UI remains available across views (e.g. header).

**Depends on**  
#4 (progress summary). Reuses existing web features from #1–#3; no new API required for basic layout.

**Likely direction**  
- Refactor `web/index.html` / `app.js` / `styles.css` from a single long scroll into named views (show/hide sections or light client-side routing).  
- Default signed-in landing = **Home**, not Profile or History.

**Touches**  
`web/index.html`, `web/app.js`, `web/styles.css`.

---

### 6. Single CloudFront hostname for web + API

| | |
|---|---|
| **Priority** | 6 |
| **Status** | done |
| **Scope** | One CloudFront URL serves the static web app and proxies API traffic (no separate API Gateway URL in the browser). |

**Decisions**
- Public API path: **`/api/*`** on the CloudFront hostname (Option B).
- CloudFront **viewer-request function** strips `/api` and forwards to API Gateway stage path (e.g. `/prod/weigh-ins`).
- Deployed `config.js` sets `apiBaseUrl: '/api/'` (same-origin); **local dev** still uses direct **`ApiGatewayUrl`** output in `config.js`.
- **Custom domain** deferred; same `/api/` pattern works when a domain is added later.

**Why**  
Today the web app on CloudFront calls API Gateway on a different hostname (CORS + two URLs in `config.js`). A single origin simplifies the client and matches a production-style setup.

**Likely direction**  
- CloudFront: default → S3 (web); `/api/*` → API Gateway with path rewrite (implemented).

**Touches**  
CDK (`infra/lib/infra-stack.ts`), web `config.js` generation, [`AUTH.md`](./AUTH.md) callback URLs.

---

### 7. Android app

| | |
|---|---|
| **Priority** | 7 (next) |
| **Status** | planned |
| **Scope** | Native **Android** client: sign in, record weigh-ins, view history/chart, sync with existing API. |

**Why**  
[`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) targets mobile/desktop clients; Android is the first native app.

**Likely direction**  
- Reuse Cognito auth (Hosted UI or embedded sign-in) and existing REST API.  
- Offline + sync deferred per original context, or minimal offline queue in a later iteration.  
- Technology TBD (Kotlin/Jetpack Compose is a common default).

**Depends on**  
Stable API and auth (#1); profile (#2) optional at v1; unified **`/api/`** on CloudFront (#6) for base URL configuration.

**Open questions**  
- Minimum v1 feature set vs parity with web?  
- Same Cognito app client or separate mobile client?  
- When to add offline storage (separate roadmap item)?

**Touches**  
New `android/` (or similar) project; no backend change required for basic parity.

---

### 8. Separate AWS environments (production and development)

| | |
|---|---|
| **Priority** | 8 |
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

### 9. IBW and BMI improvements

| | |
|---|---|
| **Priority** | 9 |
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
- Web progress summary (starting/current weight, change since first weigh-in, goal and target %)
- Web layout: Home / Profile / History navigation; sign-in in header
- Single CloudFront hostname: web + `/api/*` API proxy

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
- **Progress “new starting weight”** — user prompt after long history; reset baseline (often a met goal); see #4 future enhancement

---

## Revision log

| Date | Change |
|------|--------|
| 2026-05-31 | Auth v1 shipped: Cognito, admin-only sign-up, secured API + web login |
| 2026-05-31 | Roadmap: ideal-weight inputs documented under item 3 |
| 2026-05-31 | User profiles: UserProfiles table, GET/PUT /profile, web form |
| 2026-05-31 | Goals + ideal weight (#3): profile fields, API, chart reference lines |
| 2026-05-31 | Added #9 IBW and BMI improvements (was #8; chart band, labels, current BMI) |
| 2026-05-31 | Added #5 web layout/navigation; renumbered CloudFront, envs, Android, IBW |
| 2026-06-04 | #4 done: web progress summary (`web/progress.js`) |
| 2026-06-04 | #5 done: Home / Profile / History nav and view layout |
| 2026-06-04 | #6 done: CloudFront `/api/*` proxy; relative apiBaseUrl on deploy |
| 2026-06-04 | Swapped #7 (Android) and #8 (dev/prod environments) |
| 2026-05-31 | #4: % progress metric is toward target weight, not ideal weight estimate |
| 2026-05-31 | #4: v1 total lost since first weigh-in; future prompt for new starting weight |
| 2026-05-31 | #4: total change UI uses gain vs loss wording when appropriate |
| 2026-05-31 | #4: prompt copy when target weight or goals are unset |
