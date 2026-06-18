# Phase 17 — E2E: Every Flow (HTTP + WebSocket) — Tasks

> **Source:** [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#phase-17--e2e-every-flow-http--websocket) §Phase 17
> **Total tasks:** 8
> **Progress:** 🔴 0 / 8 done (0%)
>
> **Status legend:** 🔴 Not Started · 🟡 In Progress · 🔵 In Review · 🟢 Done · ⚪ Blocked

## Task index

| ID    | Task                                                                                     | Status | Priority | Size | Depends on   |
| ----- | ---------------------------------------------------------------------------------------- | ------ | -------- | ---- | ------------ |
| P17-1 | E2E toolchain — `supertest` + `socket.io-client` helpers over `createTestApp`            | 🔴     | High     | M    | P15, P16     |
| P17-2 | HTTP E2E — catalog (6) + metrics + health                                                | 🔴     | High     | M    | P17-1        |
| P17-3 | HTTP E2E — admin (9 routes)                                                              | 🔴     | High     | M    | P17-1        |
| P17-4 | HTTP E2E — collections (8) + counters (3)                                                | 🔴     | High     | M    | P17-1        |
| P17-5 | HTTP E2E — tenants (4) + serializer-demo (3)                                             | 🔴     | High     | M    | P17-1        |
| P17-6 | HTTP + WS E2E — pubsub (4) + `cache:event` fan-out                                       | 🔴     | High     | M    | P17-1        |
| P17-7 | HTTP + WS E2E — ttl-events + stampede + errors-demo + `cache:expired`/`cache:connection` | 🔴     | High     | M    | P17-1        |
| P17-8 | Phase verification gate — every route + WS channel asserted                              | 🔴     | High     | S    | P17-1..P17-7 |

> **Phase rule — read before any task.** This phase proves the **published library through the full HTTP + WebSocket surface** of the example. Hard constraints, every task:
>
> - **Real app, real Redis.** Boot the production `AppModule` via the Phase-15 `createTestApp` (Testcontainers `redis:7-alpine`), with the **same globals as `main.ts`** — the global `ZodValidationPipe` (if applied globally) and the global `CacheExceptionFilter` (`APP_FILTER`) must be active so error envelopes and 400/404 paths are real. Drive HTTP via `supertest(app.getHttpServer())`; drive WebSocket via a real `socket.io-client` connected to the booted server.
> - **Cover every route** — all 38 HTTP routes across 12 controllers + `/health`, and all three WS channels (`cache:connection`, `cache:event`, `cache:expired`). Assert status codes, response bodies, and the failure paths (400 from the Zod pipe `{ error: { code, issues } }`, 404, and the `CacheException` envelope `{ error: { code, message, details } }`).
> - **Naming/tiers.** New specs are `*.e2e-spec.ts` under `apps/api/test/` (matched by the existing `jest-e2e.config.mjs`, rootDir `test`). They do NOT affect the Phase-16 unit coverage gate (rootDir `src`). The keyspace-expiry WS test needs the container's `--notify-keyspace-events Ex` (already set by the P15-1 helper).
> - **Independent specs.** Each file owns its container lifecycle (or a shared per-file container) in `beforeAll`/`afterAll`; no cross-file Redis state. Await events (`once`) / poll — never blind-sleep. English-only; every `it()` has a scenario comment; no `@ts-ignore`/`eslint-disable`/`--no-verify`.

---

## P17-1 — E2E toolchain: `supertest` + `socket.io-client` helpers

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** M (90–180 min)
- **Depends on:** `P15`, `P16`

### Description

Extend the Phase-15 `test/helpers` so every flow spec can drive the real app over HTTP and WebSocket. Install `supertest` + `@types/supertest`. Add a helper that returns a `supertest` agent bound to `app.getHttpServer()`, and a `socket.io-client` helper that connects to the booted server, collects `cache:connection` / `cache:event` / `cache:expired` frames into typed buffers, and tears down. Ensure `createTestApp` wires the production globals exactly as `main.ts` (CORS adapter optional in tests; the `CacheExceptionFilter` `APP_FILTER` is already in `AppModule`, and any global pipe must be applied). Prove the harness with one HTTP request (`GET /health` → 200) and one socket connection.

### Acceptance Criteria

- [ ] `apps/api` devDeps add `supertest` + `@types/supertest`.
- [ ] `apps/api/test/helpers/http.ts` exports a `supertest` agent factory over `createTestApp`'s `app`.
- [ ] `apps/api/test/helpers/socket-client.ts` connects a `socket.io-client` to the booted server, exposes typed capture buffers + a `waitForEvent(channel, predicate, timeout)` helper, and a clean `close()`.
- [ ] `createTestApp` is confirmed/adjusted to run with the global exception filter active and a globally-applied `ZodValidationPipe` if/where the app applies one (so HTTP error envelopes are production-accurate); the socket.io adapter is initialized so the server accepts client connections under `app.init()`/`listen(0)`.
- [ ] A smoke `apps/api/test/http-smoke.e2e-spec.ts`: `GET /health` → 200 `{ status: 'ok' }`; a socket connects and disconnects cleanly.

### Files to create / modify

- `apps/api/test/helpers/http.ts` — supertest agent factory.
- `apps/api/test/helpers/socket-client.ts` — socket.io-client capture helper.
- `apps/api/test/helpers/test-app.ts` — ensure globals + a listening server for the socket client.
- `apps/api/test/http-smoke.e2e-spec.ts` — HTTP + socket smoke.
- `apps/api/package.json` — `supertest` devDeps.

### Agent Execution Prompt

> Role: Senior NestJS engineer building an HTTP + WebSocket E2E harness.
> Context: Task P17-1 of `docs/DEVELOPMENT_PLAN.md` §Phase 17. Reference `nest-auth-example/apps/api/test/setup.ts` (`createTestApp` + `supertest.agent(app.getHttpServer())`) — but this app's real-time layer is **socket.io**, not SSE, so also wire a `socket.io-client`. The Phase-15 `createTestApp` already boots `AppModule` against a Testcontainers Redis and runs lifecycle hooks; to accept socket connections, initialize the socket.io adapter and `listen(0)` (ephemeral port) so the client can connect to `http://127.0.0.1:<port>`.
> Objective: the two helpers + a green HTTP+socket smoke.
> Steps:
>
> 1. `pnpm --filter api add -D supertest @types/supertest`.
> 2. `http.ts`: `export const httpAgent = (app) => request(app.getHttpServer())`.
> 3. `socket-client.ts`: connect `io(`http://127.0.0.1:${port}`, { transports:['websocket'] })`, push `cache:connection`/`cache:event`/`cache:expired`payloads into arrays, expose`waitForEvent`, and `close()`.
> 4. Ensure `createTestApp` applies the global filter + pipe and `await app.listen(0)`; expose the resolved port.
> 5. `http-smoke.e2e-spec.ts`: assert `GET /health` 200 and a socket connect/disconnect.
>    Constraints: real container; no mocks of the app; close the socket + app + container in `afterAll`. ESM + `@jest/globals`.
>    Verification: `pnpm --filter api test:e2e -- http-smoke.e2e-spec.ts` — green with Docker up.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum / 129).
7. ✅ Append `- P17-1 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P17-2 — HTTP E2E: catalog (6) + metrics + health

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** M (90–180 min)
- **Depends on:** `P17-1`

### Description

E2E every catalog route plus metrics + health through real HTTP: `GET /catalog/products?ids=`, `GET /catalog/products/:id` (hit + 404), `GET /catalog/products/:id/ttl`, `POST /catalog/products/:id/seed` (idempotent), `POST /catalog/products/:id/expire`, `POST /catalog/products/:id/persist`; `GET /metrics` (hit/miss snapshot shape); `GET /health` (ok + the never-500 contract). Assert the read-through hit/miss accounting is reflected in `/metrics`.

### Acceptance Criteria

- [ ] `apps/api/test/catalog.e2e-spec.ts` covers all 6 catalog routes incl. the batch positional-null behavior, the 404 on unknown id, and idempotent `seed` (`{ isCreated, isPresent }`).
- [ ] `GET /metrics` asserted (hit/miss counters move after catalog reads); `GET /health` asserts `{ status: 'ok', latencyMs >= 0 }`.
- [ ] Invalid inputs (e.g. a bad `ids`/ttl) return the Zod-pipe 400 envelope.

### Files to create / modify

- `apps/api/test/catalog.e2e-spec.ts`, `apps/api/test/metrics-health.e2e-spec.ts`.

### Agent Execution Prompt

> Role: Senior NestJS engineer writing HTTP E2E for the catalog domain.
> Context: Task P17-2 of §Phase 17; routes from the audit/`catalog.controller.ts`. Seed ids `p1..p5` exist in the origin store.
> Objective: every catalog + metrics + health route asserted over supertest.
> Steps: boot the app+container; for each route, fire the request via the agent and assert status + body; verify `/metrics` reflects the hit/miss; assert a bad request → 400 envelope.
> Constraints: real Redis; assert bodies precisely; no app mocks; commented `it()`s.
> Verification: `pnpm --filter api test:e2e -- catalog.e2e-spec.ts metrics-health.e2e-spec.ts` — green.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`. 2. ✅ Tick all criteria. 3. ✅ Update the index row. 4. ✅ Increment Progress. 5. ✅ Update the `DEVELOPMENT_PLAN.md` row. 6. ✅ Recompute overall (/129). 7. ✅ Append `- P17-2 ✅ YYYY-MM-DD — …` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P17-3 — HTTP E2E: admin (9 routes)

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** M (90–180 min)
- **Depends on:** `P17-1`

