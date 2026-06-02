# Task Files — Index & Conventions

> Per-phase task breakdowns for [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md). Start at the [Progress Summary](../DEVELOPMENT_PLAN.md#progress-summary). Mirrors the `nest-logger-example` / `nest-auth-example` `docs/tasks/` convention. The product spec is [`../TECHNICAL_SPECIFICATION.md`](../TECHNICAL_SPECIFICATION.md); the dashboard spec is [`../DASHBOARD.md`](../DASHBOARD.md).

## Phase files

| Phase | File                                  | Scope                                                                  |
| ----- | ------------------------------------- | ---------------------------------------------------------------------- |
| 0     | `phase-00-repo-foundation.md`         | pnpm monorepo, strict TS/ESLint/Prettier, husky/commitlint, renovate   |
| 1     | `phase-01-redis-stack.md`             | docker-compose `redis:7` + keyspace notifications + tools/cluster/sentinel profiles |
| 2     | `phase-02-library-consumption.md`     | consume `@bymax-one/nest-cache` (local link); `.` + `./shared` subpath probe |
| 3     | `phase-03-api-skeleton-wiring.md`     | NestJS 11, `forRootAsync`, events bridge, `CacheExceptionFilter`, gateway skeleton, `/health` |
| 4     | `phase-04-domain-data-structures.md`  | catalog / counters / collections + app metrics — strings/numerics/hashes/sets/batch/TTL |
| 5     | `phase-05-cache-admin-api.md`         | `scan`/`keys`/`info`/`keyspace`/`pipeline` seed/`flushNamespace`/get-del — the Explorer backend |
| 6     | `phase-06-namespace-tenants.md`       | per-tenant prefix scoping + foreign-namespace seed + `flushNamespace` isolation proof |
| 7     | `phase-07-serialization.md`           | default `JsonSerializer` + custom `MsgPackSerializer` + serializer-demo |
| 8     | `phase-08-pubsub-websocket.md`        | `PubSubService` publish/subscribe/psubscribe + socket.io gateway bridge |
| 9     | `phase-09-ttl-events.md`              | raw keyspace subscriber (`BYMAX_CACHE_CONNECTION` → `createSubscriberClient`) |
| 10    | `phase-10-lua-stampede.md`            | `ScriptManagerService` + `CacheService.eval` single-flight lock        |
| 11    | `phase-11-topologies-errors.md`       | sentinel/cluster config + profiles; `errors-demo` (each `CacheException`); cluster restrictions |
| 12    | `phase-12-web-skeleton-design.md`     | Next.js 16 + **the copied design system** + app shell + api-client/socket + `./shared` import |
| 13    | `phase-13-dashboard-observe.md`       | Overview + Explorer + Playground + Tenants pages                       |
| 14    | `phase-14-dashboard-realtime-labs.md` | Pub/Sub + TTL Live + Stampede + Serializer + Errors + Connection pages  |
| 15    | `phase-15-testing.md`                 | E2E smoke (Testcontainers `redis:7-alpine` + `ioredis-mock`) + web Playwright smoke |
| 16    | `phase-16-docs-readme-audit.md`       | README (badges, journeys) + curl walkthroughs + export-usage audit     |

## Task-file conventions

Each `phase-NN-*.md` follows this anatomy (matching the sibling examples):

1. **Header** — `# Phase NN — Title — Tasks` then a blockquote: source link into the `DEVELOPMENT_PLAN.md` phase anchor · `Total tasks: M` · `Progress: 🔴 0 / M done (0%)` · the status legend.
2. **Task index** — a JIRA-style table: `| ID | Task | Status | Priority | Size | Depends on |`. IDs are `PNN-n` (e.g. `P3-2`). Status ∈ {🔴 🟡 🔵 🟢 ⚪}. Priority ∈ {High, Medium, Low}. Size ∈ {XS, S, M, L}. Depends-on = comma-separated IDs / a phase reference / `—`.
3. **Task blocks** — one `## PNN-n — Title` per task, with bullet metadata (Status/Priority/Size/Depends on) then `### Description`, `### Acceptance Criteria` (checkboxes), `### Files to create / modify` (path bullets), `### Agent Execution Prompt` (a blockquote: Role · Context · Objective · Steps · Constraints · Verification), and `### Completion Protocol` (numbered).
4. **Completion log** — a bottom `## Completion log` appended one line per finished task (`PNN-n ✅ YYYY-MM-DD — one-liner`, newest at the bottom).

### Completion Protocol (per task)

1. Set the task's row Status to 🟢 Done.
2. Tick every Acceptance Criteria checkbox.
3. Update the task's row in the Task index.
4. Increment the file header's Progress counter.
5. Update the matching `DEVELOPMENT_PLAN.md` Progress Summary row (Done/Total, %, Status).
6. Recompute Overall progress (sum across all phases).
7. Append a line to this phase's Completion log.

When a phase reaches 100%, flip its Progress-Summary row to 🟢 Done. **Never** mark a task done with failing verification (no `--no-verify`, no skipped Definition of Done).

## Status legend

🔴 Not Started · 🟡 In Progress · 🔵 In Review · 🟢 Done · ⚪ Blocked

**Rules:** only **one** 🟡 In Progress task per phase at a time; never start a task until every dependency is 🟢 Done.

## Execution order

Follow the [Phase Map](../DEVELOPMENT_PLAN.md#1-phase-map--dependencies). Backend `0→1→3→4→5→6` is mostly linear; once Phase 3 (wiring + gateway + exception filter) lands, the feature phases **7, 8, 10, 11** fan out in parallel (and `8→9`). The frontend track (`12→13→14`) parallelizes once Phase 3 exists (the skeleton can use mocks; Observe pages need 4+5; Real-time/Labs pages need 7–11). The quality track (`15→16`) consolidates after the apps are feature-complete — though every feature phase's Definition of Done already requires its own happy-path proof.

> **Example-app quality bar (not the library's).** This repo demonstrates and integration-tests `@bymax-one/nest-cache`; it does **not** carry the library's 100%-coverage + 100%-mutation gates. There is **no mutation phase**. The verification bar is an E2E smoke suite against a real Redis (Testcontainers) + lint/typecheck/web-build + an export-usage audit. See [`DEVELOPMENT_PLAN.md` Appendix C](../DEVELOPMENT_PLAN.md#appendix-c--quality-gates).
