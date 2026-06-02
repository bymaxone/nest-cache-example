# Phase 2 — Library Consumption & Workspace Bootstrap — Tasks

> **Source:** [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#phase-2--library-consumption--workspace-bootstrap) §Phase 2
> **Total tasks:** 3
> **Progress:** 🔴 0 / 3 done (0%)
>
> **Status legend:** 🔴 Not Started · 🟡 In Progress · 🔵 In Review · 🟢 Done · ⚪ Blocked

## Task index

| ID   | Task                                                                       | Status | Priority | Size | Depends on |
| ---- | -------------------------------------------------------------------------- | ------ | -------- | ---- | ---------- |
| P2-1 | `apps/api` consumes the library (local link + peers) + dual-subpath probe  | 🔴     | High     | S    | Phase 0    |
| P2-2 | `apps/web` consumes the library + `./shared`-only (zero-dep) probe         | 🔴     | High     | S    | Phase 0    |
| P2-3 | Verification: both subpaths type-resolve in both apps (`pnpm typecheck`)   | 🔴     | High     | XS   | P2-1, P2-2 |

---

## P2-1 — `apps/api` consumes the library (local link + peers) + dual-subpath probe

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** S (30–90 min)
- **Depends on:** `Phase 0`

### Description

Wire `apps/api` to consume `@bymax-one/nest-cache` as a **versioned external package** (not a workspace member) and prove **both** published subpaths type-resolve from the NestJS side. The dependency is declared as a **local file link** (`file:../../../nest-cache`) because the library is **not yet published** to npm; once published this flips to the semver range `^0.1.0`. The link resolves through the library's built `dist/` + `package.json#exports`, so the example validates the **published** API surface — not the library's `src/` (a workspace member would short-circuit the `exports` map and hide subpath / `.d.ts` / dual-build issues). The library is `"type": "module"`, dual ESM + CJS (tsup), with two subpaths: `.` (server — NestJS module + services) and `./shared` (zero-dependency types + constants). Because the linked library declares its NestJS / ioredis / reflect-metadata dependencies as **peers**, those peers must live in `apps/api` so they resolve to a **single copy**. A small typed `library-probe.ts` imports from **both** subpaths so a later `pnpm typecheck` (P2-3) proves resolution end-to-end; this is the first half of Feature-Coverage-Matrix row **#48** (dual subpath) and row **#49** (re-exported ioredis types resolve).

### Acceptance Criteria

- [ ] `apps/api/package.json` declares `"@bymax-one/nest-cache": "file:../../../nest-cache"` under `dependencies` (with a comment-equivalent note in the task/PR that the published end-state is `^0.1.0`).
- [ ] `apps/api/package.json` declares the library's peers under `dependencies`: `ioredis@^5`, `@nestjs/common@^11`, `@nestjs/core@^11`, `reflect-metadata@^0.2`.
- [ ] `apps/api/src/library-probe.ts` imports from `.` (`BymaxCacheModule`, `CacheService`) **and** from `./shared` (`CACHE_ERROR_CODES`, type `CacheErrorCode`).
- [ ] The probe references each import (no unused-symbol errors) and is a runtime-inert **resolution proof** — it imports values only to prove both subpaths resolve at compile time, not to ship a feature (note: under `verbatimModuleSyntax` the value imports are emitted, so it is not literally "type-only").
- [ ] `pnpm install` links the library and resolves all four peers to a single copy (no duplicate-peer warnings for these packages).
- [ ] `pnpm --filter @nest-cache-example/api exec tsc --noEmit` resolves both subpaths with no errors.

### Files to create / modify

- `apps/api/package.json` — add the library dep (local link) + the four peer deps.
- `apps/api/src/library-probe.ts` — typed dual-subpath import probe (`.` + `./shared`).

### Agent Execution Prompt

> Role: Senior TypeScript / NestJS engineer wiring a reference app to consume a local, unpublished library.
> Context: Repo `nest-cache-example` is the reference app for `@bymax-one/nest-cache` (see `docs/TECHNICAL_SPECIFICATION.md` §4 The Library Under Test — public API inventory for **both** subpaths — and §8 Library Consumption, plus `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions). This is task P2-1, the first task of Phase 2. The library lives as a sibling checkout at `../nest-cache` (relative to the repo root), is **`"type": "module"`**, dual ESM + CJS (tsup), exposes exactly two subpaths — `.` (server: NestJS module + services) and `./shared` (zero-dependency types + constants) — has **no runtime dependencies**, and declares `@nestjs/common ^11`, `@nestjs/core ^11`, `ioredis ^5`, `reflect-metadata ^0.2` as **peerDependencies**. It is **not yet published to npm**, so the example links it locally for now. `apps/api` already exists as a workspace package from Phase 1.
> Objective: Make `apps/api` consume `@bymax-one/nest-cache` via a local file link, install the library's peers into `apps/api`, and add a typed probe that imports from **both** subpaths so resolution is verifiable.
> Steps:
>
> 1. Edit `apps/api/package.json`. Under `"dependencies"`, add the library as a **local file link** and the four peer packages:
>    ```jsonc
>    "dependencies": {
>      // Local link — current default until the library is published to npm.
>      // After publish this becomes: "@bymax-one/nest-cache": "^0.1.0"
>      "@bymax-one/nest-cache": "file:../../../nest-cache",
>      // The library declares these as PEER deps — keep them in apps/api so the
>      // linked library resolves them to a single copy (no duplicate ioredis/Nest).
>      "@nestjs/common": "^11",
>      "@nestjs/core": "^11",
>      "ioredis": "^5",
>      "reflect-metadata": "^0.2"
>    }
>    ```
>    Preserve any deps Phase 1 already added; merge, don't clobber. (The `file:../../../nest-cache` path is relative to `apps/api/` → repo-root parent → the sibling `nest-cache` checkout. If your local layout differs, adjust the relative segments so it points at the library root that contains its built `dist/`.)
> 2. Confirm the library is built so the link resolves through `dist/` + `exports`: run `pnpm --dir ../nest-cache build` if a `dist/` is not present. The example must resolve the **published** artifact (`dist/` + `package.json#exports`), never the library's `src/`.
> 3. Create `apps/api/src/library-probe.ts` — a typed, runtime-inert dual-subpath probe that imports from **both** the server subpath and the shared subpath and references each symbol so the compiler proves resolution:
>    ```ts
>    /**
>     * Compile-time resolution probe (Phase 2 / matrix #48 + #49).
>     * Proves both published subpaths of @bymax-one/nest-cache type-resolve from
>     * the NestJS app: the server subpath `.` (module + services) AND the
>     * zero-dependency shared subpath `./shared`. Inert at runtime — it exists
>     * purely so `pnpm typecheck` fails loudly if the published exports map or
>     * the dual build regresses. Replaced by real wiring in later phases.
>     */
>    import { BymaxCacheModule, CacheService } from '@bymax-one/nest-cache'
>    import { CACHE_ERROR_CODES, type CacheErrorCode } from '@bymax-one/nest-cache/shared'
>
>    // Reference each import so noUnusedLocals / no-unused-vars are satisfied.
>    const probedServerExports = [BymaxCacheModule, CacheService] as const
>    const probedSharedCodes: readonly CacheErrorCode[] = Object.values(CACHE_ERROR_CODES)
>
>    export const LIBRARY_PROBE = {
>      serverExportCount: probedServerExports.length,
>      sharedCodeCount: probedSharedCodes.length,
>    } as const
>    ```
> 4. Run `pnpm install` from the repo root to materialize the link and the peers, then typecheck `apps/api`.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions and `docs/TECHNICAL_SPECIFICATION.md` §8.
> - Do NOT add the library as a workspace package or a `paths` alias — it must resolve as an external package through `dist/` + `exports`, exactly as a real consumer hits it.
> - Do NOT move the peers to `peerDependencies`/`devDependencies` of `apps/api`; they are real runtime deps of the app and must resolve to one copy for the linked library.
> - Do NOT import the server subpath `.` from anywhere in `apps/web` (web gets `./shared` only — that is P2-2).
> - English-only comments; no `@ts-ignore` / `eslint-disable`.
>   Verification:
> - `node -p "require('./apps/api/package.json').dependencies['@bymax-one/nest-cache']"` — expected: `file:../../../nest-cache`.
> - `node -e "const d=require('./apps/api/package.json').dependencies; ['ioredis','@nestjs/common','@nestjs/core','reflect-metadata'].forEach(p=>{if(!d[p])throw new Error('missing peer '+p)})"` — expected: exits 0.
> - `pnpm --filter @nest-cache-example/api exec tsc --noEmit` — expected: exit 0 (both subpaths resolve; `library-probe.ts` compiles against `.` + `./shared`).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P2-1 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

If phase reaches 100%, switch its row status in `DEVELOPMENT_PLAN.md` to 🟢.

⚠️ Never mark done with failing verification.

---

## P2-2 — `apps/web` consumes the library + `./shared`-only (zero-dep) probe

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** S (30–90 min)
- **Depends on:** `Phase 0`

### Description

Wire `apps/web` (the Next.js dashboard) to consume `@bymax-one/nest-cache` via the **same local file link** (`file:../../../nest-cache`, → `^0.1.0` after publish), but prove the **browser path pulls in NO NestJS / ioredis**. The dashboard imports **only** from the `./shared` subpath, which is **zero-dependency** by design — so a probe that imports exclusively from `@bymax-one/nest-cache/shared` and never from the server subpath `.` is the verifiable proof of the library's layering (the second half of Feature-Coverage-Matrix row **#48**). The probe imports the runtime constant `CACHE_ERROR_CODES` plus the types `CacheErrorCode`, `CacheConnectionStatus`, and `SerializableValue` — exactly the shared-subpath surface the real dashboard later uses to type API error codes and the connection-status badge without dragging NestJS or ioredis into the client bundle. Crucially, `apps/web` declares the library dep but **does NOT** declare the NestJS / ioredis peers (those belong only to `apps/api`); the zero-dep `./shared` import resolves without them, which is the whole point.

### Acceptance Criteria

- [ ] `apps/web/package.json` declares `"@bymax-one/nest-cache": "file:../../../nest-cache"` under `dependencies` (published end-state `^0.1.0`, noted in the task/PR).
- [ ] `apps/web` does **NOT** declare `ioredis`, `@nestjs/common`, `@nestjs/core`, or `reflect-metadata` (the zero-dep shared path needs none of them).
- [ ] `apps/web/lib/cache-shared-probe.ts` imports **only** from `@bymax-one/nest-cache/shared`: `CACHE_ERROR_CODES`, type `CacheErrorCode`, type `CacheConnectionStatus`, type `SerializableValue`.
- [ ] The probe contains **no** import from `@bymax-one/nest-cache` (the bare server subpath) — proving the browser path stays NestJS/ioredis-free.
- [ ] The probe references each import (no unused-symbol errors) and is inert at runtime.
- [ ] `pnpm --filter @nest-cache-example/web exec tsc --noEmit` resolves the `./shared` subpath with no errors.

### Files to create / modify

- `apps/web/package.json` — add the library dep (local link); add NO Nest/ioredis peers.
- `apps/web/lib/cache-shared-probe.ts` — `./shared`-only import probe (zero-dep proof).

### Agent Execution Prompt

> Role: Senior TypeScript / Next.js engineer wiring a browser-facing app to consume only the zero-dependency subpath of a local library.
> Context: Repo `nest-cache-example`, task P2-2 of Phase 2 (see `docs/TECHNICAL_SPECIFICATION.md` §4 — the **shared subpath `./shared`** inventory — and §8 Library Consumption, esp. "The dual-subpath demonstration (matrix #48)", plus `docs/DEVELOPMENT_PLAN.md` §2). `@bymax-one/nest-cache` is `"type": "module"`, dual ESM + CJS, exposes `.` (server) and `./shared` (zero-dependency types + constants), and is consumed via a **local file link** until it is published to npm. `apps/web` already exists as a Next.js 16 workspace package from Phase 1. The dashboard is a **thin client** that must never pull NestJS or ioredis into the browser bundle — it imports the library's **shared** subpath only.
> Objective: Make `apps/web` consume `@bymax-one/nest-cache` via the local link and add a probe that imports **exclusively** from `@bymax-one/nest-cache/shared`, proving the zero-dependency browser path resolves with NO NestJS/ioredis peers present.
> Steps:
>
> 1. Edit `apps/web/package.json`. Under `"dependencies"`, add **only** the library link (no Nest/ioredis peers — the shared path needs none):
>    ```jsonc
>    "dependencies": {
>      // Local link — current default until the library is published to npm.
>      // After publish this becomes: "@bymax-one/nest-cache": "^0.1.0"
>      // NOTE: the web app pulls ONLY the zero-dependency `./shared` subpath,
>      // so it deliberately declares NONE of the library's NestJS/ioredis peers.
>      "@bymax-one/nest-cache": "file:../../../nest-cache"
>    }
>    ```
>    Preserve the Next/React deps Phase 1 added; merge, don't clobber. Use the same relative `file:` path shape as `apps/api` (it points at the sibling `nest-cache` library root that contains its built `dist/`).
> 2. Create `apps/web/lib/cache-shared-probe.ts` — a probe that imports **only** from the shared subpath and references each symbol:
>    ```ts
>    /**
>     * Browser-path resolution probe (Phase 2 / matrix #48, the zero-dep half).
>     * Imports EXCLUSIVELY from @bymax-one/nest-cache/shared — never from the
>     * server subpath `.` — proving the dashboard's cache types pull in NO NestJS
>     * and NO ioredis. Inert at runtime; it exists so `pnpm typecheck` proves the
>     * zero-dependency layering holds and `./shared` resolves in the web app.
>     * Replaced by real api-client / status-badge typing in later phases.
>     */
>    import {
>      CACHE_ERROR_CODES,
>      type CacheErrorCode,
>      type CacheConnectionStatus,
>      type SerializableValue,
>    } from '@bymax-one/nest-cache/shared'
>
>    // Reference every import so it is not tree-shaken / flagged as unused.
>    const probedCodes: readonly CacheErrorCode[] = Object.values(CACHE_ERROR_CODES)
>    const probedStatus: CacheConnectionStatus = 'ready'
>    const probedValue: SerializableValue = { ok: true }
>
>    export const CACHE_SHARED_PROBE = {
>      codeCount: probedCodes.length,
>      status: probedStatus,
>      sample: probedValue,
>    } as const
>    ```
>    (If `CacheConnectionStatus` does not include the literal `'ready'` in the shipped types, substitute any valid member of that union — consult §4.2 / the library's `dist/shared/index.d.ts`.)
> 3. Run `pnpm install` from the repo root, then typecheck `apps/web`.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 and `docs/TECHNICAL_SPECIFICATION.md` §8.
> - The probe MUST NOT import from `@bymax-one/nest-cache` (the bare server subpath) — only from `@bymax-one/nest-cache/shared`. Importing the server subpath here would defeat the zero-dep proof.
> - Do NOT add `ioredis`, `@nestjs/common`, `@nestjs/core`, or `reflect-metadata` to `apps/web` — the shared subpath resolves without them, and their absence is the proof.
> - Do NOT add a `paths` alias or treat the library as a workspace package — resolve it as an external package through `dist/` + `exports`.
> - English-only comments; no `@ts-ignore` / `eslint-disable`.
>   Verification:
> - `node -p "require('./apps/web/package.json').dependencies['@bymax-one/nest-cache']"` — expected: `file:../../../nest-cache`.
> - `node -e "const d=require('./apps/web/package.json').dependencies||{}; ['ioredis','@nestjs/common','@nestjs/core','reflect-metadata'].forEach(p=>{if(d[p])throw new Error('web must NOT declare '+p)})"` — expected: exits 0.
> - `grep -n "from '@bymax-one/nest-cache'" apps/web/lib/cache-shared-probe.ts` — expected: no match (only the `/shared` import exists).
> - `pnpm --filter @nest-cache-example/web exec tsc --noEmit` — expected: exit 0 (`./shared` resolves; no NestJS/ioredis required).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P2-2 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

If phase reaches 100%, switch its row status in `DEVELOPMENT_PLAN.md` to 🟢.

⚠️ Never mark done with failing verification.

---

## P2-3 — Verification: both subpaths type-resolve in both apps (`pnpm typecheck`)

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** XS (<30 min)
- **Depends on:** `P2-1`, `P2-2`

### Description

Phase 2 "Definition of done" gate per `DEVELOPMENT_PLAN.md`: prove the example actually consumes the **published** API of `@bymax-one/nest-cache` and that **both** subpaths type-resolve in **both** apps. A single workspace-wide `pnpm typecheck` must pass: the `apps/api` probe compiles against the server subpath `.` **and** the shared subpath `./shared`; the `apps/web` probe compiles against `./shared` **only** (with no NestJS/ioredis present). This closes the phase and locks in Feature-Coverage-Matrix rows **#48** (dual subpath demonstrated across both apps) and **#49** (re-exported ioredis types resolve through the server subpath). No new product code — verification only; if a check fails, fix it in P2-1 / P2-2.

### Acceptance Criteria

- [ ] `pnpm install` (or `pnpm install --frozen-lockfile` on a clean checkout) exits 0 with the library linked in both apps.
- [ ] `pnpm typecheck` exits 0 across the workspace (both app packages).
- [ ] The `apps/api` probe (`src/library-probe.ts`) resolves imports from **both** `.` and `./shared`.
- [ ] The `apps/web` probe (`lib/cache-shared-probe.ts`) resolves imports from `./shared` **only**, and `apps/web` declares **no** NestJS/ioredis peers.
- [ ] No duplicate-copy resolution of `ioredis` / `@nestjs/*` for the linked library (peers resolve to a single copy in `apps/api`).

### Files to create / modify

- _(none — verification only; fix P2-1 / P2-2 if a check fails)_

### Agent Execution Prompt

> Role: Senior TypeScript engineer closing the library-consumption phase.
> Context: Task P2-3 of Phase 2 (`docs/DEVELOPMENT_PLAN.md` §Phase 2; `docs/TECHNICAL_SPECIFICATION.md` §8). DoD: the example consumes `@bymax-one/nest-cache` and **both** subpaths type-resolve in **both** apps. The library is consumed via a **local file link** (resolves through its built `dist/` + `package.json#exports` — the published surface, not `src/`), is `"type": "module"`, dual ESM + CJS, with subpaths `.` (server) and `./shared` (zero-dep). P2-1 wired `apps/api` (`.` + `./shared` probe, with the four peers) and P2-2 wired `apps/web` (`./shared`-only probe, no peers).
> Objective: Run the workspace verification and confirm both subpaths resolve in both apps; close the phase.
> Steps:
>
> 1. Ensure the library is built (`pnpm --dir ../nest-cache build` if no `dist/`), then run `pnpm install` from the repo root so both links + the `apps/api` peers are materialized.
> 2. Run `pnpm typecheck` (the workspace fan-out from Phase 0). It must exit 0 — this compiles the `apps/api` dual-subpath probe and the `apps/web` shared-only probe together.
> 3. Spot-check resolution per app: `pnpm --filter @nest-cache-example/api exec tsc --noEmit` (must resolve `.` + `./shared`) and `pnpm --filter @nest-cache-example/web exec tsc --noEmit` (must resolve `./shared` with no NestJS/ioredis present).
> 4. Confirm the linked library's peers resolve to a single copy (no duplicate `ioredis` / `@nestjs/*`); inspect `pnpm why ioredis` if in doubt.
> 5. If any check fails, diagnose and fix in P2-1 (api dep/peers/probe) or P2-2 (web dep/probe), then return here. Do NOT relax tsconfig strictness, add `paths` aliases, convert the library to a workspace member, or suppress with `@ts-ignore` to make a check pass.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - Do NOT lower any threshold or skip a check; do NOT add placeholder source to mask a resolution failure.
>   Verification:
> - `pnpm install` — expected: exit 0; library linked in both apps.
> - `pnpm typecheck` — expected: exit 0 (both apps; both subpaths resolve).
> - `pnpm --filter @nest-cache-example/api exec tsc --noEmit` — expected: exit 0 (`.` + `./shared`).
> - `pnpm --filter @nest-cache-example/web exec tsc --noEmit` — expected: exit 0 (`./shared` only, no peers).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P2-3 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

When this task is 🟢, Phase 2 is 3/3 — switch the Phase 2 row in `DEVELOPMENT_PLAN.md` Progress Summary to 🟢 Done.

⚠️ Never mark done with failing verification.

---

## Completion log

_(Agents append one line per finished task, newest at the bottom.)_
