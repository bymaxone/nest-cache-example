<h1 align="center">nest-cache-example</h1>

<p align="center">
  The canonical reference application for <a href="https://github.com/bymaxone/nest-cache"><code>@bymax-one/nest-cache</code></a> —
  a typed Redis cache module for NestJS, exercised end to end across a NestJS API and a Next.js dashboard that makes
  the invisible parts of caching (namespace isolation, TTL expiry, Pub/Sub fan-out, single-flight) tangible on screen.
</p>

<p align="center">
  <img alt="@bymax-one/nest-cache" src="https://img.shields.io/badge/%40bymax--one%2Fnest--cache-0.1.0-000000?style=flat-square" />
  <img alt="Node" src="https://img.shields.io/badge/Node-%3E%3D24-000000?style=flat-square&logo=node.js&logoColor=white" />
  <img alt="pnpm" src="https://img.shields.io/badge/pnpm-%3E%3D10.8-000000?style=flat-square&logo=pnpm&logoColor=white" />
  <img alt="NestJS" src="https://img.shields.io/badge/NestJS-11-000000?style=flat-square&logo=nestjs&logoColor=white" />
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/React-19-000000?style=flat-square&logo=react&logoColor=white" />
  <img alt="Redis" src="https://img.shields.io/badge/Redis-7-000000?style=flat-square&logo=redis&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-000000?style=flat-square&logo=typescript&logoColor=white" />
  <img alt="License" src="https://img.shields.io/badge/License-MIT-000000?style=flat-square" />
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

## 🛰️ Endpoints

The API runs on **`http://localhost:3001`**. Routes grouped by area — this is a
summary; the full catalogue with request/response contracts lives in
**[TECHNICAL_SPECIFICATION.md §11](docs/TECHNICAL_SPECIFICATION.md)**.

| Area            | Method + path                                                                                                                                 | Purpose                                                                    |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Catalog**     | `GET /catalog/products` · `GET /catalog/products/:id` · `GET /catalog/products/:id/ttl` · `POST /catalog/products/:id/{seed,expire,persist}`  | Read-through cache (miss→hit), remaining TTL, `setNx` seed, expire/persist |
| **Counters**    | `GET /counters/:id/views` · `POST /counters/:id/views/incr` · `POST /counters/:id/stock/decr`                                                 | Atomic numeric `incr`/`decr`                                               |
| **Collections** | `GET/POST/DELETE /collections/:id/cart[...]` · `GET/POST/DELETE /collections/:id/tags[...]`                                                   | Hashes (carts) and sets (tags)                                             |
| **Metrics**     | `GET /metrics`                                                                                                                                | App-level hit/miss counters (per prefix)                                   |
| **Admin**       | `GET /admin/{info,keyspace,keys,keys/:key}` · `POST /admin/{seed,keys/:key/persist,keys/:key/expire}` · `DELETE /admin/{keys/:key,namespace}` | Explorer backend — SCAN/KEYS, INFO, per-key ops, namespace flush           |
| **Tenants**     | `GET /tenants/:t/products/:id` · `DELETE /tenants/:t/cache` · `POST /tenants/{seed-foreign,prove-isolation}`                                  | Prefix-scoped tenant reads + cross-namespace isolation proof               |
| **Serializer**  | `POST /serializer/{roundtrip,caveat}` · `GET /serializer/active`                                                                              | Default JSON vs custom MessagePack codec + the active codec name           |
| **Pub/Sub**     | `POST /pubsub/publish` · `POST/DELETE /pubsub/subscribe` · `POST /pubsub/throw`                                                               | Exact/pattern subscribe, publish fan-out, handler-error isolation          |
| **TTL Events**  | `POST /ttl-events/seed`                                                                                                                       | Seed a short-TTL key and observe the `expired` keyspace event              |
| **Stampede**    | `POST /stampede?productId=&concurrency=&lockMs=`                                                                                              | Single-flight burst — N contenders → 1 origin fetch + (N−1) hits           |
| **Errors**      | `POST /errors/:code`                                                                                                                          | Trigger any of the 15 `CacheException` codes and read its HTTP mapping     |
| **Health**      | `GET /health`                                                                                                                                 | Probe-safe liveness + round-trip latency                                   |

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

## ✅ Feature coverage

The spec's **[§7 Feature Coverage Matrix](docs/TECHNICAL_SPECIFICATION.md#7--feature-coverage-matrix)** is the
contract: **all 50 rows** — every public export of the `.` and `/shared` subpaths plus each documented behavior — are
demonstrated somewhere under `apps/`. `scripts/audit-library-exports.mjs` (run via `pnpm audit:exports`, gated in CI
as `export-usage-check`) parses the library's shipped `.d.ts` and fails if any export is neither referenced in `apps/`
nor listed in [`.audit-ignore.json`](.audit-ignore.json) with a stated reason.

| Group                          | Demonstrated in                                                                 | Matrix rows |
| ------------------------------ | ------------------------------------------------------------------------------- | ----------- |
| Module wiring & options        | `cache/cache.module.ts` · `cache/cache.config.ts`                               | #1–#10      |
| Read-through & data structures | `catalog/**` · `counters/**` · `collections/**`                                 | #11–#22     |
| Namespaces & tenants           | `tenants/**` · `admin/**`                                                       | #23–#28     |
| Serialization                  | `serializer-demo/**` · `cache/msgpack.serializer.ts`                            | #29–#33     |
| Pub/Sub & real-time            | `pubsub/**` · `events/**`                                                       | #34–#38     |
| TTL keyspace events            | `ttl-events/**`                                                                 | #39–#40     |
| Lua & cache stampede           | `stampede/**` · `cache/scripts/**`                                              | #41–#43     |
| Topologies & error surface     | `cache/cache.config.ts` · `common/cache-exception.filter.ts` · `errors-demo/**` | #44–#49     |
| Optional logger bridge         | `cache/cache.events.ts` (documented — see below)                                | #50         |

