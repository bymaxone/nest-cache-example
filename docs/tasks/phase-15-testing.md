# Phase 15 — Testing — E2E smoke + Web smoke — Tasks

> **Source:** [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#phase-15--testing--e2e-smoke--web-smoke) §Phase 15
> **Total tasks:** 6
> **Progress:** 🟢 6 / 6 done (100%)
>
> **Status legend:** 🔴 Not Started · 🟡 In Progress · 🔵 In Review · 🟢 Done · ⚪ Blocked

## Task index

| ID    | Task                                                                     | Status | Priority | Size | Depends on   |
| ----- | ------------------------------------------------------------------------ | ------ | -------- | ---- | ------------ |
| P15-1 | `apps/api` test toolchain — Jest + `@nestjs/testing` + Testcontainers    | 🟢     | High     | M    | P4–P14       |
| P15-2 | E2E specs (real Redis) — read-through + TTL, namespace, sync `forRoot`   | 🟢     | High     | M    | P15-1        |
| P15-3 | E2E specs (real Redis) — Pub/Sub fan-out, Lua single-flight, error paths | 🟢     | High     | M    | P15-1        |
| P15-4 | Fast specs with `ioredis-mock` (round-trips + serializer comparison)     | 🟢     | Medium   | S    | P15-1        |
| P15-5 | `apps/web` — Vitest unit (`cache-status` + shared subpath) + Playwright  | 🟢     | Medium   | M    | P15-1        |
| P15-6 | CI wiring stub + phase verification gate                                 | 🟢     | Medium   | S    | P15-1..P15-5 |

> **Phase rule — read before any task.** This repo is an **example app, not the library**: it is **NOT coverage/mutation-gated**. **Do NOT add Stryker** and **do NOT set a 100% `coverageThreshold`** (those gates belong to `@bymax-one/nest-cache`; see `DEVELOPMENT_PLAN.md` Appendix C + spec NG4 / §22). The bar here is a **focused, high-signal E2E smoke against a genuine Redis** (Testcontainers `redis:7-alpine`) that **doubles as integration coverage for the published library** + a web build/Playwright smoke. Hard constraints, every task:
>
> - **Testcontainers needs a running Docker daemon** — every real-Redis spec boots a fresh `redis:7-alpine` container in `beforeAll`. If `e2e` can't reach Docker it must fail loudly, never silently pass.
> - The **keyspace-notification E2E (the TTL-expiry path)** requires the test Redis to enable **`notify-keyspace-events Ex`** — pass it as a container start arg (`--notify-keyspace-events Ex`); a default `redis:7-alpine` does **not** fire `__keyevent@0__:expired`.
> - **Import the library as the real published package** — `@bymax-one/nest-cache` (server) and `@bymax-one/nest-cache/shared` (zero-dep) — **never** from source/`dist` paths. The E2E suite must exercise the package the example actually consumes.
> - **Pin a Vitest major** (`vitest@^3`) in `apps/web`; do not float.
> - These specs **demonstrate matrix row #2** (sync `BymaxCacheModule.forRoot`) and provide **cross-cutting verification of all 50 matrix rows**.
> - English-only; `pnpm` 10.8+ / Node ≥24; ESM throughout (Jest under `--experimental-vm-modules`); no `@ts-ignore`, no `eslint-disable`, no `--no-verify`, no lowered threshold.

---

## P15-1 — `apps/api` test toolchain (Jest + `@nestjs/testing` + Testcontainers)

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** M (90–180 min)
- **Depends on:** `P4–P14`

### Description

Stand up the `apps/api` E2E test toolchain that every later spec builds on: **Jest `^30` + `@nestjs/testing`**, **`@testcontainers/redis`** (a `redis:7-alpine` container started with **`--notify-keyspace-events Ex`** so the TTL-expiry path can be exercised), and an ESM-aware Jest config run under **`node --experimental-vm-modules`**. The library is consumed as the **real package** (`@bymax-one/nest-cache`), never from source — so the suite is honest integration coverage for the published artifact. This task delivers no assertions of its own beyond a single boot-smoke; the headline flows land in P15-2/P15-3. **This is the example-app bar:** no Stryker, no 100% `coverageThreshold` (Appendix C).

### Acceptance Criteria

- [x] `apps/api` devDependencies add `jest@^30`, `ts-jest@^29` (or `@swc/jest`), `@types/jest`, `@nestjs/testing`, `@testcontainers/redis`, `ioredis-mock`, `@types/ioredis-mock` (for P15-4).
- [x] `apps/api/jest-e2e.config.mjs` (or `.json`) exists: ESM preset, `testMatch` `**/*.e2e-spec.ts`, `rootDir` `test`, `testTimeout >= 60000` (container boot), `extensionsToTreatAsEsm: ['.ts']`.
- [x] `apps/api` `package.json` `test:e2e` script runs Jest under `node --experimental-vm-modules` (e.g. `NODE_OPTIONS=--experimental-vm-modules jest --config jest-e2e.config.mjs`).
- [x] A shared `apps/api/test/helpers/redis-container.ts` starts a `redis:7-alpine` `RedisContainer` with `.withCommand(['redis-server', '--notify-keyspace-events', 'Ex'])` (or `.withStartupTimeout`) and returns `{ container, url }`; a matching teardown stops it.
- [x] A trivial `apps/api/test/smoke.e2e-spec.ts` boots the container + a Nest `Test.createTestingModule`, asserts `ping()` succeeds, then tears both down — proving Docker + the toolchain end to end.
- [x] `pnpm --filter @nest-cache-example/api test:e2e` runs the smoke spec green **with Docker running**; with Docker unreachable it **fails clearly** (no silent skip).
- [x] **No `coverageThreshold`** in the Jest config; **no `@stryker*` / `stryker.conf.*`** anywhere.

### Files to create / modify

- `apps/api/jest-e2e.config.mjs` — ESM E2E Jest config.
- `apps/api/test/helpers/redis-container.ts` — Testcontainers `redis:7-alpine` (+ `--notify-keyspace-events Ex`) helper.
- `apps/api/test/helpers/test-app.ts` — `Test.createTestingModule` factory that points the env/config at the container `url`.
- `apps/api/test/smoke.e2e-spec.ts` — boot + `ping` smoke.
- `apps/api/package.json` — `test:e2e` script + test devDependencies.

### Agent Execution Prompt

> Role: Senior TypeScript / NestJS engineer wiring an E2E test harness.
> Context: Repo `nest-cache-example` is the reference app for `@bymax-one/nest-cache` (see `docs/TECHNICAL_SPECIFICATION.md` §22 Testing Strategy + §6 Repository Layout, `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions + Appendix C Quality Gates). This is task P15-1 — the toolchain every later E2E spec depends on. `apps/api` is a NestJS 11 + ESM app wiring `BymaxCacheModule.forRootAsync`; it already has a `test:e2e` no-op via the root `pnpm -r --if-present` fan-out (Phase 0). The library is installed as a real package (`@bymax-one/nest-cache` via local `file:` link until published).
> Objective: Install + configure Jest 30 + `@nestjs/testing` + Testcontainers (`redis:7-alpine` with keyspace notifications enabled), and prove it with a single boot-smoke spec. Add `ioredis-mock` now for the fast specs in P15-4.
> Steps:
>
> 1. From `apps/api`, install devDependencies:
>    `pnpm --filter @nest-cache-example/api add -D jest@^30 ts-jest@^29 @types/jest @nestjs/testing @testcontainers/redis ioredis-mock @types/ioredis-mock`.
>    (If `ts-jest`'s ESM mode is troublesome, `@swc/jest` is an acceptable substitute — keep the transform ESM-correct.)
> 2. Create `apps/api/jest-e2e.config.mjs`:
>    ```js
>    /** @type {import('jest').Config} */
>    export default {
>      rootDir: 'test',
>      testMatch: ['**/*.e2e-spec.ts'],
>      testEnvironment: 'node',
>      testTimeout: 60_000, // container boot
>      extensionsToTreatAsEsm: ['.ts'],
>      transform: {
>        '^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: '<rootDir>/../tsconfig.json' }],
>      },
>      moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
>      // NO coverageThreshold — this is an example app, not the library (Appendix C).
>    }
>    ```
> 3. Add the `test:e2e` script to `apps/api/package.json`:
>    ```jsonc
>    "test:e2e": "NODE_OPTIONS=--experimental-vm-modules jest --config jest-e2e.config.mjs --runInBand"
>    ```
>    (`--runInBand`: one container at a time keeps Docker usage predictable.)
> 4. Create `apps/api/test/helpers/redis-container.ts`:
>
>    ```ts
>    import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis'
>
>    /** Boots redis:7-alpine WITH keyspace notifications (Ex) so TTL-expiry events fire. */
>    export async function startRedis(): Promise<StartedRedisContainer> {
>      return new RedisContainer('redis:7-alpine')
>        .withCommand(['redis-server', '--notify-keyspace-events', 'Ex'])
>        .start()
>    }
>    ```
>
> 5. Create `apps/api/test/helpers/test-app.ts` — a `Test.createTestingModule` factory that imports the real `AppModule`, overriding only the cache connection/env so it points at the started container's `getConnectionUrl()` (host+port). Return the compiled `INestApplication` (or the testing module + `CacheService`).
> 6. Create `apps/api/test/smoke.e2e-spec.ts`: in `beforeAll` start the container + build the app; assert `await cache.ping()` resolves (latency ≥ 0) and `await cache.isHealthy()` is `true`; in `afterAll` close the app then stop the container.
> 7. Run `pnpm --filter @nest-cache-example/api test:e2e` with Docker running — the smoke must pass.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 + Appendix C. This repo is **NOT coverage/mutation-gated**: do **NOT** add `@stryker-mutator/*`, a `stryker.conf.*`, or any `coverageThreshold`. The bar is a real E2E smoke that doubles as integration coverage for the library.
> - Import the library via `@bymax-one/nest-cache` (and `@bymax-one/nest-cache/shared` where needed) — **never** from `../../../nest-cache/src` or any `dist` path.
> - Testcontainers requires a Docker daemon. If unreachable, the run must **fail** (a clear error), never silently pass; do not stub the container away.
> - ESM only: keep `NODE_OPTIONS=--experimental-vm-modules`; do not switch the package to CommonJS.
>   Verification:
> - `pnpm --filter @nest-cache-example/api test:e2e` — expected: the smoke spec passes (1 passed) with Docker up.
> - `grep -RIl "coverageThreshold\|stryker" apps/api` — expected: no matches.
> - `node -e "require('@testcontainers/redis')"` — expected: resolves (dependency installed).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P15-1 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

If phase reaches 100%, switch its row status in `DEVELOPMENT_PLAN.md` to 🟢.

⚠️ Never mark done with failing verification.

---

## P15-2 — E2E specs (real Redis): read-through + TTL, namespace isolation, sync `forRoot`

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** M (90–180 min)
- **Depends on:** `P15-1`

### Description

The first real-Redis E2E batch against the Testcontainers `redis:7-alpine`: the **read-through + TTL** flow (miss → origin → set with TTL → hit → expire → re-populate), **namespace isolation + `flushNamespace`** (only `cache-example:*` is cleared; a foreign-namespace key survives), and — the **matrix row #2** deliverable — the **synchronous `BymaxCacheModule.forRoot(...)` registration path** stood up in a dedicated test module (the app itself uses `forRootAsync`; this proves the sync overload too). The TTL-expiry assertion relies on the container's `--notify-keyspace-events Ex` (from P15-1).

### Acceptance Criteria

- [x] `apps/api/test/read-through.e2e-spec.ts`: a cold read misses, fetches origin, `set`s with a short TTL, and a second read **hits**; after the TTL elapses the key is gone (`get` → `null`) and a re-read re-populates.
- [x] The TTL path asserts the **keyspace-notification expiry** is observed (the `cache:expired` bridge / raw subscriber fires for the namespaced key) — requires `notify-keyspace-events Ex`.
- [x] `apps/api/test/namespace.e2e-spec.ts`: seeds keys under `cache-example:*` **and** a foreign key via `getClient()` (raw, un-namespaced); `flushNamespace()` removes only the `cache-example:*` keys and the foreign key **survives**.
- [x] `apps/api/test/forroot-sync.e2e-spec.ts`: builds a `Test.createTestingModule` importing **`BymaxCacheModule.forRoot({ connection, namespace, ... })`** (sync overload) pointed at the container, and asserts a `set`/`get` round-trips through the namespace — **explicitly covering matrix row #2**.
- [x] Each spec boots + tears down its container via the P15-1 helper; specs are independent (no shared mutable Redis state across files).
- [x] `pnpm --filter @nest-cache-example/api test:e2e` runs all three green with Docker up.

### Files to create / modify

- `apps/api/test/read-through.e2e-spec.ts` — miss→origin→hit→expire→re-populate (+ expiry event).
- `apps/api/test/namespace.e2e-spec.ts` — `flushNamespace` isolation vs a foreign-ns key.
- `apps/api/test/forroot-sync.e2e-spec.ts` — sync `forRoot` registration (matrix #2).

### Agent Execution Prompt

> Role: Senior TypeScript / NestJS engineer writing real-Redis E2E specs.
> Context: Task P15-2 of `docs/DEVELOPMENT_PLAN.md` §Phase 15 (see spec §22 + the [§7 Feature Coverage Matrix](../TECHNICAL_SPECIFICATION.md#7--feature-coverage-matrix), row #2). The P15-1 helper (`test/helpers/redis-container.ts`) boots `redis:7-alpine` with `--notify-keyspace-events Ex`. The app's primary wiring is `forRootAsync`; this task additionally exercises the **sync `forRoot`** overload. Cache key model is `{namespace}:{prefix}:{id}` with `namespace = cache-example`. `flushNamespace` runs SCAN + UNLINK scoped to the namespace prefix (spec §12.3, DASHBOARD §8).
> Objective: Author three E2E specs against the real container — read-through+TTL (incl. expiry event), namespace isolation + `flushNamespace`, and sync `forRoot` registration (matrix #2).
> Steps:
>
> 1. `read-through.e2e-spec.ts`: boot container + app. (a) `get('product','1')` → miss; call the catalog read-through (origin fetch) → `set` with `ttl: 2`; (b) immediate re-read → **hit** (same value, no second origin call — assert via a spy/counter on the origin); (c) wait for expiry: subscribe to the `cache:expired` feed (the raw keyspace subscriber, spec §17.3) and assert it emits for `cache-example:product:1`; then `get` → `null`; (d) re-read re-populates. Keep TTLs short (1–2s) and await the event rather than blind-sleeping where possible.
> 2. `namespace.e2e-spec.ts`: seed several `cache-example:*` keys via the library; write `other-app:demo` via `cache.getClient().set(...)` (raw, un-namespaced — the documented anti-pattern, label it in a comment). Call `cache.flushNamespace()`. Assert: every `cache-example:*` key is gone (`scan` yields none) and `getClient().get('other-app:demo')` still returns the value (**foreign ns survives**).
> 3. `forroot-sync.e2e-spec.ts`: build a testing module with the **sync** overload —
>    ```ts
>    BymaxCacheModule.forRoot({
>      connection: { url: container.getConnectionUrl() },
>      namespace: 'cache-example',
>      // serializer / events as the app configures them
>    })
>    ```
>    Resolve `CacheService`, `set('product','sync',{...})`, `get('product','sync')` → deep-equals; assert the stored key is namespaced (`getClient().get('cache-example:product:sync')` is non-null). Add a comment: `// Feature-Coverage-Matrix row #2 — sync forRoot registration path`.
> 4. Run the suite with Docker up.
>    Constraints:
>
> - Follow §2 + Appendix C. Import everything from `@bymax-one/nest-cache` / `@bymax-one/nest-cache/shared` — **never** source/`dist`.
> - The TTL-expiry assertion **depends on `notify-keyspace-events Ex`** (already set by the P15-1 helper); do not weaken it to a pure client-side timer if the event path is what's under test.
> - Do **not** add a `coverageThreshold` or Stryker; this is example-app smoke, not library mutation testing.
> - Each spec owns its container lifecycle (`beforeAll`/`afterAll`); no cross-file Redis state.
>   Verification:
> - `pnpm --filter @nest-cache-example/api test:e2e -- read-through.e2e-spec.ts namespace.e2e-spec.ts forroot-sync.e2e-spec.ts` — expected: all pass with Docker up.
> - `grep -n "forRoot(" apps/api/test/forroot-sync.e2e-spec.ts` — expected: matches the sync overload (matrix #2).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P15-2 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P15-3 — E2E specs (real Redis): Pub/Sub fan-out, Lua single-flight, each `CacheException`

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** M (90–180 min)
- **Depends on:** `P15-1`

### Description

The second real-Redis E2E batch: **Pub/Sub fan-out** (publish once; every subscriber — exact + pattern — receives it; ref-counted `Unsubscribe` keeps delivery alive after one of two unsubscribes; double-unsubscribe is safe), the **Lua single-flight stampede** (`ScriptManagerService` + `eval`: N concurrent requests for an uncached key collapse to **1 origin fetch + N−1 cache hits**), and a parametrized sweep over **each `CacheException` path** (every one of the 15 `CACHE_ERROR_CODES` surfaces its code + HTTP status + structured `{ error: { code, message, details } }` body). All against the Testcontainers `redis:7-alpine`.

### Acceptance Criteria

- [x] `apps/api/test/pubsub.e2e-spec.ts`: a `publish(channel, payload)` is received by an exact `subscribe` **and** a matching `psubscribe`; subscribing twice then unsubscribing once still delivers (ref-count), and a second/`double` unsubscribe is a safe no-op; channels are namespaced (`cache-example:...`).
- [x] `apps/api/test/stampede.e2e-spec.ts`: fires N (≥10) concurrent reads of one uncached id; asserts the origin was hit **exactly once** and the other **N−1** were cache hits (the Lua lock won by one caller via `eval` → `1`, losers see `0` then read-through).
- [x] The stampede spec resolves the registered script's SHA via `ScriptManagerService.load(...)` and asserts the `EVALSHA`/`NOSCRIPT`-reload path works against the real server.
- [x] `apps/api/test/errors.e2e-spec.ts`: a `it.each` over all **15** `CACHE_ERROR_CODES` triggers each path and asserts the thrown `CacheException` carries the matching `CacheErrorCode`, the canonical message, and the expected HTTP status (4xx/5xx/504) via the exception filter.
- [x] All specs boot/tear down their container; `pnpm --filter @nest-cache-example/api test:e2e` runs them green with Docker up.

### Files to create / modify

- `apps/api/test/pubsub.e2e-spec.ts` — fan-out + ref-counted unsubscribe.
- `apps/api/test/stampede.e2e-spec.ts` — Lua single-flight (1 fetch + N−1 hits).
- `apps/api/test/errors.e2e-spec.ts` — each of the 15 `CacheException` paths.

### Agent Execution Prompt

> Role: Senior TypeScript / NestJS engineer writing real-Redis E2E specs.
> Context: Task P15-3 of `docs/DEVELOPMENT_PLAN.md` §Phase 15 (spec §22; Pub/Sub spec §17, Lua/stampede spec §18 + DASHBOARD §11, errors spec §13 / DASHBOARD §13). `PubSubService` namespaces channels and returns a ref-counted `Unsubscribe`; `ScriptManagerService` registers Lua via `IScriptDefinition` and runs them through `CacheService.eval` (with `EVALSHA`→`NOSCRIPT`→reload). `CACHE_ERROR_CODES` / `CacheErrorCode` / `CacheException` come from `@bymax-one/nest-cache/shared`; there are **15** codes. The P15-1 helper provides the real `redis:7-alpine` container.
> Objective: Author three E2E specs — Pub/Sub fan-out + ref-counting, the Lua single-flight collapse, and a per-code `CacheException` sweep.
> Steps:
>
> 1. `pubsub.e2e-spec.ts`: boot container + app. Register an exact `subscribe('product-events', h1)` and a pattern `psubscribe('product:*', h2)`; `publish('product-events', payload)` (and a `product:42` message) and assert both handlers fire with the decoded payload. Then `subscribe('x', h)` twice → `unsubscribe()` once → publish → still delivered; call the second `unsubscribe()` and a redundant third → no throw. Assert the wire key is `cache-example:product-events` via `getClient()` patterns or a captured channel. Use awaited promises/`once`, not blind sleeps.
> 2. `stampede.e2e-spec.ts`: pick an uncached id; wrap the origin with a counter/spy. Fire `Promise.all` of N≥10 concurrent read-throughs guarded by the single-flight lock (`ScriptManagerService.load('acquireLock')` → `cache.eval(...)`). Assert `originCalls === 1` and that N−1 results came from cache (hit flag / value identity). Also assert `ScriptManagerService.load(...)` returns a stable SHA1 and a forced `NOSCRIPT` reload still succeeds.
> 3. `errors.e2e-spec.ts`: import `CACHE_ERROR_CODES` from `@bymax-one/nest-cache/shared`. `it.each(CACHE_ERROR_CODES)('surfaces %s', ...)`: trigger each path (call the matching service/route or the `/errors/:code` trigger), catch the `CacheException`, and assert `err.code` equals the code, `err.message` matches `CACHE_ERROR_MESSAGES[code]`, and the HTTP status maps per severity (4xx amber / 5xx red / 504). Assert the array length is **15** so a new library code can't silently slip past.
> 4. Run the suite with Docker up.
>    Constraints:
>
> - Follow §2 + Appendix C. Import from `@bymax-one/nest-cache` / `@bymax-one/nest-cache/shared` only — never source/`dist`.
> - The Lua body is declared in code (`IScriptDefinition`); never build it from request input (spec §18, §24).
> - No `coverageThreshold`, no Stryker — example-app smoke only.
> - Drive `CACHE_ERROR_CODES` from the library constant (don't hard-code 15 string literals) so the sweep tracks the package.
>   Verification:
> - `pnpm --filter @nest-cache-example/api test:e2e -- pubsub.e2e-spec.ts stampede.e2e-spec.ts errors.e2e-spec.ts` — expected: all pass with Docker up.
> - `grep -n "CACHE_ERROR_CODES" apps/api/test/errors.e2e-spec.ts` — expected: imported from `@bymax-one/nest-cache/shared` and iterated.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P15-3 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P15-4 — Fast specs with `ioredis-mock` (round-trips + serializer comparison)

- **Status:** 🟢 Done
- **Priority:** Medium
- **Size:** S (30–90 min)
- **Depends on:** `P15-1`

### Description

The fast lane: pure-in-memory specs that need **no real server**, using **`ioredis-mock`** for sub-second feedback (spec §22 "API E2E (fast)"). Cover the **data-structure round-trips** (string/numeric/hash/set/batch through `CacheService`) and the **serializer comparison** (JSON vs MessagePack: `setRaw`/`getRaw` raw bytes vs `get` decoded value, including the JSON `Date → ISO string` caveat). These are deliberately _not_ Testcontainers-backed — they exercise library data shaping, not Redis server semantics.

### Acceptance Criteria

- [x] `apps/api/test/data-structures.spec.ts` (or `.e2e-spec.ts` matched by the same config) backs `CacheService` with `ioredis-mock` and round-trips: `set/get/setNx/exists`, `incr/decr`, `hset/hgetall/hdel`, `sadd/smembers/scard`, and `mget/mset`.
- [x] `apps/api/test/serializer.spec.ts`: stores the same object via the default `JsonSerializer` and the custom `MsgPackSerializer`; asserts `getRaw` (raw bytes/string) differs while `get` (decoded) deep-equals the input shape, and documents that `Date`/`Map`/`Set`/`BigInt` do **not** survive JSON (`SerializableValue` caveat, spec §16).
- [x] These specs run **without Docker** (no Testcontainers import) and are clearly the fast tier.
- [x] The specs pass under the same `test:e2e` invocation (or a `test` script if separated), with `ioredis-mock` injected in place of the real client.

### Files to create / modify

- `apps/api/test/data-structures.spec.ts` — `ioredis-mock` round-trips for every data-structure group.
- `apps/api/test/serializer.spec.ts` — JSON vs MsgPack raw-vs-decoded comparison.

### Agent Execution Prompt

> Role: Senior TypeScript / NestJS engineer writing fast unit-ish specs.
> Context: Task P15-4 of `docs/DEVELOPMENT_PLAN.md` §Phase 15 (spec §22 "API E2E (fast) — `ioredis-mock` where real Redis isn't needed: data-structure round-trips, serializer comparison"; §16 serialization, NG4). `ioredis-mock` is a drop-in `ioredis` replacement that runs in-process — perfect where Redis _server_ behaviour (keyspace events, Lua reload, real TTL expiry) is **not** under test. The data-structure groups and the serializer surface come from `@bymax-one/nest-cache`; `MsgPackSerializer` is the example's custom codec (Phase 7).
> Objective: Author two fast, Docker-free specs — data-structure round-trips and the JSON-vs-MessagePack serializer comparison — backed by `ioredis-mock`.
> Steps:
>
> 1. `data-structures.spec.ts`: construct a `CacheService` whose underlying client is `new (require('ioredis-mock'))()` (or the ESM import), wired with `namespace: 'cache-example'`. Round-trip each group and assert typed results: strings (`set`/`get`/`setNx` returns false on existing/`exists`), numerics (`incr` → 1 → `incrBy 5` → 6 → `decr` → 5), hashes (`hset`/`hgetall`/`hdel`), sets (`sadd`/`smembers`/`scard`; note set members are raw strings — the serializer is intentionally not applied), batch (`mset` then `mget` returns `[null, {...}, {...}]`).
> 2. `serializer.spec.ts`: define `{ id: 42, when: new Date(...), tags: ['a','b'] }`. With `JsonSerializer`: `setRaw`/`get` → `getRaw` is a JSON string; `get` decodes but `when` is now a **string** (assert + comment the caveat). With `MsgPackSerializer`: `getRaw` differs (smaller/binary); `get` preserves the structure. Assert the `SerializableValue` caveat for `Date`/`Map`/`Set`/`BigInt` under JSON.
> 3. Run the specs — they must pass quickly without Docker.
>    Constraints:
>
> - Follow §2 + Appendix C. Import the library + serializer types from `@bymax-one/nest-cache` (and `/shared` for `SerializableValue`) — never source/`dist`.
> - Do **not** boot Testcontainers here; the whole point is the fast, server-free tier. Do **not** add a `coverageThreshold` or Stryker.
> - If `ioredis-mock` lacks a command the spec needs (e.g. exotic Lua), move that assertion to the real-Redis tier (P15-2/P15-3) rather than faking it.
>   Verification:
> - `pnpm --filter @nest-cache-example/api test:e2e -- data-structures.spec.ts serializer.spec.ts` — expected: pass, **without Docker running**.
> - `grep -RIL "testcontainers" apps/api/test/data-structures.spec.ts apps/api/test/serializer.spec.ts` — expected: both listed (no Testcontainers import).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P15-4 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P15-5 — `apps/web`: Vitest unit + Playwright smoke

- **Status:** 🟢 Done
- **Priority:** Medium
- **Size:** M (90–180 min)
- **Depends on:** `P15-1`

### Description

The frontend bar (spec §22 "Web smoke" + "Web unit"; Appendix C `web-smoke`). **Vitest `^3`** unit tests cover the **`lib/cache-status.ts`** mapping (`CacheConnectionStatus` / hit-miss / data-type → `{ color, icon, label }`, the accessible color+icon+text contract, DASHBOARD §18) and prove the **`@bymax-one/nest-cache/shared` subpath import resolves in a browser/jsdom context** (the zero-dep subpath is in the browser bundle — **matrix row #48**). A small **Playwright** smoke verifies the running app: the shell loads, the status badge is green, an Explorer scan renders rows, and a Pub/Sub publish round-trips.

### Acceptance Criteria

- [x] `apps/web` devDependencies add **`vitest@^3`**, `@vitejs/plugin-react`, `jsdom` (or `happy-dom`), `@testing-library/react`, `@testing-library/jest-dom`, `@playwright/test`.
- [x] `apps/web/vitest.config.ts`: `environment: 'jsdom'`, React plugin, `globals: true`; **no `coverage.thresholds`** set to 100 (no coverage gate).
- [x] `apps/web` `package.json` adds `test` (Vitest) and `test:e2e` (Playwright) scripts; `test:e2e` is what the root `pnpm -r test:e2e` fan-out picks up for web.
- [x] `apps/web/lib/cache-status.test.ts`: asserts the full status/severity table (`ready`→green, `reconnecting`→amber, `error`→purple, `hit`→green/`miss`→amber, type chips) returns the right `{ color, icon, label }`, **and** that `import { CACHE_ERROR_CODES, type CacheConnectionStatus } from '@bymax-one/nest-cache/shared'` resolves and is usable under jsdom (**matrix #48**).
- [x] `apps/web/e2e/smoke.spec.ts` (Playwright): boots/points at the running web app (against a real API or a mocked one), asserts the **shell** renders (topbar wordmark + sidebar nav), the **status badge is green** (`ready`), an **Explorer scan** renders ≥1 key row, and a **Pub/Sub publish** round-trips (publish → the live feed shows the message).
- [x] `playwright.config.ts` exists (single chromium project is fine); the smoke passes against a running stack.

### Files to create / modify

- `apps/web/vitest.config.ts` — jsdom + React Vitest config.
- `apps/web/lib/cache-status.test.ts` — mapping unit + shared-subpath browser-resolution (matrix #48).
- `apps/web/playwright.config.ts` — Playwright config.
- `apps/web/e2e/smoke.spec.ts` — shell + green badge + explorer scan + publish round-trip.
- `apps/web/package.json` — `test` + `test:e2e` scripts + test devDependencies.

### Agent Execution Prompt

> Role: Senior frontend engineer (Next.js 16 / React 19) writing web tests.
> Context: Task P15-5 of `docs/DEVELOPMENT_PLAN.md` §Phase 15 (spec §22; `lib/cache-status.ts` + the status/severity table in [`DASHBOARD.md` §18](../DASHBOARD.md#19--frontend-tech-stack--design-system); the **shared subpath in the browser bundle** = matrix row #48, spec §8.2). `apps/web` is a Next.js 16 + React 19 + Tailwind v4 app; it imports types/constants from `@bymax-one/nest-cache/shared` (the zero-dep subpath) in client code. `cache-status.ts` maps `CacheConnectionStatus`/hit-miss/data-type to an accessible `{ color, icon, label }` (color **+** icon **+** text, never color alone).
> Objective: Add Vitest `^3` unit tests (the mapping + a jsdom-resolved shared-subpath import) and a Playwright smoke (shell, green badge, explorer scan, publish round-trip).
> Steps:
>
> 1. Install: `pnpm --filter @nest-cache-example/web add -D vitest@^3 @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @playwright/test` then `pnpm --filter @nest-cache-example/web exec playwright install chromium`.
> 2. `apps/web/vitest.config.ts`:
>    ```ts
>    import { defineConfig } from 'vitest/config'
>    import react from '@vitejs/plugin-react'
>    export default defineConfig({
>      plugins: [react()],
>      test: {
>        environment: 'jsdom',
>        globals: true,
>        include: ['lib/**/*.test.ts', 'lib/**/*.test.tsx'],
>      },
>      // NO coverage thresholds — example-app bar (Appendix C).
>    })
>    ```
>    Add scripts to `apps/web/package.json`: `"test": "vitest run"`, `"test:e2e": "playwright test"`.
> 3. `apps/web/lib/cache-status.test.ts`: import the mapping fn(s) from `./cache-status` and assert each row of the §18 table (`ready`→green icon `check/plug`, `connecting`→blue, `reconnecting`→amber, `closed`/`end`→red, `error`→purple; `hit`→green, `miss`→amber; `string`→blue, `hash`→purple, `set`→green) returns `{ color, icon, label }` with a non-empty text label and an icon (proving color-isn't-alone). **In the same file**, add a test that does `import { CACHE_ERROR_CODES, type CacheConnectionStatus } from '@bymax-one/nest-cache/shared'` and asserts `CACHE_ERROR_CODES` is a non-empty array usable under jsdom — comment it `// Feature-Coverage-Matrix row #48 — /shared resolves in the browser bundle`.
> 4. `apps/web/playwright.config.ts`: a single `chromium` project; `webServer` optional (can point `baseURL` at an already-running `pnpm dev`/`next start` + the API). `apps/web/e2e/smoke.spec.ts`: navigate to `/`; assert the topbar wordmark `nest-cache-example` + the grouped sidebar render; assert the connection status badge shows `ready` (green); go to `/explorer`, trigger a Scan, assert ≥1 key row appears (seed via the API first if needed); go to `/pubsub`, publish a message and assert it appears in the live feed.
> 5. Run `pnpm --filter @nest-cache-example/web test` (always) and the Playwright smoke (against a running stack).
>    Constraints:
>
> - Follow §2 + Appendix C. **Pin `vitest@^3`** (do not float). Import shared types via `@bymax-one/nest-cache/shared` — never source/`dist`; the point of the #48 test is that the **published** subpath resolves in a browser context.
> - Do **NOT** add a 100% `coverage.thresholds` and do **NOT** add Stryker — `apps/web` is held to a build + happy-path smoke, not coverage.
> - Keep the Playwright smoke a _smoke_ (the four assertions above), not an exhaustive UI suite; do not flake on real-time timing (await the feed item).
>   Verification:
> - `pnpm --filter @nest-cache-example/web test` — expected: Vitest passes (mapping + the #48 shared-subpath import resolves under jsdom).
> - `pnpm --filter @nest-cache-example/web test:e2e` — expected: the Playwright smoke passes against a running stack.
> - `grep -n "nest-cache/shared" apps/web/lib/cache-status.test.ts` — expected: matches (matrix #48 covered).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P15-5 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P15-6 — CI wiring stub + phase verification gate

- **Status:** 🟢 Done
- **Priority:** Medium
- **Size:** S (30–90 min)
- **Depends on:** `P15-1`, `P15-2`, `P15-3`, `P15-4`, `P15-5`

### Description

Wire a CI stub with the four jobs this phase proves — **`lint` + `typecheck` + `test:e2e` + `web build`** (full CI incl. the export-usage check is Phase 19) — and close the phase by running the Definition-of-Done gate: `pnpm test:e2e` green against a real Redis (Testcontainers), the web smoke green, and `pnpm --filter web build` green. The CI `e2e` job must provision a Docker daemon (GitHub-hosted runners have one) so Testcontainers can boot `redis:7-alpine`; this repo carries **no** Stryker job and **no** coverage gate (Appendix C).

### Acceptance Criteria

- [x] `.github/workflows/ci.yml` exists with jobs: **`lint`** (`pnpm lint`), **`typecheck`** (`pnpm typecheck`), **`e2e`** (`pnpm test:e2e` — Testcontainers, Docker available on the runner), **`web-build`** (`pnpm --filter @nest-cache-example/web build`).
- [x] Every job uses `pnpm/action-setup@v4` + `actions/setup-node@v5` (`node-version: '24'`, `cache: pnpm`) and `pnpm install --frozen-lockfile`.
- [x] The workflow contains **no `stryker` / mutation job** and **no `coverageThreshold` enforcement** (matches Appendix C — example-app bar).
- [x] Phase DoD verified locally: `pnpm test:e2e` passes against a real Redis container, the web smoke passes, and `pnpm --filter @nest-cache-example/web build` exits 0.
- [x] `pnpm lint` and `pnpm typecheck` exit 0 across the workspace with the new test files present.

### Files to create / modify

- `.github/workflows/ci.yml` — `lint` + `typecheck` + `e2e` + `web-build` jobs (stub; export-usage job is Phase 19).
- _(verification only otherwise — fix earlier P15 task files if a check fails)_

### Agent Execution Prompt

> Role: Senior DevOps / TypeScript engineer wiring CI + closing the phase.
> Context: Task P15-6 of `docs/DEVELOPMENT_PLAN.md` §Phase 15. Definition of done: `pnpm test:e2e` passes against a real Redis container; the web smoke passes; `pnpm --filter web build` is green (spec §22, Appendix C). §2 mandates `pnpm/action-setup@v4` + setup-node `node-version: '24'` + `cache: pnpm` + `--frozen-lockfile`. The `audit:exports` / `export-usage-check` job is **Phase 19** — out of scope here. GitHub-hosted runners include a Docker daemon, so Testcontainers works in the `e2e` job without extra services.
> Objective: Add the CI stub (4 jobs) and run the phase DoD gate.
> Steps:
>
> 1. Create `.github/workflows/ci.yml` triggered on `push` + `pull_request`. Define four jobs, each: checkout → `pnpm/action-setup@v4` → `actions/setup-node@v5` (`node-version: '24'`, `cache: pnpm`) → `pnpm install --frozen-lockfile` → the job command:
>    - `lint` → `pnpm lint`
>    - `typecheck` → `pnpm typecheck`
>    - `e2e` → `pnpm test:e2e` (Testcontainers boots `redis:7-alpine` with `--notify-keyspace-events Ex` via the P15-1 helper; the runner's Docker daemon suffices — no `services:` block needed, though you may add one as a fallback note in a comment).
>    - `web-build` → `pnpm --filter @nest-cache-example/web build`.
> 2. Do **NOT** add a `stryker`/mutation job, a coverage-threshold gate, or the export-usage job (Phase 19). Add a short comment at the top of the file: `# Example-app CI bar (Appendix C): lint + typecheck + E2E smoke + web build. No mutation/coverage gate.`
> 3. Run the phase DoD locally and fix forward into the relevant P15 task file if anything fails (do not weaken a test to make it pass):
>    - `pnpm test:e2e` with Docker running.
>    - `pnpm --filter @nest-cache-example/web test:e2e` (Playwright smoke) against a running stack.
>    - `pnpm --filter @nest-cache-example/web build`.
>    - `pnpm lint` and `pnpm typecheck`.
>      Constraints:
>
> - Follow §2 + Appendix C. **No Stryker, no 100% `coverageThreshold`** anywhere in CI or config — the example-app bar is lint + typecheck + E2E smoke + web build.
> - Do not skip hooks or use `--no-verify`; do not lower any threshold to go green.
> - Keep the workflow a faithful stub of Phase 19's full CI (same setup steps) so Phase 19 only adds the export-usage job + release polish.
>   Verification:
> - `pnpm test:e2e` — expected: exit 0 against a real Redis container (Docker up).
> - `pnpm --filter @nest-cache-example/web build` — expected: exit 0.
> - `pnpm lint && pnpm typecheck` — expected: both exit 0.
> - `grep -RIn "stryker\|coverageThreshold" .github apps` — expected: no matches.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P15-6 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

When this task is 🟢, Phase 15 is 6/6 — switch the Phase 15 row in `DEVELOPMENT_PLAN.md` Progress Summary to 🟢 Done.

⚠️ Never mark done with failing verification.

---

## Completion log

_(Agents append one line per finished task, newest at the bottom.)_

- P15-1 ✅ 2026-06-18 — Jest 30 + @nestjs/testing + Testcontainers (redis:7-alpine, --notify-keyspace-events Ex) ESM toolchain + boot smoke.
- P15-2 ✅ 2026-06-18 — Real-Redis E2E: read-through + TTL keyspace expiry, namespace isolation/flushNamespace, sync forRoot (matrix #2).
- P15-3 ✅ 2026-06-18 — Real-Redis E2E: Pub/Sub fan-out + ref-counted unsubscribe, Lua single-flight collapse, all 15 CacheException paths.
- P15-4 ✅ 2026-06-18 — Fast ioredis-mock specs: data-structure round-trips + JSON-vs-MessagePack serializer comparison (no Docker).
- P15-5 ✅ 2026-06-18 — Web Vitest unit (cache-status mapping + /shared browser resolution, matrix #48) + Playwright stack smoke.
- P15-6 ✅ 2026-06-18 — CI stub (lint/typecheck/e2e/web-build) + phase DoD gate green.
