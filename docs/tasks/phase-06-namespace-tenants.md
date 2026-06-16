# Phase 6 — Namespace Isolation & Tenants — Tasks

> **Source:** [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#phase-6--namespace-isolation--tenants) §Phase 6
> **Total tasks:** 5
> **Progress:** 🟢 5 / 5 done (100%)
>
> **Status legend:** 🔴 Not Started · 🟡 In Progress · 🔵 In Review · 🟢 Done · ⚪ Blocked

## Task index

| ID   | Task                                                                  | Status | Priority | Size | Depends on |
| ---- | --------------------------------------------------------------------- | ------ | -------- | ---- | ---------- |
| P6-1 | `src/tenants/` module + tenant-scoped reads/writes (`KeyBuilder`)     | 🟢     | High     | M    | Phase 4    |
| P6-2 | `DELETE /tenants/:t/cache` — clear ONE tenant (`scan` → `delMany`)    | 🟢     | High     | S    | P6-1       |
| P6-3 | `POST /tenants/seed-foreign` — foreign-namespace seed via `getClient` | 🟢     | Medium   | S    | P6-1       |
| P6-4 | Isolation proof — `flushNamespace()` + per-instance design note       | 🟢     | High     | S    | P6-1, P6-3 |
| P6-5 | Phase verification (clear A leaves B; flush leaves foreign key)       | 🟢     | Medium   | S    | P6-1..P6-4 |

---

## P6-1 — `src/tenants/` Module + Tenant-Scoped Reads/Writes (`KeyBuilder`)

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** M (90 min–½ day)
- **Depends on:** `Phase 4`

### Description

Build the `tenants` module that backs the Namespace & Tenants page (DASHBOARD §8) and proves the **in-namespace per-tenant prefix** story honestly. A tenant is **not** a separate namespace — the library binds **one `namespace` per module instance** (`cache-example`). Multi-tenancy is therefore modeled as **prefix scoping within the single namespace**: keys read `cache-example:tenant:{tenantId}:product:{id}`, where `tenant:{tenantId}:product` is the leading-segment **prefix** handed to the library's `KeyBuilder` (spec §12.4). This task wires the module skeleton and the tenant-scoped read/write path: `GET /tenants/:t/products/:id` reads `get<Product>(tenant:{t}:product, id)` and, on a miss, populates it (read-through, mirroring `catalog`) so each tenant accumulates its own keys under its own prefix. The prefix is always composed through the library — directly via the injected `KeyBuilder.build(prefix, id)` (token `BYMAX_CACHE_KEY_BUILDER`) when a literal key string is needed, and implicitly by every typed `CacheService` call. Keys are returned **fully namespaced** (the library applies `cache-example:` — never re-prefixed by hand). Demonstrates matrix row #36 (`KeyBuilder.build` / `applyNamespace` / `getNamespacePrefix`).

### Acceptance Criteria

- [x] `apps/api/src/tenants/tenants.module.ts`, `apps/api/src/tenants/tenants.controller.ts`, `apps/api/src/tenants/tenants.service.ts` exist; `TenantsModule` is imported by `apps/api/src/app.module.ts`.
- [x] `TenantsService` injects `CacheService` and the library's `KeyBuilder` via the `BYMAX_CACHE_KEY_BUILDER` token (`@Inject(BYMAX_CACHE_KEY_BUILDER) private readonly keyBuilder: KeyBuilder`).
- [x] The tenant prefix is composed as `tenant:{tenantId}:product` (a single helper `tenantPrefix(tenantId): CacheKeyPrefix` builds it); reads/writes use `cache.get<Product>(tenantPrefix(t), id)` / `cache.set<Product>(tenantPrefix(t), id, value, ttlSeconds)` so the library applies the namespace.
- [x] `GET /tenants/:t/products/:id` returns the cached product when present; on a miss it loads from the in-memory origin (reuse / mirror the `catalog` origin), populates the tenant-scoped key with a TTL, and returns `{ data, source: 'origin' | 'cache' }`.
- [x] A read-back through `KeyBuilder.build(tenantPrefix(t), id)` (or `applyNamespace`) confirms the composed key equals `cache-example:tenant:{t}:product:{id}` — asserted in the verification step, not hand-built in business logic.
- [x] The `:t` path segment is validated (Zod) to a safe tenant-id shape (e.g. `^[a-z0-9-]{1,32}$`) by the `ZodValidationPipe` so a tenant id can never inject extra key segments.
- [x] Every public controller/service method carries JSDoc (no Swagger decorators anywhere).

### Files to create / modify

- `apps/api/src/tenants/tenants.module.ts` — `TenantsModule` (imports the app cache module, provides controller + service).
- `apps/api/src/tenants/tenants.controller.ts` — `GET /tenants/:t/products/:id` route.
- `apps/api/src/tenants/tenants.service.ts` — tenant-prefix helper + read-through `getProduct(tenantId, id)`.
- `apps/api/src/tenants/dto/tenant-params.dto.ts` — Zod schema for the `:t` (and `:id`) params.
- `apps/api/src/app.module.ts` — register `TenantsModule`.

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer building a multi-tenant cache demo.
> Context: Repo `nest-cache-example` is the reference app for `@bymax-one/nest-cache` (see `docs/DEVELOPMENT_PLAN.md` §Phase 6 + §2 Global Conventions, `docs/TECHNICAL_SPECIFICATION.md` §4 (library API) + §12.3–§12.4 (the honest tenant design), and `docs/DASHBOARD.md` §8). This is task P6-1. The library binds **one `namespace` per module instance** (`cache-example`) — it is **not** a per-call parameter. Multi-tenancy is **prefix scoping inside that one namespace**: keys are `cache-example:tenant:{tenantId}:product:{id}`. The `tenants` module reads the single Redis **only** through the library's `CacheService` facade; the `KeyBuilder` is injected via the `BYMAX_CACHE_KEY_BUILDER` token and exposes `build(prefix, id)`, `applyNamespace(key)`, and `getNamespacePrefix()`. Keys composed through the library are **fully namespaced**.
> Objective: Implement the `TenantsModule` skeleton and the tenant-scoped read-through endpoint `GET /tenants/:t/products/:id`.
> Steps:
>
> 1. Create `apps/api/src/tenants/tenants.module.ts` — a `@Module` providing `TenantsController` + `TenantsService`; import the app's cache module (which re-exports `BymaxCacheModule`, so both `CacheService` and the `KeyBuilder` token are injectable). Register `TenantsModule` in `apps/api/src/app.module.ts`.
> 2. Create `apps/api/src/tenants/dto/tenant-params.dto.ts` — a Zod schema validating `t` (`/^[a-z0-9-]{1,32}$/`) and `id` (the product-id shape used by `catalog`), exported for the `ZodValidationPipe`.
> 3. Create `apps/api/src/tenants/tenants.service.ts` with `TenantsService` injecting `CacheService` and the key builder:
>
>    ```ts
>    @Injectable()
>    export class TenantsService {
>      constructor(
>        private readonly cache: CacheService,
>        @Inject(BYMAX_CACHE_KEY_BUILDER) private readonly keyBuilder: KeyBuilder,
>      ) {}
>
>      /** Builds the per-tenant entity prefix: `tenant:{id}:product` (namespace is applied by the library). */
>      private tenantPrefix(tenantId: string): CacheKeyPrefix {
>        return `tenant:${tenantId}:product` as CacheKeyPrefix
>      }
>
>      /** Read-through fetch of a product scoped to one tenant's prefix. */
>      async getProduct(
>        tenantId: string,
>        id: string,
>      ): Promise<{ data: Product; source: 'cache' | 'origin' }> {
>        const prefix = this.tenantPrefix(tenantId)
>        const cached = await this.cache.get<Product>(prefix, id)
>        if (cached) return { data: cached, source: 'cache' }
>        const data = await loadProductFromOrigin(id) // reuse the catalog in-memory origin
>        await this.cache.set<Product>(prefix, id, data, TENANT_PRODUCT_TTL_SECONDS)
>        return { data, source: 'origin' }
>      }
>    }
>    ```
>
> 4. Create `apps/api/src/tenants/tenants.controller.ts` with `GET /tenants/:t/products/:id` → `TenantsService.getProduct(t, id)`, params parsed by the Zod DTO; JSDoc the route (`@param`/`@returns`/`@throws` + the `GET /tenants/:t/products/:id` line).
> 5. Add a short JSDoc on `tenantPrefix` stating that the tenant is the **leading segment of the entity prefix**, not a namespace (full design note lands in P6-4).
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions (TypeScript 5.9 strict, ESM, English-only, boolean `is`/`has`/`should` naming).
> - **No Swagger** — JSDoc on every public method; DTOs are **Zod** parsed by `ZodValidationPipe`.
> - Do NOT hand-build the namespaced key string (no `\`cache-example:...\``); compose only through `CacheService`/`KeyBuilder`.
> - Do NOT introduce a database or a second namespace — tenants are prefixes inside the one `cache-example` namespace (spec §12.4).
> - Do NOT add a per-call `namespace` parameter — the library has none.
>   Verification:
> - `pnpm --filter @nest-cache-example/api typecheck` (or root `pnpm typecheck`) — expected: exit 0.
> - `pnpm --filter @nest-cache-example/api lint` — expected: exit 0.
> - With Redis up (`pnpm infra:up`) and the API running: `curl -s localhost:3001/tenants/acme/products/1` then again — expected: first `"source":"origin"`, second `"source":"cache"`.
> - `node -e "/* inject KeyBuilder in a Nest test ctx */"` or a quick e2e assertion — expected: `keyBuilder.build('tenant:acme:product','1') === 'cache-example:tenant:acme:product:1'`.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P6-1 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P6-2 — `DELETE /tenants/:t/cache` — Clear ONE Tenant (`scan` → `delMany`)

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** S (30–90 min)
- **Depends on:** `P6-1`

### Description

Add the per-tenant clear that proves prefix scoping: clearing tenant A leaves tenant B's keys intact (DASHBOARD §8, spec §12.4). The endpoint enumerates **only** the calling tenant's keys with `CacheService.scan('tenant:{t}', '*')` — the non-blocking, cursor-based `AsyncIterable<string>` — collecting the matching ids, then deletes them in one batch with `CacheService.delMany(prefix, ids)`. This is deliberately **not** `flushNamespace()` (which would clear _every_ tenant). `scan` returns **fully namespaced** keys; `delMany` is the library's batch delete returning the number of keys removed. Demonstrates matrix rows #16 (`delMany`) and #36 (`KeyBuilder` — the scan prefix is composed through the library).

### Acceptance Criteria

- [x] `DELETE /tenants/:t/cache` exists on `TenantsController`; `:t` validated by the same Zod params DTO from P6-1.
- [x] `TenantsService.clearTenant(tenantId)` iterates `cache.scan('tenant:{tenantId}', '*')` (the `AsyncIterable<string>`), accumulates the matching keys, derives the id segments, and calls `cache.delMany(...)` once (not per-key `del` in a loop).
- [x] The response is `{ tenant, scannedKeys: number, deleted: number }` where `deleted` is the count `delMany` returns.
- [x] Clearing tenant `acme` does **not** remove any `tenant:globex:*` key (asserted in P6-5; the code path scopes the scan to the single tenant prefix and never widens it).
- [x] In **cluster** mode the underlying `scan` surfaces the library's `CacheException('cache.unsupported_in_cluster')` unchanged (the `CacheExceptionFilter` maps it to the structured body); the controller does not swallow it.
- [x] JSDoc on the new route + service method; no Swagger.

### Files to create / modify

- `apps/api/src/tenants/tenants.controller.ts` — add `DELETE /tenants/:t/cache`.
- `apps/api/src/tenants/tenants.service.ts` — add `clearTenant(tenantId)` (`scan` → `delMany`).

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer.
> Context: Task P6-2 of `docs/DEVELOPMENT_PLAN.md` §Phase 6 (see also `docs/TECHNICAL_SPECIFICATION.md` §12.4 and `docs/DASHBOARD.md` §8). Clearing one tenant must leave the others intact, so it uses a **prefix-scoped scan** + batch delete, **never** `flushNamespace()`. The library's `CacheService.scan(prefix, pattern, count?)` returns an `AsyncIterable<string>` of **fully namespaced** keys (non-blocking; standalone/sentinel only — throws `CacheException('cache.unsupported_in_cluster')` in cluster mode). `CacheService.delMany(prefix, ids: readonly string[])` deletes a batch and returns `Promise<number>`.
> Objective: Implement `DELETE /tenants/:t/cache` that clears exactly one tenant's keys.
> Steps:
>
> 1. Add `clearTenant(tenantId: string)` to `TenantsService`:
>
>    ```ts
>    /** Clears every key under one tenant's prefix via SCAN + delMany — leaves other tenants intact. */
>    async clearTenant(tenantId: string): Promise<{ tenant: string; scannedKeys: number; deleted: number }> {
>      const prefix = `tenant:${tenantId}:product` as CacheKeyPrefix
>      const ids: string[] = []
>      for await (const key of this.cache.scan(prefix, '*')) {
>        // key is fully namespaced: cache-example:tenant:{id}:product:{productId}
>        ids.push(idSegmentOf(key)) // strip the namespace+prefix to recover the id delMany expects
>      }
>      const deleted = ids.length ? await this.cache.delMany(prefix, ids) : 0
>      return { tenant: tenantId, scannedKeys: ids.length, deleted }
>    }
>    ```
>
>    Recover the id segment using the library — e.g. compare against `keyBuilder.getNamespacePrefix()` / strip `keyBuilder.build(prefix, '')` — rather than a brittle hand-split, so the namespace/prefix boundary stays library-owned.
>
> 2. Add `DELETE /tenants/:t/cache` to `TenantsController` → `clearTenant(t)`; validate `:t` with the P6-1 Zod params DTO; JSDoc the route.
> 3. Do not catch the cluster-mode `CacheException` — let it propagate to the `CacheExceptionFilter`.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - **No Swagger**; JSDoc + Zod only.
> - Do NOT use `flushNamespace()` here (it clears all tenants); do NOT call `del` in a per-key loop (use one `delMany`).
> - Do NOT widen the scan prefix beyond the single tenant; the pattern stays `'*'` under `tenant:{t}:product`.
>   Verification:
> - `pnpm typecheck && pnpm lint` — expected: exit 0.
> - With Redis up and two tenants seeded (`GET /tenants/acme/products/1`, `GET /tenants/globex/products/1`): `curl -s -X DELETE localhost:3001/tenants/acme/cache` — expected: `deleted >= 1`.
> - Re-read `GET /tenants/globex/products/1` immediately after — expected: still `"source":"cache"` (globex untouched).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P6-2 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P6-3 — `POST /tenants/seed-foreign` — Foreign-Namespace Seed via `getClient()`

- **Status:** 🟢 Done
- **Priority:** Medium
- **Size:** S (30–90 min)
- **Depends on:** `P6-1`

### Description

Seed a key under a **foreign** namespace (`other-app:*`) using the raw ioredis client from `CacheService.getClient()` — keys obtained this way are **NOT auto-namespaced** (the library only namespaces calls that go through `CacheService` / `KeyBuilder`). This is the **documented anti-pattern**: the one place in the example that bypasses the namespace, and it exists solely to set up the isolation proof in P6-4 (a key the namespace flush must leave untouched). The endpoint writes `other-app:demo` (built **by hand** on the raw client, on purpose) so that P6-4 can show `flushNamespace()` clears `cache-example:*` while `other-app:demo` survives (spec §12.3, §24). Demonstrates matrix row #26 (`getClient()`).

### Acceptance Criteria

- [x] `POST /tenants/seed-foreign` exists on `TenantsController` and returns `{ key: 'other-app:demo', written: true }`.
- [x] `TenantsService.seedForeignNamespace()` obtains the raw client via `cache.getClient()` and writes the literal key `other-app:demo` (hand-built — explicitly NOT through `KeyBuilder`/`CacheService`), with an optional value/TTL.
- [x] The foreign key is written **without** the `cache-example:` prefix (verifiable via the raw client: `getClient().get('other-app:demo')` returns the value, while `cache.get(...)` for any `cache-example` prefix does **not** see it).
- [x] A prominent inline comment + JSDoc labels this as the **documented anti-pattern** ("raw `getClient()` write bypasses the namespace — done only to prove isolation in P6-4; do NOT do this in real code") so no reader copies it as a pattern.
- [x] JSDoc on the route + service method; no Swagger.

### Files to create / modify

- `apps/api/src/tenants/tenants.controller.ts` — add `POST /tenants/seed-foreign`.
- `apps/api/src/tenants/tenants.service.ts` — add `seedForeignNamespace()` (raw `getClient()` write).

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer.
> Context: Task P6-3 of `docs/DEVELOPMENT_PLAN.md` §Phase 6 (see `docs/TECHNICAL_SPECIFICATION.md` §12.3 "Namespace isolation & `flushNamespace`" + §24 "Security & Safety", and `docs/DASHBOARD.md` §8 "Isolation proof"). `CacheService.getClient(): Redis` returns the **raw ioredis client**; keys used on it are **NOT auto-namespaced** — the consumer must build them by hand. This endpoint deliberately seeds a key under a **different** namespace (`other-app:demo`) so that P6-4 can prove `flushNamespace()` only touches `cache-example:*`. This is the **only** sanctioned raw-client write in the example and must be labelled as the documented anti-pattern (spec §24).
> Objective: Implement `POST /tenants/seed-foreign` that writes `other-app:demo` via the raw client.
> Steps:
>
> 1. Add `seedForeignNamespace()` to `TenantsService`:
>
>    ```ts
>    /**
>     * DOCUMENTED ANTI-PATTERN — seeds a FOREIGN namespace via the raw client.
>     * Keys on getClient() are NOT auto-namespaced; this bypasses KeyBuilder ON PURPOSE,
>     * solely to prove (in P6-4) that flushNamespace() leaves other namespaces intact.
>     * Do NOT copy this into real code — always go through CacheService / KeyBuilder.
>     */
>    async seedForeignNamespace(): Promise<{ key: string; written: true }> {
>      const raw = this.cache.getClient() // raw ioredis — keys NOT namespaced
>      const key = 'other-app:demo' // hand-built foreign key, intentionally un-namespaced
>      await raw.set(key, JSON.stringify({ seededBy: 'tenants/seed-foreign', at: Date.now() }))
>      return { key, written: true }
>    }
>    ```
>
> 2. Add `POST /tenants/seed-foreign` to `TenantsController` → `seedForeignNamespace()`; JSDoc the route, repeating the anti-pattern warning in the route's `@remarks`.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - **No Swagger**; JSDoc + Zod only.
> - This is the **only** allowed `getClient()` raw write in the example — keep it isolated to this one method and clearly labelled; do NOT introduce raw-client writes elsewhere.
> - Do NOT route the foreign key through `KeyBuilder`/`CacheService` (that would namespace it and defeat the proof).
>   Verification:
> - `pnpm typecheck && pnpm lint` — expected: exit 0.
> - With Redis up: `curl -s -X POST localhost:3001/tenants/seed-foreign` — expected: `{"key":"other-app:demo","written":true}`.
> - `docker compose exec redis redis-cli GET other-app:demo` — expected: the JSON value (key exists under the foreign namespace, no `cache-example:` prefix).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P6-3 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P6-4 — Isolation Proof — `flushNamespace()` + Per-Instance Design Note

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** S (30–90 min)
- **Depends on:** `P6-1`, `P6-3`

### Description

Wire the isolation-proof flow that closes the honesty loop (DASHBOARD §8 "Isolation proof", spec §12.3–§12.4): `CacheService.flushNamespace()` performs a `SCAN` + `UNLINK` scoped to `{namespace}{separator}*` — i.e. **only `cache-example:*`** — and is **production-guarded** (`allowFlushInProduction: false` → `403 cache.flush_disabled_in_production`). After flushing, the foreign `other-app:demo` key (seeded in P6-3) must **survive**, proving the namespace boundary. This task also adds the mandatory **design note** — a JSDoc/code block restating the honest model: _"`namespace` is per module instance; tenants are prefixes; the production 'namespace per tenant' pattern is one app instance per tenant with `namespace` from env (spec §12.4)."_ Demonstrates matrix row #27 (`flushNamespace()` proof). The flush HTTP route itself already exists in `admin` (Phase 5, `DELETE /admin/namespace`); this task adds the **proof** orchestration here (seed-foreign → flush → assert foreign survives) and the design note, reusing the existing guarded flush rather than re-implementing it.

### Acceptance Criteria

- [x] A proof flow exists (a `TenantsService.proveIsolation()` method, exposed as `POST /tenants/prove-isolation`) that: (1) ensures `other-app:demo` exists (calls the P6-3 seed if absent), (2) records `cache-example:*` key count before, (3) calls `cache.flushNamespace()`, (4) reports `{ flushedNamespaceKeys: number, foreignKeySurvived: boolean }`.
- [x] `foreignKeySurvived` is computed by reading the foreign key through the **raw client** (`getClient().exists('other-app:demo')`) **after** the flush — expected `true`.
- [x] `flushedNamespaceKeys` equals the count `flushNamespace()` returns (`Promise<number>`); the namespace flush removes only keys matching `cache-example:` (the library scopes `SCAN`+`UNLINK` to `{namespace}{sep}*`).
- [x] When `NODE_ENV=production` and `allowFlushInProduction` is `false`, `flushNamespace()` surfaces `CacheException('cache.flush_disabled_in_production')` (HTTP 403) unchanged through the `CacheExceptionFilter`; the proof endpoint does not swallow it.
- [x] A `// DESIGN NOTE` JSDoc block on the `tenants` module (e.g. top of `tenants.service.ts` or a `tenants.design-note.ts` constant) states verbatim the per-instance model: namespace is per module instance, tenants are prefixes, production "namespace per tenant" = one instance per tenant with `namespace` from env (spec §12.4).
- [x] JSDoc on the new route + method; no Swagger.

### Files to create / modify

- `apps/api/src/tenants/tenants.service.ts` — add `proveIsolation()` + the `DESIGN NOTE` JSDoc block.
- `apps/api/src/tenants/tenants.controller.ts` — add `POST /tenants/prove-isolation`.

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer.
> Context: Task P6-4 of `docs/DEVELOPMENT_PLAN.md` §Phase 6 (see `docs/TECHNICAL_SPECIFICATION.md` §12.3–§12.4 + §24, and `docs/DASHBOARD.md` §8 "Isolation proof"). `CacheService.flushNamespace(): Promise<number>` runs a `SCAN` + `UNLINK` scoped to `{namespace}{separator}*` (here `cache-example:*`) and returns the number of keys removed; it is **production-guarded** (`allowFlushInProduction: false` → throws `CacheException('cache.flush_disabled_in_production')`, HTTP 403). The foreign key `other-app:demo` (P6-3, written via the raw `getClient()`) lives **outside** the namespace, so the flush must leave it intact — that is the proof. The library's connection token is `BYMAX_CACHE_CONNECTION`; the key builder is `BYMAX_CACHE_KEY_BUILDER` and exposes `getNamespacePrefix()`.
> Objective: Implement the isolation-proof flow and add the per-instance design note.
> Steps:
>
> 1. Add a `DESIGN NOTE` JSDoc block to the `tenants` module (top of `tenants.service.ts`), restating: the library binds **one `namespace` per module instance** (`cache-example`); tenants are **prefixes** within it (`tenant:{id}:…`); clearing one tenant is `scan` → `delMany`, **not** `flushNamespace()` (which clears the whole namespace); the production "namespace per tenant" pattern is **one app instance per tenant with `namespace` from env** (spec §12.4).
> 2. Add `proveIsolation()` to `TenantsService`:
>
>    ```ts
>    /** Proves the namespace boundary: flushNamespace() clears cache-example:* but a foreign key survives. */
>    async proveIsolation(): Promise<{ flushedNamespaceKeys: number; foreignKeySurvived: boolean }> {
>      const raw = this.cache.getClient()
>      if (!(await raw.exists('other-app:demo'))) await this.seedForeignNamespace() // ensure the foreign key exists
>      const flushedNamespaceKeys = await this.cache.flushNamespace() // SCAN + UNLINK, scoped to cache-example:*
>      const foreignKeySurvived = (await raw.exists('other-app:demo')) === 1
>      return { flushedNamespaceKeys, foreignKeySurvived }
>    }
>    ```
>
> 3. Add `POST /tenants/prove-isolation` to `TenantsController` → `proveIsolation()`; JSDoc the route. Do not catch the `flush_disabled_in_production` `CacheException` — let it reach the `CacheExceptionFilter`.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - **No Swagger**; JSDoc + Zod only.
> - Reuse the library's guarded `flushNamespace()` — do NOT re-implement the SCAN+UNLINK or disable the production guard (the demo proves the 403, spec §24).
> - Keep `allowFlushInProduction` at its `false` default in the cache config; the proof asserts the guard, it does not bypass it.
>   Verification:
> - `pnpm typecheck && pnpm lint` — expected: exit 0.
> - With Redis up, seed a tenant then run the proof: `curl -s -X POST localhost:3001/tenants/prove-isolation` — expected: `flushedNamespaceKeys >= 1` and `"foreignKeySurvived":true`.
> - `docker compose exec redis redis-cli KEYS 'cache-example:*'` after the flush — expected: empty; `... GET other-app:demo` — expected: still present.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P6-4 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P6-5 — Phase Verification (Clear A Leaves B; Flush Leaves Foreign Key)

- **Status:** 🟢 Done
- **Priority:** Medium
- **Size:** S (30–90 min)
- **Depends on:** `P6-1`, `P6-2`, `P6-3`, `P6-4`

### Description

Phase 6 "Definition of done" gate per `DEVELOPMENT_PLAN.md`: prove the two isolation stories end to end against a real Redis. (1) **Prefix scoping:** seed tenants `acme` and `globex`, clear `acme` via `DELETE /tenants/:t/cache`, and confirm `globex`'s keys survive. (2) **Namespace boundary:** seed the foreign `other-app:demo`, run the namespace flush, and confirm `cache-example:*` is gone while `other-app:demo` survives. Closes the phase. No new feature code — verification only; if a check fails, fix the corresponding earlier task (P6-1..P6-4) and return here.

### Acceptance Criteria

- [x] A reproducible verification sequence is documented and run (curl or an e2e spec) covering both proofs below; all steps pass against a fresh Redis (`pnpm infra:up`).
- [x] **Tenant scoping proof:** after seeding `acme` + `globex` and `DELETE /tenants/acme/cache`, a `scan('tenant:globex','*')` (or `GET /tenants/globex/products/:id` → `source: 'cache'`) shows `globex` intact and `acme` empty.
- [x] **Namespace proof:** after `POST /tenants/seed-foreign` + `POST /tenants/prove-isolation`, `foreignKeySurvived === true` and no `cache-example:*` key remains.
- [x] In **cluster** mode the `scan`-based clear surfaces `cache.unsupported_in_cluster` via the `CacheExceptionFilter` (smoke-checked or noted as covered by Phase 11).
- [x] `pnpm typecheck`, `pnpm lint`, and the API e2e smoke (if a Phase 6 spec was added) all exit 0; no `@ts-ignore`/`eslint-disable`/`--no-verify`.

### Files to create / modify

- _(none required — verification only; optionally add `apps/api/test/tenants.e2e-spec.ts` if codifying the proof as a Testcontainers smoke test, fix earlier task files if a check fails)_

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer.
> Context: Task P6-5 of `docs/DEVELOPMENT_PLAN.md` §Phase 6. DoD: clearing tenant A leaves tenant B's keys; flushing the namespace removes `cache-example:*` and the seeded `other-app:*` key survives (see `docs/TECHNICAL_SPECIFICATION.md` §12.3–§12.4 and `docs/DASHBOARD.md` §8). This proves matrix rows #16 (`delMany`), #26 (`getClient`), #27 (`flushNamespace`), #36 (`KeyBuilder`).
> Objective: Confirm both isolation stories end to end and close the phase.
> Steps:
>
> 1. `pnpm infra:up` (fresh Redis), start the API, then run, in order:
>    - `GET /tenants/acme/products/1`, `GET /tenants/acme/products/2`, `GET /tenants/globex/products/1` (seed both tenants).
>    - `DELETE /tenants/acme/cache` → expect `deleted >= 2`.
>    - `GET /tenants/globex/products/1` → expect `"source":"cache"` (globex intact); `GET /tenants/acme/products/1` → expect `"source":"origin"` (acme cleared).
>    - `POST /tenants/seed-foreign` → `other-app:demo` written.
>    - `POST /tenants/prove-isolation` → expect `foreignKeySurvived: true` and `flushedNamespaceKeys >= 1`.
>    - `docker compose exec redis redis-cli KEYS 'cache-example:*'` → empty; `... GET other-app:demo` → present.
> 2. (Optional, recommended) Codify the above as `apps/api/test/tenants.e2e-spec.ts` using the existing Testcontainers `redis:7-alpine` harness.
> 3. If any check fails, diagnose and fix in the corresponding earlier task file (P6-1..P6-4), then return here. Do NOT weaken the namespace flush or the production guard to make a check pass.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - **No Swagger**; JSDoc + Zod only.
> - Do NOT skip hooks; do NOT lower any threshold; do NOT use `--no-verify`.
>   Verification:
> - `pnpm typecheck` — expected: exit 0.
> - `pnpm lint` — expected: exit 0.
> - `pnpm --filter @nest-cache-example/api test:e2e` (if a spec was added) — expected: exit 0.
> - The curl sequence above — expected: every assertion holds (globex survives the acme clear; the foreign key survives the namespace flush).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P6-5 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

When this task is 🟢, Phase 6 is 5/5 — switch the Phase 6 row in `DEVELOPMENT_PLAN.md` Progress Summary to 🟢 Done.

⚠️ Never mark done with failing verification.

---

## Completion log

_(Agents append one line per finished task, newest at the bottom.)_

- P6-1 ✅ 2026-06-16 — TenantsModule + tenant-scoped read-through (prefix `tenant:{t}:product`, get/set via CacheService, ZodValidationPipe on `:t`)
- P6-2 ✅ 2026-06-16 — DELETE /tenants/:t/cache via scan(AsyncIterable) + delMany; globex untouched when acme cleared
- P6-3 ✅ 2026-06-16 — POST /tenants/seed-foreign writes `other-app:demo` via raw getClient(), documented anti-pattern
- P6-4 ✅ 2026-06-16 — POST /tenants/prove-isolation: flushNamespace() removes cache-example:\*, foreign key survives; DESIGN NOTE in service header
- P6-5 ✅ 2026-06-16 — Both isolation proofs verified via curl against live Redis; typecheck + lint + format all pass