> Two internal DI tokens (`BYMAX_CACHE_OPTIONS`, `BYMAX_CACHE_EVENTS`) are configured through
> `BymaxCacheModuleOptions` rather than re-injected, so they are listed in `.audit-ignore.json` with a reason — the
> audit still echoes them so they never disappear silently.

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

## 🧑‍💻 Try it with curl

Reproduce the three headline behaviors from a terminal — no dashboard required.
The API is on `http://localhost:3001`; `jq` is optional but makes the JSON
readable. Bring the stack up first (`pnpm infra:up && pnpm --filter api dev`).

**1 · Miss → hit.** The first read populates the cache from the slow origin; the
second is served from Redis. Watch `time_total` drop and the metrics counter move.

```bash
# First read — a cache MISS, pays the ~simulated origin latency.
curl -s -w '\n⏱  %{time_total}s\n' http://localhost:3001/catalog/products/p1

# Second read — a cache HIT, served from Redis (noticeably faster).
curl -s -w '\n⏱  %{time_total}s\n' http://localhost:3001/catalog/products/p1

# The per-prefix hit/miss counters reflect the miss then the hit.
curl -s http://localhost:3001/metrics | jq '.prefixes'
```

**2 · Stampede collapse.** Fire N concurrent contenders at one uncached product.
Exactly one wins the Lua `SET NX PX` lock and fetches the origin; the rest read
the value it caches — N misses collapse into **1 origin fetch + (N−1) hits**.

```bash
# 10 concurrent requests for the same key; one lock winner, nine waiters.
seq 10 | xargs -P 10 -I{} curl -s -o /dev/null \
  -X POST 'http://localhost:3001/stampede?productId=p2&concurrency=10&lockMs=2000'

# Inspect the timeline of a single burst (1 originFetch:true + 9 hits) + script SHA1.
curl -s -X POST 'http://localhost:3001/stampede?productId=p3&concurrency=10&lockMs=2000' \
  | jq '{summary, scriptSha1, timeline: .timeline | length}'
```

**3 · Cross-namespace isolation.** Plant a foreign-namespace key via the raw
client (the documented **anti-pattern** — real code never writes outside its
namespace), flush `cache-example:*`, and prove the foreign key survived.

```bash
# Plant `other-app:demo` OUTSIDE this instance's namespace (raw client).
curl -s -X POST http://localhost:3001/tenants/seed-foreign | jq

# Seed a cache-example key so the flush has something to delete.
curl -s -X POST http://localhost:3001/catalog/products/p4/seed >/dev/null

# Flush every `cache-example:*` key (SCAN + UNLINK) — returns the deleted count.
curl -s -X DELETE http://localhost:3001/admin/namespace | jq

# Consolidated proof: the foreign key survived the namespace flush.
curl -s -X POST http://localhost:3001/tenants/prove-isolation | jq
# → { "flushedNamespaceKeys": <n>, "foreignKeySurvived": true }
```

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

## 🪵 Optional: structured logging via `@bymax-one/nest-logger`

> **This is OPTIONAL.** The example runs with the plain Nest `Logger` and has **no**
> hard dependency on `@bymax-one/nest-logger`. This is the recommended production
> upgrade — it is **[§7 matrix](docs/TECHNICAL_SPECIFICATION.md#7--feature-coverage-matrix) row #50**.

`@bymax-one/nest-cache` emits connection-lifecycle events through the optional
`ICacheEvents.onEvent` callback. This repo's [`CacheEventsBridge`](apps/api/src/cache/cache.events.ts)
routes them to the Nest `Logger` and the dashboard. In production you would route the
same events through `@bymax-one/nest-logger` for structured, correlation-aware logs —
the level mapped from the event, the payload attached as structured fields:

```ts
// Production variant of CacheEventsBridge — OPTIONAL, requires @bymax-one/nest-logger.
import { Injectable } from '@nestjs/common'
import { InjectLogger, PinoLoggerService } from '@bymax-one/nest-logger'
import type { ICacheEvents } from '@bymax-one/nest-cache'
import { CACHE_EVENT_NAMES, type CacheEventName } from '@bymax-one/nest-cache/shared'

@Injectable()
export class CacheEventsBridge {
  constructor(@InjectLogger('Cache') private readonly logger: PinoLoggerService) {}

  toCacheEvents(): ICacheEvents {
    return {
      onEvent: (event: CacheEventName, data: Record<string, unknown>) => {
        // Event severity → log level; the secret-free `data` becomes structured fields.
        if (event === CACHE_EVENT_NAMES.ERROR) {
          this.logger.errorStructured('CACHE_CONNECTION_ERROR', data, undefined, data)
        } else {
          this.logger.info('CACHE_CONNECTION_EVENT', event, undefined, data)
        }
      },
    }
  }
}
```

Wire `BymaxLoggerModule` at bootstrap exactly as the sibling
**[nest-logger-example](https://github.com/bymaxone/nest-logger-example)** shows — that
repo is the full reference for the logger library's API (`@InjectLogger`, `PinoLoggerService`,
context labels, redaction, OTel mixin).

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
