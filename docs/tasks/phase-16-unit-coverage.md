# Phase 16 — Unit Tests: 100% Coverage (api + web) — Tasks

> **Source:** [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#phase-16--unit-tests-100-coverage-api--web) §Phase 16
> **Total tasks:** 8
> **Progress:** 🟢 8 / 8 done (100%)
>
> **Status legend:** 🔴 Not Started · 🟡 In Progress · 🔵 In Review · 🟢 Done · ⚪ Blocked

## Task index

| ID    | Task                                                                      | Status | Priority | Size | Depends on   |
| ----- | ------------------------------------------------------------------------- | ------ | -------- | ---- | ------------ |
| P16-1 | `apps/api` unit toolchain — Jest config + `tsconfig.spec.json` + cov gate | 🟢     | High     | M    | P15          |
| P16-2 | `apps/api` unit — pure logic (config, env, parser, pipe, filter, DTOs)    | 🟢     | High     | L    | P16-1        |
| P16-3 | `apps/api` unit — feature services (catalog…errors-demo)                  | 🟢     | High     | L    | P16-1        |
| P16-4 | `apps/api` unit — realtime/IO + gateway + bootstrap → close api at 100%   | 🟢     | High     | L    | P16-2, P16-3 |
| P16-5 | `apps/web` unit toolchain — Vitest coverage (v8) + alias + setup          | 🟢     | High     | M    | P15          |
| P16-6 | `apps/web` unit — `lib/**` + `hooks/**`                                   | 🟢     | High     | L    | P16-5        |
| P16-7 | `apps/web` unit — `components/**` → close web at 100%                     | 🟢     | High     | XL   | P16-6        |
| P16-8 | Phase verification gate — `test:cov` 100/100/100/100 both apps            | 🟢     | High     | S    | P16-1..P16-7 |

> **Phase rule — read before any task.** The bar is **100% on all four metrics** (statements / branches / functions / lines) for `apps/api` (Jest) and `apps/web` (Vitest), matching the siblings `nest-logger-example` / `nest-auth-example`. Hard constraints, every task:
>
> - **No shortcuts.** No `/* istanbul ignore */`, no `@ts-ignore` / `@ts-expect-error` / `eslint-disable`, no `as any`, no `--no-verify`, no lowering a threshold, and **no exclusion added to mask a real gap**. A provably-dead defensive branch is **removed from source** (a real simplification), not ignored.
> - **`emitDecoratorMetadata` trap.** A NestJS DI class compiled with `emitDecoratorMetadata: true` emits a `__metadata("design:paramtypes", [… ? _a : Object])` ternary whose `: Object` arm is an unreachable phantom branch. The **unit** Jest project must compile via a `tsconfig.spec.json` with `emitDecoratorMetadata: false` (plus `ignoreCoverageForAllDecorators: true`); the e2e project (Phase 17) keeps metadata **on**. Unit specs construct classes **directly** (`new Service(mockA, mockB)`) — they never need `design:*` reflection.
> - **Mock the library at its tokens.** `CacheService` is injected by type, but `AdminService`/`TenantsService`/`StampedeService`/`TtlEventsService`/`SerializerDemoService` inject library providers via explicit tokens (`BYMAX_CACHE_KEY_BUILDER`, `BYMAX_CACHE_CONNECTION`, `BYMAX_CACHE_SCRIPT_REGISTRY`, `BYMAX_CACHE_SERIALIZER`) — provide those mocks.
> - **Every `it()` carries a block comment** (scenario + the rule it protects), English-only; ESM + NodeNext (Jest under `--experimental-vm-modules`).
> - **Excluded from coverage** (DI wiring / generated / data): `*.module.ts`, `main.ts`, `*.dto.ts` schemas may be unit-tested directly but DTO _files_ are excluded from the gate per the sibling convention — instead cover the schema logic; `*.d.ts`, `*.types.ts`, `**/index.ts` barrels, `apps/web/components/ui/**` (vendored shadcn), `apps/web/app/**` route shells.

---

## P16-1 — `apps/api` unit toolchain (Jest config + `tsconfig.spec.json` + coverage gate)

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** M (90–180 min)
- **Depends on:** `P15`

### Description

Stand up the **unit** Jest toolchain for `apps/api`, separate from the Phase-15 `jest-e2e.config.mjs`. Unit specs live next to source as `src/**/*.spec.ts` and are compiled through a `tsconfig.spec.json` that turns **`emitDecoratorMetadata` off** to avoid the `__metadata` phantom-branch trap, so 100% branch coverage is reachable. Add `test` / `test:cov` scripts and the 100/100/100/100 global gate. This task delivers only the harness + one trivial pure-logic spec proving the gate runs; the bulk of the specs land in P16-2..P16-4.

### Acceptance Criteria

- [x] `apps/api` devDependencies already include `jest`/`ts-jest`/`@types/jest`/`@jest/globals` (from P15); no new runtime deps needed.
- [x] `apps/api/tsconfig.spec.json` extends `./tsconfig.json` and sets `compilerOptions.emitDecoratorMetadata: false`.
- [x] `apps/api/jest.config.cjs` exists: `rootDir: 'src'`, `testRegex: '.*\\.spec\\.ts$'`, ESM (`extensionsToTreatAsEsm: ['.ts']`), `ts-jest` `{ useESM: true, tsconfig: '<rootDir>/../tsconfig.spec.json', ignoreCoverageForAllDecorators: true }`, `moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' }`, `testEnvironment: 'node'`.
- [x] `collectCoverageFrom` = `src/**/*.ts` minus `**/*.spec.ts`, `**/*.module.ts`, `main.ts`, `**/*.dto.ts`, `**/*.d.ts`, `**/*.types.ts`, `**/index.ts`; `coverageThreshold.global` = `{ branches: 100, functions: 100, lines: 100, statements: 100 }`; `coverageDirectory: '../coverage/api'`.
- [x] `apps/api/package.json` scripts: `"test": "NODE_OPTIONS=--experimental-vm-modules jest --config jest.config.cjs"`, `"test:cov": "NODE_OPTIONS=--experimental-vm-modules jest --config jest.config.cjs --coverage"`.
- [x] One smoke unit spec (e.g. `src/cache/msgpack.serializer.spec.ts`) passes and the gate runs (config wired). `.stryker-tmp`/`reports` not needed yet.
- [x] No `coverageThreshold` removed or lowered; the existing `jest-e2e.config.mjs` is untouched (it still matches `test/**`).

### Files to create / modify

- `apps/api/tsconfig.spec.json` — unit tsconfig (`emitDecoratorMetadata: false`).
- `apps/api/jest.config.cjs` — unit Jest config + 100% gate.
- `apps/api/package.json` — `test` + `test:cov` scripts.
- `apps/api/src/cache/msgpack.serializer.spec.ts` — first pure-logic unit (round-trip + malformed-base64 throw).

### Agent Execution Prompt

> Role: Senior TypeScript / NestJS test engineer wiring a unit-coverage toolchain.
> Context: Task P16-1 of `docs/DEVELOPMENT_PLAN.md` §Phase 16 (+ Appendix C). The sibling `nest-logger-example/apps/api/jest.config.cjs` + `tsconfig.spec.json` are the reference: Jest 30 needs `.cjs` configs (no `ts-node`), ESM via `--experimental-vm-modules`, and `emitDecoratorMetadata: false` in the unit tsconfig to kill the `__metadata` phantom branch (`ignoreCoverageForAllDecorators` alone does not). The Phase-15 `jest-e2e.config.mjs` (rootDir `test`) stays for E2E/fast specs; this new config is rootDir `src` and only matches `*.spec.ts` co-located with source.
> Objective: Create the unit Jest config + `tsconfig.spec.json` + scripts + one passing pure-logic spec.
> Steps:
>
> 1. Create `apps/api/tsconfig.spec.json`: `{ "extends": "./tsconfig.json", "compilerOptions": { "emitDecoratorMetadata": false } }`.
> 2. Create `apps/api/jest.config.cjs` with the settings in Acceptance Criteria (rootDir `src`, ESM, ts-jest→`tsconfig.spec.json`, `.js→.ts` mapper, `collectCoverageFrom` exclusions, `coverageThreshold.global` 100×4, `coverageDirectory: '../coverage/api'`, `clearMocks`/`restoreMocks`).
> 3. Add the `test` + `test:cov` scripts to `apps/api/package.json`.
> 4. Write `apps/api/src/cache/msgpack.serializer.spec.ts`: round-trip an object through `serialize`/`deserialize`; assert a malformed-base64 input throws. Import the lib serializer type only as `import type`.
> 5. Run `pnpm --filter api test` — the one spec passes.
>    Constraints:
>
> - Do NOT touch `jest-e2e.config.mjs`. Do NOT add `coverageThreshold` below 100. Keep `emitDecoratorMetadata` ON in `tsconfig.json`/`tsconfig.build.json` (only `tsconfig.spec.json` turns it off).
> - ESM only; `@jest/globals` import for `jest` where mocks are used.
>   Verification:
> - `pnpm --filter api test` — expected: the smoke unit passes.
> - `grep -n "emitDecoratorMetadata" apps/api/tsconfig.spec.json` — expected: `false`.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum / 129).
7. ✅ Append `- P16-1 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P16-2 — `apps/api` unit: pure logic (config, env, parser, pipe, filter, DTOs)

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** L (3–6 h)
- **Depends on:** `P16-1`

### Description

Unit-test every **pure-logic** unit in `apps/api/src` — the branch-dense, dependency-light code where coverage is cheapest and most valuable: `cache/cache.config.ts` (`buildCacheOptions` + `parseAddressList` + `parseNatMap` + sentinel/cluster builders, incl. NaN-port throws and the `__proto__` guard), `config/env.schema.ts` (`validateEnv`, defaults, the non-coerced `ALLOW_FLUSH_IN_PRODUCTION` transform, invalid-env throw), `admin/info.parser.ts` (`parseInfo`), `common/zod-validation.pipe.ts` (success + 400 branches), `common/cache-exception.filter.ts` (body shape + message fallback + `details ?? null`), `cache/msgpack.serializer.ts` (extend P16-1), `metrics/metrics.service.ts` (pure hit/miss + rate math + empty state), and **every Zod DTO schema** (each transform/refine/regex/coerce branch).

### Acceptance Criteria

- [x] Specs exist and pass for: `cache.config`, `env.schema`, `info.parser`, `zod-validation.pipe`, `cache-exception.filter`, `msgpack.serializer`, `metrics.service`.
- [x] Every DTO schema under `**/dto/*.ts` has a spec asserting at least one accept + one reject per branch (regex bounds, coerce, transforms, refines) — e.g. `tenant-params` TENANT_ID regex, `stampede-query` coerce+bounds, `error-code-param` `cache.` normalization, `products-query` split/trim/cap-50.
- [x] `cache.config` covers standalone/sentinel/cluster modes, natMap empty vs non-empty, the prototype-pollution skip, and serializer json vs msgpack selection.
- [x] `cache-exception.filter` is tested with a mocked `ArgumentsHost`/`Response` (no supertest); asserts status from `getStatus()` and the `{ error: { code, message, details } }` envelope.
- [x] These files report 100% on all four metrics in the coverage run; any dead branch found is removed from source (note it in the completion log line).

### Files to create / modify

- `apps/api/src/**/*.spec.ts` for each pure unit listed above (co-located).
- Possibly minor source simplifications where a provably-dead branch is removed (timeless, no behavior change).

### Agent Execution Prompt

> Role: Senior TypeScript engineer writing exhaustive unit tests for pure logic.
> Context: Task P16-2 of §Phase 16. Run under the P16-1 unit config. These units are dependency-light (a mocked `ConfigService` for `cache.config`; nothing for parsers/schemas). The `cache.config` branch map and the DTO list come from the project audit; reach every branch.
> Objective: 100% coverage of the pure-logic + pipe + filter + DTO surface.
> Steps:
>
> 1. For `cache.config.ts`, drive `buildCacheOptions` with a stub `config.get` returning each `CACHE_MODE`; assert the populated connection sub-block per mode, the natMap parse (valid pair, blank, NaN-port throw, `__proto__` skip), and serializer selection.
> 2. For `env.schema.ts`, assert defaults, the `ALLOW_FLUSH_IN_PRODUCTION` string-`'false'`→`false` transform, and that `validateEnv` throws a readable error on a bad var.
> 3. For `info.parser.ts`, feed a representative INFO blob (section headers, comments, blank lines, a no-colon line) and assert the nested record.
> 4. For `zod-validation.pipe.ts`, assert a valid value passes through and an invalid one throws the 400 `{ error: { code, issues } }`.
> 5. For `cache-exception.filter.ts`, construct a `CacheException`, call `catch()` with a fake host whose `getResponse().status/json` are spies; assert status + body.
> 6. For each DTO schema, table-test accept/reject per branch.
>    Constraints:
>
> - Construct classes directly; mock only what's injected. No `istanbul ignore`; remove a genuinely dead branch instead. Every `it()` has a scenario comment. Import library symbols only via `@bymax-one/nest-cache` / `/shared`.
>   Verification:
> - `pnpm --filter api test:cov` — expected: the listed files at 100% (other files may still be <100% until P16-3/P16-4).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum / 129).
7. ✅ Append `- P16-2 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P16-3 — `apps/api` unit: feature services (catalog … errors-demo)

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** L (3–6 h)
- **Depends on:** `P16-1`

