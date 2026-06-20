<h1 align="center">nest-cache-example</h1>

<p align="center">
  The canonical reference application for <a href="https://github.com/bymaxone/nest-cache"><code>@bymax-one/nest-cache</code></a> —
  a typed Redis cache module for NestJS, exercised end to end across a NestJS API and a Next.js dashboard that makes
  the invisible parts of caching (namespace isolation, TTL expiry, Pub/Sub fan-out, single-flight) tangible on screen.
</p>

<p align="center">
  <img alt="library" src="https://img.shields.io/badge/%40bymax--one%2Fnest--cache-%5E0.1.0-6E56CF" />
  <img alt="license" src="https://img.shields.io/badge/license-MIT-green" />
  <img alt="typescript" src="https://img.shields.io/badge/TypeScript-strict-3178C6" />
  <img alt="node" src="https://img.shields.io/badge/Node-%3E%3D24-339933" />
  <img alt="nestjs" src="https://img.shields.io/badge/NestJS-11-E0234E" />
  <img alt="next" src="https://img.shields.io/badge/Next.js-16-000000" />
  <img alt="react" src="https://img.shields.io/badge/React-19-61DAFB" />
  <img alt="redis" src="https://img.shields.io/badge/Redis-7-DC382D" />
  <img alt="tailwind" src="https://img.shields.io/badge/Tailwind-4-06B6D4" />
  <img alt="socketio" src="https://img.shields.io/badge/Socket.IO-4-010101" />
  <img alt="coverage" src="https://img.shields.io/badge/coverage-100%25-brightgreen" />
  <img alt="mutation" src="https://img.shields.io/badge/Stryker%20mutation-api%20100%25%20%C2%B7%20web%2091.61%25-brightgreen" />
</p>

<p align="center">
  <a href="https://github.com/bymaxone/nest-cache">📦 Library</a> ·
  <a href="#-quick-start">🚀 Quick Start</a> ·
  <a href="#-whats-inside">✅ Features</a> ·
  <a href="#-architecture">🏗️ Architecture</a> ·
  <a href="#-connection-topologies">🔌 Topologies</a> ·
  <a href="docs/TECHNICAL_SPECIFICATION.md">📖 Docs</a>
</p>

---

## ✨ Overview

`@bymax-one/nest-cache` is the **what**; this repository is the **how**. It is a runnable, production-shaped demo
that exercises **every public export** of the library across a NestJS API and a first-class Next.js observability
dashboard — read-through caching, namespace/tenant isolation, custom serialization, Pub/Sub, TTL keyspace events,
Lua single-flight, the full connection-topology matrix, and the Cache Admin (Explorer) backend — all against a real
Redis 7. The demo domain is an in-memory multi-tenant product catalogue, chosen because it naturally exercises
strings, numerics, hashes, sets, batch pipelines, SCAN, and TTL.

### 🚀 Quick start

```bash
git clone https://github.com/bymaxone/nest-cache-example.git
cd nest-cache-example
pnpm install
pnpm infra:up            # Redis 7 on 127.0.0.1:6379  (add --profile tools for RedisInsight :5540)
pnpm dev                 # api → http://localhost:3001 · web → http://localhost:3000
```

> The library is **pre-publish** — it is consumed via a local `file:` link to the sibling `../nest-cache` checkout
> until it ships to npm. Build that checkout first (`cd ../nest-cache && pnpm install && pnpm build`).

> No `.env` is required — every variable is defaulted for local standalone Redis. Override via `apps/api/.env`
> (see [`apps/api/.env.example`](apps/api/.env.example)); `CACHE_MODE` switches the topology and
> `CACHE_SERIALIZER=msgpack` swaps in the binary codec.

---

## 🔥 What's inside

**Read-through & data structures**

- ✅ Read-through catalog (`get`/`set`), batch `mget`/`mset`, `setNx` seed, and TTL ops (`expire` / `persist` / `ttl`)
- ✅ Atomic numerics (`incr`/`decr`), hashes (carts), and sets (tags) — every structure the typed facade exposes

**Namespaces & multi-tenancy**

