# Stryker — Baseline (pre-hardening)

First mutation measurement, recorded from the initial full `mutation` run of each
workspace **before** any test hardening. Source config: `apps/api/stryker.config.json`,
`apps/web/stryker.config.json`.

See [Phase 18 tasks](../tasks/phase-18-mutation-stryker.md) and
[DEVELOPMENT_PLAN Appendix C](../DEVELOPMENT_PLAN.md#appendix-c--quality-gates).

> CompileError mutants (type-invalid mutations the `typescript-checker` rejects on the
> api) and `ignoreStatic` mutants on the web are excluded from the score denominator —
> the mutation score is `(killed + timeout) / (killed + timeout + survived)`.

---

## apps/api — 2026-06-19 (pre-hardening)

| Metric          | Value               |
| --------------- | ------------------- |
| Mutation score  | 83.71%              |
| Killed          | 500                 |
| Survived        | 100                 |
| Timeout         | 14                  |
| Compile-error   | 428 (type-invalid)  |
| No coverage     | 0                   |
| Break threshold | 100                 |
| Exit code       | 1 (below threshold) |

### Survivors by file (pre-hardening)

| File                                         | Survived | Mutator(s)                                                                                               |
| -------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `admin/admin.controller.ts`                  | 20       | StringLiteral, ObjectLiteral, ArrayDeclaration                                                           |
| `errors-demo/errors-demo.service.ts`         | 13       | ArrowFunction, ObjectLiteral, BooleanLiteral                                                             |
| `cache/cache.config.ts`                      | 12       | ObjectLiteral, BooleanLiteral, MethodExpression, StringLiteral, ConditionalExpression                    |
| `admin/admin.service.ts`                     | 10       | EqualityOperator, ConditionalExpression, UnaryOperator, UpdateOperator, ArrayDeclaration, BlockStatement |
| `collections/collections.controller.ts`      | 8        | ObjectLiteral, MethodExpression                                                                          |
| `stampede/stampede.service.ts`               | 6        | ArithmeticOperator, ArrayDeclaration, ConditionalExpression                                              |
| `config/env.schema.ts`                       | 6        | StringLiteral, MethodExpression                                                                          |
| `pubsub/pubsub.bridge.service.ts`            | 5        | StringLiteral, BooleanLiteral                                                                            |
| `ttl-events/ttl-events.service.ts`           | 5        | ObjectLiteral, BooleanLiteral, StringLiteral                                                             |
| `serializer-demo/serializer-demo.service.ts` | 5        | StringLiteral                                                                                            |
| `health/health.controller.ts`                | 2        | ArithmeticOperator                                                                                       |
| `counters/counters.controller.ts`            | 2        | ObjectLiteral, MethodExpression                                                                          |
| `tenants/tenants.service.ts`                 | 2        | StringLiteral                                                                                            |
| `cache/cache.events.ts`                      | 1        | StringLiteral                                                                                            |
| `metrics/metrics.service.ts`                 | 1        | MethodExpression                                                                                         |
| `cache/msgpack.serializer.ts`                | 1        | Regex                                                                                                    |
| `admin/info.parser.ts`                       | 1        | MethodExpression                                                                                         |

The hardening pass (P18-5) added behaviour assertions to kill all 100 survivors except
15 proven-equivalent mutants (12 `{ infer: true }` compile-time-only typing hints, 2
colon-less-port destructuring defaults, and the `pipeline.exec() ?? []` fallback), each
documented in [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md#equivalent-mutants-documented-accepted).

---

## apps/web — 2026-06-19 (pre-hardening)

| Metric           | Value               |
| ---------------- | ------------------- |
| Mutation score   | 71.32%              |
| Killed           | 1572                |
| Survived         | 633                 |
| Timeout          | 2                   |
| Runtime-error    | 4                   |
| Ignored (static) | 219                 |
| Break threshold  | 90                  |
| Exit code        | 1 (below threshold) |

Split by area: `lib/**` 96.39% (14 survivors), `components/**` 65.97% (619 survivors).
The web bar is `break: 90` overall with `lib/**` driven to 100 by the hardening pass
(P18-6); `components/**` is floored at 90 (full UI mutation is over-engineering — the
established sibling decision). `hooks/**` is intentionally out of the `mutate` scope.