### Description

Unit-test the DI-heavy **feature services** by constructing each directly with mocked library providers + collaborators: `catalog.service` (read-through, batch back-fill, idempotent `setNx` override-merge, expire/ttl/persist), `admin.service` (key listing, single-key inspect TYPE dispatch, delete/persist/expire, pipeline seed, `getKeyspaceBreakdown`, `splitNamespacedKey`), `collections.service`, `counters.service`, `tenants.service` (prefix scoping, `clearTenant`, `seedForeignNamespace`, `proveIsolation`), `serializer-demo.service`, `errors-demo.service` (the 15-entry trigger table + config branches). Plus the thin controllers (assert delegation + the few real branches: catalog 404, health degraded).

### Acceptance Criteria

- [x] Each service above has a spec constructing it with hand-mocked `CacheService` (+ `ProductOriginStore`/`MetricsService`/`ConfigService`/token mocks as needed); every method + branch covered.
- [x] `catalog.service.getProducts` covers the hit/miss/back-fill positional logic; `seedProduct` covers the override-merge precedence.
- [x] `admin.service` covers scan vs keys strategy, the inspect TYPE dispatch (`string`/`hash`/`set`/other), `getKeyspaceBreakdown` aggregation, and `splitNamespacedKey`.
- [x] `errors-demo.service` covers all 15 trigger entries (real-API mocked to throw the right `CacheException`, simulated entries, the serializer/cluster config branches, and the fail-closed `trigger()` throw).
- [x] Controllers covered: catalog (incl. `null → NotFoundException`), health (`try/catch → degraded`), and the remaining thin controllers (delegation + route metadata where a StringLiteral mutant would otherwise survive in P18).
- [x] Coverage for all of the above at 100% in the run.

