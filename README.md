# nest-cache-example

Reference application for [`@bymax-one/nest-cache`](https://github.com/bymaxone/nest-cache) — a typed Redis cache for NestJS. This repo demonstrates every public export of the library across a NestJS API and a Next.js dashboard.

## Documentation

- [Technical Specification](docs/TECHNICAL_SPECIFICATION.md) — features, architecture, API contracts
- [Development Plan](docs/DEVELOPMENT_PLAN.md) — phased delivery roadmap
- [Dashboard](docs/DASHBOARD.md) — `apps/web` page inventory and design spec

## Connection topologies

The API runs **standalone** by default and can optionally run against a **sentinel**
or **cluster** topology via Docker Compose profiles. `CACHE_MODE` selects which
connection block `cache.config.ts` builds (`standalone | sentinel | cluster`).

```bash
# Standalone (default) — just Redis on 127.0.0.1:6379
docker compose up -d --wait
```

The sentinel and cluster topologies report **internal** addresses, so a host
process (the API started with `pnpm --filter api start`) reaches them through an
ioredis `natMap` that rewrites those to the published `127.0.0.1` ports
(see `TECHNICAL_SPECIFICATION.md` §15.2). The natMap env is **opt-in** — standalone
and production wiring never set it.

```bash
# Sentinel — 1 master + 2 replicas + 3 sentinels
docker compose --profile sentinel up -d --wait
CACHE_MODE=sentinel \
REDIS_SENTINELS=127.0.0.1:26379,127.0.0.1:26380,127.0.0.1:26381 \
REDIS_SENTINEL_MASTER=mymaster \
REDIS_SENTINEL_NAT_MAP="redis-master:6379=127.0.0.1:6380" \
pnpm --filter api start
```

```bash
# Cluster — 3 cluster-enabled primaries (auto-formed by the cluster-init service)
docker compose --profile cluster up -d --wait
CACHE_MODE=cluster \
REDIS_CLUSTER_NODES=127.0.0.1:7000,127.0.0.1:7001,127.0.0.1:7002 \
REDIS_CLUSTER_NAT_MAP="172.31.0.11:7000=127.0.0.1:7000,172.31.0.12:7001=127.0.0.1:7001,172.31.0.13:7002=127.0.0.1:7002" \
pnpm --filter api start
```

In **cluster** mode `scan`, `flushNamespace`, and `getClient` throw
`cache.unsupported_in_cluster` (HTTP 500) — the admin endpoints that use them
surface it cleanly through the global exception filter. `eval` requires ≥1 key
(routed by slot), and Pub/Sub is an experimental passthrough (`TECHNICAL_SPECIFICATION.md` §15.4).

> **macOS / Docker Desktop note:** seeds use `127.0.0.1` (not `localhost`) because
> the cluster client does not force IPv4, and `localhost` can resolve to `::1`
> which the IPv4-only published ports do not answer.

## Error surface

`POST /errors/:code` triggers each of the 15 `CACHE_ERROR_CODES` so the global
`CacheExceptionFilter` can be observed mapping every code to its canonical HTTP
status and `{ error: { code, message, details } }` body (`:code` accepts the
snake suffix `invalid_key` or the full `cache.invalid_key`). Request-reachable
codes are raised through the real library API; boot/topology-only codes are
tagged `details.simulated: true`.

## Status

The NestJS API is implemented — cache feature surface, admin/Explorer, namespaces &
tenants, serialization, Pub/Sub, TTL events, cache-stampede, connection topologies, and
the error surface. The Next.js dashboard and the end-to-end test suite are in progress.
