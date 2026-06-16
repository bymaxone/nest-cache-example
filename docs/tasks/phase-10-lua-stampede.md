# Phase 10 — Lua Scripts & Cache Stampede — Tasks

> **Source:** [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#phase-10--lua-scripts--cache-stampede) §Phase 10
> **Total tasks:** 5
> **Progress:** 🔴 0 / 5 done (0%)
>
> **Status legend:** 🔴 Not Started · 🟡 In Progress · 🔵 In Review · 🟢 Done · ⚪ Blocked

## Task index

| ID    | Task                                                                  | Status | Priority | Size | Depends on   |
| ----- | --------------------------------------------------------------------- | ------ | -------- | ---- | ------------ |
| P10-1 | Declare `CACHE_SCRIPTS` (`acquireLock`) + wire into `cache.config.ts` | 🔴     | High     | S    | Phase 3      |
| P10-2 | `src/stampede/` module + `POST /stampede` firing N concurrent reqs    | 🔴     | High     | M    | P10-1        |
| P10-3 | Single-flight behaviour (winner fetches, losers wait then hit)        | 🔴     | High     | M    | P10-2        |
| P10-4 | Timeline log + expose resolved SHA via `ScriptManagerService.load`    | 🔴     | Medium   | S    | P10-3        |
| P10-5 | Phase verification (10 concurrent → 1 fetch + 9 hits; stable SHA1)    | 🔴     | Medium   | S    | P10-1..P10-4 |

---

## P10-1 — Declare `CACHE_SCRIPTS` (`acquireLock`) + wire into `cache.config.ts`

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** S (30–90 min)
- **Depends on:** `Phase 3`

### Description

Declare the single-flight Lua lock as a typed `IScriptDefinition` and register it via the module's `options.scripts` so `ScriptManagerService` eager-loads it on bootstrap (`SCRIPT LOAD` → `EVALSHA`, with transparent `NOSCRIPT` reload-retry on standalone/sentinel). The library exposes `options.scripts: readonly IScriptDefinition[]` where `IScriptDefinition = { name: string; lua: string }` (spec §4 + §18.1). The Lua body MUST be declared **in code, never built from request input** — this is a security invariant (spec §24): a Lua string assembled from a request is a script-injection vector. The `acquireLock` script is the canonical `SET NX PX` single-flight primitive: it returns `1` if the caller won the lock, else `0`.

### Acceptance Criteria

- [ ] `src/cache/scripts/index.ts` exports `export const CACHE_SCRIPTS: readonly IScriptDefinition[]`.
- [ ] `CACHE_SCRIPTS` contains an `acquireLock` entry whose `lua` is exactly `if redis.call('SET', KEYS[1], ARGV[1], 'NX', 'PX', ARGV[2]) then return 1 else return 0 end`.
- [ ] `IScriptDefinition` is imported from `@bymax-one/nest-cache` (the `/shared` surface); the Lua is a string literal in source, never composed from any runtime input.
- [ ] `cache.config.ts` (from Phase 3) sets `scripts: CACHE_SCRIPTS` on the `BymaxCacheModule` options.
- [ ] A short JSDoc on `CACHE_SCRIPTS` (and on `acquireLock`) states the `SET NX PX` semantics (`1` = won, `0` = lost) and the "declared in code, never from request input" invariant.
- [ ] `pnpm --filter @nest-cache-example/api typecheck` exits 0.

### Files to create / modify

- `apps/api/src/cache/scripts/index.ts` — `CACHE_SCRIPTS` registry (new).
- `apps/api/src/cache/cache.config.ts` — wire `scripts: CACHE_SCRIPTS` (from Phase 3).

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer wiring a Redis Lua script registry.
> Context: Repo `nest-cache-example` is the reference app for `@bymax-one/nest-cache` (see `docs/DEVELOPMENT_PLAN.md` §Phase 10 + §2 Global Conventions, `docs/TECHNICAL_SPECIFICATION.md` §4 + §18, and `docs/DASHBOARD.md` §11). This is task P10-1. Phase 3 already wired `BymaxCacheModule` in `apps/api/src/cache/` with a `cache.config.ts` that builds the options object; this task adds the script registry and plugs it into `options.scripts`.
> Objective: Declare the `acquireLock` single-flight Lua script as a typed `IScriptDefinition` and register it on the module.
> Steps:
>
> 1. Create `apps/api/src/cache/scripts/index.ts`:
>
>    ```ts
>    import type { IScriptDefinition } from '@bymax-one/nest-cache'
>
>    /**
>     * Lua scripts pre-registered on the cache module via `options.scripts`.
>     *
>     * SECURITY INVARIANT (spec §24): every `lua` body is a string literal declared
>     * here in code. A Lua script MUST NEVER be built from request input — doing so
>     * is a script-injection vector. Only `KEYS`/`ARGV` are parameterised at call time.
>     */
>    export const CACHE_SCRIPTS: readonly IScriptDefinition[] = [
>      {
>        name: 'acquireLock',
>        // SET NX PX — single-flight lock. Returns 1 if the caller won the lock, else 0.
>        // KEYS[1] = lock key (auto-namespaced by CacheService.eval); ARGV[1] = token; ARGV[2] = ttl(ms).
>        lua: `if redis.call('SET', KEYS[1], ARGV[1], 'NX', 'PX', ARGV[2]) then return 1 else return 0 end`,
>      },
>    ]
>    ```
>
> 2. Open `apps/api/src/cache/cache.config.ts` (Phase 3). Import `CACHE_SCRIPTS` and set `scripts: CACHE_SCRIPTS` on the options object the module factory returns. Do NOT change any other Phase 3 option.
> 3. Run `pnpm --filter @nest-cache-example/api typecheck`.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions (TypeScript strict, ESM, English-only comments).
> - **NO Swagger** anywhere — JSDoc + Zod only.
> - The `lua` field MUST be a literal string in source. Do NOT accept Lua text from any DTO, query, or env var (spec §24 security invariant).
> - `IScriptDefinition` is `{ name: string; lua: string }` (spec §4) — do not redeclare it locally; import it from `@bymax-one/nest-cache`.
> - Do NOT call `register`/`load`/`eval` here — registration is declarative via `options.scripts`; the manager eager-loads on bootstrap.
>   Verification:
> - `pnpm --filter @nest-cache-example/api typecheck` — expected: exit 0.
> - `grep -c "SET', KEYS\[1\], ARGV\[1\], 'NX', 'PX', ARGV\[2\]" apps/api/src/cache/scripts/index.ts` — expected: `1`.
> - `grep -n "scripts: CACHE_SCRIPTS" apps/api/src/cache/cache.config.ts` — expected: a match.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P10-1 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

If phase reaches 100%, switch its row status in `DEVELOPMENT_PLAN.md` to 🟢.

⚠️ Never mark done with failing verification.

---

## P10-2 — `src/stampede/` module + `POST /stampede` firing N concurrent reqs

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** M (2–4 h)
- **Depends on:** `P10-1`

### Description

Build the stampede feature module — a controller + service that fire **N concurrent in-process requests** for one uncached product and have each contender attempt the single-flight lock. The endpoint is `POST /stampede?productId=&concurrency=&lockMs=` (spec §18.2, DASHBOARD §11). Each contender calls `CacheService.eval('acquireLock', ['stampede:' + productId], [token, lockMs])`. Per spec §4 + §18, `eval(scriptName: string, keys: readonly string[], args: ReadonlyArray<string | number>): Promise<unknown>` — **KEYS are auto-namespaced by `eval`** (so `'stampede:42'` becomes `cache-example:stampede:42`), while **ARGV is passed untouched** (the lock `token` and `lockMs` cross the wire verbatim). This task lands the module wiring, the Zod-validated query, and the N-way concurrent fan-out with per-contender `eval` calls. The single-flight resolution (winner/loser branching) lands in P10-3.

### Acceptance Criteria

- [ ] `src/stampede/stampede.module.ts`, `stampede.controller.ts`, `stampede.service.ts` exist and the module is imported by `app.module.ts`.
- [ ] `POST /stampede` accepts `productId` (string/number), `concurrency` (int, default 10), `lockMs` (int ms, default 2000) as **Zod-validated** query params — **no Swagger / no class-validator decorators**.
- [ ] The service fires exactly `concurrency` concurrent attempts (e.g. `Promise.all` over an array of size `concurrency`), each calling `cacheService.eval('acquireLock', ['stampede:' + productId], [token, lockMs])`.
- [ ] Each contender generates a **unique lock token** (e.g. `randomUUID()`); `eval` KEYS use the bare `stampede:{productId}` form (the library namespaces it — do NOT prefix `cache-example:` by hand).
- [ ] `args` are passed as `[token, lockMs]` (string + number) untouched — no manual namespacing of ARGV.
- [ ] JSDoc on the public controller method + service method; the controller has an inline note that keys are auto-namespaced by `eval` and the Lua body is declared in code (spec §18, §24).
- [ ] `pnpm --filter @nest-cache-example/api typecheck` + `pnpm --filter @nest-cache-example/api lint` exit 0.

### Files to create / modify

- `apps/api/src/stampede/stampede.module.ts` — feature module (new).
- `apps/api/src/stampede/stampede.controller.ts` — `POST /stampede` (new).
- `apps/api/src/stampede/stampede.service.ts` — concurrent fan-out + `eval` (new).
- `apps/api/src/stampede/dto/stampede-query.dto.ts` — Zod schema for the query (new).
- `apps/api/src/app.module.ts` — import `StampedeModule`.

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer.
> Context: Task P10-2 of `docs/DEVELOPMENT_PLAN.md` §Phase 10. Read `docs/TECHNICAL_SPECIFICATION.md` §18.2 and `docs/DASHBOARD.md` §11 (the Stampede Lab) first. P10-1 registered the `acquireLock` script via `options.scripts`. `CacheService` is injected from `@bymax-one/nest-cache` (the cache module is `@Global()`, so it is available everywhere). API uses Zod for validation — there is **no Swagger** in this repo.
> Objective: Create the `stampede` feature module and a `POST /stampede` endpoint that fires N concurrent contenders, each calling the single-flight `eval('acquireLock', …)`.
> Steps:
>
> 1. Create `apps/api/src/stampede/dto/stampede-query.dto.ts` — a Zod schema:
>
>    ```ts
>    import { z } from 'zod'
>
>    export const stampedeQuerySchema = z.object({
>      productId: z.coerce.string().min(1),
>      concurrency: z.coerce.number().int().min(1).max(100).default(10),
>      lockMs: z.coerce.number().int().min(50).max(60_000).default(2000),
>    })
>
>    export type StampedeQuery = z.infer<typeof stampedeQuerySchema>
>    ```
>
> 2. Create `apps/api/src/stampede/stampede.service.ts`. Inject `CacheService` (from `@bymax-one/nest-cache`). Add a method `run(query: StampedeQuery)` that fires `concurrency` concurrent attempts:
>
>    ```ts
>    const attempts = Array.from({ length: concurrency }, () => this.attempt(productId, lockMs))
>    const results = await Promise.all(attempts)
>    ```
>
>    where `attempt` mints a `token = randomUUID()` and calls:
>
>    ```ts
>    // KEYS auto-namespaced by eval → cache-example:stampede:{productId}; ARGV passed untouched.
>    const won = await this.cache.eval('acquireLock', [`stampede:${productId}`], [token, lockMs])
>    ```
>
>    For this task it is enough to return per-contender `{ token, won: won === 1 }`; the winner/loser fetch+wait+hit logic is P10-3 (leave a clear `// P10-3:` seam).
>
> 3. Create `apps/api/src/stampede/stampede.controller.ts` with `@Controller('stampede')` and a `@Post()` handler that parses the query through `stampedeQuerySchema` (a `ZodValidationPipe` or `schema.parse(req.query)` — match the repo's existing Zod-pipe convention from earlier phases) and delegates to the service. Add an inline comment: keys are namespaced by `eval` (`cache-example:stampede:{id}`); the Lua body is declared in code, never from request input (spec §18, §24).
> 4. Create `apps/api/src/stampede/stampede.module.ts` (declares the controller + service) and import it in `apps/api/src/app.module.ts`.
> 5. Run `pnpm --filter @nest-cache-example/api typecheck` and `... lint`.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions (strict TS, ESM, English-only comments, JSDoc on exported/public members).
> - **NO Swagger** — validate with Zod only; do NOT add `@nestjs/swagger` or `class-validator` decorators.
> - `eval` signature is `eval(scriptName, keys, args)` — KEYS auto-namespaced, ARGV verbatim. Do NOT hand-prefix `cache-example:` onto the key, and do NOT mutate `args`.
> - Use the bare script **name** `'acquireLock'` (registered in P10-1) — do NOT pass Lua text to `eval`.
> - Do NOT touch `cache.config.ts` or the script registry here (that was P10-1).
>   Verification:
> - `pnpm --filter @nest-cache-example/api typecheck` — expected: exit 0.
> - `pnpm --filter @nest-cache-example/api lint` — expected: exit 0.
> - `grep -n "eval('acquireLock'" apps/api/src/stampede/stampede.service.ts` — expected: a match.
> - `grep -n "StampedeModule" apps/api/src/app.module.ts` — expected: a match.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P10-2 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

If phase reaches 100%, switch its row status in `DEVELOPMENT_PLAN.md` to 🟢.

⚠️ Never mark done with failing verification.

---

## P10-3 — Single-flight behaviour (winner fetches, losers wait then hit)

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** M (2–4 h)
- **Depends on:** `P10-2`

### Description

Implement the actual single-flight collapse on top of the P10-2 fan-out (spec §18.2). The contender whose `eval` returns `1` is the **winner**: it fetches the slow origin (a simulated latency, e.g. ~400 ms), populates the cache key for the product, then releases the lock. The contenders whose `eval` returns `0` are **losers**: they briefly wait (poll/backoff) and then read the **now-populated cache** — a hit. The net effect: N concurrent misses collapse into exactly **one** origin fetch + (N−1) cache hits. The lock release must be **token-safe** (only the holder releases — a contender deletes the lock only if its token still owns it), so a slow loser never deletes a lock a later winner re-acquired.

### Acceptance Criteria

- [ ] The winner (`eval` → `1`) fetches a simulated slow origin (configurable/fixed latency), `set`s the product cache key, then releases the lock.
- [ ] Losers (`eval` → `0`) wait with a bounded retry/backoff loop, then `get` the populated key (a cache hit) rather than fetching the origin.
- [ ] Across one `POST /stampede` with `concurrency = N`, exactly **1** origin fetch occurs and **N−1** reads are cache hits (counted by the service).
- [ ] Lock release is **token-safe** — a contender releases the lock only if it still holds its own token (compare-then-delete; do NOT blind-`del` the lock key).
- [ ] The product cache key is written through `CacheService` (namespaced), distinct from the `stampede:{productId}` lock key.
- [ ] Loser wait is bounded (a max wait derived from `lockMs`) so the handler can never hang indefinitely if the winner errors.
- [ ] `pnpm --filter @nest-cache-example/api typecheck` + `... lint` exit 0.

### Files to create / modify

- `apps/api/src/stampede/stampede.service.ts` — winner/loser branching, origin fetch, token-safe release.
- `apps/api/src/stampede/origin.ts` — simulated slow origin fetch (new; optional split).

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer implementing a cache single-flight pattern.
> Context: Task P10-3 of `docs/DEVELOPMENT_PLAN.md` §Phase 10. Read `docs/TECHNICAL_SPECIFICATION.md` §18.2 (winner fetches origin + populates + releases; losers wait then read the hit) and `docs/DASHBOARD.md` §11 (the timeline `LOCK WON → origin fetch → SET → release` vs `wait → cache HIT`). P10-2 already fires `concurrency` contenders, each with its own `token`, each calling `eval('acquireLock', ['stampede:'+productId], [token, lockMs])`.
> Objective: Turn the fan-out into a real single-flight collapse — 1 origin fetch, N−1 hits.
> Steps:
>
> 1. Add a simulated slow origin (e.g. `apps/api/src/stampede/origin.ts`): `fetchProductFromOrigin(productId)` that awaits a fixed delay (~400 ms) and returns a product-shaped object. Count invocations so the test in P10-5 can assert "exactly 1".
> 2. In `stampede.service.ts`, branch each contender on the `eval` result:
>    - **Winner (`=== 1`)**: `await fetchProductFromOrigin(productId)`, then `await this.cache.set('product', productId, value, …)` (or the repo's product-cache helper from an earlier phase — reuse it, do NOT invent a parallel key scheme), then **release the lock**.
>    - **Loser (`=== 0`)**: wait in a bounded loop (small backoff, capped by `lockMs`), polling `this.cache.get('product', productId)` until it is populated; record it as a **hit**.
> 3. Make lock release **token-safe**: only delete `stampede:{productId}` if it still holds this contender's token. Prefer a `compare-and-delete` (read-the-token-then-del-if-match, or a second registered Lua script if the repo wants atomicity — but the lock body itself stays declared in code, never request-built). A blind `del` is NOT acceptable.
> 4. Have `run()` aggregate counts: `originFetches`, `cacheHits`, and per-contender outcome, so P10-4 can shape the timeline and P10-5 can assert `originFetches === 1` and `cacheHits === concurrency - 1`.
> 5. Run `pnpm --filter @nest-cache-example/api typecheck` and `... lint`.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - **NO Swagger.** English-only comments. JSDoc on public/exported members.
> - Reuse the existing product-cache read/write path from earlier phases if one exists; keep the **lock key** (`stampede:{id}`) and the **product key** (`product:{id}`) distinct.
> - Loser waits MUST be bounded (cap derived from `lockMs`) — never an unbounded spin; the request must always terminate.
> - The lock Lua body stays a code-declared `IScriptDefinition` (P10-1 / §24) — release logic may add another registered script but never accepts Lua from input.
>   Verification:
> - `pnpm --filter @nest-cache-example/api typecheck` — expected: exit 0.
> - `pnpm --filter @nest-cache-example/api lint` — expected: exit 0.
> - Manual: with infra up (`pnpm infra:up`) and the API running, `curl -X POST "http://localhost:3001/stampede?productId=77&concurrency=10&lockMs=2000"` — expected: response indicates 1 origin fetch + 9 hits.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P10-3 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

If phase reaches 100%, switch its row status in `DEVELOPMENT_PLAN.md` to 🟢.

⚠️ Never mark done with failing verification.

---

## P10-4 — Timeline log + expose resolved SHA via `ScriptManagerService.load`

- **Status:** 🔴 Not Started
- **Priority:** Medium
- **Size:** S (30–90 min)
- **Depends on:** `P10-3`

### Description

Shape the `POST /stampede` response so the UI (`StampedeTimeline`, DASHBOARD §11) can render the swimlane: a per-contender **timeline log** (who acquired the lock / who waited / who hit), plus a result summary (origin fetches, cache hits, hit rate, multiplier saved). Additionally expose the script's resolved **SHA1** so the page can display it: read it via `ScriptManagerService.load('acquireLock')` (spec §18.2). Per spec §4, `ScriptManagerService` is injected via the token `BYMAX_CACHE_SCRIPT_REGISTRY` and offers `register(name, lua)`, `load(name): Promise<string>` (returns the SHA1), and `eval(name, keys, args)`. `load` is read-only here — the script is already registered (P10-1); calling `load` just returns its stable SHA1.

### Acceptance Criteria

- [ ] `POST /stampede` returns a structured body containing: a per-contender `timeline` (entries with at least `token`/index, `role` = `won` | `waited`, `outcome` = `origin` | `hit`, and timing), and a `summary` (`originFetches`, `cacheHits`, `hitRate`, `concurrency`).
- [ ] The response includes `script: { name: 'acquireLock', sha: <sha1> }`, where `sha` comes from `ScriptManagerService.load('acquireLock')`.
- [ ] `ScriptManagerService` is obtained via the `BYMAX_CACHE_SCRIPT_REGISTRY` token (or its exported provider type) from `@bymax-one/nest-cache` and injected into the stampede service.
- [ ] `load('acquireLock')` is used read-only — the service does NOT call `register` (the script is registered declaratively in P10-1) and does NOT rebuild Lua at runtime.
- [ ] The returned body shape is documented with a JSDoc type/interface so `apps/web` can type its fetch.
- [ ] `pnpm --filter @nest-cache-example/api typecheck` + `... lint` exit 0.

### Files to create / modify

- `apps/api/src/stampede/stampede.service.ts` — build the timeline + summary; inject + call `ScriptManagerService.load`.
- `apps/api/src/stampede/stampede.types.ts` — response/timeline interfaces (new).

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer.
> Context: Task P10-4 of `docs/DEVELOPMENT_PLAN.md` §Phase 10. Read `docs/DASHBOARD.md` §11 (the swimlane + result strip: `req#1 LOCK WON → origin fetch → SET → release ✓ hit src`; `req#2..N wait → cache HIT ✓ cached`; result `origin fetches 1/10 · cache hits 9/10 · hit rate 90% · saved 9×`) and `docs/TECHNICAL_SPECIFICATION.md` §18.2 + §4 (`ScriptManagerService.load(name) → SHA1`, token `BYMAX_CACHE_SCRIPT_REGISTRY`). P10-3 produced per-contender outcomes + counts.
> Objective: Return a UI-ready timeline + summary, and surface the resolved script SHA1 via `load`.
> Steps:
>
> 1. Create `apps/api/src/stampede/stampede.types.ts` with the response contract, e.g.:
>
>    ```ts
>    export interface StampedeTimelineEntry {
>      index: number
>      role: 'won' | 'waited'
>      outcome: 'origin' | 'hit'
>      startedAt: number
>      finishedAt: number
>    }
>    export interface StampedeResult {
>      timeline: readonly StampedeTimelineEntry[]
>      summary: { concurrency: number; originFetches: number; cacheHits: number; hitRate: number }
>      script: { name: string; sha: string }
>    }
>    ```
>
> 2. In `stampede.service.ts`, inject `ScriptManagerService`. Per spec §4 it is provided under the token `BYMAX_CACHE_SCRIPT_REGISTRY`; inject it with `@Inject(BYMAX_CACHE_SCRIPT_REGISTRY)` (import the token + type from `@bymax-one/nest-cache`) — or via the exported class if the library exports one (match the library's documented DI shape).
> 3. After the contenders resolve, call `const sha = await this.scripts.load('acquireLock')` (read-only — gets the SHA1 of the already-registered script). Assemble and return a `StampedeResult` with the per-contender `timeline`, the `summary` (compute `hitRate = cacheHits / concurrency`), and `script: { name: 'acquireLock', sha }`.
> 4. Have the controller return this object as JSON.
> 5. Run `pnpm --filter @nest-cache-example/api typecheck` and `... lint`.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions. **NO Swagger.** English-only. JSDoc on exported types + the public method.
> - `load` is **read-only** — do NOT call `register` (P10-1 already registered `acquireLock` declaratively) and do NOT recompute/inline the Lua.
> - Keep `timeline` bounded by `concurrency` (one entry per contender) — do not emit per-key/unbounded series (DASHBOARD bounded-dimension rule).
>   Verification:
> - `pnpm --filter @nest-cache-example/api typecheck` — expected: exit 0.
> - `pnpm --filter @nest-cache-example/api lint` — expected: exit 0.
> - `grep -n "load('acquireLock')" apps/api/src/stampede/stampede.service.ts` — expected: a match.
> - Manual: `curl -X POST ".../stampede?productId=77&concurrency=10"` — expected: JSON with `timeline`, `summary`, and `script.sha` (a 40-char hex SHA1).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P10-4 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

If phase reaches 100%, switch its row status in `DEVELOPMENT_PLAN.md` to 🟢.

⚠️ Never mark done with failing verification.

---

## P10-5 — Phase verification (10 concurrent → 1 fetch + 9 hits; stable SHA1)

- **Status:** 🔴 Not Started
- **Priority:** Medium
- **Size:** S (30–90 min)
- **Depends on:** `P10-1`, `P10-2`, `P10-3`, `P10-4`

### Description

Phase 10 "Definition of done" gate per `DEVELOPMENT_PLAN.md`: prove that firing **10 concurrent** requests for one uncached product yields **exactly 1 origin fetch + 9 cache hits**, that the timeline endpoint returns one lock winner + the waiters, and that `ScriptManagerService.load('acquireLock')` returns a **stable SHA1** (the same 40-char hex on repeated calls). Demonstrates matrix rows #9 (`BYMAX_CACHE_SCRIPT_REGISTRY` / `ScriptManagerService`), #28 (`CacheService.eval`), #34 (`register`/`load`/`eval`), #35 (`IScriptDefinition`). This closes the phase.

### Acceptance Criteria

- [ ] A test (or scripted verification) fires `POST /stampede?productId=&concurrency=10` against an uncached product and asserts `summary.originFetches === 1` and `summary.cacheHits === 9`.
- [ ] The `timeline` shows exactly one entry with `role: 'won'` / `outcome: 'origin'` and nine with `role: 'waited'` / `outcome: 'hit'`.
- [ ] `ScriptManagerService.load('acquireLock')` returns a 40-char hex SHA1, and two consecutive calls return the **same** value (stable).
- [ ] Verification ensures the product key starts uncached before the burst (flush/clear, or a fresh `productId`).
- [ ] `pnpm --filter @nest-cache-example/api test` (or the e2e target) passes; `pnpm --filter @nest-cache-example/api typecheck` + `... lint` exit 0.

### Files to create / modify

- `apps/api/test/stampede.e2e-spec.ts` — the phase verification test (new), _or_ a `src/stampede/*.spec.ts` integration test against a real/ephemeral Redis.

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer writing the phase-closing verification.
> Context: Task P10-5 of `docs/DEVELOPMENT_PLAN.md` §Phase 10. DoD: 10 concurrent requests → exactly 1 origin fetch + 9 hits; the timeline returns the lock winner + waiters; `load` returns a stable SHA1 (spec §18, DASHBOARD §11). Use the repo's existing test harness convention from earlier phases (Vitest/Jest + a Redis available via `pnpm infra:up`, or a Testcontainers/ephemeral Redis if that is what prior phases use — match it).
> Objective: Prove the single-flight collapse and the stable SHA1, then close the phase.
> Steps:
>
> 1. Ensure the target product key is uncached at test start (flush the namespace, or pick a unique `productId` per run).
> 2. Fire `POST /stampede?productId=<fresh>&concurrency=10&lockMs=2000` (via Nest e2e `request(app)` or an HTTP call to the running API). Assert `summary.originFetches === 1`, `summary.cacheHits === 9`, and that the timeline has exactly one `won`/`origin` entry and nine `waited`/`hit` entries.
> 3. Assert `script.sha` is a 40-char lowercase hex string; call `ScriptManagerService.load('acquireLock')` twice and assert both return the identical SHA1 (stability).
> 4. Run the test target + `typecheck` + `lint`. If anything fails, fix the corresponding earlier task (P10-1..P10-4) and return here.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions. **NO Swagger.** English-only comments.
> - Do NOT weaken the assertion to "≤ 1 fetch" — it MUST be exactly 1 (and exactly 9 hits) for `concurrency = 10`.
> - Do NOT mock Redis away if prior phases use a real/ephemeral instance — the single-flight behaviour is the thing under test; match the repo's integration-test pattern.
> - Do NOT skip hooks or lower any threshold.
>   Verification:
> - `pnpm --filter @nest-cache-example/api test` (or the e2e target) — expected: exit 0, the stampede assertions green.
> - `pnpm --filter @nest-cache-example/api typecheck` — expected: exit 0.
> - `pnpm --filter @nest-cache-example/api lint` — expected: exit 0.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P10-5 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

When this task is 🟢, Phase 10 is 5/5 — switch the Phase 10 row in `DEVELOPMENT_PLAN.md` Progress Summary to 🟢 Done.

⚠️ Never mark done with failing verification.

---

## Completion log

_(Agents append one line per finished task, newest at the bottom.)_
