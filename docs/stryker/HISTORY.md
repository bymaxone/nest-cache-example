# Stryker — Run History

Append-only. Newest run on top. One row per `pnpm mutation` (or incremental) run.

See [BASELINE.md](./BASELINE.md) for the pre-hardening snapshot and
[DEVELOPMENT_PLAN Appendix C](../DEVELOPMENT_PLAN.md#appendix-c--quality-gates) for threshold rationale.

| Date       | Workspace | Score   | Killed | Survived | Timeout | Ignored | Note                                                                                                                |
| ---------- | --------- | ------- | ------ | -------- | ------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| 2026-06-19 | apps/web  | 91.61%  | 2008   | 184      | 2       | 219     | final green run — `lib/**` 100% (0 survivors), `components/**` 89.88%; break:90 met (P18-6 complete)                |
| 2026-06-19 | apps/web  | 85.78%  | 1880   | 312      | 2       | 219     | `components/**` hardening round 1 (66% → 82.84%); break:90 not yet met                                              |
| 2026-06-19 | apps/web  | 71.80%  | 1574   | 619      | 2       | 219     | `lib/**` hardened to **100%** (0 survivors); `components/**` 65.97% — break:90 pending the component hardening pass |
| 2026-06-19 | apps/api  | 100.00% | 582    | 0        | 14      | 15      | final green run — P18-5 hardening complete (break: 100)                                                             |
| 2026-06-19 | apps/api  | 83.71%  | 500    | 100      | 14      | 0       | baseline (pre-hardening)                                                                                            |
| 2026-06-19 | apps/web  | 71.32%  | 1572   | 633      | 2       | 219     | baseline (pre-hardening; static mutants ignored)                                                                    |

## Final mutation scores by group (2026-06-19)

`T/O` (timeout) counts as a kill. `Ign` = mutants excluded from the denominator — the api's documented proven-equivalents (`{ infer: true }`, colon-less-port defaults) and the web's `ignoreStatic` static initializers.

### apps/api — 100.00% (0 survivors; every feature group at 100%)

| Group             | Score       |  Killed |  Surv |    T/O |    Ign |
| ----------------- | ----------- | ------: | ----: | -----: | -----: |
| `admin`           | 100.00%     |     177 |     0 |     13 |      1 |
| `cache`           | 100.00%     |      84 |     0 |      0 |      6 |
| `errors-demo`     | 100.00%     |      52 |     0 |      0 |      4 |
| `stampede`        | 100.00%     |      49 |     0 |      1 |      0 |
| `catalog`         | 100.00%     |      37 |     0 |      0 |      0 |
| `config`          | 100.00%     |      28 |     0 |      0 |      0 |
| `serializer-demo` | 100.00%     |      25 |     0 |      0 |      0 |
| `tenants`         | 100.00%     |      25 |     0 |      0 |      0 |
| `pubsub`          | 100.00%     |      24 |     0 |      0 |      0 |
| `ttl-events`      | 100.00%     |      22 |     0 |      0 |      4 |
| `metrics`         | 100.00%     |      22 |     0 |      0 |      0 |
| `counters`        | 100.00%     |      10 |     0 |      0 |      0 |
| `events`          | 100.00%     |       9 |     0 |      0 |      0 |
| `common`          | 100.00%     |       8 |     0 |      0 |      0 |
| `collections`     | 100.00%     |       8 |     0 |      0 |      0 |
| `health`          | 100.00%     |       2 |     0 |      0 |      0 |
| **TOTAL**         | **100.00%** | **582** | **0** | **14** | **15** |

### apps/web — 91.61% overall (`lib/**` 100%, `components/**` 89.88%)

| Group                   | Score       |   Killed |    Surv |     Ign |
| ----------------------- | ----------- | -------: | ------: | ------: |
| `lib`                   | **100.00%** |      375 |       0 |     100 |
| `components/playground` | **100.00%** |      162 |       0 |       0 |
| `components/tenants`    | 96.12%      |       98 |       4 |       0 |
| `components/overview`   | 95.80%      |      137 |       6 |       0 |
| `components/labs`       | 95.09%      |      213 |      11 |      13 |
| `components/layout`     | 94.59%      |       35 |       2 |       6 |
| `components/realtime`   | 93.78%      |      422 |      28 |      23 |
| `components/explorer`   | 89.84%      |      327 |      37 |      18 |
| `components/controls`   | 83.33%      |       75 |      15 |       4 |
| `components/charts`     | 66.94%      |      164 |      81 |      55 |
| **TOTAL**               | **91.61%**  | **2008** | **184** | **219** |

The web survivors concentrate in `components/charts` (66.94%, 81 survivors) — un-observable Recharts internals (data arrays, margins, `isAnimationActive`) that jsdom never lays out; this is the documented `components/**` floor (`break: 90`, full UI mutation is over-engineering). Every other area is ≥ 89.84%, and `lib/**` (pure logic) is at 100%.
