# nest-cache-example — Design Overview

> [!WARNING]
> **SUPERSEDED — historical draft, do not implement from this file.**
> This early overview has been replaced by the authoritative planning docs:
> [`TECHNICAL_SPECIFICATION.md`](TECHNICAL_SPECIFICATION.md) (product spec — 28 sections + 50-row Feature Coverage Matrix),
> [`DEVELOPMENT_PLAN.md`](DEVELOPMENT_PLAN.md) (17-phase roadmap) and [`DASHBOARD.md`](DASHBOARD.md) (UI spec).
> Several details below are known to be out of date — endpoint paths, the `cache-admin/`/`products/` module
> layout, Swagger usage (the project is deliberately **no-Swagger**), the namespace-per-tenant model,
> the single-channel socket bridge, the page list, and the RedisInsight port. Kept for history only;
> the spec carries the corrected design.

> Reference application demonstrating `@bymax-one/nest-cache` — typed Redis cache for NestJS.
> Status: **superseded — see [`TECHNICAL_SPECIFICATION.md`](TECHNICAL_SPECIFICATION.md)**

---

## Goals

1. Show every public feature of `@bymax-one/nest-cache` in a runnable, realistic scenario.
2. Make invisible features *visible* — namespace isolation, TTL expiry, Pub/Sub events, and
   atomic Lua scripts are hard to appreciate from a README; a live dashboard makes them tangible.
3. Serve as the canonical integration reference for Bymax projects that consume the library.

---

## Repository structure

```
nest-cache-example/
├── apps/
│   ├── api/                         # NestJS application
│   │   ├── src/
│   │   │   ├── app.module.ts        # wires CacheModule.forRootAsync
│   │   │   ├── cache-admin/         # REST endpoints for namespace inspection
│   │   │   │   ├── cache-admin.module.ts
│   │   │   │   ├── cache-admin.controller.ts
│   │   │   │   └── cache-admin.service.ts
│   │   │   ├── products/            # realistic domain: product catalogue
│   │   │   │   ├── products.module.ts
│   │   │   │   ├── products.controller.ts
│   │   │   │   └── products.service.ts
│   │   │   ├── tenants/             # namespace isolation demo
│   │   │   │   ├── tenants.module.ts
│   │   │   │   ├── tenants.controller.ts
│   │   │   │   └── tenants.service.ts
│   │   │   └── events/              # WebSocket gateway for Pub/Sub
│   │   │       ├── events.module.ts
│   │   │       └── events.gateway.ts
│   │   ├── test/
│   │   │   ├── app.e2e-spec.ts
│   │   │   └── jest-e2e.json
│   │   ├── .env.example
│   │   └── package.json
│   └── web/                         # Next.js 16 dashboard
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx             # home → links to the 3 demo pages
│       │   ├── explorer/
│       │   │   └── page.tsx         # namespace + key explorer
│       │   ├── pubsub/
│       │   │   └── page.tsx         # live Pub/Sub event feed
│       │   └── demo/
│       │       └── page.tsx         # multi-tenant + TTL countdown demo
│       ├── components/
│       │   ├── NamespaceTree.tsx    # renders namespace hierarchy
│       │   ├── KeyCard.tsx          # key + TTL countdown badge
│       │   ├── EventFeed.tsx        # scrolling Pub/Sub event list
│       │   └── TenantSplit.tsx      # side-by-side tenant comparison
│       ├── lib/
│       │   ├── api.ts               # typed fetch wrapper for api/
│       │   └── socket.ts            # socket.io-client setup
│       └── package.json
├── docker/
│   ├── redis/
│   │   └── redis.conf               # enable keyspace notifications (for TTL events)
│   └── redisinsight/                # optional: RedisInsight preconfigured
├── docker-compose.yml               # Redis 7 + optional RedisInsight (port 8001)
├── pnpm-workspace.yaml
├── package.json                     # root — workspace scripts
├── tsconfig.base.json
├── eslint.config.mjs
└── docs/
    ├── OVERVIEW.md                  # this file
    └── DEVELOPMENT_PLAN.md          # phased delivery plan (TBD)
```

