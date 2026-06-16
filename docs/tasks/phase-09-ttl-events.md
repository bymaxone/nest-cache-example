# Phase 9 — TTL Events (keyspace notifications) — Tasks

> **Source:** [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#phase-9--ttl-events-keyspace-notifications) §Phase 9
> **Total tasks:** 4
> **Progress:** 🔴 0 / 4 done (0%)
>
> **Status legend:** 🔴 Not Started · 🟡 In Progress · 🔵 In Review · 🟢 Done · ⚪ Blocked

## Task index

| ID   | Task                                                                                     | Status | Priority | Size | Depends on       |
| ---- | ---------------------------------------------------------------------------------------- | ------ | -------- | ---- | ---------------- |
| P9-1 | `TtlEventsService` — raw subscriber → `__keyevent@{db}__:expired` → emit `cache:expired` | 🔴     | High     | M    | Phase 8, Phase 1 |
| P9-2 | `onModuleDestroy` quits the dedicated subscriber connection                              | 🔴     | High     | S    | P9-1             |
| P9-3 | Short-TTL seed endpoint for the demo (reuses catalog `set(ttl)`)                         | 🔴     | Medium   | S    | P9-1             |
| P9-4 | Phase verification + inline "why not `PubSubService`" note                               | 🔴     | Medium   | S    | P9-1, P9-2, P9-3 |

---

## P9-1 — `TtlEventsService` — Raw Subscriber → `__keyevent@{db}__:expired` → Emit `cache:expired`

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** M (90–240 min)
- **Depends on:** `Phase 8`, `Phase 1`

### Description

Create `src/ttl-events/ttl-events.service.ts` — the escape-hatch demo. It opens a **dedicated** Redis subscriber via the library's `BYMAX_CACHE_CONNECTION` token (`ConnectionManager.createSubscriberClient()`), subscribes to Redis' fixed keyspace-notification channel `__keyevent@<db>__:expired` (db from `REDIS_DB`), filters incoming expired-key messages by the app namespace prefix (`KeyBuilder.getNamespacePrefix()`, e.g. `'cache-example:'`), and emits `cache:expired` through the Phase 8 `EventsGateway`. This is the only place the example reaches under the library's facade — and it does so **on purpose**, because Redis keyspace channels are fixed and live **outside** any app namespace, so `PubSubService` (which namespaces channels) cannot receive them. Requires `notify-keyspace-events Ex` in `redis.conf` (delivered in Phase 1).

### Acceptance Criteria

- [ ] `src/ttl-events/ttl-events.service.ts` exists; `TtlEventsService` is `@Injectable()` and implements `OnModuleInit` + `OnModuleDestroy`.
- [ ] Constructor injects `@Inject(BYMAX_CACHE_CONNECTION)` (typed `ConnectionManager`), `@Inject(BYMAX_CACHE_KEY_BUILDER)` (typed `KeyBuilder`), the `EventsGateway` (Phase 8), and `ConfigService<Env, true>`.
- [ ] `onModuleInit` reads `db` from `REDIS_DB` (default `0`), calls `connection.createSubscriberClient()` (stored on a private field), and `await sub.subscribe(\`**keyevent@${db}**:expired\`)`.
- [ ] A `message` listener emits `gateway.emitExpired(key)` **only** when `key.startsWith(keys.getNamespacePrefix())`; foreign-namespace expiries are ignored.
- [ ] `src/ttl-events/ttl-events.module.ts` declares the service and imports `EventsModule` (Phase 8); the module is registered in `AppModule`.
- [ ] `pnpm --filter api typecheck` exits 0.

### Files to create / modify

- `apps/api/src/ttl-events/ttl-events.service.ts` — the raw keyspace subscriber.
- `apps/api/src/ttl-events/ttl-events.module.ts` — module wiring.
- `apps/api/src/app.module.ts` — register `TtlEventsModule`.

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer wiring a Redis keyspace-notification subscriber for the reference app of `@bymax-one/nest-cache`.
> Context: Repo `nest-cache-example` is the reference app for `@bymax-one/nest-cache`. This is task P9-1 of `docs/DEVELOPMENT_PLAN.md` §Phase 9. Read `docs/TECHNICAL_SPECIFICATION.md` §17.3 (the canonical `TtlEventsService` listing + the "Why not `PubSubService`" callout), §4 (library API inventory — `ConnectionManager`, `KeyBuilder`, injection tokens), and `docs/DASHBOARD.md` §10 (TTL Live page — what the `cache:expired` feed drives) first. Phase 8 already shipped the `EventsGateway` with an `emitExpired(key: string)` method (`apps/api/src/events/events.gateway.ts`) and Phase 1 enabled `notify-keyspace-events Ex` in `docker/redis/redis.conf`. The library re-exports `ConnectionManager`, `KeyBuilder`, `BYMAX_CACHE_CONNECTION`, and `BYMAX_CACHE_KEY_BUILDER`.
> Objective: Implement the `TtlEventsService` raw-subscriber escape-hatch and wire its module into `AppModule`.
> Steps:
>
> 1. Create `/apps/api/src/ttl-events/ttl-events.service.ts`. Mirror the canonical shape from spec §17.3:
>
>    ```ts
>    import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
>    import { ConfigService } from '@nestjs/config'
>    import {
>      BYMAX_CACHE_CONNECTION,
>      BYMAX_CACHE_KEY_BUILDER,
>      type ConnectionManager,
>      type KeyBuilder,
>    } from '@bymax-one/nest-cache'
>    import type { Redis } from 'ioredis'
>    import { EventsGateway } from '../events/events.gateway'
>    import type { Env } from '../config/env.schema' // adjust to the actual Env type path
>
>    /**
>     * Streams real Redis key-expiry events to the browser via the dedicated raw
>     * subscriber — the library's documented escape hatch (spec §17.3).
>     *
>     * Redis keyspace-notification channels (`__keyevent@<db>__:expired`) are FIXED
>     * and live OUTSIDE any app namespace, so {@link PubSubService} — which namespaces
>     * every channel — cannot receive them. We therefore open a dedicated subscriber
>     * via {@link ConnectionManager.createSubscriberClient} and own its lifecycle.
>     *
>     * Requires `notify-keyspace-events Ex` in `redis.conf` (Phase 1).
>     */
>    @Injectable()
>    export class TtlEventsService implements OnModuleInit, OnModuleDestroy {
>      private sub?: Redis
>
>      constructor(
>        @Inject(BYMAX_CACHE_CONNECTION) private readonly connection: ConnectionManager,
>        @Inject(BYMAX_CACHE_KEY_BUILDER) private readonly keys: KeyBuilder,
>        private readonly gateway: EventsGateway,
>        private readonly config: ConfigService<Env, true>,
>      ) {}
>
>      async onModuleInit(): Promise<void> {
>        const db = this.config.get('REDIS_DB', { infer: true })
>        // createSubscriberClient returns a FRESH, DEDICATED connection; ownership
>        // transfers to us — we must quit() it in onModuleDestroy (P9-2).
>        this.sub = this.connection.createSubscriberClient() as Redis
>        await this.sub.subscribe(`__keyevent@${db}__:expired`)
>        const nsPrefix = this.keys.getNamespacePrefix() // e.g. 'cache-example:'
>        this.sub.on('message', (_channel, key: string) => {
>          // Only forward expiries inside our namespace; foreign-ns keys are ignored.
>          if (key.startsWith(nsPrefix)) this.gateway.emitExpired(key)
>        })
>      }
>
>      async onModuleDestroy(): Promise<void> {
>        // Implemented in P9-2.
>      }
>    }
>    ```
>
>    Adjust the `Env` import to the actual config type/path used by `apps/api` (the same one `health`/`admin` use). If the connection can be a cluster, the `as Redis` cast is acceptable here for the standalone demo — note that keyspace notifications + this single-channel subscribe are a standalone/sentinel concern (cluster fan-out is out of scope for the demo).
>
> 2. Create `/apps/api/src/ttl-events/ttl-events.module.ts`: a `@Module` that `imports: [EventsModule]` (the Phase 8 module that exports `EventsGateway`) and `providers: [TtlEventsService]`. No controller yet (the seed endpoint lands in P9-3).
> 3. Register `TtlEventsModule` in `/apps/api/src/app.module.ts`.
> 4. Run `pnpm --filter api typecheck`.
>    Constraints:
>
> - English-only identifiers, comments, and docs.
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions (strict TS, ESM, no Swagger, JSDoc on public members, no `@ts-ignore`/`eslint-disable`).
> - Do NOT use `PubSubService` for the keyspace channel — that is the whole point of this phase (the channel is fixed and un-namespaced; `PubSubService.subscribe` would namespace it to `cache-example:__keyevent@0__:expired`, which never fires).
> - Do NOT subscribe on the main client (`getClient()`); a Redis connection in subscriber mode can only run subscribe commands — use the **dedicated** `createSubscriberClient()`.
> - Filter strictly by `getNamespacePrefix()`; never emit foreign-namespace keys.
>   Verification:
> - `pnpm --filter api typecheck` — expected: exit 0.
> - `grep -n "createSubscriberClient" apps/api/src/ttl-events/ttl-events.service.ts` — expected: one match.
> - `grep -n "PubSubService" apps/api/src/ttl-events/ttl-events.service.ts` — expected: no match (escape hatch only).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P9-1 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P9-2 — `onModuleDestroy` Quits the Dedicated Subscriber Connection

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** S (30–90 min)
- **Depends on:** `P9-1`

### Description

`ConnectionManager.createSubscriberClient()` returns a **fresh, dedicated** connection whose **ownership transfers to the caller** — the library does not track or close it. The `TtlEventsService` must therefore `quit()` that connection in `onModuleDestroy`, so a graceful shutdown (`app.enableShutdownHooks()`) closes it cleanly and the process exits without a dangling Redis socket. This mirrors how the library quits the **main** client and how `PubSubService` closes **its** subscriber — the difference is that here the example owns the connection, so the example is responsible for tearing it down.

### Acceptance Criteria

- [ ] `onModuleDestroy` calls `await this.sub?.quit()` (optional-chained — the field is unset if init never ran).
- [ ] A short inline comment states that ownership of the subscriber transfers to the caller (so quitting it is mandatory), referencing spec §4 / §17.3.
- [ ] No double-close hazard: the field is only quit once; the service does not re-open the connection on destroy.
- [ ] `pnpm --filter api typecheck` exits 0.

### Files to create / modify

- `apps/api/src/ttl-events/ttl-events.service.ts` — fill in `onModuleDestroy`.

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer.
> Context: Task P9-2 of `docs/DEVELOPMENT_PLAN.md` §Phase 9. Read `docs/TECHNICAL_SPECIFICATION.md` §17.3 (the `onModuleDestroy` line) and §4 (`ConnectionManager.createSubscriberClient` — a fresh dedicated subscriber connection; ownership transfers to the caller). The `apps/api` `main.ts` calls `app.enableShutdownHooks()`, so `onModuleDestroy` runs on `SIGINT`/`SIGTERM`. The library quits its OWN clients (main client + `PubSubService` subscriber), but the connection returned by `createSubscriberClient()` is the caller's to close.
> Objective: Implement `onModuleDestroy` so the dedicated subscriber connection is quit on shutdown.
> Steps:
>
> 1. In `/apps/api/src/ttl-events/ttl-events.service.ts`, complete `onModuleDestroy`:
>
>    ```ts
>    async onModuleDestroy(): Promise<void> {
>      // createSubscriberClient() transferred ownership to us (spec §4/§17.3),
>      // so we must close this dedicated connection on shutdown.
>      await this.sub?.quit()
>    }
>    ```
>
> 2. Run `pnpm --filter api typecheck`.
>    Constraints:
>
> - English-only identifiers, comments, and docs.
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - Use `quit()` (graceful — drains pending replies), not `disconnect()` (abrupt).
> - Optional-chain `this.sub?` so a service that never initialized does not throw on destroy.
> - Do NOT also quit the main client or any library-owned connection here — only the subscriber this service created.
>   Verification:
> - `pnpm --filter api typecheck` — expected: exit 0.
> - `grep -n "this.sub?.quit()" apps/api/src/ttl-events/ttl-events.service.ts` — expected: one match.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P9-2 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P9-3 — Short-TTL Seed Endpoint for the Demo (Reuses Catalog `set(ttl)`)

- **Status:** 🔴 Not Started
- **Priority:** Medium
- **Size:** S (30–90 min)
- **Depends on:** `P9-1`

### Description

The TTL Live page (`DASHBOARD.md` §10) needs a button that drops a key with a short TTL so the reader can watch the countdown ring drain and then see the `cache:expired` event stream in. Add a thin seed endpoint that writes a namespaced key with a caller-supplied TTL by **reusing the catalog write path** (`CacheService.set(prefix, id, value, ttlSeconds)` from Phase 4) — no new write semantics, just a tiny, Zod-validated controller. The default TTL is short (e.g. 5s) so the demo and the Phase verification (P9-4) round-trip quickly.

### Acceptance Criteria

- [ ] `POST /ttl-events/seed` exists, accepting `{ id?: string; ttlSeconds?: number }` (Zod-validated; sensible defaults — generated `id`, `ttlSeconds` default 5, bounded to a small range e.g. 1–120).
- [ ] The handler writes a namespaced key via the catalog `set(ttl)` path (reuse `CatalogService` / `CacheService.set` — do not re-implement serialization or key building).
- [ ] The response returns the resolved namespaced key (via `KeyBuilder`) and the applied `ttlSeconds`, so the UI can register a countdown ring.
- [ ] Controller methods carry JSDoc; the DTO is Zod (no Swagger).
- [ ] `pnpm --filter api typecheck` exits 0; a manual `curl` against a running API returns the seeded key + TTL.

### Files to create / modify

- `apps/api/src/ttl-events/ttl-events.controller.ts` — the seed endpoint.
- `apps/api/src/ttl-events/dto/seed-ttl.dto.ts` — Zod schema + inferred type.
- `apps/api/src/ttl-events/ttl-events.module.ts` — register the controller (and import the catalog/cache provider it reuses).

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer.
> Context: Task P9-3 of `docs/DEVELOPMENT_PLAN.md` §Phase 9. Read `docs/DASHBOARD.md` §10 (the "Seed key w/ TTL: 30s" / "Seed persisted (∞)" affordances on the Countdown Wall) and §16 (the backing API table). Phase 4 shipped the catalog read-through cache with `CacheService.set(prefix, id, value, ttlSeconds)` and an `exists`/`ttl`/`expire`/`persist` surface (`apps/api/src/catalog/`). The repo uses a `ZodValidationPipe` (Phase 3) and bans Swagger — controllers are JSDoc-documented, DTOs are Zod.
> Objective: Add a short-TTL seed endpoint that reuses the catalog `set(ttl)` write path.
> Steps:
>
> 1. Create `/apps/api/src/ttl-events/dto/seed-ttl.dto.ts`: a Zod schema `seedTtlSchema = z.object({ id: z.string().min(1).optional(), ttlSeconds: z.number().int().min(1).max(120).default(5) })` and `export type SeedTtlDto = z.infer<typeof seedTtlSchema>`.
> 2. Create `/apps/api/src/ttl-events/ttl-events.controller.ts` with `@Controller('ttl-events')` and a `@Post('seed')` handler. Validate the body with the project's `ZodValidationPipe` + `seedTtlSchema`. In the handler: generate an `id` if absent (e.g. `crypto.randomUUID()`), call the catalog write path with the TTL (reuse `CatalogService` or inject `CacheService` and call `set(CACHE_PREFIX.product, id, demoValue, ttlSeconds)` — match however Phase 4 exposes the write), then return `{ key: keyBuilder.build(prefix, id) /* or the service's resolved key */, ttlSeconds }`. JSDoc the method (what it seeds + why short TTL).
> 3. Wire the controller into `/apps/api/src/ttl-events/ttl-events.module.ts` and import whatever module/provider gives you the catalog write (`CatalogModule` or `CacheModule` — match the existing wiring).
> 4. Run `pnpm --filter api typecheck`; then with `pnpm infra:up` + the API running, `curl -X POST localhost:3001/ttl-events/seed -H 'content-type: application/json' -d '{"ttlSeconds":5}'` and confirm it returns the namespaced key + `ttlSeconds`.
>    Constraints:
>
> - English-only identifiers, comments, and docs.
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions (Zod DTOs, JSDoc, no Swagger, strict TS).
> - Do NOT re-implement key building or serialization — reuse the catalog/`CacheService.set(ttl)` path so the key is namespaced and serialized exactly like every other cached value.
> - Keep the default TTL short (5s) and bounded; this is a demo seed, not a general write API.
>   Verification:
> - `pnpm --filter api typecheck` — expected: exit 0.
> - `curl -X POST localhost:3001/ttl-events/seed -d '{"ttlSeconds":5}' -H 'content-type: application/json'` — expected: JSON with a `cache-example:`-prefixed `key` and `"ttlSeconds": 5`.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P9-3 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P9-4 — Phase Verification + Inline "Why Not `PubSubService`" Note

- **Status:** 🔴 Not Started
- **Priority:** Medium
- **Size:** S (30–90 min)
- **Depends on:** `P9-1`, `P9-2`, `P9-3`

### Description

Close Phase 9 against its `DEVELOPMENT_PLAN.md` Definition of done: seeding a 5s-TTL key emits **exactly one** `cache:expired` for the namespaced key ~5s later, and foreign-namespace expiries are filtered out. Also land the mandated inline note (in the service's JSDoc / a short module-level comment) that explains **why** the keyspace subscriber uses the raw `BYMAX_CACHE_CONNECTION` escape hatch rather than `PubSubService`. This is the phase's teaching payload: `PubSubService.subscribe('__keyevent@0__:expired')` would be **namespaced** to `cache-example:__keyevent@0__:expired` — a channel Redis never publishes to — so it would silently never fire; the fixed Redis keyspace channel lives outside any app namespace and must be subscribed via a dedicated raw connection.

### Acceptance Criteria

- [ ] Manual end-to-end check passes: with `pnpm infra:up` (Redis with `notify-keyspace-events Ex`) and the API running, seeding via `POST /ttl-events/seed {"ttlSeconds":5}` produces **exactly one** `cache:expired` emission for the namespaced key ≈5s later (observed on the WS feed or a `socket.io` client / server log).
- [ ] Foreign-namespace filtering verified: writing an un-namespaced key with a short TTL via `getClient()` (e.g. `other-app:demo`) does **not** produce a `cache:expired` emission when it expires.
- [ ] The inline note exists in `ttl-events.service.ts` (JSDoc or top-of-file comment) and states the `PubSubService`-vs-raw-subscriber rationale, naming the would-be-namespaced channel `cache-example:__keyevent@0__:expired` and that it never fires.
- [ ] `redis-cli config get notify-keyspace-events` (against the dev Redis) returns a value containing `E` and `x` (Phase 1 prerequisite confirmed).
- [ ] `pnpm --filter api typecheck` + `pnpm --filter api lint` exit 0.

### Files to create / modify

- `apps/api/src/ttl-events/ttl-events.service.ts` — ensure the inline rationale note is present (add/expand if P9-1's JSDoc didn't fully cover it).
- _(verification only otherwise — fix P9-1..P9-3 if a check fails)_

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer closing a phase.
> Context: Task P9-4 of `docs/DEVELOPMENT_PLAN.md` §Phase 9. Definition of done: "seeding a 5s-TTL key emits exactly one `cache:expired` for the namespaced key ~5s later; foreign-namespace expiries are filtered out." Read `docs/TECHNICAL_SPECIFICATION.md` §17.3 (the "Why not `PubSubService`" callout — the source of the inline note) and §21.2 (`redis.conf` → `notify-keyspace-events Ex`). Keyspace notifications must be enabled on the dev Redis (Phase 1) or NOTHING fires — verify that first.
> Objective: Verify the Phase 9 behaviour end to end and ensure the rationale note is in the code.
> Steps:
>
> 1. Confirm the Phase 1 prerequisite: `pnpm infra:up`, then `docker compose exec redis redis-cli config get notify-keyspace-events` — the value must contain `E` and `x`. If not, the events never fire (fix Phase 1's `redis.conf`, not this phase).
> 2. Start the API. Attach a `socket.io` client (or temporarily log inside `EventsGateway.emitExpired`) to observe `cache:expired`.
> 3. `curl -X POST localhost:3001/ttl-events/seed -d '{"ttlSeconds":5}' -H 'content-type: application/json'`. Wait ~5s. Expect **exactly one** `cache:expired` for the returned `cache-example:`-prefixed key (Redis fires `__keyevent@0__:expired` once on expiry).
> 4. Negative case: write a foreign-namespace key via the library's raw client — e.g. a tiny throwaway call to `getClient().set('other-app:demo', 'x', 'EX', 5)` (or `redis-cli set other-app:demo x EX 5`). Wait ~5s. Expect **no** `cache:expired` emission (the `startsWith(getNamespacePrefix())` filter drops it).
> 5. Ensure the inline rationale note in `ttl-events.service.ts` is present and explicit: `PubSubService.subscribe` namespaces channels, so it would listen on `cache-example:__keyevent@0__:expired` — which Redis never publishes — hence the raw `createSubscriberClient()` escape hatch on the fixed, un-namespaced `__keyevent@<db>__:expired` channel. Expand the JSDoc from P9-1 if needed.
> 6. Run `pnpm --filter api typecheck` and `pnpm --filter api lint`.
>    Constraints:
>
> - English-only identifiers, comments, and docs.
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - Do NOT weaken the namespace filter to make the negative case pass; the filter is the demonstrated boundary.
> - Do NOT enable keyspace notifications at runtime from the app (`CONFIG SET`) to paper over a missing `redis.conf` — the config is a documented infra prerequisite (Phase 1).
> - If any check fails, fix it in the owning task file (P9-1..P9-3), then re-verify here.
>   Verification:
> - `docker compose exec redis redis-cli config get notify-keyspace-events` — expected: value contains `E` and `x`.
> - seed `{"ttlSeconds":5}` → expected: exactly one `cache:expired` for the namespaced key ~5s later.
> - foreign-ns expiry (`other-app:demo`) → expected: no `cache:expired` emission.
> - `pnpm --filter api typecheck` && `pnpm --filter api lint` — expected: both exit 0.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P9-4 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

When this task is 🟢, Phase 9 is 4/4 — switch the Phase 9 row in `DEVELOPMENT_PLAN.md` Progress Summary to 🟢 Done.

⚠️ Never mark done with failing verification.

---

## Completion log

_(Agents append one line per finished task, newest at the bottom.)_
