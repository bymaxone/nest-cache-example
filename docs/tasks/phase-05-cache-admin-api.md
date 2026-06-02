# Phase 5 — Cache Admin API (Explorer backend) — Tasks

> **Source:** [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#phase-5--cache-admin-api-explorer-backend) §Phase 5
> **Total tasks:** 6
> **Progress:** 🔴 0 / 6 done (0%)
>
> **Status legend:** 🔴 Not Started · 🟡 In Progress · 🔵 In Review · 🟢 Done · ⚪ Blocked

## Task index

| ID   | Task                                                                  | Status | Priority | Size | Depends on       |
| ---- | --------------------------------------------------------------------- | ------ | -------- | ---- | ---------------- |
| P5-1 | `GET /admin/keys` — cursor-paged listing (`scan` \| `keys` strategy)  | 🔴     | High     | M    | Phase 3          |
| P5-2 | Single-key ops — inspect / delete / persist / expire                  | 🔴     | High     | M    | P5-1             |
| P5-3 | `POST /admin/seed?count=N` — bulk seed via `pipeline()`               | 🔴     | Medium   | S    | P5-1             |
| P5-4 | `DELETE /admin/namespace` — guarded `flushNamespace()`                | 🔴     | High     | S    | P5-1             |
| P5-5 | `GET /admin/info` + `GET /admin/keyspace` (INFO parser + breakdowns)  | 🔴     | High     | M    | P5-1             |
| P5-6 | `KeyQuery` Zod DTO + phase verification                               | 🔴     | Medium   | S    | P5-1..P5-5       |

---

## P5-1 — `GET /admin/keys` — cursor-paged listing (`scan` | `keys` strategy)

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** M (90 min–½ day)
- **Depends on:** `Phase 3`

### Description

Build the key-browser endpoint that backs the Explorer's main list (DASHBOARD §6) and the "drill into a prefix" pivots from the Overview breakdowns. The endpoint lists namespaced keys filtered by `prefix` / `pattern` / `tenant`, paged through a `strategy=scan|keys` query param. `scan` (default) drives `CacheService.scan(prefix, pattern, count?)` — a **non-blocking** cursor exposed as an `AsyncIterable<string>`, safe in production, standalone/sentinel only. `keys` drives `CacheService.keys(prefix, pattern)` — an **O(N) command that BLOCKS the Redis server**, dev-only; the response carries an explicit warning so the UI can render the persistent ⚠ badge. The match pattern is always composed through the library (`tenant ? \`tenant:${tenant}:${prefix}\` : prefix`), so the namespace is applied by the library and the returned keys are fully qualified (e.g. `cache-example:tenant:acme:product:1`). The browser **never** SCANs Redis directly — this server endpoint is the only path. Demonstrates matrix rows #23 (`scan`) and #24 (`keys`).

### Acceptance Criteria

- [ ] `src/admin/admin.module.ts`, `src/admin/admin.controller.ts`, `src/admin/admin.service.ts` exist; `AdminModule` imported by `app.module.ts`.
- [ ] `GET /admin/keys` accepts `?prefix=&pattern=&tenant=&strategy=scan|keys&cursor=&limit=` and validates them via the `KeyQuery` Zod schema (parsed by `ZodValidationPipe`; the schema itself lands in P5-6 — until then a local inline Zod object is acceptable and is replaced in P5-6).
- [ ] `strategy=scan` (default): consumes `CacheService.scan(matchPrefix, pattern ?? '*', limit ?? 200)` (the `AsyncIterable<string>`), accumulating up to `limit` keys, and returns `{ keys: string[], cursor: string | null, strategy: 'scan' }` (`cursor` is the opaque continuation token, `null` when exhausted).
- [ ] `strategy=keys`: calls `CacheService.keys(matchPrefix, pattern ?? '*')`, returns `{ keys: string[], cursor: null, strategy: 'keys', warning: 'O(N) command — blocks the Redis server, dev only' }`.
- [ ] The match prefix is composed as `tenant ? \`tenant:${tenant}:${prefix ?? ''}\` : (prefix ?? '')`; keys are returned **fully namespaced** (the library applies `cache-example:` — never re-prefixed by hand).
- [ ] In **cluster** mode `scan` surfaces the library's `CacheException('cache.unsupported_in_cluster')` unchanged (the `CacheExceptionFilter` from Phase 3 maps it to the structured body); the controller does not swallow it.
- [ ] Every public controller/service method carries JSDoc (no Swagger decorators anywhere).

### Files to create / modify

- `apps/api/src/admin/admin.module.ts` — `AdminModule` (imports the cache module, provides controller + service).
- `apps/api/src/admin/admin.controller.ts` — `GET /admin/keys` route.
- `apps/api/src/admin/admin.service.ts` — `listKeys(query)` (scan/keys dispatch + pattern composition).
- `apps/api/src/app.module.ts` — register `AdminModule`.

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer building a cache-admin API.
> Context: Repo `nest-cache-example` is the reference app for `@bymax-one/nest-cache` (see `docs/DEVELOPMENT_PLAN.md` §Phase 5 + §2 Global Conventions, `docs/TECHNICAL_SPECIFICATION.md` §10–§11, and `docs/DASHBOARD.md` §6 + §16 + §17). This is task P5-1. The `admin` module is the Explorer backend; it reads the single Redis **only** through the library's `CacheService` facade. The library's `CacheService.scan(prefix, pattern, count?)` returns an `AsyncIterable<string>` (non-blocking cursor, **standalone/sentinel only** — throws `CacheException('cache.unsupported_in_cluster')` in cluster mode); `CacheService.keys(prefix, pattern)` returns `Promise<string[]>` and is **O(N), blocks the server, dev-only**. Both return **fully namespaced** keys.
> Objective: Implement the `AdminModule` skeleton and the `GET /admin/keys` cursor-paged listing with a `scan|keys` strategy toggle.
> Steps:
>
> 1. Create `apps/api/src/admin/admin.module.ts` — a `@Module` providing `AdminController` + `AdminService`; import the app's cache module (which re-exports `BymaxCacheModule`, so `CacheService` is injectable). Register `AdminModule` in `apps/api/src/app.module.ts`.
> 2. Create `apps/api/src/admin/admin.service.ts` with `AdminService` injecting `CacheService`:
>
>    ```ts
>    /**
>     * Lists namespaced keys, paged via SCAN (non-blocking) or KEYS (O(N), dev only).
>     * @param query - Validated key-browser query (prefix/pattern/tenant/strategy/cursor/limit).
>     * @returns The matched fully-namespaced keys plus the next cursor and the strategy used.
>     */
>    async listKeys(query: KeyQuery): Promise<KeyListResult> {
>      const matchPrefix = query.tenant
>        ? `tenant:${query.tenant}:${query.prefix ?? ''}`
>        : (query.prefix ?? '')
>      const pattern = query.pattern ?? '*'
>      const limit = query.limit ?? 200
>
>      if (query.strategy === 'keys') {
>        // ⚠ O(N) — blocks the Redis server. Dev-only; surfaced to the UI as a warning.
>        const keys = await this.cache.keys(matchPrefix, pattern)
>        return { keys, cursor: null, strategy: 'keys', warning: KEYS_BLOCKING_WARNING }
>      }
>
>      // scan: non-blocking cursor (AsyncIterable<string>), standalone/sentinel only.
>      const keys: string[] = []
>      for await (const key of this.cache.scan(matchPrefix, pattern, limit)) {
>        keys.push(key)
>        if (keys.length >= limit) break
>      }
>      return { keys, cursor: keys.length >= limit ? keys.at(-1) ?? null : null, strategy: 'scan' }
>    }
>    ```
>
>    Define `KEYS_BLOCKING_WARNING = 'O(N) command — blocks the Redis server, dev only'` and the `KeyListResult` return type (`{ keys: string[]; cursor: string | null; strategy: 'scan' | 'keys'; warning?: string }`).
> 3. Create `apps/api/src/admin/admin.controller.ts` with `@Controller('admin')` and a `@Get('keys')` handler that reads the query through the `ZodValidationPipe` (from `common/`, Phase 3) bound to the `KeyQuery` schema, then delegates to `AdminService.listKeys`. Until P5-6 lands the shared schema, define a local `keyQuerySchema` inline and re-point it to `admin/dto/key-query.dto.ts` in P5-6.
> 4. Do **not** catch `CacheException` — let it propagate to the global `CacheExceptionFilter` (so the cluster `cache.unsupported_in_cluster` case yields the structured `{ error: { code, message, details } }` body automatically).
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions (strict TS, ESM, English-only, JSDoc on every public method).
> - **No Swagger** — document with JSDoc, validate with Zod (`docs/TECHNICAL_SPECIFICATION.md` §23.4).
> - Never compose keys by hand-prefixing the namespace — the library applies `cache-example:`; only the `prefix`/`tenant` segments are built here.
> - The browser must never SCAN Redis — this endpoint is the only listing path (DASHBOARD §5, §15 bounded-dimension rule).
> - Do NOT add a `keys`-strategy default; `scan` is the safe default and `keys` is opt-in with the blocking warning.
>   Verification:
> - `pnpm --filter @nest-cache-example/api typecheck` — expected: exit 0.
> - `pnpm --filter @nest-cache-example/api lint` — expected: exit 0.
> - `pnpm --filter @nest-cache-example/api dev` then `curl 'http://localhost:3001/admin/keys?prefix=product&strategy=scan'` — expected: `200` with `{ keys: [...], cursor: ..., strategy: "scan" }` and every key beginning `cache-example:`.
> - `curl 'http://localhost:3001/admin/keys?prefix=product&strategy=keys'` — expected: `200` with a `warning` field present.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P5-1 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

If phase reaches 100%, switch its row status in `DEVELOPMENT_PLAN.md` to 🟢.

⚠️ Never mark done with failing verification.

---

## P5-2 — Single-key ops — inspect / delete / persist / expire

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** M (90 min–½ day)
- **Depends on:** `P5-1`

### Description

The detail-drawer backend (DASHBOARD §6 "Detail drawer"). `GET /admin/keys/:key` inspects a single key end to end: the **decoded value by Redis type** (`get` for strings, `hgetall` for hashes, `smembers` for sets — chosen after a `TYPE` probe via the raw client), the **raw stored string** (`getRaw`, for the serializer story), the **TTL** (`ttl`), and the **per-key byte size** via Redis `MEMORY USAGE <key>` issued through `getClient()` (the raw escape hatch). `DELETE /admin/keys/:key` removes it (`del`). `POST /admin/keys/:key/persist` clears the TTL (`persist`, ring → ∞) and `POST /admin/keys/:key/expire` sets a new TTL (`expire`, the "Extend +60s" action). The incoming `:key` is the **fully-namespaced** key the Explorer already holds; because `CacheService` re-applies the namespace, single-key ops here must operate against the **raw** key via `getClient()` / `getRaw` semantics OR strip the namespace prefix (via `KeyBuilder.getNamespacePrefix()`) before calling the namespaced facade — the prompt fixes the exact approach. Demonstrates matrix rows #16 (`del`), #19 (`ttl`/`persist`/`expire`), #26-style raw `getClient()` usage for `MEMORY USAGE`.

### Acceptance Criteria

- [ ] `GET /admin/keys/:key` returns `{ key, type, value, raw, ttl, memoryBytes }` where `value` is decoded per type (`get` | `hgetall` | `smembers`), `raw` is the verbatim stored string via `getClient().get(fullKey)` (the raw escape hatch — not the namespaced `getRaw` facade), `ttl` is `ttl` (seconds; `-1` persisted, `-2` missing), and `memoryBytes` is `MEMORY USAGE <key>` via `getClient()`.
- [ ] Key type is resolved with a `TYPE <key>` probe (raw client) and dispatched: `string → get`, `hash → hgetall`, `set → smembers`; unknown/none → `404` (or a `{ value: null }` shape — the prompt pins it).
- [ ] `DELETE /admin/keys/:key` calls `del` and returns `{ deleted: number }`.
- [ ] `POST /admin/keys/:key/persist` calls `persist` and returns the resulting `{ ttl: -1 }`.
- [ ] `POST /admin/keys/:key/expire` accepts `{ seconds }` (Zod body), calls `expire`, returns the new `{ ttl }`.
- [ ] Namespace handling is correct and documented: the `:key` arrives fully-namespaced; the service either strips `KeyBuilder.getNamespacePrefix()` before the namespaced facade calls **or** uses the raw client consistently — no double-namespacing (a key is never written as `cache-example:cache-example:…`).
- [ ] In **cluster** mode the `MEMORY USAGE` path (which needs `getClient()`) surfaces `cache.unsupported_in_cluster` via the filter.
- [ ] JSDoc on every public method; no Swagger.

### Files to create / modify

- `apps/api/src/admin/admin.controller.ts` — add `GET/:key`, `DELETE/:key`, `POST/:key/persist`, `POST/:key/expire`.
- `apps/api/src/admin/admin.service.ts` — add `inspectKey`, `deleteKey`, `persistKey`, `expireKey`.

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer.
> Context: Task P5-2 of `docs/DEVELOPMENT_PLAN.md` §Phase 5; backs the Explorer detail drawer (`docs/DASHBOARD.md` §6) and the TTL ring controls (spec §12.1). Relevant library API (`docs/TECHNICAL_SPECIFICATION.md` §4): `CacheService.get<T>(prefix, id)` / `hgetall<T>(prefix, id)` / `smembers(prefix, id)` / `getRaw(prefix, id)` / `ttl(prefix, id)` / `del(prefix, id)` / `persist(prefix, id)` / `expire(prefix, id, seconds)` — all **namespaced**. `CacheService.getClient(): Redis` is the raw escape hatch (throws `cache.unsupported_in_cluster` in cluster) used here for `TYPE` and `MEMORY USAGE`. `KeyBuilder.getNamespacePrefix()` returns the leading `cache-example:` segment.
> Objective: Implement single-key inspect / delete / persist / expire.
> Steps:
>
> 1. Decide the key-handling contract and document it inline: the Explorer holds **fully-namespaced** keys (e.g. `cache-example:product:42`). For literal-key reads (`TYPE`, `MEMORY USAGE`, and the raw stored string via `getClient().get(fullKey)`) use `getClient()` directly with the full key — the namespaced `getRaw` facade is NOT used here (it would re-prefix the already-namespaced key). For the typed facade reads (`get`/`hgetall`/`smembers`) split the full key into `(prefix, id)` after stripping `KeyBuilder.getNamespacePrefix()` so the facade re-applies the namespace exactly once. Add a small private `splitNamespacedKey(fullKey): { prefix, id }` helper.
> 2. `inspectKey(fullKey)`: `const client = this.cache.getClient()`; `const type = await client.type(fullKey)`; dispatch decode by `type`; `const raw = await client.get(fullKey)` (raw client + literal key — NOT the namespaced `getRaw` facade, which would re-apply the prefix); `const ttl = await client.ttl(fullKey)`; `const memoryBytes = Number(await client.memory('USAGE', fullKey))`. Return `{ key: fullKey, type, value, raw, ttl, memoryBytes }`. If `type === 'none'` → throw `NotFoundException` (NestJS) so it maps to `404`.
> 3. `deleteKey`, `persistKey`, `expireKey`: split the key, call the namespaced facade (`del`/`persist`/`expire`), and return the result/ resulting TTL.
> 4. Wire the four routes in `admin.controller.ts` with JSDoc; the `expire` body (`{ seconds: number }`) is validated by a Zod schema through `ZodValidationPipe`.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - **No Swagger** (JSDoc + Zod).
> - Use `getClient()` for raw key commands (`TYPE`, `MEMORY USAGE`) — these have no facade method (matrix #26 raw-client demonstration). Per-key `MEMORY USAGE` is fetched on demand, never for every row up front (DASHBOARD §6 callout).
> - Never double-namespace: a full key passed to the namespaced facade must first have its namespace prefix stripped.
> - Let `CacheException` propagate to the filter; do not catch it.
>   Verification:
> - `pnpm --filter @nest-cache-example/api typecheck && pnpm --filter @nest-cache-example/api lint` — expected: exit 0.
> - Seed a key (P5-3 or the catalog), then `curl http://localhost:3001/admin/keys/cache-example:product:42` — expected: `{ type:"string", value:{…}, raw:"…", ttl:<n>, memoryBytes:<n> }`.
> - `curl -X POST http://localhost:3001/admin/keys/cache-example:product:42/persist` — expected: `{ ttl: -1 }`.
> - `curl -X POST -H 'content-type: application/json' -d '{"seconds":120}' http://localhost:3001/admin/keys/cache-example:product:42/expire` — expected: `{ ttl: 120 }` (±1).
> - `curl -X DELETE http://localhost:3001/admin/keys/cache-example:product:42` — expected: `{ deleted: 1 }`.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P5-2 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P5-3 — `POST /admin/seed?count=N` — bulk seed via `pipeline()`

- **Status:** 🔴 Not Started
- **Priority:** Medium
- **Size:** S (30–90 min)
- **Depends on:** `P5-1`

### Description

The Explorer/Tenants "Seed N keys" action (DASHBOARD §6, §8). Writes `N` demo keys in **one round-trip** using `CacheService.pipeline()`, which returns ioredis' `ChainableCommander`. The teaching point baked in here: **pipeline keys are NOT auto-namespaced** — unlike the typed facade, the raw pipeline writes literal keys — so every key must be composed through `KeyBuilder.build(prefix, id)` to keep it inside the `cache-example:` namespace. This demonstrates matrix row #25 (`pipeline()`) and the `KeyBuilder.build` half of #36. `KeyBuilder` is injected via the `BYMAX_CACHE_KEY_BUILDER` token.

### Acceptance Criteria

- [ ] `POST /admin/seed?count=N` accepts `count` (Zod-validated positive integer, sane upper bound e.g. ≤ 10_000, default 50) and seeds that many keys via a single `pipeline()` flush.
- [ ] Keys are composed with `KeyBuilder.build('product', String(i))` (or a documented demo prefix) — **never** a hand-built string — so they land under `cache-example:`.
- [ ] An inline comment states explicitly that `pipeline()` keys are **not** auto-namespaced and that `KeyBuilder` is therefore mandatory here.
- [ ] `KeyBuilder` is injected via the `BYMAX_CACHE_KEY_BUILDER` token (`@Inject(BYMAX_CACHE_KEY_BUILDER) keyBuilder: KeyBuilder`).
- [ ] Returns `{ seeded: number }`; the seeded keys are subsequently visible via `GET /admin/keys?prefix=product`.
- [ ] JSDoc on the new method; no Swagger.

### Files to create / modify

- `apps/api/src/admin/admin.controller.ts` — add `POST seed`.
- `apps/api/src/admin/admin.service.ts` — add `seed(count)` (uses `pipeline()` + injected `KeyBuilder`).

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer.
> Context: Task P5-3 of `docs/DEVELOPMENT_PLAN.md` §Phase 5; the bulk-seed action behind the Explorer/Tenants seed buttons (`docs/DASHBOARD.md` §6, §8). Critical library facts (`docs/TECHNICAL_SPECIFICATION.md` §4): `CacheService.pipeline(): ChainableCommander` returns a raw ioredis pipeline whose **keys are NOT auto-namespaced**; you must compose each key via `KeyBuilder.build(prefix, id)` (the library's key composer — `{namespace}{sep}{prefix}{sep}{id}`). Inject the `KeyBuilder` through the `BYMAX_CACHE_KEY_BUILDER` injection token (matrix #12, #36).
> Objective: Implement `POST /admin/seed?count=N` using a single pipelined flush of namespaced keys.
> Steps:
>
> 1. Inject the key builder in `AdminService`: `constructor(private readonly cache: CacheService, @Inject(BYMAX_CACHE_KEY_BUILDER) private readonly keyBuilder: KeyBuilder) {}`.
> 2. Implement `seed(count)`:
>
>    ```ts
>    /**
>     * Seeds `count` demo products in one round-trip via a raw pipeline.
>     * NOTE: pipeline() keys are NOT auto-namespaced — KeyBuilder.build() is mandatory.
>     * @param count - Number of keys to write (validated upstream).
>     * @returns The number of keys seeded.
>     */
>    async seed(count: number): Promise<{ seeded: number }> {
>      const pipeline = this.cache.pipeline()
>      for (let i = 1; i <= count; i++) {
>        const key = this.keyBuilder.build('product', String(i)) // → cache-example:product:i
>        pipeline.set(key, JSON.stringify({ id: String(i), name: `Seeded #${i}`, priceCents: i * 100, tags: ['seed'], stock: i }))
>      }
>      await pipeline.exec()
>      return { seeded: count }
>    }
>    ```
>
> 3. Add `@Post('seed')` to the controller reading `count` from `@Query()` through a Zod schema (positive int, default 50, max 10_000) via `ZodValidationPipe`.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - **No Swagger** (JSDoc + Zod).
> - Do NOT hand-build the namespace into the key string — always go through `KeyBuilder.build`. The inline NOTE comment about pipeline keys not being namespaced is required (it is the teaching point).
> - Cap `count` to avoid an accidental unbounded flush.
>   Verification:
> - `pnpm --filter @nest-cache-example/api typecheck && pnpm --filter @nest-cache-example/api lint` — expected: exit 0.
> - `curl -X POST 'http://localhost:3001/admin/seed?count=25'` — expected: `{ seeded: 25 }`.
> - `curl 'http://localhost:3001/admin/keys?prefix=product&strategy=scan'` — expected: the 25 keys appear, each prefixed `cache-example:product:`.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P5-3 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P5-4 — `DELETE /admin/namespace` — guarded `flushNamespace()`

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** S (30–90 min)
- **Depends on:** `P5-1`

### Description

The Explorer header "Flush namespace" button and the Tenants isolation proof (DASHBOARD §6, §8; spec §12.3). `DELETE /admin/namespace` calls `CacheService.flushNamespace()`, which SCANs + UNLINKs every key scoped to `{namespace}{sep}*` (i.e. `cache-example:*`) and returns the count removed — proving keys seeded under a *foreign* namespace survive. The endpoint must surface the library's **production guard** honestly: `flushNamespace()` throws `FLUSH_DISABLED_IN_PRODUCTION` (→ HTTP `403`, code `cache.flush_disabled_in_production`) unless the module was configured with `allowFlushInProduction: true`; in **cluster** mode it throws `UNSUPPORTED_IN_CLUSTER`. Both must reach the client as the structured filter body (matrix #27; error story in spec §19, DASHBOARD §13).

### Acceptance Criteria

- [ ] `DELETE /admin/namespace` calls `CacheService.flushNamespace()` and returns `{ flushed: number }` (the count of keys removed) on success.
- [ ] When the API runs with `NODE_ENV=production` and `ALLOW_FLUSH_IN_PRODUCTION=false`, the endpoint yields `403` with body `{ error: { code: "cache.flush_disabled_in_production", message, details } }` — produced by the global `CacheExceptionFilter`, **not** caught/re-thrown here.
- [ ] In **cluster** mode it yields the `cache.unsupported_in_cluster` structured body via the filter.
- [ ] The controller does NOT swallow `CacheException`; it lets the filter map it.
- [ ] JSDoc documents the guard behaviour (production + cluster) inline; no Swagger.

### Files to create / modify

- `apps/api/src/admin/admin.controller.ts` — add `DELETE namespace`.
- `apps/api/src/admin/admin.service.ts` — add `flushNamespace()` passthrough.

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer.
> Context: Task P5-4 of `docs/DEVELOPMENT_PLAN.md` §Phase 5; the guarded "flush all" behind the Explorer header + Tenants isolation proof (`docs/DASHBOARD.md` §6, §8; spec §12.3, §19). Library fact (`docs/TECHNICAL_SPECIFICATION.md` §4): `CacheService.flushNamespace(): Promise<number>` runs `SCAN` + `UNLINK` scoped to `{namespace}{separator}*` and is **production-guarded** — it throws `CacheException` with code `cache.flush_disabled_in_production` (HTTP 403) unless the module options set `allowFlushInProduction: true`; in cluster mode it throws `cache.unsupported_in_cluster`.
> Objective: Expose `DELETE /admin/namespace` as a thin passthrough that lets both guards surface through the global filter.
> Steps:
>
> 1. Add `AdminService.flushNamespace(): Promise<{ flushed: number }>` → `return { flushed: await this.cache.flushNamespace() }`. Do not wrap in try/catch.
> 2. Add a `@Delete('namespace')` controller route delegating to it. JSDoc must state: clears only `cache-example:*`; `403 cache.flush_disabled_in_production` in production unless `allowFlushInProduction` is set; `cache.unsupported_in_cluster` in cluster mode.
> 3. Confirm the global `CacheExceptionFilter` (Phase 3) is registered so the thrown `CacheException` becomes the structured `{ error: { code, message, details } }` body with the correct status — add nothing local.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - **No Swagger** (JSDoc + Zod).
> - Do NOT catch `CacheException` — the production guard and cluster guard MUST reach the client verbatim (this honesty is the demonstration, spec §G2).
> - Do NOT set `allowFlushInProduction` here; it stays driven by env (`ALLOW_FLUSH_IN_PRODUCTION`, default `false`) — see spec §9.
>   Verification:
> - `pnpm --filter @nest-cache-example/api typecheck && pnpm --filter @nest-cache-example/api lint` — expected: exit 0.
> - In `development`: seed keys, then `curl -X DELETE http://localhost:3001/admin/namespace` — expected: `{ flushed: <n> }`; a re-`scan` shows the namespace empty.
> - With `NODE_ENV=production ALLOW_FLUSH_IN_PRODUCTION=false`: `curl -i -X DELETE http://localhost:3001/admin/namespace` — expected: `HTTP/1.1 403` and body code `cache.flush_disabled_in_production`.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P5-4 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P5-5 — `GET /admin/info` + `GET /admin/keyspace` (INFO parser + breakdowns)

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** M (90 min–½ day)
- **Depends on:** `P5-1`

### Description

The data behind the Overview health strip + keyspace breakdowns and the Connection page INFO grid (DASHBOARD §5, §14, §15, §17.2). `GET /admin/info?section=` calls `CacheService.info(section?)` and parses Redis' raw INFO text into a nested record via a dedicated `src/admin/info.parser.ts` (`# Section` headers split groups; `field:value\r\n` lines split fields). `GET /admin/keyspace` returns the three **bounded-dimension** breakdowns the charts consume: **keys-by-type** (donut: string/hash/set), **memory-by-prefix** (horizontal bar, sampled `MEMORY USAGE` per prefix), and **expiry-analysis** (% keys with vs without TTL) — all built **server-side** by sampling a bounded SCAN window (never per-key, never the whole keyspace), so the browser never crunches raw keys. Demonstrates matrix row #29 (`info()`) and reinforces the bounded-dimension rule (DASHBOARD §15).

### Acceptance Criteria

- [ ] `src/admin/info.parser.ts` exports `parseInfo(raw: string): Record<string, Record<string, string>>` — groups by `# Section`, splits `field:value` on `\r\n`, ignores blank/comment lines.
- [ ] `GET /admin/info?section=` validates `section` (optional; one of the known sections e.g. `server|clients|memory|stats|replication`, Zod) and returns `parseInfo(await cache.info(section))`.
- [ ] `GET /admin/keyspace` returns `{ byType: {string,hash,set}, byPrefix: Array<{prefix, bytes}>, expiry: { withTtl, noTtl } }`.
- [ ] All three breakdowns are computed from a **bounded sample** (a capped SCAN window, e.g. ≤ ~1000 keys) — never an unbounded keys scan, never per-key charting; dimensions are limited to data-type / prefix (bounded cardinality, DASHBOARD §15).
- [ ] `byPrefix` memory uses `MEMORY USAGE` on the sampled keys, aggregated by the leading entity prefix.
- [ ] An inline comment / JSDoc labels these as **sampled** (RedisInsight-style analyzer), matching the §6/§5 scoped-demo callouts.
- [ ] JSDoc on every public method; no Swagger.

### Files to create / modify

- `apps/api/src/admin/info.parser.ts` — `parseInfo()`.
- `apps/api/src/admin/admin.controller.ts` — add `GET info`, `GET keyspace`.
- `apps/api/src/admin/admin.service.ts` — add `getInfo(section?)`, `getKeyspaceBreakdown()`.

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer.
> Context: Task P5-5 of `docs/DEVELOPMENT_PLAN.md` §Phase 5; feeds the Overview breakdowns + Connection INFO grid (`docs/DASHBOARD.md` §5, §14, §15, §17.2). Library facts (`docs/TECHNICAL_SPECIFICATION.md` §4): `CacheService.info(section?): Promise<string>` returns raw Redis INFO text; `CacheService.scan(...)` (bounded SCAN) + `getClient()` (`TYPE`, `TTL`, `MEMORY USAGE`) build the breakdowns. **Bounded-dimension rule** (DASHBOARD §15): only ever group by data-type / prefix / namespace / tenant — never per individual key; the browser never SCANs for charts (DASHBOARD §5, §17).
> Objective: Implement the INFO parser, `GET /admin/info`, and the sampled `GET /admin/keyspace` breakdowns.
> Steps:
>
> 1. Create `apps/api/src/admin/info.parser.ts`:
>
>    ```ts
>    /**
>     * Parses raw Redis INFO text into a nested record.
>     * INFO is `field:value\r\n` lines grouped under `# Section` headers.
>     * @param raw - The raw string returned by CacheService.info().
>     * @returns A record of section → { field: value }.
>     */
>    export function parseInfo(raw: string): Record<string, Record<string, string>> {
>      const out: Record<string, Record<string, string>> = {}
>      let section = 'default'
>      for (const line of raw.split('\r\n')) {
>        if (!line || line.startsWith('#')) {
>          if (line.startsWith('# ')) section = line.slice(2).trim().toLowerCase()
>          continue
>        }
>        const idx = line.indexOf(':')
>        if (idx === -1) continue
>        ;(out[section] ??= {})[line.slice(0, idx)] = line.slice(idx + 1)
>      }
>      return out
>    }
>    ```
>
> 2. `AdminService.getInfo(section?)` → `parseInfo(await this.cache.info(section))`.
> 3. `AdminService.getKeyspaceBreakdown()`: SCAN a **bounded** window (cap the iteration, e.g. stop after ~1000 keys), and for each sampled key use `getClient()` `TYPE`/`TTL`/`MEMORY USAGE` to accumulate: `byType` (counts per string/hash/set), `byPrefix` (summed bytes per leading entity prefix — strip the namespace, take the first segment), and `expiry` (`withTtl` vs `noTtl` by `TTL >= 0`). Return the three bounded aggregates only.
> 4. Add `@Get('info')` (Zod-validated optional `section`) and `@Get('keyspace')` to the controller, with JSDoc; both delegate to the service.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - **No Swagger** (JSDoc + Zod).
> - NEVER chart/aggregate per individual key — only data-type and prefix dimensions (bounded). Sample a capped SCAN window; do NOT use `keys` and do NOT scan the entire keyspace.
> - Label the breakdowns as **sampled** in JSDoc/inline (matches the scoped-demo callouts in DASHBOARD §5/§6).
> - Let `CacheException` propagate to the filter.
>   Verification:
> - `pnpm --filter @nest-cache-example/api typecheck && pnpm --filter @nest-cache-example/api lint` — expected: exit 0.
> - `curl 'http://localhost:3001/admin/info?section=memory'` — expected: `{ memory: { used_memory: "…", maxmemory: "…", … } }`.
> - `curl http://localhost:3001/admin/keyspace` — expected: `{ byType:{string,hash,set}, byPrefix:[{prefix,bytes},…], expiry:{withTtl,noTtl} }`.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P5-5 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P5-6 — `KeyQuery` Zod DTO + phase verification

- **Status:** 🔴 Not Started
- **Priority:** Medium
- **Size:** S (30–90 min)
- **Depends on:** `P5-1`, `P5-2`, `P5-3`, `P5-4`, `P5-5`

### Description

Promote the key-browser query contract into a single shared `src/admin/dto/key-query.dto.ts` Zod schema (`KeyQuery`) and re-point every admin route at it, replacing any inline schemas from P5-1..P5-5. The schema mirrors the `KeyQuery` interface in DASHBOARD §16 (`prefix?`, `pattern?`, `tenant?`, `type?: 'string'|'hash'|'set'`, `hasTtl?`, `strategy: 'scan'|'keys'` with `scan` default, `cursor?`, `limit?` default 200). Then run the Phase 5 verification gate that proves the whole admin surface typechecks, lints, and answers correctly, and that the `scan`/`keys`/`flushNamespace` library semantics behave as documented (matrix rows #16, #23, #24, #25, #27, #29, #36 demonstrated). Closes the phase.

### Acceptance Criteria

- [ ] `src/admin/dto/key-query.dto.ts` exports `keyQuerySchema` (Zod) and `type KeyQuery = z.infer<typeof keyQuerySchema>`; `strategy` defaults to `'scan'`, `limit` defaults to `200` (coerced from the query string), `type` is the `'string'|'hash'|'set'` enum, `hasTtl` is a coerced boolean.
- [ ] `admin.controller.ts` validates `GET /admin/keys` through `keyQuerySchema` (inline schema from P5-1 removed); other routes' bodies/params keep their own small Zod schemas in the same `dto/` folder.
- [ ] `apps/api` `typecheck` + `lint` are clean.
- [ ] All seven admin routes answer correctly end to end against a live Redis: `GET /admin/keys` (both strategies), `GET/DELETE /admin/keys/:key`, `POST /admin/keys/:key/persist|expire`, `POST /admin/seed`, `DELETE /admin/namespace`, `GET /admin/info`, `GET /admin/keyspace`.
- [ ] The library-semantics checks pass: `scan` returns namespaced keys non-blocking; `keys` returns the same set with a blocking warning; `flushNamespace` clears only `cache-example:*`; `info` parses to a nested record.
- [ ] JSDoc on the schema's exported symbols; no Swagger anywhere in the module.

### Files to create / modify

- `apps/api/src/admin/dto/key-query.dto.ts` — `keyQuerySchema` + `KeyQuery` type.
- `apps/api/src/admin/admin.controller.ts` — import the shared schema; drop the inline one.
- _(verification only for the rest — fix earlier P5 task files if a check fails)_

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer.
> Context: Task P5-6 of `docs/DEVELOPMENT_PLAN.md` §Phase 5; defines the canonical `KeyQuery` DTO (`docs/DASHBOARD.md` §16) and closes the phase. No Swagger — validation is Zod, docs are JSDoc (spec §23.4). Matrix rows demonstrated by Phase 5: #16 (`del`), #23 (`scan`), #24 (`keys`), #25 (`pipeline`), #27 (`flushNamespace`), #29 (`info`), #36 (`KeyBuilder.build`).
> Objective: Create the shared `KeyQuery` schema, re-point the routes, and run the phase verification gate.
> Steps:
>
> 1. Create `apps/api/src/admin/dto/key-query.dto.ts`:
>
>    ```ts
>    import { z } from 'zod'
>
>    /** Validated query for the key-browser endpoint (GET /admin/keys). */
>    export const keyQuerySchema = z.object({
>      prefix: z.string().optional(),
>      pattern: z.string().optional(),
>      tenant: z.string().optional(),
>      type: z.enum(['string', 'hash', 'set']).optional(),
>      hasTtl: z.coerce.boolean().optional(),
>      strategy: z.enum(['scan', 'keys']).default('scan'),
>      cursor: z.string().optional(),
>      limit: z.coerce.number().int().positive().max(1000).default(200),
>    })
>
>    /** Inferred key-browser query type. */
>    export type KeyQuery = z.infer<typeof keyQuerySchema>
>    ```
>
> 2. Update `admin.controller.ts` to validate `GET /admin/keys` with this schema via `ZodValidationPipe`; delete the inline schema introduced in P5-1. Keep the small per-route body schemas (e.g. `expire`'s `{ seconds }`, `seed`'s `{ count }`) co-located under `dto/`.
> 3. Run the verification gate (below). If anything fails, fix it in the corresponding P5-1..P5-5 task file, then return here.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - **No Swagger** (JSDoc + Zod) anywhere in `admin/`.
> - `strategy` MUST default to `'scan'`; `keys` is opt-in only.
> - Do NOT introduce a second source of truth for the query shape — the controller imports this schema; no duplicated inline copy remains.
>   Verification:
> - `pnpm --filter @nest-cache-example/api typecheck` — expected: exit 0.
> - `pnpm --filter @nest-cache-example/api lint` — expected: exit 0.
> - With Redis up + a seed (`curl -X POST 'http://localhost:3001/admin/seed?count=20'`): `curl 'http://localhost:3001/admin/keys?prefix=product&strategy=scan'` returns 20 namespaced keys; `…&strategy=keys` returns the same set plus a `warning`; `curl http://localhost:3001/admin/keyspace` returns the three bounded breakdowns; `curl 'http://localhost:3001/admin/info?section=stats'` parses to `{ stats: { keyspace_hits, keyspace_misses, … } }`; `curl -X DELETE http://localhost:3001/admin/namespace` returns `{ flushed: 20 }`.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P5-6 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

When this task is 🟢, Phase 5 is 6/6 — switch the Phase 5 row in `DEVELOPMENT_PLAN.md` Progress Summary to 🟢 Done.

⚠️ Never mark done with failing verification.

---

## Completion log

_(Agents append one line per finished task, newest at the bottom.)_