- ✅ One `namespace` per instance; tenants modeled as prefix scoping (`cache-example:tenant:{id}:…`)
- ✅ `flushNamespace()` (SCAN + UNLINK) with a live isolation proof — a foreign-namespace key survives the flush

**Serialization**

- ✅ Default `JsonSerializer` + a custom MessagePack `ISerializer` (opt-in via `CACHE_SERIALIZER=msgpack`)
- ✅ `getRaw`/`setRaw` codec-bypass contrast; the active codec injected via the `BYMAX_CACHE_SERIALIZER` token

**Pub/Sub & real-time**

- ✅ Exact + pattern subscribe (`subscribe` / `psubscribe`), ref-counted unsubscribe, handler-error isolation
- ✅ A socket.io bridge fans Redis events out to every browser tab over 3 multiplexed channels (receive-only)

**TTL keyspace events**

- ✅ The library's documented escape hatch — a dedicated raw subscriber on `__keyevent@<db>__:expired`, namespace-filtered
- ✅ A live countdown wall: seed a short-TTL key, watch the ring drain and the `cache:expired` event arrive

**Lua & cache stampede**

- ✅ Single-flight collapse: N concurrent contenders → **1 origin fetch + (N−1) cache hits** via a `SET NX PX` Lua lock
- ✅ Token-safe release (compare-and-delete) and the stable script SHA1 resolved through `ScriptManagerService`

**Connection & error surface**

- ✅ Standalone · Sentinel · Cluster topologies (Docker Compose profiles) with an ioredis `natMap` for NAT'd stacks
- ✅ All 15 `CacheException` codes mapped to their canonical HTTP status by a single global exception filter

**Cache Admin / Explorer backend**

- ✅ `scan` (non-blocking cursor) vs `keys` (O(N), guarded), pipeline bulk seed, parsed Redis `INFO`, keyspace breakdown
- ✅ Per-key inspect / delete / persist / expire — the backend behind the dashboard's Key Explorer

**The dashboard (`apps/web`)**

- ✅ 10 pages — Overview · Explorer · Playground · Tenants · Pub/Sub · TTL Live · Stampede · Serializer · Errors · Connection
- ✅ Recharts golden-signal panels, custom-SVG TTL rings + stampede swimlane, `nuqs` URL state, library-clean bundle

**Quality bar**

- ✅ **100% unit coverage** (api Jest + web Vitest) · **E2E of every HTTP + WebSocket flow** (Testcontainers)
- ✅ **Stryker mutation** — api **100%** (0 survivors) · web **91.61%** (`lib/**` 100%) · **18 Playwright journeys**
- ✅ No Swagger (JSDoc + Zod DTOs) · English-only · Conventional Commits · zero suppression comments

---

## 🏗️ Architecture

```
   apps/web (Next.js 16 · React 19 · Tailwind 4)
   10 dashboard pages — Observe · Real-time · Labs · System
   imports @bymax-one/nest-cache/shared (zero-dep) → typed error codes + connection status
        │ REST (fetch → ApiResult<T>)               ▲ socket.io (3 channels: connection · event · expired)
        ▼                                            │
   ┌─────────────────────────────────────────────────┴────────────────┐
   │ apps/api (NestJS 11)                                              │
   │ BymaxCacheModule.forRootAsync → buildCacheOptions(env)            │
   │ read-through · namespaces/tenants · serialization · Pub/Sub ·     │
   │ TTL events · Lua single-flight · Cache Admin · exception filter   │
   └───────────────────────────────┬──────────────────────────────────┘
                                    │ ioredis 5
                                    ▼
                          ┌─────────────────────┐
                          │       Redis 7       │   standalone (default)
                          │   127.0.0.1:6379    │   · sentinel · cluster (compose profiles)
                          └─────────────────────┘
                          RedisInsight :5540  (docker compose --profile tools)
```

`apps/api` and `apps/web` are independently deployable. The web bundle imports only the zero-dependency
`@bymax-one/nest-cache/shared` subpath (proving `@nestjs`/`ioredis` never leak into the browser) and bridges live
Redis events to the dashboard over socket.io. Full diagram and API contracts in
**[docs/TECHNICAL_SPECIFICATION.md](docs/TECHNICAL_SPECIFICATION.md)**.