### Files to create / modify

- `apps/api/src/**/*.service.spec.ts` for every feature service.
- `apps/api/src/**/*.controller.spec.ts` for controllers with real branches/metadata.

### Agent Execution Prompt

> Role: Senior NestJS engineer unit-testing DI-heavy services by direct construction.
> Context: Task P16-3 of §Phase 16. Mock the library providers (`CacheService` and the `@Inject` tokens) as minimal objects with `jest.fn()` for the methods each service touches — never boot the Nest DI container (that's Phase 17). Branch maps come from the project audit.
> Objective: 100% coverage of the feature services + controllers.
> Steps: per service, instantiate with mocks, drive each public method through every branch, assert calls + return shapes + thrown `CacheException`s. For controllers, assert they delegate and surface the right HTTP semantics (404/degraded); use the `Reflector` to assert route path/method metadata where helpful for the later mutation pass.
> Constraints: direct construction only; no DI container; no `istanbul ignore`; every `it()` commented; library imports via the package only.
> Verification: `pnpm --filter api test:cov` — the service/controller files at 100%.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum / 129).
7. ✅ Append `- P16-3 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P16-4 — `apps/api` unit: realtime/IO + gateway + bootstrap → close api at 100%

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** L (3–6 h)
- **Depends on:** `P16-2`, `P16-3`

### Description

Cover the remaining api units — the realtime/IO services and bootstrap glue — and **close `apps/api` at 100/100/100/100**: `pubsub.bridge.service` (ref-count map, `onModuleInit` default subs, `onModuleDestroy`, error-demo), `ttl-events.service` (raw subscriber wiring, namespace filter, cluster skip, error catch, `onModuleDestroy` quit, `seed`), `stampede.service` (deterministic branches via injected fakes + fake timers; the timing-heavy loop's reachable branches), `events.gateway` (3 emit methods via a fake `server`), `cache/cache.events.ts` (`onEvent` error vs log branch), `main.ts` `SocketIoAdapter.createIOServer` (CORS-options merge), the `cache.module` `useFactory`, and `library-probe.ts`/`scripts/index.ts`/`cache-keys.ts` (trivial shape asserts).

### Acceptance Criteria

- [x] Specs cover `pubsub.bridge.service`, `ttl-events.service`, `stampede.service`, `events.gateway`, `cache.events`, the `cache.module` factory, `SocketIoAdapter`, and the trivial data/probe files.
- [x] `ttl-events.service` covers the cluster-mode early return, the namespace-prefix filter (kept vs dropped), the subscriber `error` listener, and the `quit()` catch.
- [x] `pubsub.bridge.service` covers add (new vs ref-increment), remove (decrement vs last-listener unsubscribe vs unknown-channel no-op), and the throwing-handler default sub.
- [x] `stampede.service` reachable branches covered with `jest.useFakeTimers()` + injected eval/cache fakes (the winner/loser/bounded paths); no real timers.
- [x] **`pnpm --filter api test:cov` reports 100/100/100/100 globally** for `apps/api`.

### Files to create / modify

- `apps/api/src/**/*.spec.ts` for the remaining units.
- `apps/api/src/main.ts` may be lightly refactored to export `SocketIoAdapter` for isolation if needed (no behavior change).

### Agent Execution Prompt

> Role: Senior NestJS engineer closing api unit coverage to 100%.
> Context: Task P16-4 of §Phase 16. `main.ts` is excluded from coverage but `SocketIoAdapter` is worth a unit if cheaply isolable. `stampede.service` is timing-heavy — use fake timers + injected `CacheService.eval`/`get` fakes to hit winner/loser/bounded branches deterministically; do not rely on wall-clock. The gateway needs only a fake `server` with a spy `emit`.
> Objective: every remaining api file at 100%, global gate green.
> Steps: write the specs per Acceptance Criteria; run `test:cov`; for any last uncovered line, add a targeted case or remove a dead branch.
> Constraints: no DI container; fake timers for stampede; no `istanbul ignore`; commented `it()`s.
> Verification: `pnpm --filter api test:cov` — expected: `100 | 100 | 100 | 100` and exit 0.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum / 129).
7. ✅ Append `- P16-4 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P16-5 — `apps/web` unit toolchain (Vitest coverage + alias + setup)

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** M (90–180 min)
- **Depends on:** `P15`