### Description

E2E the whole Admin/Explorer backend: `GET /admin/info`, `GET /admin/keyspace`, `GET /admin/keys` (scan + keys strategies), `GET /admin/keys/:key` (inspect + 404), `DELETE /admin/keys/:key`, `POST /admin/keys/:key/persist`, `POST /admin/keys/:key/expire`, `POST /admin/seed?count=`, `DELETE /admin/namespace` (flush). Seed via the API, assert listing/inspect/delete/ttl semantics and the keyspace breakdown shape.

### Acceptance Criteria

- [ ] `apps/api/test/admin.e2e-spec.ts` covers all 9 admin routes.
- [ ] Inspect returns `{ type, value, raw, ttl, memoryBytes }`; 404 on an absent key; `DELETE /admin/namespace` clears `cache-example:*` (foreign key survives).
- [ ] `POST /admin/seed?count=N` creates N keys (verified via `GET /admin/keys`).
- [ ] Bad params (key charset / count bounds) return the 400 envelope.

### Files to create / modify

- `apps/api/test/admin.e2e-spec.ts`.

### Agent Execution Prompt

> Role: Senior NestJS engineer writing HTTP E2E for the admin backend.
> Context: Task P17-3 of §Phase 17; routes from `admin.controller.ts`. The library `flushNamespace` is namespace-scoped; seed a foreign `other-app:*` key via a prior raw write or the tenants seed route to prove survival.
> Objective: all 9 admin routes asserted.
> Steps: seed → list (both strategies) → inspect → expire/persist → delete → keyspace breakdown → namespace flush; assert each body + the 400 paths.
> Constraints: real Redis; precise body asserts; commented `it()`s.
> Verification: `pnpm --filter api test:e2e -- admin.e2e-spec.ts` — green.

