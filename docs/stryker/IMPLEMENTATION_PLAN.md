# Stryker — Implementation Plan (path to the gate)

Target: `apps/api` break 100 (zero survivors); `apps/web` `lib/**` 100, `components/**` break 90.
See [Phase 18 tasks](../tasks/phase-18-mutation-stryker.md) and
[DEVELOPMENT_PLAN Appendix C](../DEVELOPMENT_PLAN.md#appendix-c--quality-gates).

---

## Hardening order (apps/api)

Work file-by-file using the HTML report (`apps/api/reports/mutation/api.html`) sorted by "Survived" descending. The pre-hardening survivors cluster into five shapes:

1. **Controller route/example metadata** — `admin/admin.controller.ts` (20): `StringLiteral` survivors on the JSDoc-backed example payloads and route descriptions returned by the controller, plus `ObjectLiteral`/`ArrayDeclaration` on the response envelope. Assert the exact returned object with `toEqual`.
2. **Inline Zod request schemas** — `collections/collections.controller.ts` (8), `counters/counters.controller.ts` (2), `config/env.schema.ts` (6): `MethodExpression` (`.min(1)` → `.max(1)`) and `ObjectLiteral` (`{}`) survivors. Kill by feeding the pipe a value that passes the real constraint but fails the mutant (a normal multi-char string) and a value that fails the real constraint, asserting accept vs `ZodError`.
3. **Error-trigger factory map** — `errors-demo/errors-demo.service.ts` (13): `ArrowFunction` survivors (`() => undefined` replacing each throwing trigger) and the `details.simulated` `ObjectLiteral`/`BooleanLiteral`. Assert every trigger throws the expected `CacheException`/code and that the simulated flag is exactly `true`.
4. **Config + service logic** — `cache/cache.config.ts` (12), `admin/admin.service.ts` (10), `stampede/stampede.service.ts` (6), `pubsub/pubsub.bridge.service.ts` (5), `ttl-events/ttl-events.service.ts` (5), `serializer-demo/serializer-demo.service.ts` (5), `tenants/tenants.service.ts` (2), `metrics/metrics.service.ts` (1), `cache/cache.events.ts` (1): `EqualityOperator`/`ConditionalExpression`/`ArithmeticOperator`/`UpdateOperator` boundary survivors and `StringLiteral`/`BooleanLiteral`/`ObjectLiteral` value survivors. Assert AT the boundary (sampling cap, TTL `> 0`, duration math), assert idempotency with spy call counts, and assert exact channel names / emitted-event shapes.
5. **Parsers / regex** — `admin/info.parser.ts` (1, `MethodExpression`), `cache/msgpack.serializer.ts` (1, `Regex` — base64 detection), `health/health.controller.ts` (2, `ArithmeticOperator` on the latency window). Feed inputs that distinguish each branch / regex match.

Static mutants are NOT ignored on the api (`ignoreStatic` stays off — `break: 100` requires asserting static values directly).

## Hardening order (apps/web)

Work file-by-file using `apps/web/reports/mutation/web.html`:

1. **`lib/**`** (hold at 100%) — pure logic: `api-client.ts`, `cache-status.ts`, `format.ts`, `filters.ts`, `socket.ts` parsers, the typed endpoint catalogs. Assert exact outputs for every branch and edge value.
2. **`components/**`\*\* (floor 90%) — kill what is reasonable (missing null/undefined branches, equality checks, conditional rendering); accept genuinely equivalent UI-rendering mutants and document them below.

`hooks/**` is intentionally **out of the `mutate` scope** (TanStack Query / socket glue is exercised for coverage but not mutation-tested — the established sibling decision); `ignoreStatic: true` keeps static initializers out of scope on the web.

---

## Stack gotchas

- **Supertest is flaky under Stryker** — NestJS controllers, the exception filter, the validation pipe, and the WebSocket gateway are unit-tested by direct construction (or a mocked `ExecutionContext` / `ArgumentsHost`); supertest lives in the e2e suite, which `jest.stryker.config.cjs` excludes via `testMatch: ['<rootDir>/src/**/*.spec.ts']`.
- **Inline Zod schemas in controllers are mutated** — `collections`/`counters` controllers and `config/env.schema.ts` build `z.object({...})` literals. `MethodExpression` mutants flip `.min(1)` → `.max(1)`; kill them with a paired accept/reject assertion through the actual `ZodValidationPipe`, not by asserting the schema object.
- **The error-trigger map is a record of factories** — Stryker replaces each `() => { throw … }` with `() => undefined`. Assert the _thrown_ value (code + HTTP status via the filter), not just that a key exists.
- **`CacheException` `details` survivors** — assert the structured body (`{ error: { code, message, details } }`) with `toMatchObject`/`toEqual`; an unasserted `details.simulated` boolean survives.
- **Static-mutant survivors** (exported `const` maps, response-envelope object literals): kill by asserting the value directly in a `*.spec.ts`. Do NOT set `ignoreStatic: true` on the api — the bar is `break: 100`.
- **Boundary operators** (`>=`/`>`, `<`/`<=`) in the admin keyspace sampler, stampede timing, and the metrics latency window: assert exactly AT the limit so `>` vs `>=` is distinguishable.
- **Jest config uses `.cjs`** (not `.ts`) because Jest 30 needs `ts-node` to parse a TypeScript config and `ts-node` is not installed; `jest.stryker.config.cjs` follows the project pattern (`jest.config.cjs`, `jest-e2e.config.mjs`).
- **`--experimental-vm-modules`** is required for the jest ESM runner; it is passed both via `testRunnerNodeArgs` in `stryker.config.json` and `NODE_OPTIONS` in the `mutation*` scripts.
- **`concurrency: 2`** is set on both apps (below the sibling's 4): every Stryker worker reloads the locally-linked `@bymax-one/nest-cache` (`file:` dependency) into its own module graph, so a higher pool multiplies that footprint and can exhaust memory on small CI runners.

---

## Equivalent mutants (documented, accepted)

These mutants produce observably identical behavior. Each has a `// Stryker disable` comment in source with the same rationale.

| Workspace | File                                              | Mutator(s)                    | Why equivalent                                                                                                                                                                                                                     |
| --------- | ------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| apps/api  | `cache/cache.config.ts` (mode)                    | ObjectLiteral, BooleanLiteral | `config.get('CACHE_MODE', { infer: true })` — `infer` is a compile-time-only typing hint; `{}` / `{ infer: false }` return the identical runtime value (the key is always present).                                                |
| apps/api  | `cache/cache.config.ts` (serializer)              | ObjectLiteral, BooleanLiteral | Same `{ infer: true }` typing-hint equivalence on the `CACHE_SERIALIZER` lookup.                                                                                                                                                   |
| apps/api  | `cache/cache.config.ts` (addr port)               | StringLiteral                 | `const [rawHost, portText = ''] = pair.split(':')` — the `''` default is reached only for a colon-less entry; `parseInt('')` is NaN and any replacement string is NaN too, so both throw identically.                              |
| apps/api  | `cache/cache.config.ts` (natMap port)             | StringLiteral                 | Same colon-less-port default equivalence on the natMap reachable side.                                                                                                                                                             |
| apps/api  | `errors-demo/errors-demo.service.ts` (serializer) | ObjectLiteral, BooleanLiteral | `{ infer: true }` typing-hint equivalence on the `CACHE_SERIALIZER` lookup.                                                                                                                                                        |
| apps/api  | `errors-demo/errors-demo.service.ts` (mode)       | ObjectLiteral, BooleanLiteral | `{ infer: true }` typing-hint equivalence on the `CACHE_MODE` lookup.                                                                                                                                                              |
| apps/api  | `ttl-events/ttl-events.service.ts` (mode)         | ObjectLiteral, BooleanLiteral | `{ infer: true }` typing-hint equivalence on the `CACHE_MODE` lookup.                                                                                                                                                              |
| apps/api  | `ttl-events/ttl-events.service.ts` (db)           | ObjectLiteral, BooleanLiteral | `{ infer: true }` typing-hint equivalence on the `REDIS_DB` lookup.                                                                                                                                                                |
| apps/api  | `admin/admin.service.ts` (seed)                   | ArrayDeclaration              | `(results ?? []).filter(([err]) => err === null).length` — the `[]` fallback is reached only when `exec()` is null; any non-empty replacement is filtered out by the `[err] === null` destructuring, yielding the same count of 0. |

15 ignored mutants total (the `{ infer: true }` rows each cover an `ObjectLiteral` + a
`BooleanLiteral`). Every other pre-hardening survivor was killed with a real behaviour
assertion; the genuinely-redundant natMap outer trim + empty-entry guard were removed
(simplified) rather than disabled, so no killable mutant is hidden behind a disable.

---

## CI plan

- A `mutation` job on the existing CI workflow runs `pnpm --filter <changed-app> mutation:incremental` per workspace, serialized (`--workspace-concurrency=1`), caching `reports/stryker-incremental.json` keyed on each app's source.
- The api job inherits `NODE_OPTIONS='--experimental-vm-modules'` for the jest ESM runner.
- Thresholds enforce the gate: api `break: 100`, web `break: 90`.
