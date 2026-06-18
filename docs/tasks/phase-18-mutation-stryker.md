# Phase 18 — Mutation Testing (Stryker, near-100%) — Tasks

> **Source:** [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#phase-18--mutation-testing-stryker-near-100) §Phase 18
> **Total tasks:** 6
> **Progress:** 🔴 0 / 6 done (0%)
>
> **Status legend:** 🔴 Not Started · 🟡 In Progress · 🔵 In Review · 🟢 Done · ⚪ Blocked

## Task index

| ID    | Task                                                                               | Status | Priority | Size | Depends on          |
| ----- | ---------------------------------------------------------------------------------- | ------ | -------- | ---- | ------------------- |
| P18-1 | `apps/api` Stryker — `jest.stryker.config.cjs` + `stryker.config.json` (break:100) | 🔴     | High     | M    | P16, P17            |
| P18-2 | `apps/web` Stryker — `stryker.config.json` (vitest-runner, break:90)               | 🔴     | High     | M    | P16                 |
| P18-3 | Mutation scripts + ignores (`.stryker-tmp`/`reports`)                              | 🔴     | High     | S    | P18-1, P18-2        |
| P18-4 | Mutation docs — `docs/stryker/` BASELINE + HISTORY + IMPLEMENTATION_PLAN           | 🔴     | Medium   | S    | P18-1, P18-2        |
| P18-5 | `apps/api` hardening → `break: 100` (zero survivors)                               | 🔴     | High     | L    | P18-1, P18-3, P18-4 |
| P18-6 | `apps/web` hardening → `break: 90` + phase verification gate                       | 🔴     | High     | L    | P18-2, P18-3, P18-4 |

> **Phase rule — read before any task.** Mutation testing is the **last** test layer; it runs only once Phase 16 (100% coverage) and Phase 17 (full E2E) are green. Targets: **api `break: 100`** (zero surviving mutants), **web `break: 90`** (lib held to 100, components floored at 90). Hard constraints:
>
> - **Kill survivors with real assertions** on observable behavior, file-by-file off the HTML report — never by lowering a threshold, never by removing a mutated file from `mutate`, never with `@ts-ignore`/`eslint-disable`.
> - **The only sanctioned exception is a proven-equivalent mutant** (no input distinguishes it). Each gets a `// Stryker disable next-line <Mutator> -- <reason>` in source **and** a row in the `docs/stryker/IMPLEMENTATION_PLAN.md` equivalent-mutants table. Do not blanket-disable.
> - **api** uses the jest-runner + `typescript-checker` (type-invalid mutants are free kills) and does **not** set `ignoreStatic` (static mutants must be killed by asserting the values). **web** uses the vitest-runner with `ignoreStatic: true`. The Stryker runner config excludes `*.e2e-spec.ts` (supertest is flaky under Stryker) — only unit specs drive mutation.
> - `coverageAnalysis: perTest`, `incremental: true`. JSON config (not `.ts`/`.mjs`) to avoid ESM-loader friction. English-only; timeless comments.

---

## P18-1 — `apps/api` Stryker (`jest.stryker.config.cjs` + `stryker.config.json`, break:100)

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** M (90–180 min)
- **Depends on:** `P16`, `P17`

### Description

Configure Stryker for `apps/api`: a dedicated `jest.stryker.config.cjs` (the unit config minus the coverage gate, **unit specs only** — e2e excluded), and `stryker.config.json` using the jest-runner + `typescript-checker`, `coverageAnalysis: perTest`, the `mutate` globs, and `thresholds { high:100, low:100, break:100 }`. Smoke it with `--dryRunOnly`.

### Acceptance Criteria

- [ ] `apps/api` devDeps add `@stryker-mutator/core`, `@stryker-mutator/jest-runner`, `@stryker-mutator/typescript-checker`.
- [ ] `apps/api/jest.stryker.config.cjs`: mirrors `jest.config.cjs` transform/mapper but `collectCoverage: false`, `testMatch: ['<rootDir>/src/**/*.spec.ts']`, `modulePathIgnorePatterns: ['dist','.stryker-tmp']`.
- [ ] `apps/api/stryker.config.json`: `testRunner: 'jest'` → `{ projectType:'custom', configFile:'jest.stryker.config.cjs' }`, `testRunnerNodeArgs: ['--experimental-vm-modules']`, `checkers:['typescript']` + `tsconfigFile` + `disableTypeChecks: 'src/**/*.ts'`, `coverageAnalysis:'perTest'`, `mutate` = `src/**/*.ts` minus `*.spec.ts`/`*.module.ts`/`main.ts`/`*.dto.ts`/`*.d.ts`/`*.types.ts`/`**/index.ts`, `thresholds {high:100,low:100,break:100}`, `incremental:true`, reporters incl. html/json under `reports/mutation/api.*`, `tempDirName:'.stryker-tmp'`. `ignoreStatic` NOT set.
- [ ] `pnpm --filter api exec stryker run --dryRunOnly` completes without a config error.

### Files to create / modify

- `apps/api/jest.stryker.config.cjs`, `apps/api/stryker.config.json`, `apps/api/package.json` (devDeps).

### Agent Execution Prompt

> Role: Senior test engineer configuring Stryker for a NestJS service.
> Context: Task P18-1 of `docs/DEVELOPMENT_PLAN.md` §Phase 18. Reference `nest-logger-example/apps/api/stryker.config.json` + `jest.stryker.config.cjs`. JSON config avoids ESM-loader friction; `--experimental-vm-modules` is required for the jest ESM runner; the typescript-checker kills type-invalid mutants for free; `ignoreStatic` stays OFF (break:100 needs static mutants killed by assertions).
> Objective: the runner + config, dry-run clean.
> Steps: install deps; create `jest.stryker.config.cjs` (coverage off, unit specs only); create `stryker.config.json` per criteria; dry-run.
> Constraints: do NOT copy the library's `break:95`/`ignoreStatic:true`; do NOT add `*.e2e-spec.ts` to mutate or the runner; keep it JSON.
> Verification: `node -e "JSON.parse(require('fs').readFileSync('apps/api/stryker.config.json','utf8'))"` parses; `pnpm --filter api exec stryker run --dryRunOnly` completes.

### Completion Protocol

1. ✅ Status → 🟢. 2. ✅ Tick criteria. 3. ✅ Index row. 4. ✅ Progress. 5. ✅ Plan row. 6. ✅ Overall (/129). 7. ✅ `- P18-1 ✅ YYYY-MM-DD — …` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P18-2 — `apps/web` Stryker (`stryker.config.json`, vitest-runner, break:90)

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** M (90–180 min)
- **Depends on:** `P16`

### Description

Configure Stryker for `apps/web` with the vitest-runner: `coverageAnalysis: perTest`, `ignoreStatic: true`, `mutate` = `lib/**/*.ts` + `components/**/*.tsx` minus tests/`components/ui/**`/`*.d.ts`, `thresholds { high:100, low:95, break:90 }` (lib hardened to 100 in P18-6; components floored at 90). Smoke with `--dryRunOnly`.

### Acceptance Criteria

- [ ] `apps/web` devDeps add `@stryker-mutator/core`, `@stryker-mutator/vitest-runner`.
- [ ] `apps/web/stryker.config.json`: `testRunner:'vitest'`, `coverageAnalysis:'perTest'`, `ignoreStatic:true`, `mutate` per above, `thresholds {high:100,low:95,break:90}`, `incremental:true`, html/json reporters under `reports/mutation/web.*`, `tempDirName:'.stryker-tmp'`.
- [ ] `pnpm --filter web exec stryker run --dryRunOnly` completes without a config error.

### Files to create / modify

- `apps/web/stryker.config.json`, `apps/web/package.json` (devDeps).

### Agent Execution Prompt

> Role: Senior frontend test engineer configuring Stryker (vitest-runner).
> Context: Task P18-2 of §Phase 18. Reference `nest-logger-example/apps/web/stryker.config.json`. No typescript-checker on web (CI typecheck already gates types; keeps the runner lean). `ignoreStatic:true` keeps static initializers out of scope. `components/ui/**` (vendored) excluded.
> Objective: the web Stryker config, dry-run clean.
> Steps: install deps; create `stryker.config.json` per criteria; dry-run.
> Constraints: keep JSON; do not mutate vendored UI or tests.
> Verification: `pnpm --filter web exec stryker run --dryRunOnly` completes.

### Completion Protocol

1. ✅ Status → 🟢. 2. ✅ Tick criteria. 3. ✅ Index row. 4. ✅ Progress. 5. ✅ Plan row. 6. ✅ Overall (/129). 7. ✅ `- P18-2 ✅ YYYY-MM-DD — …` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P18-3 — Mutation scripts + ignores

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** S (30–90 min)
- **Depends on:** `P18-1`, `P18-2`

### Description

Wire the `mutation` / `mutation:incremental` / `mutation:dry-run` scripts per app + a root fan-out, and ensure `.stryker-tmp/` and `reports/` are git-ignored, ESLint-ignored, and Prettier-ignored (they must not pollute lint/format/commit).

### Acceptance Criteria

- [ ] `apps/api/package.json` + `apps/web/package.json` add `mutation`, `mutation:incremental`, `mutation:dry-run` (api scripts carry `NODE_OPTIONS=--experimental-vm-modules`).
- [ ] Root `package.json` adds `mutation` (+ per-app) fan-out.
- [ ] `.gitignore`, `eslint.config.mjs` ignores, and `.prettierignore` all exclude `.stryker-tmp/` and `reports/`.
- [ ] `pnpm lint`, `pnpm format:check` stay clean after a dry-run produced those dirs.

### Files to create / modify

- `apps/api/package.json`, `apps/web/package.json`, `package.json`, `.gitignore`, `eslint.config.mjs`, `.prettierignore`.

### Agent Execution Prompt

> Role: Senior engineer wiring mutation scripts + ignores.
> Context: Task P18-3 of §Phase 18.
> Objective: scripts + ignores so mutation runs cleanly and leaves no lint/format/commit residue.
> Steps: add the scripts; add the ignore entries; run a dry-run then `pnpm lint`/`format:check` to confirm clean.
> Constraints: no `--no-verify`; the artifacts are ignored, not committed.
> Verification: `pnpm lint && pnpm format:check` clean after `pnpm --filter api exec stryker run --dryRunOnly`.

### Completion Protocol

1. ✅ Status → 🟢. 2. ✅ Tick criteria. 3. ✅ Index row. 4. ✅ Progress. 5. ✅ Plan row. 6. ✅ Overall (/129). 7. ✅ `- P18-3 ✅ YYYY-MM-DD — …` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P18-4 — Mutation docs (`docs/stryker/` BASELINE + HISTORY + IMPLEMENTATION_PLAN)

- **Status:** 🔴 Not Started
- **Priority:** Medium
- **Size:** S (30–90 min)
- **Depends on:** `P18-1`, `P18-2`

### Description

Create the `docs/stryker/` companion docs the siblings use: `BASELINE.md` (the first full-run scores per app + a survivor inventory), `HISTORY.md` (append-only run log, newest on top, columns Date · Workspace · Score · Killed · Survived · Timeout · No-cov · Note), and `IMPLEMENTATION_PLAN.md` (per-app hardening order, stack gotchas, and the equivalent-mutants table: file:line · mutator · why-equivalent).

### Acceptance Criteria

- [ ] `docs/stryker/BASELINE.md`, `docs/stryker/HISTORY.md`, `docs/stryker/IMPLEMENTATION_PLAN.md` exist with the section skeletons above.
- [ ] BASELINE records the first `mutation` run scores for api + web (run `--incremental` off once).
- [ ] IMPLEMENTATION_PLAN has the equivalent-mutants table header ready for P18-5/P18-6 to fill.

### Files to create / modify

- `docs/stryker/BASELINE.md`, `docs/stryker/HISTORY.md`, `docs/stryker/IMPLEMENTATION_PLAN.md`.

### Agent Execution Prompt

> Role: Senior engineer documenting the mutation effort.
> Context: Task P18-4 of §Phase 18. Mirror `nest-logger-example/docs/stryker/`.
> Objective: the three docs seeded with the first baseline.
> Steps: run one full `mutation` per app; record scores in BASELINE + HISTORY; lay out the IMPLEMENTATION_PLAN hardening order + the equivalent-mutants table.
> Constraints: factual numbers from a real run; timeless prose.
> Verification: the three files exist and BASELINE cites real scores.

### Completion Protocol

1. ✅ Status → 🟢. 2. ✅ Tick criteria. 3. ✅ Index row. 4. ✅ Progress. 5. ✅ Plan row. 6. ✅ Overall (/129). 7. ✅ `- P18-4 ✅ YYYY-MM-DD — …` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P18-5 — `apps/api` hardening → `break: 100` (zero survivors)

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** L (3–6 h)
- **Depends on:** `P18-1`, `P18-3`, `P18-4`

### Description

Harden the api unit suite until Stryker reports **0 surviving mutants** (`break: 100`). Work file-by-file off the HTML report: add real assertions for unasserted exception `details`, boundary operators, optional-chaining guards, regex anchors, idempotency (spy `toHaveBeenCalledTimes`), and static `const`/`Symbol` values. Refactor any file-scope `Module.forRoot(...)` that creates attribution gaps to bootstrap in `beforeAll`. Document each proven-equivalent mutant inline + in the IMPLEMENTATION_PLAN table.

### Acceptance Criteria

- [ ] `pnpm --filter api mutation` passes at `break: 100` (0 survivors; type-invalid mutants killed by the checker; coverage stays 100% under the unit gate).
- [ ] Every `// Stryker disable` line is a proven-equivalent mutant with a matching IMPLEMENTATION_PLAN row.
- [ ] HISTORY.md updated with the final api score.
- [ ] No threshold lowered, no file removed from `mutate` to pass.

### Files to create / modify

- `apps/api/src/**/*.spec.ts` (strengthened assertions), occasional source simplifications, `docs/stryker/IMPLEMENTATION_PLAN.md` + `HISTORY.md`.

### Agent Execution Prompt

> Role: Senior engineer hardening tests to kill mutants.
> Context: Task P18-5 of §Phase 18. The dominant survivor classes (from the lib's own experience): unasserted `CacheException` `details` (kill with `toMatchObject`/`toEqual` on the structured body), `<` vs `<=` boundaries (assert AT the limit), `?.` guards (feed the undefined), regex anchors (mixed/edge inputs), idempotency (spy call counts), and static exports (assert the value).
> Objective: api at break:100.
> Steps: run `mutation`; open the HTML report; per surviving mutant add a behavior assertion or prove equivalence + document it; re-run incrementally until 0 survive.
> Constraints: real assertions only; no threshold change; no `mutate` exclusion to hide a survivor; equivalents documented both inline + in the table.
> Verification: `pnpm --filter api mutation` — break:100, 0 survivors.

### Completion Protocol

1. ✅ Status → 🟢. 2. ✅ Tick criteria. 3. ✅ Index row. 4. ✅ Progress. 5. ✅ Plan row. 6. ✅ Overall (/129). 7. ✅ `- P18-5 ✅ YYYY-MM-DD — …` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P18-6 — `apps/web` hardening → `break: 90` + phase verification gate

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** L (3–6 h)
- **Depends on:** `P18-2`, `P18-3`, `P18-4`

### Description

Harden the web unit suite until Stryker passes at **`break: 90`** with **`lib/**`at 100**, then close the phase: both apps'`mutation`green, HISTORY updated, scripts wired in CI (non-blocking or gated per the team's choice), and a final report. Kill`lib/**`survivors to 100; push`components/**` over 90 with behavior assertions; document equivalents.

### Acceptance Criteria

- [ ] `pnpm --filter web mutation` passes at `break: 90`; `lib/**` shows 100% mutation score.
- [ ] Every web `// Stryker disable` is a documented proven-equivalent.
- [ ] HISTORY.md updated with the final web score; IMPLEMENTATION_PLAN equivalent-mutants table complete for both apps.
- [ ] Root `pnpm mutation` runs both apps green; `pnpm lint`/`typecheck`/`format:check` clean.

### Files to create / modify

- `apps/web/{lib,components}/**/*.test.ts(x)` (strengthened), `docs/stryker/HISTORY.md` + `IMPLEMENTATION_PLAN.md`, `.github/workflows/ci.yml` (mutation job, optional gate).

### Agent Execution Prompt

> Role: Senior frontend engineer hardening web mutation + closing the phase.
> Context: Task P18-6 of §Phase 18. `lib/**` is pure logic → drive to 100; `components/**` floored at 90 (full UI mutation is over-engineering, per the sibling decision). `ignoreStatic:true` keeps static initializers out of scope.
> Objective: web at break:90 (lib 100) + phase closed.
> Steps: harden `lib/**` to 100; lift `components/**` over 90 with behavior assertions; document equivalents; update HISTORY/IMPLEMENTATION_PLAN; wire/confirm the CI mutation job; run the full gate.
> Constraints: real assertions; no threshold lowering below the targets; equivalents documented.
> Verification: `pnpm --filter web mutation` — break:90, lib 100; `pnpm mutation` (root) — both apps green.

### Completion Protocol

1. ✅ Status → 🟢. 2. ✅ Tick criteria. 3. ✅ Index row. 4. ✅ Progress. 5. ✅ Plan row. 6. ✅ Overall (/129). 7. ✅ `- P18-6 ✅ YYYY-MM-DD — …` to **Completion log**.

When this task is 🟢, Phase 18 is 6/6 — switch the Phase 18 row in `DEVELOPMENT_PLAN.md` Progress Summary to 🟢 Done.

⚠️ Never mark done with failing verification.

---

## Completion log

_(Agents append one line per finished task, newest at the bottom.)_