### Completion Protocol

1. ✅ Status → 🟢. 2. ✅ Tick criteria. 3. ✅ Index row. 4. ✅ Progress. 5. ✅ Plan row. 6. ✅ Overall (/129). 7. ✅ `- P17-3 ✅ YYYY-MM-DD — …` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P17-4 — HTTP E2E: collections (8) + counters (3)

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** M (90–180 min)
- **Depends on:** `P17-1`

### Description

E2E the hash-cart + tag-set routes (`GET/POST/DELETE /collections/:id/cart[/:field]`, `POST/GET/DELETE /collections/:id/tags[/:tag]`, `GET /collections/:id/tags/:tag`) and the atomic counters (`GET /counters/:id/views`, `POST /counters/:id/views/incr`, `POST /counters/:id/stock/decr`, with/without `{ by }`).

### Acceptance Criteria

- [ ] `apps/api/test/collections.e2e-spec.ts` covers all 8 collections routes (cart hget/hgetall/hset/hdel, tags sadd/smembers+scard/sismember/srem).
- [ ] `apps/api/test/counters.e2e-spec.ts` covers the 3 counter routes incl. the `by` branch and the `0`-when-absent read.
- [ ] Invalid bodies return the 400 envelope.

### Files to create / modify

- `apps/api/test/collections.e2e-spec.ts`, `apps/api/test/counters.e2e-spec.ts`.