### Description

Upgrade the Phase-15 Vitest config into a full coverage harness: widen `include` beyond `lib/`, add the **v8 coverage provider** with 100/100/100/100 thresholds, a `resolve.alias` for `@/*` (the app's path alias, used everywhere in hooks/components), a `setupFiles` wiring `@testing-library/jest-dom` matchers, and the coverage `exclude` list (`components/ui/**` vendored shadcn, `app/**` route shells, type/barrel files). Add `@vitest/coverage-v8` (matching the Vitest major) + `@testing-library/user-event` + a nuqs test adapter, and a `test:cov` script.

### Acceptance Criteria

- [x] `apps/web` devDeps add `@vitest/coverage-v8` (same major as `vitest`), `@testing-library/user-event`, and a nuqs testing adapter if needed.
- [x] `apps/web/vitest.config.ts`: `test.include` = `{app,components,lib,hooks}/**/*.{test,spec}.{ts,tsx}`; `resolve.alias` maps `@` → project root (or `vite-tsconfig-paths`); `test.setupFiles` = `['./vitest.setup.ts']`; `test.coverage` = `{ provider: 'v8', include: ['lib/**','components/**','hooks/**','app/**'], exclude: ['components/ui/**','app/**/layout.tsx','**/*.d.ts','**/index.ts','**/*.test.*'], thresholds: { branches:100, functions:100, lines:100, statements:100 } }`.
- [x] `apps/web/vitest.setup.ts` imports `@testing-library/jest-dom`.
- [x] `apps/web/package.json` adds `"test:cov": "vitest run --coverage"`.
- [x] The existing `lib/cache-status.test.ts` still passes under the new config; `pnpm --filter web test:cov` runs (will report <100% until P16-6/P16-7).

### Files to create / modify

- `apps/web/vitest.config.ts` — widened include + v8 coverage + alias.
- `apps/web/vitest.setup.ts` — jest-dom matchers.
- `apps/web/package.json` — `test:cov` + devDeps.

### Agent Execution Prompt

> Role: Senior frontend engineer wiring Vitest coverage.
> Context: Task P16-5 of §Phase 16. Reference `nest-logger-example/apps/web/vitest.config.ts`: jsdom + react plugin + v8 + `{app,components,lib,hooks}` include + `components/ui/**` excluded. The `@/*` alias is NOT yet proven under Vitest (the lone existing test uses relative imports) — add a `resolve.alias` so hook/component tests resolve `@/…`.
> Objective: the coverage harness + setup, gate at 100×4, existing test still green.
> Steps: install deps (pin coverage-v8 to the vitest major); update `vitest.config.ts` and add `vitest.setup.ts`; add `test:cov`; run it.
> Constraints: do NOT exclude real source to hit the number; `components/ui/**` (vendored) + `app/**` shells are the only sanctioned exclusions. Pin the Vitest major.
> Verification: `pnpm --filter web test:cov` — runs and reports coverage; `pnpm --filter web test` — `cache-status.test.ts` green.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum / 129).
7. ✅ Append `- P16-5 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P16-6 — `apps/web` unit: `lib/**` + `hooks/**`

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** L (3–6 h)
- **Depends on:** `P16-5`

### Description

Unit-test all of `lib/**` and `hooks/**` to 100%. The `lib/**` pure functions are the cheapest wins (`format`, `cache-status` done, `utils`, `filters`, `constants`, `socket` `RingBuffer`+parsers, `api-client` `toApiError`+path guard, `cache-api` `unwrap`/`keyListQuery`/`encodeKey`, and every `*-api` path/query builder asserted against a mocked transport). The hooks need `renderHook` + a test `QueryClientProvider`, mocked `fetch`/`socket.io-client`, fake timers, and `matchMedia`/`requestAnimationFrame` stubs — including the dense `use-metric-series` (delta math, commandstats regex, percentiles, reset/baseline) and `use-cache-socket`/`use-follow-mode`/`use-playground-op`.

### Acceptance Criteria

- [x] Every `lib/**` module (excluding barrels/types) has a `*.test.ts` at 100%.
- [x] Every `hooks/**` hook has a `*.test.ts(x)` at 100%; `flattenKeyPages` and other exported pure helpers tested directly.
- [x] `use-metric-series` covers the first-tick baseline, the cumulative-delta diff, commandstats parsing, the percentile, the sliding window, and reset-on-key.
- [x] `use-cache-socket` covers the `enabled` gate, rAF batching/flush, and teardown; `socket.io-client` is mocked.
- [x] The REST/socket boundaries are mocked (no real network); `lib/**` + `hooks/**` at 100% in the run.

### Files to create / modify

- `apps/web/lib/**/*.test.ts`, `apps/web/hooks/**/*.test.ts(x)`.

### Agent Execution Prompt

> Role: Senior React/Next engineer unit-testing logic + hooks.
> Context: Task P16-6 of §Phase 16. Mock `global.fetch` (or the `api` object) for transport; `vi.mock('socket.io-client')` with a fake `Socket` (`on`/`removeAllListeners`/`close`); `vi.useFakeTimers()` + stub `matchMedia`/`requestAnimationFrame` for timer/socket hooks. Drive hooks with `@testing-library/react` `renderHook` under a `QueryClientProvider` (+ `NuqsAdapter` where used). `cache-status.test.ts` is the comment-style template.
> Objective: 100% on `lib/**` + `hooks/**`.
> Steps: pure modules first (fast wins), then each hook with its boundary mocks; cover every branch incl. error paths via the mocked transport rejecting.
> Constraints: mock boundaries, never hit the network; no `istanbul ignore`; every `it()` commented; use the `@/` alias.
> Verification: `pnpm --filter web test:cov` — `lib/**` + `hooks/**` at 100%.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum / 129).
7. ✅ Append `- P16-6 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P16-7 — `apps/web` unit: `components/**` → close web at 100%

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** XL (1–2 days)
- **Depends on:** `P16-6`

### Description

Component-test `components/**` to **close `apps/web` at 100/100/100/100**. Start with the pure presentational components (chart verdict helpers, `StampedeTimeline`, `SerializerCompare`, `ErrorTrigger`, `CountdownWall`, `FilterRail`, `ScanStrategyToggle`, `ChartFrame`, `NamespaceChip`, `nav-items`) — props-driven, deterministic. Then the stateful/data/socket views (`StatusChip`, `ExplorerView`, `KeyTable`, `OverviewView`, the realtime/labs/tenants/playground views) with mocked hooks/Query/socket/nuqs. Recharts components render nothing at 0×0 in jsdom — mock `ResponsiveContainer` (or stub container size); `KeyTable`'s virtualizer needs `getBoundingClientRect`/`ResizeObserver` stubs. `components/ui/**` (vendored shadcn) is excluded; the two with real logic (`json-tree`, `chart`) are tested.

### Acceptance Criteria

- [x] Every `components/**` file outside `components/ui/**` has a `*.test.tsx` at 100% (statements/branches/functions/lines).
- [x] `components/ui/chart.tsx` + `components/ui/json-tree.tsx` covered; the rest of `components/ui/**` excluded from the gate.
- [x] Recharts/virtualization handled via mocks (documented in a comment), not by excluding the component.
- [x] Data/socket views are rendered with their hooks mocked (`vi.mock('@/hooks/…')`) so branch paths (loading/error/empty/data) are all hit.
- [x] **`pnpm --filter web test:cov` reports 100/100/100/100 globally** for `apps/web`.

### Files to create / modify

- `apps/web/components/**/*.test.tsx` (excluding `components/ui/**` except chart/json-tree).
- A small `apps/web/test/` helper for the recharts/`ResizeObserver`/`matchMedia` stubs if shared.

### Agent Execution Prompt

> Role: Senior React engineer reaching 100% component coverage.
> Context: Task P16-7 of §Phase 16. The project audit flags the hard ones: recharts (`ResponsiveContainer` 0×0 in jsdom), `KeyTable` (TanStack Virtual needs measurement stubs), and the big integration views (`OverviewView`, `ConnectionView`). Prefer mocking hooks (`vi.mock('@/hooks/use-metrics')` etc.) to drive branch states deterministically rather than wiring real Query+socket. `@testing-library/react` + `user-event`.
> Objective: web global coverage 100×4.
> Steps: presentational first; then mock hooks per data/socket view and assert each branch (loading/error/empty/data + interactions); add shared jsdom stubs (`ResizeObserver`, `getBoundingClientRect`, `matchMedia`, recharts `ResponsiveContainer`) in a setup helper.
> Constraints: do NOT exclude a real component to hit the number (only `components/ui/**` + route shells are sanctioned exclusions); no `istanbul ignore`; every `it()` commented; no fake/asserted classNames as a coverage crutch — assert behavior/output.
> Verification: `pnpm --filter web test:cov` — `100 | 100 | 100 | 100`, exit 0.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum / 129).
7. ✅ Append `- P16-7 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P16-8 — Phase verification gate (`test:cov` 100/100/100/100 both apps)

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** S (30–90 min)
- **Depends on:** `P16-1`, `P16-2`, `P16-3`, `P16-4`, `P16-5`, `P16-6`, `P16-7`

### Description

Close the phase: run both coverage gates, wire root `test` / `test:cov` fan-out, add a CI `test:cov` job (extending the Phase-15 workflow), and confirm the full bar — `pnpm -r test:cov` green at 100/100/100/100 for both apps, lint + typecheck + format clean with all the new specs present, zero `.skip`/`.todo`, zero ignore comments.

### Acceptance Criteria

- [x] Root `package.json` `test` and `test:cov` fan out (`pnpm -r --if-present run test` / `test:cov`).
- [x] `.github/workflows/ci.yml` gains a `test:cov` job (or extends an existing one) running both apps' coverage gate.
- [x] `pnpm --filter api test:cov` and `pnpm --filter web test:cov` both report **100/100/100/100**.
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm format:check` clean with the new specs.
- [x] No `/* istanbul ignore */`, `@ts-ignore`, `eslint-disable`, `.skip`, `.todo` introduced anywhere in the new test corpus (grep clean).

### Files to create / modify

- `package.json` — root `test` / `test:cov` scripts.
- `.github/workflows/ci.yml` — `test:cov` job.

### Agent Execution Prompt

> Role: Senior engineer closing the unit-coverage phase.
> Context: Task P16-8 of §Phase 16. The CI `e2e` job from Phase 15 needs the `file:` library provisioned (tracked separately); the `test:cov` job is Docker-free and can run once the library is installed. Mirror the sibling root scripts.
> Objective: wire the gate + CI job and prove 100×4 both apps.
> Steps: add the root scripts; add the CI job; run both coverage gates + lint/typecheck/format; grep for banned suppressions/skips.
> Constraints: do not lower a threshold or add an exclusion to pass; fix the root cause.
> Verification:
>
> - `pnpm --filter api test:cov` and `pnpm --filter web test:cov` — both `100 | 100 | 100 | 100`.
> - `grep -RInE "istanbul ignore|@ts-ignore|eslint-disable|\.skip\(|\.todo\(" apps/*/src apps/web/{components,hooks,lib}` — expected: none in new specs.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum / 129).
7. ✅ Append `- P16-8 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

When this task is 🟢, Phase 16 is 8/8 — switch the Phase 16 row in `DEVELOPMENT_PLAN.md` Progress Summary to 🟢 Done.

⚠️ Never mark done with failing verification.

---

## Completion log

_(Agents append one line per finished task, newest at the bottom.)_

- P16-1 ✅ 2026-06-19 — Unit Jest toolchain (`jest.config.cjs` + `tsconfig.spec.json` metadata-off + `test`/`test:cov` scripts) with the 100×4 gate; worker pool bounded to `'50%'`.
- P16-2 ✅ 2026-06-19 — Pure-logic specs (cache.config, env.schema, info.parser, zod pipe, exception filter, msgpack, metrics) + every DTO schema at 100%.
- P16-3 ✅ 2026-06-19 — Feature-service + controller specs (catalog, admin, collections, counters, tenants, serializer-demo, errors-demo) at 100%.
- P16-4 ✅ 2026-06-19 — Realtime/IO + gateway + bootstrap specs; `apps/api` closed at 100/100/100/100 (53 suites, 292 tests).
- P16-5 ✅ 2026-06-19 — Vitest v8 coverage harness (`vitest.config.ts` widened include + `@` alias + setup polyfills + `test:cov`), worker pool bounded to `'50%'`.
- P16-6 ✅ 2026-06-19 — `lib/**` + `hooks/**` specs at 100%.
- P16-7 ✅ 2026-06-19 — `components/**` specs (incl. the missing `components/tenants/**` trio and the `KeyTable` skeleton/virtualizer gaps); `apps/web` closed at 100/100/100/100 (73 files, 546 tests).
- P16-8 ✅ 2026-06-19 — Root `test:cov` fan-out (`--workspace-concurrency=1`) + CI `test:cov` job; both apps 100×4, lint/typecheck/format clean, zero suppressions/skips.
