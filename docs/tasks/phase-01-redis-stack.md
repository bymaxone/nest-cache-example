# Phase 1 — Local Redis Stack & Docker — Tasks

> **Source:** [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#phase-1--local-redis-stack--docker) §Phase 1
> **Total tasks:** 5
> **Progress:** 🟢 5 / 5 done (100%)
>
> **Status legend:** 🔴 Not Started · 🟡 In Progress · 🔵 In Review · 🟢 Done · ⚪ Blocked

**Phase goal:** `docker compose up -d --wait` brings up Redis (with keyspace notifications) so the API + TTL demo work end to end. **Demonstrates:** infra prerequisite for [§7 Feature Coverage Matrix](../TECHNICAL_SPECIFICATION.md#7--feature-coverage-matrix) rows 8, 12, 19 (TTL / keyspace). **Depends on:** Phase 0.

## Task index

| ID   | Task                                                                        | Status | Priority | Size | Depends on |
| ---- | --------------------------------------------------------------------------- | ------ | -------- | ---- | ---------- |
| P1-1 | `docker-compose.yml` — `redis:7-alpine` service (healthcheck, volume, conf) | 🟢     | High     | S    | Phase 0    |
| P1-2 | `docker/redis/redis.conf` — keyspace notifications + dev no-persistence     | 🟢     | High     | XS   | P1-1       |
| P1-3 | Optional Docker profiles (`tools` / `cluster` / `sentinel`) — config only   | 🟢     | Medium   | M    | P1-1, P1-2 |
| P1-4 | `.env.example` (api + web) — every spec §9 variable                         | 🟢     | High     | S    | Phase 0    |
| P1-5 | Verification gate (`pnpm infra:up` healthy · keyspace · `--profile tools`)  | 🟢     | High     | S    | P1-1..P1-4 |

---

## P1-1 — `docker-compose.yml` — `redis:7-alpine` service (healthcheck, volume, conf)

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** S (30–90 min)
- **Depends on:** `Phase 0`

### Description

Create the workspace-root `docker-compose.yml` whose **default** `up` starts the `redis:7-alpine` service ONLY. The service binds `127.0.0.1:6379` (never `0.0.0.0`), persists data in a named volume, declares a `redis-cli ping` healthcheck (so `--wait` / `pnpm infra:up` blocks until Redis is actually serving), and mounts `docker/redis/redis.conf` (created in P1-2) as the startup config. This compose file is the infra spine consumed by the `infra:*` scripts from Phase 0 and is the prerequisite for the API, the TTL-expiry demo, and matrix rows 8 / 12 / 19.

### Acceptance Criteria

- [x] `docker-compose.yml` exists at the repo root.
- [x] Defines a `redis` service on image `redis:7-alpine`.
- [x] Port mapping is `127.0.0.1:6379:6379` (host-loopback-bound, not `0.0.0.0`).
- [x] A named volume (e.g. `redis-data`) is mounted at `/data` and declared under top-level `volumes:`.
- [x] Mounts `./docker/redis/redis.conf:/usr/local/etc/redis/redis.conf:ro` and starts via `redis-server /usr/local/etc/redis/redis.conf`.
- [x] `healthcheck` runs `redis-cli ping` (expecting `PONG`) with interval/timeout/retries set.
- [x] `restart: unless-stopped` is set; the service carries no `profiles:` key (so default `up` starts it).
- [x] `docker compose config` validates the file with zero errors.

### Files to create / modify

- `docker-compose.yml` — root compose file with the default `redis` service.

### Agent Execution Prompt

> Role: Senior platform / Node engineer wiring local Docker infrastructure for a NestJS + Next.js example app.
> Context: Repo `nest-cache-example` is the reference app for `@bymax-one/nest-cache` (a typed Redis cache for NestJS). This is task **P1-1** of `docs/DEVELOPMENT_PLAN.md` §Phase 1 (Local Redis Stack & Docker). The canonical compose spec is `docs/TECHNICAL_SPECIFICATION.md` §21.1 (table) and §21.3 (ports). The root `package.json` (Phase 0) already declares `infra:up` = `docker compose up -d --wait`, `infra:down`, `infra:nuke` = `docker compose down -v`, `infra:logs`. Phase 0 is complete; assume `pnpm`, Node 24, and a working Docker daemon are available.
> Objective: Create the workspace-root `docker-compose.yml` whose default `up` brings up a single `redis:7-alpine` service that is healthchecked, persists to a named volume, and loads `docker/redis/redis.conf`.
> Steps:
>
> 1. Create `/docker-compose.yml`:
>
>    ```yaml
>    services:
>      redis:
>        image: redis:7-alpine
>        container_name: nest-cache-example-redis
>        restart: unless-stopped
>        command: ['redis-server', '/usr/local/etc/redis/redis.conf']
>        ports:
>          - '127.0.0.1:6379:6379'
>        volumes:
>          - redis-data:/data
>          - ./docker/redis/redis.conf:/usr/local/etc/redis/redis.conf:ro
>        healthcheck:
>          test: ['CMD', 'redis-cli', 'ping']
>          interval: 5s
>          timeout: 3s
>          retries: 5
>          start_period: 5s
>
>    volumes:
>      redis-data:
>    ```
>
> 2. Do NOT add a top-level `version:` key (Compose v2 ignores it and warns).
> 3. The `docker/redis/redis.conf` file is authored in P1-2; the mount path is contractual now. If you run `docker compose up` before P1-2 lands, Redis will fail to read a missing conf — that is expected until P1-2 exists. Validating with `docker compose config` does not require the conf file.
> 4. Do NOT add the `redisinsight`, cluster, or sentinel services here — those are profile-gated and land in P1-3.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions. English-only (comments + identifiers).
> - ALL container ports MUST bind to `127.0.0.1` — never `0.0.0.0` or a bare `6379:6379`.
> - Default `up` MUST start Redis ONLY; do NOT attach a `profiles:` key to the `redis` service.
> - Do NOT use `--no-verify` anywhere.
>   Verification:
> - `docker compose config` — expected: prints the resolved config, exits 0.
> - `docker compose config | grep -F '127.0.0.1:6379'` — expected: the loopback-bound port mapping is present.
> - `docker compose ps --services` — expected: lists exactly `redis` (no profile services active by default).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P1-1 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P1-2 — `docker/redis/redis.conf` — keyspace notifications + dev no-persistence

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** XS (<30 min)
- **Depends on:** `P1-1`

### Description

Author the Redis startup config mounted by P1-1. The critical line is `notify-keyspace-events Ex`, which enables the `__keyevent@<db>__:expired` channel that the TTL-expiry demo (spec §17.3, matrix row 8 / 12) subscribes to — without it the live-TTL feature is silent. Disable persistence for dev (`save ""`, `appendonly no`) so the stack stays fast and disposable (`infra:nuke` wipes everything). Every directive carries an explanatory comment so the file reads as a teaching artifact.

### Acceptance Criteria

- [x] `docker/redis/redis.conf` exists.
- [x] Contains `notify-keyspace-events Ex` (E = keyevent stream, x = expired events) with an explanatory comment.
- [x] Disables RDB snapshots with `save ""` (commented as dev no-persistence).
- [x] Disables the AOF with `appendonly no` (commented).
- [x] Comments reference the TTL-expiry demo (spec §17.3) so the intent is self-documenting.
- [x] Starting the P1-1 `redis` service with this conf succeeds and `redis-cli config get notify-keyspace-events` returns a value containing `E` and `x`.

### Files to create / modify

- `docker/redis/redis.conf` — Redis startup configuration.

### Agent Execution Prompt

> Role: Senior platform / Node engineer configuring Redis for a NestJS + Next.js example app.
> Context: Repo `nest-cache-example` is the reference app for `@bymax-one/nest-cache`. This is task **P1-2** of `docs/DEVELOPMENT_PLAN.md` §Phase 1. The exact contents are pinned by `docs/TECHNICAL_SPECIFICATION.md` §21.2. P1-1 mounts this file at `/usr/local/etc/redis/redis.conf` and launches `redis-server` against it. The TTL-expiry demo (spec §17.3) relies on keyspace notifications to receive `expired` keyevents; this conf is what enables them.
> Objective: Create `docker/redis/redis.conf` enabling keyspace expiry notifications and disabling persistence for dev, with explanatory comments.
> Steps:
>
> 1. Create the directory `docker/redis/` if it does not exist.
> 2. Create `/docker/redis/redis.conf` exactly as the spec mandates:
>    ```conf
>    # Enable keyspace notifications for the TTL-expiry demo (§17.3).
>    # E = keyevent stream, x = expired events. Use 'KEA' for everything.
>    notify-keyspace-events Ex
>    # (dev) no persistence — keeps the demo fast and disposable
>    save ""
>    appendonly no
>    ```
> 3. Do NOT add a `requirepass` / `bind` directive here — auth is optional via env (`REDIS_PASSWORD`, P1-4) and the container is already loopback-bound by the compose port mapping (P1-1).
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions. English-only comments.
> - Keep persistence OFF — this is a disposable dev stack, not a durable store.
> - Do NOT broaden the notify flags beyond what's needed; `Ex` is sufficient for the expiry demo (the comment notes `KEA` as the everything option).
>   Verification:
> - `grep -n 'notify-keyspace-events Ex' docker/redis/redis.conf` — expected: one match.
> - `docker compose up -d --wait redis && redis-cli config get notify-keyspace-events` — expected: value contains `E` and `x` (e.g. `Ex`/`xE`). Tear down with `docker compose down` when done.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P1-2 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P1-3 — Optional Docker Profiles (`tools` / `cluster` / `sentinel`) — config only

- **Status:** 🟢 Done
- **Priority:** Medium
- **Size:** M (2–4 h)
- **Depends on:** `P1-1`, `P1-2`

### Description

Add the three **opt-in** Docker Compose profiles (config only — the live topology exercise that bootstraps and stress-tests them runs in a later phase that wires them into the app). `tools` adds a `redis/redisinsight` browser on `127.0.0.1:5540`; `cluster` adds a 3-master + 3-replica topology on ports `7000–7005` (config under `docker/cluster/`); `sentinel` adds 1 master + 2 replicas + 3 sentinels on `26379–26381` (config under `docker/sentinel/`). None of these start on a default `up` — each requires `--profile <name>`. All container ports stay bound to `127.0.0.1`. **RedisInsight is `5540`, NOT `8001` — `8001` is the legacy bundled `redis-stack` port and must not be used here.**

### Acceptance Criteria

- [x] `docker-compose.yml` gains a `redisinsight` service (image `redis/redisinsight`) gated by `profiles: ['tools']`, bound to `127.0.0.1:5540:5540`.
- [x] `cluster` profile: 3 master + 3 replica `redis:7-alpine` services on `127.0.0.1` ports `7000`–`7005`, all gated by `profiles: ['cluster']`, with config materialized under `docker/cluster/`.
- [x] `sentinel` profile: 1 master + 2 replicas + 3 sentinel `redis:7-alpine` services, sentinels on `127.0.0.1` ports `26379`–`26381`, all gated by `profiles: ['sentinel']`, with config materialized under `docker/sentinel/` (master name `mymaster`).
- [x] No profile service starts on a bare `docker compose up` (verified via `docker compose ps`).
- [x] Every profile service maps its host port to `127.0.0.1` (no `0.0.0.0` / bare mappings).
- [x] `docker compose --profile tools config`, `--profile cluster config`, and `--profile sentinel config` each validate without error.

### Files to create / modify

- `docker-compose.yml` — add the `tools` / `cluster` / `sentinel` profile services + any needed volumes.
- `docker/cluster/` — cluster node config(s) (e.g. `redis-cluster.conf`).
- `docker/sentinel/` — sentinel + master/replica config(s) (e.g. `sentinel.conf`, `redis.conf`).

### Agent Execution Prompt

> Role: Senior platform engineer configuring optional Redis topologies via Docker Compose profiles for a NestJS example app.
> Context: Repo `nest-cache-example` is the reference app for `@bymax-one/nest-cache`. This is task **P1-3** of `docs/DEVELOPMENT_PLAN.md` §Phase 1. The profile table is `docs/TECHNICAL_SPECIFICATION.md` §21.1; the topologies they back are documented in §15 (15.2 sentinel `mymaster` on `26379+`, 15.3 cluster on `7000+`). **These profiles are CONFIG ONLY in this phase — they are wired into the app and exercised in Phase 11.** P1-1 already defines the default `redis` service and the top-level `volumes:` block; extend that same `docker-compose.yml`.
> Objective: Add three opt-in profiles — `tools` (RedisInsight), `cluster` (3+3), `sentinel` (1 master + 2 replicas + 3 sentinels) — without changing default-`up` behaviour.
> Steps:
>
> 1. **`tools` profile** — add to `docker-compose.yml`:
>    ```yaml
>    redisinsight:
>      image: redis/redisinsight
>      container_name: nest-cache-example-redisinsight
>      profiles: ['tools']
>      restart: unless-stopped
>      ports:
>        - '127.0.0.1:5540:5540'
>      depends_on:
>        - redis
>    ```
>    RedisInsight serves on **5540** — do NOT use 8001 (that is the legacy `redis-stack` bundle port).
> 2. **`cluster` profile** — add six `redis:7-alpine` services (`redis-cluster-0`..`redis-cluster-5`), each `profiles: ['cluster']`, host-bound `127.0.0.1:700N:700N` for N=0..5, started in cluster mode (`--cluster-enabled yes --cluster-config-file nodes.conf --port 700N`). Put a shared `docker/cluster/redis-cluster.conf` (cluster-enabled, appendonly off for dev, with comments) and mount it. 3 masters + 3 replicas — note in a comment that the `redis-cli --cluster create` bootstrap step runs once all nodes are healthy (performed when connection topologies are wired into the app).
> 3. **`sentinel` profile** — add `redis-master`, `redis-replica-1`, `redis-replica-2`, and `redis-sentinel-1..3` (`redis:7-alpine`), each `profiles: ['sentinel']`. Sentinels bind `127.0.0.1:2637X:26379` for X=9,0,1 (host `26379`/`26380`/`26381`). Materialize `docker/sentinel/sentinel.conf` (`sentinel monitor mymaster <master-host> 6379 2`, with comments) and a master/replica `docker/sentinel/redis.conf` as needed; mount them.
> 4. Confirm NONE of the new services start on a bare `up`: every one carries a `profiles:` key.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions. English-only (comments + config).
> - ALL container ports bound to `127.0.0.1` — no `0.0.0.0`, no bare `PORT:PORT`.
> - Default `up` starts Redis ONLY — profiles are strictly opt-in (`--profile <name>`).
> - RedisInsight is `5540`, NOT `8001`.
> - This is configuration only — do NOT add app wiring or a cluster-bootstrap entrypoint that runs on default `up`; the live exercise (bootstrapping, stress-testing, app wiring) runs when connection topologies are implemented.
> - Do NOT use `--no-verify`.
>   Verification:
> - `docker compose --profile tools config` — expected: validates, exits 0; shows `redisinsight` bound to `127.0.0.1:5540`.
> - `docker compose --profile cluster config | grep -Ec "127.0.0.1:700[0-5]"` — expected: `6`.
> - `docker compose --profile sentinel config | grep -Ec "127\.0\.0\.1:(26379|26380|26381):"` — expected: `3` sentinel mappings.
> - `docker compose ps --services` (no profile) — expected: exactly `redis` (profiles dormant by default).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P1-3 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P1-4 — `.env.example` (api + web) — every spec §9 variable

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** S (30–90 min)
- **Depends on:** `Phase 0`

### Description

Author the two `.env.example` templates that document every runtime variable the apps consume. The API template covers the full spec §9.1 registry (validated by the Zod-backed `ConfigService` in `apps/api`); the web template covers the two `NEXT_PUBLIC_*` vars. These are committed (P0-7's `.gitignore` allow-lists `!.env.example` while ignoring real `.env*`) and are the contributor's copy-from source. Defaults match spec §9 exactly (e.g. `PORT=3001`, `CACHE_NAMESPACE=cache-example`, `ALLOW_FLUSH_IN_PRODUCTION=false`).

### Acceptance Criteria

- [x] `apps/api/.env.example` exists and documents every spec §9.1 variable: `NODE_ENV`, `PORT` (=`3001`), `WEB_ORIGIN`, `REDIS_URL`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`, `CACHE_MODE`, `CACHE_NAMESPACE` (=`cache-example`), `CACHE_KEY_SEPARATOR`, `CACHE_DEFAULT_TTL`, `CACHE_SERIALIZER`, `ALLOW_FLUSH_IN_PRODUCTION` (=`false`), `SHUTDOWN_TIMEOUT_MS`.
- [x] Default values match spec §9 (e.g. `PORT=3001`, `WEB_ORIGIN=http://localhost:3000`, `REDIS_URL=redis://localhost:6379`, `CACHE_MODE=standalone`, `CACHE_DEFAULT_TTL=60`, `CACHE_SERIALIZER=json`, `SHUTDOWN_TIMEOUT_MS=5000`).
- [x] `REDIS_PASSWORD` is present but empty (with a comment noting it is optional and never logged).
- [x] Each variable has a short inline comment describing its purpose (mirrors the §9.1 table).
- [x] `apps/web/.env.example` exists with `NEXT_PUBLIC_API_URL=http://localhost:3001` and `NEXT_PUBLIC_WS_URL=http://localhost:3001`.
- [x] Both files are tracked by Git (not ignored — the `!.env.example` allow-list from P0-7 applies).

### Files to create / modify

- `apps/api/.env.example` — full API env template (spec §9.1).
- `apps/web/.env.example` — web env template (`NEXT_PUBLIC_*`).

### Agent Execution Prompt

> Role: Senior TypeScript / Node engineer documenting runtime configuration for a NestJS + Next.js example app.
> Context: Repo `nest-cache-example` is the reference app for `@bymax-one/nest-cache`. This is task **P1-4** of `docs/DEVELOPMENT_PLAN.md` §Phase 1. The authoritative variable registry is `docs/TECHNICAL_SPECIFICATION.md` §9.1 (and `DEVELOPMENT_PLAN.md` Appendix A). The API reads these through a Zod-validated typed `ConfigService` (the schema itself is Phase 3 — here you only author the `.env.example` templates). P0-7's `.gitignore` ignores `.env`/`.env.*` but allow-lists `!.env.example`, so these committed templates are safe. The `apps/` directories may not contain app code yet — create the `apps/api/` and `apps/web/` folders if needed; this task adds only the `.env.example` files.
> Objective: Produce `apps/api/.env.example` (every §9.1 var with defaults + comments) and `apps/web/.env.example` (the two `NEXT_PUBLIC_*` vars).
> Steps:
>
> 1. Create `/apps/api/.env.example`:
>
>    ```dotenv
>    # ── App ────────────────────────────────────────────────────────────────
>    NODE_ENV=development              # gates allowFlushInProduction behaviour
>    PORT=3001                         # API HTTP/WS port
>    WEB_ORIGIN=http://localhost:3000  # CORS allow-list for the dashboard
>
>    # ── Redis connection ──────────────────────────────────────────────────
>    REDIS_URL=redis://localhost:6379  # standalone connection (wins over discrete fields)
>    REDIS_HOST=localhost              # discrete fallback host
>    REDIS_PORT=6379                   # discrete fallback port
>    REDIS_PASSWORD=                   # optional auth — never logged
>    REDIS_DB=0                        # logical DB index (also the __keyevent@<db>__ channel)
>
>    # ── Cache (library options) ───────────────────────────────────────────
>    CACHE_MODE=standalone             # standalone | sentinel | cluster
>    CACHE_NAMESPACE=cache-example     # the library namespace for this app
>    CACHE_KEY_SEPARATOR=:             # the library keySeparator
>    CACHE_DEFAULT_TTL=60              # demo default TTL (seconds)
>    CACHE_SERIALIZER=json             # json | msgpack
>    ALLOW_FLUSH_IN_PRODUCTION=false   # maps to allowFlushInProduction (kept false)
>    SHUTDOWN_TIMEOUT_MS=5000          # maps to shutdownTimeoutMs
>    ```
>
> 2. Create `/apps/web/.env.example`:
>    ```dotenv
>    NEXT_PUBLIC_API_URL=http://localhost:3001   # NestJS REST base URL
>    NEXT_PUBLIC_WS_URL=http://localhost:3001    # socket.io endpoint (same origin as the API)
>    ```
> 3. Match defaults to spec §9.1 EXACTLY — do not invent values. Keep `REDIS_PASSWORD` empty.
> 4. Do NOT create real `.env` files and do NOT commit secrets — only the `.example` templates.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions. English-only comments.
> - Cover **every** §9.1 row in the api template — a missing variable fails this task.
> - Do NOT add variables not in §9 (no scope creep); the Zod-validated `ConfigService` in `apps/api` will mirror this exact set.
> - Do NOT use `--no-verify`.
>   Verification:
> - `for v in NODE_ENV PORT WEB_ORIGIN REDIS_URL REDIS_HOST REDIS_PORT REDIS_PASSWORD REDIS_DB CACHE_MODE CACHE_NAMESPACE CACHE_KEY_SEPARATOR CACHE_DEFAULT_TTL CACHE_SERIALIZER ALLOW_FLUSH_IN_PRODUCTION SHUTDOWN_TIMEOUT_MS; do grep -q "^$v=" apps/api/.env.example || echo "MISSING $v"; done` — expected: no `MISSING` output.
> - `grep -E '^NEXT_PUBLIC_(API|WS)_URL=' apps/web/.env.example` — expected: both lines present.
> - `git check-ignore apps/api/.env.example apps/web/.env.example` — expected: no output, exit 1 (tracked, not ignored).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P1-4 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P1-5 — Verification Gate (`pnpm infra:up` healthy · keyspace · `--profile tools`)

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** S (30–90 min)
- **Depends on:** `P1-1`, `P1-2`, `P1-3`, `P1-4`

### Description

Phase 1 "Definition of done" gate per `DEVELOPMENT_PLAN.md`: prove the stack actually works end to end. `pnpm infra:up` must report Redis **healthy** (the healthcheck gating `--wait` succeeds); `redis-cli config get notify-keyspace-events` must return a value containing `E` and `x` (the keyspace-expiry channel the TTL demo needs — matrix rows 8 / 12 / 19); and `docker compose --profile tools up` must serve RedisInsight at `127.0.0.1:5540`. Closes the phase. This is the infra prerequisite that unblocks the API and the TTL-expiry demo.

### Acceptance Criteria

- [x] `pnpm infra:up` (= `docker compose up -d --wait`) exits 0 and Redis reaches `healthy`.
- [x] `redis-cli config get notify-keyspace-events` returns a value containing both `E` and `x`.
- [x] `redis-cli ping` returns `PONG` against the loopback-bound `6379`.
- [x] `docker compose --profile tools up -d --wait` serves RedisInsight at `http://localhost:5540` (HTTP responds).
- [x] `pnpm infra:logs` streams the Redis container logs; `pnpm infra:down` stops the stack and `pnpm infra:nuke` removes the named volume.
- [x] On a bare `pnpm infra:up`, only the `redis` service is running (profiles dormant).

### Files to create / modify

- _(none — verification only; fix P1-1..P1-4 if a check fails)_

### Agent Execution Prompt

> Role: Senior platform / Node engineer validating local Docker infrastructure for a NestJS + Next.js example app.
> Context: Repo `nest-cache-example` is the reference app for `@bymax-one/nest-cache`. This is task **P1-5** of `docs/DEVELOPMENT_PLAN.md` §Phase 1. DoD (verbatim from the plan): "`pnpm infra:up` reports Redis healthy; `redis-cli config get notify-keyspace-events` returns a value containing `E` and `x`; `--profile tools` serves RedisInsight at `:5540`." The compose file (P1-1), the conf (P1-2), the profiles (P1-3), and the env templates (P1-4) all already exist. The Phase 0 root scripts are `infra:up` = `docker compose up -d --wait`, `infra:down`, `infra:nuke` = `docker compose down -v`, `infra:logs`. This is the infra prerequisite for matrix rows 8, 12, 19 (TTL / keyspace). Assume a working Docker daemon and a `redis-cli` available either on the host or via `docker compose exec redis redis-cli`.
> Objective: Confirm the whole local Redis stack is operational and close Phase 1.
> Steps:
>
> 1. Run `pnpm infra:up` and confirm it exits 0 with Redis `healthy` (e.g. `docker compose ps` shows `(healthy)`).
> 2. Confirm keyspace notifications: `docker compose exec redis redis-cli config get notify-keyspace-events` (or host `redis-cli -h 127.0.0.1 -p 6379 …`) returns a value containing `E` and `x`. Also confirm `redis-cli ping` → `PONG`.
> 3. Bring up the tools profile: `docker compose --profile tools up -d --wait`, then confirm RedisInsight answers on `127.0.0.1:5540` (e.g. `curl -fsS -o /dev/null -w '%{http_code}' http://localhost:5540` returns a 2xx/3xx). RedisInsight is `5540`, NOT `8001`.
> 4. Confirm only `redis` runs on a bare up (no profile services), and that `pnpm infra:logs` / `pnpm infra:down` / `pnpm infra:nuke` behave (stream logs, stop, and wipe the named volume respectively).
> 5. If any check fails, diagnose and fix in the corresponding earlier task file (P1-1..P1-4), then return here. Do NOT lower a healthcheck threshold or weaken the conf to make a check pass artificially.
> 6. Tear the stack down (`pnpm infra:down`, or `pnpm infra:nuke` to also drop the volume) when finished.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions. English-only.
> - All ports stay `127.0.0.1`-bound; default `up` is Redis-only; profiles are opt-in; RedisInsight is `5540`.
> - Do NOT skip the DoD; do NOT use `--no-verify`; do NOT weaken any threshold.
>   Verification:
> - `pnpm infra:up` — expected: exit 0, `docker compose ps` shows `redis` `(healthy)`.
> - `docker compose exec -T redis redis-cli config get notify-keyspace-events` — expected: a value containing `E` and `x`.
> - `docker compose exec -T redis redis-cli ping` — expected: `PONG`.
> - `docker compose --profile tools up -d --wait && curl -fsS -o /dev/null -w '%{http_code}' http://localhost:5540` — expected: a 2xx/3xx status.
> - `docker compose ps --services` (no profile) — expected: exactly `redis`.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P1-5 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

When this task is 🟢, Phase 1 is 5/5 — switch the Phase 1 row in `DEVELOPMENT_PLAN.md` Progress Summary to 🟢 Done.

⚠️ Never mark done with failing verification.

---

## Completion log

_(Agents append one line per finished task, newest at the bottom.)_

- P1-1 ✅ 2026-06-16 — Created `docker-compose.yml` with `redis:7-alpine`, healthcheck, loopback-bound port, named volume, and redis.conf mount.
- P1-2 ✅ 2026-06-16 — Created `docker/redis/redis.conf` enabling keyspace expiry notifications (`Ex`) and disabling persistence for dev.
- P1-3 ✅ 2026-06-16 — Added `tools` (RedisInsight :5540), `cluster` (6 nodes :7000–7005), and `sentinel` (1 master + 2 replicas + 3 sentinels :26379–26381) Docker Compose profiles with their config files.
- P1-4 ✅ 2026-06-16 — Created `apps/api/.env.example` (all 15 spec §9.1 vars) and `apps/web/.env.example` (2 `NEXT_PUBLIC_*` vars).
- P1-5 ✅ 2026-06-16 — Verified full stack: `infra:up` healthy, keyspace `xE`, PONG, RedisInsight HTTP 200 at :5540, `infra:down`/`infra:nuke` working.
- P1-3 (post-review fix) ✅ 2026-06-16 — Applied security/code-review findings: added `--cluster-announce-ip 127.0.0.1` to all 6 cluster nodes, added healthchecks to cluster/sentinel services, added `depends_on: condition: service_healthy` to sentinels, removed `:ro` from sentinel.conf mounts (Sentinel rewrites config on failover), pinned `redis/redisinsight:2` image, scrubbed phase-stage comment refs.