### Agent Execution Prompt

> Role: Senior NestJS engineer writing HTTP E2E for collections + counters.
> Context: Task P17-4 of §Phase 17; routes from `collections.controller.ts` / `counters.controller.ts`.
> Objective: all 11 routes asserted over supertest against real Redis.
> Steps: exercise each route's happy + edge path; assert bodies + the 400 paths; verify atomic incr/decr math.
> Constraints: real Redis; commented `it()`s; precise asserts.
> Verification: `pnpm --filter api test:e2e -- collections.e2e-spec.ts counters.e2e-spec.ts` — green.

### Completion Protocol

1. ✅ Status → 🟢. 2. ✅ Tick criteria. 3. ✅ Index row. 4. ✅ Progress. 5. ✅ Plan row. 6. ✅ Overall (/129). 7. ✅ `- P17-4 ✅ YYYY-MM-DD — …` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P17-5 — HTTP E2E: tenants (4) + serializer-demo (3)

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** M (90–180 min)
- **Depends on:** `P17-1`

### Description

E2E the tenant isolation routes (`GET /tenants/:t/products/:id` prefix-scoped read-through with `source: cache|origin`, `DELETE /tenants/:t/cache`, `POST /tenants/seed-foreign`, `POST /tenants/prove-isolation`) and the serializer routes (`POST /serializer/roundtrip?codec=`, `POST /serializer/caveat?codec=`, `GET /serializer/active`).

### Acceptance Criteria

- [ ] `apps/api/test/tenants.e2e-spec.ts` covers all 4 tenant routes; asserts `source` flips cache↔origin, `clearTenant` scopes to one tenant, and `prove-isolation` shows the foreign key surviving a flush.
- [ ] `apps/api/test/serializer-demo.e2e-spec.ts` covers roundtrip (raw vs decoded vs rawBypass), the Date-survival caveat (`dateSurvived`), and `GET /serializer/active`.
- [ ] Bad `codec` / tenant id → 400 envelope.

### Files to create / modify

- `apps/api/test/tenants.e2e-spec.ts`, `apps/api/test/serializer-demo.e2e-spec.ts`.

### Agent Execution Prompt

> Role: Senior NestJS engineer writing HTTP E2E for tenants + serializer.
> Context: Task P17-5 of §Phase 17; routes from `tenants.controller.ts` / `serializer-demo.controller.ts`. Default serializer is JSON unless `CACHE_SERIALIZER=msgpack`; the `?codec=` switch drives the route.
> Objective: all 7 routes asserted.
> Steps: per route, exercise happy + edge; for serializer, contrast JSON Date→ISO vs the codec; for tenants, prove prefix isolation through HTTP.
> Constraints: real Redis; commented `it()`s.
> Verification: `pnpm --filter api test:e2e -- tenants.e2e-spec.ts serializer-demo.e2e-spec.ts` — green.