> **Coverage rule.** Every public export of `@bymax-one/nest-cache` (the `.` and `/shared` subpaths) is referenced
> from at least one file under `apps/` — the spec's Feature Coverage Matrix maps each one to where it is used, and an
> export-usage audit enforces it.

---

## 🔌 Connection topologies

The API runs **standalone** by default and can run against **sentinel** or **cluster** via Docker Compose profiles.
`CACHE_MODE` selects which connection block `cache.config.ts` builds. Sentinel and cluster report _internal_
addresses, so a host process reaches them through an ioredis `natMap` that rewrites those to the published
`127.0.0.1` ports — the natMap env is opt-in (standalone and production never set it).

```bash
# Standalone (default) — just Redis on 127.0.0.1:6379
pnpm infra:up

# Sentinel — 1 master + 2 replicas + 3 sentinels
docker compose --profile sentinel up -d --wait
CACHE_MODE=sentinel REDIS_SENTINELS=127.0.0.1:26379,127.0.0.1:26380,127.0.0.1:26381 \
REDIS_SENTINEL_MASTER=mymaster REDIS_SENTINEL_NAT_MAP="redis-master:6379=127.0.0.1:6380" \
pnpm --filter api start

# Cluster — 3 cluster-enabled primaries (auto-formed by the cluster-init service)
docker compose --profile cluster up -d --wait
CACHE_MODE=cluster REDIS_CLUSTER_NODES=127.0.0.1:7000,127.0.0.1:7001,127.0.0.1:7002 \
REDIS_CLUSTER_NAT_MAP="172.31.0.11:7000=127.0.0.1:7000,172.31.0.12:7001=127.0.0.1:7001,172.31.0.13:7002=127.0.0.1:7002" \
pnpm --filter api start
```

In **cluster** mode `scan`, `flushNamespace`, and `getClient` raise `cache.unsupported_in_cluster` — the admin
endpoints that use them surface it cleanly through the exception filter; `eval` requires ≥1 key (routed by slot) and
Pub/Sub is an experimental passthrough. See **[TECHNICAL_SPECIFICATION.md §15](docs/TECHNICAL_SPECIFICATION.md)**.

---

## 🧪 Tests

```bash
pnpm test           # unit — api (Jest) + web (Vitest), 100% coverage gate
pnpm test:e2e       # E2E — api flows (Testcontainers redis:7) + web journeys (Playwright, self-booting stack)
pnpm mutation       # Stryker — api break:100 · web break:90 (serialized; reports under reports/mutation/)
pnpm lint && pnpm typecheck && pnpm format:check
```

The web E2E auto-boots its own stack (a dedicated test Redis via `docker-compose.test.yml` + the API + the
dashboard) through Playwright's `webServer`, so `pnpm test:e2e:web` is self-contained. Mutation results by feature
group are in **[docs/stryker/HISTORY.md](docs/stryker/HISTORY.md)**.

---

## 📖 Documentation

| Doc                                                                | What it covers                                                          |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| [TECHNICAL_SPECIFICATION](docs/TECHNICAL_SPECIFICATION.md)         | Architecture, API contracts & the feature-coverage matrix (master spec) |
| [DASHBOARD](docs/DASHBOARD.md)                                     | The `apps/web` observability console — page inventory & design spec     |
| [DEVELOPMENT_PLAN](docs/DEVELOPMENT_PLAN.md)                       | The phased build plan & quality gates (Appendix C)                      |
| [stryker/HISTORY](docs/stryker/HISTORY.md)                         | Mutation run history + final scores by feature group                    |
| [stryker/IMPLEMENTATION_PLAN](docs/stryker/IMPLEMENTATION_PLAN.md) | Mutation hardening order, stack gotchas & equivalent-mutants table      |

---

## License

MIT © Bymax One. `@bymax-one/nest-cache` is MIT © Bymax One. See [LICENSE](LICENSE).
