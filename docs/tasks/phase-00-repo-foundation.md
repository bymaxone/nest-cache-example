# Phase 0 — Repository Foundation & Tooling — Tasks

> **Source:** [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#phase-0--repository-foundation--tooling) §Phase 0
> **Total tasks:** 8
> **Progress:** 🟢 8 / 8 done (100%)
>
> **Status legend:** 🔴 Not Started · 🟡 In Progress · 🔵 In Review · 🟢 Done · ⚪ Blocked

## Task index

| ID   | Task                                                                      | Status | Priority | Size | Depends on       |
| ---- | ------------------------------------------------------------------------- | ------ | -------- | ---- | ---------------- |
| P0-1 | Root `package.json` + `pnpm-workspace.yaml` (full script set)             | 🟢     | High     | S    | —                |
| P0-2 | Node/pnpm pinning (`.nvmrc`, `.npmrc`, `engines`)                         | 🟢     | High     | XS   | P0-1             |
| P0-3 | Root `tsconfig.base.json` (strict)                                        | 🟢     | High     | S    | P0-1             |
| P0-4 | ESLint 9 flat config (`eslint.config.mjs`)                                | 🟢     | High     | S    | P0-1, P0-3       |
| P0-5 | Prettier 3 (`.prettierrc.mjs`, `.prettierignore`)                         | 🟢     | High     | XS   | P0-1             |
| P0-6 | Husky + lint-staged + commitlint                                          | 🟢     | High     | S    | P0-1, P0-4, P0-5 |
| P0-7 | Governance + automation files (`.gitignore`, `renovate.json`, agent docs) | 🟢     | Medium   | S    | P0-1             |
| P0-8 | Verification gate (`install` + `typecheck` + `lint` + `format:check`)     | 🟢     | High     | S    | P0-1..P0-7       |

---

## P0-1 — Root `package.json` + `pnpm-workspace.yaml` (full script set)

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** S (30–90 min)
- **Depends on:** `—`

### Description

Create the workspace-root `package.json` and `pnpm-workspace.yaml` that register `apps/*`. This manifest anchors every later phase; the quality/infra scripts declared here are dispatched via `pnpm -r` / `pnpm --filter` and consumed by CI later. The full script surface is defined now (even though the targets land in later phases) so the contract is stable and nothing ever references a missing script. **Note (vs. the library + sibling examples):** this is an _example app_ — there are **no `mutation*` scripts** (no Stryker gate; see `DEVELOPMENT_PLAN.md` Appendix C).

### Acceptance Criteria

- [x] Root `package.json` exists with `"name": "nest-cache-example"`, `"private": true`, `"type": "module"`.
- [x] Declares `"packageManager": "pnpm@10.8.0"` (or the current pinned 10.x).
- [x] Scripts defined: `dev`, `build`, `typecheck`, `lint`, `format`, `format:check`, `test`, `test:e2e`, `audit:exports`, `infra:up`, `infra:down`, `infra:nuke`, `infra:logs`, `prepare`.
- [x] `pnpm-workspace.yaml` registers `apps/*` (and only `apps/*`).
- [x] `pnpm install` completes with zero errors on the empty workspace.

### Files to create / modify

- `package.json` — workspace-root manifest.
- `pnpm-workspace.yaml` — workspace globs.

### Agent Execution Prompt

> Role: Senior TypeScript / Node engineer setting up a pnpm workspace.
> Context: Repo `nest-cache-example` is the reference app for `@bymax-one/nest-cache` (see `docs/DEVELOPMENT_PLAN.md` §Phase 0 + §2 Global Conventions and `docs/TECHNICAL_SPECIFICATION.md` §6 Repository Layout). This is task P0-1. The example mirrors the proven structure of the sibling `nest-logger-example` / `nest-auth-example`.
> Objective: Produce the workspace-root `package.json` + `pnpm-workspace.yaml`.
> Steps:
>
> 1. Create `/package.json` with `"name": "nest-cache-example"`, `"private": true`, `"type": "module"`, `"packageManager": "pnpm@10.8.0"`, `"license": "MIT"`, `"author": "Bymax One"`, and a `scripts` block using `pnpm -r` fan-out:
>    ```jsonc
>    {
>      "scripts": {
>        "dev": "pnpm -r --parallel --if-present run dev",
>        "build": "pnpm -r --if-present run build",
>        "typecheck": "pnpm -r --if-present run typecheck",
>        "lint": "eslint .",
>        "format": "prettier --write .",
>        "format:check": "prettier --check .",
>        "test": "pnpm -r --if-present run test",
>        "test:e2e": "pnpm -r --if-present run test:e2e",
>        "audit:exports": "node scripts/audit-library-exports.mjs",
>        "infra:up": "docker compose up -d --wait",
>        "infra:down": "docker compose down",
>        "infra:nuke": "docker compose down -v",
>        "infra:logs": "docker compose logs -f",
>        "prepare": "husky",
>      },
>    }
>    ```
> 2. Create `/pnpm-workspace.yaml`:
>    ```yaml
>    packages:
>      - 'apps/*'
>    ```
> 3. Do NOT add runtime dependencies yet; `devDependencies` may be empty at this step (tooling is installed by P0-3..P0-6). The `audit:exports` / `infra:*` targets are created in later phases (Phase 19 / Phase 1) — `--if-present` and the standalone script path keep this safe.
> 4. Run `pnpm install` to materialize `pnpm-lock.yaml`.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions (pnpm 10.8.0, ESM-only, Node >=24 pinned in P0-2).
> - Do NOT add NestJS/Next/ioredis deps here; they belong to app packages in later phases.
> - Do NOT register `packages/*` — this repo only ships `apps/*`.
> - Do NOT add `mutation*` scripts — this is an example app, not the library (no Stryker gate).
>   Verification:
> - `pnpm install` — expected: exits 0, creates `pnpm-lock.yaml`.
> - `node -p "require('./package.json').name"` — expected: `nest-cache-example`.
> - `pnpm -v` — expected: `>=10.8.0`.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P0-1 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

If phase reaches 100%, switch its row status in `DEVELOPMENT_PLAN.md` to 🟢.

⚠️ Never mark done with failing verification.

---

## P0-2 — Node/pnpm Pinning (`.nvmrc`, `.npmrc`, `engines`)

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** XS (<30 min)
- **Depends on:** `P0-1`

### Description

Pin the Node.js major to `24` and enforce frozen-lockfile installs. `@bymax-one/nest-cache` requires Node >=24; pinning prevents silent drift on contributor machines and in CI. `.npmrc` with `frozen-lockfile=true` makes every install reproducible (matches the library + sibling examples).

### Acceptance Criteria

- [x] `.nvmrc` exists and contains exactly `24` (no trailing `.x`).
- [x] `.npmrc` exists with `frozen-lockfile=true`.
- [x] Root `package.json` has `"engines": { "node": ">=24", "pnpm": ">=10.8" }`.
- [x] `nvm use` in the repo root selects Node 24.

### Files to create / modify

- `.nvmrc` — single line `24`.
- `.npmrc` — `frozen-lockfile=true`.
- `package.json` — add `engines`.

### Agent Execution Prompt

> Role: Senior TypeScript / Node engineer.
> Context: Task P0-2 of `docs/DEVELOPMENT_PLAN.md` §Phase 0 + §2. The library requires Node >=24; CI uses `pnpm install --frozen-lockfile`.
> Objective: Pin the Node runtime + pnpm version and enforce frozen installs.
> Steps:
>
> 1. Create `/.nvmrc` with the single line `24`.
> 2. Create `/.npmrc` with:
>    ```ini
>    frozen-lockfile=true
>    ```
> 3. Edit `/package.json` — add:
>    ```json
>    "engines": { "node": ">=24", "pnpm": ">=10.8" }
>    ```
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - Do NOT set `engine-strict` in `.npmrc` (keep installs portable); the `engines` field is advisory + CI-checked.
>   Verification:
> - `cat .nvmrc` — expected: `24`.
> - `node -p "require('./package.json').engines.node"` — expected: `>=24`.
> - `grep frozen-lockfile .npmrc` — expected: `frozen-lockfile=true`.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P0-2 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P0-3 — Root `tsconfig.base.json` (strict)

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** S (30–90 min)
- **Depends on:** `P0-1`

### Description

Create the canonical TypeScript base config inherited by every app `tsconfig.json`. `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes` are mandated by §2 Global Conventions and match the library's own discipline (so example code reads like library code).

### Acceptance Criteria

- [x] `tsconfig.base.json` at repo root.
- [x] `compilerOptions` sets `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `noImplicitOverride: true`, `noImplicitReturns: true`, `noFallthroughCasesInSwitch: true`, `target: "ES2023"`, `lib: ["ES2023"]`, `module: "ESNext"`, `moduleResolution: "Bundler"`, `esModuleInterop: true`, `resolveJsonModule: true`, `skipLibCheck: true`, `forceConsistentCasingInFileNames: true`, `isolatedModules: true`, `verbatimModuleSyntax: true`.
- [x] No `include`/`exclude` (base config is pure options).
- [x] Root `package.json` adds `devDependencies: { "typescript": "^5.9.0" }`.

### Files to create / modify

- `tsconfig.base.json` — shared compiler options.
- `package.json` — add `typescript` to devDependencies.

### Agent Execution Prompt

> Role: Senior TypeScript engineer.
> Context: Task P0-3 of `docs/DEVELOPMENT_PLAN.md` §Phase 0. All apps extend this base; see §2 Global Conventions (TypeScript 5.9 strict, ESM everywhere).
> Objective: Produce `/tsconfig.base.json` with the strict settings listed.
> Steps:
>
> 1. Install TypeScript at the workspace root: `pnpm add -D -w typescript@^5.9.0`.
> 2. Create `/tsconfig.base.json`:
>    ```json
>    {
>      "compilerOptions": {
>        "target": "ES2023",
>        "module": "ESNext",
>        "moduleResolution": "Bundler",
>        "lib": ["ES2023"],
>        "esModuleInterop": true,
>        "resolveJsonModule": true,
>        "isolatedModules": true,
>        "verbatimModuleSyntax": true,
>        "skipLibCheck": true,
>        "forceConsistentCasingInFileNames": true,
>        "strict": true,
>        "noUncheckedIndexedAccess": true,
>        "exactOptionalPropertyTypes": true,
>        "noImplicitOverride": true,
>        "noImplicitReturns": true,
>        "noFallthroughCasesInSwitch": true
>      }
>    }
>    ```
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - Do NOT set `paths` aliases here; the example consumes the library as a real package via local link (Phase 2), not a path alias.
> - `apps/api` (NestJS) needs `emitDecoratorMetadata`/`experimentalDecorators` in its OWN tsconfig — do NOT add them to the base (the Next.js app must not inherit them).
>   Verification:
> - `pnpm exec tsc --showConfig -p tsconfig.base.json` — expected: emits the resolved config without error.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P0-3 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P0-4 — ESLint 9 Flat Config (`eslint.config.mjs`)

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** S (30–90 min)
- **Depends on:** `P0-1`, `P0-3`

### Description

Wire ESLint v9 flat config. `@typescript-eslint/recommended-type-checked` must be **scoped to `*.{ts,tsx,mts,cts}`** (typescript-eslint's project service rejects root `.mjs`/`.cjs` config files if applied globally — a known trap the siblings hit). Plain JS/MJS/CJS files get only `js.configs.recommended` + Node globals. Integrate Prettier compatibility, relax type-checked rules for test files, and globally ignore generated dirs.

### Acceptance Criteria

- [x] `eslint.config.mjs` at repo root using flat config.
- [x] Integrates `@eslint/js`, `typescript-eslint` (`recommendedTypeChecked`, **scoped** to TS files), `eslint-config-prettier`, `globals`.
- [x] Ignores `**/dist`, `**/.next`, `**/coverage`, `**/node_modules`, `**/*.d.ts`.
- [x] Test files (`**/*.spec.ts`, `**/*.e2e-spec.ts`, `**/test/**`) relax `@typescript-eslint/no-unsafe-*` + `no-explicit-any`.
- [x] Root `package.json` has the ESLint devDependencies; `"lint": "eslint ."` (added in P0-1).
- [x] `pnpm lint` exits 0 on the empty workspace.

### Files to create / modify

- `eslint.config.mjs` — flat config entry point.
- `package.json` — add ESLint devDependencies.

### Agent Execution Prompt

> Role: Senior TypeScript engineer.
> Context: Task P0-4 of `docs/DEVELOPMENT_PLAN.md` §Phase 0. §2 mandates ESLint 9 flat config (`recommendedTypeChecked`) + Prettier 3. The type-checked ruleset MUST be scoped to TS files or it errors on this config-only tree.
> Objective: Produce `/eslint.config.mjs` and install ESLint tooling.
> Steps:
>
> 1. Install devDependencies at the workspace root:
>    `pnpm add -D -w eslint@^9 @eslint/js typescript-eslint eslint-config-prettier globals`.
> 2. Create `/eslint.config.mjs`:
>
>    ```js
>    import js from '@eslint/js'
>    import tseslint from 'typescript-eslint'
>    import prettier from 'eslint-config-prettier'
>    import globals from 'globals'
>
>    export default tseslint.config(
>      { ignores: ['**/dist', '**/.next', '**/coverage', '**/node_modules', '**/*.d.ts'] },
>      js.configs.recommended,
>      {
>        files: ['**/*.{ts,tsx,mts,cts}'],
>        extends: [...tseslint.configs.recommendedTypeChecked],
>        languageOptions: {
>          globals: { ...globals.node },
>          parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
>        },
>      },
>      {
>        files: ['**/*.{js,mjs,cjs}'],
>        languageOptions: { globals: { ...globals.node } },
>      },
>      {
>        files: ['**/*.spec.ts', '**/*.e2e-spec.ts', '**/test/**'],
>        rules: {
>          '@typescript-eslint/no-explicit-any': 'off',
>          '@typescript-eslint/no-unsafe-assignment': 'off',
>          '@typescript-eslint/no-unsafe-member-access': 'off',
>          '@typescript-eslint/no-unsafe-call': 'off',
>        },
>      },
>      prettier,
>    )
>    ```
>
> 3. Confirm `"lint": "eslint ."` exists in root `package.json` (from P0-1).
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - Flat config only; do NOT create a legacy `.eslintrc*`.
> - Do NOT apply `recommendedTypeChecked` globally (it breaks on root `.mjs`); scope it to TS files as shown.
>   Verification:
> - `pnpm lint` — expected: exits 0 (no source files yet → clean).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P0-4 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P0-5 — Prettier 3 (`.prettierrc.mjs` + `.prettierignore`)

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** XS (<30 min)
- **Depends on:** `P0-1`

### Description

Add Prettier 3 with an ESM config and matching ignore file — the single source of formatting truth. Integrates with ESLint via `eslint-config-prettier` (installed in P0-4). Settings match §2 (`printWidth 100`, `singleQuote`, `trailingComma: all`, `semi: false`).

### Acceptance Criteria

- [x] `.prettierrc.mjs` exports a config object via `export default`.
- [x] Settings: `printWidth: 100`, `singleQuote: true`, `trailingComma: 'all'`, `semi: false`, `arrowParens: 'always'`, `endOfLine: 'lf'`.
- [x] `.prettierignore` covers `dist`, `.next`, `coverage`, `node_modules`, `pnpm-lock.yaml`.
- [x] Root `package.json` has `format` + `format:check` scripts (from P0-1).
- [x] `pnpm format:check` exits 0.

### Files to create / modify

- `.prettierrc.mjs` — config.
- `.prettierignore` — ignore list.

### Agent Execution Prompt

> Role: Senior TypeScript engineer.
> Context: Task P0-5 of `docs/DEVELOPMENT_PLAN.md` §Phase 0. §2 mandates Prettier 3 with `printWidth 100` + `singleQuote` + `semi: false` (matches the library + sibling house style).
> Objective: Install Prettier 3 and configure it repo-wide.
> Steps:
>
> 1. `pnpm add -D -w prettier@^3`.
> 2. Create `/.prettierrc.mjs`:
>    ```js
>    /** @type {import("prettier").Config} */
>    export default {
>      printWidth: 100,
>      singleQuote: true,
>      trailingComma: 'all',
>      semi: false,
>      arrowParens: 'always',
>      endOfLine: 'lf',
>    }
>    ```
> 3. Create `/.prettierignore`:
>    ```
>    dist
>    .next
>    coverage
>    node_modules
>    pnpm-lock.yaml
>    ```
> 4. Run `pnpm format` once to normalize any pre-existing `docs/*` files, then confirm `format:check` is clean.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - Confirm `format` + `format:check` already exist in root `package.json` (from P0-1); do not duplicate.
>   Verification:
> - `pnpm format:check` — expected: exits 0.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P0-5 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P0-6 — Husky + lint-staged + commitlint

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** S (30–90 min)
- **Depends on:** `P0-1`, `P0-4`, `P0-5`

### Description

Wire Git hooks so every commit runs `lint-staged` (pre-commit) and `commitlint` (commit-msg). Enforces Conventional Commits per §2 and keeps unformatted/unlinted code off `main`.

### Acceptance Criteria

- [x] `husky` installed; `.husky/pre-commit` runs `pnpm exec lint-staged`.
- [x] `.husky/commit-msg` runs `pnpm exec commitlint --edit "$1"`.
- [x] `commitlint.config.mjs` extends `@commitlint/config-conventional`.
- [x] `lint-staged.config.mjs` runs `prettier --write` + `eslint --fix` on staged `*.{ts,tsx,js,jsx,mjs,cjs}` and `prettier --write` on `*.{json,md,yml,yaml}`.
- [x] Root `package.json` has `"prepare": "husky"` (from P0-1); `pnpm install` creates `.husky/_/`.
- [x] `echo "chore: bootstrap" | pnpm exec commitlint` exits 0; `echo "bad message" | pnpm exec commitlint` exits non-zero.

### Files to create / modify

- `commitlint.config.mjs`, `lint-staged.config.mjs`, `.husky/pre-commit`, `.husky/commit-msg`, `package.json` (devDependencies).

### Agent Execution Prompt

> Role: Senior TypeScript engineer.
> Context: Task P0-6 of `docs/DEVELOPMENT_PLAN.md` §Phase 0. §2 mandates Conventional Commits via commitlint + Husky + lint-staged.
> Objective: Wire pre-commit and commit-msg Git hooks.
> Steps:
>
> 1. Install devDependencies:
>    `pnpm add -D -w husky lint-staged @commitlint/cli @commitlint/config-conventional`.
> 2. Confirm root `package.json` has `"prepare": "husky"` (from P0-1).
> 3. Run `pnpm exec husky init`, then overwrite the generated hooks:
>    - `.husky/pre-commit` → `pnpm exec lint-staged`
>    - `.husky/commit-msg` → `pnpm exec commitlint --edit "$1"`
> 4. `chmod +x .husky/pre-commit .husky/commit-msg`.
> 5. Create `/commitlint.config.mjs`:
>    ```js
>    export default { extends: ['@commitlint/config-conventional'] }
>    ```
> 6. Create `/lint-staged.config.mjs`:
>    ```js
>    export default {
>      '*.{ts,tsx,js,jsx,mjs,cjs}': ['prettier --write', 'eslint --fix'],
>      '*.{json,md,yml,yaml}': ['prettier --write'],
>    }
>    ```
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - Do NOT use `--no-verify` anywhere in verification.
>   Verification:
> - `echo "chore: bootstrap" | pnpm exec commitlint` — expected: exit 0.
> - `echo "bad message" | pnpm exec commitlint` — expected: exit non-zero.
> - `ls -la .husky/pre-commit .husky/commit-msg` — expected: both exist and are executable.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P0-6 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P0-7 — Governance + Automation Files

- **Status:** 🟢 Done
- **Priority:** Medium
- **Size:** S (30–90 min)
- **Depends on:** `P0-1`

### Description

Create the repo-wide ignore/editor/automation/governance files: `.gitignore`, `.editorconfig`, `.gitmessage`, `renovate.json` (weekend schedule; pins `@bymax-one/nest-cache`, groups docker/actions), `LICENSE` (MIT © Bymax One), a `README.md` stub, `CHANGELOG.md`, and `CLAUDE.md` + `AGENTS.md` stubs (agent guidance). `pnpm-lock.yaml` is deliberately NOT ignored.

### Acceptance Criteria

- [x] `.gitignore` covers `node_modules/`, `dist/`, `.next/`, `coverage/`, `*.tsbuildinfo`, `logs/`, `.env`, `.env.*` (but allow-lists `!.env.example`), `*.log`, `.DS_Store`; does NOT ignore `pnpm-lock.yaml`.
- [x] `.editorconfig` sets LF, UTF-8, 2-space indent, final newline, trim trailing whitespace (except `*.md`).
- [x] `.gitmessage` documents the Conventional-Commit format + cache scopes (`api`, `web`, `cache`, `docker`, `deps`, `docs`, `config`).
- [x] `renovate.json` extends `config:recommended` (+ `:semanticCommits`), schedules on weekends, and pins/groups `@bymax-one/nest-cache` + docker + github-actions.
- [x] `LICENSE` is MIT with `Copyright (c) <year> Bymax One`.
- [x] `README.md` stub links to `docs/TECHNICAL_SPECIFICATION.md` + `docs/DEVELOPMENT_PLAN.md` + `docs/DASHBOARD.md` and states the repo is in scaffolding (full README is Phase 19).
- [x] `CHANGELOG.md` is Keep-a-Changelog with an empty `## [Unreleased]`.
- [x] `CLAUDE.md` + `AGENTS.md` stubs exist (one-paragraph project summary + "see docs/" pointer + non-negotiables: English-only, Conventional Commits, no Swagger, no `@ts-ignore`).

### Files to create / modify

- `.gitignore`, `.editorconfig`, `.gitmessage`, `renovate.json`, `LICENSE`, `README.md`, `CHANGELOG.md`, `CLAUDE.md`, `AGENTS.md`.

### Agent Execution Prompt

> Role: Senior TypeScript engineer / technical writer.
> Context: Task P0-7 of `docs/DEVELOPMENT_PLAN.md` §Phase 0. Renovate is configured per §2 (weekend schedule; pin `@bymax-one/nest-cache`, group docker/actions). The README links into the existing `docs/` (the spec, plan, and dashboard already exist).
> Objective: Create the governance/automation/agent-doc files.
> Steps:
>
> 1. `/.editorconfig`:
>
>    ```ini
>    root = true
>
>    [*]
>    charset = utf-8
>    end_of_line = lf
>    indent_style = space
>    indent_size = 2
>    insert_final_newline = true
>    trim_trailing_whitespace = true
>
>    [*.md]
>    trim_trailing_whitespace = false
>    ```
>
> 2. `/.gitignore` covering: `node_modules/`, `dist/`, `build/`, `.next/`, `coverage/`, `*.tsbuildinfo`, `logs/`, `.turbo/`, `.env`, `.env.*`, `!.env.example`, `*.log`, `.DS_Store`, `Thumbs.db`. Do NOT ignore `pnpm-lock.yaml`.
> 3. `/.gitmessage` — a commented template documenting `<type>(<scope>): <subject>` (≤72 chars), body lines ≤100, types `feat|fix|docs|refactor|perf|test|build|ci|chore|revert`, scopes `api|web|cache|docker|deps|docs|config`.
> 4. `/renovate.json`:
>    ```json
>    {
>      "$schema": "https://docs.renovatebot.com/renovate-schema.json",
>      "extends": ["config:recommended", ":semanticCommits"],
>      "schedule": ["every weekend"],
>      "packageRules": [
>        {
>          "matchPackageNames": ["@bymax-one/nest-cache"],
>          "rangeStrategy": "pin",
>          "groupName": "bymax-one"
>        },
>        { "matchManagers": ["dockerfile", "docker-compose"], "groupName": "docker" },
>        { "matchManagers": ["github-actions"], "groupName": "github-actions" }
>      ]
>    }
>    ```
> 5. `/LICENSE`: standard MIT text, `Copyright (c) <current-year> Bymax One`.
> 6. `/README.md`: H1 `# nest-cache-example`, one-paragraph intro (reference app for `@bymax-one/nest-cache` — a typed Redis cache for NestJS), a "Documentation" section linking `docs/TECHNICAL_SPECIFICATION.md` + `docs/DEVELOPMENT_PLAN.md` + `docs/DASHBOARD.md`, and a "Status" line (scaffolding, Phase 0). Phase 19 replaces this with the full README.
> 7. `/CHANGELOG.md`: Keep-a-Changelog header + `## [Unreleased]` with `- Initial scaffolding.` under `### Added`.
> 8. `/CLAUDE.md` + `/AGENTS.md`: concise stubs — what the repo is, the headline stack (NestJS 11 / Next 16 / Redis 7 / `@bymax-one/nest-cache`), a "read docs/ for detail" pointer, and the non-negotiables (English-only, Conventional Commits, no Swagger — JSDoc + Zod, no `@ts-ignore`/`eslint-disable`, design system copied verbatim).
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - Keep README/CHANGELOG/agent-docs concise — fleshed out in Phase 19.
>   Verification:
> - `git check-ignore -v pnpm-lock.yaml` — expected: no output, exit 1 (not ignored).
> - `node -e "JSON.parse(require('fs').readFileSync('renovate.json','utf8'))"` — expected: parses without error.
> - `grep -l "Bymax One" LICENSE` — expected: match.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P0-7 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P0-8 — Verification Gate (`install` + `typecheck` + `lint` + `format:check`)

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** S (30–90 min)
- **Depends on:** `P0-1`, `P0-2`, `P0-3`, `P0-4`, `P0-5`, `P0-6`, `P0-7`

### Description

Phase 0 "Definition of done" gate per `DEVELOPMENT_PLAN.md`: prove the scaffolded workspace installs, typechecks, lints, and format-checks cleanly on an empty source tree, and that the Git hooks pass without `--no-verify`. Closes the phase.

### Acceptance Criteria

- [x] `pnpm install --frozen-lockfile` exits 0 (lockfile committed).
- [x] `pnpm typecheck` exits 0 (no app packages yet → no-op via `--if-present`).
- [x] `pnpm lint` exits 0.
- [x] `pnpm format:check` exits 0.
- [x] A `chore:`-prefixed commit passes the Husky `pre-commit` + `commit-msg` hooks (exercised without `--no-verify`).

### Files to create / modify

- _(none — verification only; fix earlier task files if a check fails)_

### Agent Execution Prompt

> Role: Senior TypeScript engineer.
> Context: Task P0-8 of `docs/DEVELOPMENT_PLAN.md` §Phase 0. DoD: `pnpm install && pnpm typecheck && pnpm lint && pnpm format:check` all green on a clean checkout.
> Objective: Confirm all Phase 0 tooling is operational and close the phase.
> Steps:
>
> 1. Run `pnpm install --frozen-lockfile`, then the four verification commands below. All must exit 0.
> 2. Stage the tree and exercise the hooks exactly as Git runs them (no `--no-verify`): `.husky/pre-commit` (→ `lint-staged`) and `.husky/commit-msg` (→ `commitlint`) with a `chore:` message. Do NOT make the commit itself unless the user asks — proving the hooks pass is sufficient.
> 3. If any check fails, diagnose and fix in the corresponding earlier task file (P0-1..P0-7), then return here. Do NOT add placeholder source files to make `typecheck` pass artificially.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - Do NOT skip hooks; do NOT lower any threshold.
>   Verification:
> - `pnpm install --frozen-lockfile` — expected: exit 0.
> - `pnpm typecheck` — expected: exit 0.
> - `pnpm lint` — expected: exit 0.
> - `pnpm format:check` — expected: exit 0.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P0-8 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

When this task is 🟢, Phase 0 is 8/8 — switch the Phase 0 row in `DEVELOPMENT_PLAN.md` Progress Summary to 🟢 Done.

⚠️ Never mark done with failing verification.

---

## Completion log

- P0-1 ✅ 2026-06-16 — workspace root `package.json` + `pnpm-workspace.yaml` created; `pnpm-lock.yaml` materialized
- P0-2 ✅ 2026-06-16 — `.nvmrc` (24), `.npmrc` (frozen-lockfile), `engines` field added to package.json
- P0-3 ✅ 2026-06-16 — `tsconfig.base.json` created with full strict + ESNext + verbatimModuleSyntax settings; TypeScript 5.9.3 installed
- P0-4 ✅ 2026-06-16 — `eslint.config.mjs` flat config wired with type-checked rules scoped to TS files; `pnpm lint` exits 0
- P0-5 ✅ 2026-06-16 — `.prettierrc.mjs` + `.prettierignore` created; docs formatted; `pnpm format:check` exits 0
- P0-6 ✅ 2026-06-16 — husky hooks wired (pre-commit → lint-staged, commit-msg → commitlint); both validated
- P0-7 ✅ 2026-06-16 — `.gitignore`, `.editorconfig`, `.gitmessage`, `renovate.json`, `LICENSE`, `README.md`, `CHANGELOG.md`, `CLAUDE.md`, `AGENTS.md` created
- P0-8 ✅ 2026-06-16 — all four DoD gates pass: install, typecheck, lint, format:check; commit-msg hook validated