### Completion Protocol

1. ✅ Status → 🟢. 2. ✅ Tick criteria. 3. ✅ Index row. 4. ✅ Progress. 5. ✅ Plan row. 6. ✅ Overall (/129). 7. ✅ `- P17-5 ✅ YYYY-MM-DD — …` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P17-6 — HTTP + WS E2E: pubsub (4) + `cache:event` fan-out

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** M (90–180 min)
- **Depends on:** `P17-1`

### Description

E2E the Pub/Sub routes (`POST /pubsub/publish`, `POST /pubsub/subscribe`, `DELETE /pubsub/subscribe`, `POST /pubsub/throw`) AND the WebSocket fan-out: a `socket.io-client` asserts that a `POST /pubsub/publish` to a subscribed channel arrives on the `cache:event` socket channel (exact + pattern), and that ref-counted subscribe/unsubscribe + the throwing-handler isolation behave per contract.

### Acceptance Criteria

- [ ] `apps/api/test/pubsub.e2e-spec.ts` (HTTP+WS) covers all 4 routes.
- [ ] A connected socket client receives a `cache:event` for a published message (exact channel + a `product:*` pattern), with the namespaced channel surfaced.
- [ ] Ref-counted `POST`/`DELETE /pubsub/subscribe` returns the updated ref counts; a double/unknown unsubscribe is a safe no-op.
- [ ] `POST /pubsub/throw` triggers the handler-error isolation without breaking other delivery.

### Files to create / modify

- `apps/api/test/pubsub-flows.e2e-spec.ts` (named distinctly from the Phase-15 `pubsub.e2e-spec.ts`).

### Agent Execution Prompt

> Role: Senior NestJS engineer writing HTTP + WebSocket E2E for Pub/Sub.
> Context: Task P17-6 of §Phase 17. The browser publishes over REST; the bridge forwards to the `cache:event` socket channel (`PubSubBridgeService` → `EventsGateway.emitMessage`). Use the P17-1 socket helper to capture frames; `waitForEvent` rather than sleeping.
> Objective: all 4 routes + the `cache:event` fan-out asserted.
> Steps: connect a socket; publish via REST; assert the frame; exercise subscribe/unsubscribe ref-counting + the throw route.
> Constraints: real Redis; await events; commented `it()`s; close the socket in `afterAll`.
> Verification: `pnpm --filter api test:e2e -- pubsub-flows.e2e-spec.ts` — green.

### Completion Protocol

1. ✅ Status → 🟢. 2. ✅ Tick criteria. 3. ✅ Index row. 4. ✅ Progress. 5. ✅ Plan row. 6. ✅ Overall (/129). 7. ✅ `- P17-6 ✅ YYYY-MM-DD — …` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P17-7 — HTTP + WS E2E: ttl-events + stampede + errors-demo + `cache:expired`/`cache:connection`

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** M (90–180 min)
- **Depends on:** `P17-1`

### Description

Close the route + WS surface: `POST /ttl-events/seed` drives a real key expiry that the socket asserts on the `cache:expired` channel; `POST /stampede` returns the single-flight summary over HTTP; `POST /errors/:code` provokes each `CacheException` and asserts the global filter's status + `{ error: { code, message, details } }` envelope for representative codes (all 15 are swept at the service level in Phase 15/16 — here assert the HTTP filter mapping + the `errorCodeParamSchema` normalization). Also assert `cache:connection` fires on the socket when the connection lifecycle emits.

### Acceptance Criteria

