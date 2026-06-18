# nest-cache-example — Technical Specification

> The canonical reference application for **`@bymax-one/nest-cache`** — a typed Redis cache for
> NestJS built on ioredis 5 (namespace strategy, Pub/Sub, Lua script manager). A NestJS API + a
> Next.js dashboard that exercises **every** public feature of the library in a runnable, realistic
> scenario, and makes the invisible parts — namespace isolation, TTL expiry, Pub/Sub fan-out, atomic
> Lua, connection lifecycle — tangible on screen.
>
> Maintained by **Bymax One** · MIT · Part of the `@bymax-one/*` reference-app family
> (`nest-auth-example`, `nest-logger-example`, …).

---

> 📄 **About this document.** This is the authoritative, forward-looking technical blueprint for
> `nest-cache-example`, authored **before implementation**. It is the source the phased
> `DEVELOPMENT_PLAN.md` and the per-phase `docs/tasks/phase-NN-*.md` files derive from. It describes
> the intended end-state (a richer product than any single early commit) so that planning, task
> scaffolding, and review all share one contract. Where it prescribes an API surface, that surface
> was verified against the library's shipped type declarations (`dist/server/index.d.ts`,
> `dist/shared/index.d.ts`) at `@bymax-one/nest-cache@0.1.0`.

> ⚠️ **Library status.** `@bymax-one/nest-cache` is **pre-1.0 (`0.1.0`)**. Its public API is stable
> for the surface used here but may evolve before 1.0. This example pins the library locally (see
> §8) until it is published to npm, then tracks `^0.1.0`. Any API drift is reconciled in this
> document, not papered over.

> 🔧 **Reconciliation with the earlier `docs/OVERVIEW.md` draft.** An initial `OVERVIEW.md` sketch
> predated the library's published types and used a few names/shapes that do not match the shipped
> API. This specification supersedes it and corrects the following — the corrections are themselves
> instructive and are demonstrated explicitly in the app:
>
> | Draft `OVERVIEW.md` said                                   | Shipped library reality (this spec)                                                                                                                                                                                                        |
> | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
> | `CacheModule.forRootAsync`                                 | **`BymaxCacheModule.forRoot` / `forRootAsync`**                                                                                                                                                                                            |
> | `CacheService.subscribe` / `.publish`                      | Pub/Sub is a separate **`PubSubService`** (`publish` / `subscribe` / `psubscribe`)                                                                                                                                                         |
> | A `HealthService`                                          | Health is **`CacheService.isHealthy()` / `ping()` / `info()`** (no separate service)                                                                                                                                                       |
> | "Each tenant's cache lives under its own **namespace**"    | The library has **one `namespace` per module instance**. Tenants are modeled as **key prefixes** within that namespace; `flushNamespace()` clears the **whole** namespace. See §12.4 for the honest design.                                |
> | TTL expiry via `CacheService.subscribe` to keyspace events | `PubSubService` **namespaces** channels, so it cannot receive Redis' fixed `__keyevent@*__` channels. The TTL demo uses the **raw subscriber** via the `BYMAX_CACHE_CONNECTION` token — an intentional escape-hatch demonstration (§17.3). |
> | RedisInsight on port `8001`                                | Current RedisInsight image (`redis/redisinsight`) serves on **`5540`**; `8001` is the legacy redis-stack bundle.                                                                                                                           |
> | "Swagger UI enabled at `/api`"                             | **No Swagger.** Matching the sibling examples, controllers are documented with **JSDoc** and validated with **Zod**; the dashboard + a documented HTTP collection are the interactive surface (§23.4).                                     |

---

## Table of Contents