---

## Tech stack

| Layer | Technology | Notes |
|---|---|---|
| Cache library | `@bymax-one/nest-cache` | the lib under demonstration |
| API runtime | NestJS 11 + Node.js 24 | no database — keeps infra minimal |
| Real-time | `@nestjs/websockets` + socket.io | streams Pub/Sub events to the browser |
| Frontend | Next.js 16 + React 19 + Tailwind 4 | minimal — no auth, no ORM |
| Redis | Redis 7 (Docker) | keyspace notifications enabled |
| Dev tooling | pnpm workspaces, TypeScript strict, ESLint 9 | same as other Bymax monorepos |
| Optional UI | RedisInsight (Docker, port 8001) | native Redis browser for power users |

No database (PostgreSQL) needed — the API uses in-memory data stores for the demo domain,
keeping the `docker-compose.yml` to Redis only.

---

## Demo scenarios

### 1. Namespace isolation (multi-tenant)

**What is shown:** Two simulated tenants (`tenant-a`, `tenant-b`) request the same product.
Each tenant's cache lives under its own namespace (`tenant-a:products:*`,
`tenant-b:products:*`). Flushing tenant-a's namespace does not affect tenant-b.

**UI:** `TenantSplit` component — two side-by-side panels, each showing cached keys,
hit/miss badge, and a "Flush namespace" button that only clears its own side.

**API endpoints used:**
```
GET    /tenants/:tenantId/products/:id   # reads from / writes to namespaced cache
DELETE /tenants/:tenantId/cache          # flushNamespace for that tenant only
```

---

### 2. TTL countdown

**What is shown:** A product is fetched and cached with a 30-second TTL. The dashboard
shows a live countdown badge. When the key expires, it disappears from the explorer and
the next GET re-fetches and re-caches it (showing the miss + re-populate flow).

**UI:** `KeyCard` component — TTL displayed as a circular progress ring that drains to zero.
On expiry, card fades out and a "Key expired — re-fetching…" toast appears.

**How TTL is pushed to the browser:** Redis keyspace notifications (`KEg`) fire a
`del` event when a key expires. The API subscribes via `CacheService.subscribe` and
re-emits the event over the WebSocket gateway. The web client updates the UI in real time
without polling.

---

### 3. Pub/Sub live feed

**What is shown:** Any client can publish a message to a channel; all connected browser
tabs receive it instantly.

**UI:** `EventFeed` component — scrolling list of events with channel name, payload
(truncated), and timestamp. A "Publish" form lets the user type a channel and message
directly from the browser.

**How it works:**
- `POST /events/publish` → `CacheService.publish(channel, payload)`
- `EventsGateway` subscribes to the same channel via `CacheService.subscribe` and
  emits a `cache:event` socket message to all connected clients
- `socket.ts` on the web side listens for `cache:event` and appends to the feed state

---

### 4. Cache stampede prevention (Lua script)

**What is shown:** Ten concurrent requests arrive for the same uncached product.
Without protection, all ten would hit the origin. The demo shows how a Lua-based
atomic lock (via `ScriptManager`) ensures only one request fetches while the others
wait and then read from cache.

**UI:** `StampedeDemo` component — a "Fire 10 requests" button, then a timeline showing
which request acquired the lock, which ones waited, and the final hit rate.

**API endpoint:**
```
POST /demo/stampede?productId=42&concurrency=10
```

Returns a log of events (lock acquired, lock waited, cache hit) that the UI renders
as a timeline chart.

---

### 5. Health + metrics

**What is shown:** The library's `HealthService` integration — Redis connectivity, latency,
and a simple hit/miss counter tracked in the API process.

**UI:** Top navigation bar shows a Redis status badge (green / red) with round-trip latency.
A "Metrics" sidebar card shows cumulative hit/miss counts per namespace as a bar chart.