- [ ] `apps/api/test/ttl-events.e2e-spec.ts`: `POST /ttl-events/seed` → the socket receives a `cache:expired` frame for the namespaced key (needs `--notify-keyspace-events Ex`).
- [ ] `apps/api/test/stampede-flow.e2e-spec.ts`: `POST /stampede?concurrency=N` returns the timeline + summary (1 origin + N−1 hits) over HTTP.
- [ ] `apps/api/test/errors-flow.e2e-spec.ts`: `POST /errors/:code` for representative 4xx/5xx/504 codes asserts the HTTP status + filter envelope; the `cache.`-prefix normalization + unknown-code 400 are covered.
- [ ] A socket client observes at least one `cache:connection` frame during the run.

### Files to create / modify

- `apps/api/test/ttl-events.e2e-spec.ts`, `apps/api/test/stampede-flow.e2e-spec.ts`, `apps/api/test/errors-flow.e2e-spec.ts`.

### Agent Execution Prompt

> Role: Senior NestJS engineer writing HTTP + WebSocket E2E for ttl/stampede/errors.
> Context: Task P17-7 of §Phase 17. The `cache:expired` feed comes from the raw keyspace subscriber (`TtlEventsService`); the container has `--notify-keyspace-events Ex`. The errors route maps via the global `CacheExceptionFilter`.
> Objective: the remaining routes + `cache:expired`/`cache:connection` asserted.
> Steps: seed a short-TTL key and await the `cache:expired` frame; fire the stampede burst and assert the summary; sweep representative error codes over HTTP and assert status+envelope; assert a `cache:connection` frame.
> Constraints: real Redis; await events; commented `it()`s.
> Verification: `pnpm --filter api test:e2e -- ttl-events.e2e-spec.ts stampede-flow.e2e-spec.ts errors-flow.e2e-spec.ts` — green.

### Completion Protocol

1. ✅ Status → 🟢. 2. ✅ Tick criteria. 3. ✅ Index row. 4. ✅ Progress. 5. ✅ Plan row. 6. ✅ Overall (/129). 7. ✅ `- P17-7 ✅ YYYY-MM-DD — …` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P17-8 — Phase verification gate: every route + WS channel asserted

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** S (30–90 min)
- **Depends on:** `P17-1`..`P17-7`

### Description

Close the phase: confirm every one of the 38 HTTP routes + 3 WS channels is asserted by at least one E2E spec, the full `pnpm --filter api test:e2e` suite is green against real Redis, and lint/typecheck/format are clean with all new specs. Produce a short coverage-of-flows checklist (route → spec) in the completion log.

### Acceptance Criteria

- [ ] A route→spec map shows every controller route + `/health` + all 3 WS channels covered.
- [ ] `pnpm --filter api test:e2e` runs the whole suite green with Docker up.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm format:check` clean.
- [ ] No `@ts-ignore`/`eslint-disable`/`.skip`/`.todo` in the new specs.

### Files to create / modify

- _(verification only; fix earlier P17 specs if a flow is missing.)_

### Agent Execution Prompt

> Role: Senior engineer closing the E2E phase.
> Context: Task P17-8 of §Phase 17. Cross-check the audit's 38-route master list + the 3 WS channels against the specs.
> Objective: prove full-flow coverage + a green suite.
> Steps: build the route→spec map; run the full e2e suite; run lint/typecheck/format; grep for banned suppressions/skips.
> Constraints: do not weaken a test to pass; add the missing flow instead.
> Verification: `pnpm --filter api test:e2e` — green; `grep -RInE "@ts-ignore|eslint-disable|\.skip\(|\.todo\(" apps/api/test` — none.

### Completion Protocol

1. ✅ Status → 🟢. 2. ✅ Tick criteria. 3. ✅ Index row. 4. ✅ Progress. 5. ✅ Plan row. 6. ✅ Overall (/129). 7. ✅ `- P17-8 ✅ YYYY-MM-DD — …` to **Completion log**.

When this task is 🟢, Phase 17 is 8/8 — switch the Phase 17 row in `DEVELOPMENT_PLAN.md` Progress Summary to 🟢 Done.

⚠️ Never mark done with failing verification.

---

## Completion log

_(Agents append one line per finished task, newest at the bottom.)_