1. [Purpose & Audience](#1--purpose--audience)
2. [Goals & Non-Goals](#2--goals--non-goals)
3. [Architecture at a Glance](#3--architecture-at-a-glance)
4. [The Library Under Test — `@bymax-one/nest-cache`](#4--the-library-under-test--bymax-onenest-cache)
5. [Tech Stack](#5--tech-stack)
6. [Repository Layout](#6--repository-layout)
7. [Feature Coverage Matrix](#7--feature-coverage-matrix)
8. [Library Consumption](#8--library-consumption)
9. [Configuration & Environment](#9--configuration--environment)
10. [Backend Design — `apps/api`](#10--backend-design--appsapi)
11. [Demo Domain & REST API](#11--demo-domain--rest-api)
12. [Demonstration Scenarios](#12--demonstration-scenarios)
13. [Frontend Design — `apps/web`](#13--frontend-design--appsweb)
14. [Design System](#14--design-system)
15. [Connection Topologies](#15--connection-topologies)
16. [Serialization](#16--serialization)
17. [Pub/Sub & Real-Time](#17--pubsub--real-time)
18. [Lua Scripts & Cache Stampede](#18--lua-scripts--cache-stampede)
19. [Error Handling](#19--error-handling)
20. [Observability & Health](#20--observability--health)
21. [Local Stack & Docker](#21--local-stack--docker)
22. [Testing Strategy](#22--testing-strategy)
23. [Tooling & Conventions](#23--tooling--conventions)
24. [Security & Safety](#24--security--safety)
25. [Phased Delivery Plan](#25--phased-delivery-plan)
26. [What This Project Intentionally Excludes](#26--what-this-project-intentionally-excludes)
27. [References](#27--references)
28. [Document Status](#28--document-status)

---

## 1 · Purpose & Audience

`nest-cache-example` exists to do three things, in order of importance:

1. **Demonstrate every public feature** of `@bymax-one/nest-cache` in one runnable, realistic
   application — not isolated snippets, but a coherent domain where each cache capability earns its
   place.
2. **Make the invisible visible.** Namespace isolation, TTL expiry, Pub/Sub fan-out, atomic Lua
   locks, and connection lifecycle are hard to appreciate from a README. A live dashboard renders
   them in real time so a reader _sees_ a key expire, _sees_ an event fan out across browser tabs,
   _sees_ a stampede collapse into a single origin fetch.
3. **Serve as the canonical integration reference** for any Bymax project (or external consumer)
   adopting the library — the copy-paste-grade wiring of `forRootAsync`, the events→logger bridge,
   the exception filter, the custom serializer, and the dual-subpath shared-types pattern.

It doubles as the library's **dogfooding harness**: building the example against the published API
surfaces ergonomics and gaps a unit-test suite cannot.

**Audience:** backend engineers evaluating or adopting the library; frontend engineers wiring a
cache-admin UI; reviewers auditing the library's API; and AI agents executing the phased plan.

---

## 2 · Goals & Non-Goals

### Goals

- **G1 — Total surface coverage.** Every export of `@bymax-one/nest-cache` (both subpaths) is
  demonstrated and tracked in the [Feature Coverage Matrix](#7--feature-coverage-matrix) (§7).
- **G2 — Honest semantics.** No demo misrepresents what the library does. Where the library has a
  boundary (single namespace per instance, no cluster `scan`, namespaced Pub/Sub channels), the
  example demonstrates the boundary and the correct escape hatch rather than hiding it.
- **G3 — Production-grade wiring.** The `forRootAsync` factory, exception filter, graceful shutdown,
  and observability bridge are written the way a real service should write them.
- **G4 — One visual product.** The dashboard is visually indistinguishable from the other Bymax
  example apps — same design system (§14), same shell, same brand.
- **G5 — Minimal infra.** Redis only by default; no database. The demo domain uses in-memory
  "origin" stores so the focus stays on the cache.
- **G6 — Authoritative documentation.** This spec, a phased plan, a polished README, and JSDoc-rich
  code that reads like a tutorial.

### Non-Goals

- **NG1 — Not a production deployment template.** Local dev reference only; no Kubernetes/CD.
- **NG2 — No authentication.** Out of scope — that is `@bymax-one/nest-auth`'s job. The dashboard is
  open on localhost.
- **NG3 — No database / ORM.** Origin data is in-memory.
- **NG4 — _(superseded)_ Not a 100%-coverage/mutation-gated repo.** Revised by decision (see
  `DEVELOPMENT_PLAN.md` Appendix C): because this is the reference implementation other projects
  copy and the library is not yet published, the repo now adopts the full library-grade bar —
  100% unit coverage (Phase 16), E2E of every flow (Phase 17), and Stryker mutation (Phase 18),
  with the Phase 15 smoke suite as the fast integration tier on top.
- **NG5 — Not a Redis tutorial.** It assumes Redis basics; it teaches the **library's** abstractions
  over Redis.

---

## 3 · Architecture at a Glance

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              Browser (localhost:3000)                          │
│  Next.js 16 dashboard · React 19 · Tailwind v4 · shadcn new-york · forced dark │
│                                                                                │
│   TanStack Query ──HTTP──▶                          socket.io-client ◀──WS──   │
│        (lib/api-client.ts)                              (lib/socket.ts)        │
│   imports @bymax-one/nest-cache/shared  ← zero-dep types in the browser bundle │
└───────────────┬──────────────────────────────────────────────▲───────────────┘
                │ REST (JSON)                                    │ WebSocket
                ▼                                                │ (connection status,
┌──────────────────────────────────────────────────────────────┴───────────────┐
│                          NestJS API (localhost:3001)                           │
│                                                                                │
│  Feature modules ──▶ CacheService / PubSubService / ScriptManagerService       │
│  (catalog, counters, collections, tenants, admin, pubsub, ttl-events,          │
│   stampede, serializer-demo, errors-demo, health, metrics)                     │
│                                                                                │
│  BymaxCacheModule.forRootAsync({ connection, namespace, serializer, events,    │
│                                  scripts, shutdownTimeoutMs })                  │
│        │                                  │                     │              │
│        │ events.onEvent ──▶ Logger + EventsGateway (broadcast connection state)│
│        │                                                                       │
│  CacheExceptionFilter (@Catch(CacheException)) ─▶ { error: { code, message } } │
└───────────────┬────────────────────────────────────────────────┬─────────────┘
                │ ioredis 5 (main client)                          │ dedicated subscriber
                │                                                  │ (createSubscriberClient)
                ▼                                                  ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                      Redis 7 (Docker, 127.0.0.1:6379)                            │
│  keyspace notifications enabled (notify-keyspace-events Ex) for the TTL demo     │
│  optional profiles: RedisInsight (5540) · cluster · sentinel                     │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Three planes, one library:**

- **Data plane** — feature modules call the typed `CacheService` facade; every key is namespaced by
  the library's `KeyBuilder`.
- **Control plane** — `PubSubService` (namespaced app channels) and the **raw subscriber** (Redis
  keyspace channels) feed the `EventsGateway`, which streams to the browser over WebSocket.
- **Observability plane** — `events.onEvent` lifecycle callbacks bridge to the Nest `Logger` and the
  gateway, so the dashboard shows live connection state.

---

## 4 · The Library Under Test — `@bymax-one/nest-cache`

| Property         | Value                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------- |
| Package          | `@bymax-one/nest-cache`                                                                  |
| Version targeted | `0.1.0` (pre-1.0)                                                                        |
| Module type      | ESM (`"type": "module"`), dual ESM + CJS build (tsup)                                    |
| Subpaths         | `.` (server — NestJS module + services) · `./shared` (zero-dependency types + constants) |
| Runtime deps     | **none** (`dependencies: {}`)                                                            |
| Peer deps        | `@nestjs/common ^11`, `@nestjs/core ^11`, `ioredis ^5`, `reflect-metadata ^0.2`          |
| Node             | `>= 24`                                                                                  |
| License          | MIT                                                                                      |

### 4.1 Public API inventory (server subpath `.`)

The example must touch every row of this inventory; §7 maps each to where it is demonstrated.

**Module & registration**

- `BymaxCacheModule.forRoot(options)` — synchronous registration.
- `BymaxCacheModule.forRootAsync(options)` — async registration via `useFactory` (the example's primary path).
- Options types: `BymaxCacheModuleOptions`, `BymaxCacheModuleAsyncOptions`.
- Connection blocks: `BymaxCacheStandaloneConnection`, `BymaxCacheSentinelConnection`, `BymaxCacheClusterConnection`.

**`CacheService`** — the typed, namespaced facade:

| Group              | Methods                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------- |
| Strings            | `get<T>` · `getRaw` · `set<T>` · `setRaw` · `setNx<T>`                                       |
| Delete / existence | `del` · `delMany` · `exists`                                                                 |
| Numerics           | `incr` · `decr`                                                                              |
| TTL                | `expire` · `ttl` · `persist`                                                                 |
| Batch              | `mget<T>` · `mset<T>`                                                                        |
| Hashes             | `hget<T>` · `hset<T>` · `hgetall<T>` · `hdel`                                                |
| Sets               | `sadd` · `srem` · `smembers` · `sismember` · `scard`                                         |
| Iteration          | `keys` (dev only — O(N), blocks) · `scan` (cursor, async iterable; standalone/sentinel only) |
| Escape hatch       | `pipeline()` · `getClient()` (keys **not** auto-namespaced)                                  |
| Namespace ops      | `flushNamespace()` (SCAN + UNLINK, production-guarded)                                       |
| Scripts            | `eval(scriptName, keys, args)` (keys auto-namespaced)                                        |
| Health             | `isHealthy()` (never throws) · `ping()` (throws on failure) · `info(section?)`               |

**Other services & classes**

- `PubSubService` — `publish<T>` · `subscribe<T>` · `psubscribe<T>` (channels/patterns namespaced).
- `ScriptManagerService` — `register(name, lua)` · `load(name)` → SHA1 · `eval(name, keys, args)`.
- `ConnectionManager` — `getClient()` · `createSubscriberClient()`.
- `KeyBuilder` — `build(prefix, id)` · `applyNamespace(key)` · `getNamespacePrefix()`.
- `JsonSerializer implements ISerializer` — default codec.

**Injection tokens (Symbols)**
`BYMAX_CACHE_OPTIONS` · `BYMAX_CACHE_CONNECTION` · `BYMAX_CACHE_SCRIPT_REGISTRY` ·
`BYMAX_CACHE_EVENTS` · `BYMAX_CACHE_SERIALIZER` · `BYMAX_CACHE_KEY_BUILDER`.

**Interfaces & types**
`ISerializer` · `IScriptDefinition` · `ICacheEvents` · `IPubSubHandler<T>` ·
`IPubSubPatternHandler<T>` · `Unsubscribe` · `CacheEventName` · `CacheConnectionStatus` ·
`CacheNamespace` · `CacheKeyPrefix` · `SerializableValue` · `CacheErrorCode`.

**Errors & constants**
`CacheException` (extends `HttpException`; carries `.code` + `.details`) · `CACHE_ERROR_CODES` ·
`CACHE_ERROR_MESSAGES` (`ReadonlyMap`) · `CACHE_EVENT_NAMES`.

**Re-exported ioredis types** (for consumer convenience): `ClusterNode`, `ClusterOptions`, `Redis`,
`RedisKey`, `RedisOptions`, `SentinelAddress`.

### 4.2 Public API inventory (shared subpath `./shared`)

Zero-dependency — importable in any runtime including the **browser bundle**. The dashboard imports
from here to type error codes and connection events without pulling NestJS/ioredis into the client.

`CACHE_ERROR_CODES` · `CACHE_EVENT_NAMES` · `CacheConnectionStatus` · `CacheErrorCode` ·
`CacheEventName` · `CacheKeyPrefix` · `CacheNamespace` · `SerializableValue`.

### 4.3 Key composition & default option values

Keys are composed as **`{namespace}{separator}{prefix}{separator}{id}`**. With defaults
(`namespace='app'`, `separator=':'`): `build('product', '42')` → `app:product:42`.

| Option                            | Default                       | Notes                                                                           |
| --------------------------------- | ----------------------------- | ------------------------------------------------------------------------------- |
| `mode`                            | `'standalone'`                | `'standalone' \| 'sentinel' \| 'cluster'`                                       |
| `namespace`                       | `'app'`                       | global prefix for every key (the example uses `cache-example`)                  |
| `keySeparator`                    | `':'`                         | segment separator                                                               |
| `serializer`                      | `JsonSerializer`              | swappable via `ISerializer`                                                     |
| `shutdownTimeoutMs`               | `5000`                        | graceful `quit()` timeout                                                       |
| `allowFlushInProduction`          | `false`                       | safety guard on `flushNamespace()`                                              |
| `isGlobal`                        | `true`                        | module registered `@Global()`                                                   |
| `scripts`                         | `[]`                          | pre-registered `IScriptDefinition[]`                                            |
| `connection.port`                 | `6379`                        | standalone                                                                      |
| `connection.lazyConnect`          | `false`                       | connect on `OnModuleInit`                                                       |
| `connection.connectTimeout`       | `10_000 ms`                   |                                                                                 |
| `connection.commandTimeout`       | `5_000 ms`                    |                                                                                 |
| `connection.maxRetriesPerRequest` | `3`                           | do **not** pass `null` (that is BullMQ-specific); ioredis's own default is `20` |
| `connection.enableReadyCheck`     | `true`                        |                                                                                 |
| `connection.enableOfflineQueue`   | `false`                       | fail fast on the data-plane client                                              |
| `connection.retryStrategy`        | `(t) => Math.min(t*50, 2000)` | bounded backoff                                                                 |
| `connection.reconnectOnError`     | reconnect on `READONLY`       | replica failover                                                                |

---

## 5 · Tech Stack

| Layer               | Technology                                                        | Version                                 | Why                                                         |
| ------------------- | ----------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------- |
| Cache library       | `@bymax-one/nest-cache`                                           | `0.1.0`                                 | the subject under demonstration                             |
| API runtime         | NestJS                                                            | `^11`                                   | the library's target framework                              |
| Node                | Node.js                                                           | `>= 24`                                 | library engine requirement                                  |
| Redis client        | `ioredis` (peer of the lib)                                       | `^5`                                    | library's transport                                         |
| Real-time           | `@nestjs/websockets` + `@nestjs/platform-socket.io` + `socket.io` | `^11` / `^4`                            | streams events to the browser                               |
| Validation          | `zod`                                                             | `^4`                                    | env + DTO validation (no class-validator)                   |
| Config              | `@nestjs/config`                                                  | `^4`                                    | typed `ConfigService<Env, true>`                            |
| Frontend            | Next.js (App Router)                                              | `^16`                                   | matches sibling examples                                    |
| UI runtime          | React                                                             | `^19`                                   |                                                             |
| Styling             | Tailwind CSS                                                      | `^4` (`@tailwindcss/postcss`)           | design-system tokens                                        |
| Components          | shadcn/ui (`new-york`) + `lucide-react`                           | latest                                  | brand component recipes                                     |
| Fonts               | `geist` (Sans + Mono)                                             | `^1`                                    | design-system typography                                    |
| Data fetching (web) | TanStack Query                                                    | `^5`                                    | server-state cache + revalidation                           |
| Live socket (web)   | `socket.io-client`                                                | `^4`                                    | event/TTL/status feeds                                      |
| Toasts (web)        | `sonner`                                                          | latest                                  | glass toaster                                               |
| Redis               | Redis                                                             | `7-alpine` (Docker)                     | keyspace notifications enabled                              |
| Optional GUI        | RedisInsight                                                      | `redis/redisinsight` (port 5540)        | power-user Redis browser                                    |
| Package manager     | pnpm (workspaces)                                                 | `>= 10.8` (pinned via `packageManager`) | matches all Bymax repos                                     |
| Language            | TypeScript (strict)                                               | `^5.9`                                  | `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, … |
| Lint/format         | ESLint 9 (flat) + Prettier                                        | `^9` / `^3`                             | shared Bymax config                                         |
| Git hooks           | Husky + commitlint + lint-staged                                  | —                                       | Conventional Commits, enforced locally                      |
| API tests           | Jest + `@nestjs/testing` + Testcontainers (`redis:7-alpine`)      | `^30`                                   | E2E against real Redis                                      |
| Web tests           | Playwright (smoke)                                                | latest                                  | dashboard happy-path                                        |

---

## 6 · Repository Layout

A pnpm monorepo. The library is consumed as an **external package** (never a workspace member) so
the example validates the _published_ API, exactly as a real consumer would.

```
nest-cache-example/
├── apps/
│   ├── api/                                  # NestJS application
│   │   ├── src/
│   │   │   ├── main.ts                        # bootstrap, CORS, shutdown hooks, IoAdapter
│   │   │   ├── app.module.ts                  # wires BymaxCacheModule.forRootAsync + features
│   │   │   ├── config/
│   │   │   │   └── env.schema.ts              # Zod env schema + validateEnv() + Env type
│   │   │   ├── cache/                         # library wiring (the copy-paste reference)
│   │   │   │   ├── cache.config.ts            # buildCacheOptions(config) → BymaxCacheModuleOptions
│   │   │   │   ├── cache.events.ts            # ICacheEvents bridge → Logger + EventsGateway
│   │   │   │   ├── msgpack.serializer.ts      # custom ISerializer demo
│   │   │   │   ├── scripts/                   # IScriptDefinition[] (single-flight lock, etc.)
│   │   │   │   └── cache.module.ts            # re-exports BymaxCacheModule + shared providers
│   │   │   ├── common/
│   │   │   │   ├── cache-exception.filter.ts  # @Catch(CacheException) → structured body
│   │   │   │   ├── zod-validation.pipe.ts     # parses DTO Zod schemas
│   │   │   │   └── cache-keys.ts              # the app's prefix constants (typed)
│   │   │   ├── catalog/                       # product catalogue: strings · TTL · setNx · mget/mset
│   │   │   ├── counters/                      # incr/decr (view counters, rate-limit-style)
│   │   │   ├── collections/                   # hashes (carts) · sets (tags)
│   │   │   ├── tenants/                        # namespace/prefix isolation + per-tenant clear
│   │   │   ├── admin/                          # cache-admin: scan · get/del key · flushNamespace · info
│   │   │   ├── pubsub/                         # publish endpoint + EventsGateway bridge
│   │   │   ├── ttl-events/                     # raw keyspace-notification subscriber → gateway
│   │   │   ├── stampede/                       # Lua single-flight lock demo
│   │   │   ├── serializer-demo/                # JSON vs custom serializer
│   │   │   ├── errors-demo/                    # trigger each CacheException on demand
│   │   │   ├── metrics/                        # in-app hit/miss counters (clearly app-level)
│   │   │   ├── health/                         # /health (isHealthy + ping latency) · /metrics
│   │   │   └── events/                         # EventsGateway (socket.io) — the WS hub
│   │   ├── test/
│   │   │   └── *.e2e-spec.ts                   # Testcontainers-backed smoke suite
│   │   ├── .env.example
│   │   ├── nest-cli.json · tsconfig*.json · jest.config.cjs
│   │   └── package.json
│   └── web/                                   # Next.js 16 dashboard
│       ├── app/
│       │   ├── layout.tsx · providers.tsx · globals.css · page.tsx (Overview)
│       │   ├── explorer/page.tsx              # namespace + key explorer (scan)
│       │   ├── playground/page.tsx            # strings/numerics/hashes/sets/batch
│       │   ├── tenants/page.tsx               # namespace/prefix isolation
│       │   ├── pubsub/page.tsx                # live event feed + publish + pattern sub
│       │   ├── ttl/page.tsx                   # keyspace-notification expiry feed + rings
│       │   ├── stampede/page.tsx              # single-flight timeline
│       │   ├── serializer/page.tsx            # JSON vs custom
│       │   ├── errors/page.tsx                # Error Explorer
│       │   └── connection/page.tsx            # lifecycle events + INFO sections
│       ├── components/{layout,explorer,playground,pubsub,charts,ui}/
│       ├── lib/
│       │   ├── api-client.ts                  # typed fetch wrapper → apps/api
│       │   ├── socket.ts                      # socket.io-client setup
│       │   ├── cache-status.ts                # CacheConnectionStatus → color/icon/label
│       │   └── utils.ts                       # cn()
│       ├── tailwind.config.ts · components.json · postcss.config.mjs
│       └── package.json
├── docker/
│   ├── redis/redis.conf                       # notify-keyspace-events Ex (+ comments)
│   ├── cluster/                               # optional --profile cluster
│   └── sentinel/                              # optional --profile sentinel
├── docker-compose.yml                         # Redis 7 (default) + profiles: tools|cluster|sentinel
├── docs/
│   ├── TECHNICAL_SPECIFICATION.md             # this file (authoritative blueprint)
│   ├── OVERVIEW.md                            # superseded early draft (kept for history)
│   ├── DEVELOPMENT_PLAN.md                    # phased plan (derived from §25) — TBD
│   ├── design_system.html                     # shared Bymax UI source of truth
│   └── tasks/                                 # per-phase JIRA-style task files — TBD
├── pnpm-workspace.yaml                        # packages: ['apps/*']
├── package.json · tsconfig.base.json · eslint.config.mjs · .prettierrc.mjs
├── commitlint.config.mjs · lint-staged.config.mjs · renovate.json
├── .husky/ · .nvmrc (24) · .npmrc · .editorconfig · .gitmessage
├── README.md · CHANGELOG.md · LICENSE · CONTRIBUTING.md · CLAUDE.md · AGENTS.md
```

---

## 7 · Feature Coverage Matrix

The spine of the project. **Every** public export is demonstrated and tracked here; the
`DEVELOPMENT_PLAN.md` phases, the README "What's inside", and (optionally) a CI export-audit script
all reference these rows. Status legend: ✅ planned-covered · ⛔ intentionally not exercised (with
reason).

> **CI-enforceable rule (recommended).** A `scripts/audit-library-exports.mjs` script can diff the
> library's actual exports against this matrix and fail if a new export is undocumented — the same
> idea the sibling examples use. Listed as a Phase 9 deliverable.

### 7.1 Module, registration & DI

| #   | Library surface                                            | Demonstrated in                                                  | Status |
| --- | ---------------------------------------------------------- | ---------------------------------------------------------------- | ------ |
| 1   | `BymaxCacheModule.forRootAsync`                            | `cache/cache.module.ts` + `app.module.ts` (primary wiring)       | ✅     |
| 2   | `BymaxCacheModule.forRoot`                                 | E2E test module (sync wiring path)                               | ✅     |
| 3   | `BymaxCacheModuleOptions` / `BymaxCacheModuleAsyncOptions` | `cache/cache.config.ts` factory return type                      | ✅     |
| 4   | `BymaxCacheStandaloneConnection`                           | default `cache.config.ts` (env-driven URL/host)                  | ✅     |
| 5   | `BymaxCacheSentinelConnection`                             | `cache.config.ts` (`--profile sentinel`) + §15.2                 | ✅     |
| 6   | `BymaxCacheClusterConnection`                              | `cache.config.ts` (`--profile cluster`) + §15.3                  | ✅     |
| 7   | `BYMAX_CACHE_OPTIONS`                                      | `health`/`admin` read effective options (namespace, separator)   | ✅     |
| 8   | `BYMAX_CACHE_CONNECTION` (`ConnectionManager`)             | `ttl-events` raw subscriber + `connection` page INFO             | ✅     |
| 9   | `BYMAX_CACHE_SCRIPT_REGISTRY` (`ScriptManagerService`)     | `stampede` module (`register`/`eval`)                            | ✅     |
| 10  | `BYMAX_CACHE_EVENTS` (`ICacheEvents`)                      | `cache/cache.events.ts` lifecycle bridge                         | ✅     |
| 11  | `BYMAX_CACHE_SERIALIZER` (`ISerializer`)                   | `serializer-demo` (inspect injected serializer)                  | ✅     |
| 12  | `BYMAX_CACHE_KEY_BUILDER` (`KeyBuilder`)                   | `admin` (scan patterns) + `ttl-events` (namespace prefix filter) | ✅     |

### 7.2 `CacheService` methods

| #   | Method(s)                                            | Demonstrated in                                                         | Status |
| --- | ---------------------------------------------------- | ----------------------------------------------------------------------- | ------ |
| 13  | `get<T>` / `set<T>`                                  | `catalog` (read-through with TTL)                                       | ✅     |
| 14  | `getRaw` / `setRaw`                                  | `serializer-demo` (show stored bytes vs decoded)                        | ✅     |
| 15  | `setNx<T>`                                           | `catalog` (idempotent seed) + `stampede` (lock comparison)              | ✅     |
| 16  | `del` / `delMany`                                    | `admin` (delete key) + `tenants` (clear a tenant's keys)                | ✅     |
| 17  | `exists`                                             | `playground` (strings panel)                                            | ✅     |
| 18  | `incr` / `decr`                                      | `counters` (product views, stock decrement)                             | ✅     |
| 19  | `expire` / `ttl` / `persist`                         | `catalog` + `explorer` (TTL ring + "pin" = persist)                     | ✅     |
| 20  | `mget<T>` / `mset<T>`                                | `catalog` (batch fetch list)                                            | ✅     |
| 21  | `hget` / `hset` / `hgetall` / `hdel`                 | `collections` (cart as a hash)                                          | ✅     |
| 22  | `sadd` / `srem` / `smembers` / `sismember` / `scard` | `collections` (product tags as a set)                                   | ✅     |
| 23  | `scan`                                               | `admin` / `explorer` (production-safe key listing)                      | ✅     |
| 24  | `keys`                                               | `explorer` (shown beside `scan` with an explicit O(N) blocking warning) | ✅     |
| 25  | `pipeline()`                                         | `admin` "bulk seed" (batched writes via `KeyBuilder`)                   | ✅     |
| 26  | `getClient()`                                        | `tenants` (seed a _foreign_ namespace to prove isolation)               | ✅     |
| 27  | `flushNamespace()`                                   | `admin` (guarded "flush all" + production-guard demo in §19)            | ✅     |
| 28  | `eval(scriptName, …)`                                | `stampede` (single-flight lock)                                         | ✅     |
| 29  | `isHealthy()` / `ping()` / `info()`                  | `health` + `connection` page (status badge, latency, INFO)              | ✅     |

### 7.3 Pub/Sub, scripts, key builder, serialization

| #   | Library surface                                              | Demonstrated in                                               | Status |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------- | ------ |
| 30  | `PubSubService.publish` / `subscribe`                        | `pubsub` (publish form → live feed across tabs)               | ✅     |
| 31  | `PubSubService.psubscribe` (`IPubSubPatternHandler`)         | `pubsub` (pattern subscription toggle, e.g. `product:*`)      | ✅     |
| 32  | `Unsubscribe` (ref-counted)                                  | `pubsub` (subscribe/unsubscribe lifecycle, double-unsub safe) | ✅     |
| 33  | `IPubSubHandler<T>`                                          | `pubsub` gateway handler typing                               | ✅     |
| 34  | `ScriptManagerService.register` / `load` / `eval`            | `stampede` (register lock script, inspect SHA via `load`)     | ✅     |
| 35  | `IScriptDefinition`                                          | `cache/scripts/*` (declared in `options.scripts`)             | ✅     |
| 36  | `KeyBuilder.build` / `applyNamespace` / `getNamespacePrefix` | `admin` (build scan patterns) + `ttl-events` (filter)         | ✅     |
| 37  | `JsonSerializer` (default)                                   | `serializer-demo` (default path)                              | ✅     |
| 38  | `ISerializer` (custom)                                       | `serializer-demo` (`msgpack.serializer.ts` swap)              | ✅     |
| 39  | `SerializableValue`                                          | `serializer-demo` (typed payloads + Date/Map/Set caveat)      | ✅     |
| 40  | `CacheNamespace` / `CacheKeyPrefix`                          | `common/cache-keys.ts` (typed prefix constants)               | ✅     |

### 7.4 Errors, events, health & shared subpath

| #   | Library surface                                                                 | Demonstrated in                                                 | Status |
| --- | ------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------ |
| 41  | `CacheException` (`.code`, `.details`, HTTP status)                             | `common/cache-exception.filter.ts` + `errors-demo`              | ✅     |
| 42  | `CACHE_ERROR_CODES`                                                             | `errors-demo` (trigger each) + filter mapping                   | ✅     |
| 43  | `CACHE_ERROR_MESSAGES` (`ReadonlyMap`)                                          | `errors-demo` (display canonical message)                       | ✅     |
| 44  | `CacheErrorCode` (type)                                                         | `api-client.ts` + `errors/page.tsx` (typed handling)            | ✅     |
| 45  | `ICacheEvents` / `CacheEventName`                                               | `cache/cache.events.ts` (lifecycle → logger + WS)               | ✅     |
| 46  | `CacheConnectionStatus`                                                         | `connection` page badge (`lib/cache-status.ts`)                 | ✅     |
| 47  | `CACHE_EVENT_NAMES`                                                             | `cache.events.ts` (branch on symbolic names)                    | ✅     |
| 48  | **Shared subpath** `@bymax-one/nest-cache/shared`                               | imported in **both** `apps/api` and `apps/web` (browser bundle) | ✅     |
| 49  | Re-exported ioredis types (`RedisOptions`, `ClusterNode`, `SentinelAddress`, …) | `cache.config.ts` typing of connection blocks                   | ✅     |
| 50  | `@bymax-one/nest-logger` events bridge (optional)                               | `cache.events.ts` (documented production pattern, §20.4)        | ✅     |

---

## 8 · Library Consumption

The example consumes `@bymax-one/nest-cache` as a versioned external package — **not** a workspace
member. This mirrors a real install and ensures the example validates the published API surface, not
a local `src/`.

### 8.1 Three modes of linking (documented, in order of preference for this repo's phase)

Because the library is **not yet published**, the default is a local file link; the end-state is the
npm semver range.

```jsonc
// apps/api/package.json (and apps/web/package.json for the shared subpath)
"dependencies": {
  // (a) Local link — current default until npm publish. Re-links on each install.
  "@bymax-one/nest-cache": "file:../../../nest-cache"

  // (b) After publish — the real consumer experience:
  // "@bymax-one/nest-cache": "^0.1.0"
}
```

```bash
# (c) Iterative library development — global link + watch rebuild on the library side:
cd ../nest-cache && pnpm build && pnpm link --global
cd ../nest-cache-example && pnpm link --global @bymax-one/nest-cache
```

> 🎓 **Why `file:` and not a workspace package.** A workspace member would short-circuit the
> published `exports` map and resolve the library's `src/` directly, hiding subpath/`d.ts`/dual-build
> issues. `file:` (or `link --global`) resolves through the built `dist/` + `package.json#exports`,
> so the example exercises the same resolution a real consumer hits. **Peer-dep note:** keep
> `ioredis`, `@nestjs/common`, `@nestjs/core`, and `reflect-metadata` in `apps/api` so the linked
> library's peers resolve to a single copy.

### 8.2 Subpath imports

```ts
// apps/api — server subpath (NestJS module + services)
import {
  BymaxCacheModule,
  CacheService,
  PubSubService,
  ScriptManagerService,
  CacheException,
  CACHE_ERROR_CODES,
  BYMAX_CACHE_CONNECTION,
  ConnectionManager,
  type ISerializer,
  type IScriptDefinition,
  type ICacheEvents,
} from '@bymax-one/nest-cache'

// apps/api AND apps/web — shared subpath (zero-dep types + constants)
import {
  CACHE_ERROR_CODES,
  CACHE_EVENT_NAMES,
  type CacheErrorCode,
  type CacheConnectionStatus,
  type CacheEventName,
  type SerializableValue,
} from '@bymax-one/nest-cache/shared'
```

> 🎓 **The dual-subpath demonstration (matrix #48).** The dashboard imports `@bymax-one/nest-cache/shared`
> to type API error codes and the connection-status badge. Because the shared subpath is
> zero-dependency, **none of NestJS or ioredis leaks into the browser bundle** — a deliberate,
> verifiable proof of the library's layering. A web unit test asserts the import resolves and that
> `CACHE_ERROR_CODES` is a frozen object of `cache.*` strings.

---

## 9 · Configuration & Environment

### 9.1 Environment variables (`apps/api`)

All env access goes through a Zod-validated, typed `ConfigService<Env, true>`. No raw `process.env`
in feature code.

| Variable                    | Default (dev)            | Purpose                                                          |
| --------------------------- | ------------------------ | ---------------------------------------------------------------- |
| `NODE_ENV`                  | `development`            | gates `allowFlushInProduction` behaviour                         |
| `PORT`                      | `3001`                   | API HTTP/WS port                                                 |
| `WEB_ORIGIN`                | `http://localhost:3000`  | CORS allow-list for the dashboard                                |
| `REDIS_URL`                 | `redis://localhost:6379` | standalone connection (wins over discrete fields)                |
| `REDIS_HOST` / `REDIS_PORT` | `localhost` / `6379`     | discrete fallback                                                |
| `REDIS_PASSWORD`            | _(empty)_                | optional auth (never logged)                                     |
| `REDIS_DB`                  | `0`                      | logical DB index (also used for the `__keyevent@<db>__` channel) |
| `CACHE_MODE`                | `standalone`             | `standalone \| sentinel \| cluster`                              |
| `CACHE_NAMESPACE`           | `cache-example`          | the library `namespace` for this app                             |
| `CACHE_KEY_SEPARATOR`       | `:`                      | the library `keySeparator`                                       |
| `CACHE_DEFAULT_TTL`         | `60`                     | demo default TTL (seconds)                                       |
| `CACHE_SERIALIZER`          | `json`                   | `json \| msgpack` (serializer-demo + global default)             |
| `ALLOW_FLUSH_IN_PRODUCTION` | `false`                  | maps to `allowFlushInProduction` (kept `false`)                  |
| `SHUTDOWN_TIMEOUT_MS`       | `5000`                   | maps to `shutdownTimeoutMs`                                      |

`apps/web`: `NEXT_PUBLIC_API_URL=http://localhost:3001`, `NEXT_PUBLIC_WS_URL=http://localhost:3001`.

### 9.2 The canonical wiring — `cache/cache.config.ts`

This factory is the project's headline copy-paste artifact: it separates _what the options are_ from
_how the module is wired_.

```ts
/**
 * Builds the resolved options for BymaxCacheModule from validated env.
 * @param config - Typed config service over the Zod-validated Env.
 * @param events - The lifecycle bridge (Logger + WebSocket broadcaster).
 * @returns Fully-formed BymaxCacheModuleOptions.
 */
export function buildCacheOptions(
  config: ConfigService<Env, true>,
  events: ICacheEvents,
): BymaxCacheModuleOptions {
  const mode = config.get('CACHE_MODE', { infer: true })
  const serializer =
    config.get('CACHE_SERIALIZER', { infer: true }) === 'msgpack'
      ? new MsgPackSerializer()
      : undefined // undefined → library default JsonSerializer

  return {
    mode,
    connection:
      mode === 'standalone' ? { url: config.get('REDIS_URL', { infer: true }) } : undefined,
    sentinel: mode === 'sentinel' ? buildSentinelBlock(config) : undefined,
    cluster: mode === 'cluster' ? buildClusterBlock(config) : undefined,
    namespace: config.get('CACHE_NAMESPACE', { infer: true }),
    keySeparator: config.get('CACHE_KEY_SEPARATOR', { infer: true }),
    serializer,
    events, // ICacheEvents — see cache.events.ts
    scripts: CACHE_SCRIPTS, // IScriptDefinition[] (single-flight lock, …)
    shutdownTimeoutMs: config.get('SHUTDOWN_TIMEOUT_MS', { infer: true }),
    allowFlushInProduction: config.get('ALLOW_FLUSH_IN_PRODUCTION', { infer: true }),
  }
}
```

```ts
// app.module.ts — the async registration (NestJS 11 ConfigurableModuleBuilder convention)
BymaxCacheModule.forRootAsync({
  isGlobal: true, // decided synchronously by the builder — must be passed here, not inside useFactory
  imports: [ConfigModule, EventsModule], // EventsModule provides the gateway the bridge talks to
  inject: [ConfigService, CacheEventsBridge],
  useFactory: (config: ConfigService<Env, true>, bridge: CacheEventsBridge) =>
    buildCacheOptions(config, bridge.toCacheEvents()),
})
```

> ⚠️ **`isGlobal` is synchronous.** Per the library's types, `forRootAsync` decides the module's
> `global` flag _before_ the async factory resolves — so `isGlobal` must be passed at the
> `forRootAsync({ isGlobal, … })` call site. An `isGlobal` returned from inside `useFactory` has no
> effect. The example documents this inline.

---

## 10 · Backend Design — `apps/api`

### 10.1 Module map & responsibilities

| Module            | Responsibility                                                                   | Primary library surface                                                              |
| ----------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `config`          | Zod env schema + `validateEnv()`                                                 | —                                                                                    |
| `cache`           | `forRootAsync` wiring, events bridge, custom serializer, Lua scripts, re-exports | `BymaxCacheModule`, `ICacheEvents`, `ISerializer`, `IScriptDefinition`               |
| `common`          | `CacheExceptionFilter`, `ZodValidationPipe`, typed prefix constants              | `CacheException`, `CACHE_ERROR_CODES`                                                |
| `catalog`         | Product read-through cache                                                       | `get/set`, `setNx`, `ttl/expire/persist`, `mget/mset`                                |
| `counters`        | Atomic counters                                                                  | `incr`, `decr`                                                                       |
| `collections`     | Carts (hash) + tags (set)                                                        | `hget/hset/hgetall/hdel`, `sadd/srem/smembers/sismember/scard`                       |
| `tenants`         | Prefix-scoped isolation + cross-namespace proof                                  | `del/delMany`, `scan`, `getClient`, `KeyBuilder`                                     |
| `admin`           | Cache-admin (explorer backend)                                                   | `scan`, `keys`, `pipeline`, `flushNamespace`, `info`, `ttl`                          |
| `pubsub`          | Publish endpoint + WS bridge                                                     | `PubSubService.publish/subscribe/psubscribe`, `Unsubscribe`                          |
| `ttl-events`      | Raw keyspace-notification subscriber                                             | `BYMAX_CACHE_CONNECTION` → `createSubscriberClient`, `KeyBuilder.getNamespacePrefix` |
| `stampede`        | Single-flight Lua lock                                                           | `ScriptManagerService`, `CacheService.eval`                                          |
| `serializer-demo` | JSON vs custom codec                                                             | `getRaw/setRaw`, `BYMAX_CACHE_SERIALIZER`, `SerializableValue`                       |
| `errors-demo`     | Trigger each `CacheException`                                                    | `CACHE_ERROR_CODES`, `CACHE_ERROR_MESSAGES`                                          |
| `metrics`         | App-level hit/miss counters (clearly **not** a library feature)                  | —                                                                                    |
| `health`          | `/health`, `/metrics`                                                            | `isHealthy`, `ping`, `info`                                                          |
| `events`          | `EventsGateway` (socket.io) — the WS hub                                         | —                                                                                    |

### 10.2 Controller/service shape (the house style)

Thin controllers, JSDoc on every public method, Zod DTOs, business logic in services.

```ts
/**
 * Read-through product cache. Demonstrates get/set with a TTL, and the
 * cache-miss → origin-fetch → re-populate flow surfaced to the dashboard.
 */
@Injectable()
export class CatalogService {
  private readonly prefix = CACHE_PREFIX.product // typed CacheKeyPrefix constant

  constructor(
    private readonly cache: CacheService,
    private readonly origin: ProductOriginStore, // in-memory "database"
    private readonly metrics: MetricsService,
  ) {}

  /**
   * Returns a product, caching it for {@link CACHE_DEFAULT_TTL} seconds on miss.
   * @param id - Product id.
   * @returns The product, or null if it does not exist in the origin store.
   */
  async getProduct(id: string): Promise<Product | null> {
    const cached = await this.cache.get<Product>(this.prefix, id)
    if (cached) {
      this.metrics.recordHit(this.prefix)
      return cached
    }
    this.metrics.recordMiss(this.prefix)
    const fresh = await this.origin.find(id)
    if (fresh) await this.cache.set(this.prefix, id, fresh, this.ttlSeconds)
    return fresh
  }
}
```

### 10.3 Cross-cutting providers

- **`CacheExceptionFilter`** — global `@Catch(CacheException)`; serializes to
  `{ error: { code, message, details } }` with `exception.getStatus()`. (See §19.)
- **`ZodValidationPipe`** — parses a route's Zod schema from `@Body()`/`@Query()`; a thrown
  `ZodError` maps to `400`.
- **Graceful shutdown** — `app.enableShutdownHooks()`; the library's `ConnectionManager` quits the
  main client on `OnModuleDestroy` within `shutdownTimeoutMs`, and `PubSubService` closes its
  subscriber. `main.ts` documents the ordering.

---

## 11 · Demo Domain & REST API

A deliberately tiny domain — an in-memory **product catalogue** for a fictional multi-tenant shop —
chosen because it naturally exercises every Redis data structure the library exposes. No database;
the "origin" is an in-memory store with an artificial latency so cache hits are visibly faster.

### 11.1 Endpoint catalogue

| Method & path                                                        | Demo                            | Library calls                                        |
| -------------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------- |
| `GET /catalog/products/:id`                                          | read-through cache              | `get` → miss → `set(ttl)`                            |
| `GET /catalog/products?ids=a,b,c`                                    | batch read                      | `mget` (→ `mset` on partial miss)                    |
| `POST /catalog/products/:id/seed`                                    | idempotent seed                 | `setNx`                                              |
| `GET /counters/:id/views` · `POST …/views/incr`                      | view counter                    | `incr` / `decr`                                      |
| `GET /collections/:id/cart` · `POST …/cart` · `DELETE …/cart/:field` | cart as hash                    | `hgetall` / `hset` / `hdel`                          |
| `POST /collections/:id/tags` · `GET …/tags` · `DELETE …/tags/:tag`   | tags as set                     | `sadd` / `smembers` / `sismember` / `scard` / `srem` |
| `GET /tenants/:t/products/:id`                                       | tenant-scoped read              | prefix-scoped `get/set`                              |
| `DELETE /tenants/:t/cache`                                           | clear one tenant                | `scan` + `delMany`                                   |
| `POST /tenants/seed-foreign`                                         | seed a foreign namespace        | `getClient()` (raw, un-namespaced)                   |
| `GET /admin/keys?prefix=&pattern=&strategy=scan\|keys`               | key explorer                    | `scan` / `keys`                                      |
| `GET /admin/keys/:key`                                               | inspect value + TTL             | `getRaw` + `ttl`                                     |
| `DELETE /admin/keys/:key`                                            | delete                          | `del`                                                |
| `POST /admin/seed?count=N`                                           | bulk seed                       | `pipeline()`                                         |
| `DELETE /admin/namespace`                                            | flush whole namespace (guarded) | `flushNamespace()`                                   |
| `GET /admin/info?section=`                                           | Redis INFO                      | `info(section?)`                                     |
| `POST /pubsub/publish`                                               | publish a message               | `PubSubService.publish`                              |
| `POST /pubsub/subscribe` · `DELETE …/subscribe`                      | manage a subscription           | `subscribe` / `psubscribe` / `Unsubscribe`           |
| `POST /stampede?productId=&concurrency=N`                            | stampede lab                    | `eval` (Lua lock)                                    |
| `POST /serializer/roundtrip?codec=json\|msgpack`                     | codec comparison                | `setRaw`/`getRaw` + `get`/`set`                      |
| `GET /serializer/active`                                             | which codec is injected         | `BYMAX_CACHE_SERIALIZER` (constructor name)          |
| `POST /serializer/caveat?codec=json\|msgpack`                        | `Date` lossy-vs-intact caveat   | `setRaw`/`getRaw` + `get`/`set`                      |
| `POST /errors/:code`                                                 | trigger a `CacheException`      | per-code triggers                                    |
| `GET /health`                                                        | health badge                    | `isHealthy` + `ping` (latency)                       |
| `GET /metrics`                                                       | app hit/miss                    | in-memory counters                                   |

### 11.2 Documented journeys

The README and `docs/` include curl walkthroughs (matching the sibling examples' "Demonstrated
Journeys"), e.g. the cache-miss→hit cycle, the stampede collapse, and the cross-namespace
isolation proof. These double as manual smoke tests.

---

## 12 · Demonstration Scenarios

Each scenario states **what it shows**, the **library APIs**, the **UI**, the **API**, and an
honest **design note** where the library has a boundary worth teaching.

### 12.1 Read-through cache + TTL countdown

- **Shows:** miss → origin fetch (slow) → populate with TTL → subsequent hits (fast) → expiry.
- **APIs:** `get`, `set(ttl)`, `ttl`, `expire`, `persist`.
- **UI (`/explorer`, `/`):** a `KeyCard` with a circular TTL ring draining to zero; a hit/miss badge;
  a "Pin" button that calls `persist` (ring → ∞) and an "Extend" button that calls `expire`.
- **API:** `GET /catalog/products/:id`, `GET /admin/keys/:key`.

### 12.2 All Redis data structures (Playground)

- **Shows:** strings, numerics, hashes, sets, batch — each in its own interactive panel.
- **APIs:** the full string/numeric/hash/set/batch groups (matrix rows 13–22).
- **UI (`/playground`):** one card per structure; fire an op, see the typed result and the resulting
  key in the explorer.
- **Design note:** set members are stored **raw** (not serialized) — the UI labels set values as
  "raw string members" to teach this intentional library choice.

### 12.3 Namespace isolation & `flushNamespace`

- **Shows:** the configured `namespace` (`cache-example`) prefixes every key; `flushNamespace()`
  removes **only** this app's keys via `SCAN` + `UNLINK`; a key seeded under a _different_ namespace
  survives.
- **APIs:** `flushNamespace`, `getClient` (to seed the foreign namespace), `KeyBuilder`.
- **UI (`/tenants`, `/explorer`):** a "Seed foreign namespace" button writes `other-app:…` via the
  raw client; "Flush namespace" clears `cache-example:*`; the explorer shows the foreign key
  untouched.

### 12.4 Multi-tenant scoping — the honest design

> 🔧 **Design note (corrects the early draft).** The library has **one `namespace` per module
> instance**; it is **not** a per-call parameter. So multi-tenancy is modeled as **prefix scoping
> within the single namespace**, not "a namespace per tenant". Keys read
> `cache-example:tenant:{tenantId}:product:{id}` (the tenant is the leading segment of the
> entity **prefix**). Clearing one tenant is a `scan('tenant:{id}', '*')` → `delMany`, **not**
> `flushNamespace()` (which would clear all tenants). The real "namespace per tenant" pattern —
> one module instance per deployed tenant with `namespace` from env — is documented as the
> production approach, with this in-process prefix scoping shown as the single-process demo.

- **Shows:** two tenants' caches coexisting; clearing tenant A leaves tenant B intact.
- **APIs:** prefix-scoped `get/set`, `scan`, `delMany`.
- **UI (`/tenants`):** a `TenantSplit` — two side-by-side panels, each with its own keys, hit/miss
  badge, and a "Clear this tenant" button.

### 12.5 Pub/Sub live feed (§17)

### 12.6 TTL expiry via keyspace notifications (§17.3)

### 12.7 Cache stampede / single-flight Lua (§18)

### 12.8 Serializer comparison (§16)

### 12.9 Error Explorer (§19)

### 12.10 Connection lifecycle & health (§20)

---

## 13 · Frontend Design — `apps/web`

A Next.js 16 (App Router) dashboard, **visually identical** to the other Bymax example apps (§14).
It is a _thin client_ over the API: it never talks to Redis directly.

### 13.1 Data layer

- **Server state:** TanStack Query v5 — `useQuery` for reads (explorer, info, metrics), `useMutation`
  for writes (seed, delete, publish), with `queryClient.invalidateQueries` after mutations.
- **Live feeds:** a single `socket.io-client` connection (`lib/socket.ts`) multiplexing three
  channels — `cache:connection` (status/latency), `cache:event` (Pub/Sub), `cache:expired` (TTL).
- **Typed transport:** `lib/api-client.ts` is a thin `fetch` wrapper returning typed results and
  mapping error bodies to a discriminated union keyed by `CacheErrorCode` (imported from the
  library's **shared** subpath — matrix #48).
- **No `useEffect`+fetch for data, no axios** — per Bymax Next.js conventions; live data uses the
  socket, request/response uses TanStack Query.

```ts
// lib/api-client.ts (excerpt) — shared-subpath types in the browser
import { CACHE_ERROR_CODES, type CacheErrorCode } from '@bymax-one/nest-cache/shared'

export type ApiError = { code: CacheErrorCode | 'unknown'; message: string; status: number }
```

### 13.2 Pages

| Route         | Page           | Demonstrates                                                                     |
| ------------- | -------------- | -------------------------------------------------------------------------------- |
| `/`           | Overview       | KPI strip (status, hit rate, total keys, ops), hit/miss chart, namespace summary |
| `/explorer`   | Key Explorer   | `scan`/`keys`, value preview (per-type), TTL ring, delete, pin (`persist`)       |
| `/playground` | Data Types     | strings · numerics · hashes · sets · batch                                       |
| `/tenants`    | Tenants        | prefix isolation + foreign-namespace survives-flush                              |
| `/pubsub`     | Pub/Sub        | live feed, publish form, pattern subscription toggle                             |
| `/ttl`        | TTL Live       | keyspace-notification expiry feed + countdown rings                              |
| `/stampede`   | Stampede Lab   | "Fire N requests" → single-flight timeline + hit-rate                            |
| `/serializer` | Serializer Lab | JSON vs MessagePack: stored bytes vs decoded value                               |
| `/errors`     | Error Explorer | trigger each `CacheException`; show code + status + body                         |
| `/connection` | Connection     | lifecycle event feed, mode, `INFO` sections                                      |

### 13.3 Signature components

`StatTile` (KPI), glass `Card`, pill `Button`, `Badge`/`chip`, **`StatusChip`** (connection status →
color/icon/label, reusing the design system's severity pattern), `Table` (mono), `Tabs`, `Toast`
(sonner), `EmptyState`, `Skeleton`, and four bespoke ones: **`TtlRing`** (SVG progress ring),
**`KeyCard`**, **`EventFeed`** (scrolling, virtualized if large), **`StampedeTimeline`**.

---

## 14 · Design System

The dashboard uses the **shared, project-agnostic Bymax design system**, whose source of truth is
[`docs/design_system.html`](./design_system.html) (open it in a browser; it renders the full system
offline and ends with an AI-agent recreation guide). **Do not invent a new visual language** — the
goal is that any two Bymax example apps look like one product.

### 14.1 Identity

- **Forced dark.** `dark` on `<html>`; no `next-themes`, no theme toggle.
- **Brand orange** `#ff6224` (`hsl(20.5 90.2% 57.8%)`) — primary, ring, active nav, button gradient
  (`from-brand-500 to-brand-600`) with a hover glow `0 0 24px rgba(255,98,36,0.4)`.
- **Glass-morphism** surfaces: `bg rgba(255,255,255,0.06)` + `1px rgba(255,255,255,0.10)` border +
  `backdrop-blur-md` + `rounded-2xl`.
- **Typography:** **Geist Sans** for prose/labels/controls; **monospace** for headings, brand
  wordmark, card titles, metric values, **cache keys**, and table cells — giving the app its
  technical, observability-tool character.
- **8-pt spacing rhythm**, pill controls, `2xl` (16px) cards, `24px` hero radius.

### 14.2 The four files to copy verbatim (from a sibling `apps/web`)

| File                 | Carries                                                                    |
| -------------------- | -------------------------------------------------------------------------- |
| `app/globals.css`    | the token block (`:root` + the live `.dark` set) + base resets + keyframes |
| `tailwind.config.ts` | `theme.extend`: brand scale, radius map, font families, glow keyframes     |
| `components.json`    | shadcn `new-york`, `cssVariables: true`, `baseColor: neutral`, lucide      |
| `postcss.config.mjs` | `@tailwindcss/postcss` only (no `autoprefixer`/`postcss-import`)           |

> `app/layout.tsx` is **adapted** from the sibling (the Geist Sans/Mono wiring and forced `dark` on `<html>` are identical), not copied byte-for-byte — it adds the app's `<Providers>` (Query + Nuqs + Sonner), metadata, and the `nest-cache-example` wordmark. Keep the font + dark setup verbatim so chrome parity holds.

> **Tailwind v4 specifics** (from the design system): map tokens with `@theme inline { … }`; v4 does
> **not** auto-load `tailwind.config.ts` — bridge a kept one via `@config './tailwind.config.ts';`;
> keep `:root`/`.dark` at top level (not inside `@layer base`); declare the dark variant with
> `@custom-variant dark (&:is(.dark *))`; use only `@tailwindcss/postcss` (no `autoprefixer`).

### 14.3 App shell

The canonical shell: a **64px topbar** over a **250px sidebar** + fluid `main` (`max-w-5xl`, widen to
`max-w-7xl` on chart-heavy pages). The topbar carries the brand mark (orange-bordered stacked-layers
glyph) + a mono orange→amber gradient wordmark `nest-cache-example`, and on the right a **Redis
status chip** (● ready / reconnecting / down + round-trip latency) and an avatar. The active nav
item has a left orange border, faint orange fill, and orange text/icon. **Swap only the wordmark and
nav items** from the reference shell.

### 14.4 Status & severity mapping (`lib/cache-status.ts`)

Reuse the design system's accessible "color + icon + text, never color alone" rule, mapping
`CacheConnectionStatus` (and lifecycle `CacheEventName`) to the palette:

| Status / event   | Color            | Meaning                       |
| ---------------- | ---------------- | ----------------------------- |
| `ready`          | `#22c55e` green  | connected, healthy            |
| `connecting`     | `#60a5fa` blue   | initial connect               |
| `reconnecting`   | `#f59e0b` amber  | transient outage, backing off |
| `closed` / `end` | `#ef4444` red    | connection gone               |
| `error` (event)  | `#a855f7` purple | error lifecycle event         |

### 14.5 Acceptance criterion (from the design system)

A screenshot of `nest-cache-example` placed beside any existing Bymax example app must be
**indistinguishable** in chrome (topbar, sidebar, cards, buttons, fonts, orange brand, glass). Only
the page content differs.

---

## 15 · Connection Topologies

The library accepts standalone, sentinel, and cluster from one options shape. The example runs
**standalone** by default and documents (and optionally runs, via Docker profiles) the other two.

### 15.1 Standalone (default)

```ts
{ mode: 'standalone', connection: { url: 'redis://localhost:6379' } }
```

### 15.2 Sentinel (high availability) — `--profile sentinel`

```ts
{
  mode: 'sentinel',
  sentinel: {
    sentinels: [{ host: 'localhost', port: 26379 }, { host: 'localhost', port: 26380 }],
    name: 'mymaster',
    role: 'master', // 'replica' also accepted; normalised internally
    // natMap: …  // for NAT'd Docker/K8s networks
  },
}
```

### 15.3 Cluster (sharded) — `--profile cluster`

```ts
{
  mode: 'cluster',
  cluster: { nodes: [{ host: 'localhost', port: 7000 }, { host: 'localhost', port: 7001 }] },
}
```

### 15.4 Cluster restrictions (demonstrated honestly)

In cluster mode these throw `CacheException('cache.unsupported_in_cluster')`, and the Connection page
surfaces this:

| Method           | Cluster behaviour                                                                   |
| ---------------- | ----------------------------------------------------------------------------------- |
| `scan`           | ⛔ throws `UNSUPPORTED_IN_CLUSTER` (no usable top-level `scanStream`)               |
| `flushNamespace` | ⛔ throws `UNSUPPORTED_IN_CLUSTER`                                                  |
| `getClient`      | ⛔ throws `UNSUPPORTED_IN_CLUSTER` (`Cluster` ≠ full `Redis` API)                   |
| `eval`           | requires ≥1 key (routes by slot); keys of one call must hash to one slot (hash tag) |
| Pub/Sub          | experimental passthrough (not rejected)                                             |

> 🎓 The Connection page lets the reader switch `CACHE_MODE` (with the matching Docker profile up)
> and watch the same admin actions succeed in standalone and **fail with a clear, typed error** in
> cluster — turning a doc footnote into a visible lesson.

---

## 16 · Serialization

### 16.1 Default — `JsonSerializer`

`get<T>`/`set<T>` round-trip through `JSON.stringify`/`JSON.parse`. Deserialization **fails closed**:
a corrupted payload throws `CacheException('cache.deserialization_failed')` rather than returning a
partial/wrong value.

> 🎓 **`SerializableValue` caveats (taught in the Serializer Lab).** JSON does not preserve `Date`
> (becomes an ISO string), `Map`, `Set`, `BigInt`, or `undefined`, and encodes `Buffer` verbosely.
> The lab stores a payload containing a `Date` and shows the lossy round-trip, then the same payload
> through a structure-preserving custom codec.

### 16.2 Custom — `MsgPackSerializer implements ISerializer`

```ts
import { encode, decode } from '@msgpack/msgpack'
import type { ISerializer } from '@bymax-one/nest-cache'

/** MessagePack codec — compact, binary-safe, base64-wrapped for Redis string storage. */
export class MsgPackSerializer implements ISerializer {
  serialize<T>(value: T): string {
    return Buffer.from(encode(value)).toString('base64')
  }
  deserialize<T>(raw: string): T {
    return decode(Buffer.from(raw, 'base64')) as T
  }
}
```

### 16.3 The lab

`/serializer` stores the same object with `codec=json` and `codec=msgpack`, then shows side by side:
the **raw stored string** (`getRaw`) and the **decoded value** (`get`) for each — making the encoding
difference and size visible. The injected serializer is read via `BYMAX_CACHE_SERIALIZER`.

---

## 17 · Pub/Sub & Real-Time

### 17.1 `PubSubService`

- `publish<T>(channel, message)` → serialized, namespaced, returns subscriber count.
- `subscribe<T>(channel, handler)` → lazy dedicated subscriber connection; returns a ref-counted
  `Unsubscribe`.
- `psubscribe<T>(pattern, handler)` → pattern subscription (`IPubSubPatternHandler`).
- A throw inside a handler is swallowed (cannot tear down the shared subscriber) and forwarded to
  `events.onEvent` as an `error` with `reason: 'handler_error'`.

> 🎓 **Namespaced channels.** `publish('product-events', …)` publishes to
> `cache-example:product-events`. Both publisher and subscriber go through the library, so the
> namespace matches transparently — the same isolation guarantee as keys.

### 17.2 The WebSocket bridge

`EventsGateway` (socket.io) subscribes once (server-side) to the demo channels via `PubSubService`
and re-emits `cache:event` to all connected browsers. The `/pubsub` page lets a user publish from the
browser (`POST /pubsub/publish`) and watch it arrive in every open tab — demonstrating fan-out and
the ref-counted subscribe/unsubscribe lifecycle (subscribing twice + unsubscribing once keeps
delivery alive; double-unsubscribe is safe).

### 17.3 TTL expiry via keyspace notifications — the escape hatch

> 🔧 **Why not `PubSubService` here.** `PubSubService.subscribe` **namespaces** the channel, but
> Redis keyspace-notification channels are fixed (`__keyevent@<db>__:expired`) and live outside any
> app namespace. So the TTL demo uses the **raw subscriber** from the connection manager — a clean,
> intentional demonstration of the `BYMAX_CACHE_CONNECTION` token + `createSubscriberClient()`.

```ts
@Injectable()
export class TtlEventsService implements OnModuleInit, OnModuleDestroy {
  private sub?: Redis

  constructor(
    @Inject(BYMAX_CACHE_CONNECTION) private readonly connection: ConnectionManager,
    @Inject(BYMAX_CACHE_KEY_BUILDER) private readonly keys: KeyBuilder,
    private readonly gateway: EventsGateway,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onModuleInit(): Promise<void> {
    const db = this.config.get('REDIS_DB', { infer: true })
    this.sub = this.connection.createSubscriberClient() as Redis // dedicated connection
    await this.sub.subscribe(`__keyevent@${db}__:expired`)
    const nsPrefix = this.keys.getNamespacePrefix() // e.g. 'cache-example:'
    this.sub.on('message', (_channel, key: string) => {
      if (key.startsWith(nsPrefix)) this.gateway.emitExpired(key) // only our namespace
    })
  }

  async onModuleDestroy(): Promise<void> {
    await this.sub?.quit()
  }
}
```

Requires `notify-keyspace-events Ex` in `redis.conf` (§21). The `/ttl` page shows live countdown
rings; when a key expires, Redis fires the event, the server filters by namespace prefix, and the UI
fades the card out and toasts "Key expired — re-fetching…", then the next read re-populates.

---

## 18 · Lua Scripts & Cache Stampede

### 18.1 Registration

Scripts are declared once as `IScriptDefinition[]` in `options.scripts` and managed by
`ScriptManagerService` (eager `SCRIPT LOAD` on bootstrap → `EVALSHA` with transparent `NOSCRIPT`
reload-retry).

```ts
export const CACHE_SCRIPTS: readonly IScriptDefinition[] = [
  {
    name: 'acquireLock',
    // SET NX PX — returns 1 if the caller won the single-flight lock, else 0.
    lua: `if redis.call('SET', KEYS[1], ARGV[1], 'NX', 'PX', ARGV[2]) then return 1 else return 0 end`,
  },
]
```

### 18.2 The stampede lab

`POST /stampede?productId=42&concurrency=10` fires N concurrent requests for an **uncached** product.
Each calls `cache.eval('acquireLock', ['stampede:42'], [token, lockMs])`:

- the **winner** (returns `1`) fetches the slow origin, populates the cache, releases the lock;
- the **losers** (return `0`) briefly wait, then read the now-populated cache (a hit).

The API returns a timeline (who acquired, who waited, final hit rate); `/stampede` renders it as a
`StampedeTimeline`. `ScriptManagerService.load('acquireLock')` is also exposed (read-only) so the page
can show the script's resolved SHA1.

> 🎓 **Keys are namespaced for you.** `CacheService.eval` runs `KEYS` through the namespace
> (`cache-example:stampede:42`); `ARGV` is passed untouched. The Lua body is declared in code, never
> built from request input (security invariant §24).

---

## 19 · Error Handling

### 19.1 `CacheException`

Extends `HttpException`; carries a readonly `.code` (`CacheErrorCode`) and `.details`. Serializes to
a structured body and maps each code to a canonical HTTP status.

```ts
@Catch(CacheException)
export class CacheExceptionFilter implements ExceptionFilter {
  catch(exception: CacheException, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse()
    res.status(exception.getStatus()).json({
      error: {
        code: exception.code, // e.g. 'cache.flush_disabled_in_production'
        message: CACHE_ERROR_MESSAGES.get(exception.code) ?? exception.message,
        details: exception.details ?? null, // already secret-free by library contract
      },
    })
  }
}
```

### 19.2 Canonical error-code → HTTP table

| Code                                 | HTTP | Triggered in the demo by                             |
| ------------------------------------ | ---- | ---------------------------------------------------- |
| `cache.connection_failed`            | 500  | (observed if Redis is down at boot)                  |
| `cache.command_timeout`              | 504  | `errors-demo` with a tiny `commandTimeout` + slow op |
| `cache.connection_lost`              | 503  | dropping the connection mid-op                       |
| `cache.serialization_failed`         | 500  | `set` of a value the codec cannot encode             |
| `cache.deserialization_failed`       | 500  | reading a deliberately corrupted key                 |
| `cache.invalid_key`                  | 400  | empty prefix/id                                      |
| `cache.invalid_namespace`            | 500  | misconfigured namespace (config-time)                |
| `cache.script_not_registered`        | 500  | `eval` of an unknown script name                     |
| `cache.script_execution_failed`      | 500  | a Lua runtime error                                  |
| `cache.script_registry_missing`      | 500  | `eval` with no script manager wired                  |
| `cache.flush_disabled_in_production` | 403  | `flushNamespace()` with `NODE_ENV=production`        |
| `cache.unsupported_in_cluster`       | 500  | `scan`/`flushNamespace`/`getClient` in cluster mode  |
| `cache.cluster_misconfigured`        | 500  | `mode: 'cluster'` without `cluster.nodes`            |
| `cache.sentinel_misconfigured`       | 500  | `mode: 'sentinel'` without sentinels/name            |
| `cache.shutdown_timeout`             | 500  | `quit()` exceeds `shutdownTimeoutMs`                 |

### 19.3 The Error Explorer

`/errors` lists each code with a "Trigger" button calling `POST /errors/:code`. The page shows the
returned status, the structured body, and the canonical message (from `CACHE_ERROR_MESSAGES`),
typing the response with `CacheErrorCode` from the **shared** subpath. The `flush_disabled_in_production`
row includes a toggle that restarts the API with `NODE_ENV=production` to demonstrate the safety
guard live.

---

## 20 · Observability & Health

### 20.1 Connection lifecycle events (`ICacheEvents`)

```ts
// cache/cache.events.ts — bridges library lifecycle to Logger + the dashboard
@Injectable()
export class CacheEventsBridge {
  private readonly logger = new Logger('Cache')
  constructor(private readonly gateway: EventsGateway) {}

  /** Returns the ICacheEvents bag passed into BymaxCacheModule options. */
  toCacheEvents(): ICacheEvents {
    return {
      onEvent: (event: CacheEventName, data) => {
        if (event === CACHE_EVENT_NAMES.ERROR) this.logger.error(`[cache] ${event}`, data)
        else this.logger.log(`[cache] ${event}`)
        this.gateway.emitConnectionEvent(event, data) // → dashboard status badge
      },
    }
  }
}
```

The Connection page renders a live feed of `connect/ready/error/close/reconnecting/end` events and
derives the `CacheConnectionStatus` badge shown in the topbar.

> 🔒 **Secret-free by contract.** Event `data` carries no secret values (e.g. `{ role: 'main' }`);
> the bridge logs it verbatim safely. A forced disconnect during shutdown surfaces as an `error`
> event with `reason: 'forced_disconnect'` (no `error` field) — the bridge distinguishes it from a
> socket error (which carries an `error` string).

### 20.2 Health

`GET /health` calls `isHealthy()` (never throws → safe for a probe) and `ping()` (round-trip
latency). `GET /admin/info?section=memory|clients|replication` surfaces Redis `INFO`. The topbar
status chip polls `/health` (and is corrected in real time by the lifecycle event feed).

### 20.3 App-level metrics (clearly labelled)

Hit/miss counters are an **application** concern, not a library feature. A small `MetricsService`
tracks per-prefix hits/misses in memory (reset on restart); `GET /metrics` returns them, and the
Overview page charts them. The UI labels this section "app-level metrics" to avoid implying the
library provides them.

### 20.4 Optional `@bymax-one/nest-logger` bridge

The README documents the production pattern of routing `events.onEvent` into
`@bymax-one/nest-logger` instead of the built-in `Logger`. The example keeps the built-in logger by
default (to stay self-contained) but ships the bridge snippet as the recommended approach — a
two-library Bymax integration reference.

---

## 21 · Local Stack & Docker

### 21.1 `docker-compose.yml`

All ports bound to `127.0.0.1`. Default `up` starts Redis only; profiles add the rest.

| Service                               | Image                | Port          | Profile     | Notes                               |
| ------------------------------------- | -------------------- | ------------- | ----------- | ----------------------------------- |
| `redis`                               | `redis:7-alpine`     | `6379`        | _(default)_ | mounts `docker/redis/redis.conf`    |
| `redisinsight`                        | `redis/redisinsight` | `5540`        | `tools`     | native Redis browser                |
| `redis-cluster-*`                     | `redis:7-alpine`     | `7000-7005`   | `cluster`   | 3 masters + 3 replicas              |
| `redis-master`/`replica`/`sentinel-*` | `redis:7-alpine`     | `26379-26381` | `sentinel`  | 1 master + 2 replicas + 3 sentinels |

```bash
pnpm infra:up                         # redis only
pnpm infra:up --profile tools         # + RedisInsight at http://localhost:5540
docker compose --profile cluster up   # optional cluster topology
docker compose --profile sentinel up  # optional sentinel topology
```

### 21.2 `docker/redis/redis.conf`

```conf
# Enable keyspace notifications for the TTL-expiry demo (§17.3).
# E = keyevent stream, x = expired events. Use 'KEA' for everything.
notify-keyspace-events Ex
# (dev) no persistence — keeps the demo fast and disposable
save ""
appendonly no
```

### 21.3 Ports

| Service                | Port   |
| ---------------------- | ------ |
| Web (Next.js)          | `3000` |
| API (NestJS HTTP + WS) | `3001` |
| Redis                  | `6379` |
| RedisInsight (profile) | `5540` |

### 21.4 Local run

```bash
docker compose up -d                 # Redis
pnpm install
pnpm dev                             # api (3001) + web (3000) in parallel
# open http://localhost:3000
```

---

## 22 · Testing Strategy

The example is **not** coverage/mutation-gated (those are the library's gates). It ships a focused,
high-signal suite.

| Layer                | Tool                                                         | Scope                                                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| API E2E (real Redis) | Jest + `@nestjs/testing` + Testcontainers (`redis:7-alpine`) | boots the app against a real Redis; exercises the headline flows: read-through + TTL, namespace isolation + `flushNamespace`, Pub/Sub fan-out, the Lua single-flight, each `CacheException` path |
| API E2E (fast)       | `ioredis-mock` (where real Redis isn't needed)               | data-structure round-trips, serializer comparison                                                                                                                                                |
| Web smoke            | Playwright                                                   | dashboard loads, status badge turns green, an explorer scan renders, a publish round-trips                                                                                                       |
| Web unit             | Vitest + Testing Library                                     | `lib/cache-status.ts` mapping, the **shared-subpath import** resolves in a browser context (matrix #48)                                                                                          |
| Static               | `tsc --noEmit`, ESLint (flat), Prettier `--check`            | strict types + lint clean                                                                                                                                                                        |

> 🎓 The Testcontainers pattern (real `redis:7-alpine` per `beforeAll`, `EVALSHA`/`NOSCRIPT` and
> keyspace-notification paths exercised against a genuine server) mirrors the **library's** own E2E
> approach — so the example's tests also serve as integration coverage for the published package.

---

## 23 · Tooling & Conventions

All inherited verbatim from the Bymax example/library standard (see `nest-logger-example`,
`nest-auth-example`).

### 23.1 Monorepo & scripts

- pnpm workspaces (`packages: ['apps/*']`); `packageManager` pinned; `engines.node >= 24`.
- Root scripts (fan-out via `pnpm -r --if-present`): `dev`, `build`, `typecheck`, `lint`, `format` /
  `format:check`, `test`, `test:cov`, `test:e2e`, and `infra:up` / `infra:down` / `infra:nuke` /
  `infra:logs`. Optional `audit:exports` (matrix CI check, §7).

### 23.2 TypeScript

`tsconfig.base.json` strict baseline: `target ES2023`, `module ESNext`, `moduleResolution Bundler`,
`verbatimModuleSyntax`, plus `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`. `apps/api` adds
`emitDecoratorMetadata`/`experimentalDecorators` (NestJS DI).

### 23.3 Lint / format / git

ESLint 9 flat config (`recommendedTypeChecked` scoped to `*.ts`/`*.tsx`, test files relax
`no-explicit-any`/`no-unsafe-*`, `prettier` last); Prettier (`printWidth 100`, `singleQuote`,
`trailingComma all`, `semi false`, `arrowParens always`); Husky (`pre-commit` → lint-staged,
`commit-msg` → commitlint); **Conventional Commits**; `.gitmessage`; `.nvmrc = 24`;
`.npmrc = frozen-lockfile=true`; `renovate.json` (pin `@bymax-one/nest-cache`).

### 23.4 Documentation & code style

- **No Swagger.** Controllers documented with **JSDoc** (`@param`/`@returns`/`@throws` + the literal
  route line); DTOs validated with **Zod** (`z.object` + `z.infer` type). The dashboard + curl
  journeys (§11.2) are the interactive API surface. _(This matches the sibling examples and is the
  deliberate Bymax convention; it is the single largest divergence from the early `OVERVIEW.md` draft
  and is flagged in the reconciliation table.)_
- **JSDoc everywhere:** a file-header block per file (purpose + layer), and a JSDoc block on every
  exported class/method.
- **English only** in code, comments, and docs.
- **Naming:** files kebab-case with NestJS suffixes (`*.controller.ts`, `*.service.ts`,
  `*.module.ts`, `*.dto.ts`, `*.filter.ts`); React symbols PascalCase; booleans prefixed
  `is`/`has`/`should`/`can`.
- **No suppressions** (`@ts-ignore`/`eslint-disable`/`as any`); no `console.*` in the API (use
  `Logger`).
- **Agent docs:** `CLAUDE.md` (quick reference + non-negotiables + verification commands) and
  `AGENTS.md` (full architecture), mirroring the sibling repos.

---

## 24 · Security & Safety

Even as a local demo, the example models the library's security invariants — they are part of what it
teaches.

- 🔒 **Namespace isolation.** Every key goes through `KeyBuilder`; the one raw-client use
  (foreign-namespace seeding, §12.3) is explicitly labelled as the anti-pattern it demonstrates.
- 🔒 **`flushNamespace` production guard.** `allowFlushInProduction` stays `false`; the demo proves
  the `403` guard rather than disabling it.
- 🔒 **Fail-closed deserialization.** Corrupted payloads throw, never return partial data — shown in
  the Error Explorer.
- 🔒 **No secrets in logs/events.** `REDIS_PASSWORD` is never logged; lifecycle event `data` is
  secret-free by library contract; the exception filter relays `details` (kept small/secret-free by
  the library).
- 🔒 **Lua from trusted source only.** Scripts are declared in code (`IScriptDefinition`), never built
  from request input.
- 🔒 **Loopback-bound Docker.** All container ports bind `127.0.0.1`.
- 🔒 **CORS** restricted to `WEB_ORIGIN`; the API is otherwise unauthenticated _by design_ (NG2) and
  must not be exposed publicly.

---

## 25 · Phased Delivery Plan

High-level phases; the future `docs/DEVELOPMENT_PLAN.md` expands each into a status dashboard and
per-phase `docs/tasks/phase-NN-*.md` files (JIRA-style: task table, acceptance criteria, agent
prompt, completion protocol), matching the sibling examples.

| Phase | Title                         | Key deliverables                                                                                                                         | Features unlocked (matrix #)    |
| ----- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 0     | Repo scaffold                 | pnpm workspace, tsconfig/eslint/prettier/husky, docker-compose (Redis + `redis.conf`), CLAUDE/AGENTS/README stub, LICENSE                | tooling                         |
| 1     | API foundation                | `forRootAsync` wiring, env schema, events bridge, exception filter, health endpoint, EventsGateway skeleton                              | 1–4, 7–8, 10, 29, 41–47         |
| 2     | Catalog + data structures     | catalog, counters, collections; admin scan/keys/info; metrics                                                                            | 13–24, 36, 40                   |
| 3     | Namespace, admin & serializer | tenants (prefix + foreign-namespace), `pipeline`, `flushNamespace`, serializer-demo + `MsgPackSerializer`                                | 11, 25–27, 37–39                |
| 4     | Pub/Sub & TTL events          | `PubSubService` bridge, pattern subs, raw keyspace subscriber                                                                            | 8, 12, 30–33                    |
| 5     | Stampede (Lua)                | script registry, `acquireLock`, eval, timeline API                                                                                       | 9, 28, 34–35                    |
| 6     | Web shell & design system     | Next.js app, copy the four design-system files, shell, status badge, shared-subpath import, api-client, socket                           | 14, 44, 46, 48                  |
| 7     | Web feature pages             | explorer, playground, tenants, pubsub, ttl, stampede, serializer, errors, connection                                                     | 49 + UI for all above           |
| 8     | Topologies & errors           | sentinel/cluster Docker profiles + config; Error Explorer; cluster-restriction demos                                                     | 5–6, 42–43; cluster table §15.4 |
| 9     | Polish & audit                | README (badges, journeys, coverage), `audit:exports` CI check, E2E + Playwright smoke, RedisInsight profile, optional nest-logger bridge | 50; G6                          |

---

## 26 · What This Project Intentionally Excludes

| Excluded                                | Why                                                                                     |
| --------------------------------------- | --------------------------------------------------------------------------------------- |
| Database (PostgreSQL/Prisma)            | would obscure the cache focus; in-memory origin is enough (G5)                          |
| Authentication / JWT                    | out of scope — use `@bymax-one/nest-auth` (NG2)                                         |
| Production deployment (K8s, CD)         | local dev reference, not a prod template (NG1)                                          |
| 100% coverage / mutation gates          | those are the **library's** gates; the example ships a smoke suite (NG4)                |
| Persistent metrics (Prometheus/Grafana) | RedisInsight covers Redis-level metrics; a metrics stack would bloat the example        |
| Swagger / OpenAPI                       | matches the Bymax example convention; JSDoc + dashboard + curl journeys instead (§23.4) |

---

## 27 · References

- **Library** — `@bymax-one/nest-cache` `README.md`, `docs/technical_specification.md`,
  `CHANGELOG.md`, and the shipped type declarations (`dist/server/index.d.ts`,
  `dist/shared/index.d.ts`) — the authority for the API surface used here.
- **Sibling examples** — `nest-logger-example`, `nest-auth-example` (tooling, docs pattern, design
  system, conventions).
- **Design system** — `docs/design_system.html` (shared Bymax UI source of truth + agent recreation
  guide).
- **ioredis** — connection options, Sentinel/Cluster, Pub/Sub semantics.
- **Redis** — keyspace notifications (`notify-keyspace-events`), `SCAN`/`UNLINK`, Lua `EVALSHA`.
- **NestJS 11** — dynamic modules (`ConfigurableModuleBuilder`), WebSocket gateways, lifecycle hooks.
- **Next.js 16 / Tailwind v4 / shadcn** — App Router, `@tailwindcss/postcss`, `new-york` preset.

---

## 28 · Document Status

> **Document version:** 1.0 — initial technical specification, authored before implementation.
> **Library version targeted:** `@bymax-one/nest-cache@0.1.0` (pre-1.0; API verified against shipped
> `.d.ts`). **Project status:** specification only — no application code yet. **Next step:** derive
> `docs/DEVELOPMENT_PLAN.md` from §25, then scaffold `docs/tasks/phase-00-*.md`.
>
> Maintained by **Bymax One** · MIT · This document is the authoritative contract for
> `nest-cache-example`; when it conflicts with the early `docs/OVERVIEW.md` draft, **this file wins**.
