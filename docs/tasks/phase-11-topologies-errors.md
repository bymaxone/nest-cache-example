# Phase 11 — Connection Topologies & Error Surface — Tasks

> **Source:** [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#phase-11--connection-topologies--error-surface) §Phase 11
> **Total tasks:** 6
> **Progress:** 🟢 6 / 6 done (100%)
>
> **Status legend:** 🔴 Not Started · 🟡 In Progress · 🔵 In Review · 🟢 Done · ⚪ Blocked

## Task index

| ID    | Task                                                                               | Status | Priority | Size | Depends on   |
| ----- | ---------------------------------------------------------------------------------- | ------ | -------- | ---- | ------------ |
| P11-1 | `cache.config.ts` — `buildSentinelBlock`/`buildClusterBlock` + `CACHE_MODE`        | 🟢     | High     | M    | Phase 3      |
| P11-2 | `docker/cluster/` + `docker/sentinel/` compose profiles made runnable              | 🟢     | Medium   | M    | Phase 3      |
| P11-3 | `src/errors-demo/` — `POST /errors/:code` triggering all 15 error codes            | 🟢     | High     | M    | Phase 3      |
| P11-4 | Cluster-restriction demo (`scan`/`flushNamespace`/`getClient` → unsupported)       | 🟢     | Medium   | S    | P11-1, P11-3 |
| P11-5 | Typed error handling — import `CacheErrorCode` from `@bymax-one/nest-cache/shared` | 🟢     | Medium   | S    | P11-3        |
| P11-6 | Phase verification (HTTP statuses · cluster restrictions · prod-guard 403)         | 🟢     | Medium   | S    | P11-1..P11-5 |

---

## P11-1 — `cache.config.ts` — `buildSentinelBlock`/`buildClusterBlock` + `CACHE_MODE`

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** M (90 min – half day)
- **Depends on:** `Phase 3`

### Description

Extend the canonical `apps/api/src/cache/cache.config.ts` factory (created in Phase 3) so it builds the **sentinel** and **cluster** connection blocks from validated env, and `CACHE_MODE` switches `standalone | sentinel | cluster`. Phase 3 wired standalone (`connection: { url }`); this task adds `buildSentinelBlock(config)` and `buildClusterBlock(config)` so `buildCacheOptions` returns the right shape for each mode (matrix #5, #6). The sentinel/cluster connection blocks are typed with the library's re-exported ioredis types (`SentinelAddress`, `ClusterNode`, `ClusterOptions` — matrix #49), proving the library's connection types compose cleanly. The factory stays env-driven and side-effect-free — the only behaviour change is which sub-block (`connection` / `sentinel` / `cluster`) is populated per `mode`.

### Acceptance Criteria

- [x] `cache.config.ts` exports `buildSentinelBlock(config: ConfigService<Env, true>): BymaxCacheSentinelConnection` returning `{ sentinels, name, role?, password?, sentinelPassword?, natMap? }` built from env.
- [x] `cache.config.ts` exports `buildClusterBlock(config: ConfigService<Env, true>): BymaxCacheClusterConnection` returning `{ nodes, options? }` built from env.
- [x] `buildCacheOptions` sets `connection` only when `mode === 'standalone'`, `sentinel` only when `mode === 'sentinel'`, and `cluster` only when `mode === 'cluster'` (the other two are `undefined`).
- [x] `CACHE_MODE` (`standalone | sentinel | cluster`) drives the `mode` field; the Zod env schema already constrains the enum (Phase 3 / Appendix A).
- [x] Connection blocks are typed with re-exported ioredis types from `@bymax-one/nest-cache` (`SentinelAddress`, `ClusterNode`, `ClusterOptions`) — matrix #49.
- [x] `pnpm --filter api typecheck` exits 0.

### Files to create / modify

- `apps/api/src/cache/cache.config.ts` — add `buildSentinelBlock` + `buildClusterBlock`, wire the `mode` switch.
- `apps/api/src/config/env.schema.ts` — add any sentinel/cluster env vars used by the two builders (e.g. `REDIS_SENTINELS`, `REDIS_SENTINEL_MASTER`, `REDIS_CLUSTER_NODES`), if not already present.

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer wiring connection topologies.
> Context: Task P11-1 of `docs/DEVELOPMENT_PLAN.md` §Phase 11. The library accepts standalone, sentinel, and cluster from one options shape; the example runs standalone by default and documents/optionally runs the other two (spec §15). Phase 3 already created `cache.config.ts` with `buildCacheOptions(config, events)` and the standalone path; this task adds the sentinel + cluster builders and the `CACHE_MODE` switch. The connection-block shapes are: `BymaxCacheSentinelConnection = { sentinels: SentinelAddress[]; name: string; role?: 'master' | 'replica' | 'slave'; password?: string; sentinelPassword?: string; natMap?: … }` and `BymaxCacheClusterConnection = { nodes: ClusterNode[]; options?: ClusterOptions }` (verified against spec §4 + the library's re-exported ioredis types).
> Objective: Make `cache.config.ts` build the sentinel + cluster blocks from env and switch on `CACHE_MODE`.
> Steps:
>
> 1. In `apps/api/src/config/env.schema.ts`, add the env vars the two builders need (only if missing): `REDIS_SENTINELS` (comma list of `host:port`), `REDIS_SENTINEL_MASTER` (default `mymaster`), `REDIS_SENTINEL_ROLE` (`master | replica`, default `master`), `REDIS_CLUSTER_NODES` (comma list of `host:port`). Keep them optional with sensible defaults; the standalone path must not require them.
> 2. In `apps/api/src/cache/cache.config.ts`, add:
>
>    ```ts
>    import type {
>      BymaxCacheSentinelConnection,
>      BymaxCacheClusterConnection,
>      SentinelAddress,
>      ClusterNode,
>    } from '@bymax-one/nest-cache'
>
>    /** Parses a comma-separated `host:port` list into address objects. */
>    function parseNodes(raw: string): { host: string; port: number }[] {
>      return raw
>        .split(',')
>        .map((s) => s.trim())
>        .filter(Boolean)
>        .map((pair) => {
>          const [host, port] = pair.split(':')
>          return { host: host!, port: Number(port) }
>        })
>    }
>
>    /** Builds the sentinel connection block from validated env (spec §15.2). */
>    export function buildSentinelBlock(
>      config: ConfigService<Env, true>,
>    ): BymaxCacheSentinelConnection {
>      const sentinels: SentinelAddress[] = parseNodes(
>        config.get('REDIS_SENTINELS', { infer: true }),
>      )
>      return {
>        sentinels,
>        name: config.get('REDIS_SENTINEL_MASTER', { infer: true }),
>        role: config.get('REDIS_SENTINEL_ROLE', { infer: true }),
>        password: config.get('REDIS_PASSWORD', { infer: true }) || undefined,
>      }
>    }
>
>    /** Builds the cluster connection block from validated env (spec §15.3). */
>    export function buildClusterBlock(
>      config: ConfigService<Env, true>,
>    ): BymaxCacheClusterConnection {
>      const nodes: ClusterNode[] = parseNodes(config.get('REDIS_CLUSTER_NODES', { infer: true }))
>      return { nodes }
>    }
>    ```
>
> 3. Confirm `buildCacheOptions` selects the block by mode exactly as spec §9.2 shows:
>    `connection: mode === 'standalone' ? { url: … } : undefined`, `sentinel: mode === 'sentinel' ? buildSentinelBlock(config) : undefined`, `cluster: mode === 'cluster' ? buildClusterBlock(config) : undefined`.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions; English-only comments; JSDoc on the exported builders.
> - No Swagger — the connection shapes are documented via JSDoc + the Zod env schema, not decorators.
> - Never pass `maxRetriesPerRequest: null` (that is BullMQ-specific — spec §4.3).
> - Do NOT read `process.env` directly; everything goes through `ConfigService<Env, true>`.
>   Verification:
> - `pnpm --filter api typecheck` — expected: exit 0.
> - `CACHE_MODE=sentinel pnpm --filter api start` (with the sentinel profile up, P11-2) — expected: boots and reaches `ready`.
> - `CACHE_MODE=cluster pnpm --filter api start` (with the cluster profile up, P11-2) — expected: boots and reaches `ready`.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P11-1 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

If phase reaches 100%, switch its row status in `DEVELOPMENT_PLAN.md` to 🟢.

⚠️ Never mark done with failing verification.

---

## P11-2 — `docker/cluster/` + `docker/sentinel/` Compose Profiles Made Runnable

- **Status:** 🟢 Done
- **Priority:** Medium
- **Size:** M (90 min – half day)
- **Depends on:** `Phase 3`

### Description

Flesh out the `docker/cluster/` and `docker/sentinel/` skeletons (stubbed in Phase 1) into runnable Compose profiles, so a reader can bring up a real sentinel set or a real cluster and watch the topology-specific behaviour live. The default `docker compose up` still starts standalone Redis only; `--profile sentinel` and `--profile cluster` add the extra services. All ports bind to `127.0.0.1` (spec §21). These profiles are what P11-1 connects to and what P11-4 / P11-6 exercise to prove the cluster restrictions on screen.

### Acceptance Criteria

- [x] `docker/sentinel/` provides a runnable master + replica + ≥1 sentinel (`sentinel.conf` monitoring `mymaster`), exposed on `127.0.0.1:26379` (+ peers) under the `sentinel` profile.
- [x] `docker/cluster/` provides a runnable multi-node cluster (≥3 primaries, cluster-enabled `redis.conf`, an init/`--cluster create` step), exposed on `127.0.0.1:7000+` under the `cluster` profile.
- [x] `docker-compose.yml` wires both profiles; default `up` (no profile) starts only standalone Redis (unchanged from Phase 1).
- [x] `docker compose --profile sentinel up -d --wait` reaches healthy; `docker compose --profile cluster up -d --wait` reaches healthy.
- [x] The README/`docs` snippet documents the two `--profile` commands + the matching `CACHE_MODE` + the env each profile expects (`REDIS_SENTINELS` / `REDIS_CLUSTER_NODES`).

### Files to create / modify

- `docker/sentinel/` — `docker-compose` fragment / `sentinel.conf` / `redis.conf` for master+replica+sentinel.
- `docker/cluster/` — cluster-node `redis.conf`(s) + the cluster-create init step.
- `docker-compose.yml` — register the `sentinel` + `cluster` profiles (extend the Phase 1 file).

### Agent Execution Prompt

> Role: Senior platform / Docker engineer.
> Context: Task P11-2 of `docs/DEVELOPMENT_PLAN.md` §Phase 11. The example runs standalone by default and documents/optionally runs sentinel + cluster via Docker profiles (spec §15, §21). Phase 1 created `docker/cluster/` + `docker/sentinel/` as skeletons and registered the profile names; this task makes them actually run. All ports bind to `127.0.0.1`.
> Objective: Turn the `docker/cluster/` + `docker/sentinel/` skeletons into runnable profiles.
> Steps:
>
> 1. `docker/sentinel/`: define a `redis:7-alpine` master, one replica (`--replicaof`), and at least one `redis-sentinel` monitoring `mymaster` (quorum 1 for the demo). Bind sentinel to `127.0.0.1:26379` (add a second on `26380` to match spec §15.2's two-sentinel example). Provide `sentinel.conf` (`sentinel monitor mymaster <master-host> 6379 1`, `down-after-milliseconds`, `failover-timeout`).
> 2. `docker/cluster/`: define ≥3 cluster-enabled `redis:7-alpine` nodes (`--cluster-enabled yes`, `--cluster-config-file`, `--appendonly yes`) on `127.0.0.1:7000`, `7001`, `7002`, plus a one-shot init service running `redis-cli --cluster create … --cluster-yes` to form the cluster.
> 3. In `docker-compose.yml`, attach the new services to `profiles: [sentinel]` / `profiles: [cluster]` so the default `up` is unchanged (standalone Redis only — Phase 1). Add `--wait`-friendly healthchecks.
> 4. Document the two run commands + their `CACHE_MODE`/env in the repo README or `docs` (concise): `docker compose --profile sentinel up -d --wait` with `CACHE_MODE=sentinel REDIS_SENTINELS=localhost:26379,localhost:26380`; `docker compose --profile cluster up -d --wait` with `CACHE_MODE=cluster REDIS_CLUSTER_NODES=localhost:7000,localhost:7001,localhost:7002`.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - All published ports MUST bind to `127.0.0.1` (spec §21, §24).
> - Do NOT change the default (no-profile) topology — standalone Redis stays exactly as Phase 1 left it.
> - Keep configs minimal-but-real (a teaching cluster/sentinel, not a production HA layout).
>   Verification:
> - `docker compose --profile sentinel up -d --wait` — expected: all sentinel-profile services healthy.
> - `docker compose --profile cluster up -d --wait` — expected: cluster forms; `redis-cli -p 7000 cluster info` shows `cluster_state:ok`.
> - `docker compose up -d --wait` (no profile) — expected: only standalone Redis starts (unchanged).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P11-2 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

If phase reaches 100%, switch its row status in `DEVELOPMENT_PLAN.md` to 🟢.

⚠️ Never mark done with failing verification.

---

## P11-3 — `src/errors-demo/` — `POST /errors/:code` Triggering All 15 Error Codes

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** M (90 min – half day)
- **Depends on:** `Phase 3`

### Description

Build the `src/errors-demo/` module — a controller + service exposing `POST /errors/:code` that triggers each of the 15 `CACHE_ERROR_CODES` on demand, so the `CacheExceptionFilter` (Phase 3) can be observed mapping every code to its canonical HTTP status and structured body (matrix #41–#43). This is the backend for the dashboard's Error Explorer (DASHBOARD §13; the page lands in Phase 14). Each code is provoked by the smallest realistic action that raises exactly that `CacheException`; a few codes are environment/topology-dependent and are documented as such (see the table). The `:code` path param is validated (Zod) against the `CACHE_ERROR_CODES` set so an unknown code is a clean `400`, not a 500.

### Acceptance Criteria

- [x] `apps/api/src/errors-demo/` exists with an `ErrorsDemoModule`, `ErrorsDemoController`, and `ErrorsDemoService`, registered in `app.module.ts`.
- [x] `POST /errors/:code` accepts each of the **15** `CacheErrorCode` values (the `:code` accepts either the snake suffix, e.g. `invalid_key`, or the full `cache.<snake>` value — pick one and document it) and triggers a `CacheException` carrying that exact `.code`.
- [x] All 15 codes are wired (each `→` its provoking action), with each producing the HTTP status from the §19.2 table:
  - [x] `cache.connection_failed` → 500 (documented: observed if Redis is down at boot; demo simulates/forces the connection-failure path).
  - [x] `cache.command_timeout` → 504 (a tiny `commandTimeout` + a deliberately slow op).
  - [x] `cache.connection_lost` → 503 (dropping the connection mid-op).
  - [x] `cache.serialization_failed` → 500 (`set` of a value the codec cannot encode).
  - [x] `cache.deserialization_failed` → 500 (read a deliberately corrupted key).
  - [x] `cache.invalid_key` → 400 (empty prefix/id).
  - [x] `cache.invalid_namespace` → 500 (misconfigured namespace, config-time).
  - [x] `cache.script_not_registered` → 500 (`eval` of an unknown script name).
  - [x] `cache.script_execution_failed` → 500 (a Lua runtime error).
  - [x] `cache.script_registry_missing` → 500 (`eval` with no script manager wired).
  - [x] `cache.flush_disabled_in_production` → 403 (`flushNamespace()` with `NODE_ENV=production`).
  - [x] `cache.cluster_misconfigured` → 500 (`mode: 'cluster'` without `cluster.nodes`).
  - [x] `cache.sentinel_misconfigured` → 500 (`mode: 'sentinel'` without sentinels/name).
  - [x] `cache.shutdown_timeout` → 500 (`quit()` exceeds `shutdownTimeoutMs`).
  - [x] `cache.unsupported_in_cluster` → 500 (`scan`/`flushNamespace`/`getClient` in cluster mode — fully wired in P11-4).
- [x] Every response flows through the Phase 3 `CacheExceptionFilter` → `{ error: { code, message, details } }`, where `message` is the canonical `CACHE_ERROR_MESSAGES.get(code)`.
- [x] An unknown/typo `:code` returns `400` (validated against the `CACHE_ERROR_CODES` set), not a 500.
- [x] `pnpm --filter api typecheck` exits 0.

### Files to create / modify

- `apps/api/src/errors-demo/errors-demo.module.ts` — the module.
- `apps/api/src/errors-demo/errors-demo.controller.ts` — `POST /errors/:code` (JSDoc + Zod-validated param).
- `apps/api/src/errors-demo/errors-demo.service.ts` — the 15 per-code triggers.
- `apps/api/src/app.module.ts` — register `ErrorsDemoModule`.

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer building the error-surface demo.
> Context: Task P11-3 of `docs/DEVELOPMENT_PLAN.md` §Phase 11. Spec §19 defines `CacheException` (extends `HttpException`; carries readonly `.code` + `.details`) and the canonical error-code → HTTP table (§19.2); DASHBOARD §13 is the Error Explorer that consumes this endpoint (UI in Phase 14). The Phase 3 `CacheExceptionFilter` already serializes any `CacheException` to `{ error: { code, message, details } }` with `exception.getStatus()`, and looks the message up in `CACHE_ERROR_MESSAGES`.
> Objective: Build `src/errors-demo/` so `POST /errors/:code` triggers each of the 15 `CACHE_ERROR_CODES` and the filter maps each to the right HTTP status.
> Steps:
>
> 1. Import the codes from the library: `import { CACHE_ERROR_CODES, type CacheErrorCode } from '@bymax-one/nest-cache'` (also exported from `./shared`; the API may import from either — the typed handling in P11-5 standardizes on `./shared`). The 15 codes and their HTTP statuses (spec §19.2) are:
>    | Code (value is `cache.<snake>`) | HTTP | Provoked by |
>    |---|---|---|
>    | `cache.connection_failed` | 500 | connection failure at boot (simulate the failure path) |
>    | `cache.command_timeout` | 504 | tiny `commandTimeout` + slow op |
>    | `cache.connection_lost` | 503 | drop the connection mid-op |
>    | `cache.serialization_failed` | 500 | `set` of a value the codec cannot encode |
>    | `cache.deserialization_failed` | 500 | read a deliberately corrupted key |
>    | `cache.invalid_key` | 400 | empty prefix/id |
>    | `cache.invalid_namespace` | 500 | misconfigured namespace (config-time) |
>    | `cache.script_not_registered` | 500 | `eval` of an unknown script name |
>    | `cache.script_execution_failed` | 500 | a Lua runtime error |
>    | `cache.script_registry_missing` | 500 | `eval` with no script manager wired |
>    | `cache.flush_disabled_in_production` | 403 | `flushNamespace()` with `NODE_ENV=production` |
>    | `cache.cluster_misconfigured` | 500 | `mode: 'cluster'` without `cluster.nodes` |
>    | `cache.sentinel_misconfigured` | 500 | `mode: 'sentinel'` without sentinels/name |
>    | `cache.shutdown_timeout` | 500 | `quit()` exceeds `shutdownTimeoutMs` |
>    | `cache.unsupported_in_cluster` | 500 | `scan`/`flushNamespace`/`getClient` in cluster mode |
> 2. `errors-demo.service.ts`: a `Record<CacheErrorCode, () => Promise<never> | never>` (or a `switch`) where each entry performs the smallest action that makes the library throw that exact `CacheException`. Where a code can only be raised by the real library API (e.g. `invalid_key` via empty prefix/id; `script_not_registered` via `cache.eval('nope', …)`; `flush_disabled_in_production` via `flushNamespace()` under prod), trigger it through the real call. Where a code is genuinely environment/boot-dependent (`connection_failed`, `connection_lost`, `command_timeout`, `invalid_namespace`, `shutdown_timeout`, `cluster_misconfigured`, `sentinel_misconfigured`), construct/throw the corresponding `CacheException(code, details?)` directly **and** add a one-line JSDoc note explaining the real-world trigger (so the demo is honest — spec §G2). Prefer the real library path whenever it is reachable from a request.
> 3. `errors-demo.controller.ts`: `@Post('errors/:code')`; validate `:code` with a Zod schema derived from `CACHE_ERROR_CODES` (accept the snake suffix or the full `cache.<snake>` — document which, then normalize). On an unknown code, throw a `400` (let the `ZodValidationPipe` / a `BadRequestException` handle it) — never fall through to a 500. Delegate to the service; let the thrown `CacheException` bubble to the global filter (do NOT catch-and-reshape it here).
> 4. Register `ErrorsDemoModule` in `app.module.ts`.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions; English-only; JSDoc on every public controller/service method.
> - No Swagger — the endpoint is documented via JSDoc + the Zod param schema (spec §23.4).
> - Do NOT hand-roll the HTTP statuses in the controller — they come from `CacheException.getStatus()` via the Phase 3 filter; this task only ensures the right `CacheException` is thrown.
> - Do NOT leak secrets into `details` (the library contract keeps `details` secret-free; keep any demo details benign).
>   Verification:
> - `pnpm --filter api typecheck` — expected: exit 0.
> - `curl -s -o /dev/null -w '%{http_code}' -X POST localhost:3001/errors/invalid_key` — expected: `400`.
> - `curl -s -X POST localhost:3001/errors/script_not_registered | node -e "process.stdin.on('data',d=>{const b=JSON.parse(d);process.exit(b.error.code==='cache.script_not_registered'?0:1)})"` — expected: exit 0 (body has the structured `error.code`).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P11-3 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

If phase reaches 100%, switch its row status in `DEVELOPMENT_PLAN.md` to 🟢.

⚠️ Never mark done with failing verification.

---

## P11-4 — Cluster-Restriction Demo (`scan`/`flushNamespace`/`getClient` → `UNSUPPORTED_IN_CLUSTER`)

- **Status:** 🟢 Done
- **Priority:** Medium
- **Size:** S (30–90 min)
- **Depends on:** `P11-1`, `P11-3`

### Description

Demonstrate, honestly, that in cluster mode `scan`, `flushNamespace`, and `getClient` throw `CacheException('cache.unsupported_in_cluster')` — and that the failure surfaces cleanly through the Phase 3 exception filter (matrix #6, spec §15.4). With the cluster profile up (P11-2) and `CACHE_MODE=cluster` (P11-1), calling the admin endpoints that use those three methods returns a clear, typed `cache.unsupported_in_cluster` body (HTTP 500). This turns a documentation footnote into a visible lesson and backs the dashboard's "disabled in cluster" callout (DASHBOARD §6, §14). Also note the related cluster facts for the reader: `eval` requires ≥1 key (routes by slot) and Pub/Sub is an experimental passthrough (not rejected).

### Acceptance Criteria

- [x] With `CACHE_MODE=cluster` + the cluster profile up, an admin `scan` call surfaces `cache.unsupported_in_cluster` (HTTP 500) via the filter.
- [x] Same for `flushNamespace()` (the guarded `DELETE /admin/namespace`) and for the `getClient()`-backed path (e.g. the foreign-namespace seed) — both surface `cache.unsupported_in_cluster`.
- [x] The `errors-demo` `unsupported_in_cluster` trigger (from P11-3) is reconciled with this real path: it either invokes one of the three restricted methods in cluster mode, or documents that the real surface is the admin endpoints under cluster (no fake-only path that misrepresents the library).
- [x] A short doc/JSDoc note records the adjacent cluster facts: `eval` needs ≥1 key (single-slot hash tag); Pub/Sub is experimental passthrough, not rejected (spec §15.4).
- [x] `pnpm --filter api typecheck` exits 0.

### Files to create / modify

- `apps/api/src/errors-demo/errors-demo.service.ts` — reconcile the `unsupported_in_cluster` trigger with the real restricted-method path.
- _(no new endpoints — reuses the Phase 5 `admin` endpoints that call `scan`/`flushNamespace`/`getClient`; this task verifies + documents their cluster behaviour.)_

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer.
> Context: Task P11-4 of `docs/DEVELOPMENT_PLAN.md` §Phase 11. Spec §15.4 lists the cluster restrictions: `scan`, `flushNamespace`, and `getClient` throw `CacheException('cache.unsupported_in_cluster')` (HTTP 500 per §19.2); `eval` requires ≥1 key (routes by slot; one call's keys must hash to one slot via a hash tag); Pub/Sub is an experimental passthrough (not rejected). DASHBOARD §6 + §14 show these methods disabled in cluster with the `UNSUPPORTED_IN_CLUSTER` callout. The admin endpoints that call these three methods already exist (Phase 5).
> Objective: Prove the three restricted methods fail cleanly with `cache.unsupported_in_cluster` in cluster mode, and reconcile the P11-3 trigger with that real path.
> Steps:
>
> 1. Bring up the cluster profile (P11-2) and run the API with `CACHE_MODE=cluster` (P11-1).
> 2. Exercise the Phase 5 admin endpoints that call `scan` (`GET /admin/keys?strategy=scan`), `flushNamespace` (`DELETE /admin/namespace`), and `getClient` (the foreign-namespace seed path). Confirm each surfaces `{ error: { code: 'cache.unsupported_in_cluster', … } }` with HTTP 500 via the global filter — no stack leak, no unhandled rejection.
> 3. Reconcile the `errors-demo` `unsupported_in_cluster` entry from P11-3: prefer invoking one of the three restricted methods (so it raises the real library exception) when running in cluster; if the demo must work in any mode, document clearly that the authentic surface is the admin endpoints under `CACHE_MODE=cluster` and keep the direct-throw path labelled as a simulation.
> 4. Add a concise JSDoc/doc note capturing the adjacent facts: `eval` needs ≥1 key (hash-tag to a single slot); Pub/Sub is experimental passthrough.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions; English-only.
> - Honest semantics (spec §G2): do NOT fake the restriction with a hand-thrown error when the real method is reachable — invoke the real method in cluster mode.
> - No Swagger; document via JSDoc.
>   Verification:
> - With cluster up + `CACHE_MODE=cluster`: `curl -s -o /dev/null -w '%{http_code}' "localhost:3001/admin/keys?strategy=scan"` — expected: `500`.
> - `curl -s -X DELETE localhost:3001/admin/namespace | node -e "process.stdin.on('data',d=>process.exit(JSON.parse(d).error.code==='cache.unsupported_in_cluster'?0:1))"` — expected: exit 0.
> - `pnpm --filter api typecheck` — expected: exit 0.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P11-4 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

If phase reaches 100%, switch its row status in `DEVELOPMENT_PLAN.md` to 🟢.

⚠️ Never mark done with failing verification.

---

## P11-5 — Typed Error Handling — Import `CacheErrorCode` from `@bymax-one/nest-cache/shared`

- **Status:** 🟢 Done
- **Priority:** Medium
- **Size:** S (30–90 min)
- **Depends on:** `P11-3`

### Description

Standardize the API's error-code typing on the library's **shared** subpath: import `CacheErrorCode` (and `CACHE_ERROR_CODES` / `CACHE_ERROR_MESSAGES` where used for code/type purposes) from `@bymax-one/nest-cache/shared` for the `errors-demo` validation + any typed error mapping (matrix #44, #48). The `/shared` subpath is zero-dependency and exports the same codes/types as the root — the web reuses exactly this import in Phase 12/14 to type its error union in the browser bundle. Doing it in the API now sets the contract and proves the shared subpath resolves server-side too. (Note: `CACHE_ERROR_CODES`, `CacheErrorCode`, and `CACHE_ERROR_MESSAGES` are exported from BOTH `.` and `./shared`; the web standardizes on `/shared`.)

### Acceptance Criteria

- [x] The `errors-demo` `:code` validation and any error-code-typed helper import `CacheErrorCode` (+ `CACHE_ERROR_CODES`) from `@bymax-one/nest-cache/shared`, not from `.`.
- [x] Where the canonical message is rendered/used as a code/type concern, `CACHE_ERROR_MESSAGES` is sourced consistently (the filter from Phase 3 may keep its existing import; this task governs the `errors-demo` typed surface).
- [x] A code comment notes that `apps/web` reuses the same `@bymax-one/nest-cache/shared` import for its `CacheErrorCode`-keyed error union in Phase 12/14 (matrix #48 — zero NestJS/ioredis in the browser bundle).
- [x] No NestJS/ioredis-only symbol is imported from `./shared` (it is zero-dependency by contract; only codes/types/messages live there).
- [x] `pnpm --filter api typecheck` exits 0; `pnpm --filter api lint` exits 0.

### Files to create / modify

- `apps/api/src/errors-demo/errors-demo.controller.ts` / `errors-demo.service.ts` — switch the `CacheErrorCode` / `CACHE_ERROR_CODES` import to `@bymax-one/nest-cache/shared`.

### Agent Execution Prompt

> Role: Senior TypeScript engineer.
> Context: Task P11-5 of `docs/DEVELOPMENT_PLAN.md` §Phase 11. The library ships a zero-dependency `./shared` subpath exporting `CACHE_ERROR_CODES`, `CACHE_ERROR_MESSAGES`, and the type `CacheErrorCode` (among others) — the same codes/types are also re-exported from the root `.` (spec §4.1–§4.2, §8.2). The dashboard imports from `@bymax-one/nest-cache/shared` so none of NestJS/ioredis leaks into the browser bundle (matrix #48); this task makes the API use the same `/shared` import for its error-code typing, setting the contract the web reuses in Phase 12/14.
> Objective: Switch the `errors-demo` error-code typing to the `@bymax-one/nest-cache/shared` subpath.
> Steps:
>
> 1. In `errors-demo.controller.ts` / `errors-demo.service.ts`, change `import { CACHE_ERROR_CODES, type CacheErrorCode } from '@bymax-one/nest-cache'` → `from '@bymax-one/nest-cache/shared'`. Keep server-only imports (`CacheException`, services, tokens) on the root `.` subpath — only the codes/types/messages move to `/shared`.
> 2. Add a one-line comment: `// Imported from '/shared' (zero-dep) — apps/web reuses this exact import to type its CacheErrorCode error union in the browser (matrix #48).`
> 3. Run typecheck + lint.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions; English-only.
> - Do NOT import any NestJS/ioredis-bound symbol from `./shared` — that subpath is zero-dependency by contract (spec §4.2).
> - Do NOT change the Phase 3 `CacheExceptionFilter` import unless it is part of the `errors-demo` typed surface; this task is scoped to `errors-demo`.
>   Verification:
> - `pnpm --filter api typecheck` — expected: exit 0.
> - `pnpm --filter api lint` — expected: exit 0.
> - `grep -R "@bymax-one/nest-cache/shared" apps/api/src/errors-demo` — expected: matches (the `/shared` import is in place).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P11-5 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

If phase reaches 100%, switch its row status in `DEVELOPMENT_PLAN.md` to 🟢.

⚠️ Never mark done with failing verification.

---

## P11-6 — Phase Verification (HTTP Statuses · Cluster Restrictions · Prod-Guard 403)

- **Status:** 🟢 Done
- **Priority:** Medium
- **Size:** S (30–90 min)
- **Depends on:** `P11-1`, `P11-2`, `P11-3`, `P11-4`, `P11-5`

### Description

Phase 11 "Definition of done" gate per `DEVELOPMENT_PLAN.md`: prove that each `POST /errors/:code` returns the correct HTTP status + structured body; that with the cluster profile up the documented methods (`scan`/`flushNamespace`/`getClient`) fail with `cache.unsupported_in_cluster`; and that the prod-guard demo (`flushNamespace()` under `NODE_ENV=production`) returns `403`. Closes the phase. Demonstrates matrix rows #5, #6, #41, #42, #43, #44, #49.

### Acceptance Criteria

- [x] Every `POST /errors/:code` (all 15) returns the status from the §19.2 table and a `{ error: { code, message, details } }` body with the matching canonical message.
- [x] An unknown `:code` returns `400`.
- [x] With `CACHE_MODE=cluster` + the cluster profile up: `scan`, `flushNamespace`, and `getClient` paths all surface `cache.unsupported_in_cluster` (HTTP 500).
- [x] The prod-guard demo (`flushNamespace()` with `NODE_ENV=production`) returns `403` with `cache.flush_disabled_in_production`.
- [x] The sentinel + cluster profiles boot (`--profile sentinel` / `--profile cluster` reach healthy) and the API connects in each mode (`CACHE_MODE` switch from P11-1).
- [x] `pnpm --filter api typecheck` + `pnpm --filter api lint` exit 0.

### Files to create / modify

- _(none — verification only; fix the earlier task files (P11-1..P11-5) if a check fails.)_

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer.
> Context: Task P11-6 of `docs/DEVELOPMENT_PLAN.md` §Phase 11. DoD: each `/errors/:code` returns the correct HTTP status + structured body (spec §19.2); with the cluster profile up the documented methods fail with `cache.unsupported_in_cluster` (spec §15.4); the prod-guard demo returns `403` (`cache.flush_disabled_in_production`). Demonstrates matrix #5, #6, #41–#44, #49.
> Objective: Confirm the whole Phase 11 surface behaves and close the phase.
> Steps:
>
> 1. Standalone run: for each of the 15 `CACHE_ERROR_CODES`, `POST /errors/:code` and assert the HTTP status matches §19.2 and the body is `{ error: { code, message, details } }` with `message === CACHE_ERROR_MESSAGES.get(code)`. Assert an unknown code → `400`.
> 2. Prod-guard: run the API with `NODE_ENV=production` and `ALLOW_FLUSH_IN_PRODUCTION=false`; call the flush path (`POST /errors/flush_disabled_in_production` and/or `DELETE /admin/namespace`) and assert `403` + `cache.flush_disabled_in_production`.
> 3. Cluster run: `docker compose --profile cluster up -d --wait`, start the API with `CACHE_MODE=cluster`, and assert `scan` / `flushNamespace` / `getClient` paths return `500` + `cache.unsupported_in_cluster`.
> 4. Sentinel run: `docker compose --profile sentinel up -d --wait`, start with `CACHE_MODE=sentinel`, assert the API reaches `ready`.
> 5. If any check fails, diagnose and fix in the corresponding earlier task file (P11-1..P11-5), then return here. Do NOT weaken an assertion or bypass the filter to make a check pass.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - Do NOT lower any status/threshold or stub a code out; do NOT use `@ts-ignore`/`eslint-disable`.
>   Verification:
> - For each code: `curl -s -o /dev/null -w '%{http_code}' -X POST localhost:3001/errors/<code>` — expected: the §19.2 status (e.g. `invalid_key` → `400`, `command_timeout` → `504`, `flush_disabled_in_production` → `403`, the rest → `500`/`503` as tabled).
> - `NODE_ENV=production` flush — expected: `403` + `cache.flush_disabled_in_production`.
> - Cluster mode `scan`/`flushNamespace`/`getClient` — expected: `500` + `cache.unsupported_in_cluster`.
> - `pnpm --filter api typecheck` + `pnpm --filter api lint` — expected: exit 0.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P11-6 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

When this task is 🟢, Phase 11 is 6/6 — switch the Phase 11 row in `DEVELOPMENT_PLAN.md` Progress Summary to 🟢 Done.

⚠️ Never mark done with failing verification.

---

## Completion log

_(Agents append one line per finished task, newest at the bottom.)_

- P11-1 ✅ 2026-06-17 — `cache.config.ts` builds sentinel/cluster blocks from env (typed with re-exported ioredis types) + `CACHE_MODE` switch; opt-in `natMap` env for NAT'd Docker host-reachability.
- P11-2 ✅ 2026-06-17 — sentinel profile fixed (`resolve-hostnames`) and cluster profile reworked to 3 static-IP primaries with an auto `--cluster create` init; both reach healthy via `--wait` (`cluster_state:ok`); default `up` unchanged; README documents both `--profile` commands + env.
- P11-3 ✅ 2026-06-17 — `src/errors-demo/` `POST /errors/:code` triggers all 15 `CACHE_ERROR_CODES`; request-reachable codes via the real library, env/topology codes tagged `simulated`; unknown code → 400; every code maps to its §19.2 status + canonical message.
- P11-4 ✅ 2026-06-17 — verified in cluster mode that `scan`/`flushNamespace`/`getClient` (admin endpoints + errors-demo) surface `cache.unsupported_in_cluster` (500) cleanly; JSDoc records the adjacent `eval`/Pub-Sub cluster facts.
- P11-5 ✅ 2026-06-17 — `errors-demo` error-code typing imported from `@bymax-one/nest-cache/shared` (zero-dep), with the web-reuse note; no NestJS/ioredis symbol pulled from `/shared`.
- P11-6 ✅ 2026-06-17 — full verification: 15 statuses + structured bodies, unknown → 400, cluster restrictions → 500, prod-guard → 403 (fixed a latent `z.coerce.boolean('false') === true` bug that disabled the guard); sentinel + cluster profiles boot and the API connects in each mode.
