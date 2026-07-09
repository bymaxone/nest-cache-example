# The Cache Observability & Control Console (`apps/web`)

> A **production-grade, real-world cache console** for `@bymax-one/nest-cache`, built with **Next.js 16 + React 19**. It is the human face of the example: browse the namespace and inspect any key, watch a key's TTL drain to zero and disappear in real time, fire every cache operation on demand, watch Pub/Sub messages fan out across browser tabs, collapse a 10-request stampede into a single origin fetch, and read hit-rate / latency / memory / ops like an SRE would.
>
> This document is the build spec for that app. It is grounded in how real cache tools work (RedisInsight, Grafana, Datadog, SigNoz, ScaleGrid) and how Redis itself exposes observability (`INFO`, `keyspace_hits/misses`, `SLOWLOG`, keyspace notifications) — see [§21 References](#21--references) for every source consulted.

---

> **Companion to [`TECHNICAL_SPECIFICATION.md`](TECHNICAL_SPECIFICATION.md).** The spec defines the whole repo — the `apps/api` wiring of `BymaxCacheModule`, the full library surface, the demo domain, and the honest design notes. This file zooms into `apps/web` and the `admin` / `metrics` / `events` API in `apps/api` that powers it. Read spec **§4** (library API inventory), **§10–§12** (backend + demonstration scenarios), **§13–§14** (frontend + design system), **§17** (Pub/Sub & real-time), and **§20** (observability & health) first. When this file conflicts with the spec, **the spec wins**.

## Table of Contents

1. [What this is (and isn't)](#1--what-this-is-and-isnt)
2. [Design principles](#2--design-principles)
3. [Information architecture](#3--information-architecture)
4. [Global controls](#4--global-controls)
5. [Page — Overview (cache health)](#5--page--overview-cache-health)
6. [Page — Key Explorer](#6--page--key-explorer)
7. [Page — Data Types Playground](#7--page--data-types-playground)
8. [Page — Namespace & Tenants](#8--page--namespace--tenants)
9. [Page — Pub/Sub (real-time)](#9--page--pubsub-real-time)
10. [Page — TTL Live (real-time)](#10--page--ttl-live-real-time)
11. [Page — Stampede Lab](#11--page--stampede-lab)
12. [Page — Serializer Lab](#12--page--serializer-lab)
13. [Page — Error Explorer](#13--page--error-explorer)
14. [Page — Connection & Topology](#14--page--connection--topology)
15. [Chart & panel catalog](#15--chart--panel-catalog)
16. [The backing API (`apps/api`)](#16--the-backing-api-appsapi)
17. [Reading Redis: key model, metrics & queries](#17--reading-redis-key-model-metrics--queries)
18. [Real-time architecture (WebSocket)](#18--real-time-architecture-websocket)
19. [Frontend tech stack & design system](#19--frontend-tech-stack--design-system)
20. [apps/web file layout](#20--appsweb-file-layout)
21. [References](#21--references)

---

## 1 · What this is (and isn't)

`apps/web` is a **real cache-admin tool** — a blend of a Redis browser (à la RedisInsight) and a caching-strategy observability console (à la a Grafana Redis dashboard), scaled down to something an example can own end to end. It demonstrates the full daily loop a backend engineer runs against a cache:

> glance at the **hit rate** → notice a dip → open the **Key Explorer**, scan the namespace → inspect a key's value + TTL → fire a **miss → origin → re-populate** from the Playground → watch the new key appear, its **TTL ring** drain, and the **expiry event** stream in live → confirm the namespace is isolated from other tenants.

It deliberately mirrors the **common-denominator feature set** of RedisInsight (Key Browser, Memory Analysis, Profiler, Slow Log), Grafana/Datadog Redis dashboards (hit rate, ops/sec, latency, memory), and the caching concepts the library exists to make easy (namespaces, TTL, Pub/Sub, Lua, connection lifecycle).

**It is honest about scope.** Several panels are **scoped demonstrations** of production concepts, implemented as small, real code against the one data source the example has (a single Redis), never faked screenshots. Each such surface carries an inline callout:

> 🎓 _Scoped demo of **\<production concept\>**. In a real deployment you would use **\<Redis `INFO` scraped by Prometheus / RedisInsight / a managed-Redis metrics API\>**._

**It makes the invisible visible.** TTL countdown rings, live expiry events, Pub/Sub fan-out, and a single-flight stampede timeline exist because these are the library behaviours a README cannot convey.

**Non-goals:** it is not a multi-cluster fleet manager, not a replacement for RedisInsight, and it does **not** invent a new design language. It reuses the **shared Bymax example-apps design system verbatim** — the same forced-dark orange glass-morphism, the same Geist Sans/Mono type, the same 64px-topbar + 250px-sidebar shell, the same shadcn `new-york` components as `nest-auth-example` and `nest-logger-example` — so all three reference apps look like one product. The screens differ (cache vs. logs vs. auth); the look is identical. See [§19](#19--frontend-tech-stack--design-system).

---

## 2 · Design principles

Every principle is lifted from a real source and applied to this app.

| #   | Principle                           | What it means here                                                                                                                                                                                                               | Source                                             |
| --- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 1   | **Overview → drill-down**           | Pages flow general→specific: hit-rate/health strip → breakdowns (by type, by prefix) → Key Explorer → a single key. Every panel click narrows the Explorer.                                                                      | Grafana dashboard best-practices                   |
| 2   | **Cache golden signals**            | The health strip = **Hit rate · Throughput (ops/sec) · Latency · Memory (saturation) · Evictions**. The four golden signals, specialized for a cache (hit rate replaces "errors" as the headline).                               | Google SRE Book · Datadog "Monitor Redis"          |
| 3   | **Hit rate is the headline**        | Surface `keyspace_hits / (keyspace_hits + keyspace_misses)` prominently; healthy is **> 90%** (a cache should beat **50%**). Show it as a gauge **and** a trend, plus a per-prefix breakdown so a cold prefix is visible.        | Redis observability docs · SigNoz · ScaleGrid      |
| 4   | **Percentiles, never averages**     | Command latency as **p50/p95/p99** lines (a mean hides spikes). Redis cache latency is sub-millisecond (400–600µs typical), so render in **ms with µs precision** and never round to "0ms".                                      | Google SRE Book · Redis docs                       |
| 5   | **Aggregate on bounded dimensions** | Group only by **data-type** (string/hash/set), **key prefix/namespace**, and **tenant** — RedisInsight's "Key Summary by Type / by Prefix". **Never** chart per-key (unbounded); individual keys are for search/drill-down only. | RedisInsight Memory Analysis · Grafana cardinality |
| 6   | **Make the invisible visible**      | TTL as a draining **radial ring**; expiry as a live **event**; Pub/Sub as a **fan-out feed**; a stampede as a **single-flight timeline**. This is the example's reason to exist.                                                 | spec §1 (G2)                                       |
| 7   | **Accessible status & severity**    | Connection status, hit/miss, and error codes use **color + icon + text** (never color alone): left-border accent + lucide icon + label.                                                                                          | PatternFly · Astro UXDS                            |
| 8   | **Skeletons, not spinners**         | Explorer/feed/chart fetches show skeleton screens; spinners only for short blocking actions (a single op submit).                                                                                                                | NN/g · Onething                                    |
| 9   | **Action-oriented empty states**    | "No keys in this namespace yet — seed one from the Playground →" with a primary action, never a blank pane.                                                                                                                      | NN/g empty-state design                            |
| 10  | **Shareable deep-links**            | Explorer filters (prefix, pattern, tenant, scan strategy) and the time range live in the **URL** (`nuqs` typed params), so any view is a copy-paste link.                                                                        | Grafana / Datadog                                  |
| 11  | **Live, but guarded**               | Real-time feeds (events, expiry, Pub/Sub) push over WebSocket; high-rate streams use a **bounded ring buffer + rAF batching**, and the ops/sec stream offers a **pause** control (no unstoppable motion — accessibility).        | MDN · WAI-ARIA (motion)                            |

---

## 3 · Information architecture

A left nav with ten destinations in four groups: the **daily drivers**, the **real-time** surfaces, the **labs** (one per advanced library feature), and the **system** view.

```
┌────────────┬──────────────────────────────────────────────────────────────────┐
│  ▣ nest-   │  ns: cache-example   [ Tenant: acme ▾ ]   ● ready · 0.4ms · stand. │
│   cache    ├──────────────────────────────────────────────────────────────────┤
│            │                                                                    │
│ OBSERVE    │   (page content — see §5–§14)                                      │
│ ▸ Overview │                                                                    │
│ ▸ Explorer │                                                                    │
│ ▸ Playgrnd │                                                                    │
│ ▸ Tenants  │                                                                    │
│ REAL-TIME  │                                                                    │
│ ▸ Pub/Sub  │                                                                    │
│ ▸ TTL Live │                                                                    │
│ LABS       │                                                                    │
│ ▸ Stampede │                                                                    │
│ ▸ Serializ │                                                                    │
│ ▸ Errors   │                                                                    │
│ SYSTEM     │                                                                    │
│ ▸ Connect  │                                                                    │
│  ──────    │                                                                    │
│ ns prefix  │                                                                    │
│ :cache-ex  │                                                                    │
└────────────┴──────────────────────────────────────────────────────────────────┘
```

| Route         | Page                      | Primary job                                                                                     | Headline library surface                                                                       |
| ------------- | ------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `/`           | **Overview**              | Cache health at a glance — golden signals, hit-rate trend, keys-by-type/prefix, expiry analysis | `info`, `isHealthy`, `ping`, app metrics                                                       |
| `/explorer`   | **Key Explorer**          | Browse the namespace, inspect any key's value + TTL, delete, pin, flush                         | `scan` · `keys` · `getRaw` · `ttl` · `del` · `persist` · `flushNamespace`                      |
| `/playground` | **Data Types Playground** | Fire every cache op by hand: strings, numerics, hashes, sets, batch                             | `get/set/setNx/exists` · `incr/decr` · `hset/hgetall/hdel` · `sadd/smembers/...` · `mget/mset` |
| `/tenants`    | **Namespace & Tenants**   | Prove namespace isolation + per-tenant prefix scoping                                           | `KeyBuilder` · `scan` · `delMany` · `getClient` (foreign-ns) · `flushNamespace`                |
| `/pubsub`     | **Pub/Sub**               | Publish from the browser; watch fan-out across tabs; pattern subscriptions                      | `PubSubService.publish/subscribe/psubscribe` · `Unsubscribe`                                   |
| `/ttl`        | **TTL Live**              | Live countdown rings + a keyspace-notification expiry feed                                      | `set(ttl)` · `expire` · `ttl` · `BYMAX_CACHE_CONNECTION` raw subscriber                        |
| `/stampede`   | **Stampede Lab**          | Fire N concurrent misses; watch a single-flight Lua lock                                        | `ScriptManagerService` · `eval`                                                                |
| `/serializer` | **Serializer Lab**        | JSON vs MessagePack: stored bytes vs decoded value                                              | `getRaw/setRaw` · `BYMAX_CACHE_SERIALIZER` · `SerializableValue`                               |
| `/errors`     | **Error Explorer**        | Trigger each `CacheException`; read code + HTTP status + body                                   | `CACHE_ERROR_CODES` · `CacheException` · `/shared` types                                       |
| `/connection` | **Connection & Topology** | Lifecycle event feed, mode (standalone/sentinel/cluster), `INFO`                                | `events.onEvent` · `CacheConnectionStatus` · `info`                                            |

---

## 4 · Global controls

Four controls live in the top bar; the Explorer's filters and the metric time range are persisted in the **URL** (via `nuqs` typed search params) so any view is a shareable deep-link.

- **Namespace indicator** — a read-only mono chip `ns: cache-example`.
  > 🎓 The library binds **one `namespace` per module instance** (spec §12.4). It is shown, not switched. Multi-tenancy is **prefix scoping** inside this namespace — that is the Tenant switcher below, not a namespace switcher.
- **Tenant switcher `[ acme ▾ ]`** — selects the active tenant prefix (`acme` / `globex` / …). It scopes the Explorer's default prefix to `tenant:{id}:*` and drives the Tenants page. Switching is reflected in the URL.
- **Connection status chip** — `● ready · 0.4ms · standalone`: status color+icon+text + live round-trip latency + connection mode. Corrected in real time by the `cache:connection` socket feed (§18) and backed by a `/health` poll.
- **Live toggle `⟳`** — turns on the WebSocket feeds (events, expiry, Pub/Sub) wherever a live surface is shown. Off by default on first load; the Overview's ops/sec stream has its own **pause** affordance.
- **Time range** (metric charts only) — relative presets `Last 5m / 15m / 1h`. Drives the sampled metric series (hit-rate, ops/sec, latency, memory). Buckets auto-scale to ~60–120 points.

---

## 5 · Page — Overview (cache health)

The landing page. Strict top-left-first, general→specific. Every breakdown is **click-to-filter** (clicking a slice/bar pivots to the Explorer with that data-type or prefix applied); the timeseries panels are **brushable** (drag sets the global time range).

```
┌─ HEALTH STRIP (cache golden signals) ──────────────────────────────────────────────┐
│ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌──────────┐ │
│ │ HIT RATE  │ │ THROUGHPUT│ │ LATENCY   │ │ MEMORY    │ │ KEYS (ns) │ │ EXPIRED  │ │
│ │  94.2% ◕  │ │ 1.2k op/s │ │ p95 0.6ms │ │ 38MB /512 │ │   1,204   │ │ 22 /1m   │ │
│ │ ▁▂▃▅▆▆▇   │ │ ▁▂▃▅▃▂▁   │ │ ▁▁▂▂▁▁    │ │ ▓▓░░ 7%   │ │ ▲ +18     │ │ evict 0  │ │
│ │ green>90% │ │ (streaming│ │ p50/95/99 │ │ used/max  │ │ in ns     │ │ ttl-driven│ │
│ └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘ └──────────┘ │
├─ HIT / MISS OVER TIME (signature panel — stacked area, BRUSHABLE) ──────────────────┤
│  ratio                                                                              │
│  100% ▁▂▃▅▆▇▇▇▇▇▇   hit (green)                                                      │
│       ▔▔▔▔▔▔░░░░░   miss (amber)   ← drag to zoom → sets time range + Explorer       │
│   0%  └──────────────── time ──────────────┘                                        │
├─ THROUGHPUT & LATENCY ROW ──────────────────────────────────────────────────────────┤
│ ┌─ Ops/sec (instantaneous_ops_per_sec) ─┐ ┌─ Command latency p50/p95/p99 ─────────┐ │
│ │  streaming area  ▂▃▅▃▂▃▅▅▃   [⏸ pause] │ │  p99 ───╮  (lines; µs precision)      │ │
│ │  GET ── SET ── DEL (by-command series) │ │  p95 ──╮ ╰── never average            │ │
│ └────────────────────────────────────────┘ │  p50 ─╯   slow cmds (SLOWLOG): 1      │ │
│                                             └───────────────────────────────────────┘ │
├─ KEYSPACE BREAKDOWN (bounded dimensions — RedisInsight-style, click-to-filter) ──────┤
│ ┌ Keys by type ┐ ┌ Memory by prefix ───────┐ ┌ Expiry analysis ─┐ ┌ Top prefixes ──┐ │
│ │  ◕ string 61% │ │ product   ████████ 22MB │ │  with TTL  ███ 73%│ │ product   ███ │ │
│ │  hash   24%   │ │ cart      ███ 9MB       │ │  no TTL    █   27%│ │ cart      ██  │ │
│ │  set    15%   │ │ tags      █ 3MB         │ │  (persisted keys) │ │ tags      █   │ │
│ └───────────────┘ └─────────────────────────┘ └───────────────────┘ └───────────────┘│
├─ CONNECTION & PIPELINE HEALTH ──────────────────────────────────────────────────────┤
│  status ● ready   mode standalone   uptime 4h12m   clients 3   last event: ready     │
│  fragmentation 1.08   evicted_keys 0   expired_keys 22   (INFO-sourced)              │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Panel specifics** (full catalog in [§15](#15--chart--panel-catalog)):

- **Health strip** — six golden-signal stat tiles, each with a sparkline and Δ vs the previous equal window. **Hit rate** is a small **gauge** (green > 90%, amber 50–90%, red < 50%) with the exact % beside it. **Memory** is a mini **bullet/gauge** of `used_memory` vs `maxmemory`. Throughput, Latency, Keys, Expired are stat + sparkline.
- **Hit / Miss over time** — the signature panel: a stacked **area** of hit-ratio per bucket; doubles as the time selector (drag-to-brush). Sourced from per-prefix app counters (precise, see §17.3) cross-checked against `INFO stats` `keyspace_hits/misses`.
- **Throughput & latency row** — left: a **streaming area** of ops/sec split by command (GET/SET/DEL) with a **pause** button (a11y); right: latency **percentile lines** (p50/p95/p99, µs precision) + a slow-command count from `SLOWLOG`.
- **Keyspace breakdown** — RedisInsight-inspired, all bounded dimensions: **Keys by type** donut (string/hash/set), **Memory by prefix** horizontal bar (`MEMORY USAGE` sampled per prefix), **Expiry analysis** (% keys with vs without TTL), **Top prefixes** by key count. Each is click-to-filter into the Explorer.
- **Connection & pipeline health** — status, mode, uptime, connected clients, fragmentation ratio, `evicted_keys`, `expired_keys` — straight from `INFO`, so the library's connection state and Redis saturation are observable.

> 🎓 _Scoped demo of **cache observability**. Hit/miss here is tracked **in-process per prefix** (a NestJS interceptor, reset on restart) for an exact per-prefix breakdown; server-wide it is cross-checked against Redis `INFO stats`. A real deployment scrapes `INFO` with Prometheus + Grafana or a managed-Redis metrics API._

All panels are fed by **server-side endpoints** (`GET /metrics`, `GET /admin/info`, `GET /admin/keyspace` — §16); the browser never SCANs the keyspace to build a chart.

---

## 6 · Page — Key Explorer

The daily driver — a namespace key browser modeled on RedisInsight's Browser + a value inspector. A filter rail, a key list, and a detail drawer.

```
┌─ FILTERS ─┐┌─ KEY BROWSER ─────────────────────────────────────────────────────────┐
│ prefix    ││ prefix:product  pattern:*  tenant:acme  strategy:(●scan ○keys)  [Scan] │
│  ☑ product││   ▸ resolved match: cache-example:product:*   (KeyBuilder)   [⟳ Live]  │
│  ☐ cart   │├───────────────────────────────────────────────────────────────────────┤
│  ☐ tags   ││ key                              type   ttl        size    │           │
│  type     ││ cache-example:product:42         string 00:28 ◔    312 B   │ ⋮         │
│  ☑ string ││ cache-example:product:43         string —    ∞     298 B   │ ⋮         │
│  ☐ hash   ││ cache-example:cart:u_7           hash   01:54 ◕    1.2 KB  │ ⋮         │
│  ☐ set    ││ cache-example:tags:42            set    —    ∞     64 B    │ ⋮         │
│  ttl      ││ … cursor-paged via SCAN (count=200) — non-blocking, infinite scroll ↓ │
│  ☑ has    ││ ───────────────────────────────────────────────────────────────────── │
│  ☐ none   ││ ▼ DETAIL DRAWER (row click)                                           │
│           ││  Value │ Raw │ TTL │ Metadata                                          │
│ [scan]    ││  key  cache-example:product:42        [copy][refresh][delete][persist] │
│  ⚠ keys   ││  ttl  00:00:28  ◔  [Extend +60s] [Persist ∞]                           │
│  blocks   ││  { "id":"42","name":"Widget","price":9.9,"tags":["a"] }  (JsonViewer)  │
└───────────┘└───────────────────────────────────────────────────────────────────────┘
```

**Filter rail** — `prefix`, `type` (string/hash/set), and `ttl` (has-TTL / no-TTL) as facets; the active `tenant` from the global control scopes the default prefix. All filters live in the URL.

**Scan strategy toggle `(scan | keys)`** — the teaching control:

- **`scan`** (default) → `CacheService.scan(prefix, pattern, count)`, a cursor-based async iterable, **non-blocking**, safe in production, with infinite-scroll paging.
- **`keys`** → `CacheService.keys(prefix, pattern)`, shown with a persistent **⚠ "O(N) — blocks the server, dev only"** warning badge.
- In **cluster mode** both are disabled with a callout (`UNSUPPORTED_IN_CLUSTER`, spec §15.4).
- The drawer shows the **resolved key pattern** the `KeyBuilder` produced (`cache-example:product:*`) so namespacing is tangible.

**Key list** — a virtualized table (TanStack Table + Virtual): columns `key` (mono), `type` (chip), `ttl` (a small **draining ring** + `mm:ss`, `∞` for persisted, `—` for none), `size` (`MEMORY USAGE`, fetched lazily/on-demand). Newest-first; cursor paging via SCAN.

**Detail drawer** (row click) — four tabs:

1. **Value** — the deserialized value (`get` / `hgetall` / `smembers` by type) in a collapsible `@uiw/react-json-view` tree.
2. **Raw** — the raw stored string (`getRaw`) — for the serializer story (§12), shows exactly what bytes Redis holds.
3. **TTL** — live countdown ring + **[Extend +60s]** (`expire`) and **[Persist ∞]** (`persist`).
4. **Metadata** — type, encoding, byte size (`MEMORY USAGE`), and the key's composed segments.

Row/drawer actions: **copy key**, **copy value**, **refresh**, **delete** (`del`), **persist**. A namespace-level **[Flush namespace]** button sits in the page header, guarded — it calls `flushNamespace()` and shows the production-guard (`403 cache.flush_disabled_in_production`) when `NODE_ENV=production` (spec §19).

> 🎓 _Per-key **size** uses Redis `MEMORY USAGE key` and is fetched on demand (not for every row up front) — bulk memory analysis is sampled, like RedisInsight's analyzer._

---

## 7 · Page — Data Types Playground

The "fire every cache operation by hand" page — the analog of how the sibling examples exercise every library feature. One card per Redis data structure; fire an op, see the typed result, and a **"View in Explorer →"** link pre-filtered to the resulting key.

```
┌─ STRINGS ───────────────────────┐ ┌─ NUMERICS ──────────────────────┐
│ key [product:99] val [{...}]     │ │ key [views:42]                   │
│ ttl [60]  [ set ] [ setNx ]      │ │ [ incr ] [ incr +5 ] [ decr ]    │
│ [ get ] [ getRaw ] [ exists ]    │ │  → 1 → 6 → 5  (atomic counter)   │
│ → hit: { id:"99", … }            │ │                                  │
└──────────────────────────────────┘ └──────────────────────────────────┘
┌─ HASHES (cart) ─────────────────┐ ┌─ SETS (tags) ───────────────────┐
│ key [cart:u_7]                   │ │ key [tags:42]                    │
│ field [sku_1] val [2]            │ │ member [sale]                    │
│ [ hset ] [ hget ] [ hgetall ]    │ │ [ sadd ] [ srem ] [ sismember ]  │
│ [ hdel ]  → { sku_1:2, sku_9:1 } │ │ [ smembers ] [ scard ]  → 3      │
└──────────────────────────────────┘ └──────────────────────────────────┘
┌─ BATCH ─────────────────────────────────────────────────────────────┐
│ ids [40,41,42]   [ mget ]  → [null, {…}, {…}]                         │
│ entries [(40,{…}),(41,{…})]   [ mset ]   (one round-trip)             │
└──────────────────────────────────────────────────────────────────────┘
```

**Specifics:**

- Each card maps 1:1 to a `CacheService` group (spec matrix rows 13–22). Inputs are typed; results render as a JSON tree or a scalar badge.
- **Honest labels:** the Sets card notes "**raw string members** — the serializer is intentionally not applied to set members" (library behaviour). The Strings card's `getRaw` shows the serialized string beside `get`'s decoded value.
- Every fired op toasts (`sonner`) the operation + result and offers **"View in Explorer →"**.
- A small **"resulting key"** line shows the `KeyBuilder` output (`cache-example:product:99`) for every op — reinforcing namespacing.

---

## 8 · Page — Namespace & Tenants

Proves the two isolation stories honestly (spec §12.3–§12.4): app-level **namespace** isolation, and in-namespace **per-tenant prefix** scoping.

```
┌─ TENANT A: acme ─────────────────────┐ ┌─ TENANT B: globex ───────────────────┐
│ prefix tenant:acme:product            │ │ prefix tenant:globex:product          │
│ keys 14   hit 91%   [ Seed 10 ]       │ │ keys 9    hit 88%   [ Seed 10 ]       │
│ ┌─ keys ───────────────────────────┐  │ │ ┌─ keys ───────────────────────────┐ │
│ │ tenant:acme:product:1   00:42 ◕  │  │ │ │ tenant:globex:product:1  01:10 ◕ │ │
│ │ tenant:acme:product:2   00:31 ◔  │  │ │ │ …                                │ │
│ └──────────────────────────────────┘  │ │ └──────────────────────────────────┘ │
│ [ Clear this tenant ]  (scan+delMany) │ │ [ Clear this tenant ]                │
└───────────────────────────────────────┘ └───────────────────────────────────────┘
┌─ ISOLATION PROOF ───────────────────────────────────────────────────────────────┐
│ [ Seed FOREIGN namespace (other-app:*) ]   ← writes via getClient() raw, un-ns'd  │
│ [ Flush namespace (cache-example:*) ]       ← SCAN + UNLINK, guarded              │
│ result:  ✓ cleared 23 keys under cache-example   ✓ other-app:demo SURVIVED        │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Specifics:**

- **TenantSplit** — two side-by-side panels; "Clear this tenant" runs `scan('tenant:{id}', '*')` → `delMany`, leaving the other tenant intact (proves prefix scoping).
- **Isolation proof** — "Seed foreign namespace" writes `other-app:demo` via `getClient()` (raw, un-namespaced — the documented anti-pattern, labelled as such); "Flush namespace" runs `flushNamespace()` and the result line shows the `cache-example:*` keys gone and the foreign key **surviving** — proving the namespace boundary.
- A callout restates the design honesty: _"`namespace` is fixed per instance; tenants are prefixes. The production 'namespace per tenant' pattern is one app instance per tenant with `namespace` from env (spec §12.4)."_

---

## 9 · Page — Pub/Sub (real-time)

Publish from the browser, watch the message fan out to every connected tab. Demonstrates `PubSubService.publish/subscribe/psubscribe` and the ref-counted `Unsubscribe`.

```
┌─ PUBLISH ───────────────────────────┐ ┌─ SUBSCRIPTIONS ─────────────────────┐
│ channel [product-events]             │ │ ☑ product-events      (subscribe)    │
│ payload [{ "type":"price", … }]      │ │ ☑ product:*           (psubscribe)   │
│ [ Publish ]   → delivered to 2 subs  │ │ refs: product-events ×2  → unsub×1   │
└──────────────────────────────────────┘ │ [ + add ] [ unsubscribe ]            │
                                          └──────────────────────────────────────┘
┌─ LIVE FEED (newest on top, ring-buffered) ──────────────────────────────────────┐
│ 10:12:44.512  product-events      { "type":"price","id":"42","cents":990 }       │
│ 10:12:44.498  product:42 (≈ *)    { "type":"view","id":"42" }   ← pattern match   │
│ 10:12:43.110  product-events      { "type":"stock","id":"43","qty":0 }           │
│ … fan-out across all open tabs · open a 2nd tab to watch delivery                │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Specifics:**

- **Publish** card → `POST /pubsub/publish` → `PubSubService.publish(channel, payload)`; the response shows the **subscriber count** the library returns.
- **Subscriptions** card → toggle exact-channel `subscribe` and pattern `psubscribe` (e.g. `product:*`); shows the **ref-count** per channel and demonstrates that subscribing twice + unsubscribing once keeps delivery alive (the library's ref-counted `Unsubscribe`); double-unsubscribe is safe.
- **Live feed** — an `EventFeed` of `cache:event` socket messages (channel + payload + timestamp), newest on top, bounded ring buffer; pattern-matched messages show the matching pattern.
- A callout: _"channels are **namespaced** — `publish('product-events')` hits `cache-example:product-events`; both sides go through the library, so the namespace matches transparently (spec §17.1)."_

---

## 10 · Page — TTL Live (real-time)

The headline "watch it expire" page. Live countdown rings driven by `ttl`, and an **expiry event feed** driven by Redis keyspace notifications via the raw subscriber.

```
┌─ COUNTDOWN WALL ────────────────────────────────────────────────────────────────┐
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                              │
│  │   ◕ 28s │  │   ◔ 11s │  │   ◷ 54s │  │   ✦ ∞   │   [ Seed key w/ TTL: 30s ]   │
│  │ product │  │ product │  │ cart    │  │ product │   [ Seed persisted (∞) ]     │
│  │ :42     │  │ :43     │  │ :u_7    │  │ :pinned │                              │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘                              │
├─ EXPIRY EVENTS (keyspace notifications — __keyevent@0__:expired) ─────────────────┤
│ 10:12:44.001  EXPIRED  cache-example:product:43   → card fades, toast "re-fetch"  │
│ 10:12:30.000  EXPIRED  cache-example:cart:u_3                                      │
│ … filtered to our namespace prefix; foreign-ns expiries are ignored               │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Specifics:**

- **Countdown wall** — `TtlRing` components (custom SVG radial progress) that drain client-side from the `ttl` value; on reaching zero they wait for the server's expiry event to confirm (no optimistic removal).
- **Expiry feed** — when a key expires, Redis fires `__keyevent@0__:expired`; the `ttl-events` service (raw subscriber via `BYMAX_CACHE_CONNECTION` → `createSubscriberClient()`, filtered by `KeyBuilder.getNamespacePrefix()`, spec §17.3) emits `cache:expired`; the UI fades the matching card and toasts **"Key expired — re-fetching…"**, then the next read re-populates.
- A callout explains why this uses the **raw subscriber, not `PubSubService`** (the library namespaces app channels; Redis keyspace channels are fixed and outside the namespace) — and that `redis.conf` must set `notify-keyspace-events Ex` (spec §21.2).

---

## 11 · Page — Stampede Lab

Fire N concurrent requests for an uncached key and watch a single-flight Lua lock collapse them into **one** origin fetch. Demonstrates `ScriptManagerService` + `CacheService.eval`.

```
┌─ CONTROLS ──────────────────────────────────────────────────────────────────────┐
│ productId [77]   concurrency [10]   lockMs [2000]    [ Fire 10 requests ]         │
│ script: acquireLock   sha: a3f1c9…   (ScriptManagerService.load)                  │
├─ TIMELINE (swimlane — one lane per request) ──────────────────────────────────────┤
│ req#1  ▐█ LOCK WON ──────▶ origin fetch (412ms) ──▶ SET ──▶ release      ✓ hit src │
│ req#2  ▐· wait ···········································▶ cache HIT       ✓ cached  │
│ req#3  ▐· wait ···········································▶ cache HIT       ✓ cached  │
│ …                                                                                 │
│ req#10 ▐· wait ···········································▶ cache HIT       ✓ cached  │
├─ RESULT ──────────────────────────────────────────────────────────────────────────┤
│ origin fetches: 1 / 10   ·   cache hits: 9 / 10   ·   hit rate 90%   ·   saved 9× │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Specifics:**

- **Controls** → `POST /stampede?productId=&concurrency=&lockMs=`; shows the registered script name and its resolved **SHA1** (via `ScriptManagerService.load('acquireLock')`).
- **StampedeTimeline** — a custom swimlane: the lock **winner** (`eval` returns `1`) shows LOCK WON → origin fetch → SET → release; **losers** (`0`) show a brief wait → cache HIT. The result strip shows origin-fetches vs hits and the multiplier saved.
- Callout: _"keys are **namespaced by `eval`** (`cache-example:stampede:77`); the Lua body is declared in code (`IScriptDefinition`), never built from request input (spec §18, §24)."_

---

## 12 · Page — Serializer Lab

Store the same object with the default `JsonSerializer` and a custom `MsgPackSerializer`; compare the **raw stored bytes** to the **decoded value**, and see the JSON round-trip caveats.

```
┌─ INPUT ─────────────────────────────────────────────────────────────────────────┐
│ payload [{ "id":42, "when":"2026-06-01T...", "tags":["a","b"] }]                  │
│ codec ( ● json   ○ msgpack )     [ Round-trip ]                                   │
├─ JSON ──────────────────────────────┬─ MSGPACK ─────────────────────────────────┤
│ raw (getRaw):                        │ raw (getRaw):                              │
│   {"id":42,"when":"2026-...","tags…} │   gaJpZCo... (base64, 31 B)  ← smaller     │
│ decoded (get):                       │ decoded (get):                             │
│   { id:42, when:"2026-…"(string!) }  │   { id:42, when:"2026-…", tags:[…] }       │
│ ⚠ Date became an ISO string          │ note: structure-preserving codec           │
└──────────────────────────────────────┴────────────────────────────────────────────┘
```

**Specifics:** side-by-side `getRaw` (bytes) vs `get` (decoded) for each codec; a **`SerializableValue` caveat** banner shows that `Date`/`Map`/`Set`/`BigInt` don't survive JSON (spec §16). The injected serializer is read via `BYMAX_CACHE_SERIALIZER`.

---

## 13 · Page — Error Explorer

Trigger each `CacheException` and read its **code + HTTP status + structured body** — typed end-to-end with `CacheErrorCode` from the library's `/shared` subpath.

```
┌─ TRIGGERS ──────────────────────────┐ ┌─ RESPONSE ──────────────────────────────┐
│ ▸ invalid_key            [Trigger]   │ │ POST /errors/flush_disabled_in_production│
│ ▸ deserialization_failed [Trigger]   │ │ HTTP 403                                 │
│ ▸ script_not_registered  [Trigger]   │ │ {                                        │
│ ▸ flush_disabled_in_prod [Trigger]   │ │   "error": {                             │
│ ▸ unsupported_in_cluster [Trigger]   │ │     "code": "cache.flush_disabled_in_..." │
│ ▸ command_timeout        [Trigger]   │ │     "message": "Flush is disabled in …"  │
│ … (all 15 CACHE_ERROR_CODES)         │ │     "details": null                      │
│ [ ☐ run API as NODE_ENV=production ] │ │   } }                                    │
└──────────────────────────────────────┘ └──────────────────────────────────────────┘
```

**Specifics:** a list of all 15 `CACHE_ERROR_CODES` with a Trigger button (`POST /errors/:code`); the response panel shows the status, the structured `{ error: { code, message, details } }` body, and the canonical message from `CACHE_ERROR_MESSAGES`. A toggle restarts the API in `production` mode to demonstrate the `flushNamespace` guard live. Each row is color+icon+text by severity class (4xx amber, 5xx red, 504 purple).

---

## 14 · Page — Connection & Topology

The library's connection lifecycle and Redis-server view.

```
┌─ STATUS ────────────────────────────┐ ┌─ LIFECYCLE EVENTS (events.onEvent) ─────┐
│ ● ready   mode standalone            │ │ 10:08:01  ready        { role:'main' }   │
│ latency 0.4ms (ping)                 │ │ 10:08:01  connect                        │
│ uptime 4h12m   clients 3             │ │ 10:07:59  reconnecting { delay: 200 }    │
│ [ standalone | sentinel | cluster ]  │ │ … color+icon+text per CacheEventName     │
└──────────────────────────────────────┘ └──────────────────────────────────────────┘
┌─ INFO (sections) ───────────────────────────────────────────────────────────────┐
│ [ server | clients | memory | stats | replication ]                              │
│ used_memory 38.2M   maxmemory 512M   keyspace_hits 11,920   keyspace_misses 740   │
│ instantaneous_ops_per_sec 1,204   mem_fragmentation_ratio 1.08   …                │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Specifics:**

- **Status** — `CacheConnectionStatus` badge (color+icon+text), `ping()` latency, mode. The mode selector documents the active `CACHE_MODE` and, with the matching Docker profile up, lets the reader watch the same admin action **succeed in standalone** and **fail with `UNSUPPORTED_IN_CLUSTER`** in cluster (spec §15.4).
- **Lifecycle feed** — `cache:connection` socket messages from the `events.onEvent` bridge (`connect/ready/error/close/reconnecting/end`), each rendered with the status palette.
- **INFO** — a section picker (`server/clients/memory/stats/replication`) rendering parsed `info(section)` output as a mono key/value grid.

> 🎓 _Scoped demo of **connection observability**. `events.onEvent` is the library's official hook; the spec also documents bridging it to `@bymax-one/nest-logger` in production (spec §20.4)._

---

## 15 · Chart & panel catalog

Every chart is fed by a **server-side endpoint** (`/metrics`, `/admin/info`, `/admin/keyspace`); the browser never crunches raw keys. Library: **Recharts v3** via shadcn chart primitives, plus two bespoke SVG components (`TtlRing`, `StampedeTimeline`).

| Panel                    | Chart type                   | Source                                     | Notes                                                  |
| ------------------------ | ---------------------------- | ------------------------------------------ | ------------------------------------------------------ |
| Hit rate tile            | **Gauge** + sparkline        | app counters ⨉ `INFO stats`                | green > 90%, amber 50–90%, red < 50%; numeric % beside |
| Throughput tile          | Stat + sparkline             | `INFO stats.instantaneous_ops_per_sec`     | ops/sec                                                |
| Latency tile             | Stat                         | sampled `ping` / command timings           | p95, µs precision                                      |
| Memory tile              | **Bullet / gauge**           | `INFO memory.used_memory` / `maxmemory`    | saturation %                                           |
| Keys tile                | Stat + Δ                     | `DBSIZE` scoped to namespace (SCAN count)  | total keys in ns                                       |
| Expired/evicted tile     | Stat                         | `INFO stats.expired_keys` / `evicted_keys` | per window                                             |
| **Hit / miss over time** | **Stacked area (brushable)** | per-bucket app counters                    | signature panel + time selector                        |
| Ops/sec                  | **Streaming area**           | `instantaneous_ops_per_sec` series         | pause control (a11y); GET/SET/DEL series               |
| Latency percentiles      | **Lines (p50/p95/p99)**      | sampled command timings                    | never average; µs precision                            |
| Keys by type             | **Donut**                    | SCAN + `TYPE` sample / app registry        | bounded (string/hash/set)                              |
| Memory by prefix         | **Horizontal bar**           | `MEMORY USAGE` sampled per prefix          | RedisInsight "by prefix"                               |
| Expiry analysis          | **Stacked bar / donut**      | SCAN + `TTL` sample                        | % with vs without TTL                                  |
| Top prefixes             | **Horizontal bar**           | key-count by prefix (top-N)                | bounded                                                |
| TTL countdown            | **Radial ring (custom SVG)** | `ttl(prefix,id)`                           | drains client-side; confirmed by expiry event          |
| Stampede timeline        | **Swimlane (custom SVG)**    | `/stampede` result log                     | one lane per request                                   |
| Pub/Sub feed             | **Event list**               | `cache:event` socket                       | ring-buffered, newest-on-top                           |
| Lifecycle feed           | **Event list**               | `cache:connection` socket                  | status palette                                         |

> **Bounded-dimension rule:** chart `group by` is only ever **data-type**, **key prefix**, **namespace**, or **tenant**. Individual keys / ids are **search/drill-down only** — never a chart dimension (unbounded cardinality).

> **Accessibility (charts):** the streaming ops/sec panel has a **pause** control (no unstoppable motion); every status/severity encoding is color **+** icon **+** text; each chart ships a screen-reader summary / data-table fallback.

---

## 16 · The backing API (`apps/api`)

The dashboard is powered by the feature + admin modules in `apps/api` (spec §10–§11). No new datastore — it reads the one Redis through the library, plus an in-process metrics counter. Same filter object across the admin reads so the Explorer is transparent.

| Method & route                                              | Purpose                   | Notes                                                                          |
| ----------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------ |
| `GET /admin/keys`                                           | Key browser page          | `?prefix=&pattern=&tenant=&strategy=scan\|keys&cursor=&limit=`; SCAN cursor    |
| `GET /admin/keys/:key`                                      | Inspect a key             | value (`get`/`hgetall`/`smembers` by type) + `getRaw` + `ttl` + `MEMORY USAGE` |
| `DELETE /admin/keys/:key`                                   | Delete a key              | `del`                                                                          |
| `POST /admin/keys/:key/persist` · `/expire`                 | TTL ops                   | `persist` / `expire`                                                           |
| `POST /admin/seed?count=N`                                  | Bulk seed                 | `pipeline()`                                                                   |
| `DELETE /admin/namespace`                                   | Flush namespace           | `flushNamespace()` (guarded)                                                   |
| `GET /admin/info?section=`                                  | Redis INFO                | `info(section?)` parsed to key/value                                           |
| `GET /admin/keyspace`                                       | Breakdown panels          | keys-by-type, memory-by-prefix, expiry analysis (sampled)                      |
| `GET /metrics`                                              | App hit/miss + ops series | in-process per-prefix counters + sampled INFO                                  |
| `GET /health`                                               | Status chip               | `isHealthy` + `ping` latency                                                   |
| `GET /catalog/*` · `/counters/*` · `/collections/*`         | Playground ops            | the data-structure groups                                                      |
| `GET/DELETE /tenants/*`                                     | Tenants page              | prefix scoping + foreign-ns seed                                               |
| `POST /pubsub/publish` · `/subscribe`                       | Pub/Sub                   | `publish` / `subscribe` / `psubscribe`                                         |
| `POST /stampede`                                            | Stampede lab              | Lua `eval`                                                                     |
| `POST /serializer/roundtrip`                                | Serializer lab            | `getRaw`/`setRaw` + codec                                                      |
| `GET /serializer/active`                                    | Serializer lab            | injected `BYMAX_CACHE_SERIALIZER`                                              |
| `POST /serializer/caveat`                                   | Serializer lab            | `Date` caveat (lossy JSON vs msgpack)                                          |
| `POST /errors/:code`                                        | Error Explorer            | per-code triggers                                                              |
| **WS** `cache:connection` · `cache:event` · `cache:expired` | Live feeds                | socket.io gateway (§18)                                                        |

**Shared filter DTO** (Zod-validated; spec §23.4 — no Swagger):

```typescript
// admin/dto/key-query.dto.ts
export interface KeyQuery {
  prefix?: string // entity-group prefix (e.g. 'product')
  pattern?: string // glob for the id segment (default '*')
  tenant?: string // scopes prefix to `tenant:{id}:…`
  type?: 'string' | 'hash' | 'set'
  hasTtl?: boolean
  strategy: 'scan' | 'keys' // scan (cursor, default) | keys (dev-only, blocks)
  cursor?: string // opaque SCAN cursor
  limit?: number // default 200
}
```

---

## 17 · Reading Redis: key model, metrics & queries

There is **no database**. The "data model" is the cache itself; the dashboard reads it three ways.

### 17.1 Key model

Every key is `{namespace}{separator}{prefix}{separator}{id}` — with this app's config, `cache-example:product:42`. The Explorer's filters compose through the library's `KeyBuilder`, never by hand:

```typescript
// admin builds the SCAN match through the library, preserving the namespace
const matchPrefix = tenant ? `tenant:${tenant}:${prefix}` : prefix
for await (const key of cache.scan(matchPrefix, pattern ?? '*', 200)) {
  // key === 'cache-example:tenant:acme:product:1' — fully namespaced
}
```

### 17.2 Metrics from `INFO` (server-wide)

`CacheService.info(section)` → parsed to a record. The dashboard reads:

| Field                                                          | Panel                              |
| -------------------------------------------------------------- | ---------------------------------- |
| `stats.keyspace_hits` / `keyspace_misses`                      | hit rate (server-wide cross-check) |
| `stats.instantaneous_ops_per_sec`                              | throughput                         |
| `memory.used_memory` / `maxmemory` / `mem_fragmentation_ratio` | memory saturation                  |
| `stats.expired_keys` / `evicted_keys`                          | expiry/eviction tiles              |
| `clients.connected_clients`, `server.uptime_in_seconds`        | connection panel                   |

```typescript
// admin/info.parser.ts — Redis INFO is `field:value\r\n` grouped by `# Section`
export function parseInfo(raw: string): Record<string, Record<string, string>> {
  /* … */
}
```

### 17.3 Hit/miss per prefix (in-process, precise)

A `MetricsService` increments per-prefix hit/miss counters from a NestJS interceptor wrapping the catalog reads — giving an **exact per-prefix breakdown** the server-wide `INFO` can't (it has no notion of the app's prefixes). Reset on restart; clearly labelled app-level (§5 callout).

> 🎓 _Two sources, on purpose: **app counters** for the per-prefix breakdown (precise, scoped), **Redis `INFO`** for server-wide truth (hits/misses/ops/memory). A real deployment scrapes `INFO` into Prometheus + Grafana._

---

## 18 · Real-time architecture (WebSocket)

End-to-end live updates, server to browser.

> **Why WebSocket, not SSE.** `nest-logger-example` streams a one-way log tail and chose **SSE** (its sweet spot). This app multiplexes **three** event types — connection lifecycle, Pub/Sub messages, and keyspace-expiry — and the API already standardizes on a **`@nestjs/platform-socket.io`** gateway (spec §3, §17.2). socket.io gives multiplexed rooms, auto-reconnect, and a clean fit with the library's Pub/Sub bridge. The feeds are still strictly server→client; the browser "publishes" via the REST `POST /pubsub/publish`, not the socket.

**NestJS gateway** — one gateway, three emit channels:

```typescript
// events/events.gateway.ts
@WebSocketGateway({ cors: { origin: process.env.WEB_ORIGIN } })
export class EventsGateway {
  @WebSocketServer() private server!: Server

  /** Connection lifecycle (from the ICacheEvents bridge, spec §20.1). */
  emitConnectionEvent(event: CacheEventName, data: Record<string, unknown>): void {
    this.server.emit('cache:connection', { event, data, at: Date.now() })
  }
  /** Pub/Sub fan-out (server subscribes once via PubSubService, re-emits to all tabs). */
  emitMessage(channel: string, payload: unknown): void {
    this.server.emit('cache:event', { channel, payload, at: Date.now() })
  }
  /** TTL expiry (from the raw keyspace subscriber, spec §17.3). */
  emitExpired(key: string): void {
    this.server.emit('cache:expired', { key, at: Date.now() })
  }
}
```

**Next.js consumer** — one socket, a small hook with a bounded ring buffer + rAF-batched flush (so a high-rate Pub/Sub burst never freezes the tab):

```typescript
// lib/socket.ts + hooks/use-cache-socket.ts
export function useCacheSocket(enabled: boolean) {
  const [buffer] = useState(() => new RingBuffer<CacheEvent>(5_000)) // drop-oldest
  useEffect(() => {
    if (!enabled) return
    const socket = io(process.env.NEXT_PUBLIC_WS_URL!, { transports: ['websocket'] })
    const pending: CacheEvent[] = []
    let raf = 0
    const onAny = (e: CacheEvent) => {
      pending.push(e)
      raf ||= requestAnimationFrame(() => {
        buffer.pushMany(pending.splice(0))
        raf = 0
      })
    }
    socket.on('cache:event', onAny)
    socket.on('cache:expired', onAny)
    socket.on('cache:connection', onAny)
    return () => {
      socket.close()
    }
  }, [enabled])
  return buffer
}
```

The TTL wall and Pub/Sub feed read from the buffer; follow-mode (auto-scroll when pinned to bottom, pause on scroll-up, "N new — jump to latest" pill) lives in the feed component.

---

## 19 · Frontend tech stack & design system

`apps/web` adopts the **shared Bymax example-apps design system verbatim** so every reference app is visually one product. The tech below is the data/UX layer; the design tokens are copied 1:1 and are fully specified in **[`TECHNICAL_SPECIFICATION.md` §14](TECHNICAL_SPECIFICATION.md#14--design-system)** and the rendered **[`design_system.html`](design_system.html)**.

> **🎨 Canonical UI reference:** [`docs/design_system.html`](design_system.html) — open it in a browser. It is the rendered, project-agnostic design-system guide for all Bymax example apps (tokens, color/type/space, the app shell, live component examples, severity, and an AI-agent recreation guide). This section summarizes it; when building `apps/web`, follow `design_system.html` and **copy the four config files it names** (`app/globals.css`, `tailwind.config.ts`, `components.json`, `postcss.config.mjs`) from a sibling `apps/web`, and **adapt** `app/layout.tsx` from the sibling (identical Geist + forced-`dark` wiring; only the app's `<Providers>`, metadata, and wordmark differ).

### Tech stack

| Concern      | Choice                                                                                                            | Why                                                                                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework    | **Next.js `^16`** (App Router) + **React `^19`** + TypeScript                                                     | matches the sibling examples                                                                                                                                        |
| Styling      | **Tailwind CSS v4** (`@tailwindcss/postcss` only — no `autoprefixer`/`postcss-import`) + **shadcn/ui `new-york`** | identical to the siblings                                                                                                                                           |
| Icons        | **`lucide-react`**                                                                                                | shadcn `iconLibrary: lucide`                                                                                                                                        |
| Fonts        | **`geist`** (`GeistSans` + `GeistMono`)                                                                           | body = Sans; headings/brand/keys/metrics = Mono                                                                                                                     |
| Theme        | **forced dark** (`dark` on `<html>`) — **no `next-themes`**                                                       | the system is dark-only by design                                                                                                                                   |
| Charts       | **Recharts v3** via shadcn chart primitives                                                                       | fed by `/metrics` + `/admin/*`, never raw keys; custom SVG for `TtlRing` + `StampedeTimeline`                                                                       |
| Server state | **TanStack Query v5**                                                                                             | `useQuery` (panels), `useInfiniteQuery` (Explorer SCAN paging)                                                                                                      |
| Live feeds   | **`socket.io-client`**                                                                                            | multiplexed `cache:connection` / `cache:event` / `cache:expired`                                                                                                    |
| Table        | **TanStack Table v8** + **Virtual v3**                                                                            | virtualized key list at 60fps                                                                                                                                       |
| Filter state | **`nuqs` v2** typed URL params                                                                                    | shareable deep-links (Explorer filters, time range) — needs `<NuqsAdapter>` in root layout                                                                          |
| JSON viewer  | **`@uiw/react-json-view`**                                                                                        | key value inspector (collapsible, clipboard)                                                                                                                        |
| Toasts       | **`sonner`** (glass `Toaster`)                                                                                    | identical config to siblings                                                                                                                                        |
| Class utils  | **`cva` + `clsx` + `tailwind-merge`**                                                                             | the `cn()` util + button/badge variants                                                                                                                             |
| Types        | **`@bymax-one/nest-cache/shared`**                                                                                | `CACHE_ERROR_CODES`, `CacheErrorCode`, `CacheConnectionStatus`, `CacheEventName`, `SerializableValue` — the zero-dep subpath, in the **browser bundle** (spec §8.2) |

Install: `next@^16 react@^19 react-dom@^19 tailwindcss@^4 @tailwindcss/postcss geist lucide-react sonner class-variance-authority clsx tailwind-merge` + data libs (`@tanstack/react-query @tanstack/react-table @tanstack/react-virtual nuqs @uiw/react-json-view recharts socket.io-client`). **Do not** add `next-themes`, `autoprefixer`, or `postcss-import`. Remember `<NuqsAdapter>` in the root layout.

### App shell — identical structure, cache nav

Reuse the sibling Topbar + Sidebar shell **classes verbatim**; only the brand label and nav items change.

- **Topbar** — fixed `h-16` (64px), `bg-[rgba(10,10,10,0.85)] backdrop-blur-md border-b border-[rgba(255,255,255,0.07)] z-200`. Left: the orange-bordered brand mark (rounded-lg badge `border-[rgba(255,98,36,0.4)] bg-[rgba(255,98,36,0.15)]` holding the stacked-layers SVG, stroke `#ff6224`) + gradient mono wordmark `from-[#ff6224] to-amber-200 bg-clip-text text-transparent` reading **`nest-cache-example`**. Right: the **global controls** (namespace chip, tenant switcher, connection status chip, Live toggle).
- **Sidebar** — `w-[250px] bg-[rgba(12,12,12,0.98)] border-r border-[rgba(255,255,255,0.08)]`, `lg:sticky lg:top-16 h-[calc(100vh-64px)]`, grouped (OBSERVE / REAL-TIME / LABS / SYSTEM). Item base `flex items-center gap-3 rounded-lg border-l-2 px-3 py-[10px] text-sm transition-all duration-150`; **active** `border-l-[#ff6224] bg-[rgba(255,98,36,0.1)] font-semibold text-[#ff6224]`; inactive `border-l-transparent text-[rgba(255,255,255,0.55)] hover:bg-[rgba(255,255,255,0.05)]`. Footer: the namespace prefix chip.
- **Main** — `<div className="flex pt-16"><Sidebar/><main className="min-w-0 flex-1 px-6 py-8"><div className="mx-auto max-w-5xl">{children}</div></main></div>` (widen to `max-w-7xl` for the chart-heavy Overview/Explorer).

**Cache nav items** (lucide icons), grouped:

| Group     | Label      | href          | Icon              |
| --------- | ---------- | ------------- | ----------------- |
| Observe   | Overview   | `/`           | `LayoutDashboard` |
| Observe   | Explorer   | `/explorer`   | `Search`          |
| Observe   | Playground | `/playground` | `Boxes`           |
| Observe   | Tenants    | `/tenants`    | `Building2`       |
| Real-time | Pub/Sub    | `/pubsub`     | `Radio`           |
| Real-time | TTL Live   | `/ttl`        | `Timer`           |
| Labs      | Stampede   | `/stampede`   | `Zap`             |
| Labs      | Serializer | `/serializer` | `Binary`          |
| Labs      | Errors     | `/errors`     | `TriangleAlert`   |
| System    | Connection | `/connection` | `PlugZap`         |

### Component recipes (verbatim) + cache-specific components

- **Card** — `border-(--glass-border) bg-(--glass-card-bg) rounded-2xl border shadow-sm backdrop-blur-md`; `CardTitle` `font-mono text-xl font-bold`; optional top brand-gradient line.
- **Button (CVA, pill)** — `default` = `bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-sm hover:shadow-(--shadow-primary) hover:scale-[1.02] active:scale-[0.98]`; `outline`/`ghost` use glass tokens. Sizes `h-10 px-6` / `sm h-8 px-4 text-xs` / `lg h-12 px-8` / `icon h-10 w-10`. Async actions **disable + show a spinner** (no double-fire).
- **Badge / chip** — mono; the **key** badge and **type** chips (string/hash/set) and the connection-status chip all use it.
- **Sonner Toaster** — `theme="dark"`, `position="bottom-right"`, glass style, severity left-borders (success green / error red / info blue / warning amber).
- **shadcn set to scaffold:** `button, card, badge, input, label, select, table, tabs, tooltip, dialog, dropdown-menu, popover, scroll-area, skeleton, sonner, command` (command supports the Explorer's quick key search).
- **Cache-specific (custom):** **`MetricTile`** (KPI + sparkline + gauge variant), **`TtlRing`** (SVG radial countdown), **`KeyCard`** / **`KeyRow`**, **`EventFeed`** (ring-buffered, follow-mode), **`StampedeTimeline`** (swimlane), **`TenantSplit`**, **`HitRateGauge`**.

### Status & severity mapping (`lib/cache-status.ts`) — accessible (color + icon + text)

Reuse the design-system severity pattern, mapping `CacheConnectionStatus` / `CacheEventName` and hit/miss to the palette (full table in spec §14.4):

| Surface      | Value → palette                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------- |
| Connection   | `ready` green · `connecting` blue · `reconnecting` amber · `closed`/`end` red · `error` purple |
| Cache result | `hit` green · `miss` amber                                                                     |
| Error code   | 4xx amber · 5xx red · 504 purple (Error Explorer)                                              |
| Data type    | `string` blue · `hash` purple · `set` green (chips)                                            |

> **Net effect:** drop a `nest-cache-example` screenshot beside a `nest-logger-example` or `nest-auth-example` one and the chrome (topbar, sidebar, cards, buttons, fonts, orange brand, glass) is indistinguishable — only the content (keys, TTL rings, hit-rate gauges) differs.

---

## 20 · apps/web file layout

```
apps/web/
├── app/
│   ├── layout.tsx                 # Geist fonts + forced `dark` <html> + <Providers> (NO next-themes)
│   ├── providers.tsx              # 'use client': QueryClientProvider + <NuqsAdapter> + <Toaster/> (glass)
│   ├── globals.css                # ← COPIED VERBATIM from a sibling apps/web (token block + keyframes)
│   ├── page.tsx                   # Overview (cache health)
│   ├── explorer/page.tsx          # Key Explorer
│   ├── playground/page.tsx        # Data Types Playground
│   ├── tenants/page.tsx           # Namespace & Tenants
│   ├── pubsub/page.tsx            # Pub/Sub
│   ├── ttl/page.tsx               # TTL Live
│   ├── stampede/page.tsx          # Stampede Lab
│   ├── serializer/page.tsx        # Serializer Lab
│   ├── errors/page.tsx            # Error Explorer
│   └── connection/page.tsx        # Connection & Topology
├── components.json                # ← shadcn "new-york" (copied; cssVariables, lucide)
├── tailwind.config.ts             # OPTIONAL in v4 — keyframes only; bridge via @config in globals.css
├── postcss.config.mjs             # @tailwindcss/postcss ONLY
├── components/
│   ├── layout/                    # Topbar (64px), Sidebar (250px grouped), AppShell — copied shell
│   ├── controls/                  # NamespaceChip, TenantSwitcher, StatusChip, LiveToggle, TimeRange
│   ├── charts/                    # HitRateGauge, HitMissArea, OpsStream, LatencyLines, TypeDonut,
│   │                              #   MemoryByPrefix, ExpiryAnalysis, MetricTile
│   ├── explorer/                  # FilterRail, KeyTable (virtualized), KeyDetailDrawer, ScanStrategyToggle
│   ├── playground/                # StringsCard, NumericsCard, HashCard, SetCard, BatchCard
│   ├── realtime/                  # EventFeed, TtlRing, CountdownWall
│   ├── labs/                      # StampedeTimeline, SerializerCompare, ErrorTrigger
│   ├── tenants/                   # TenantSplit, IsolationProof
│   └── ui/                        # shadcn primitives
├── lib/
│   ├── api-client.ts              # typed fetch wrappers for the admin/metrics API
│   ├── socket.ts                  # socket.io-client setup (3 channels)
│   ├── filters.ts                 # nuqs parsers + KeyQuery <-> URL
│   ├── cache-status.ts            # CacheConnectionStatus/hit-miss/type → {color, icon, label}
│   └── utils.ts                   # cn()
├── hooks/                         # useKeys (infinite SCAN), useMetrics, useInfo, useCacheSocket, useFollowMode
├── package.json
└── tsconfig.json
```

---

## 21 · References

Grouped by topic; every URL was consulted during the research that produced this spec.

**Cache / Redis observability (how cache data is shown)** — [RedisInsight (official GUI)](https://redis.io/insight/) · [RedisInsight on GitHub](https://github.com/redis/RedisInsight) · [Monitoring performance with RedisInsight (Redis KB)](https://support.redislabs.com/hc/en-us/articles/29058488551826-Monitoring-Performance-with-Redis-Insight) · [How to use RedisInsight for visual monitoring (OneUptime)](https://oneuptime.com/blog/post/2026-03-31-redis-how-to-use-redisinsight-for-visual-monitoring/view) · [Monitor Redis memory with RedisInsight (OneUptime)](https://oneuptime.com/blog/post/2026-03-31-redis-monitor-memory-redisinsight/view) · [Redis observability: metrics, slow log, monitoring at scale (Redis)](https://redis.io/tutorials/operate/redis-at-scale/observability/) · [How to monitor Redis performance metrics (Datadog)](https://www.datadoghq.com/blog/how-to-monitor-redis-performance-metrics/) · [Redis monitoring 101 (SigNoz)](https://signoz.io/blog/redis-monitoring/) · [Redis metrics: monitoring & best practices (Last9)](https://last9.io/blog/redis-metrics-monitoring/) · [Crucial Redis monitoring metrics (ScaleGrid)](https://scalegrid.io/blog/redis-monitoring-metrics/) · [Monitoring & benchmarking cache performance (Stanza)](https://www.stanza.dev/courses/redis-caching/cache-performance/redis-caching-monitoring-benchmarking)

**Methodology** — [Four Golden Signals (Google SRE Book)](https://sre.google/sre-book/monitoring-distributed-systems/) · [The RED Method (Grafana)](https://grafana.com/blog/the-red-method-how-to-instrument-your-services/) · cache hit ratio = `keyspace_hits / (keyspace_hits + keyspace_misses)`, healthy > 90% (cache > 50%); cache latency sub-ms (400–600µs) — per the Redis/SigNoz/ScaleGrid sources above.

**Dashboard design & charts** — [Grafana dashboard best-practices](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/best-practices/) · [Visualize Prometheus histograms (Grafana)](https://grafana.com/blog/2020/06/23/how-to-visualize-prometheus-histograms-in-grafana/) · [Empty states (NN/g)](https://www.nngroup.com/articles/empty-state-interface-design/) · [Skeletons vs spinners (Onething)](https://www.onething.design/post/skeleton-screens-vs-loading-spinners) · [PatternFly status & severity](https://www.patternfly.org/patterns/status-and-severity/) · [Astro UXDS status system](https://www.astrouxds.com/patterns/status-system/)

**Real-time & front-end** — [NestJS WebSockets / Gateways](https://docs.nestjs.com/websockets/gateways) · [socket.io docs](https://socket.io/docs/v4/) · [Redis keyspace notifications](https://redis.io/docs/latest/develop/use/keyspace-notifications/) · [Redis SCAN](https://redis.io/docs/latest/commands/scan/) · [Redis INFO](https://redis.io/docs/latest/commands/info/) · [TanStack Query Advanced SSR](https://tanstack.com/query/v5/docs/framework/react/guides/advanced-ssr) · [TanStack Virtual](https://tanstack.com/virtual/latest) · [nuqs](https://nuqs.dev/) · [@uiw/react-json-view](https://www.npmjs.com/package/@uiw/react-json-view) · [Recharts](https://recharts.org/)

**Project** — [`TECHNICAL_SPECIFICATION.md`](TECHNICAL_SPECIFICATION.md) (authoritative repo blueprint) · [`design_system.html`](design_system.html) (shared Bymax UI source of truth) · `@bymax-one/nest-cache` `README.md` + shipped `.d.ts` (library API authority).

> **Document version:** 1.1 — reconciled with the shipped dashboard. Status: **implemented** — the `apps/web` dashboard (10 pages) and the backing `apps/api` admin/metrics/events modules are built and covered by unit, E2E, and Playwright suites. This file remains the design contract for `apps/web`; see [`TECHNICAL_SPECIFICATION.md` §25](TECHNICAL_SPECIFICATION.md#25--phased-delivery-plan) for the delivery plan. Maintained by **Bymax One** · MIT.
