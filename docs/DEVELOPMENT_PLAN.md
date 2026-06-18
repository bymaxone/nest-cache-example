# nest-cache-example — Development Plan

> **Scope:** the master phased plan for building `nest-cache-example`, the reference application for [`@bymax-one/nest-cache`](https://github.com/bymaxone/nest-cache).
> **Source of truth:** the product spec is [`TECHNICAL_SPECIFICATION.md`](TECHNICAL_SPECIFICATION.md); the dashboard spec is [`DASHBOARD.md`](DASHBOARD.md). This file is the execution roadmap that decomposes them.
> **Targeted library version:** `@bymax-one/nest-cache@^0.1.0` (0.1.0, implemented; consumed via local `file:` link until published to npm).
> **Document version:** 1.0 — authored before implementation.
> **Status:** specification only.

This plan mirrors the proven 3-layer structure of the sibling `nest-logger-example` / `nest-auth-example` (`DEVELOPMENT_PLAN.md` → `tasks/README.md` → `tasks/phase-NN-*.md`). It **refines** the coarse 10-phase (phases 0–9) outline in [`TECHNICAL_SPECIFICATION.md` §25](TECHNICAL_SPECIFICATION.md#25--phased-delivery-plan) into 17 finer, independently-shippable phases, each mapped to the spec's [§7 Feature Coverage Matrix](TECHNICAL_SPECIFICATION.md#7--feature-coverage-matrix) rows so `/bymax-workflow:phase-tasks` can scaffold task files directly from a phase's deliverables.

> **One deliberate divergence from the siblings:** this is an **example app, not the library**, so it does **not** adopt the 100%-coverage + 100%-mutation gates. Those are the gates of `@bymax-one/nest-cache` itself. The example ships a focused **E2E smoke suite** (Testcontainers) + lint/typecheck/build + an **export-usage audit** — see [Appendix C](#appendix-c--quality-gates). This matches the spec's Non-Goal NG4.

---

## Table of Contents

- [Progress Summary](#progress-summary)
- [0. Guiding Principles](#0-guiding-principles)
- [1. Phase Map & Dependencies](#1-phase-map--dependencies)
- [2. Global Conventions](#2-global-conventions)
- [Phases 0–16](#phase-0--repository-foundation--tooling)
- [Appendix A — Environment Variable Registry](#appendix-a--environment-variable-registry)
- [Appendix B — Library Export → Example File Map](#appendix-b--library-export--example-file-map)
- [Appendix C — Quality Gates](#appendix-c--quality-gates)

---

## Progress Summary

> Every phase gets a task file under [`docs/tasks/`](tasks/) when `/bymax-workflow:phase-tasks` scaffolds it. When an agent completes a task it MUST update **both** the phase file **and** this table.
>
> **Status legend:** 🔴 Not Started · 🟡 In Progress · 🔵 In Review · 🟢 Done · ⚪ Blocked
>
> **All 17 phase files are scaffolded** under [`docs/tasks/`](tasks/) — the per-phase totals below are firm.
>
> **Overall progress: 100 / 107 tasks done (93%)**

| #   | Phase                                     | Tasks file                            | Size | Done / Total | %    | Status |
| --- | ----------------------------------------- | ------------------------------------- | ---- | ------------ | ---- | ------ |
| 0   | Repository Foundation & Tooling           | `phase-00-repo-foundation.md`         | M    | 8 / 8        | 100% | 🟢     |
| 1   | Local Redis Stack & Docker                | `phase-01-redis-stack.md`             | M    | 5 / 5        | 100% | 🟢     |
| 2   | Library Consumption & Workspace Bootstrap | `phase-02-library-consumption.md`     | S    | 3 / 3        | 100% | 🟢     |
| 3   | `apps/api` Skeleton + Cache Module Wiring | `phase-03-api-skeleton-wiring.md`     | L    | 9 / 9        | 100% | 🟢     |
| 4   | Domain & Core Data Structures             | `phase-04-domain-data-structures.md`  | L    | 9 / 9        | 100% | 🟢     |
| 5   | Cache Admin API (Explorer backend)        | `phase-05-cache-admin-api.md`         | M    | 6 / 6        | 100% | 🟢     |
| 6   | Namespace Isolation & Tenants             | `phase-06-namespace-tenants.md`       | M    | 5 / 5        | 100% | 🟢     |
| 7   | Serialization (default + custom)          | `phase-07-serialization.md`           | S    | 4 / 4        | 100% | 🟢     |
| 8   | Pub/Sub + WebSocket Bridge                | `phase-08-pubsub-websocket.md`        | M    | 6 / 6        | 100% | 🟢     |
| 9   | TTL Events (keyspace notifications)       | `phase-09-ttl-events.md`              | S    | 4 / 4        | 100% | 🟢     |
| 10  | Lua Scripts & Cache Stampede              | `phase-10-lua-stampede.md`            | M    | 5 / 5        | 100% | 🟢     |
| 11  | Connection Topologies & Error Surface     | `phase-11-topologies-errors.md`       | M    | 6 / 6        | 100% | 🟢     |
| 12  | `apps/web` Skeleton + Design System       | `phase-12-web-skeleton-design.md`     | L    | 7 / 7        | 100% | 🟢     |
| 13  | Dashboard — Observe pages                 | `phase-13-dashboard-observe.md`       | L    | 8 / 8        | 100% | 🟢     |
| 14  | Dashboard — Real-time & Labs pages        | `phase-14-dashboard-realtime-labs.md` | L    | 9 / 9        | 100% | 🟢     |
| 15  | Testing — E2E smoke + Web smoke           | `phase-15-testing.md`                 | M    | 6 / 6        | 100% | 🟢     |
| 16  | Docs, README & Export Audit               | `phase-16-docs-readme-audit.md`       | M    | 0 / 7        | 0%   | 🔴     |

### How to update this dashboard

1. Set the task's row in its phase file to 🟢 Done and tick its acceptance criteria.
2. Increment the phase file's header progress counter.
3. Update this table's **Done / Total** and **%** for that phase.
4. Recompute **Overall progress** as the sum across all phases.
5. When a phase hits 100%, flip its **Status** here to 🟢 Done.
6. Move the next phase to 🟡 In Progress only once **every** dependency phase is 🟢 Done (see [§1](#1-phase-map--dependencies)).
7. **Never** mark a task done with failing verification (no `--no-verify`, no skipped DoD).

---

## 0. Guiding Principles

1. **Library-faithful.** Every public export of `@bymax-one/nest-cache` (`.` + `/shared`) is demonstrated in `apps/`; an export-usage audit enforces it (Phase 16). If the README documents it, this repo proves it. Traceability runs through the spec's [§7 Feature Coverage Matrix](TECHNICAL_SPECIFICATION.md#7--feature-coverage-matrix) (each phase lists the rows it covers).
2. **Honest semantics.** No demo misrepresents the library. The plan explicitly builds the boundaries: one `namespace` per instance (tenants are prefixes — Phase 6), cluster-mode restrictions (Phase 11), namespaced Pub/Sub channels vs. raw keyspace channels (Phase 9), and clearly-labeled **app-level** metrics (Phase 4/13).
3. **Copy-paste friendly.** `cache/cache.config.ts`, the `events.onEvent` bridge, the `CacheExceptionFilter`, the custom serializer, and the keyspace subscriber are written generically so a real consumer lifts them directly.
4. **Make the invisible visible.** TTL countdown rings, a live expiry feed, Pub/Sub fan-out, and a single-flight stampede timeline exist because a README cannot show them (spec G2).
5. **Design parity.** `apps/web` reuses the shared Bymax design system **verbatim** (tokens, fonts, shell, glass-morphism) — see [`DASHBOARD.md` §19](DASHBOARD.md#19--frontend-tech-stack--design-system) and [`design_system.html`](design_system.html). Drop a screenshot beside a sibling and the chrome is indistinguishable.
6. **Minimal infra.** Redis only by default — **no database**. Optional Docker profiles add RedisInsight, a cluster, and a sentinel set (Phases 1, 11).
7. **No shortcuts.** No `@ts-ignore`, no `eslint-disable` to pass a gate, no `--no-verify`, no lowering a threshold. **No Swagger** — controllers are JSDoc-documented, DTOs are Zod (a deliberate convention, spec §23.4).
8. **Example-app quality bar, not library bar.** Lint + typecheck + a real **E2E smoke suite** (Testcontainers `redis:7-alpine`) + a web build/Playwright smoke + the export audit — **not** 100% coverage/mutation (those belong to the library; spec NG4, [Appendix C](#appendix-c--quality-gates)).
9. **One in-progress task per phase** at a time; never start a task until every dependency phase is 🟢 Done.
10. **English-only** identifiers, comments, and docs. **Conventional Commits**, enforced locally via husky + commitlint.

---

## 1. Phase Map & Dependencies

```
                              ┌──────────────────── BACKEND TRACK ────────────────────┐
0 ──┬─▶ 1 ─▶ 3 ─▶ 4 ─▶ 5 ─▶ 6                                                          │
    └─▶ 2 ─▶ 3                                                                         │
                   3 ─┬─▶ 7   (serialization)                                          │
                      ├─▶ 8 ─▶ 9   (pub/sub ─▶ ttl-events; both feed the gateway)      │
                      ├─▶ 10  (lua stampede)                                           │
                      └─▶ 11  (topologies + error surface)                             │
                              ┌──────────────── FRONTEND TRACK ───────────────┐
3 ─▶ 12 ─▶ 13 ─▶ 14           (12 skeleton needs 3; 13 needs 4 + 5; 14 needs 7–11)     │
                              ┌──────────── QUALITY & RELEASE TRACK ──────────┘
                              ▼
                              15 ─▶ 16
```

**Critical path:** `0 → 1 → 3 → 4 → 5 → 13 → 14 → 15 → 16` (the API foundation, the admin/data API the dashboard reads, then the UI, then verification + docs).

**Parallelization.**

- **Backend feature fan-out:** once Phase 3 (wiring + gateway + exception filter) lands, Phases **7, 8, 10, 11** are independent and can proceed in parallel; **9** follows **8** (it reuses the gateway pattern). **4 → 5 → 6** is a short sequential chain (domain → admin → tenants).
- **Frontend** can start its skeleton (Phase 12) right after Phase 3 against mocked endpoints, but its **Observe** pages (13) need the domain + admin APIs (4, 5) and its **Real-time/Labs** pages (14) need 7–11.
- **Quality track** (15–16) starts once the apps are feature-complete; but each feature phase's Definition of Done already requires its own happy-path proof, so Phase 15 is _consolidation_, not "write all tests at the end."

---

## 2. Global Conventions

| Concern             | Convention                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Package manager     | `pnpm@10.8.0` (exact pin in `packageManager` + every CI `pnpm/action-setup@v4`), workspaces `apps/*`                                                   |
| Runtime             | Node `>=24` (`.nvmrc` = `24`, `engines.node >=24`, setup-node `node-version: '24'`, `cache: pnpm`)                                                     |
| Install             | `pnpm install --frozen-lockfile` everywhere; `.npmrc` → `frozen-lockfile=true`                                                                         |
| Language            | TypeScript 5.9 strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`; ESM everywhere                                                      |
| Lint / format       | ESLint 9 flat config (`recommendedTypeChecked`, scoped to `*.ts`/`*.tsx`) + Prettier 3 (`printWidth 100`, `singleQuote`, `semi: false`)                |
| Pre-commit          | husky `prepare: husky`; `.husky/pre-commit` → `pnpm exec lint-staged`; `.husky/commit-msg` → `commitlint`                                              |
| Commits             | Conventional Commits (`commitlint.config.mjs` = `config-conventional`); `.gitmessage` with cache scopes                                                |
| Boolean naming      | prefix `is` / `has` / `should` / `can` (e.g. `isHealthy`, `hasTtl`, `shouldFlush`)                                                                     |
| **Cache key model** | `{namespace}{separator}{prefix}{separator}{id}`; this app's `namespace` = **`cache-example`**, separator `:`                                           |
| **API docs**        | **No Swagger.** Controllers documented with JSDoc (`@param`/`@returns`/`@throws` + route line); DTOs = Zod                                             |
| Datastore           | **Redis only** (no Postgres/Prisma); origin data is in-memory with artificial latency                                                                  |
| Real-time           | `@nestjs/platform-socket.io` gateway; one socket, 3 channels (`cache:connection`/`event`/`expired`)                                                    |
| Charts (web)        | Recharts v3 via shadcn primitives; `TtlRing` + `StampedeTimeline` are custom SVG                                                                       |
| Library dependency  | `@bymax-one/nest-cache` via local `file:../../../nest-cache` until published, then `^0.1.0`                                                            |
| Subpaths            | `.` (server) in `apps/api`; **`./shared`** (zero-dep) in **both** `apps/api` and `apps/web` (browser bundle)                                           |
| Dep automation      | `renovate.json` (weekend schedule; pin `@bymax-one/nest-cache`, group docker/actions)                                                                  |
| **Test bar**        | E2E smoke (Testcontainers `redis:7-alpine` + `ioredis-mock`) + web build/Playwright smoke + export audit — **not** 100% coverage/mutation (Appendix C) |

---

## Phase 0 — Repository Foundation & Tooling

**Goal:** a buildable `pnpm` monorepo with the full Bymax toolchain — installs, lints, typechecks, formats; husky + lint-staged + commitlint active.
**Prerequisites:** none.
**Deliverables:**

- [ ] `package.json` (root) — workspaces `apps/*`, `packageManager`, `engines`, scripts (`dev`, `build`, `typecheck`, `lint`, `format`/`format:check`, `test`, `test:e2e`, `infra:up`/`down`/`nuke`/`logs`, `audit:exports`).
- [ ] `pnpm-workspace.yaml` (`packages: ['apps/*']`), `.nvmrc` (`24`), `.npmrc` (`frozen-lockfile=true`).
- [ ] `tsconfig.base.json` (strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `verbatimModuleSyntax`).
- [ ] `eslint.config.mjs` (flat, `recommendedTypeChecked` scoped to `*.ts`/`*.tsx`, test relaxations, ignores incl. `dist`/`.next`/`coverage`).
- [ ] `.prettierrc.mjs` (`printWidth 100`, `singleQuote`, `trailingComma: all`, `semi: false`); `commitlint.config.mjs`; `lint-staged.config.mjs`; `.husky/{pre-commit,commit-msg}`.
- [ ] `renovate.json`; `.editorconfig`; `.gitignore`; `.gitmessage`.
- [ ] `LICENSE` (MIT, © Bymax One); `README.md` stub (links to the three docs); `CHANGELOG.md`; `CLAUDE.md` + `AGENTS.md` stubs.

**Demonstrates:** tooling (no matrix rows). **References:** spec §23 (Tooling & Conventions), §6 (Repository Layout).
**Definition of done:** `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm format:check` all pass on a clean checkout; a Conventional-Commit message is required by the `commit-msg` hook.
**Size:** M

---

## Phase 1 — Local Redis Stack & Docker

**Goal:** `docker compose up -d --wait` brings up Redis (with keyspace notifications) so the API and the TTL demo work end to end.
**Prerequisites:** Phase 0.
**Deliverables:**

- [ ] `docker-compose.yml` — `redis:7-alpine` (default service), `127.0.0.1`-bound `6379`, named volume, healthcheck, mounts `docker/redis/redis.conf`.
- [ ] `docker/redis/redis.conf` — `notify-keyspace-events Ex` (TTL-expiry demo), dev no-persistence (`save ""`, `appendonly no`), commented.
- [ ] Optional profiles wired (config only here; exercised in Phase 11): `tools` → `redis/redisinsight` on `5540`; `cluster` (`docker/cluster/`); `sentinel` (`docker/sentinel/`).
- [ ] `.env.example` (api) covering every variable in [Appendix A](#appendix-a--environment-variable-registry); `.env.example` (web) with `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_WS_URL`.
- [ ] Root scripts `infra:up`/`down`/`nuke`/`logs` verified against the compose file.

**Demonstrates:** infra prerequisite for matrix rows 8, 12, 19 (TTL/keyspace). **References:** spec §21 (Local Stack & Docker), §9 (env).
**Definition of done:** `pnpm infra:up` reports Redis healthy; `redis-cli config get notify-keyspace-events` returns a value containing `E` and `x`; `--profile tools` serves RedisInsight at `:5540`.
**Size:** M

---

## Phase 2 — Library Consumption & Workspace Bootstrap

**Goal:** the example consumes `@bymax-one/nest-cache` and both subpaths type-resolve in both apps.
**Prerequisites:** Phase 0.
**Deliverables:**

- [ ] `apps/api/package.json` + `apps/web/package.json` declare `@bymax-one/nest-cache` (local `file:../../../nest-cache` until published, then `^0.1.0`).
- [ ] A typed **subpath probe**: `apps/api` imports from `.` (`BymaxCacheModule`, `CacheService`) and `./shared` (`CACHE_ERROR_CODES`, `CacheErrorCode`); `apps/web` imports from `./shared` only (proving the zero-dep browser path — matrix #48).
- [ ] Peer deps installed in `apps/api`: `ioredis`, `@nestjs/common`, `@nestjs/core`, `reflect-metadata`.

**Demonstrates:** matrix #48 (dual subpath), #49 (re-exported ioredis types resolve). **References:** spec §8 (Library Consumption).
**Definition of done:** `pnpm typecheck` resolves both subpaths in both apps; the probe compiles; the web probe pulls in **no** NestJS/ioredis transitive types.
**Size:** S

---

## Phase 3 — `apps/api` Skeleton + Cache Module Wiring

**Goal:** a booting NestJS 11 service with `BymaxCacheModule.forRootAsync` wired from env, the events→logger/gateway bridge, the global exception filter, and a health route.
**Prerequisites:** Phase 1 (Redis up), Phase 2 (library).
**Deliverables:**

- [ ] `apps/api` Nest app (Express), `nest-cli.json`, tsconfigs (`emitDecoratorMetadata` on), `main.ts` (CORS to `WEB_ORIGIN`, `IoAdapter` — socket.io default, never `WsAdapter` — `enableShutdownHooks`, documented shutdown ordering).
- [ ] `src/config/env.schema.ts` — Zod schema + `validateEnv()` + `Env` type; `@nestjs/config` `forRoot({ isGlobal, validate })`.
- [ ] `src/cache/cache.config.ts` — `buildCacheOptions(config, events)` factory (connection, namespace, keySeparator, serializer selection, `scripts`, `shutdownTimeoutMs`, `allowFlushInProduction`).
- [ ] `src/cache/cache.events.ts` — `CacheEventsBridge` implementing `ICacheEvents.onEvent` → Nest `Logger` + `EventsGateway`.
- [ ] `src/cache/cache.module.ts` + `app.module.ts` — `BymaxCacheModule.forRootAsync({ isGlobal: true, imports, inject, useFactory })` (note: `isGlobal` decided synchronously).
- [ ] `src/common/cache-exception.filter.ts` (`@Catch(CacheException)` → `{ error: { code, message, details } }`) + `src/common/zod-validation.pipe.ts` + `src/common/cache-keys.ts` (typed `CacheKeyPrefix` constants).
- [ ] `src/events/events.gateway.ts` — socket.io gateway skeleton (`emitConnectionEvent`/`emitMessage`/`emitExpired`).
- [ ] `src/health/health.controller.ts` — `GET /health` (`isHealthy` + `ping` latency), `GET /metrics` placeholder.

**Demonstrates:** matrix #1, #3, #4, #7, #10 (forRootAsync, options, standalone conn, OPTIONS/EVENTS tokens), #29 (health), #41–#47 partial (exception filter, events/status). **References:** spec §9, §10, §20.1.
**Definition of done:** `pnpm --filter api dev` boots against Docker Redis; `GET /health` returns 200 with `{ status, latencyMs }`; the lifecycle `ready` event is logged and broadcast on `cache:connection`.
**Size:** L

---

## Phase 4 — Domain & Core Data Structures

**Goal:** the in-memory product domain exercises every `CacheService` data-structure method, with app-level hit/miss metrics.
**Prerequisites:** Phase 3.
**Deliverables:**

- [ ] `src/catalog/` — read-through product cache: `GET /catalog/products/:id` (`get`→miss→`set(ttl)`), `GET /catalog/products?ids=` (`mget`/`mset`), `POST /catalog/products/:id/seed` (`setNx`), `exists`; an in-memory `ProductOriginStore` with artificial latency.
- [ ] `src/counters/` — `incr`/`decr` (view counter, stock decrement) with `GET`/`POST` routes.
- [ ] `src/collections/` — carts as hashes (`hset`/`hget`/`hgetall`/`hdel`) + tags as sets (`sadd`/`srem`/`smembers`/`sismember`/`scard`).
- [ ] `src/metrics/metrics.service.ts` — in-process per-prefix hit/miss counters + a `CacheMetricsInterceptor` (or service calls); `GET /metrics` returns counters + sampled `instantaneous_ops_per_sec`.
- [ ] TTL ops surfaced on catalog keys: `expire` / `ttl` / `persist` (reused by the Explorer + TTL pages).

**Demonstrates:** matrix #13–#22 (strings/numerics/hashes/sets/batch), #17 (`exists`), #19 (TTL ops), #40 (`CacheKeyPrefix`). **References:** spec §10.2, §11 (endpoint catalogue), §12.2.
**Definition of done:** each endpoint returns correct typed shapes; a second `GET` of the same product is a hit (faster, counter increments); set members are stored raw (documented).
**Size:** L

---

## Phase 5 — Cache Admin API (Explorer backend)

**Goal:** the admin surface that powers the Key Explorer + Overview breakdowns.
**Prerequisites:** Phase 3 (CacheService); pairs with Phase 4's seeded keys.
**Deliverables:**

- [x] `src/admin/admin.controller.ts` — `GET /admin/keys` (cursor-paged `scan` with `strategy=scan|keys`, `prefix`/`pattern`/`tenant`), `GET /admin/keys/:key` (`getRaw` + `ttl` + `MEMORY USAGE`), `DELETE /admin/keys/:key` (`del`), `POST /admin/keys/:key/persist`|`/expire`.
- [x] `POST /admin/seed?count=N` — bulk seed via `pipeline()` (keys composed through `KeyBuilder`).
- [x] `DELETE /admin/namespace` — `flushNamespace()` (guarded; surfaces the production guard).
- [x] `GET /admin/info?section=` — `info(section?)` parsed to key/value (`src/admin/info.parser.ts`).
- [x] `GET /admin/keyspace` — keys-by-type, memory-by-prefix, expiry-analysis (sampled, bounded dimensions).
- [x] `src/admin/dto/key-query.dto.ts` (Zod) — the shared `KeyQuery` filter.

**Demonstrates:** matrix #16 (`del`), #23 (`scan`), #24 (`keys` + warning), #25 (`pipeline`), #27 (`flushNamespace`), #29 (`info`), #36 (`KeyBuilder`). **References:** spec §11.1, §16 (DASHBOARD §6, §17).
**Definition of done:** `scan` pages non-blocking; `keys` carries the O(N) warning; `flushNamespace` clears only `cache-example:*`; `/admin/info` and `/admin/keyspace` return the shapes DASHBOARD §15 charts expect.
**Size:** M

---

## Phase 6 — Namespace Isolation & Tenants

**Goal:** prove app-level namespace isolation and in-namespace per-tenant prefix scoping — honestly.
**Prerequisites:** Phase 4.
**Deliverables:**

- [ ] `src/tenants/` — tenant-scoped reads/writes under prefix `tenant:{id}:…` via `KeyBuilder`; `GET /tenants/:t/products/:id`.
- [ ] `DELETE /tenants/:t/cache` — clear one tenant via `scan('tenant:{id}', '*')` → `delMany` (leaves other tenants intact).
- [ ] `POST /tenants/seed-foreign` — seed a key under a **foreign** namespace (`other-app:*`) via `getClient()` (raw, un-namespaced — labeled the documented anti-pattern).
- [ ] Isolation proof endpoint/flow: `flushNamespace()` clears `cache-example:*` while the foreign key survives.
- [ ] An inline design note in code/JSDoc restating "namespace is per-instance; tenants are prefixes" (spec §12.4).

**Demonstrates:** matrix #16 (`delMany`), #26 (`getClient`), #27 (`flushNamespace` proof), #36 (`KeyBuilder`). **References:** spec §12.3–§12.4, DASHBOARD §8.
**Definition of done:** clearing tenant A leaves tenant B's keys; flushing the namespace removes `cache-example:*` and the seeded `other-app:*` key survives.
**Size:** M

---

## Phase 7 — Serialization (default + custom)

**Goal:** demonstrate the default `JsonSerializer`, a custom `ISerializer`, and the `SerializableValue` caveats.
**Prerequisites:** Phase 3.
**Deliverables:**

- [ ] `src/cache/msgpack.serializer.ts` — `MsgPackSerializer implements ISerializer` (base64-wrapped MessagePack).
- [ ] `cache.config.ts` selects the serializer from `CACHE_SERIALIZER` env (`json` default | `msgpack`).
- [ ] `src/serializer-demo/` — `POST /serializer/roundtrip?codec=json|msgpack` returning raw stored bytes (`getRaw`) vs decoded value (`get`); inspect the injected serializer via `BYMAX_CACHE_SERIALIZER`.
- [ ] A documented `SerializableValue` caveat payload (a `Date` that survives lossy under JSON, intact under msgpack).

**Demonstrates:** matrix #11 (`BYMAX_CACHE_SERIALIZER`), #14 (`getRaw`/`setRaw`), #37–#39 (`JsonSerializer`, custom `ISerializer`, `SerializableValue`). **References:** spec §16, DASHBOARD §12.
**Definition of done:** the endpoint returns both codecs' raw + decoded forms; the JSON `Date` round-trip is visibly lossy; msgpack output is smaller.
**Size:** S

---

## Phase 8 — Pub/Sub + WebSocket Bridge

**Goal:** publish from the browser and fan out to every connected tab via `PubSubService` + the socket.io gateway.
**Prerequisites:** Phase 3 (gateway).
**Deliverables:**

- [x] `src/pubsub/` — `POST /pubsub/publish` (`PubSubService.publish`, returns subscriber count); subscription management (`subscribe` exact channel + `psubscribe` pattern, e.g. `product:*`).
- [x] `EventsGateway` subscribes server-side via `PubSubService` and re-emits `cache:event` to all clients.
- [x] Ref-counted `Unsubscribe` lifecycle exercised (subscribe×2 + unsubscribe×1 keeps delivery; double-unsubscribe safe).
- [x] Handler error isolation verified (a throwing handler is swallowed + surfaced via `events.onEvent` `reason: 'handler_error'`).

**Demonstrates:** matrix #30 (`publish`/`subscribe`), #31 (`psubscribe`/`IPubSubPatternHandler`), #32 (`Unsubscribe`), #33 (`IPubSubHandler`). **References:** spec §17.1–§17.2, DASHBOARD §9.
**Definition of done:** publishing on the API arrives as `cache:event` in two open browser tabs; a pattern subscription receives matching-channel messages; channels are namespaced (`cache-example:…`).
**Size:** M

---

## Phase 9 — TTL Events (keyspace notifications)

**Goal:** stream real key-expiry events to the browser using the raw subscriber — the escape-hatch demo.
**Prerequisites:** Phase 8 (gateway + feed pattern), Phase 1 (`notify-keyspace-events`).
**Deliverables:**

- [x] `src/ttl-events/ttl-events.service.ts` — inject `BYMAX_CACHE_CONNECTION` (`ConnectionManager`) + `BYMAX_CACHE_KEY_BUILDER` (`KeyBuilder`); `createSubscriberClient()`; subscribe to `__keyevent@{db}__:expired`; filter by `getNamespacePrefix()`; emit `cache:expired`.
- [x] `onModuleDestroy` quits the dedicated subscriber.
- [x] A seed endpoint to create short-TTL keys for the demo (reuses catalog `set(ttl)`).
- [x] Inline note explaining why `PubSubService` cannot be used here (namespaced channels vs. fixed keyspace channels).

**Demonstrates:** matrix #8 (`BYMAX_CACHE_CONNECTION` → `createSubscriberClient`), #12 (`KEY_BUILDER`/`getNamespacePrefix`), reuses #19 (TTL). **References:** spec §17.3, DASHBOARD §10.
**Definition of done:** seeding a 5s-TTL key emits exactly one `cache:expired` for the namespaced key ~5s later; foreign-namespace expiries are filtered out.
**Size:** S

---

## Phase 10 — Lua Scripts & Cache Stampede

**Goal:** collapse N concurrent misses into one origin fetch with a single-flight Lua lock.
**Prerequisites:** Phase 3 (`scripts` registered in `cache.config.ts`).
**Deliverables:**

- [ ] `src/cache/scripts/index.ts` — `CACHE_SCRIPTS: IScriptDefinition[]` (e.g. `acquireLock` = `SET NX PX`).
- [ ] `src/stampede/` — `POST /stampede?productId=&concurrency=&lockMs=`; each request calls `CacheService.eval('acquireLock', …)`; winner fetches origin + populates, losers wait then read the hit.
- [ ] Returns a timeline log (lock won / waited / hit) for the UI; exposes the resolved SHA via `ScriptManagerService.load`.
- [ ] Inline note: keys auto-namespaced by `eval`; Lua body declared in code, never from request input.

**Demonstrates:** matrix #9 (`BYMAX_CACHE_SCRIPT_REGISTRY`/`ScriptManagerService`), #28 (`CacheService.eval`), #34 (`register`/`load`/`eval`), #35 (`IScriptDefinition`). **References:** spec §18, DASHBOARD §11.
**Definition of done:** firing 10 concurrent requests yields exactly 1 origin fetch + 9 hits; the timeline endpoint returns lock winner + waiters; `load` returns a stable SHA1.
**Size:** M

---

## Phase 11 — Connection Topologies & Error Surface

**Goal:** document/run all three connection modes and trigger every `CacheException` on demand.
**Prerequisites:** Phase 3 (wiring + exception filter).
**Deliverables:**

- [x] `cache.config.ts` builds `sentinel` and `cluster` connection blocks from env (`buildSentinelBlock`/`buildClusterBlock`); `docker/cluster/` + `docker/sentinel/` compose profiles made runnable.
- [x] `src/errors-demo/` — `POST /errors/:code` triggering each of the 15 `CACHE_ERROR_CODES` (invalid key, deserialization, script-not-registered, flush-in-prod, unsupported-in-cluster, command-timeout, …).
- [x] Cluster-restriction demo: `scan`/`flushNamespace`/`getClient` throw `UNSUPPORTED_IN_CLUSTER` when `CACHE_MODE=cluster`; the API surfaces it cleanly via the filter.
- [x] api imports `CacheErrorCode` from `@bymax-one/nest-cache/shared` for typed handling; `apps/web` reuses the same import in the dashboard phase.

**Demonstrates:** matrix #5, #6 (sentinel/cluster connection types), #41–#43 (`CacheException`, `CACHE_ERROR_CODES`, `CACHE_ERROR_MESSAGES`), #44 (`CacheErrorCode`), #49 (re-exported ioredis types). **References:** spec §15, §19, DASHBOARD §13–§14.
**Definition of done:** each `/errors/:code` returns the correct HTTP status + structured body; with the cluster profile up, the documented methods fail with `UNSUPPORTED_IN_CLUSTER`; the prod-guard demo returns `403`.
**Size:** M

---

## Phase 12 — `apps/web` Skeleton + Design System

**Goal:** a Next.js 16 app **visually identical** to every Bymax example app, wired to the API + socket.
**Prerequisites:** Phase 3 (API exists; can mock until 4/5 land).
**UI base:** build to [`design_system.html`](design_system.html) and [`DASHBOARD.md` §19](DASHBOARD.md#19--frontend-tech-stack--design-system).
**Deliverables:**

- [x] `apps/web` Next.js 16 + React 19 + Tailwind v4 + shadcn `new-york`; copy `app/globals.css`, `tailwind.config.ts`, `components.json`, `postcss.config.mjs` **verbatim** from a sibling `apps/web`.
- [x] `app/layout.tsx` — Geist Sans/Mono, **forced `dark`** on `<html>`, `<Providers>` (TanStack Query + `<NuqsAdapter>` + Sonner `Toaster`).
- [x] `components/layout/` — Topbar (64px) + grouped Sidebar (250px, orange active state, Observe/Real-time/Labs/System) + `AppShell`; brand wordmark `nest-cache-example`.
- [x] `lib/api-client.ts` (typed fetch, error union keyed by `CacheErrorCode` from `./shared`), `lib/socket.ts` (socket.io-client, 3 channels), `lib/cache-status.ts` (status→color/icon/label), `lib/utils.ts` (`cn`).
- [x] Global controls (`components/controls/`): NamespaceChip, TenantSwitcher, StatusChip, LiveToggle, TimeRange — Explorer filters + time range in URL via `nuqs`.
- [x] shadcn component set scaffolded (button/card/badge/input/select/table/tabs/tooltip/dialog/dropdown-menu/popover/scroll-area/skeleton/sonner/command).

**Demonstrates:** matrix #44 (`CacheErrorCode` in api-client), #46 (`CacheConnectionStatus` badge), #48 (`./shared` in the browser bundle). **References:** spec §13–§14, DASHBOARD §19–§20.
**Definition of done:** the shell renders the orange/glass dark theme + brand mark + cache nav; the status chip turns green when the API is up; `pnpm --filter web build` succeeds; the shared-subpath import resolves with no NestJS/ioredis in the client bundle.
**Size:** L

---

## Phase 13 — Dashboard: Observe pages

**Goal:** the daily-driver pages — Overview, Explorer, Playground, Tenants.
**Prerequisites:** Phase 4, Phase 5, Phase 12.
**Deliverables:**

- [ ] `app/page.tsx` (Overview) — health strip (hit-rate gauge, ops/sec, latency p95, memory bullet, keys, expired), hit/miss area (brushable), throughput/latency row, keyspace breakdown (type donut, memory-by-prefix, expiry analysis), connection/pipeline health. Recharts, fed by `/metrics` + `/admin/info` + `/admin/keyspace`.
- [ ] `app/explorer/page.tsx` — filter rail, scan/keys strategy toggle, virtualized `KeyTable` (TanStack Table + Virtual), `KeyDetailDrawer` (Value/Raw/TTL/Metadata tabs, `@uiw/react-json-view`), TTL ring column, delete/persist/extend actions, guarded "Flush namespace".
- [ ] `app/playground/page.tsx` — one card per data structure (strings/numerics/hashes/sets/batch) firing the catalog/counters/collections endpoints, with "View in Explorer →".
- [ ] `app/tenants/page.tsx` — `TenantSplit` + the isolation-proof flow (seed foreign / flush namespace).
- [ ] `components/charts/` (HitRateGauge, HitMissArea, OpsStream, LatencyLines, TypeDonut, MemoryByPrefix, ExpiryAnalysis, MetricTile); `components/explorer/`; `components/playground/`; `components/tenants/`.

**Demonstrates:** UI for matrix #13–#27, #29, #36 + the breakdown panels. **References:** DASHBOARD §5–§8, §15.
**Definition of done:** Overview renders live golden signals; an Explorer scan lists namespaced keys with draining TTL rings; a Playground op appears in the Explorer; clearing tenant A leaves B intact on screen.
**Size:** L

---

## Phase 14 — Dashboard: Real-time & Labs pages

**Goal:** the real-time + advanced-feature pages — Pub/Sub, TTL Live, Stampede, Serializer, Errors, Connection.
**Prerequisites:** Phases 7, 8, 9, 10, 11, Phase 12.
**Deliverables:**

- [x] `app/pubsub/page.tsx` — publish form, subscription manager (subscribe/psubscribe + ref-count), `EventFeed` (ring-buffered, follow-mode) on `cache:event`.
- [x] `app/ttl/page.tsx` — `CountdownWall` of `TtlRing`s + an expiry `EventFeed` on `cache:expired`; fade + toast on expiry.
- [x] `app/stampede/page.tsx` — controls + `StampedeTimeline` (custom SVG swimlane) + result strip (origin fetches vs hits) + script SHA.
- [x] `app/serializer/page.tsx` — side-by-side JSON vs msgpack (raw bytes vs decoded) + `SerializableValue` caveat banner.
- [x] `app/errors/page.tsx` — trigger list of all 15 codes + response panel (status/body/canonical message), typed via `./shared`; prod-guard toggle.
- [x] `app/connection/page.tsx` — `CacheConnectionStatus` badge, lifecycle `EventFeed` on `cache:connection`, mode selector, `INFO` section viewer.
- [x] `components/realtime/` (EventFeed, TtlRing, CountdownWall), `components/labs/` (StampedeTimeline, SerializerCompare, ErrorTrigger), `hooks/use-cache-socket.ts`, `hooks/use-follow-mode.ts`.

**Demonstrates:** UI for matrix #30–#35 (pub/sub, stampede), #37–#39 (serializer), #41–#47 (errors, events, status), #8/#12 (TTL). **References:** DASHBOARD §9–§14, §18.
**Definition of done:** a published message appears across tabs; a seeded short-TTL key visibly expires (ring drains → card fades → toast); the stampede timeline shows 1 fetch + N−1 hits; each error code renders its status + body; the connection feed shows lifecycle events.
**Size:** L

---

## Phase 15 — Testing — E2E smoke + Web smoke

**Goal:** a focused, high-signal verification suite (the example-app bar — not 100% coverage/mutation).
**Prerequisites:** Phases 4–14 (each shipped with its own happy-path proof).
**Deliverables:**

- [x] `apps/api/test/*.e2e-spec.ts` — Testcontainers `redis:7-alpine`: read-through + TTL, namespace isolation + `flushNamespace`, Pub/Sub fan-out, the Lua single-flight, and each `CacheException` path; `BymaxCacheModule.forRoot` sync path covered (matrix #2).
- [x] Fast specs with `ioredis-mock` where a real server isn't needed (data-structure round-trips, serializer comparison).
- [x] `apps/web` Vitest unit — `lib/cache-status.ts` mapping + the **shared-subpath import resolves in a browser context** (matrix #48); Playwright smoke (shell loads, status badge green, explorer scan renders, publish round-trips).
- [x] CI wiring stub: `lint` + `typecheck` + `test:e2e` + `web build` jobs (full CI is Phase 16/out-of-scope polish).

**Demonstrates:** matrix #2 (sync `forRoot`); cross-cutting verification of all rows. **References:** spec §22, DASHBOARD §18.
**Definition of done:** `pnpm test:e2e` passes against a real Redis container; the web smoke passes; `pnpm --filter web build` is green.
**Size:** M

---

## Phase 16 — Docs, README & Export Audit

**Goal:** polished public-facing docs + a CI-enforceable proof that every library export is demonstrated.
**Prerequisites:** features stable (Phases 3–14).
**Deliverables:**

- [ ] `scripts/audit-library-exports.mjs` + `.audit-ignore.json` — parse `node_modules/@bymax-one/nest-cache/dist/{server,shared}/index.d.ts`, word-boundary-search the `apps/` corpus, fail on any undocumented export; wired as `audit:exports` + a CI job.
- [ ] Root `README.md` — centered header, shields.io badges, "What's inside" checklist, Quick Start (docker + pnpm dev), endpoints table, the [§7 Feature Coverage Matrix](TECHNICAL_SPECIFICATION.md#7--feature-coverage-matrix) summary, ASCII architecture, in the sibling house style.
- [ ] Documented **curl journeys** (miss→hit, stampede collapse, cross-namespace isolation) in `README`/docs.
- [ ] Keep `TECHNICAL_SPECIFICATION.md`, `DASHBOARD.md`, and this plan current; flip `OVERVIEW.md` to clearly "superseded".
- [ ] Optional `@bymax-one/nest-logger` events bridge documented as the production pattern (matrix #50).
- [ ] `CHANGELOG.md` `0.1.0` entry; verify the design-system acceptance (screenshot indistinguishable from a sibling).

**Demonstrates:** matrix #50 (logger bridge) + audit covering **all** rows. **References:** spec §7, §27, §28.
**Definition of done:** `pnpm audit:exports` exits 0 (every export demonstrated or ignored-with-reason); `README` renders with working links; the coverage matrix is fully ✅.
**Size:** M

---

## Appendix A — Environment Variable Registry

See [`TECHNICAL_SPECIFICATION.md` §9](TECHNICAL_SPECIFICATION.md#9--configuration--environment) for the canonical table. API: `NODE_ENV`, `PORT` (3001), `WEB_ORIGIN`, `REDIS_URL`, `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD`/`REDIS_DB`, `CACHE_MODE`, `CACHE_NAMESPACE` (`cache-example`), `CACHE_KEY_SEPARATOR`, `CACHE_DEFAULT_TTL`, `CACHE_SERIALIZER`, `ALLOW_FLUSH_IN_PRODUCTION` (`false`), `SHUTDOWN_TIMEOUT_MS`. Web: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`. Each is `zod`-validated in `apps/api/src/config/env.schema.ts`.

## Appendix B — Library Export → Example File Map

Maintained by `scripts/audit-library-exports.mjs` (Phase 16) and surfaced as the spec's [§7 Feature Coverage Matrix](TECHNICAL_SPECIFICATION.md#7--feature-coverage-matrix). The audit parses `node_modules/@bymax-one/nest-cache/dist/{server,shared}/index.d.ts`, extracts every exported symbol, and word-boundary-searches the `apps/` corpus; a missing symbol fails CI unless listed in `.audit-ignore.json` with a reason. The 50 matrix rows are the contract; each phase above lists the rows it lands.

## Appendix C — Quality Gates

The example-app bar — **lighter than the library's on purpose** (the 100% coverage + 100% mutation gates belong to `@bymax-one/nest-cache`; see [`Bymax-Lib-Standards`] and the library's own `docs/`). Replicating those here would add noise without protecting a published API.

| Gate           | Tool / config                                                | Threshold                         | Enforced in             |
| -------------- | ------------------------------------------------------------ | --------------------------------- | ----------------------- |
| Lint           | ESLint 9 flat (`eslint .`)                                   | zero errors                       | CI `lint` (Phase 15/16) |
| Typecheck      | `tsc --noEmit` per package                                   | zero errors                       | CI `typecheck`          |
| API E2E        | Jest + `@nestjs/testing` + Testcontainers (`redis:7-alpine`) | headline flows pass               | CI `e2e` (Phase 15)     |
| API fast specs | `ioredis-mock`                                               | data-structure round-trips pass   | CI `e2e`                |
| Web build      | `next build`                                                 | succeeds                          | CI `web-build`          |
| Web smoke      | Playwright + Vitest (`lib/**`)                               | happy-path passes                 | CI `web-smoke`          |
| Export usage   | `scripts/audit-library-exports.mjs` + `.audit-ignore.json`   | every export demonstrated         | CI `export-usage-check` |
| Pre-commit     | husky + lint-staged                                          | prettier + eslint --fix on staged | local                   |
| Commit message | commitlint (`config-conventional`)                           | Conventional Commits              | local `commit-msg`      |

> **Why no coverage/mutation wall (audit note).** Per spec NG4 and the Bymax lib standard, an **example app** demonstrates and integration-tests a library; it does not re-prove the library's internal correctness. The **E2E smoke suite against a real Redis** is the right bar — it validates the _published_ package end to end (and doubles as integration coverage for the library). If a future maintainer wants a coverage signal, add a non-blocking `test:cov` report, but **do not** gate the example on 100% — that bar is reserved for `@bymax-one/nest-cache`.
>
> **Toolchain caveats.** ① Run `pnpm/action-setup@v4` **before** `actions/setup-node@v5` when using `cache: pnpm`. ② Testcontainers needs a Docker daemon in CI (use the service or a runner with Docker). ③ Keyspace-notification E2E (Phase 9) requires the test Redis to start with `--notify-keyspace-events Ex`. ④ Pin a Vitest major rather than `latest`.
