# Phase 19 — Docs, README & Export Audit — Tasks

> **Source:** [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#phase-19--docs-readme--export-audit) §Phase 19
> **Total tasks:** 7
> **Progress:** 🔴 0 / 7 done (0%)
>
> **Status legend:** 🔴 Not Started · 🟡 In Progress · 🔵 In Review · 🟢 Done · ⚪ Blocked

## Task index

| ID    | Task                                                                   | Status | Priority | Size | Depends on   |
| ----- | ---------------------------------------------------------------------- | ------ | -------- | ---- | ------------ |
| P19-1 | `scripts/audit-library-exports.mjs` + `.audit-ignore.json` (+ CI job)  | 🔴     | High     | M    | Phases 3–14  |
| P19-2 | Root `README.md` (centered header, badges, matrix, ASCII arch)         | 🔴     | High     | L    | Phases 3–14  |
| P19-3 | Documented curl journeys (miss→hit, stampede, isolation)               | 🔴     | Medium   | S    | P19-2        |
| P19-4 | Keep spec/dashboard/plan current; flip `OVERVIEW.md` to superseded     | 🔴     | Medium   | S    | Phases 3–14  |
| P19-5 | Document the OPTIONAL `@bymax-one/nest-logger` events bridge (row #50) | 🔴     | Low      | S    | P19-1, P19-2 |
| P19-6 | `CHANGELOG.md` `0.1.0` entry + design-system acceptance check          | 🔴     | Medium   | S    | P19-2        |
| P19-7 | Final audit verification (`audit:exports` exit 0, matrix all ✅)       | 🔴     | High     | S    | P19-1..P19-6 |

---

## P19-1 — `scripts/audit-library-exports.mjs` + `.audit-ignore.json` (+ CI job)

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** M (90–180 min)
- **Depends on:** `Phases 3–14`

### Description

Build the export-usage audit — the **contract** that every public export of `@bymax-one/nest-cache` is demonstrated in `apps/`. The script parses the library's **shipped** type declarations at `node_modules/@bymax-one/nest-cache/dist/{server,shared}/index.d.ts`, extracts every exported symbol, then word-boundary-searches the `apps/` source corpus; it FAILS (exit 1) on any export that is not demonstrated, **unless** that symbol is listed in `.audit-ignore.json` with a stated reason. This is the machine-checkable proof behind the spec's [§7 Feature Coverage Matrix](../TECHNICAL_SPECIFICATION.md#7--feature-coverage-matrix) (the 50 rows) and [`DEVELOPMENT_PLAN.md` Appendix B](../DEVELOPMENT_PLAN.md#appendix-b--library-export--example-file-map). **Zero third-party deps** — the script uses only `node:` builtins (the library is the artifact under test; the audit must not pull anything else in). Wire it as the `audit:exports` script (already declared in P0-1) and as a CI job (`export-usage-check`, per [Appendix C](../DEVELOPMENT_PLAN.md#appendix-c--quality-gates)).

### Acceptance Criteria

- [ ] `scripts/audit-library-exports.mjs` exists; imports **only** `node:` builtins (`node:fs`, `node:path`, `node:process`, `node:url`) — zero third-party deps.
- [ ] Parses both `node_modules/@bymax-one/nest-cache/dist/server/index.d.ts` and `.../dist/shared/index.d.ts`; extracts every exported symbol (named `export`, `export type`, `export { … }`, re-exports) into a de-duplicated set.
- [ ] Word-boundary-searches (`\b<symbol>\b`) the `apps/` corpus (`apps/api/src/**`, `apps/api/test/**`, `apps/web/**`, excluding `dist`/`.next`/`node_modules`/`coverage`); a symbol is "demonstrated" if it appears at least once outside an import-only re-statement.
- [ ] FAILS with exit code 1 and a clear per-symbol report listing every **undocumented** export; exits 0 when all exports are demonstrated or ignored.
- [ ] `.audit-ignore.json` exists with a typed shape — each entry pairs a symbol with a human reason (e.g. `{ "ignore": [ { "symbol": "…", "reason": "…" } ] }`); ignored symbols are excluded from the failure set and **echoed** in the report so they stay visible.
- [ ] Root `package.json` `audit:exports` → `node scripts/audit-library-exports.mjs` (confirm from P0-1; do not duplicate).
- [ ] A CI job `export-usage-check` runs `pnpm audit:exports` (uses `pnpm/action-setup@v4` before `actions/setup-node@v5`, `cache: pnpm`, `pnpm install --frozen-lockfile`).

### Files to create / modify

- `scripts/audit-library-exports.mjs` — the audit (node: builtins only).
- `.audit-ignore.json` — allow-list of `{ symbol, reason }` exceptions.
- `.github/workflows/*.yml` — add/extend the `export-usage-check` CI job.
- `package.json` — confirm `audit:exports` script (from P0-1).

### Agent Execution Prompt

> Role: Senior TypeScript / Node engineer building a CI-grade static-analysis script with zero dependencies.
> Context: Repo `nest-cache-example` is the reference app for `@bymax-one/nest-cache` (see `docs/DEVELOPMENT_PLAN.md` §Phase 19 + §2 Global Conventions, `docs/TECHNICAL_SPECIFICATION.md` §7 Feature Coverage Matrix, and `DEVELOPMENT_PLAN.md` Appendix B). This is task P19-1. The library is consumed from `node_modules/@bymax-one/nest-cache` (a local `file:` link until published); the audit reads its **shipped `.d.ts`** so it always tracks the real published surface. The audit is the contract that **every one of the 50 Feature-Coverage-Matrix rows is demonstrated** somewhere in `apps/`.
> Objective: Produce `scripts/audit-library-exports.mjs` + `.audit-ignore.json` and wire the `export-usage-check` CI job.
> Steps:
>
> 1. Resolve the two declaration files from the installed package — `node_modules/@bymax-one/nest-cache/dist/server/index.d.ts` (the `.` / server subpath) and `node_modules/@bymax-one/nest-cache/dist/shared/index.d.ts` (the `./shared` zero-dep subpath). Read both with `node:fs`. If a file is missing, fail loudly with a message telling the maintainer to `pnpm install` the library first (do NOT silently pass).
> 2. Extract exported symbols with regexes over the `.d.ts` text (this is a declaration file, so the surface is explicit): match `export declare (class|function|const|enum|abstract class) <Name>`, `export (type|interface) <Name>`, and `export { A, B as C, … }` (capture the **exported** name of each entry — the left identifier when there is no `as`, e.g. `Redis` in `export { Redis }`, and the right identifier after `as`); for `export * from` note the wildcard but do not invent names. Collect into a de-duplicated `Set<string>`. Strip type-only generics/params; keep only the top-level identifier.
> 3. Build the `apps/` corpus: recursively read `apps/api/src/**`, `apps/api/test/**`, and `apps/web/**` (`.ts`/`.tsx`/`.mts`/`.cts`), skipping `dist`, `.next`, `node_modules`, `coverage` (including `test/**` so an export demonstrated only in the sync-`forRoot` E2E module — matrix #2 — still counts). Concatenate (or search file-by-file) into searchable text.
> 4. For each exported symbol, test `new RegExp(`\\b${escapeRegExp(symbol)}\\b`)` against the corpus. A symbol counts as **demonstrated** when matched. (Word-boundary search keeps `Cache` from matching `CacheService`.)
> 5. Load `.audit-ignore.json` (`{ "ignore": [{ "symbol": "X", "reason": "…" }] }`). Symbols listed there are removed from the failure set but printed in an `IGNORED (with reason)` section so they never disappear silently. Validate the file shape by hand (no third-party validator) — every entry MUST have a non-empty `symbol` and `reason`, else fail.
> 6. Print a report: `DEMONSTRATED: n/total`, an `IGNORED` block, and — if any remain — an `UNDOCUMENTED EXPORTS` block listing each missing symbol and the subpath it came from. `process.exit(1)` if the undocumented set is non-empty, else `process.exit(0)`.
> 7. Create `/.audit-ignore.json` initialized to `{ "ignore": [] }` (add entries only for exports that genuinely cannot be demonstrated in an example, each with a one-line justification — keep this list as small as honesty allows).
> 8. Confirm `package.json` already has `"audit:exports": "node scripts/audit-library-exports.mjs"` (declared in P0-1); do not duplicate or rename.
> 9. Add a CI job `export-usage-check` (extend the existing workflow, or `.github/workflows/ci.yml`): checkout → `pnpm/action-setup@v4` → `actions/setup-node@v5` (`node-version: '24'`, `cache: pnpm`) → `pnpm install --frozen-lockfile` → `pnpm audit:exports`. Order matters: `pnpm/action-setup` **before** `setup-node` (per `DEVELOPMENT_PLAN.md` Appendix C toolchain caveat ①).
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions (ESM, English-only).
> - **Zero third-party dependencies** in the script — `node:` builtins ONLY. Do NOT add a TS parser, `ts-morph`, `globby`, etc. (regex over `.d.ts` is sufficient and keeps the audit dependency-free).
> - Parse the **shipped** `.d.ts` under `node_modules/@bymax-one/nest-cache/dist/{server,shared}/` — never the library's source. The contract is the published surface.
> - Every `.audit-ignore.json` entry MUST carry a reason; an entry without one is a hard failure.
> - No `@ts-ignore`, no `eslint-disable`, no `--no-verify`.
>   Verification:
> - `node scripts/audit-library-exports.mjs` — expected: runs, prints the report, exits 0 only if every export is demonstrated or ignored-with-reason (after Phases 3–14 it should be green; if not, the gap is a real undemonstrated export → fix the app or add a justified ignore).
> - `pnpm audit:exports` — expected: same as above (exit 0).
> - `node -e "JSON.parse(require('fs').readFileSync('.audit-ignore.json','utf8'))"` — expected: parses without error.
> - `grep -c "require(" scripts/audit-library-exports.mjs; grep -c "from '[^n]" scripts/audit-library-exports.mjs` — expected: no non-`node:` imports.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P19-1 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

If phase reaches 100%, switch its row status in `DEVELOPMENT_PLAN.md` to 🟢.

⚠️ Never mark done with failing verification.

---

## P19-2 — Root `README.md` (centered header, badges, matrix, ASCII arch)

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** L (3–6 h)
- **Depends on:** `Phases 3–14`

### Description

Replace the Phase 0 README stub with the polished, public-facing root `README.md` in the proven **sibling house style** (`nest-auth-example` / `nest-logger-example`): a centered HTML header, shields.io badges, a "What's inside" checklist, a Quick Start (docker + `pnpm dev`), an endpoints table, the spec's [§7 Feature Coverage Matrix](../TECHNICAL_SPECIFICATION.md#7--feature-coverage-matrix) summary, and an ASCII architecture diagram. This is the front door of the reference app — it must read like the siblings and make a real consumer want to lift the patterns. Badges use **shields.io flat-square black (`000000`)** exactly like the siblings (no rainbow colors). The library is consumed from `node_modules/@bymax-one/nest-cache` (dual subpath: `.` in `apps/api`, `./shared` in both apps).

### Acceptance Criteria

- [ ] Root `README.md` opens with a **centered** `<div align="center">` HTML header: project title `nest-cache-example`, a one-line tagline ("Reference app for `@bymax-one/nest-cache` — a typed Redis cache for NestJS"), and a row of shields.io badges.
- [ ] All badges are **shields.io flat-square** with color `000000` (black) matching the siblings — at minimum: Node `>=24`, pnpm `>=10.8`, NestJS 11, Next.js 16, Redis 7, License MIT, `@bymax-one/nest-cache` version.
- [ ] A "What's inside" checklist enumerates the demonstrated capability groups (data structures, namespaces/tenants, serialization, pub/sub, TTL events, Lua/stampede, topologies/errors, the live dashboard).
- [ ] A "Quick Start" section: `pnpm install`, `pnpm infra:up` (Docker Redis), `pnpm dev` (api + web), with the API on `:3001` and the web on its dev port.
- [ ] An endpoints table summarizing the main API routes (catalog, counters, collections, admin, tenants, pubsub, ttl-events, stampede, serializer, errors, health) grouped by area.
- [ ] A condensed [§7 Feature Coverage Matrix](../TECHNICAL_SPECIFICATION.md#7--feature-coverage-matrix) summary (or a clearly-linked summary table) showing the 50 rows are covered, with a link to the full matrix in the spec.
- [ ] An ASCII architecture diagram (browser ⇄ `apps/web` ⇄ `apps/api` ⇄ Redis, with the socket.io 3-channel bridge) consistent with the spec.
- [ ] All internal links resolve (`docs/TECHNICAL_SPECIFICATION.md`, `docs/DASHBOARD.md`, `docs/DEVELOPMENT_PLAN.md`); English-only throughout.

### Files to create / modify

- `README.md` — full public-facing README (replaces the Phase 0 stub).

### Agent Execution Prompt

> Role: Senior TypeScript engineer / technical writer matching an established house style.
> Context: Task P19-2 of `docs/DEVELOPMENT_PLAN.md` §Phase 19. This README replaces the Phase 0 stub (P0-7) and must be **indistinguishable in style** from the sibling examples `nest-auth-example` / `nest-logger-example`. The reference app demonstrates `@bymax-one/nest-cache` (consumed from `node_modules/@bymax-one/nest-cache`, dual subpath `.` + `./shared`). The 50-row coverage matrix lives in `docs/TECHNICAL_SPECIFICATION.md` §7.
> Objective: Write the polished root `README.md`.
> Steps:
>
> 1. **Study the sibling style first.** Open a sibling README (`../nest-auth-example/README.md` or `../nest-logger-example/README.md`) and mirror its structure: centered `<div align="center">` header, the badge row, section order, table style, ASCII-diagram fences. Match it closely — the goal is a consistent family of READMEs.
> 2. Write the centered header: H1/title `nest-cache-example`, tagline, then a badge row. Badges via shields.io `flat-square` with `color=000000` (black) — e.g. `https://img.shields.io/badge/Node-%3E%3D24-000000?style=flat-square`, plus pnpm, NestJS 11, Next.js 16, Redis 7, License MIT, and a `@bymax-one/nest-cache` badge. **Do not** use colored badges — black `000000` flat-square only, like the siblings.
> 3. "What's inside" — a checklist of the capability groups this repo proves (read-through cache + data structures, namespace isolation + tenants, default/custom serialization, Pub/Sub fan-out, TTL/keyspace events, Lua single-flight stampede collapse, connection topologies + the full error surface, and the live observability dashboard).
> 4. "Quick Start" — fenced shell block: `pnpm install` → `pnpm infra:up` (brings up `redis:7-alpine` via `docker compose`) → `pnpm dev` (parallel api + web). State the ports (API `:3001`, web dev server) and link to `.env.example`.
> 5. "Endpoints" — a Markdown table grouped by area (Catalog / Counters / Collections / Admin / Tenants / Pub-Sub / TTL Events / Stampede / Serializer / Errors / Health) listing method + path + one-line purpose. Keep it a summary; link to `docs/TECHNICAL_SPECIFICATION.md` §11 for the full catalogue.
> 6. "Feature Coverage" — a condensed table or summary stating all **50** library exports are demonstrated, that `pnpm audit:exports` enforces it (P19-1), and link to the full [§7 Feature Coverage Matrix](docs/TECHNICAL_SPECIFICATION.md#7--feature-coverage-matrix). Mention the matrix is the contract (Appendix B).
> 7. "Architecture" — an ASCII diagram inside a fenced block: `Browser → apps/web (Next 16) → apps/api (NestJS 11) → Redis 7`, with the socket.io gateway and its three channels (`cache:connection` / `cache:event` / `cache:expired`) shown. Keep it faithful to `docs/TECHNICAL_SPECIFICATION.md`.
> 8. "Documentation" — link the three living docs (`docs/TECHNICAL_SPECIFICATION.md`, `docs/DASHBOARD.md`, `docs/DEVELOPMENT_PLAN.md`). Run `pnpm format` after writing so Prettier normalizes the file.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions; English-only.
> - Badges: shields.io **flat-square**, color **`000000`** — match the siblings exactly. No emojis-as-badges, no colored shields.
> - Mirror the sibling READMEs' structure/voice; do not invent a new layout.
> - The library is consumed from `node_modules/@bymax-one/nest-cache` — describe it as a real package dependency, not a path alias.
> - Do NOT mention Swagger (this repo documents controllers with JSDoc + Zod DTOs by design).
>   Verification:
> - `pnpm format:check` — expected: exits 0 (README is Prettier-clean).
> - `grep -c "img.shields.io" README.md` — expected: ≥ 6 badges.
> - `grep -c "000000" README.md` — expected: ≥ 6 (all badges black).
> - Manually confirm every relative link target exists (`ls docs/TECHNICAL_SPECIFICATION.md docs/DASHBOARD.md docs/DEVELOPMENT_PLAN.md`).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P19-2 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P19-3 — Documented curl journeys (miss→hit, stampede, isolation)

- **Status:** 🔴 Not Started
- **Priority:** Medium
- **Size:** S (30–90 min)
- **Depends on:** `P19-2`

### Description

Add copy-pasteable **curl journeys** that let a reader reproduce the three headline behaviors from a terminal without the dashboard: (1) **miss → hit** (first `GET` populates the cache slowly, the second is a fast hit + the metrics counter moves), (2) **stampede collapse** (N concurrent requests → exactly 1 origin fetch + N−1 hits), and (3) **cross-namespace isolation** (seed a foreign-namespace key, flush `cache-example:*`, the foreign key survives). These live in `README.md` (or a linked `docs/` section) and make the invisible behaviors verifiable on the CLI.

### Acceptance Criteria

- [ ] A "Try it with curl" section (in `README.md` or a linked doc) with three labeled journeys.
- [ ] **Miss → hit:** two `GET /catalog/products/:id` calls showing the first as a miss (slower) and the second as a hit, plus a `GET /metrics` call showing the hit/miss counter change.
- [ ] **Stampede collapse:** a fan-out (e.g. backgrounded curls or `xargs -P`) against `POST /stampede?productId=&concurrency=&lockMs=` showing 1 origin fetch + N−1 hits, referencing the returned timeline.
- [ ] **Cross-namespace isolation:** `POST /tenants/seed-foreign` (foreign `other-app:*` key) → `DELETE /admin/namespace` (flush `cache-example:*`) → a read proving the foreign key survived.
- [ ] All commands use the documented base URL/port (API `:3001`) and real route shapes from Phases 4/5/6/10; English-only.

### Files to create / modify

- `README.md` (a "Try it with curl" section) — or a linked `docs/` page referenced from the README.

### Agent Execution Prompt

> Role: Senior backend engineer / technical writer.
> Context: Task P19-3 of `docs/DEVELOPMENT_PLAN.md` §Phase 19. The three journeys map to behaviors built in Phase 4 (read-through), Phase 10 (stampede), Phase 6 (namespace isolation). Routes and ports come from `docs/TECHNICAL_SPECIFICATION.md` §11 and the phase files; API runs on `:3001`.
> Objective: Write three reproducible curl journeys.
> Steps:
>
> 1. **Miss → hit:** show `curl -s -w '%{time_total}\n' http://localhost:3001/catalog/products/<id>` twice (first slow/miss, second fast/hit), then `curl -s http://localhost:3001/metrics | jq` to show the per-prefix hit/miss counters moving. Annotate what to look for.
> 2. **Stampede collapse:** fire N concurrent requests at `POST /stampede?productId=<id>&concurrency=10&lockMs=2000` (use a `for`/`xargs -P 10` one-liner) and show the response timeline (1 lock winner + 9 waiters → hits). Reference the resolved script SHA in the response.
> 3. **Cross-namespace isolation:** `curl -X POST .../tenants/seed-foreign` to plant an `other-app:*` key via the raw client, then `curl -X DELETE .../admin/namespace` to flush `cache-example:*`, then a read showing the foreign key survived (and a `cache-example` key did not). Label `seed-foreign` as the documented anti-pattern.
> 4. Place these under a clear "Try it with curl" heading in `README.md` (or a linked `docs/curl-journeys.md` referenced from the README). Use fenced `bash` blocks. Run `pnpm format` afterward.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions; English-only.
> - Use the **real** route shapes and query params from Phases 4/5/6/10 — do not invent endpoints.
> - Keep commands copy-pasteable (real `localhost:3001` base, `jq` optional but shown).
>   Verification:
> - `pnpm format:check` — expected: exits 0.
> - Manually confirm each curl path matches a route documented in `docs/TECHNICAL_SPECIFICATION.md` §11 / the relevant phase file.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P19-3 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P19-4 — Keep spec/dashboard/plan current; flip `OVERVIEW.md` to superseded

- **Status:** 🔴 Not Started
- **Priority:** Medium
- **Size:** S (30–90 min)
- **Depends on:** `Phases 3–14`

### Description

Reconcile the living docs with what was actually built across Phases 3–14, then retire the legacy overview. Sweep `TECHNICAL_SPECIFICATION.md`, `DASHBOARD.md`, and `DEVELOPMENT_PLAN.md` for any drift (renamed routes, env vars, behaviors) and update the spec's [§28 Status](../TECHNICAL_SPECIFICATION.md#28--status). Flip `OVERVIEW.md` to clearly mark it **superseded by `TECHNICAL_SPECIFICATION.md`** so no one treats the stale overview as source of truth.

### Acceptance Criteria

- [ ] `TECHNICAL_SPECIFICATION.md` reconciled with the shipped apps (routes/env/behaviors match Phases 3–14); [§28 Status](../TECHNICAL_SPECIFICATION.md#28--status) reflects implemented state.
- [ ] `DASHBOARD.md` reconciled with the actually-built pages/components (Phases 12–14).
- [ ] `DEVELOPMENT_PLAN.md` Progress Summary + Overall progress reflect reality (and the Appendix B / §7 linkage still holds).
- [ ] `OVERVIEW.md` carries a prominent banner at the top: "⚠️ Superseded — see [`TECHNICAL_SPECIFICATION.md`](TECHNICAL_SPECIFICATION.md)" and no longer presents itself as the source of truth.
- [ ] No broken cross-doc links; English-only.

### Files to create / modify

- `docs/TECHNICAL_SPECIFICATION.md`, `docs/DASHBOARD.md`, `docs/DEVELOPMENT_PLAN.md` — reconcile with shipped state.
- `docs/OVERVIEW.md` — superseded banner.

### Agent Execution Prompt

> Role: Senior technical writer / engineer doing a documentation reconciliation pass.
> Context: Task P19-4 of `docs/DEVELOPMENT_PLAN.md` §Phase 19. The spec (`TECHNICAL_SPECIFICATION.md`) is the source of truth; `DASHBOARD.md` is the dashboard spec; `DEVELOPMENT_PLAN.md` is the roadmap. `OVERVIEW.md` is the legacy doc that must now point at the spec. References: spec §7, §27, §28.
> Objective: Make the three living docs match what was built and retire `OVERVIEW.md`.
> Steps:
>
> 1. Diff intent vs. reality: walk Phases 3–14 deliverables against `TECHNICAL_SPECIFICATION.md` (routes, env registry, behaviors) and `DASHBOARD.md` (pages/components). Patch any drift in those docs — keep edits surgical, preserve structure.
> 2. Update spec [§28 Status](TECHNICAL_SPECIFICATION.md#28--status) to "implemented" (or the accurate state) and confirm [§27 References](TECHNICAL_SPECIFICATION.md#27--references) links still resolve.
> 3. In `DEVELOPMENT_PLAN.md`, confirm the Progress Summary table + Overall progress reflect completed phases and that the §7 ↔ Appendix B linkage is intact.
> 4. Edit `docs/OVERVIEW.md`: add a top banner blockquote — `> ⚠️ **Superseded.** This overview is kept for history; the authoritative spec is [\`TECHNICAL_SPECIFICATION.md\`](TECHNICAL_SPECIFICATION.md).` — and soften any language that claims it is the source of truth.
> 5. Run `pnpm format` so all touched docs stay Prettier-clean.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions; English-only.
> - Surgical edits only — do not rewrite whole documents; preserve existing section numbering/anchors (other docs link to them).
> - Do NOT delete `OVERVIEW.md` — mark it superseded so historical links survive.
>   Verification:
> - `pnpm format:check` — expected: exits 0.
> - `grep -i "superseded" docs/OVERVIEW.md` — expected: match near the top.
> - Spot-check that anchors referenced from `DEVELOPMENT_PLAN.md` (`#7--feature-coverage-matrix`, `#28--status`) still exist in the spec.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P19-4 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P19-5 — Document the OPTIONAL `@bymax-one/nest-logger` events bridge (row #50)

- **Status:** 🔴 Not Started
- **Priority:** Low
- **Size:** S (30–90 min)
- **Depends on:** `P19-1`, `P19-2`

### Description

Document the **optional** `@bymax-one/nest-logger` events bridge as the recommended **production pattern** for wiring `ICacheEvents.onEvent` to structured logging — this is [§7 Feature Coverage Matrix](../TECHNICAL_SPECIFICATION.md#7--feature-coverage-matrix) **row #50**. The example's own `CacheEventsBridge` (Phase 3) already routes events to the Nest `Logger`; this task documents how a real consumer would instead route them through `@bymax-one/nest-logger` for structured, correlation-aware logs. Documentation-first (the bridge is optional, not a hard dependency); the doc itself satisfies row #50 in the audit.

### Acceptance Criteria

- [ ] A documented section (in `README.md` or a linked `docs/` page) explaining the optional `@bymax-one/nest-logger` events bridge as the production pattern for `ICacheEvents.onEvent` → structured logging.
- [ ] Shows the wiring shape (how `CacheEventsBridge` would delegate to `@bymax-one/nest-logger` instead of the default Nest `Logger`), framed as copy-paste-friendly for a real consumer.
- [ ] Explicitly labels it **OPTIONAL** — the example runs without `@bymax-one/nest-logger`; this is the recommended upgrade for production.
- [ ] Cross-references [§7 Feature Coverage Matrix](../TECHNICAL_SPECIFICATION.md#7--feature-coverage-matrix) **row #50** and links the sibling `nest-logger-example`.
- [ ] Row #50 is accounted for by the export audit (P19-1) — demonstrated or ignored-with-reason; English-only.

### Files to create / modify

- `README.md` (an "Optional: structured logging via `@bymax-one/nest-logger`" section) — or a linked `docs/` page.
- `.audit-ignore.json` — only if row #50's symbol legitimately cannot be inlined (with a reason).

### Agent Execution Prompt

> Role: Senior NestJS engineer / technical writer.
> Context: Task P19-5 of `docs/DEVELOPMENT_PLAN.md` §Phase 19. This demonstrates **matrix row #50** (the optional logger bridge) — see `docs/TECHNICAL_SPECIFICATION.md` §7. The example's `CacheEventsBridge` (Phase 3, `apps/api/src/cache/cache.events.ts`) routes `ICacheEvents.onEvent` to the Nest `Logger`; the **production pattern** routes it through `@bymax-one/nest-logger` instead. The sibling `nest-logger-example` is the reference for that library.
> Objective: Document the optional `@bymax-one/nest-logger` events bridge as the production logging pattern and ensure row #50 is covered by the audit.
> Steps:
>
> 1. Add a section "Optional: structured logging via `@bymax-one/nest-logger`" to `README.md` (or `docs/logger-bridge.md` linked from the README). Explain that `@bymax-one/nest-cache` emits lifecycle/operational events via `ICacheEvents.onEvent`, and that in production you bridge those into structured logs.
> 2. Show the wiring shape: how `CacheEventsBridge` would inject the logger from `@bymax-one/nest-logger` and forward each event (level mapped from event severity, with the event payload as structured fields). Keep it copy-paste-friendly and clearly mark it OPTIONAL — the example itself uses the plain Nest `Logger` so it has no hard dependency on the logger lib.
> 3. Cross-reference matrix **row #50** in `docs/TECHNICAL_SPECIFICATION.md` §7 and link the sibling `nest-logger-example` repo for the full logger setup.
> 4. Re-run `pnpm audit:exports` (P19-1). If row #50's library symbol is demonstrated by the doc/code, great; if it genuinely cannot be inlined in this example, add a single justified entry to `.audit-ignore.json` (reason: "documented as optional production pattern; see README logger-bridge section"). Run `pnpm format`.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions; English-only.
> - The bridge is **OPTIONAL** — do not add `@bymax-one/nest-logger` as a hard runtime dependency of `apps/api`; this is a documented pattern.
> - Keep the wiring snippet faithful to the real `@bymax-one/nest-logger` API and the existing `CacheEventsBridge` shape.
>   Verification:
> - `pnpm audit:exports` — expected: exit 0 (row #50 demonstrated or ignored-with-reason).
> - `pnpm format:check` — expected: exits 0.
> - `grep -i "OPTIONAL" README.md` (or the linked doc) — expected: the section is clearly marked optional.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P19-5 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P19-6 — `CHANGELOG.md` `0.1.0` entry + design-system acceptance check

- **Status:** 🔴 Not Started
- **Priority:** Medium
- **Size:** S (30–90 min)
- **Depends on:** `P19-2`

### Description

Cut the first real `CHANGELOG.md` entry — promote `## [Unreleased]` to `## [0.1.0] — YYYY-MM-DD` summarizing the shipped reference app — and run the **design-system acceptance check**: capture a screenshot of `apps/web` and place it beside a sibling example's screenshot; the chrome (tokens, fonts, shell, orange/glass dark theme) must be **indistinguishable** (spec design-parity principle / `DASHBOARD.md` §19). This is the visual gate that the design system was copied verbatim.

### Acceptance Criteria

- [ ] `CHANGELOG.md` has a `## [0.1.0] — YYYY-MM-DD` section (Keep-a-Changelog format) summarizing the reference app under `### Added`, with `## [Unreleased]` left empty above it.
- [ ] A design-system acceptance check was performed: an `apps/web` screenshot placed beside a sibling (`nest-logger-example` / `nest-auth-example`) screenshot, confirming the chrome is indistinguishable (same tokens/fonts/shell/dark theme).
- [ ] Any chrome drift found is fixed (or filed) so the acceptance passes; the verdict is noted in the completion log line.
- [ ] English-only; `CHANGELOG.md` stays Prettier-clean.

### Files to create / modify

- `CHANGELOG.md` — `0.1.0` release entry.
- _(design-system check is a verification activity; fix `apps/web` chrome only if drift is found)_

### Agent Execution Prompt

> Role: Senior frontend engineer / release manager.
> Context: Task P19-6 of `docs/DEVELOPMENT_PLAN.md` §Phase 19. The design-parity principle requires `apps/web` to reuse the shared Bymax design system **verbatim** — "drop a screenshot beside a sibling and the chrome is indistinguishable" (see `DASHBOARD.md` §19 + `design_system.html`). The `CHANGELOG.md` was seeded in P0-7 (Keep-a-Changelog, empty `## [Unreleased]`).
> Objective: Write the `0.1.0` changelog entry and run the design-system acceptance check.
> Steps:
>
> 1. Edit `CHANGELOG.md`: add `## [0.1.0] — <today>` below an empty `## [Unreleased]`, with a concise `### Added` list summarizing the shipped reference app (read-through cache + data structures, namespaces/tenants, serialization, pub/sub, TTL events, Lua stampede, topologies/errors, the live dashboard, the export audit). Keep-a-Changelog format.
> 2. Run the **design-system acceptance check**: start the web app (`pnpm --filter web dev`, with the API up), capture a screenshot of the dashboard shell, and place it beside a sibling example's equivalent screenshot. Compare chrome: Geist fonts, forced-dark `<html>`, orange active sidebar state, glass-morphism, topbar/sidebar dimensions. They must be indistinguishable.
> 3. If you find any chrome drift, fix it in `apps/web` (the design tokens/shell were copied verbatim in Phase 12 — drift means something diverged) so the acceptance passes. Note the verdict ("indistinguishable from `nest-logger-example`") for the completion-log line.
> 4. Run `pnpm format`.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions; English-only.
> - Design system is copied **verbatim** from a sibling (Phase 12) — fix drift toward the sibling; do not redesign.
> - Keep the changelog entry concise and accurate to what shipped.
>   Verification:
> - `grep "## \[0.1.0\]" CHANGELOG.md` — expected: match.
> - `pnpm format:check` — expected: exits 0.
> - `pnpm --filter web build` — expected: succeeds (so the screenshotted app is buildable).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P19-6 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P19-7 — Final audit verification (`audit:exports` exit 0, matrix all ✅)

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** S (30–90 min)
- **Depends on:** `P19-1`, `P19-2`, `P19-3`, `P19-4`, `P19-5`, `P19-6`

### Description

Phase 19 "Definition of done" gate per `DEVELOPMENT_PLAN.md`: prove the docs+audit deliverables are complete and self-consistent. `pnpm audit:exports` must exit 0 — **every** library export is demonstrated in `apps/` or ignored-with-reason — the README's links all resolve, and the spec's [§7 Feature Coverage Matrix](../TECHNICAL_SPECIFICATION.md#7--feature-coverage-matrix) is fully ✅ (all 50 rows). This closes the phase and, with it, the whole project's coverage contract (Appendix B).

### Acceptance Criteria

- [ ] `pnpm audit:exports` exits 0 — every export of `@bymax-one/nest-cache` (`.` + `./shared`) is demonstrated in `apps/` or listed in `.audit-ignore.json` with a reason.
- [ ] Every internal link in `README.md` resolves (docs links + section anchors + the matrix link).
- [ ] The spec's [§7 Feature Coverage Matrix](../TECHNICAL_SPECIFICATION.md#7--feature-coverage-matrix) is fully ✅ — all **50** rows demonstrated (including row #50, the logger bridge, from P19-5).
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm format:check` all exit 0 across the touched docs/scripts.
- [ ] The `export-usage-check` CI job (P19-1) is green.

### Files to create / modify

- _(none — verification only; fix the relevant P19-x deliverable if a check fails)_

### Agent Execution Prompt

> Role: Senior engineer running the phase's final acceptance gate.
> Context: Task P19-7 of `docs/DEVELOPMENT_PLAN.md` §Phase 19. DoD: `pnpm audit:exports` exits 0, the README renders with working links, and the §7 coverage matrix is fully ✅. The audit is the contract that every one of the 50 Feature-Coverage-Matrix rows (Appendix B) is demonstrated. References: spec §7, §27, §28.
> Objective: Verify all Phase 19 deliverables and close the phase (and the project's coverage contract).
> Steps:
>
> 1. Run `pnpm audit:exports` (P19-1). It MUST exit 0 — every export demonstrated or ignored-with-reason. If it reports an undocumented export, that is a real gap: either demonstrate the symbol in `apps/` or add a justified `.audit-ignore.json` entry, then re-run. Do NOT lower the bar.
> 2. Verify the README: confirm every relative link target exists and every in-page anchor resolves; confirm the badges render (black `000000` flat-square) and the matrix-summary link points at `docs/TECHNICAL_SPECIFICATION.md` §7.
> 3. Open the spec's [§7 Feature Coverage Matrix](TECHNICAL_SPECIFICATION.md#7--feature-coverage-matrix) and confirm **all 50 rows** are marked ✅ — including row #50 (logger bridge, P19-5). If any row is not ✅, trace it to its owning phase and resolve before closing.
> 4. Run `pnpm lint && pnpm typecheck && pnpm format:check` — all must exit 0. Confirm the `export-usage-check` CI job passes (re-run if needed).
> 5. If any check fails, fix it in the corresponding P19-x deliverable (do NOT patch around it here), then return.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions; English-only.
> - Do NOT skip the audit, do NOT add unjustified `.audit-ignore.json` entries, do NOT `--no-verify`, do NOT lower any threshold.
> - The §7 matrix being fully ✅ is the project's completion contract — treat a non-✅ row as a real defect.
>   Verification:
> - `pnpm audit:exports` — expected: exit 0.
> - `pnpm lint` — expected: exit 0.
> - `pnpm typecheck` — expected: exit 0.
> - `pnpm format:check` — expected: exit 0.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P19-7 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

When this task is 🟢, Phase 19 is 7/7 — switch the Phase 19 row in `DEVELOPMENT_PLAN.md` Progress Summary to 🟢 Done. With P19-7 green, the whole project's [§7 Feature Coverage Matrix](../TECHNICAL_SPECIFICATION.md#7--feature-coverage-matrix) should be fully ✅ (every export demonstrated or ignored-with-reason — the Appendix B contract is satisfied).

⚠️ Never mark done with failing verification.

---

## Completion log

_(Agents append one line per finished task, newest at the bottom.)_
