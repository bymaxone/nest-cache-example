# Phase 14 — Dashboard: Real-time & Labs pages — Tasks

> **Source:** [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#phase-14--dashboard-real-time--labs-pages) §Phase 14
> **Total tasks:** 9
> **Progress:** 🔴 0 / 9 done (0%)
>
> **Status legend:** 🔴 Not Started · 🟡 In Progress · 🔵 In Review · 🟢 Done · ⚪ Blocked

## Task index

| ID    | Task                                                                          | Status | Priority | Size | Depends on            |
| ----- | ----------------------------------------------------------------------------- | ------ | -------- | ---- | --------------------- |
| P14-1 | `components/realtime/EventFeed` (ring-buffer, follow-mode) + `use-follow-mode` | 🔴     | High     | M    | Phase 12              |
| P14-2 | `app/pubsub/page.tsx` — publish form + subscription manager + live `EventFeed` | 🔴     | High     | M    | Phase 8, P14-1        |
| P14-3 | `components/realtime/TtlRing` (custom SVG) + `CountdownWall`                   | 🔴     | High     | M    | Phase 12              |
| P14-4 | `app/ttl/page.tsx` — countdown wall + expiry `EventFeed`; fade + toast        | 🔴     | High     | M    | Phase 9, P14-1, P14-3 |
| P14-5 | `components/labs/StampedeTimeline` (SVG swimlane) + `app/stampede/page.tsx`    | 🔴     | Medium   | M    | Phase 10, Phase 12    |
| P14-6 | `app/serializer/page.tsx` — JSON vs msgpack + `SerializableValue` banner      | 🔴     | Medium   | M    | Phase 7, Phase 12     |
| P14-7 | `app/errors/page.tsx` — all 15 codes + response panel (typed via `/shared`)   | 🔴     | Medium   | M    | Phase 11, Phase 12    |
| P14-8 | `app/connection/page.tsx` — status badge + lifecycle feed + mode + `INFO`     | 🔴     | Medium   | M    | Phase 11, P14-1       |
| P14-9 | Phase verification (fan-out · expiry · stampede · errors · lifecycle)          | 🔴     | Medium   | S    | P14-1..P14-8          |

---

## P14-1 — `components/realtime/EventFeed` (ring-buffer, follow-mode) + `hooks/use-follow-mode.ts`

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** M (90 min – half day)
- **Depends on:** `Phase 12`

### Description

Build the shared real-time feed used by three pages (Pub/Sub, TTL Live, Connection). `EventFeed` renders a bounded, ring-buffered list (newest on top) of typed socket events with **follow-mode**: it auto-scrolls when the user is pinned to the latest row, pauses auto-scroll the moment the user scrolls up to read history, and shows a **"N new — jump to latest"** pill that re-pins on click. The follow-mode mechanics live in `hooks/use-follow-mode.ts` so the behaviour is reusable and unit-testable. This component is the backbone of every live surface in the phase; per DASHBOARD §11 (principle 11 "Live, but guarded") high-rate streams must never freeze the tab, so rendering reads from the rAF-batched ring buffer fed by `useCacheSocket` (Phase 12, `hooks/use-cache-socket.ts`).

### Acceptance Criteria

- [ ] `components/realtime/EventFeed.tsx` renders a generic list of feed rows (timestamp + label + payload), newest-on-top, capped to a bounded length (drop-oldest), with a per-row render slot so each page can style its own row.
- [ ] `hooks/use-follow-mode.ts` exposes `{ isPinned, newCount, scrollRef, onScroll, jumpToLatest, registerArrival }` (or equivalent): auto-scroll while pinned, un-pin on user scroll-up, count arrivals while un-pinned, reset on `jumpToLatest`.
- [ ] A **"N new — jump to latest"** pill appears only when un-pinned **and** `newCount > 0`; clicking it re-pins and zeroes the counter.
- [ ] An action-oriented **empty state** ("No events yet — enable the Live toggle / publish a message →") renders when the feed is empty (DASHBOARD §2, principle 9).
- [ ] The feed honours `prefers-reduced-motion` (no smooth-scroll animation when set) and exposes a pause-equivalent via the un-pin behaviour (DASHBOARD §15 a11y).
- [ ] `pnpm --filter web typecheck` + `pnpm --filter web lint` exit 0.

### Files to create / modify

- `apps/web/components/realtime/EventFeed.tsx` — generic ring-buffered, follow-mode feed.
- `apps/web/hooks/use-follow-mode.ts` — follow-mode state machine.

### Agent Execution Prompt

> Role: Senior React / Next.js 16 engineer building an observability console.
> Context: This is task P14-1 of `docs/DEVELOPMENT_PLAN.md` §Phase 14 for `nest-cache-example`, the reference app for `@bymax-one/nest-cache`. Read `docs/DASHBOARD.md` §9 (Pub/Sub feed), §10 (TTL expiry feed), §14 (lifecycle feed), §15 (Pub/Sub feed + a11y "no unstoppable motion") and §18 (real-time architecture — the `useCacheSocket` ring buffer + rAF flush; "follow-mode … lives in the feed component"), plus `docs/TECHNICAL_SPECIFICATION.md` §13.2–§13.3 (`EventFeed` is one of the four bespoke components). The socket hook `hooks/use-cache-socket.ts` and the shell/design system already exist from Phase 12.
> Objective: Produce a reusable `EventFeed` + `use-follow-mode` pair that the Pub/Sub, TTL, and Connection pages all consume.
> Steps:
>
> 1. Create `hooks/use-follow-mode.ts`: track `isPinned` (start pinned), `newCount`, a `scrollRef`, an `onScroll` handler that un-pins when the user scrolls away from the top/latest edge and re-pins when they return to it, a `registerArrival()` to bump `newCount` while un-pinned, and `jumpToLatest()` to scroll back and reset. Respect `window.matchMedia('(prefers-reduced-motion: reduce)')` — skip smooth scrolling when set.
> 2. Create `components/realtime/EventFeed.tsx`: a generic, typed list (`items: readonly T[]`, `renderRow: (item: T) => ReactNode`, `getKey`, `emptyState`), newest-on-top, bounded length (the buffer is already capped upstream; the component must not grow unbounded DOM — virtualize or hard-cap the rendered window). Wire `use-follow-mode`, render the **"N new — jump to latest"** pill (color+icon+text, lucide) when un-pinned and `newCount > 0`, and render the action-oriented empty state when `items` is empty.
> 3. Style with the shared design system (glass card, mono timestamps, `lib/cache-status.ts` palette helpers) — do NOT invent new tokens.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions (TypeScript strict, English-only comments, no `@ts-ignore`/`eslint-disable`).
> - The component is **display-only** over a buffer it is handed — it must NOT open its own socket (that is `use-cache-socket.ts` from Phase 12).
> - Design system from `docs/design_system.html` / DASHBOARD §19 — copied verbatim, never re-invented.
> - Self-contained: every prop/type must be defined or imported here; no reliance on later tasks.
>   Verification:
> - `pnpm --filter web typecheck` — expected: exit 0.
> - `pnpm --filter web lint` — expected: exit 0.
> - Manual: with a mock array, scrolling up un-pins and the pill appears with the arrival count; clicking it re-pins and clears the count; an empty array shows the empty state.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P14-1 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P14-2 — `app/pubsub/page.tsx` — Publish Form + Subscription Manager + Live `EventFeed`

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** M (90 min – half day)
- **Depends on:** `Phase 8`, `P14-1`

### Description

Build the Pub/Sub page (DASHBOARD §9): a **publish form** that fans a message out to every connected tab, a **subscription manager** for exact-channel `subscribe` and pattern `psubscribe` with visible **ref-counts**, and a live `EventFeed` on the `cache:event` socket channel (newest-on-top, follow-mode). The browser **publishes via REST** `POST /pubsub/publish` (Phase 8) — never over the socket; the socket is strictly server→client (DASHBOARD §18). The page proves the library's `PubSubService.publish/subscribe/psubscribe` and its ref-counted `Unsubscribe`: subscribing twice + unsubscribing once keeps delivery alive, and a double-unsubscribe is safe.

### Acceptance Criteria

- [ ] `app/pubsub/page.tsx` renders a **Publish** card (channel + JSON payload inputs, validated) calling `POST /pubsub/publish`; the response surfaces the **subscriber count** the library returns.
- [ ] A **Subscriptions** card toggles exact `subscribe` and pattern `psubscribe` (e.g. `product:*`), shows a **ref-count per channel**, and demonstrates `subscribe×2 → unsubscribe×1` keeps delivery and double-unsubscribe is safe (calls `POST /pubsub/subscribe`).
- [ ] A live `EventFeed` (from P14-1) renders `cache:event` messages (channel + payload + timestamp, newest-on-top); pattern-matched rows show the matching pattern.
- [ ] A callout explains channels are **namespaced** (`publish('product-events')` → `cache-example:product-events`; both sides go through the library so the namespace matches transparently — DASHBOARD §9).
- [ ] Mutations use TanStack Query `useMutation`; the live feed reads the shared `useCacheSocket` buffer (Phase 12) — no `useEffect`+fetch, no axios (spec §13.1).
- [ ] Skeletons for loading, an action-oriented empty state for the feed, and `sonner` toasts for publish results (DASHBOARD §2).
- [ ] `pnpm --filter web typecheck` + `pnpm --filter web lint` exit 0.

### Files to create / modify

- `apps/web/app/pubsub/page.tsx` — the Pub/Sub page.
- `apps/web/components/realtime/` — small publish/subscription sub-components if extracted.
- `apps/web/lib/api-client.ts` — add typed `publish` / `subscribe` wrappers if missing.

### Agent Execution Prompt

> Role: Senior React / Next.js 16 engineer.
> Context: Task P14-2 of `docs/DEVELOPMENT_PLAN.md` §Phase 14. Read `docs/DASHBOARD.md` §9 (Pub/Sub page — publish card, subscription manager with ref-counts, live feed, namespaced-channel callout), §18 (the browser publishes via REST `POST /pubsub/publish`, NOT the socket; one socket multiplexes the three channels), and `docs/TECHNICAL_SPECIFICATION.md` §13.1–§13.2. The `apps/api` Pub/Sub endpoints + the socket gateway exist from Phase 8; `EventFeed` + `use-follow-mode` from P14-1; `use-cache-socket.ts` + shell from Phase 12.
> Objective: Produce `app/pubsub/page.tsx` proving publish → fan-out across tabs + ref-counted subscriptions.
> Steps:
>
> 1. Build the **Publish** card: channel input + JSON payload textarea (validate JSON before submit), a `useMutation` → `POST /pubsub/publish`, and a result line showing the returned subscriber count; toast on success/failure.
> 2. Build the **Subscriptions** card: rows for exact `subscribe` and pattern `psubscribe` (`product:*`), each with a `+ add` / `unsubscribe` control and a visible ref-count; wire `POST /pubsub/subscribe` and show that `subscribe×2 → unsubscribe×1` keeps the feed live and a second unsubscribe is a no-op.
> 3. Render a live `EventFeed` (P14-1) filtered to `cache:event` items from the shared `useCacheSocket(enabled)` buffer; each row shows timestamp, channel, payload (JSON), and the matching pattern for `psubscribe` hits.
> 4. Add the namespaced-channel callout and the "open a 2nd tab to watch delivery" hint (DASHBOARD §9).
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions; English-only; no `@ts-ignore`/`eslint-disable`.
> - The browser MUST publish over REST (`POST /pubsub/publish`), never the socket; the socket feed is read-only.
> - Reuse `EventFeed`/`use-cache-socket` — do NOT re-implement a feed or a second socket.
> - Design system from `docs/design_system.html` / DASHBOARD §19, copied verbatim.
> - Self-contained prompt; types come from the API client + `@bymax-one/nest-cache/shared` where relevant.
>   Verification:
> - `pnpm --filter web typecheck` + `pnpm --filter web lint` — expected: exit 0.
> - Manual (with API + Redis up, Live toggle on): publish a message → it appears in this tab's feed and in a second browser tab's feed; ref-count increments on double-subscribe and delivery survives a single unsubscribe.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P14-2 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P14-3 — `components/realtime/TtlRing` (custom SVG) + `CountdownWall`

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** M (90 min – half day)
- **Depends on:** `Phase 12`

### Description

Build the TTL countdown primitives (DASHBOARD §10, §15). `TtlRing` is a **custom SVG radial countdown** (a draining arc + `mm:ss` / `∞` label) that decrements client-side from a given `ttl` seconds; on reaching zero it does **not** optimistically remove itself — it waits for the server's expiry event to confirm (P14-4). `CountdownWall` arranges a grid of `KeyCard`-style tiles, each holding a `TtlRing`, with seed controls. These are bespoke SVG (not Recharts) per the catalog (DASHBOARD §15: "TTL countdown — Radial ring (custom SVG)"; spec §13.3 lists `TtlRing` as one of the four bespoke components).

### Acceptance Criteria

- [ ] `components/realtime/TtlRing.tsx` is a **custom SVG** radial progress ring (no Recharts): a draining arc proportional to remaining/initial TTL + a centered `mm:ss` label, rendering `∞` for persisted keys and a terminal state at zero.
- [ ] The ring drains **client-side** via a timer; reaching zero shows an "expiring…" terminal state and does **not** remove the tile optimistically (confirmation comes from the expiry event in P14-4).
- [ ] `components/realtime/CountdownWall.tsx` renders a responsive grid of TTL tiles (key label + prefix + `TtlRing`) plus **seed controls** ("Seed key w/ TTL: 30s", "Seed persisted (∞)").
- [ ] The ring is accessible: a text/`aria` label states the remaining time (color + text, not color alone — DASHBOARD §15) and animation honours `prefers-reduced-motion`.
- [ ] No dependency on later tasks: `CountdownWall` accepts data + seed callbacks via props so P14-4 can wire it to the API/socket.
- [ ] `pnpm --filter web typecheck` + `pnpm --filter web lint` exit 0.

### Files to create / modify

- `apps/web/components/realtime/TtlRing.tsx` — custom SVG radial countdown.
- `apps/web/components/realtime/CountdownWall.tsx` — grid of TTL tiles + seed controls.

### Agent Execution Prompt

> Role: Senior React / SVG-fluent front-end engineer.
> Context: Task P14-3 of `docs/DEVELOPMENT_PLAN.md` §Phase 14. Read `docs/DASHBOARD.md` §10 (Countdown wall — `TtlRing` drains client-side, waits for the server expiry event, no optimistic removal), §15 (chart catalog: TTL countdown is a **custom SVG radial ring**, NOT Recharts; a11y: color+icon+text, reduced-motion) and `docs/TECHNICAL_SPECIFICATION.md` §13.3 (`TtlRing` is a bespoke SVG progress ring). The shell + design tokens exist from Phase 12.
> Objective: Produce the `TtlRing` + `CountdownWall` presentation components (data wired in P14-4).
> Steps:
>
> 1. Build `TtlRing.tsx` as a hand-rolled SVG: two concentric `<circle>`s with `stroke-dasharray`/`stroke-dashoffset` for the draining arc, a centered mono `mm:ss` label, an `∞` state for persisted keys, and a zeroed "expiring…" terminal state. Drive the countdown with a client-side timer (`requestAnimationFrame` or interval) from `ttlSeconds`; never auto-hide on zero.
> 2. Build `CountdownWall.tsx`: a responsive grid of glass tiles (key label, prefix chip, `TtlRing`) plus seed buttons ("Seed key w/ TTL: 30s", "Seed persisted (∞)"); take `tiles` and `onSeed*` via props.
> 3. Add accessibility: an `aria-label`/visually-hidden text stating the remaining seconds, and skip the smooth drain animation under `prefers-reduced-motion`.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions; English-only; no `@ts-ignore`/`eslint-disable`.
> - `TtlRing` MUST be custom SVG — do NOT use Recharts/other chart libs for it.
> - Do NOT optimistically remove a tile at zero — expiry confirmation is the server event (P14-4).
> - Design system from `docs/design_system.html` / DASHBOARD §19, copied verbatim.
> - Self-contained: components take all data via props; no API/socket calls here.
>   Verification:
> - `pnpm --filter web typecheck` + `pnpm --filter web lint` — expected: exit 0.
> - Manual: a ring seeded at 30s visibly drains to 0 and holds an "expiring…" state; a persisted tile shows `∞`; reduced-motion disables the smooth drain.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P14-3 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P14-4 — `app/ttl/page.tsx` — Countdown Wall + Expiry `EventFeed`; Fade + Toast

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** M (90 min – half day)
- **Depends on:** `Phase 9`, `P14-1`, `P14-3`

### Description

Build the headline "watch it expire" page (DASHBOARD §10). It wires `CountdownWall` (P14-3) to live TTL data + seed actions, and renders an **expiry `EventFeed`** on the `cache:expired` socket channel. When a key expires, Redis fires `__keyevent@0__:expired`; the `apps/api` raw keyspace subscriber (Phase 9, via `BYMAX_CACHE_CONNECTION` → `createSubscriberClient()`, filtered by `KeyBuilder.getNamespacePrefix()`) emits `cache:expired`; the UI then **fades** the matching tile and **toasts** "Key expired — re-fetching…", and the next read re-populates. A callout explains why this uses the **raw subscriber, not `PubSubService`** (Redis keyspace channels are fixed and outside the namespace) and that `redis.conf` needs `notify-keyspace-events Ex`.

### Acceptance Criteria

- [ ] `app/ttl/page.tsx` renders `CountdownWall` (P14-3) wired to live TTL keys + the seed controls (`POST /admin/seed` or the TTL seed endpoint).
- [ ] An expiry `EventFeed` (P14-1) renders `cache:expired` socket items (key + timestamp), newest-on-top, **filtered to the namespace prefix** (foreign-ns expiries ignored — DASHBOARD §10).
- [ ] On a `cache:expired` event, the matching tile **fades** and a `sonner` toast fires ("Key expired — re-fetching…"); tile removal is driven by the event, not by the client timer reaching zero.
- [ ] A callout explains the **raw subscriber vs `PubSubService`** distinction and the `notify-keyspace-events Ex` requirement (DASHBOARD §10; spec §17.3 / §21.2).
- [ ] Live data reads the shared `useCacheSocket` buffer (Phase 12); TTL reads use TanStack Query — no `useEffect`+fetch, no axios.
- [ ] `pnpm --filter web typecheck` + `pnpm --filter web lint` exit 0.

### Files to create / modify

- `apps/web/app/ttl/page.tsx` — the TTL Live page.
- `apps/web/lib/api-client.ts` — TTL seed wrapper if missing.

### Agent Execution Prompt

> Role: Senior React / Next.js 16 engineer.
> Context: Task P14-4 of `docs/DEVELOPMENT_PLAN.md` §Phase 14. Read `docs/DASHBOARD.md` §10 (TTL Live — countdown wall + expiry feed; fade + toast; raw-subscriber-not-PubSub callout; `notify-keyspace-events Ex`), §18 (one socket multiplexes `cache:connection`/`cache:event`/`cache:expired`) and `docs/TECHNICAL_SPECIFICATION.md` §13.2. The raw keyspace subscriber + `cache:expired` emit exist from Phase 9; `EventFeed`/`use-follow-mode` from P14-1; `TtlRing`/`CountdownWall` from P14-3; `use-cache-socket.ts` + shell from Phase 12.
> Objective: Produce `app/ttl/page.tsx` where a seeded short-TTL key visibly drains, then the server expiry event fades the card + toasts.
> Steps:
>
> 1. Load the namespace's TTL'd keys (TanStack Query) and feed them to `CountdownWall`; wire the seed buttons to the seed endpoint and invalidate the query after seeding.
> 2. Render the expiry `EventFeed` from the shared `useCacheSocket` buffer, filtered to `cache:expired` items whose key starts with the namespace prefix.
> 3. On each `cache:expired` arrival, mark the matching tile as fading (CSS transition) and fire a `sonner` toast "Key expired — re-fetching…"; remove the tile on the event (not on the local timer hitting zero).
> 4. Add the raw-subscriber-vs-`PubSubService` callout and the `notify-keyspace-events Ex` note.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions; English-only; no `@ts-ignore`/`eslint-disable`.
> - Tile removal MUST be event-driven (server confirms expiry); the client ring only drains visually.
> - Reuse `EventFeed`/`CountdownWall`/`use-cache-socket` — do NOT re-implement them or open a second socket.
> - Design system from `docs/design_system.html` / DASHBOARD §19, copied verbatim.
> - Self-contained prompt.
>   Verification:
> - `pnpm --filter web typecheck` + `pnpm --filter web lint` — expected: exit 0.
> - Manual (API + Redis up, Live on, `notify-keyspace-events Ex` set): seed a 30s key → its ring drains → at expiry the `cache:expired` event arrives → the tile fades and a toast fires → the feed shows the EXPIRED row scoped to the namespace.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P14-4 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P14-5 — `components/labs/StampedeTimeline` (SVG swimlane) + `app/stampede/page.tsx`

- **Status:** 🔴 Not Started
- **Priority:** Medium
- **Size:** M (90 min – half day)
- **Depends on:** `Phase 10`, `Phase 12`

### Description

Build the Stampede Lab (DASHBOARD §11): fire N concurrent requests for an uncached key and watch a single-flight Lua lock collapse them into **one** origin fetch. `StampedeTimeline` is a **custom SVG swimlane** (one lane per request) — the lock **winner** (`eval` returns `1`) shows LOCK WON → origin fetch → SET → release; **losers** (`0`) show a brief wait → cache HIT. The page has controls (`productId` / `concurrency` / `lockMs`), the timeline, a **result strip** (origin fetches vs hits, hit-rate, multiplier saved), and the registered **script SHA** from `ScriptManagerService.load('acquireLock')` (Phase 10). The timeline is bespoke SVG (not Recharts) per DASHBOARD §15.

### Acceptance Criteria

- [ ] `components/labs/StampedeTimeline.tsx` is a **custom SVG swimlane** (one lane per request; winner lane shows LOCK WON → origin fetch (ms) → SET → release; loser lanes show wait → cache HIT) — not Recharts.
- [ ] `app/stampede/page.tsx` renders controls (`productId`, `concurrency`, `lockMs`) + a **[Fire N requests]** button calling `POST /stampede?productId=&concurrency=&lockMs=` (Phase 10).
- [ ] A **result strip** shows `origin fetches: 1 / N`, `cache hits: N−1 / N`, the hit-rate, and the multiplier saved.
- [ ] The registered **script name + resolved SHA1** (`acquireLock`) is displayed (from the `/stampede` response / `ScriptManagerService.load`).
- [ ] A callout: keys are **namespaced by `eval`** (`cache-example:stampede:77`); the Lua body is declared in code (`IScriptDefinition`), never built from request input (DASHBOARD §11; spec §18/§24).
- [ ] Mutation via TanStack Query `useMutation`; skeletons + action-oriented empty state before the first run.
- [ ] `pnpm --filter web typecheck` + `pnpm --filter web lint` exit 0.

### Files to create / modify

- `apps/web/components/labs/StampedeTimeline.tsx` — custom SVG swimlane.
- `apps/web/app/stampede/page.tsx` — the Stampede Lab page.
- `apps/web/lib/api-client.ts` — `runStampede` wrapper if missing.

### Agent Execution Prompt

> Role: Senior React / SVG-fluent front-end engineer.
> Context: Task P14-5 of `docs/DEVELOPMENT_PLAN.md` §Phase 14. Read `docs/DASHBOARD.md` §11 (Stampede Lab — controls, swimlane timeline, result strip, script SHA, namespaced-`eval` callout), §15 (Stampede timeline is a **custom SVG swimlane**, NOT Recharts) and `docs/TECHNICAL_SPECIFICATION.md` §13.2–§13.3 (`StampedeTimeline` is a bespoke component). The `apps/api` `POST /stampede` endpoint + `ScriptManagerService`/`eval` exist from Phase 10; the shell + design tokens from Phase 12.
> Objective: Produce the `StampedeTimeline` SVG + `app/stampede/page.tsx` that prove single-flight (1 fetch + N−1 hits).
> Steps:
>
> 1. Build `StampedeTimeline.tsx`: a hand-rolled SVG with one horizontal lane per request, segments positioned by their start/duration; the winner lane renders LOCK WON → origin fetch (with ms) → SET → release; loser lanes render a short wait → cache HIT (color+icon+text legend).
> 2. Build `app/stampede/page.tsx`: controls for `productId` / `concurrency` / `lockMs`, a `useMutation` → `POST /stampede?...`, the timeline fed by the response log, a result strip (origin fetches vs hits, hit-rate, multiplier), and the script name + resolved SHA1.
> 3. Add the namespaced-`eval` / code-declared-Lua callout; show a skeleton while running and an action-oriented empty state before the first run.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions; English-only; no `@ts-ignore`/`eslint-disable`.
> - `StampedeTimeline` MUST be custom SVG — do NOT use Recharts for it (other charts in the app use Recharts; this one is bespoke).
> - Self-contained prompt; types from the API client.
> - Design system from `docs/design_system.html` / DASHBOARD §19, copied verbatim.
>   Verification:
> - `pnpm --filter web typecheck` + `pnpm --filter web lint` — expected: exit 0.
> - Manual (API + Redis up): Fire 10 requests for an uncached id → the timeline shows exactly one winner lane (LOCK WON → origin → SET → release) and nine waiter→HIT lanes; the result strip reads `origin fetches: 1 / 10`, `cache hits: 9 / 10`; the script SHA renders.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P14-5 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P14-6 — `app/serializer/page.tsx` — JSON vs MessagePack + `SerializableValue` Banner

- **Status:** 🔴 Not Started
- **Priority:** Medium
- **Size:** M (90 min – half day)
- **Depends on:** `Phase 7`, `Phase 12`

### Description

Build the Serializer Lab (DASHBOARD §12): store the same object with the default `JsonSerializer` and a custom `MsgPackSerializer`, then show, **side by side**, the **raw stored bytes** (`getRaw`) vs the **decoded value** (`get`) for each codec — making the serializer behaviour and the JSON round-trip caveats tangible. A **`SerializableValue` caveat banner** spells out that `Date`/`Map`/`Set`/`BigInt` don't survive JSON. The page calls `POST /serializer/roundtrip` (Phase 7); the injected serializer is read via `BYMAX_CACHE_SERIALIZER`.

### Acceptance Criteria

- [ ] `app/serializer/page.tsx` has a payload input + a `json | msgpack` codec selector + a **[Round-trip]** action calling `POST /serializer/roundtrip` (Phase 7).
- [ ] A **side-by-side** comparison shows, per codec: **raw** (`getRaw` — exact stored bytes, msgpack as base64 with a byte count) and **decoded** (`get`).
- [ ] A **`SerializableValue` caveat banner** documents that `Date`/`Map`/`Set`/`BigInt` don't survive JSON (DASHBOARD §12; spec §16), e.g. a `Date` becoming an ISO string under JSON.
- [ ] Typed via `@bymax-one/nest-cache/shared` where the `SerializableValue` type is referenced.
- [ ] Mutation via TanStack Query `useMutation`; skeletons + an action-oriented empty state before the first round-trip; `sonner` toasts.
- [ ] `pnpm --filter web typecheck` + `pnpm --filter web lint` exit 0.

### Files to create / modify

- `apps/web/app/serializer/page.tsx` — the Serializer Lab page.
- `apps/web/components/labs/SerializerCompare.tsx` — the side-by-side compare panel (if extracted).
- `apps/web/lib/api-client.ts` — `roundtripSerializer` wrapper if missing.

### Agent Execution Prompt

> Role: Senior React / Next.js 16 engineer.
> Context: Task P14-6 of `docs/DEVELOPMENT_PLAN.md` §Phase 14. Read `docs/DASHBOARD.md` §12 (Serializer Lab — side-by-side `getRaw` bytes vs `get` decoded for JSON and msgpack; `SerializableValue` caveat banner; `Date` → ISO string under JSON) and `docs/TECHNICAL_SPECIFICATION.md` §13.2. The `apps/api` `POST /serializer/roundtrip` + the `BYMAX_CACHE_SERIALIZER` token exist from Phase 7; the shell + design tokens from Phase 12.
> Objective: Produce `app/serializer/page.tsx` contrasting JSON and MessagePack at the byte level.
> Steps:
>
> 1. Build the input: a JSON payload textarea + a `json | msgpack` codec selector + a `useMutation` → `POST /serializer/roundtrip` returning `{ raw, decoded }` per codec.
> 2. Render a two-column compare: each column shows `raw` (mono; msgpack rendered base64 with a byte count, flagged as smaller) and `decoded` (JSON tree).
> 3. Add the `SerializableValue` caveat banner (Date/Map/Set/BigInt don't survive JSON), typing the referenced shape via `@bymax-one/nest-cache/shared`.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions; English-only; no `@ts-ignore`/`eslint-disable`.
> - `SerializableValue` / any shared type MUST be imported from `@bymax-one/nest-cache/shared` (the zero-dep subpath in the browser bundle), not redeclared.
> - Self-contained prompt; design system from `docs/design_system.html` / DASHBOARD §19, copied verbatim.
>   Verification:
> - `pnpm --filter web typecheck` + `pnpm --filter web lint` — expected: exit 0.
> - Manual (API + Redis up): round-trip a payload containing a date → JSON column shows the date as an ISO string while msgpack preserves structure; msgpack `raw` is shown base64 + byte count and is smaller than the JSON string.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P14-6 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P14-7 — `app/errors/page.tsx` — All 15 Codes + Response Panel (typed via `/shared`)

- **Status:** 🔴 Not Started
- **Priority:** Medium
- **Size:** M (90 min – half day)
- **Depends on:** `Phase 11`, `Phase 12`

### Description

Build the Error Explorer (DASHBOARD §13): a trigger list of **all 15** `CACHE_ERROR_CODES`, each with a Trigger button (`POST /errors/:code`, Phase 11), and a **response panel** showing the HTTP status, the structured `{ error: { code, message, details } }` body, and the canonical message from `CACHE_ERROR_MESSAGES`. Everything is **typed end-to-end** via the library's `/shared` subpath (`CacheErrorCode` / `CACHE_ERROR_CODES`). A **prod-guard toggle** restarts the API in `production` mode to demonstrate the `flushNamespace` guard live (`403 cache.flush_disabled_in_production`). Each row is color+icon+text by severity class (4xx amber, 5xx red, 504 purple).

### Acceptance Criteria

- [ ] `app/errors/page.tsx` lists all 15 codes from `CACHE_ERROR_CODES` (imported from `@bymax-one/nest-cache/shared`), each with a **[Trigger]** button → `POST /errors/:code`.
- [ ] A **response panel** shows the HTTP status, the structured `{ error: { code, message, details } }` body, and the canonical message taken from the **API response body** (`message`, populated server-side from `CACHE_ERROR_MESSAGES` by the exception filter — never imported into the browser).
- [ ] Each row is **color + icon + text** by severity class — 4xx amber, 5xx red, 504 purple (DASHBOARD §13; `lib/cache-status.ts`).
- [ ] A **prod-guard toggle** ("run API as `NODE_ENV=production`") demonstrates the `flushNamespace` guard returning `403 cache.flush_disabled_in_production`.
- [ ] The error union is typed via `CacheErrorCode` from `/shared` (spec §13.1 — the discriminated `ApiError` keyed by code); no string-literal duplication of codes.
- [ ] Mutation via TanStack Query `useMutation`; skeletons + an action-oriented empty state for the response panel.
- [ ] `pnpm --filter web typecheck` + `pnpm --filter web lint` exit 0.

### Files to create / modify

- `apps/web/app/errors/page.tsx` — the Error Explorer page.
- `apps/web/components/labs/ErrorTrigger.tsx` — the per-code trigger row (if extracted).
- `apps/web/lib/api-client.ts` — `triggerError` wrapper + typed error mapping if missing.

### Agent Execution Prompt

> Role: Senior React / Next.js 16 engineer.
> Context: Task P14-7 of `docs/DEVELOPMENT_PLAN.md` §Phase 14. Read `docs/DASHBOARD.md` §13 (Error Explorer — trigger list of all 15 `CACHE_ERROR_CODES`, response panel with status/body/canonical message, prod-guard toggle, severity color+icon+text) and `docs/TECHNICAL_SPECIFICATION.md` §13.1 (browser imports `CACHE_ERROR_CODES`/`CacheErrorCode` from the shared subpath; `ApiError` is a discriminated union keyed by code). The `apps/api` `POST /errors/:code` triggers exist from Phase 11; the shell + `lib/cache-status.ts` + design tokens from Phase 12.
> Objective: Produce `app/errors/page.tsx` that triggers each `CacheException` and renders code + status + structured body, fully typed via `/shared`.
> Steps:
>
> 1. Import `CACHE_ERROR_CODES` (+ `CacheErrorCode`) from `@bymax-one/nest-cache/shared`; render one trigger row per code, severity-styled (4xx amber / 5xx red / 504 purple via `lib/cache-status.ts`).
> 2. On Trigger, `useMutation` → `POST /errors/:code`; capture the HTTP status + body and render the response panel (status badge, `{ error: { code, message, details } }`, and the canonical `message` read **from that response body** — do NOT import `CACHE_ERROR_MESSAGES` into the browser).
> 3. Add the prod-guard toggle ("run API as `NODE_ENV=production`") and show the `flushNamespace` guard returning `403 cache.flush_disabled_in_production` when on.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions; English-only; no `@ts-ignore`/`eslint-disable`.
> - Codes MUST come from `@bymax-one/nest-cache/shared` — do NOT hardcode the 15 strings or invent codes; the error union is typed by `CacheErrorCode`. Only `CACHE_ERROR_CODES` / `CacheErrorCode` may be imported from `/shared`; `CACHE_ERROR_MESSAGES` is **server-only** (spec §4.2) — never import it into the client bundle (it would pull NestJS into the browser and break matrix #48). Render the message from the API response instead.
> - Status/severity is color+icon+text (never color alone).
> - Self-contained prompt; design system from `docs/design_system.html` / DASHBOARD §19, copied verbatim.
>   Verification:
> - `pnpm --filter web typecheck` + `pnpm --filter web lint` — expected: exit 0.
> - Manual (API + Redis up): triggering each of the 15 codes renders its status + structured body + canonical message; with the prod-guard toggle on, the flush trigger returns `403` + `cache.flush_disabled_in_production`.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P14-7 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P14-8 — `app/connection/page.tsx` — Status Badge + Lifecycle Feed + Mode + `INFO`

- **Status:** 🔴 Not Started
- **Priority:** Medium
- **Size:** M (90 min – half day)
- **Depends on:** `Phase 11`, `P14-1`

### Description

Build the Connection & Topology page (DASHBOARD §14): the library's connection lifecycle + the Redis-server view. A `CacheConnectionStatus` **badge** (color+icon+text) with `ping` latency + mode; a **lifecycle `EventFeed`** on the `cache:connection` socket channel (`connect/ready/error/close/reconnecting/end`, each rendered with the status palette); a **mode selector** documenting the active `CACHE_MODE` (standalone/sentinel/cluster) so the reader can watch an admin action succeed in standalone and fail with `UNSUPPORTED_IN_CLUSTER` in cluster (Phase 11); and an **`INFO` section viewer** (server/clients/memory/stats/replication) rendering parsed `info(section)` as a mono key/value grid.

### Acceptance Criteria

- [ ] `app/connection/page.tsx` renders a `CacheConnectionStatus` badge (color+icon+text) with `ping()` latency + connection mode (backed by `/health`).
- [ ] A lifecycle `EventFeed` (P14-1) renders `cache:connection` socket items (`connect/ready/error/close/reconnecting/end`), each styled via the status palette (`lib/cache-status.ts`).
- [ ] A **mode selector** documents the active `CACHE_MODE` (standalone/sentinel/cluster) and explains the standalone-succeeds / cluster-`UNSUPPORTED_IN_CLUSTER` contrast (Phase 11; spec §15.4).
- [ ] An **`INFO` section viewer** with a section picker (server/clients/memory/stats/replication) renders parsed `GET /admin/info?section=` as a mono key/value grid.
- [ ] `CacheConnectionStatus` / `CacheEventName` types come from `@bymax-one/nest-cache/shared`; live data reads the shared `useCacheSocket` buffer; INFO reads via TanStack Query.
- [ ] Skeletons for INFO loading; an action-oriented empty state for the lifecycle feed.
- [ ] `pnpm --filter web typecheck` + `pnpm --filter web lint` exit 0.

### Files to create / modify

- `apps/web/app/connection/page.tsx` — the Connection & Topology page.
- `apps/web/lib/api-client.ts` — `getInfo(section)` / `getHealth` wrappers if missing.

### Agent Execution Prompt

> Role: Senior React / Next.js 16 engineer.
> Context: Task P14-8 of `docs/DEVELOPMENT_PLAN.md` §Phase 14. Read `docs/DASHBOARD.md` §14 (Connection & Topology — `CacheConnectionStatus` badge + `ping` latency + mode; lifecycle feed on `cache:connection`; mode selector; `INFO` section viewer), §18 (the `cache:connection` channel is one of the three on the shared socket) and `docs/TECHNICAL_SPECIFICATION.md` §13.2. The `apps/api` `events.onEvent` → `cache:connection` bridge, `GET /admin/info`, `GET /health`, and `CACHE_MODE` switch exist from Phases 3/5/11; `EventFeed`/`use-follow-mode` from P14-1; `use-cache-socket.ts` + `lib/cache-status.ts` + shell from Phase 12.
> Objective: Produce `app/connection/page.tsx` showing the live connection lifecycle, mode, and parsed `INFO`.
> Steps:
>
> 1. Render the `CacheConnectionStatus` badge (color+icon+text via `lib/cache-status.ts`) with `ping()` latency + mode, backed by a `/health` query (corrected live by the `cache:connection` feed).
> 2. Render the lifecycle `EventFeed` from the shared `useCacheSocket` buffer filtered to `cache:connection` items, each styled by `CacheEventName` via the status palette.
> 3. Add the mode selector (standalone/sentinel/cluster) documenting the active `CACHE_MODE` and the standalone-vs-cluster contrast, and the `INFO` section viewer (`GET /admin/info?section=`) as a mono key/value grid with a section picker.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions; English-only; no `@ts-ignore`/`eslint-disable`.
> - `CacheConnectionStatus` / `CacheEventName` MUST come from `@bymax-one/nest-cache/shared`.
> - Reuse `EventFeed`/`use-cache-socket` — do NOT open a second socket.
> - Status is color+icon+text (never color alone).
> - Self-contained prompt; design system from `docs/design_system.html` / DASHBOARD §19, copied verbatim.
>   Verification:
> - `pnpm --filter web typecheck` + `pnpm --filter web lint` — expected: exit 0.
> - Manual (API + Redis up, Live on): the status badge reads `ready` (green) with a sub-ms latency; restarting Redis pushes `reconnecting`/`connect`/`ready` rows into the lifecycle feed; the INFO viewer renders the picked section as key/value pairs.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P14-8 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P14-9 — Phase Verification (Fan-out · Expiry · Stampede · Errors · Lifecycle)

- **Status:** 🔴 Not Started
- **Priority:** Medium
- **Size:** S (30–90 min)
- **Depends on:** `P14-1`, `P14-2`, `P14-3`, `P14-4`, `P14-5`, `P14-6`, `P14-7`, `P14-8`

### Description

Phase 14 "Definition of done" gate per `DEVELOPMENT_PLAN.md`: prove the real-time + labs pages behave end-to-end against a live API + Redis. A published message appears across tabs; a seeded short-TTL key visibly expires (ring drains → card fades → toast); the stampede timeline shows 1 fetch + N−1 hits; each error code renders its status + body; the connection feed shows lifecycle events. Closes the phase. Demonstrates UI for Feature-Coverage-Matrix rows #30–#35 (pub/sub, stampede), #37–#39 (serializer), #41–#47 (errors, events, status), #8/#12 (TTL).

### Acceptance Criteria

- [ ] **Pub/Sub:** a message published from one tab (REST `POST /pubsub/publish`) appears in the live `cache:event` feed of a **second** tab; ref-count survives `subscribe×2 → unsubscribe×1`.
- [ ] **TTL Live:** a seeded short-TTL key's `TtlRing` drains to zero, then the server `cache:expired` event **fades** the card and fires the "re-fetching…" toast; the expiry feed row is scoped to the namespace.
- [ ] **Stampede:** firing N concurrent requests yields a swimlane with exactly **one** origin fetch + **N−1** cache hits, the result strip reads `1 / N` fetches, and the script SHA renders.
- [ ] **Serializer:** a round-trip shows JSON raw vs decoded (Date → ISO string) beside msgpack raw (base64, smaller) vs decoded; the `SerializableValue` banner is present.
- [ ] **Errors:** triggering each of the 15 `CACHE_ERROR_CODES` renders the correct status + `{ error: { code, message, details } }` body; the prod-guard toggle yields `403 cache.flush_disabled_in_production`.
- [ ] **Connection:** the lifecycle feed shows `cache:connection` events with the status palette; the INFO section viewer renders parsed `info(section)`.
- [ ] `pnpm --filter web typecheck` + `pnpm --filter web lint` exit 0; `pnpm --filter web build` is green.

### Files to create / modify

- _(none — verification only; fix the earlier task files (P14-1..P14-8) if a check fails.)_

### Agent Execution Prompt

> Role: Senior React / Next.js 16 engineer.
> Context: Task P14-9 of `docs/DEVELOPMENT_PLAN.md` §Phase 14. DoD: a published message appears across tabs; a seeded short-TTL key visibly expires (ring drains → card fades → toast); the stampede timeline shows 1 fetch + N−1 hits; each error code renders its status + body; the connection feed shows lifecycle events. Read `docs/DASHBOARD.md` §9–§14, §18 and `docs/TECHNICAL_SPECIFICATION.md` §13.2. Demonstrates matrix #30–#35, #37–#39, #41–#47, #8/#12.
> Objective: Confirm the whole Phase 14 surface behaves and close the phase.
> Steps:
>
> 1. Bring up the API + Redis (with `notify-keyspace-events Ex`) and start `apps/web`; enable the Live toggle.
> 2. Pub/Sub: open two browser tabs on `/pubsub`; publish from tab A (REST) and confirm tab B's `cache:event` feed receives it; exercise `subscribe×2 → unsubscribe×1` and confirm delivery persists.
> 3. TTL: on `/ttl`, seed a 30s key; watch the `TtlRing` drain; at expiry confirm the `cache:expired` event fades the card + toasts and the feed row is namespace-scoped.
> 4. Stampede: on `/stampede`, fire 10 requests for an uncached id; confirm one winner lane (LOCK WON → origin → SET → release) + nine waiter→HIT lanes and a `1 / 10` result strip + script SHA.
> 5. Serializer: on `/serializer`, round-trip a payload with a date; confirm JSON raw vs decoded (Date → ISO) and msgpack raw (base64, smaller) vs decoded, plus the `SerializableValue` banner.
> 6. Errors: on `/errors`, trigger all 15 codes; confirm each status + structured body + canonical message; toggle prod-guard and confirm `403` + `cache.flush_disabled_in_production`.
> 7. Connection: on `/connection`, confirm the lifecycle feed shows `cache:connection` events with the status palette and the INFO viewer renders a parsed section.
> 8. If any check fails, diagnose and fix in the corresponding earlier task file (P14-1..P14-8), then return here. Do NOT stub a feed, fake an event, or weaken a check to make it pass.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions; English-only; no `@ts-ignore`/`eslint-disable`.
> - The browser MUST publish over REST (never the socket); the socket feeds stay read-only.
> - Do NOT skip any check or lower any threshold.
>   Verification:
> - `pnpm --filter web typecheck` + `pnpm --filter web lint` — expected: exit 0.
> - `pnpm --filter web build` — expected: exit 0.
> - Manual: each of the six page behaviours above observed live (fan-out across tabs · ring→fade→toast · 1-fetch/N−1-hits · 15 error bodies · lifecycle feed + INFO).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P14-9 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

When this task is 🟢, Phase 14 is 9/9 — switch the Phase 14 row in `DEVELOPMENT_PLAN.md` Progress Summary to 🟢 Done.

⚠️ Never mark done with failing verification.

---

## Completion log

_(Agents append one line per finished task, newest at the bottom.)_