**API endpoint:**
```
GET /health          # Redis ping latency + connection status
GET /metrics         # hit/miss counters per namespace (in-memory, reset on restart)
```

---

## API — admin endpoints (`cache-admin`)

These endpoints are the bridge between the NestJS app and the dashboard. They are
**not part of `@bymax-one/nest-cache`** — they are application-level endpoints that
demonstrate how to build a cache admin layer on top of the library.

```
GET    /admin/namespaces                   # list all known namespaces
GET    /admin/namespaces/:ns/keys          # list keys in a namespace (with TTL)
GET    /admin/namespaces/:ns/keys/:key     # get a single value (deserialized)
DELETE /admin/namespaces/:ns/keys/:key     # delete a single key
DELETE /admin/namespaces/:ns              # flush entire namespace
GET    /health                            # Redis health (ping latency, connected)
GET    /metrics                           # hit/miss counters per namespace
POST   /events/publish                    # publish a Pub/Sub message
POST   /demo/stampede                     # trigger stampede demo
```

Swagger UI is enabled at `/api` (SwaggerModule). All endpoints are documented with
`@ApiOperation`, `@ApiResponse`, and example payloads.

---

## What this project intentionally does NOT include

| Excluded | Why |
|---|---|
| Database (PostgreSQL, Prisma) | Would obscure the cache focus; in-memory data is enough |
| Authentication / JWT | Out of scope — use `@bymax-one/nest-auth` for that |
| Production deployment (Kubernetes, CI/CD publish) | This is a local dev reference, not a prod template |
| Real-time metrics persistence (Prometheus, Grafana) | RedisInsight covers Redis-level metrics; a Grafana stack would bloat the example |
| Test coverage / mutation gates | Example apps don't need 100% coverage — a basic E2E smoke suite is enough |

---

## Local development

```bash
# 1. Start Redis
docker compose up -d redis

# 2. (Optional) Start RedisInsight at http://localhost:8001
docker compose --profile tools up -d redisinsight

# 3. Install deps
pnpm install

# 4. Start API (port 3000) + web dashboard (port 3001) concurrently
pnpm dev

# 5. Open http://localhost:3001 — dashboard
#    Open http://localhost:3000/api — Swagger UI
```

`.env.example` (api):
```
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
CACHE_DEFAULT_TTL=60
CACHE_NAMESPACE_PREFIX=cache-example
```

---

## Relation to `@bymax-one/nest-cache`

This example imports the library as a versioned npm package:

```json
"@bymax-one/nest-cache": "^0.x.x"
```

It is **not** a monorepo workspace that includes the library source. This mirrors how
real consumers install the package, ensuring the example validates the published API
rather than the local build.

When testing against an unpublished local build, use `pnpm link`:
```bash
cd ../nest-cache && pnpm build && pnpm link --global
cd ../nest-cache-example && pnpm link --global @bymax-one/nest-cache
```

---

## Phased delivery

A detailed `DEVELOPMENT_PLAN.md` with task-level breakdown will be added before
implementation begins. The phases at a high level:

| Phase | Deliverable |
|---|---|
| 0 | Repo scaffold — toolchain, docker-compose, pnpm workspace |
| 1 | API foundation — CacheModule wired, health endpoint, Swagger |
| 2 | Products domain — GET with TTL cache, cache-admin endpoints |
| 3 | Namespace isolation — tenant endpoints + flush |
| 4 | Pub/Sub — EventsGateway + WebSocket bridge |
| 5 | Web dashboard — Next.js app, Explorer + Pub/Sub feed pages |
| 6 | TTL countdown — keyspace notifications → WebSocket → UI |
| 7 | Stampede demo — Lua script + StampedeDemo UI |
| 8 | Metrics + health bar — hit/miss counters + Redis status badge |
| 9 | Polish — README, Swagger examples, docker-compose --profile tools |
