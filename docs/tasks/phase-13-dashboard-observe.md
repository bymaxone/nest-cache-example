# Phase 13 — Dashboard: Observe pages — Tasks

> **Source:** [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#phase-13--dashboard-observe-pages) §Phase 13
> **Total tasks:** 8
> **Progress:** 🟢 8 / 8 done (100%)
>
> **Status legend:** 🔴 Not Started · 🟡 In Progress · 🔵 In Review · 🟢 Done · ⚪ Blocked

## Task index

| ID    | Task                                                                 | Status | Priority | Size | Depends on        |
| ----- | -------------------------------------------------------------------- | ------ | -------- | ---- | ----------------- |
| P13-1 | `components/charts/` — Recharts panel set (8 components)             | 🟢     | High     | L    | Phase 5, Phase 12 |
| P13-2 | `app/page.tsx` — Overview (golden signals + breakdowns)              | 🟢     | High     | L    | P13-1, P13-7      |
| P13-3 | `app/explorer/page.tsx` — filter rail + strategy toggle + `KeyTable` | 🟢     | High     | L    | P13-7             |
| P13-4 | `KeyDetailDrawer` — Value/Raw/TTL/Metadata + actions + flush         | 🟢     | High     | M    | P13-3             |
| P13-5 | `app/playground/page.tsx` — one card per data structure              | 🟢     | Medium   | M    | P13-7             |
| P13-6 | `app/tenants/page.tsx` — `TenantSplit` + isolation-proof flow        | 🟢     | Medium   | M    | P13-3, P13-7      |
| P13-7 | TanStack Query hooks — `useKeys` / `useMetrics` / `useInfo`          | 🟢     | High     | M    | Phase 5, Phase 12 |
| P13-8 | Phase verification (golden signals · scan · op-appears · isolation)  | 🟢     | Medium   | S    | P13-1..P13-7      |

---

## P13-1 — `components/charts/` — Recharts panel set (8 components)

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** L (half-day+)
- **Depends on:** `Phase 5`, `Phase 12`

### Description

Build the reusable chart layer the Observe pages compose: `MetricTile`, `HitRateGauge`, `HitMissArea` (brushable), `OpsStream` (streaming area + pause), `LatencyLines` (p50/p95/p99), `TypeDonut`, `MemoryByPrefix`, `ExpiryAnalysis`. Every panel is fed by a **server-side endpoint** (`GET /metrics` + `GET /admin/info` + `GET /admin/keyspace` — DASHBOARD §16) — the browser **never** SCANs the keyspace to build a chart (DASHBOARD §15 bounded-dimension rule). Charts `group by` only **data-type / key-prefix / namespace / tenant**; individual keys/ids are search-only. Library is **Recharts v3** via shadcn chart primitives. This is task P13-1; it carries the entire `components/charts/` directory referenced by Phase 13's deliverables.

### Acceptance Criteria

- [x] `components/charts/MetricTile.tsx` — stat + sparkline + Δ vs previous equal window; accessible status is **color + icon + text** (never color alone).
- [x] `components/charts/HitRateGauge.tsx` — gauge with the exact % beside it; green > 90%, amber 50–90%, red < 50% (DASHBOARD §2 principle 3).
- [x] `components/charts/HitMissArea.tsx` — stacked hit/miss **area**, **brushable** (drag sets the global time range via `nuqs`); the signature panel.
- [x] `components/charts/OpsStream.tsx` — streaming ops/sec area split by command (GET/SET/DEL) with a **pause** control (no unstoppable motion — a11y).
- [x] `components/charts/LatencyLines.tsx` — p50/p95/p99 **lines**, **µs precision**, never rounded to "0ms" (DASHBOARD §2 principle 4).
- [x] `components/charts/TypeDonut.tsx` — keys-by-type donut (string/hash/set), **click-to-filter** into the Explorer.
- [x] `components/charts/MemoryByPrefix.tsx` — horizontal bar of `MEMORY USAGE` sampled per prefix, click-to-filter.
- [x] `components/charts/ExpiryAnalysis.tsx` — % keys with vs without TTL (stacked bar / donut).
- [x] Loading state is a **skeleton**, not a spinner (DASHBOARD §2 principle 8); empty state is **action-oriented** (DASHBOARD §2 principle 9).
- [x] All chart data comes through `lib/api-client.ts` typed responses; no component fetches raw keys; each chart ships a screen-reader summary / data-table fallback.

### Files to create / modify

- `apps/web/components/charts/MetricTile.tsx`, `HitRateGauge.tsx`, `HitMissArea.tsx`, `OpsStream.tsx`, `LatencyLines.tsx`, `TypeDonut.tsx`, `MemoryByPrefix.tsx`, `ExpiryAnalysis.tsx`.
- `apps/web/components/charts/index.ts` — barrel export (optional).

### Agent Execution Prompt

> Role: Senior Next.js / React engineer building an observability dashboard.
> Context: Repo `nest-cache-example` is the reference app for `@bymax-one/nest-cache`. This is task P13-1 of `docs/DEVELOPMENT_PLAN.md` §Phase 13. The chart catalog and every panel's source/notes are specified in `docs/DASHBOARD.md` §15 (Chart & panel catalog), and the panels are composed by the Overview page in §5. The design system is fixed — read `docs/DASHBOARD.md` §19 and `docs/design_system.html` (forced dark, orange glass-morphism, Geist Sans/Mono, shadcn `new-york`); **do not invent a new visual language**.
> Objective: Produce the eight reusable chart components in `apps/web/components/charts/`, fed only by server endpoints.
> Required reading: `docs/DASHBOARD.md` §5 (Overview — panel specifics), §15 (chart catalog + the bounded-dimension rule + chart a11y note), §19 (tech stack & design system); `docs/TECHNICAL_SPECIFICATION.md` §13 (frontend data layer) + §14 (design system); `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> Steps:
>
> 1. Use **Recharts v3** via the shadcn chart primitives (`components/ui/chart.tsx` if present from Phase 12, else add it). Wrap each chart in the glass `Card` from the design system.
> 2. `MetricTile` — generic KPI tile: title (mono), big value (mono), sparkline, and a Δ badge vs the previous equal window. Status coloring is **color + icon + text** (lucide icon + label), never color alone.
> 3. `HitRateGauge` — radial gauge; thresholds green > 90% / amber 50–90% / red < 50%; render the exact percentage beside the arc with µs/decimal precision as appropriate.
> 4. `HitMissArea` — stacked area (hit green / miss amber) over the sampled buckets; make it **brushable** — dragging writes the time range to the URL via `nuqs` (the same param the global TimeRange control reads). Clicking is not required here; brushing is.
> 5. `OpsStream` — streaming area of ops/sec split into GET/SET/DEL series; include a **pause** toggle that freezes the stream (accessibility — no unstoppable motion).
> 6. `LatencyLines` — three lines p50/p95/p99; format in **ms with µs precision** (e.g. `0.412ms`); never round sub-ms to `0ms`.
> 7. `TypeDonut` / `MemoryByPrefix` / `ExpiryAnalysis` — bounded-dimension breakdowns; `TypeDonut` and `MemoryByPrefix` are **click-to-filter** (clicking a slice/bar pivots to `/explorer` with that `type`/`prefix` applied via `nuqs`).
> 8. Every chart: skeleton while loading (not a spinner), an action-oriented empty state ("No data yet — seed a key from the Playground →"), and a screen-reader summary or `<table>` fallback. Pull data exclusively through `lib/api-client.ts` typed responses (`/metrics`, `/admin/info`, `/admin/keyspace`); the component must never call `scan`/`keys`.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions (English-only, strict TS, JSDoc on exports, no `@ts-ignore`/`eslint-disable`).
> - Self-contained: do not edit `apps/api` here; consume the already-shipped endpoints from Phase 5.
> - **Bounded-dimension rule:** chart `group by` is only data-type / key-prefix / namespace / tenant — never per-key (unbounded cardinality).
> - Charts are fed by server endpoints — the browser must never SCAN to build a chart.
>   Verification:
> - `pnpm --filter web typecheck` — expected: exit 0.
> - `pnpm --filter web lint` — expected: exit 0.
> - `pnpm --filter web build` — expected: succeeds (the chart modules compile and tree-shake; no `@bymax-one/nest-cache` runtime / `ioredis` in the client bundle).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P13-1 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

If phase reaches 100%, switch its row status in `DEVELOPMENT_PLAN.md` to 🟢.

⚠️ Never mark done with failing verification.

---

## P13-2 — `app/page.tsx` — Overview (golden signals + breakdowns)

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** L (half-day+)
- **Depends on:** `P13-1`, `P13-7`

### Description

The landing page (`/`): a strict top-left-first, general→specific layout of the **cache golden signals** and bounded-dimension breakdowns (DASHBOARD §5). Five sections top-to-bottom: a **health strip** (hit-rate gauge, ops/sec, latency p95, memory bullet, keys, expired), the signature **hit/miss area** (brushable), a **throughput & latency row**, a **keyspace breakdown** (type donut + memory-by-prefix + expiry analysis + top prefixes), and a **connection & pipeline health** band. Every breakdown is **click-to-filter** into the Explorer; the timeseries panels are **brushable** (drag sets the global time range). All fed by `/metrics` + `/admin/info` + `/admin/keyspace` via the P13-7 hooks.

### Acceptance Criteria

- [x] `app/page.tsx` renders the **health strip**: six golden-signal tiles — hit-rate **gauge**, throughput (ops/sec), latency **p95**, memory **bullet/gauge** (`used_memory` vs `maxmemory`), keys-in-namespace (+Δ), expired/evicted — each with a sparkline.
- [x] **Hit / miss over time** stacked area is present, **brushable**, and writes the time range to the URL (`nuqs`).
- [x] **Throughput & latency row**: `OpsStream` (with pause) left, `LatencyLines` (p50/p95/p99, µs precision) right.
- [x] **Keyspace breakdown**: `TypeDonut`, `MemoryByPrefix`, `ExpiryAnalysis`, and a top-prefixes bar — each **click-to-filter** into `/explorer`.
- [x] **Connection & pipeline health** band: status (color + icon + text), mode, uptime, connected clients, fragmentation ratio, `evicted_keys`, `expired_keys` — sourced from `/admin/info`.
- [x] A `🎓` scoped-demo callout explains the two metric sources (app per-prefix counters + Redis `INFO`) per DASHBOARD §5 / §17.3.
- [x] Page uses skeletons (not spinners) while loading and the `max-w-7xl` chart-heavy width from the design system shell.

### Files to create / modify

- `apps/web/app/page.tsx` — the Overview page.
- `apps/web/components/charts/*` — consumed (from P13-1); add a small `HealthStrip`/section wrapper under `components/charts/` or `app/(overview)/` if helpful.

### Agent Execution Prompt

> Role: Senior Next.js / React engineer building an observability dashboard.
> Context: Task P13-2 of `docs/DEVELOPMENT_PLAN.md` §Phase 13. The full Overview layout (ASCII wireframe + panel specifics) is in `docs/DASHBOARD.md` §5; the per-panel source/type table is §15. The page composes the charts from P13-1 and reads data via the hooks from P13-7. Design system is fixed (DASHBOARD §19 / `design_system.html`).
> Objective: Build `apps/web/app/page.tsx` — the cache-health Overview.
> Required reading: `docs/DASHBOARD.md` §5 (Overview), §15 (catalog), §16 (backing API — `/metrics`, `/admin/info`, `/admin/keyspace`), §17 (reading Redis, the two metric sources); `docs/TECHNICAL_SPECIFICATION.md` §13.1–§13.2; `docs/DEVELOPMENT_PLAN.md` §2.
> Steps:
>
> 1. Lay the page out exactly in the §5 order: health strip → hit/miss area → throughput+latency row → keyspace breakdown → connection/pipeline health. Use the glass `Card` + `max-w-7xl` chart-heavy width.
> 2. Health strip: compose six `MetricTile`/`HitRateGauge` instances. Hit rate = gauge with thresholds; memory = bullet of `used_memory`/`maxmemory`; the rest are stat + sparkline + Δ vs previous equal window.
> 3. Wire `HitMissArea`, `OpsStream`, `LatencyLines`, `TypeDonut`, `MemoryByPrefix`, `ExpiryAnalysis` and a top-prefixes bar from `components/charts/`. Make every breakdown **click-to-filter** (navigate to `/explorer` with the chosen `type`/`prefix` in the URL) and the hit/miss + ops panels **brushable**/streaming.
> 4. Connection/pipeline band: read `/admin/info` and render status (color + icon + text via `lib/cache-status.ts`), mode, uptime, clients, `mem_fragmentation_ratio`, `evicted_keys`, `expired_keys`.
> 5. Add the `🎓` callout from §5 ("hit/miss tracked in-process per prefix … cross-checked against Redis `INFO stats` … a real deployment scrapes `INFO` with Prometheus + Grafana") — honest about scope.
> 6. Read all data through the P13-7 hooks (`useMetrics`, `useInfo`); never SCAN from the browser. Use skeletons while loading and action-oriented empty states.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - Self-contained: consume Phase 5 endpoints and P13-1 charts + P13-7 hooks; do not modify `apps/api`.
> - Charts are fed by server endpoints; the browser never SCANs for charts; bounded dimensions only.
>   Verification:
> - `pnpm --filter web typecheck` — expected: exit 0.
> - `pnpm --filter web lint` — expected: exit 0.
> - `pnpm --filter web build` — expected: succeeds; visiting `/` against a running API + seeded Redis renders the golden-signal strip with live values (no NaN/"0ms" for sub-ms latency).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P13-2 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

If phase reaches 100%, switch its row status in `DEVELOPMENT_PLAN.md` to 🟢.

⚠️ Never mark done with failing verification.

---

## P13-3 — `app/explorer/page.tsx` — filter rail + strategy toggle + `KeyTable`

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** L (half-day+)
- **Depends on:** `P13-7`

### Description

The daily-driver Key Explorer (`/explorer`) — a namespace key browser modeled on RedisInsight's Browser (DASHBOARD §6). A **filter rail** (prefix / type / ttl facets, with the global tenant scoping the default prefix), a **scan/keys strategy toggle** (the teaching control — `scan` is default and non-blocking; `keys` carries a persistent **⚠ O(N) — blocks the server, dev-only** warning), and a **virtualized `KeyTable`** (TanStack Table + TanStack Virtual) with columns `key` (mono) / `type` (chip) / `ttl` (a custom-SVG **draining ring** + `mm:ss`, `∞` persisted, `—` none) / `size` (lazy `MEMORY USAGE`). All filters and the strategy live in the **URL** via `nuqs` (shareable deep-links). The resolved `KeyBuilder` pattern (`cache-example:product:*`) is shown so namespacing is tangible. In **cluster mode** both strategies are disabled with an `UNSUPPORTED_IN_CLUSTER` callout.

### Acceptance Criteria

- [x] `app/explorer/page.tsx` with a filter rail: `prefix`, `type` (string/hash/set), `ttl` (has-TTL / no-TTL) facets; the active tenant scopes the default prefix to `tenant:{id}:*`.
- [x] **Scan/keys toggle** defaults to `scan` (cursor-based, non-blocking, infinite-scroll); selecting `keys` shows a persistent **⚠ O(N) blocks-the-server, dev-only** badge.
- [x] The resolved match pattern from `KeyBuilder` (e.g. `cache-example:product:*`) is displayed.
- [x] `components/explorer/KeyTable.tsx` — **virtualized** (TanStack Table + Virtual) with columns `key` / `type` / `ttl` (draining ring + label) / `size`; newest-first; cursor-paged via the `useKeys` infinite query.
- [x] The **TTL ring** is a **custom SVG** radial component (shared with TTL Live's `TtlRing` shape), not a chart library widget.
- [x] All filters + strategy + tenant are persisted in the URL via `nuqs`; the view is a copy-paste deep-link.
- [x] Cluster mode disables both strategies with an `UNSUPPORTED_IN_CLUSTER` callout; loading shows skeleton rows; empty state is action-oriented ("No keys in this namespace yet — seed one from the Playground →").
- [x] `size` column fetches `MEMORY USAGE` **lazily / on demand**, not for every row up front.

### Files to create / modify

- `apps/web/app/explorer/page.tsx` — the Explorer page (rail + toggle + table host).
- `apps/web/components/explorer/KeyTable.tsx` — virtualized key table with the TTL-ring column.
- `apps/web/components/explorer/FilterRail.tsx`, `ScanStrategyToggle.tsx`, `TtlRing.tsx` (or shared from `components/realtime/` if it lands first).

### Agent Execution Prompt

> Role: Senior Next.js / React engineer building a Redis key browser.
> Context: Task P13-3 of `docs/DEVELOPMENT_PLAN.md` §Phase 13. The Explorer layout, filter rail, the scan/keys teaching toggle, and the table columns are specified in `docs/DASHBOARD.md` §6, with the backing endpoint (`GET /admin/keys`, the `KeyQuery` DTO, the SCAN cursor) in §16 and the key model in §17.1. Design system fixed (DASHBOARD §19 / `design_system.html`).
> Objective: Build `apps/web/app/explorer/page.tsx` + the `KeyTable` and filter/toggle/TTL-ring components.
> Required reading: `docs/DASHBOARD.md` §6 (Key Explorer), §16 (backing API + `KeyQuery` DTO), §17.1 (key model — namespaced via `KeyBuilder`); §15 (TTL countdown ring row); `docs/TECHNICAL_SPECIFICATION.md` §13.1 (data layer) + §13.3 (signature components — `TtlRing`); `docs/DEVELOPMENT_PLAN.md` §2.
> Steps:
>
> 1. Filter rail (`prefix` / `type` / `ttl` facets) and the strategy toggle — bind every facet + `strategy` + `tenant` to the URL via `nuqs` typed params (matching the `KeyQuery` shape: `prefix`, `pattern`, `tenant`, `type`, `hasTtl`, `strategy`, `cursor`, `limit`).
> 2. Default `strategy` = `scan`. When `keys` is selected, render a persistent warning badge **⚠ "O(N) — blocks the server, dev only"** (color + icon + text). In cluster mode, disable both with the `UNSUPPORTED_IN_CLUSTER` callout.
> 3. Show the resolved `KeyBuilder` match pattern (the API returns it, or compose the display string `cache-example:{tenant?}:{prefix}:*`) so namespacing is tangible.
> 4. `KeyTable` — virtualize rows with TanStack Table + TanStack Virtual; columns `key` (mono), `type` (chip), `ttl` (a **custom SVG `TtlRing`** + `mm:ss` / `∞` / `—`), `size`. Drive paging with the `useKeys` `useInfiniteQuery` over the SCAN cursor (P13-7); infinite-scroll loads the next page.
> 5. `size` (`MEMORY USAGE`) is fetched **lazily** per row (on demand / on viewport), never eagerly for the whole list.
> 6. Skeleton rows while loading; action-oriented empty state with a link to `/playground`. Row click opens the `KeyDetailDrawer` (built in P13-4) — wire the click handler / selected-key state here.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - Self-contained: consume `GET /admin/keys` from Phase 5 via the P13-7 hook; do not modify `apps/api`.
> - The TTL ring is a **custom SVG** (not Recharts); the browser reads keys via `lib/api-client.ts` (typed), never ioredis.
> - Deep-link filters via `nuqs`; skeletons not spinners; accessible status color + icon + text.
>   Verification:
> - `pnpm --filter web typecheck` — expected: exit 0.
> - `pnpm --filter web lint` — expected: exit 0.
> - `pnpm --filter web build` — expected: succeeds; against a seeded Redis, `/explorer?strategy=scan` lists fully-namespaced keys (`cache-example:…`) with draining TTL rings and infinite-scrolls the SCAN cursor.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P13-3 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

If phase reaches 100%, switch its row status in `DEVELOPMENT_PLAN.md` to 🟢.

⚠️ Never mark done with failing verification.

---

## P13-4 — `KeyDetailDrawer` — Value/Raw/TTL/Metadata + actions + flush

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** M (half-day)
- **Depends on:** `P13-3`

### Description

The Explorer's value inspector — a drawer that opens on row click with four tabs (DASHBOARD §6): **Value** (deserialized `get`/`hgetall`/`smembers` by type, in a collapsible `@uiw/react-json-view` tree), **Raw** (the raw stored string via `getRaw` — the serializer story), **TTL** (a live countdown ring + **[Extend +60s]** `expire` and **[Persist ∞]** `persist`), and **Metadata** (type / encoding / byte size via `MEMORY USAGE` / composed key segments). Row/drawer actions: copy key, copy value, refresh, **delete** (`del`), **persist**. A namespace-level **[Flush namespace]** button sits in the **page header**, guarded — it calls `flushNamespace()` and surfaces the production guard (`403 cache.flush_disabled_in_production`) when the API runs in production (DASHBOARD §6, spec §13). Mutations invalidate the relevant queries (P13-7). Pin a stable `@uiw/react-json-view` version (its `2.x` line is still alpha as of June 2026 — the `1.x` releases are stable).

### Acceptance Criteria

- [x] `components/explorer/KeyDetailDrawer.tsx` opens on row click with four tabs: **Value**, **Raw**, **TTL**, **Metadata**.
- [x] **Value** tab renders the deserialized value (chosen by type: `get` / `hgetall` / `smembers`) in a collapsible **`@uiw/react-json-view`** tree.
- [x] **Raw** tab shows the raw stored string (`getRaw`) — the bytes Redis holds.
- [x] **TTL** tab shows a live countdown ring + **[Extend +60s]** (`POST …/expire`) and **[Persist ∞]** (`POST …/persist`).
- [x] **Metadata** tab shows type, encoding, byte size (`MEMORY USAGE`), and the key's composed segments.
- [x] Actions present: copy key, copy value, refresh, **delete** (`DELETE /admin/keys/:key`), persist — each mutation **invalidates** the keys/detail queries on success and toasts via `sonner`.
- [x] A guarded **[Flush namespace]** button in the **page header** calls `DELETE /admin/namespace`; when the API is in production it renders the `403 cache.flush_disabled_in_production` structured error (color + icon + text by severity).
- [x] Drawer actions show a spinner only for the short blocking submit; lists re-render from invalidation, not optimistic guesswork on TTL expiry.

### Files to create / modify

- `apps/web/components/explorer/KeyDetailDrawer.tsx` — the tabbed drawer + actions.
- `apps/web/components/explorer/FlushNamespaceButton.tsx` — guarded header action.
- `apps/web/app/explorer/page.tsx` — mount the drawer + header flush button (modify).

### Agent Execution Prompt

> Role: Senior Next.js / React engineer building a key inspector.
> Context: Task P13-4 of `docs/DEVELOPMENT_PLAN.md` §Phase 13. The drawer tabs, the per-type value reads, the TTL actions, and the guarded namespace flush are specified in `docs/DASHBOARD.md` §6 (Detail drawer + page-header flush) with the backing routes in §16 (`GET /admin/keys/:key`, `DELETE /admin/keys/:key`, `POST …/persist|/expire`, `DELETE /admin/namespace`). Error codes are typed via `@bymax-one/nest-cache/shared` (spec §13.1). Design system fixed.
> Objective: Build `KeyDetailDrawer` (four tabs + actions) and the guarded header **Flush namespace** button.
> Required reading: `docs/DASHBOARD.md` §6 (drawer + actions + flush guard), §16 (routes); `docs/TECHNICAL_SPECIFICATION.md` §13.1 (api-client error union keyed by `CacheErrorCode`) + §13.3 (signature components); `docs/DEVELOPMENT_PLAN.md` §2.
> Steps:
>
> 1. Build the drawer (shadcn `Sheet`/`Dialog`) opened by the selected-key state from P13-3, with tabs Value / Raw / TTL / Metadata.
> 2. Value tab: fetch the inspected key (`GET /admin/keys/:key`) and render the decoded value with **`@uiw/react-json-view`** (collapsible). Raw tab: show the `getRaw` string. Metadata tab: type / encoding / byte size / composed segments.
> 3. TTL tab: a live countdown ring (reuse the custom-SVG `TtlRing`) + **[Extend +60s]** (`POST …/expire`) and **[Persist ∞]** (`POST …/persist`). On reaching zero, wait for the next refresh/event — do not optimistically delete the row.
> 4. Wire actions copy key / copy value / refresh / **delete** (`DELETE /admin/keys/:key`) / persist; each mutation calls `queryClient.invalidateQueries` for the keys + detail queries and toasts the result via `sonner`.
> 5. Add the **[Flush namespace]** button to the Explorer **page header**, guarded: it calls `DELETE /admin/namespace`; type the response through the `lib/api-client.ts` error union and, on `403 cache.flush_disabled_in_production`, render the structured `{ error: { code, message, details } }` body with the severity palette (4xx amber) — color + icon + text.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - Self-contained: consume Phase 5 routes; do not modify `apps/api`.
> - Error codes are imported/typed from `@bymax-one/nest-cache/shared`; no raw ioredis in the browser.
> - Skeletons/loading not spinners (except the short action submit); accessible status color + icon + text.
>   Verification:
> - `pnpm --filter web typecheck` — expected: exit 0.
> - `pnpm --filter web lint` — expected: exit 0.
> - `pnpm --filter web build` — expected: succeeds; clicking a row opens the drawer, the four tabs render, delete/persist/extend mutate + invalidate (the list reflects the change), and Flush shows the guarded 403 body when the API is in production.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P13-4 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

If phase reaches 100%, switch its row status in `DEVELOPMENT_PLAN.md` to 🟢.

⚠️ Never mark done with failing verification.

---

## P13-5 — `app/playground/page.tsx` — one card per data structure

- **Status:** 🟢 Done
- **Priority:** Medium
- **Size:** M (half-day)
- **Depends on:** `P13-7`, `Phase 4`

### Description

The "fire every cache operation by hand" page (`/playground`, DASHBOARD §7) — one card per Redis data structure (**strings · numerics · hashes · sets · batch**), each mapping 1:1 to a `CacheService` group and hitting the catalog / counters / collections endpoints (DASHBOARD §16). Inputs are typed; results render as a JSON tree or a scalar badge; every fired op toasts (`sonner`) the op + result and offers **"View in Explorer →"** pre-filtered to the resulting key. A small **"resulting key"** line shows the `KeyBuilder` output (`cache-example:product:99`) for every op. Honest labels: the Sets card notes members are **raw strings** (serializer intentionally not applied); the Strings card's `getRaw` shows the serialized string beside `get`'s decoded value.

### Acceptance Criteria

- [x] `app/playground/page.tsx` with five cards: **Strings** (`get`/`set`/`setNx`/`getRaw`/`exists`), **Numerics** (`incr`/`incr +N`/`decr`), **Hashes** (`hset`/`hget`/`hgetall`/`hdel`), **Sets** (`sadd`/`srem`/`sismember`/`smembers`/`scard`), **Batch** (`mget`/`mset`).
- [x] Each card hits the relevant endpoint group (`/catalog/*`, `/counters/*`, `/collections/*`) via typed `lib/api-client.ts` calls.
- [x] Results render as a `@uiw/react-json-view` tree or a scalar badge; every op toasts via `sonner` with a **"View in Explorer →"** action linking to `/explorer` pre-filtered to the resulting key (URL params via `nuqs`).
- [x] A **"resulting key"** line shows the `KeyBuilder` output for each op (e.g. `cache-example:product:99`).
- [x] Honest labels present: Sets card — "raw string members; serializer intentionally not applied"; Strings card shows `getRaw` (serialized) beside `get` (decoded).
- [x] Loading uses skeletons; the short op submit may show a spinner; empty/initial state is action-oriented.

### Files to create / modify

- `apps/web/app/playground/page.tsx` — the Playground page.
- `apps/web/components/playground/StringsCard.tsx`, `NumericsCard.tsx`, `HashCard.tsx`, `SetCard.tsx`, `BatchCard.tsx`.

### Agent Execution Prompt

> Role: Senior Next.js / React engineer.
> Context: Task P13-5 of `docs/DEVELOPMENT_PLAN.md` §Phase 13. The Playground cards (one per data structure, the exact ops, the honest labels, the "View in Explorer →" / "resulting key" affordances) are specified in `docs/DASHBOARD.md` §7, with the backing endpoint groups in §16 (`/catalog/*`, `/counters/*`, `/collections/*`). Design system fixed.
> Objective: Build `apps/web/app/playground/page.tsx` + the five data-structure cards.
> Required reading: `docs/DASHBOARD.md` §7 (Playground — specifics + honest labels), §16 (Playground ops endpoints), §17.1 (key model); `docs/TECHNICAL_SPECIFICATION.md` §13.1; `docs/DEVELOPMENT_PLAN.md` §2.
> Steps:
>
> 1. One glass `Card` per structure (Strings / Numerics / Hashes / Sets / Batch); typed inputs; map each button 1:1 to a `CacheService` op via the catalog/counters/collections endpoints through `lib/api-client.ts`.
> 2. Render results as a `@uiw/react-json-view` tree (objects/arrays) or a scalar `Badge` (counters, `scard`, `exists`).
> 3. After each op, toast via `sonner` with the op + result and a **"View in Explorer →"** action that navigates to `/explorer` with the resulting key pre-filtered (write the `prefix`/`pattern`/`type` URL params via `nuqs`).
> 4. Show a "resulting key" line per op using the `KeyBuilder` output the API returns (or compose the display string) — reinforcing namespacing.
> 5. Add the honest labels: Sets — raw string members (serializer not applied); Strings — `getRaw` (serialized) beside `get` (decoded).
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - Self-contained: consume Phase 4's domain endpoints via the API; do not modify `apps/api`.
> - The browser calls the API via `lib/api-client.ts` (typed); error codes from `@bymax-one/nest-cache/shared`; no raw ioredis.
> - Skeletons not spinners for fetches; accessible status color + icon + text.
>   Verification:
> - `pnpm --filter web typecheck` — expected: exit 0.
> - `pnpm --filter web lint` — expected: exit 0.
> - `pnpm --filter web build` — expected: succeeds; firing an op against a running API returns a typed result and the "View in Explorer →" link lands on a pre-filtered `/explorer`.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P13-5 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

If phase reaches 100%, switch its row status in `DEVELOPMENT_PLAN.md` to 🟢.

⚠️ Never mark done with failing verification.

---

## P13-6 — `app/tenants/page.tsx` — `TenantSplit` + isolation-proof flow

- **Status:** 🟢 Done
- **Priority:** Medium
- **Size:** M (half-day)
- **Depends on:** `P13-3`, `P13-7`

### Description

Proves the two isolation stories honestly (DASHBOARD §8, spec §12.3–§12.4): in-namespace **per-tenant prefix** scoping, and app-level **namespace** isolation. A **`TenantSplit`** of two side-by-side panels (e.g. `acme` / `globex`), each with key count, hit %, **[Seed 10]**, a small key list, and **[Clear this tenant]** (`scan('tenant:{id}', '*')` → `delMany`, leaving the other tenant intact). An **isolation-proof** band: **[Seed foreign namespace]** writes `other-app:demo` via `getClient()` (raw, un-namespaced — the documented anti-pattern, labelled as such) and **[Flush namespace]** runs `flushNamespace()`; the result line shows the `cache-example:*` keys gone and the foreign key **surviving**. A callout restates the design honesty ("`namespace` is fixed per instance; tenants are prefixes …").

### Acceptance Criteria

- [x] `app/tenants/page.tsx` renders a **`TenantSplit`** of two panels; each shows prefix (`tenant:{id}:product`), key count, hit %, **[Seed 10]**, a key list, and **[Clear this tenant]**.
- [x] "Clear this tenant" calls the tenants endpoint (`scan` + `delMany` server-side) and visibly leaves the **other** tenant's keys intact on screen.
- [x] **Isolation proof** band: **[Seed FOREIGN namespace]** (writes `other-app:*` via raw `getClient()`, labelled the documented anti-pattern) and **[Flush namespace]** (`flushNamespace()`, guarded).
- [x] The result line shows the `cache-example:*` keys cleared **and** the `other-app:*` key SURVIVED (color + icon + text).
- [x] A callout restates the honesty: namespace is fixed per instance; tenants are prefixes; production "namespace per tenant" = one instance per tenant with `namespace` from env (spec §12.4).
- [x] Mutations invalidate the per-tenant key queries; loading uses skeletons; empty panels are action-oriented.

### Files to create / modify

- `apps/web/app/tenants/page.tsx` — the Tenants page.
- `apps/web/components/tenants/TenantSplit.tsx`, `TenantPanel.tsx`, `IsolationProof.tsx`.

### Agent Execution Prompt

> Role: Senior Next.js / React engineer.
> Context: Task P13-6 of `docs/DEVELOPMENT_PLAN.md` §Phase 13. The Tenants layout (`TenantSplit`, per-tenant clear, the isolation-proof seed-foreign / flush flow, the honesty callout) is specified in `docs/DASHBOARD.md` §8, with the backing routes in §16 (`GET/DELETE /tenants/*`, `DELETE /admin/namespace`) and the design rationale in spec §12.3–§12.4. Design system fixed.
> Objective: Build `apps/web/app/tenants/page.tsx` + `TenantSplit`/`TenantPanel`/`IsolationProof`.
> Required reading: `docs/DASHBOARD.md` §8 (Namespace & Tenants), §16 (tenants routes + namespace flush); `docs/TECHNICAL_SPECIFICATION.md` §12.3–§12.4 (isolation model) + §13.1; `docs/DEVELOPMENT_PLAN.md` §2.
> Steps:
>
> 1. `TenantSplit` — two `TenantPanel`s side by side (active tenant from the global control plus a second comparison tenant). Each panel: prefix, key count, hit %, **[Seed 10]**, key list, **[Clear this tenant]**.
> 2. "Clear this tenant" → the tenants endpoint (server runs `scan('tenant:{id}','*')` → `delMany`); after success, invalidate that tenant's keys query and confirm on screen that the **other** panel is unchanged (prefix-scoping proof).
> 3. `IsolationProof` band: **[Seed FOREIGN namespace]** posts to the tenants/foreign endpoint that writes `other-app:demo` via raw `getClient()` — label it the documented anti-pattern. **[Flush namespace]** calls `DELETE /admin/namespace` (`flushNamespace()`, guarded).
> 4. Render the result line: `✓ cleared N keys under cache-example` **and** `✓ other-app:demo SURVIVED` — color + icon + text, proving the namespace boundary.
> 5. Add the honesty callout verbatim-in-spirit from §8 / spec §12.4.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - Self-contained: consume Phase 6 / Phase 5 tenants + namespace routes; do not modify `apps/api`.
> - The browser calls the API via `lib/api-client.ts` (typed); error codes from `@bymax-one/nest-cache/shared`.
> - Skeletons not spinners; accessible status color + icon + text.
>   Verification:
> - `pnpm --filter web typecheck` — expected: exit 0.
> - `pnpm --filter web lint` — expected: exit 0.
> - `pnpm --filter web build` — expected: succeeds; against a running API, seeding both tenants then clearing tenant A leaves tenant B's keys on screen, and the flush result shows the foreign `other-app:*` key surviving.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P13-6 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

If phase reaches 100%, switch its row status in `DEVELOPMENT_PLAN.md` to 🟢.

⚠️ Never mark done with failing verification.

---

## P13-7 — TanStack Query hooks — `useKeys` / `useMetrics` / `useInfo`

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** M (half-day)
- **Depends on:** `Phase 5`, `Phase 12`

### Description

The server-state layer the Observe pages share (spec §13.1): TanStack Query v5 hooks — **`useKeys`** (a `useInfiniteQuery` over the SCAN cursor returned by `GET /admin/keys`), **`useMetrics`** (`GET /metrics` — hit/miss + ops series, time-range aware), and **`useInfo`** (`GET /admin/info` — parsed Redis `INFO`), plus the write **mutations** (seed, delete, persist, expire, flush, tenant clear) that call `queryClient.invalidateQueries` on success. All reads go through `lib/api-client.ts` (typed; error union keyed by `CacheErrorCode` from `@bymax-one/nest-cache/shared`). No `useEffect`+fetch, no axios (Bymax Next.js conventions, spec §13.1).

### Acceptance Criteria

- [x] `hooks/use-keys.ts` — `useKeys(query)` is a **`useInfiniteQuery`** whose `getNextPageParam` reads the opaque SCAN `cursor` from `GET /admin/keys`; stops when the cursor is exhausted.
- [x] `hooks/use-metrics.ts` — `useMetrics(range)` reads `GET /metrics` (hit/miss + ops series), keyed by the URL time range; suitable polling/`refetchInterval` for the streaming panels.
- [x] `hooks/use-info.ts` — `useInfo(section?)` reads `GET /admin/info` (parsed `INFO` key/value record).
- [x] Write hooks (`useSeed`, `useDeleteKey`, `usePersistKey`, `useExpireKey`, `useFlushNamespace`, `useClearTenant`) are `useMutation`s that **invalidate** the relevant query keys on success.
- [x] All hooks call `lib/api-client.ts`; the error type is the discriminated union keyed by `CacheErrorCode` (from `./shared`). No component uses `useEffect`+`fetch`; no `axios`.
- [x] Query keys are stable + namespaced (e.g. `['keys', query]`, `['metrics', range]`, `['info', section]`) so invalidation is precise.

### Files to create / modify

- `apps/web/hooks/use-keys.ts`, `use-metrics.ts`, `use-info.ts` — read hooks.
- `apps/web/hooks/use-cache-mutations.ts` (or per-file) — the write mutations with invalidation.
- `apps/web/lib/api-client.ts` — extend with the typed `/admin/keys`, `/metrics`, `/admin/info` calls if not already present (modify; do not change its error-union contract).

### Agent Execution Prompt

> Role: Senior Next.js / React engineer (TanStack Query v5).
> Context: Task P13-7 of `docs/DEVELOPMENT_PLAN.md` §Phase 13. The data layer is defined in `docs/TECHNICAL_SPECIFICATION.md` §13.1 (TanStack Query for reads, `useMutation` + `invalidateQueries` for writes, `lib/api-client.ts` typed transport, error union keyed by `CacheErrorCode` from the `/shared` subpath, **no `useEffect`+fetch, no axios**); the endpoints + the `KeyQuery`/SCAN-cursor contract are in `docs/DASHBOARD.md` §16.
> Objective: Build the shared read hooks (`useKeys`/`useMetrics`/`useInfo`) and the write mutations that invalidate.
> Required reading: `docs/TECHNICAL_SPECIFICATION.md` §13.1 (data layer); `docs/DASHBOARD.md` §16 (backing API + `KeyQuery` DTO + SCAN cursor), §17.2 (`INFO` fields the dashboard reads), §17.3 (metrics sources); `docs/DEVELOPMENT_PLAN.md` §2.
> Steps:
>
> 1. `useKeys(query: KeyQuery)` — `useInfiniteQuery`; the page fetcher calls `GET /admin/keys?…&cursor=…`; `getNextPageParam` returns the response's opaque `cursor` until it's exhausted (then `undefined`). Flatten pages for the table.
> 2. `useMetrics(range)` — `useQuery` over `GET /metrics`, keyed by the URL time range; set a sensible `refetchInterval` so the streaming ops panel updates (the OpsStream pause is a UI concern, not a query concern).
> 3. `useInfo(section?)` — `useQuery` over `GET /admin/info?section=`, returning the parsed key/value record.
> 4. Mutations: `useSeed`, `useDeleteKey`, `usePersistKey`, `useExpireKey`, `useFlushNamespace`, `useClearTenant` — each a `useMutation` calling the matching `lib/api-client.ts` method and, in `onSuccess`, `queryClient.invalidateQueries` for the affected keys (`['keys', …]`, `['info']`, `['metrics']` as appropriate).
> 5. Extend `lib/api-client.ts` with the typed calls if missing, preserving its `ApiError` union keyed by `CacheErrorCode` (imported from `@bymax-one/nest-cache/shared`). Do not introduce `axios` or `useEffect`-based fetching.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions (strict TS, JSDoc on exported hooks, English-only).
> - Self-contained: consume Phase 5 endpoints; do not modify `apps/api`.
> - Reads via TanStack Query; live data uses the socket (Phase 14), not these hooks; error codes typed from `./shared`.
>   Verification:
> - `pnpm --filter web typecheck` — expected: exit 0.
> - `pnpm --filter web lint` — expected: exit 0.
> - `pnpm --filter web build` — expected: succeeds; `useKeys` paginates the SCAN cursor and a delete mutation invalidates `['keys']` (the Explorer list updates without a manual refresh).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P13-7 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

If phase reaches 100%, switch its row status in `DEVELOPMENT_PLAN.md` to 🟢.

⚠️ Never mark done with failing verification.

---

## P13-8 — Phase verification (golden signals · scan · op-appears · isolation)

- **Status:** 🟢 Done
- **Priority:** Medium
- **Size:** S (30–90 min)
- **Depends on:** `P13-1`, `P13-2`, `P13-3`, `P13-4`, `P13-5`, `P13-6`, `P13-7`

### Description

Phase 13 "Definition of done" gate per `DEVELOPMENT_PLAN.md`: with `apps/api` + Redis running and the namespace seeded, prove the four Observe pages work end-to-end — the **Overview renders live golden signals**, an **Explorer scan lists namespaced keys with draining TTL rings**, a **Playground op appears in the Explorer**, and **clearing tenant A leaves tenant B intact on screen**. Confirms the UI for Feature-Coverage-Matrix rows **#13–#27, #29, #36** plus the breakdown panels (spec §7). Closes the phase.

### Acceptance Criteria

- [x] `pnpm --filter web typecheck` / `lint` / `build` all exit 0.
- [x] **Overview** (`/`) renders the golden-signal strip with live values (hit-rate gauge, ops/sec, p95 latency in µs precision, memory bullet, keys, expired) plus the hit/miss area and the keyspace breakdown.
- [x] **Explorer** (`/explorer?strategy=scan`) lists fully-namespaced keys (`cache-example:…`) with draining custom-SVG TTL rings; infinite-scroll pages the SCAN cursor; selecting `keys` shows the O(N) warning.
- [x] A **Playground** op (e.g. `set product:99`) then "View in Explorer →" shows the new key in the Explorer.
- [x] On **Tenants**, seeding both tenants then **Clear tenant A** visibly leaves tenant B's keys; the isolation-proof flush shows the foreign `other-app:*` key surviving.
- [x] Charts are confirmed fed by `/metrics` + `/admin/info` + `/admin/keyspace` (no browser SCAN for any chart); filters/time-range are deep-linkable via the URL.

### Files to create / modify

- _(none — verification only; fix earlier task files if a check fails)_

### Agent Execution Prompt

> Role: Senior Next.js / React engineer.
> Context: Task P13-8 of `docs/DEVELOPMENT_PLAN.md` §Phase 13. DoD: Overview renders live golden signals; an Explorer scan lists namespaced keys with draining TTL rings; a Playground op appears in the Explorer; clearing tenant A leaves B intact on screen. This phase delivers the UI for Feature-Coverage-Matrix rows #13–#27, #29, #36 + the breakdown panels (spec §7).
> Objective: Verify the four Observe pages end-to-end and close the phase.
> Required reading: `docs/DEVELOPMENT_PLAN.md` §Phase 13 (Definition of done) + §2; `docs/DASHBOARD.md` §5–§8 + §15; `docs/TECHNICAL_SPECIFICATION.md` §7 (Feature Coverage Matrix) + §13.
> Steps:
>
> 1. Bring up infra + API + seeded keys: `pnpm infra:up`, start `apps/api`, seed via `POST /admin/seed?count=N` (or the Playground). Run `pnpm --filter web build` and start `apps/web`.
> 2. `/` — confirm the golden-signal strip shows live values (no NaN; sub-ms latency rendered as `0.xxxms`, never `0ms`), the hit/miss area is brushable, and the type-donut / memory-by-prefix / expiry panels render and click-through to `/explorer`.
> 3. `/explorer?strategy=scan` — confirm namespaced keys list with draining TTL rings, infinite-scroll advances the SCAN cursor, the drawer opens with all four tabs, and toggling `keys` shows the O(N) warning.
> 4. `/playground` — fire `set product:99`, click "View in Explorer →", confirm the key appears in the Explorer.
> 5. `/tenants` — seed both tenants, Clear tenant A, confirm tenant B's keys remain; run the isolation flush and confirm the foreign `other-app:*` key survives.
> 6. If any check fails, diagnose and fix in the corresponding earlier task file (P13-1..P13-7), then return here. Do NOT fake data or stub charts to pass.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - Do NOT lower any threshold or bypass a gate; charts must be fed by server endpoints (no browser SCAN for charts).
>   Verification:
> - `pnpm --filter web typecheck` — expected: exit 0.
> - `pnpm --filter web lint` — expected: exit 0.
> - `pnpm --filter web build` — expected: exit 0; the four manual page checks above all pass against a running API + seeded Redis.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P13-8 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

When this task is 🟢, Phase 13 is 8/8 — switch the Phase 13 row in `DEVELOPMENT_PLAN.md` Progress Summary to 🟢 Done.

⚠️ Never mark done with failing verification.

---

## Completion log

_(Agents append one line per finished task, newest at the bottom.)_

- P13-7 ✅ 2026-06-18 — TanStack Query hooks (`useKeys` infinite SCAN, `useMetrics`, `useInfo`, `useKeyspace`, `useKeyInspect`) + write mutations with precise invalidation, over a typed `lib/cache-api.ts` endpoint layer.
- P13-1 ✅ 2026-06-18 — Eight reusable Recharts panels (MetricTile, HitRateGauge, brushable HitMissArea, pausable OpsStream, µs-precision LatencyLines, TypeDonut, MemoryByPrefix, ExpiryAnalysis) + shadcn `chart.tsx`; server-endpoint-fed, bounded dimensions, skeleton/empty/sr-summary states.
- P13-3 ✅ 2026-06-18 — Explorer page: URL-bound filter rail, scan/keys teaching toggle (O(N) + cluster guards), virtualized `KeyTable` (TanStack Table + Virtual) with lazy per-row inspect + custom-SVG `TtlRing`, resolved KeyBuilder pattern.
- P13-4 ✅ 2026-06-18 — `KeyDetailDrawer` (Value/Raw/TTL/Metadata tabs via `@uiw/react-json-view`) with copy/refresh/delete/persist/extend actions + guarded `FlushNamespaceButton` rendering the 403 structured error.
- P13-2 ✅ 2026-06-18 — Overview page: golden-signal health strip, brushable hit/miss area, throughput+latency row, click-to-filter keyspace breakdown, INFO connection band, and the two-metric-sources callout; series accumulated client-side from polled snapshots.
- P13-5 ✅ 2026-06-18 — Playground: five data-structure cards (strings/numerics/hashes/sets/batch) firing catalog/counters/collections ops with toasts, resulting-key lines, "View in Explorer →", and the honest set/getRaw labels.
- P13-6 ✅ 2026-06-18 — Tenants page: `TenantSplit` (per-tenant seed/clear/hit%) proving prefix scoping + `IsolationProof` (seed-foreign / flush-and-verify) proving the namespace boundary, with the honesty callout.
- P13-8 ✅ 2026-06-18 — Phase verification: typecheck/lint/build all exit 0; client bundle is library-clean (no ioredis/NestJS); live API+Redis smoke test confirmed all four DoD behaviors (golden signals, namespaced scan, Playground op-appears, tenant isolation + foreign-key survival).
