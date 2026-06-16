# Phase 4 — Domain & Core Data Structures — Tasks

> **Source:** [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#phase-4--domain--core-data-structures) §Phase 4
> **Total tasks:** 9
> **Progress:** 🔴 0 / 9 done (0%)
>
> **Status legend:** 🔴 Not Started · 🟡 In Progress · 🔵 In Review · 🟢 Done · ⚪ Blocked

## Task index

| ID   | Task                                                                             | Status | Priority | Size | Depends on |
| ---- | -------------------------------------------------------------------------------- | ------ | -------- | ---- | ---------- |
| P4-1 | `ProductOriginStore` — in-memory "database" with artificial latency              | 🔴     | High     | S    | Phase 3    |
| P4-2 | Catalog read-through — `GET /catalog/products/:id` (`get`→miss→`set(ttl)`)       | 🔴     | High     | M    | P4-1       |
| P4-3 | Catalog batch — `GET /catalog/products?ids=a,b,c` (`mget`/`mset`)                | 🔴     | High     | S    | P4-2       |
| P4-4 | Catalog idempotent seed (`setNx`) + `exists` — `POST /catalog/products/:id/seed` | 🔴     | Medium   | S    | P4-2       |
| P4-5 | `counters/` — `incr`/`decr` (view counter, stock decrement)                      | 🔴     | Medium   | S    | Phase 3    |
| P4-6 | `collections/` carts as HASHES (`hset`/`hget`/`hgetall`/`hdel`)                  | 🔴     | Medium   | M    | Phase 3    |
| P4-7 | `collections/` tags as SETS (`sadd`/`srem`/`smembers`/`sismember`/`scard`)       | 🔴     | Medium   | M    | P4-6       |
| P4-8 | `MetricsService` (per-prefix hit/miss) + interceptor + `GET /metrics`            | 🔴     | High     | M    | P4-2       |
| P4-9 | TTL ops on catalog keys (`expire`/`ttl`/`persist`) + phase verification          | 🔴     | Medium   | S    | P4-2..P4-8 |

---

## P4-1 — `ProductOriginStore` — In-Memory "Database" with Artificial Latency

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** S (30–90 min)
- **Depends on:** `Phase 3`

### Description

Create the in-memory "origin" store that stands in for a real database. Every read sleeps for a small, configurable delay so a cache **hit** is visibly faster than a **miss** on the dashboard. The whole point of the example is to make the cache observable; this store is the slow path the cache short-circuits. No database, no ORM — just a seeded `Map` plus a delay. The `Product` shape lives in shared domain types so the catalog service, DTOs, and (later) the web app agree on one contract.

### Acceptance Criteria

- [ ] `src/catalog/product.types.ts` exports a `Product` interface (`id`, `name`, `priceCents`, `tags: string[]`, `stock: number`) and a `SEED_PRODUCTS` constant (≥ 5 deterministic rows).
- [ ] `src/catalog/product-origin.store.ts` exports `@Injectable() ProductOriginStore` with `async find(id: string): Promise<Product | null>` and `async findMany(ids: string[]): Promise<Array<Product | null>>`.
- [ ] Each `find`/`findMany` lookup awaits an artificial delay (default ~120 ms, sourced from a module-level constant) so misses are perceptibly slower than hits.
- [ ] The store is seeded from `SEED_PRODUCTS` at construction; unknown ids resolve to `null` (never throw).
- [ ] Every exported symbol carries JSDoc; the delay constant has a one-line comment explaining WHY it exists (demo visibility).
- [ ] `pnpm --filter api typecheck` + `pnpm --filter api lint` pass.

### Files to create / modify

- `apps/api/src/catalog/product.types.ts` — `Product` interface + `SEED_PRODUCTS`.
- `apps/api/src/catalog/product-origin.store.ts` — injectable in-memory store with latency.

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer building the demo domain for a cache reference app.
> Context: Repo `nest-cache-example` is the reference app for `@bymax-one/nest-cache` (a typed Redis cache for NestJS). This is task **P4-1** of Phase 4 (see `docs/DEVELOPMENT_PLAN.md` §Phase 4 + §2 Global Conventions, and `docs/TECHNICAL_SPECIFICATION.md` §11 "the 'origin' is an in-memory store with an artificial latency so cache hits are visibly faster"). Phase 3 has already produced the booting Nest app, `CacheService` wiring, the exception filter, the `ZodValidationPipe`, and `src/common/cache-keys.ts` (typed `CacheKeyPrefix` constants).
> Objective: Produce the in-memory product origin store and the shared `Product` domain type that the rest of Phase 4 builds on.
> Steps:
>
> 1. Create `apps/api/src/catalog/product.types.ts`:
>    - Export `interface Product { id: string; name: string; priceCents: number; tags: string[]; stock: number }`.
>    - Export `const SEED_PRODUCTS: readonly Product[]` with at least 5 deterministic rows (stable ids like `'p1'..'p5'`, realistic names/prices/tags/stock). JSDoc the interface and the constant.
> 2. Create `apps/api/src/catalog/product-origin.store.ts`:
>    - `@Injectable()` class `ProductOriginStore`.
>    - A module-level `const ORIGIN_LATENCY_MS = 120` with a comment: artificial latency so a cache hit is visibly faster than an origin miss on the dashboard.
>    - A private `Map<string, Product>` seeded from `SEED_PRODUCTS` in the constructor.
>    - `async find(id: string): Promise<Product | null>` — `await` a delay of `ORIGIN_LATENCY_MS`, then return the row or `null`. Use a small private `delay(ms)` helper returning `new Promise<void>((resolve) => setTimeout(resolve, ms))` (do NOT block the event loop with a busy-wait).
>    - `async findMany(ids: string[]): Promise<Array<Product | null>>` — one delay for the whole batch (a batch DB read is one round-trip), then map ids → rows/`null`, preserving input order.
>    - JSDoc every public member.
>      Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions (TypeScript strict, ESM, English-only comments, JSDoc on every exported/public member, thin layers).
> - Do NOT use `class-validator` or Swagger anywhere in the repo (DTOs are Zod; docs are JSDoc).
> - Do NOT add a real database, ORM, or persistence — this is intentionally in-memory and resets on restart.
> - Return `null` for unknown ids; never throw from the store.
> - Do NOT register the store in a module yet (P4-2 creates `CatalogModule`); just export the class.
>   Verification:
> - `pnpm --filter api typecheck` — expected: exit 0.
> - `pnpm --filter api lint` — expected: exit 0.
> - Quick sanity (optional REPL/test): `new ProductOriginStore().find('p1')` resolves to a `Product` after ~120 ms; `find('nope')` resolves to `null`.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P4-1 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

If phase reaches 100%, switch its row status in `DEVELOPMENT_PLAN.md` to 🟢.

⚠️ Never mark done with failing verification.

---

## P4-2 — Catalog Read-Through — `GET /catalog/products/:id`

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** M (1.5–3 h)
- **Depends on:** `P4-1`

### Description

The headline scenario: a read-through cache. `CatalogService.getProduct(id)` calls `cache.get(prefix, id)`; on a **miss** it fetches from the slow `ProductOriginStore`, then `cache.set(prefix, id, value, ttl)` so the next read is a fast **hit**. This is the canonical house-style controller/service (spec §10.2) — a thin controller, JSDoc on every method, Zod-validated params, business logic in the service. It also wires the `MetricsService` calls at the hit/miss branch points (the service lands in P4-8; until then, define a tiny no-op-tolerant injection or stub it — see prompt). This task creates `CatalogModule`, registers `ProductOriginStore`, and exposes the single-id route.

### Acceptance Criteria

- [ ] `src/catalog/catalog.module.ts` declares `CatalogController`, provides `CatalogService` + `ProductOriginStore`, imported by `AppModule`.
- [ ] `CatalogService.getProduct(id: string): Promise<Product | null>` does `get` → on hit record-hit + return; on miss record-miss, `origin.find(id)`, and `set(prefix, id, fresh, ttlSeconds)` only when `fresh` is non-null.
- [ ] The prefix is a typed `CacheKeyPrefix` constant from `src/common/cache-keys.ts` (`CACHE_PREFIX.product`); the TTL comes from `CACHE_DEFAULT_TTL` via `ConfigService<Env, true>`.
- [ ] `GET /catalog/products/:id` returns the `Product` JSON, or `404` (`NotFoundException`) when the origin has no such product.
- [ ] The route's `:id` param is validated by a Zod schema through the `ZodValidationPipe`.
- [ ] All `CacheService` calls use the `(prefix, id, …)` argument shape (prefix and id are **separate** args; keys are auto-namespaced by the library).
- [ ] JSDoc on the controller class, the service class, and every public method.
- [ ] `pnpm --filter api typecheck` + `pnpm --filter api lint` pass; a manual `GET` of the same id twice is a miss then a hit (second response noticeably faster).

### Files to create / modify

- `apps/api/src/catalog/catalog.service.ts` — read-through logic.
- `apps/api/src/catalog/catalog.controller.ts` — thin controller, `GET /catalog/products/:id`.
- `apps/api/src/catalog/catalog.module.ts` — module wiring.
- `apps/api/src/catalog/dto/product-params.dto.ts` — Zod schema for `:id`.
- `apps/api/src/app.module.ts` — import `CatalogModule`.

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer.
> Context: Task **P4-2** of `docs/DEVELOPMENT_PLAN.md` §Phase 4. The house style is fixed in `docs/TECHNICAL_SPECIFICATION.md` §10.2 — thin controllers, JSDoc on every public method, Zod DTOs, business logic in services. The exact read-through service shape is given there:
>
> ```ts
> async getProduct(id: string): Promise<Product | null> {
>   const cached = await this.cache.get<Product>(this.prefix, id)
>   if (cached) {
>     this.metrics.recordHit(this.prefix)
>     return cached
>   }
>   this.metrics.recordMiss(this.prefix)
>   const fresh = await this.origin.find(id)
>   if (fresh) await this.cache.set(this.prefix, id, fresh, this.ttlSeconds)
>   return fresh
> }
> ```
>
> `CacheService` (from `@bymax-one/nest-cache`) signatures to use exactly (spec §4.1; prefix + id are **separate** args, keys auto-namespaced): `get<T>(prefix, id): Promise<T | null>` and `set<T>(prefix, id, value, ttlSeconds?): Promise<void>`. Phase 3 provides `CacheService`, the global `CacheExceptionFilter`, `ZodValidationPipe`, and `CACHE_PREFIX` typed constants in `src/common/cache-keys.ts`. P4-1 provides `ProductOriginStore` + `Product`.
> Objective: Create `CatalogModule` with the read-through `GET /catalog/products/:id`.
> Steps:
>
> 1. `catalog.service.ts`: `@Injectable() CatalogService`. Inject `CacheService`, `ProductOriginStore`, `ConfigService<Env, true>`, and `MetricsService`. Set `private readonly prefix = CACHE_PREFIX.product` and `private readonly ttlSeconds = config.get('CACHE_DEFAULT_TTL', { infer: true })`. Implement `getProduct` exactly as the spec snippet above.
> 2. `dto/product-params.dto.ts`: a Zod schema `ProductParamsSchema = z.object({ id: z.string().min(1) })` and an inferred `ProductParams` type. JSDoc it.
> 3. `catalog.controller.ts`: `@Controller('catalog/products')`, thin. `@Get(':id')` `getProduct(@Param(new ZodValidationPipe(ProductParamsSchema)) params)` → `const product = await this.service.getProduct(params.id); if (!product) throw new NotFoundException(...); return product`. JSDoc the class + method.
> 4. `catalog.module.ts`: `@Module({ controllers: [CatalogController], providers: [CatalogService, ProductOriginStore] })`. Import `CatalogModule` in `app.module.ts`.
> 5. **`MetricsService` ordering:** P4-8 implements `MetricsService` + `MetricsModule`. To keep this task self-contained and compilable, create a minimal `MetricsService` stub now (`src/metrics/metrics.service.ts` with `recordHit(prefix: string): void {}` / `recordMiss(prefix: string): void {}` and a `MetricsModule` that exports it), import `MetricsModule` into `CatalogModule`, and inject the real thing. P4-8 then fleshes out the same class (counters + `/metrics`) without changing this call site. Add a `// TODO(P4-8): real counters` comment on the stub bodies.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions (strict TS, ESM, English-only, JSDoc, thin controllers, layered architecture).
> - Use Zod DTOs only — NO `class-validator`, NO `@nestjs/swagger` (no `@Api*` decorators anywhere).
> - Pass `(prefix, id, …)` as separate args to every `CacheService` call; never hand-build a namespaced key.
> - Do NOT swallow errors; let `CacheException` propagate to the global filter.
> - Read TTL from `ConfigService`, not `process.env` directly.
>   Verification:
> - `pnpm --filter api typecheck` — expected: exit 0.
> - `pnpm --filter api lint` — expected: exit 0.
> - Boot (`pnpm --filter api dev`) against Docker Redis, then `curl -s localhost:3001/catalog/products/p1` twice — expected: same JSON both times; the second call returns faster (cache hit). `curl -i localhost:3001/catalog/products/nope` — expected: `404`.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P4-2 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P4-3 — Catalog Batch — `GET /catalog/products?ids=a,b,c`

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** S (30–90 min)
- **Depends on:** `P4-2`

### Description

Batch read-through. `cache.mget(prefix, ids)` returns one slot per id (`null` on miss). The service collects the missing ids, fetches them from the origin in one `findMany` round-trip, writes the freshly-fetched rows back with `cache.mset(prefix, entries)`, and returns the merged, order-preserved list. This demonstrates the batch group (matrix #20) and the partial-miss → backfill pattern that makes batch caching worthwhile.

### Acceptance Criteria

- [ ] `GET /catalog/products?ids=a,b,c` parses a comma-separated `ids` query via a Zod DTO (trim, drop empties, cap the count, e.g. ≤ 50).
- [ ] `CatalogService.getProducts(ids: string[]): Promise<Array<Product | null>>` calls `mget`, computes the miss set, `origin.findMany(missingIds)`, `mset` only the non-null fresh rows, and returns results in **input order**.
- [ ] `mset` is given `entries: [string, Product][]` (the `(prefix, entries)` shape); cached writes reuse `CACHE_DEFAULT_TTL` where the API supports per-entry TTL, else documented as namespace-default (see prompt).
- [ ] Each result slot maps back to its requested id; unknown ids stay `null`.
- [ ] Metrics: one `recordHit`/`recordMiss` per id (so batch hit-rate is accurate).
- [ ] JSDoc on the new service method + controller route; `typecheck` + `lint` pass.

### Files to create / modify

- `apps/api/src/catalog/catalog.service.ts` — add `getProducts`.
- `apps/api/src/catalog/catalog.controller.ts` — add `GET /catalog/products` (batch route).
- `apps/api/src/catalog/dto/products-query.dto.ts` — Zod schema for `?ids=`.

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer.
> Context: Task **P4-3** of `docs/DEVELOPMENT_PLAN.md` §Phase 4; endpoint catalogue `docs/TECHNICAL_SPECIFICATION.md` §11.1 — `GET /catalog/products?ids=a,b,c` → `mget` (→ `mset` on partial miss). Builds on the `CatalogModule` from P4-2.
> `CacheService` signatures (spec §4.1, prefix + ids separate, auto-namespaced): `mget<T>(prefix, ids: string[]): Promise<Array<T | null>>`, `mset<T>(prefix, entries: [string, T][]): Promise<void>`.
> Objective: Add the batch read-through route + service method.
> Steps:
>
> 1. `dto/products-query.dto.ts`: `ProductsQuerySchema` — accept `ids` as a string, `.transform` to `string[]` by splitting on `,`, trimming, dropping empties; `.refine`/`.pipe` to enforce `1..50` ids. Export the inferred `ProductsQuery` type. JSDoc it.
> 2. `catalog.service.ts` → `async getProducts(ids: string[]): Promise<Array<Product | null>>`:
>    - `const cached = await this.cache.mget<Product>(this.prefix, ids)`.
>    - Build `missingIds = ids.filter((_, i) => cached[i] === null)`; for each cached slot, `recordHit`/`recordMiss` accordingly.
>    - `const fresh = await this.origin.findMany(missingIds)`; build `entries: [string, Product][]` from the non-null fresh rows; `if (entries.length) await this.cache.mset(this.prefix, entries)`.
>    - Merge: return an array aligned to the **original `ids` order**, taking the cached value when present else the freshly-fetched value (or `null`).
> 3. `catalog.controller.ts`: `@Get()` (no path segment, so it sits at `/catalog/products`) `getProducts(@Query(new ZodValidationPipe(ProductsQuerySchema)) query)` → `return this.service.getProducts(query.ids)`. Ensure the `@Get(':id')` route from P4-2 still resolves (Nest matches the static `@Get()` before `:id` for the no-param path — verify ordering).
> 4. **TTL on `mset`:** if the library's `mset` accepts a per-entry/trailing TTL, pass `CACHE_DEFAULT_TTL`; if it does not (check the shipped types), leave entries at the namespace default and add a one-line JSDoc note that batch-written keys inherit the default (no per-key TTL on `mset`). Do NOT invent an overload the library doesn't expose.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - Zod DTO only; NO class-validator, NO Swagger.
> - Preserve input order; never reorder results by hit/miss.
> - One metric event per id (not one per batch) so hit-rate math is correct.
> - `(prefix, ids)` / `(prefix, entries)` shapes only — no manual key building.
>   Verification:
> - `pnpm --filter api typecheck` + `pnpm --filter api lint` — expected: exit 0.
> - `curl -s 'localhost:3001/catalog/products?ids=p1,p2,nope'` — expected: a 3-element array, `p1`/`p2` populated, `nope` → `null`; a second identical call serves `p1`/`p2` from cache.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P4-3 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P4-4 — Catalog Idempotent Seed (`setNx`) + `exists`

- **Status:** 🔴 Not Started
- **Priority:** Medium
- **Size:** S (30–90 min)
- **Depends on:** `P4-2`

### Description

Idempotent seeding. `POST /catalog/products/:id/seed` writes a product into the cache only if the key is **absent** using `setNx` (set-if-not-exists), so a second seed is a no-op. The response reports whether the write happened (`created: boolean`) and the current key presence via `exists`. This demonstrates `setNx` (matrix #15, catalog facet) and `exists` (matrix #17) honestly: `setNx` returns `true` only on first write.

### Acceptance Criteria

- [ ] `POST /catalog/products/:id/seed` validates `:id` (reused/extended Zod params DTO) and an optional Zod body (a partial product override, else seeded from `SEED_PRODUCTS`/origin).
- [ ] `CatalogService.seedProduct(id, value): Promise<{ created: boolean; exists: boolean }>` calls `setNx(prefix, id, value, ttlSeconds?)` → `created`, then `exists(prefix, id)` → `exists`.
- [ ] A second identical seed returns `created: false`, `exists: true` (idempotent).
- [ ] `setNx` return type is honored as `Promise<boolean>` and `exists` as `Promise<boolean>` (spec §4.1).
- [ ] JSDoc on service method + route; `typecheck` + `lint` pass.

### Files to create / modify

- `apps/api/src/catalog/catalog.service.ts` — add `seedProduct`.
- `apps/api/src/catalog/catalog.controller.ts` — add `POST /catalog/products/:id/seed`.
- `apps/api/src/catalog/dto/seed-product.dto.ts` — Zod body schema (optional overrides).

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer.
> Context: Task **P4-4** of `docs/DEVELOPMENT_PLAN.md` §Phase 4; endpoint catalogue `docs/TECHNICAL_SPECIFICATION.md` §11.1 — `POST /catalog/products/:id/seed` → idempotent seed via `setNx`. Matrix #15 (`setNx`, catalog facet) + #17 (`exists`). Builds on `CatalogModule` (P4-2).
> `CacheService` signatures (spec §4.1, separate args, auto-namespaced): `setNx<T>(prefix, id, value, ttlSeconds?): Promise<boolean>` (resolves `true` only when the key did not previously exist) and `exists(prefix, id): Promise<boolean>`.
> Objective: Add an idempotent seed route that returns whether the write occurred.
> Steps:
>
> 1. `dto/seed-product.dto.ts`: `SeedProductSchema` — an **optional** partial of the product fields (`name?`, `priceCents?`, `tags?`, `stock?`); the service fills the rest from the origin/`SEED_PRODUCTS` default for that id. Export the inferred type. JSDoc it.
> 2. `catalog.service.ts` → `async seedProduct(id: string, overrides: SeedProduct): Promise<{ created: boolean; exists: boolean }>`:
>    - Compose the value: start from `await this.origin.find(id)` (or the matching `SEED_PRODUCTS` row) and merge `overrides`; if neither exists, fabricate a minimal valid `Product` from `{ id, ...overrides }` with sane defaults.
>    - `const created = await this.cache.setNx(this.prefix, id, value, this.ttlSeconds)`.
>    - `const exists = await this.cache.exists(this.prefix, id)`.
>    - Return `{ created, exists }`.
> 3. `catalog.controller.ts`: `@Post(':id/seed')` `seed(@Param(ZodValidationPipe(ProductParamsSchema)) params, @Body(ZodValidationPipe(SeedProductSchema)) body)` → `return this.service.seedProduct(params.id, body)`. JSDoc the method (note it is idempotent).
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - Zod DTO only; NO class-validator, NO Swagger.
> - Treat `setNx` as the source of truth for `created`; do NOT pre-check with `exists` and then `set` (that is a race — the whole point of `setNx` is the atomic check-and-set).
> - `(prefix, id, …)` arg shape only.
>   Verification:
> - `pnpm --filter api typecheck` + `pnpm --filter api lint` — expected: exit 0.
> - `curl -s -XPOST localhost:3001/catalog/products/seed-1/seed -H 'content-type: application/json' -d '{"name":"Seeded"}'` — expected: `{ "created": true, "exists": true }`. Repeat the same call — expected: `{ "created": false, "exists": true }`.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P4-4 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P4-5 — `counters/` — `incr` / `decr` (View Counter, Stock Decrement)

- **Status:** 🔴 Not Started
- **Priority:** Medium
- **Size:** S (30–90 min)
- **Depends on:** `Phase 3`

### Description

Atomic numeric counters. `cache.incr` powers a per-product **view counter**; `cache.decr` powers a **stock decrement**. Both are server-atomic Redis ops (no read-modify-write race) and both return the new value. This is a standalone `CountersModule` (matrix #18). It teaches that `incr`/`decr` operate on numeric string keys distinct from the JSON-serialized product keys.

### Acceptance Criteria

- [ ] `src/counters/counters.module.ts` declares `CountersController` + `CountersService`, imported by `AppModule`.
- [ ] `GET /counters/:id/views` returns the current view count (0 when the key is absent).
- [ ] `POST /counters/:id/views/incr` calls `incr(prefix, id, by?)` and returns the new count.
- [ ] `POST /counters/:id/stock/decr` calls `decr(prefix, id, by?)` and returns the new stock value.
- [ ] An optional `by` (positive integer) is accepted via Zod body/query and forwarded; default `1`.
- [ ] `incr`/`decr` typed as `Promise<number>`; the views/stock prefixes are typed `CacheKeyPrefix` constants (not the product prefix).
- [ ] JSDoc on every public member; `typecheck` + `lint` pass.

### Files to create / modify

- `apps/api/src/counters/counters.service.ts` — incr/decr logic.
- `apps/api/src/counters/counters.controller.ts` — routes.
- `apps/api/src/counters/counters.module.ts` — wiring.
- `apps/api/src/counters/dto/counter-by.dto.ts` — Zod `{ by? }`.
- `apps/api/src/common/cache-keys.ts` — add `views` / `stock` prefixes (if absent).
- `apps/api/src/app.module.ts` — import `CountersModule`.

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer.
> Context: Task **P4-5** of `docs/DEVELOPMENT_PLAN.md` §Phase 4; endpoint catalogue `docs/TECHNICAL_SPECIFICATION.md` §11.1 — `GET /counters/:id/views` · `POST …/views/incr` (view counter) and a stock decrement; matrix #18 (`incr`/`decr`). Phase 3 provides `CacheService` + `CACHE_PREFIX` constants in `src/common/cache-keys.ts`.
> `CacheService` signatures (spec §4.1, separate args, auto-namespaced): `incr(prefix, id, by?): Promise<number>`, `decr(prefix, id, by?): Promise<number>`. `get<T>(prefix, id)` reads the current value (a counter key stores a number).
> Objective: Build a `CountersModule` exposing view-count and stock-decrement routes.
> Steps:
>
> 1. In `src/common/cache-keys.ts` add typed prefixes (e.g. `CACHE_PREFIX.views`, `CACHE_PREFIX.stock`) if not already present — keep them `CacheKeyPrefix`-typed and distinct from `product`.
> 2. `dto/counter-by.dto.ts`: `CounterBySchema = z.object({ by: z.coerce.number().int().positive().optional() })`; inferred `CounterBy`. JSDoc it.
> 3. `counters.service.ts`: `@Injectable() CountersService` injecting `CacheService`.
>    - `async getViews(id): Promise<number>` → `(await this.cache.get<number>(CACHE_PREFIX.views, id)) ?? 0`.
>    - `async incrViews(id, by = 1): Promise<number>` → `this.cache.incr(CACHE_PREFIX.views, id, by)`.
>    - `async decrStock(id, by = 1): Promise<number>` → `this.cache.decr(CACHE_PREFIX.stock, id, by)`.
>    - JSDoc each.
> 4. `counters.controller.ts`: `@Controller('counters')`. `@Get(':id/views')`, `@Post(':id/views/incr')` (read `by` from `@Body`/`@Query` via `ZodValidationPipe(CounterBySchema)`), `@Post(':id/stock/decr')`. Thin — delegate to the service. Return the new number (or `{ value }` — pick one shape and JSDoc it consistently).
> 5. `counters.module.ts` + import into `app.module.ts`.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - Zod DTO only; NO class-validator, NO Swagger.
> - Do NOT read-then-write to increment; use the atomic `incr`/`decr` (that is the lesson).
> - `(prefix, id, by?)` arg shape; never build keys by hand. If the shipped `.d.ts` does **not** expose the optional `by` argument on `incr`/`decr`, drop it (call the single-step form, or loop) and note the limitation — do NOT invent an overload the library does not ship.
>   Verification:
> - `pnpm --filter api typecheck` + `pnpm --filter api lint` — expected: exit 0.
> - `curl -s -XPOST localhost:3001/counters/p1/views/incr` twice then `curl -s localhost:3001/counters/p1/views` — expected: count increases by 1 each POST and the GET reflects it. `curl -s -XPOST localhost:3001/counters/p1/stock/decr -H 'content-type: application/json' -d '{"by":2}'` — expected: returns the decremented value.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P4-5 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P4-6 — `collections/` — Carts as HASHES

- **Status:** 🔴 Not Started
- **Priority:** Medium
- **Size:** M (1.5–3 h)
- **Depends on:** `Phase 3`

### Description

A shopping cart modeled as a Redis **hash**: the cart is one key, each line item is a hash field → quantity (or a small line-item object). This demonstrates the hash group (matrix #21): `hset` (add/update a field), `hget` (read one field), `hgetall` (read the whole cart), `hdel` (remove a field). This task creates `CollectionsModule` and the cart routes; P4-7 adds the set (tags) routes to the same module.

### Acceptance Criteria

- [ ] `src/collections/collections.module.ts` declares `CollectionsController` + `CollectionsService`, imported by `AppModule`.
- [ ] `GET /collections/:id/cart` → `hgetall(prefix, id)` → `Record<string, CartLine>` (empty object when absent).
- [ ] `POST /collections/:id/cart` (Zod body `{ field, value }`) → `hset(prefix, id, field, value)` → returns the `hset` result (`number` of new fields).
- [ ] `GET /collections/:id/cart/:field` → `hget(prefix, id, field)` → the line or `null`.
- [ ] `DELETE /collections/:id/cart/:field` → `hdel(prefix, id, field)` → returns the count removed (`number`).
- [ ] Hash field values round-trip through the serializer (the `CartLine` is a typed object, not a raw string) — distinct from set members (P4-7).
- [ ] JSDoc on every public member; `typecheck` + `lint` pass.

### Files to create / modify

- `apps/api/src/collections/collections.service.ts` — hash (cart) ops.
- `apps/api/src/collections/collections.controller.ts` — cart routes.
- `apps/api/src/collections/collections.module.ts` — wiring.
- `apps/api/src/collections/dto/cart-item.dto.ts` — Zod `{ field, value }`.
- `apps/api/src/collections/collection.types.ts` — `CartLine` type.
- `apps/api/src/app.module.ts` — import `CollectionsModule`.

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer.
> Context: Task **P4-6** of `docs/DEVELOPMENT_PLAN.md` §Phase 4; endpoint catalogue `docs/TECHNICAL_SPECIFICATION.md` §11.1 — `GET /collections/:id/cart` · `POST …/cart` · `DELETE …/cart/:field`, cart as a hash; matrix #21 (`hget`/`hset`/`hgetall`/`hdel`). Spec §10.1 maps `collections` → carts (hash) + tags (set). Phase 3 provides `CacheService` + `CACHE_PREFIX`.
> `CacheService` hash signatures (spec §4.1, separate args, auto-namespaced): `hget<T>(prefix, id, field): Promise<T | null>`, `hset<T>(prefix, id, field, value): Promise<number>`, `hgetall<T>(prefix, id): Promise<Record<string, T>>`, `hdel(prefix, id, ...fields): Promise<number>`. Hash values ARE passed through the serializer (so a `CartLine` object round-trips as JSON) — unlike set members (P4-7).
> Objective: Build the cart-as-hash side of `CollectionsModule`.
> Steps:
>
> 1. `collection.types.ts`: `interface CartLine { quantity: number; priceCents: number }` (or similar small object). JSDoc it.
> 2. `dto/cart-item.dto.ts`: `CartItemSchema = z.object({ field: z.string().min(1), value: z.object({ quantity: z.number().int().positive(), priceCents: z.number().int().nonnegative() }) })`; inferred type. JSDoc it.
> 3. `collections.service.ts`: `@Injectable() CollectionsService` injecting `CacheService`, `private readonly cartPrefix = CACHE_PREFIX.cart`.
>    - `getCart(id): Promise<Record<string, CartLine>>` → `hgetall<CartLine>`.
>    - `getCartLine(id, field): Promise<CartLine | null>` → `hget<CartLine>`.
>    - `setCartLine(id, field, value: CartLine): Promise<number>` → `hset<CartLine>`.
>    - `removeCartLine(id, field): Promise<number>` → `hdel(prefix, id, field)`.
>    - JSDoc each.
> 4. `collections.controller.ts`: `@Controller('collections')`. `@Get(':id/cart')`, `@Get(':id/cart/:field')`, `@Post(':id/cart')` (`@Body(ZodValidationPipe(CartItemSchema))`), `@Delete(':id/cart/:field')`. Thin; delegate.
> 5. `collections.module.ts`; import into `app.module.ts`. Add a `CACHE_PREFIX.cart` typed prefix in `src/common/cache-keys.ts` if absent.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - Zod DTO only; NO class-validator, NO Swagger.
> - Keep this task to the **hash/cart** routes only; P4-7 adds the set/tag routes to the same module.
> - `(prefix, id, field, …)` arg shapes; never build keys by hand.
>   Verification:
> - `pnpm --filter api typecheck` + `pnpm --filter api lint` — expected: exit 0.
> - `curl -s -XPOST localhost:3001/collections/c1/cart -H 'content-type: application/json' -d '{"field":"p1","value":{"quantity":2,"priceCents":999}}'` then `curl -s localhost:3001/collections/c1/cart` — expected: `{ "p1": { "quantity": 2, "priceCents": 999 } }`. `DELETE …/cart/p1` then GET — expected: `{}`.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P4-6 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P4-7 — `collections/` — Tags as SETS

- **Status:** 🔴 Not Started
- **Priority:** Medium
- **Size:** M (1.5–3 h)
- **Depends on:** `P4-6`

### Description

Product **tags** modeled as a Redis **set**: unordered, unique members. Demonstrates the set group (matrix #22): `sadd` (add members), `srem` (remove), `smembers` (list), `sismember` (membership test), `scard` (count). Added to the `CollectionsModule` from P4-6. **Honest-design note to bake in:** the library stores set members **raw** — the serializer is intentionally **not** applied to set members — so members are plain strings, never JSON-encoded objects. The route shapes and JSDoc must label set values as **raw string members**.

### Acceptance Criteria

- [ ] `POST /collections/:id/tags` (Zod body `{ tags: string[] }`) → `sadd(prefix, id, ...tags)` → returns count added (`number`).
- [ ] `GET /collections/:id/tags` → `smembers(prefix, id)` → `string[]`, plus `scard(prefix, id)` count (e.g. `{ tags, count }`).
- [ ] `GET /collections/:id/tags/:tag` → `sismember(prefix, id, tag)` → `boolean`.
- [ ] `DELETE /collections/:id/tags/:tag` → `srem(prefix, id, tag)` → count removed (`number`).
- [ ] `smembers` typed `Promise<string[]>`, `sismember` `Promise<boolean>`, `scard` `Promise<number>`, `sadd`/`srem` `Promise<number>` (spec §4.1).
- [ ] JSDoc explicitly states set members are stored **raw** (serializer not applied) — they are plain strings, not JSON; the API contract reflects `string[]`, never objects.
- [ ] `typecheck` + `lint` pass.

### Files to create / modify

- `apps/api/src/collections/collections.service.ts` — add set (tag) ops.
- `apps/api/src/collections/collections.controller.ts` — add tag routes.
- `apps/api/src/collections/dto/tags.dto.ts` — Zod `{ tags: string[] }`.
- `apps/api/src/common/cache-keys.ts` — add `tags` prefix (if absent).

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer.
> Context: Task **P4-7** of `docs/DEVELOPMENT_PLAN.md` §Phase 4; endpoint catalogue `docs/TECHNICAL_SPECIFICATION.md` §11.1 — `POST /collections/:id/tags` · `GET …/tags` · `DELETE …/tags/:tag`, tags as a set; matrix #22 (`sadd`/`srem`/`smembers`/`sismember`/`scard`). Builds on `CollectionsModule` (P4-6).
> `CacheService` set signatures (spec §4.1, separate args, auto-namespaced): `sadd(prefix, id, ...members): Promise<number>`, `srem(prefix, id, ...members): Promise<number>`, `smembers(prefix, id): Promise<string[]>`, `sismember(prefix, id, member): Promise<boolean>`, `scard(prefix, id): Promise<number>`.
> **CRITICAL honest-design note (spec §12.2):** set members are stored **RAW** — the serializer is intentionally **NOT** applied to set members. So members are plain strings going in and `string[]` coming out; you cannot store/retrieve typed objects via the set API. Reflect this in the DTO (`tags: string[]`), the return types, and a JSDoc line on the service ("set members are stored raw — the serializer is not applied; members are plain strings").
> Objective: Add the tags-as-set side of `CollectionsModule`.
> Steps:
>
> 1. `dto/tags.dto.ts`: `TagsSchema = z.object({ tags: z.array(z.string().min(1)).min(1) })`; inferred type. JSDoc it.
> 2. `collections.service.ts` (extend): `private readonly tagsPrefix = CACHE_PREFIX.tags`.
>    - `addTags(id, tags: string[]): Promise<number>` → `this.cache.sadd(this.tagsPrefix, id, ...tags)`.
>    - `listTags(id): Promise<{ tags: string[]; count: number }>` → `smembers` + `scard`.
>    - `hasTag(id, tag): Promise<boolean>` → `sismember`.
>    - `removeTag(id, tag): Promise<number>` → `srem(this.tagsPrefix, id, tag)`.
>    - Add the raw-members JSDoc note on the class or the `addTags`/`listTags` methods.
> 3. `collections.controller.ts` (extend): `@Post(':id/tags')` (`@Body(ZodValidationPipe(TagsSchema))`), `@Get(':id/tags')`, `@Get(':id/tags/:tag')`, `@Delete(':id/tags/:tag')`. Thin; delegate.
> 4. Add `CACHE_PREFIX.tags` typed prefix in `src/common/cache-keys.ts` if absent.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - Zod DTO only; NO class-validator, NO Swagger.
> - Do NOT attempt to JSON-encode set members or type them as objects — they are raw strings by library design; label them as such.
> - `(prefix, id, ...members)` arg shapes; never build keys by hand.
>   Verification:
> - `pnpm --filter api typecheck` + `pnpm --filter api lint` — expected: exit 0.
> - `curl -s -XPOST localhost:3001/collections/p1/tags -H 'content-type: application/json' -d '{"tags":["sale","new"]}'` then `curl -s localhost:3001/collections/p1/tags` — expected: `{ "tags": ["sale","new"], "count": 2 }` (order not guaranteed). `curl -s localhost:3001/collections/p1/tags/sale` — expected: `true`. `DELETE …/tags/sale` then GET — expected: count drops to 1.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P4-7 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P4-8 — `MetricsService` (Per-Prefix Hit/Miss) + Interceptor + `GET /metrics`

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** M (1.5–3 h)
- **Depends on:** `P4-2`

### Description

Application-level cache metrics. A `MetricsService` keeps per-prefix hit/miss counters **in process** (a `Map`, reset on restart — **not** a library feature). `GET /metrics` returns the per-prefix counters plus a sampled `instantaneous_ops_per_sec`. This flesh-fills the stub created in P4-2 (same class + call sites — `recordHit`/`recordMiss`). A `CacheMetricsInterceptor` may sample request throughput for the ops/sec figure; alternatively the service exposes an internal ops sampler. **Honest-labeling note to bake in:** these are app-level, in-process counters that reset on restart — the response and JSDoc must say so, so nobody mistakes them for a library capability.

### Acceptance Criteria

- [ ] `src/metrics/metrics.service.ts` keeps an in-process per-prefix `{ hits, misses }` map; `recordHit(prefix)` / `recordMiss(prefix)` mutate it; `snapshot()` returns a typed, serializable view (per-prefix + totals + computed hit rate).
- [ ] `recordHit`/`recordMiss` signatures match the P4-2 stub exactly (so the catalog call sites need no change).
- [ ] A `CacheMetricsInterceptor` (or an in-service sampler) produces `instantaneous_ops_per_sec` (a sampled rate over a short window).
- [ ] `MetricsModule` provides + exports `MetricsService` (and the interceptor if used); `CatalogModule` (and any other consumer) imports it; the Phase-3 `GET /metrics` placeholder is replaced by the real handler (in `MetricsController` or the existing `HealthController`).
- [ ] `GET /metrics` returns `{ prefixes: {...}, totals: { hits, misses, hitRate }, instantaneous_ops_per_sec }` and is explicitly labeled app-level / in-process / reset-on-restart (field name or a `note` field + JSDoc).
- [ ] No magic numbers — the sampling window is a named constant.
- [ ] JSDoc on every public member; `typecheck` + `lint` pass.

### Files to create / modify

- `apps/api/src/metrics/metrics.service.ts` — real per-prefix counters + sampler (replaces P4-2 stub body).
- `apps/api/src/metrics/metrics.controller.ts` — `GET /metrics` (or wire into `HealthController`).
- `apps/api/src/metrics/cache-metrics.interceptor.ts` — ops/sec sampler (if used).
- `apps/api/src/metrics/metrics.module.ts` — provide/export.
- `apps/api/src/metrics/metrics.types.ts` — `MetricsSnapshot` type.

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer.
> Context: Task **P4-8** of `docs/DEVELOPMENT_PLAN.md` §Phase 4. Spec §10.1 (`metrics` module — "in-app hit/miss counters (clearly app-level)"), §20.3 ("Hit/miss counters are an **application** concern, not a library feature. A small `MetricsService` tracks per-prefix hits/misses in memory (reset on restart); `GET /metrics` returns them … The UI labels this section 'app-level metrics'"). The Phase-4 deliverable also asks for a sampled `instantaneous_ops_per_sec`. P4-2 created a minimal `MetricsService` stub (`recordHit`/`recordMiss`) injected by `CatalogService`; this task fills it in **without changing those call sites**.
> Objective: Implement real in-process per-prefix hit/miss metrics + an ops/sec sample, exposed at `GET /metrics`.
> Steps:
>
> 1. `metrics.types.ts`: `interface MetricsSnapshot { prefixes: Record<string, { hits: number; misses: number; hitRate: number }>; totals: { hits: number; misses: number; hitRate: number }; instantaneous_ops_per_sec: number; note: string }`. JSDoc it.
> 2. `metrics.service.ts`: `@Injectable() MetricsService`.
>    - Private `Map<string, { hits: number; misses: number }>`.
>    - `recordHit(prefix: string): void` / `recordMiss(prefix: string): void` (keep the exact signatures from the P4-2 stub) — also bump an internal op counter used by the sampler.
>    - `snapshot(): MetricsSnapshot` — compute per-prefix + totals + `hitRate` (guard divide-by-zero → 0), the current `instantaneous_ops_per_sec`, and a constant `note: 'app-level, in-process counters; reset on restart — not a library feature'`.
>    - ops/sec sampler: keep a rolling op count over a `const SAMPLE_WINDOW_MS = 1000` window (named constant, no magic number); compute rate on read. Keep it simple and allocation-light.
>    - JSDoc every public member; class-level JSDoc states these are app-level/in-process.
> 3. (Optional) `cache-metrics.interceptor.ts`: a NestJS `@Injectable() implements NestInterceptor` that increments the service's op counter per handled request. If you prefer the in-service sampler only, skip the interceptor and document the choice. Do not double-count.
> 4. `metrics.controller.ts`: `@Controller('metrics')` `@Get()` → `return this.metrics.snapshot()`. If Phase 3 left a `/metrics` placeholder in `HealthController`, REMOVE it (avoid a duplicate route) and centralize here. JSDoc the route, restating the app-level caveat.
> 5. `metrics.module.ts`: provide + export `MetricsService` (and the interceptor if used); ensure `CatalogModule` imports `MetricsModule` (it already does from P4-2). Register the interceptor globally via `APP_INTERCEPTOR` only if you implemented it.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - NO Swagger; JSDoc + (if any input) Zod only.
> - Keep counters in memory — do NOT persist to Redis or anywhere (resetting on restart is the intended, honest behavior).
> - Label the output as app-level / in-process / reset-on-restart in BOTH the payload and JSDoc — never imply the library provides metrics.
> - Do NOT change the `recordHit`/`recordMiss` signatures (P4-2/P4-3 call them).
> - No magic numbers (sampling window is a named constant).
>   Verification:
> - `pnpm --filter api typecheck` + `pnpm --filter api lint` — expected: exit 0.
> - `curl -s localhost:3001/catalog/products/p1` (miss) then again (hit), then `curl -s localhost:3001/metrics` — expected: `prefixes["product"]` shows ≥1 miss and ≥1 hit, `totals.hitRate` between 0 and 1, an `instantaneous_ops_per_sec` number, and the app-level `note`.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P4-8 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P4-9 — TTL Ops on Catalog Keys (`expire` / `ttl` / `persist`) + Phase Verification

- **Status:** 🔴 Not Started
- **Priority:** Medium
- **Size:** S (30–90 min)
- **Depends on:** `P4-2`, `P4-3`, `P4-4`, `P4-5`, `P4-6`, `P4-7`, `P4-8`

### Description

Expose TTL lifecycle operations on catalog keys — `expire` (extend/set a TTL), `ttl` (read remaining TTL), `persist` (remove the TTL so the key never expires) — which the Explorer and TTL dashboard pages reuse later (matrix #19). Then run the Phase-4 "Definition of done" gate: every endpoint returns correct typed shapes, a second `GET` of the same product is a hit (faster, counter increments), and set members are stored raw (documented). Closes the phase.

### Acceptance Criteria

- [ ] `POST /catalog/products/:id/expire` (Zod body `{ ttlSeconds }`) → `expire(prefix, id, ttlSeconds)` → returns `boolean` (whether the key existed / TTL was set).
- [ ] `GET /catalog/products/:id/ttl` → `ttl(prefix, id)` → returns the number, with the honest semantics documented in JSDoc: **`-2` = no such key, `-1` = key exists but has no expiry** (spec §4.1).
- [ ] `POST /catalog/products/:id/persist` → `persist(prefix, id)` → returns `boolean` (whether an existing TTL was removed).
- [ ] `expire`/`persist` typed `Promise<boolean>`, `ttl` typed `Promise<number>`.
- [ ] All three routes live in `CatalogController`/`CatalogService` and reuse the typed `ProductParamsSchema`.
- [ ] JSDoc on every new member, including the `-2`/`-1` `ttl` note.
- [ ] **Phase gate:** `pnpm --filter api typecheck` + `pnpm --filter api lint` pass; the DoD checks below all hold.

### Files to create / modify

- `apps/api/src/catalog/catalog.service.ts` — add `setTtl` / `getTtl` / `persist`.
- `apps/api/src/catalog/catalog.controller.ts` — add the three TTL routes.
- `apps/api/src/catalog/dto/expire.dto.ts` — Zod `{ ttlSeconds }`.

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer.
> Context: Task **P4-9** of `docs/DEVELOPMENT_PLAN.md` §Phase 4 — the final task; it adds TTL ops and runs the phase gate. The deliverable: "TTL ops surfaced on catalog keys: `expire` / `ttl` / `persist` (reused by the Explorer + TTL pages)"; matrix #19. Endpoint catalogue `docs/TECHNICAL_SPECIFICATION.md` §11.1 also surfaces `ttl` in `/admin/keys/:key` (built in Phase 5) and the TTL scenario in §12.1. Builds on `CatalogModule` (P4-2).
> `CacheService` TTL signatures (spec §4.1, separate args, auto-namespaced): `expire(prefix, id, ttlSeconds): Promise<boolean>`, `ttl(prefix, id): Promise<number>` (**returns `-2` if the key does not exist, `-1` if the key exists but has no expiry**), `persist(prefix, id): Promise<boolean>`.
> Objective: Add the TTL lifecycle routes to the catalog and verify the whole phase.
> Steps:
>
> 1. `dto/expire.dto.ts`: `ExpireSchema = z.object({ ttlSeconds: z.coerce.number().int().positive() })`; inferred type. JSDoc it.
> 2. `catalog.service.ts`:
>    - `setTtl(id, ttlSeconds): Promise<boolean>` → `this.cache.expire(this.prefix, id, ttlSeconds)`.
>    - `getTtl(id): Promise<number>` → `this.cache.ttl(this.prefix, id)` — JSDoc the `-2` (no key) / `-1` (no expiry) contract.
>    - `persist(id): Promise<boolean>` → `this.cache.persist(this.prefix, id)`.
> 3. `catalog.controller.ts`: `@Post(':id/expire')` (`@Body(ZodValidationPipe(ExpireSchema))`), `@Get(':id/ttl')`, `@Post(':id/persist')`. Thin; delegate. JSDoc each, restating the `ttl` `-2`/`-1` semantics on the GET.
> 4. **Run the Phase-4 Definition-of-Done gate** (do NOT add throwaway code to make it pass; fix the responsible earlier task file if something is off):
>    - `pnpm --filter api typecheck` and `pnpm --filter api lint` exit 0.
>    - Boot against Docker Redis; confirm each Phase-4 endpoint returns the documented typed shape: `GET /catalog/products/:id` (single), `GET /catalog/products?ids=` (batch), `POST …/:id/seed` (idempotent), counters incr/decr, cart hash CRUD, tags set CRUD, `GET /metrics`, and the new TTL routes.
>    - Prove the read-through: `GET /catalog/products/p1` twice — first a miss (slower), second a hit (faster); `GET /metrics` shows the hit + miss recorded for `product`.
>    - Prove TTL: seed/get a product, `POST …/expire {ttlSeconds:5}` → `true`, `GET …/ttl` → ~5 then counts down; `POST …/persist` → `true`, `GET …/ttl` → `-1`. For an unknown id, `GET …/ttl` → `-2`.
>    - Confirm set members are stored raw (P4-7) and that this is documented.
>      Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - Zod DTO only; NO class-validator, NO Swagger.
> - Document the `ttl` `-2`/`-1` semantics honestly; do not normalize them away.
> - `(prefix, id, …)` arg shapes; never build keys by hand.
>   Verification:
> - `pnpm --filter api typecheck` — expected: exit 0.
> - `pnpm --filter api lint` — expected: exit 0.
> - `curl -s -XPOST localhost:3001/catalog/products/p1/expire -H 'content-type: application/json' -d '{"ttlSeconds":5}'` → `true`; `curl -s localhost:3001/catalog/products/p1/ttl` → a number ≤ 5; after `POST …/persist`, `…/ttl` → `-1`; `…/ttl` for an unseeded id → `-2`.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P4-9 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

When this task is 🟢, Phase 4 is 9/9 — switch the Phase 4 row in `DEVELOPMENT_PLAN.md` Progress Summary to 🟢 Done.

⚠️ Never mark done with failing verification.

---

## Completion log

_(Agents append one line per finished task, newest at the bottom.)_
