# Phase 12 — `apps/web` Skeleton + Design System — Tasks

> **Source:** [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#phase-12--appsweb-skeleton--design-system) §Phase 12
> **Total tasks:** 7
> **Progress:** 🔴 0 / 7 done (0%)
>
> **Status legend:** 🔴 Not Started · 🟡 In Progress · 🔵 In Review · 🟢 Done · ⚪ Blocked

## Task index

| ID    | Task                                                                          | Status | Priority | Size | Depends on   |
| ----- | ----------------------------------------------------------------------------- | ------ | -------- | ---- | ------------ |
| P12-1 | `apps/web` Next.js 16 + React 19 + Tailwind v4 + shadcn `new-york` scaffold   | 🔴     | High     | M    | Phase 3      |
| P12-2 | `app/layout.tsx` (Geist + forced `dark`) + `app/providers.tsx`                | 🔴     | High     | M    | P12-1        |
| P12-3 | `components/layout/` — Topbar (64px) + grouped Sidebar (250px) + `AppShell`   | 🔴     | High     | M    | P12-1, P12-2 |
| P12-4 | `lib/api-client.ts` — typed `fetch` wrapper + `CacheErrorCode` error union    | 🔴     | High     | M    | P12-1        |
| P12-5 | `lib/socket.ts` (3 channels) + `hooks/use-cache-socket.ts` (ring buffer + rAF) | 🔴    | High     | M    | P12-1        |
| P12-6 | `lib/cache-status.ts` + `lib/utils.ts` + `components/controls/` (nuqs URL)     | 🔴     | Medium   | M    | P12-2, P12-4 |
| P12-7 | shadcn component set scaffold + phase verification (`build`, shell, status)    | 🔴     | High     | M    | P12-1..P12-6 |

---

## P12-1 — `apps/web` Next.js 16 + React 19 + Tailwind v4 + shadcn `new-york` scaffold

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** M (90 min – half day)
- **Depends on:** `Phase 3`

### Description

Create the `apps/web` package — a Next.js 16 (App Router) + React 19 + Tailwind CSS v4 + shadcn/ui `new-york` application — and seed its design-system foundation by **copying four files verbatim** from a sibling `apps/web` (`nest-logger-example` or `nest-auth-example`): `app/globals.css`, `tailwind.config.ts`, `components.json`, and `postcss.config.mjs`. The goal of this phase is an app **visually indistinguishable** from every other Bymax example (spec §14, DASHBOARD §19); this task installs the exact dependency set and lays down the copied design tokens so nothing is invented from scratch. The library types are consumed **only** via the zero-dep `@bymax-one/nest-cache/shared` subpath (spec §8.2) — never the server subpath — so no NestJS/ioredis leaks into the browser bundle.

### Acceptance Criteria

- [ ] `apps/web/package.json` exists with `"name": "web"`, `"private": true`, `"type": "module"`, and scripts `dev` (`next dev -p 3000`), `build` (`next build`), `start`, `lint`, `typecheck` (`tsc --noEmit`).
- [ ] Dependencies installed (exact set): `next@^16`, `react@^19`, `react-dom@^19`, `tailwindcss@^4`, `@tailwindcss/postcss`, `geist`, `lucide-react`, `sonner`, `class-variance-authority`, `clsx`, `tailwind-merge`, `@tanstack/react-query`, `@tanstack/react-table`, `@tanstack/react-virtual`, `nuqs`, `@uiw/react-json-view`, `recharts`, `socket.io-client`, plus the library `@bymax-one/nest-cache` (the `file:` link from Phase 2) for its `/shared` subpath.
- [ ] **NOT** present in `package.json`: `next-themes`, `autoprefixer`, `postcss-import` (Tailwind v4 forces dark via a class and auto-prefixes — these break the v4 pipeline).
- [ ] `app/globals.css`, `tailwind.config.ts`, `components.json`, `postcss.config.mjs` are copied **verbatim** from a sibling `apps/web` (the `.dark` token set is the live one; brand orange `#ff6224`).
- [ ] `postcss.config.mjs` contains **only** `@tailwindcss/postcss` (no `autoprefixer`).
- [ ] `components.json` is shadcn `new-york`, `cssVariables: true`, `baseColor: neutral`, `iconLibrary: lucide`.
- [ ] `apps/web/tsconfig.json` extends `../../tsconfig.base.json` and adds the Next.js plugin + JSX settings; `apps/web/.env.example` declares `NEXT_PUBLIC_API_URL=http://localhost:3001` and `NEXT_PUBLIC_WS_URL=http://localhost:3001`.
- [ ] `pnpm install` succeeds and `pnpm --filter web exec next --version` prints a `16.x` version.

### Files to create / modify

- `apps/web/package.json` — Next.js app manifest + scripts + the install set above.
- `apps/web/app/globals.css` — **copied verbatim** (token block `:root` + live `.dark` + base resets + keyframes).
- `apps/web/tailwind.config.ts` — **copied verbatim** (brand scale, radius map, fonts, glow keyframes).
- `apps/web/components.json` — **copied verbatim** (shadcn `new-york`, lucide, cssVariables).
- `apps/web/postcss.config.mjs` — **copied verbatim** (`@tailwindcss/postcss` only).
- `apps/web/tsconfig.json`, `apps/web/.env.example`, `apps/web/next-env.d.ts`.

### Agent Execution Prompt

> Role: Senior frontend engineer (Next.js 16 / React 19 / Tailwind v4 / shadcn).
> Context: Repo `nest-cache-example` is the reference app for `@bymax-one/nest-cache` (see `docs/TECHNICAL_SPECIFICATION.md` §13–§14 + `docs/DASHBOARD.md` §19–§20 + `docs/design_system.html`). This is task P12-1, the first task of Phase 12 — the `apps/web` skeleton. The dashboard must be **visually identical** to the sibling examples (`nest-logger-example`, `nest-auth-example`): forced-dark, orange `#ff6224` glass-morphism, Geist Sans body + monospace headings/keys/metrics, the 64px-topbar + 250px-sidebar shell, shadcn `new-york`. **Do not invent a new design language** — copy the four named files verbatim from a sibling `apps/web`.
> Objective: Scaffold the `apps/web` package, install the exact dependency set, and copy the four design-system files verbatim.
> Steps:
>
> 1. Create `apps/web/package.json`:
>    ```jsonc
>    {
>      "name": "web",
>      "private": true,
>      "type": "module",
>      "scripts": {
>        "dev": "next dev -p 3000",
>        "build": "next build",
>        "start": "next start -p 3000",
>        "lint": "next lint",
>        "typecheck": "tsc --noEmit",
>      },
>    }
>    ```
> 2. Install the exact runtime + dev set from `apps/web` (DASHBOARD §19 "Install" line):
>    `pnpm --filter web add next@^16 react@^19 react-dom@^19 tailwindcss@^4 @tailwindcss/postcss geist lucide-react sonner class-variance-authority clsx tailwind-merge @tanstack/react-query @tanstack/react-table @tanstack/react-virtual nuqs @uiw/react-json-view recharts socket.io-client`
>    then `pnpm --filter web add -D typescript @types/node @types/react @types/react-dom`. Add the library link the same way `apps/api` did in Phase 2 (`"@bymax-one/nest-cache": "file:../../../nest-cache"`) — `apps/web` needs it for the `/shared` subpath only.
> 3. **Do NOT add** `next-themes`, `autoprefixer`, or `postcss-import`. Tailwind v4 forces dark via the `dark` class and auto-prefixes; adding any of these breaks the v4 PostCSS pipeline. (design_system.html §10 step 1; DASHBOARD §19.)
> 4. Copy these four files **byte-for-byte** from a sibling `apps/web` (prefer `nest-logger-example`, else `nest-auth-example` — both ship the same shared system): `app/globals.css`, `tailwind.config.ts`, `components.json`, `postcss.config.mjs`. Do not edit them. The `.dark` set must be the live one (forced dark); the brand color must be `#ff6224`.
> 5. Create `apps/web/tsconfig.json` extending the root base:
>    ```json
>    {
>      "extends": "../../tsconfig.base.json",
>      "compilerOptions": {
>        "lib": ["DOM", "DOM.Iterable", "ES2023"],
>        "jsx": "preserve",
>        "module": "ESNext",
>        "moduleResolution": "Bundler",
>        "noEmit": true,
>        "plugins": [{ "name": "next" }],
>        "paths": { "@/*": ["./*"] }
>      },
>      "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
>      "exclude": ["node_modules"]
>    }
>    ```
> 6. Create `apps/web/.env.example` with `NEXT_PUBLIC_API_URL=http://localhost:3001` and `NEXT_PUBLIC_WS_URL=http://localhost:3001` (spec §9.1 tail).
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions (pnpm >=10.8, ESM-only, TypeScript 5.9 strict, English-only).
> - The four design-system files are copied **verbatim** — do not restyle, rename tokens, or "improve" them.
> - `apps/web` imports library types from `@bymax-one/nest-cache/shared` **only** — never the server subpath (no NestJS/ioredis in the browser bundle, spec §8.2).
> - Do NOT add `next-themes`, `autoprefixer`, or `postcss-import`.
> - This task lays down config only; pages/components land in P12-2..P12-7. A bare `app/layout.tsx` + `app/page.tsx` placeholder may be added if `next build` requires it, but the real layout is P12-2.
>   Verification:
> - `pnpm install` — expected: exit 0.
> - `pnpm --filter web exec next --version` — expected: `16.x`.
> - `node -e "const p=require('./apps/web/package.json').dependencies; if(p['next-themes']||p['autoprefixer']||p['postcss-import']) process.exit(1)"` — expected: exit 0 (none present).
> - `grep -c "@tailwindcss/postcss" apps/web/postcss.config.mjs` — expected: ≥ 1; `grep -c autoprefixer apps/web/postcss.config.mjs` — expected: 0.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P12-1 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

If phase reaches 100%, switch its row status in `DEVELOPMENT_PLAN.md` to 🟢.

⚠️ Never mark done with failing verification.

---

## P12-2 — `app/layout.tsx` (Geist + forced `dark`) + `app/providers.tsx`

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** M (90 min – half day)
- **Depends on:** `P12-1`

### Description

Wire the root layout and the client-side providers — the two pieces that make every page render in the shared design system. `app/layout.tsx` loads `GeistSans` + `GeistMono` as CSS variables and forces dark by putting `dark` on `<html>` (no `next-themes`, spec §14.1). `app/providers.tsx` is a `'use client'` boundary holding the three cross-cutting providers the whole app needs: `QueryClientProvider` (TanStack Query v5 — server-state), `<NuqsAdapter>` (mandatory in nuqs v2 for the URL-state controls/filters, DASHBOARD §19), and the Sonner `<Toaster theme="dark">` (glass toasts, bottom-right, severity left-borders). The Geist font wiring and forced-`dark` on `<html>` are **identical to the sibling `layout.tsx`** (spec §14.2) — adapt that file, changing only `<Providers>`, metadata, and the wordmark, so chrome parity holds.

### Acceptance Criteria

- [ ] `app/layout.tsx` is a server component importing `GeistSans` from `geist/font/sans`, `GeistMono` from `geist/font/mono`, and `./globals.css`.
- [ ] `<html>` className is `` `${GeistSans.variable} ${GeistMono.variable} dark` `` with `lang="en"` and `suppressHydrationWarning`; `<body>` wraps `children` in `<Providers>`.
- [ ] Layout exports `metadata` with `title: 'nest-cache-example'` and a one-line description.
- [ ] `app/providers.tsx` starts with `'use client'` and wraps children in `QueryClientProvider` → `<NuqsAdapter>` → children, with a `<Toaster theme="dark" position="bottom-right" />` sibling.
- [ ] The `QueryClient` is created **once** via `useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 5_000, refetchOnWindowFocus: false } } }))` (not re-created per render).
- [ ] **No `next-themes`** import anywhere; dark is forced solely by the `dark` class on `<html>`.
- [ ] `pnpm --filter web exec tsc --noEmit` passes.

### Files to create / modify

- `apps/web/app/layout.tsx` — Geist fonts + forced `dark` on `<html>` + `<Providers>`.
- `apps/web/app/providers.tsx` — `'use client'`: `QueryClientProvider` + `<NuqsAdapter>` + Sonner `<Toaster>`.

### Agent Execution Prompt

> Role: Senior frontend engineer (Next.js 16 App Router / React 19).
> Context: Task P12-2 of `docs/DEVELOPMENT_PLAN.md` §Phase 12. The design system is forced-dark with **no `next-themes`** (spec §14.1, design_system.html §04/§10 step 3): dark is `dark` on `<html>`, and the `.dark` token set (copied in P12-1's `globals.css`) is the only live one. nuqs v2 **requires** `<NuqsAdapter>` in the tree or the URL-state controls (P12-6) throw. Body font = Geist Sans; headings/brand/keys/metrics = mono (handled by `globals.css`).
> Objective: Create `app/layout.tsx` (fonts + forced dark) and `app/providers.tsx` (Query + Nuqs + Sonner).
> Steps:
>
> 1. Create `apps/web/app/layout.tsx` (server component):
>    ```tsx
>    import type { Metadata } from 'next'
>    import { GeistSans } from 'geist/font/sans'
>    import { GeistMono } from 'geist/font/mono'
>    import { Providers } from './providers'
>    import './globals.css'
>
>    export const metadata: Metadata = {
>      title: 'nest-cache-example',
>      description: 'Cache Observability & Control Console for @bymax-one/nest-cache',
>    }
>
>    export default function RootLayout({ children }: { children: React.ReactNode }) {
>      return (
>        <html
>          lang="en"
>          className={`${GeistSans.variable} ${GeistMono.variable} dark`}
>          suppressHydrationWarning
>        >
>          <body>
>            <Providers>{children}</Providers>
>          </body>
>        </html>
>      )
>    }
>    ```
> 2. Create `apps/web/app/providers.tsx`:
>    ```tsx
>    'use client'
>
>    import { useState } from 'react'
>    import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
>    import { NuqsAdapter } from 'nuqs/adapters/next/app'
>    import { Toaster } from 'sonner'
>
>    export function Providers({ children }: { children: React.ReactNode }) {
>      const [queryClient] = useState(
>        () =>
>          new QueryClient({
>            defaultOptions: { queries: { staleTime: 5_000, refetchOnWindowFocus: false } },
>          }),
>      )
>      return (
>        <QueryClientProvider client={queryClient}>
>          <NuqsAdapter>{children}</NuqsAdapter>
>          <Toaster theme="dark" position="bottom-right" closeButton />
>        </QueryClientProvider>
>      )
>    }
>    ```
> 3. Import the `<NuqsAdapter>` from `nuqs/adapters/next/app` (the App-Router adapter). This is **mandatory** in nuqs v2 — omitting it makes the P12-6 controls throw at runtime.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions (English-only, no `@ts-ignore`).
> - Do NOT import or add `next-themes`; forced dark is the `dark` class on `<html>` only.
> - `<NuqsAdapter>` is required; do not drop it.
> - The `QueryClient` must be created once (in `useState`), never inline in JSX.
> - Keep the Sonner `Toaster` `theme="dark"` to match the glass design (DASHBOARD §19 component recipes).
>   Verification:
> - `pnpm --filter web exec tsc --noEmit` — expected: exit 0.
> - `grep -rL next-themes apps/web/app/layout.tsx apps/web/app/providers.tsx` — expected: both files listed (neither imports it).
> - `grep -c "dark" apps/web/app/layout.tsx` — expected: ≥ 1 (the `dark` class on `<html>`).
> - `grep -c "NuqsAdapter" apps/web/app/providers.tsx` — expected: ≥ 1.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P12-2 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P12-3 — `components/layout/` — Topbar (64px) + grouped Sidebar (250px) + `AppShell`

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** M (90 min – half day)
- **Depends on:** `P12-1`, `P12-2`

### Description

Build the canonical app shell — the chrome that makes a `nest-cache-example` screenshot indistinguishable from `nest-logger-example` / `nest-auth-example` (spec §14.5 acceptance criterion). It is a **64px topbar** over a **250px sidebar** + fluid `main`, reusing the sibling shell **classes verbatim** (design_system.html §05, DASHBOARD §19 "App shell"). Only the wordmark (`nest-cache-example`) and the nav items (the cache routes, grouped Observe / Real-time / Labs / System) change. The Topbar's brand mark is an orange-bordered rounded-lg badge holding the stacked-layers SVG (stroke `#ff6224`) beside the mono orange→amber gradient wordmark; the Sidebar's active item gets a left orange border, faint orange fill, and orange text/icon.

### Acceptance Criteria

- [ ] `components/layout/Topbar.tsx` renders a fixed `h-16` bar: `bg-[rgba(10,10,10,0.85)] backdrop-blur-md border-b border-[rgba(255,255,255,0.07)] z-200`, with the brand mark (`border-[rgba(255,98,36,0.4)] bg-[rgba(255,98,36,0.15)]` badge + stacked-layers SVG stroke `#ff6224`) + gradient mono wordmark `nest-cache-example` (`from-[#ff6224] to-amber-200 bg-clip-text text-transparent`) on the left; a right slot accepts the global-controls children (filled in P12-6).
- [ ] `components/layout/Sidebar.tsx` renders `w-[250px] bg-[rgba(12,12,12,0.98)] border-r border-[rgba(255,255,255,0.08)] lg:sticky lg:top-16 lg:h-[calc(100vh-64px)]`, with the nav grouped into **OBSERVE / REAL-TIME / LABS / SYSTEM** and a footer namespace-prefix chip.
- [ ] Nav items use the exact recipe — base `flex items-center gap-3 rounded-lg border-l-2 px-3 py-[10px] text-sm transition-all duration-150`; **active** `border-l-[#ff6224] bg-[rgba(255,98,36,0.1)] font-semibold text-[#ff6224]`; inactive `border-l-transparent text-[rgba(255,255,255,0.55)] hover:bg-[rgba(255,255,255,0.05)]`. Active state is derived from the current pathname (`usePathname`).
- [ ] All ten cache routes are present with the correct lucide icons: Overview `/` `LayoutDashboard`, Explorer `/explorer` `Search`, Playground `/playground` `Boxes`, Tenants `/tenants` `Building2`, Pub/Sub `/pubsub` `Radio`, TTL Live `/ttl` `Timer`, Stampede `/stampede` `Zap`, Serializer `/serializer` `Binary`, Errors `/errors` `TriangleAlert`, Connection `/connection` `PlugZap`.
- [ ] `components/layout/AppShell.tsx` composes them: `<Topbar/>` then `<div className="flex pt-16"><Sidebar/><main className="min-w-0 flex-1 px-6 py-8"><div className="mx-auto max-w-5xl">{children}</div></main></div>` (the inner wrapper widens to `max-w-7xl` on chart-heavy pages via a prop).
- [ ] A placeholder `app/page.tsx` renders `<AppShell>` with a glass `Card` so the shell is visible; `pnpm --filter web build` succeeds and the shell renders the orange/glass dark theme.

### Files to create / modify

- `apps/web/components/layout/Topbar.tsx` — 64px topbar, brand mark + wordmark, right controls slot.
- `apps/web/components/layout/Sidebar.tsx` — 250px grouped sidebar, active-state nav, footer ns chip.
- `apps/web/components/layout/AppShell.tsx` — composes Topbar + Sidebar + `main`.
- `apps/web/components/layout/nav-items.ts` — the typed nav-group/route/icon table.
- `apps/web/app/page.tsx` — placeholder Overview rendering inside `<AppShell>`.

### Agent Execution Prompt

> Role: Senior frontend engineer (Next.js App Router / Tailwind v4).
> Context: Task P12-3 of `docs/DEVELOPMENT_PLAN.md` §Phase 12. Build the shell to `docs/design_system.html` §05 ("App Shell") and `docs/DASHBOARD.md` §19 ("App shell — identical structure, cache nav"). The acceptance bar (spec §14.5): a screenshot of this app beside a sibling example must be indistinguishable in chrome (topbar, sidebar, cards, buttons, fonts, orange brand, glass). **Reuse the sibling classes verbatim — change only the wordmark and the nav items.** Brand orange `#ff6224`; wordmark `nest-cache-example`. The nav is grouped (OBSERVE / REAL-TIME / LABS / SYSTEM).
> Objective: Create the Topbar, grouped Sidebar, and `AppShell`, plus a placeholder Overview page that renders them.
> Steps:
>
> 1. Create `components/layout/nav-items.ts` — a typed table the Sidebar maps over (use the exact href/icon mapping from DASHBOARD §19 "Cache nav items"):
>    ```ts
>    import {
>      LayoutDashboard, Search, Boxes, Building2,
>      Radio, Timer, Zap, Binary, TriangleAlert, PlugZap,
>      type LucideIcon,
>    } from 'lucide-react'
>
>    export interface NavItem { label: string; href: string; icon: LucideIcon }
>    export interface NavGroup { group: string; items: NavItem[] }
>
>    export const NAV_GROUPS: NavGroup[] = [
>      { group: 'Observe', items: [
>        { label: 'Overview', href: '/', icon: LayoutDashboard },
>        { label: 'Explorer', href: '/explorer', icon: Search },
>        { label: 'Playground', href: '/playground', icon: Boxes },
>        { label: 'Tenants', href: '/tenants', icon: Building2 },
>      ] },
>      { group: 'Real-time', items: [
>        { label: 'Pub/Sub', href: '/pubsub', icon: Radio },
>        { label: 'TTL Live', href: '/ttl', icon: Timer },
>      ] },
>      { group: 'Labs', items: [
>        { label: 'Stampede', href: '/stampede', icon: Zap },
>        { label: 'Serializer', href: '/serializer', icon: Binary },
>        { label: 'Errors', href: '/errors', icon: TriangleAlert },
>      ] },
>      { group: 'System', items: [
>        { label: 'Connection', href: '/connection', icon: PlugZap },
>      ] },
>    ]
>    ```
> 2. Create `components/layout/Topbar.tsx` (`'use client'` is not required unless you read state; keep it a server component if it only renders children + a `right` slot). Fixed bar `h-16`, classes exactly as the acceptance criteria. The brand mark is the orange-bordered badge holding the stacked-layers SVG (the same `d="M12 2L2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5"` path, stroke `#ff6224`, from design_system.html §05). The wordmark is mono, `bg-gradient-to-r from-[#ff6224] to-amber-200 bg-clip-text text-transparent`, reading **`nest-cache-example`**. Accept a `right?: React.ReactNode` prop for the global-controls slot (P12-6 fills it).
> 3. Create `components/layout/Sidebar.tsx` (`'use client'` — it calls `usePathname()`). Map `NAV_GROUPS`; each group renders a small uppercase label then its items. Active = `pathname === item.href` (exact match for `/`, `startsWith` for the rest). Apply the active/idle class recipe **verbatim**. Footer: a mono chip showing the namespace prefix (e.g. `:cache-example`).
> 4. Create `components/layout/AppShell.tsx` composing them — Topbar (passing its `right` slot through) over `<div className="flex pt-16"><Sidebar/><main className="min-w-0 flex-1 px-6 py-8"><div className={cn('mx-auto', wide ? 'max-w-7xl' : 'max-w-5xl')}>{children}</div></main></div>`. Accept a `wide?: boolean` prop (Overview/Explorer pass `wide`).
> 5. Create a placeholder `app/page.tsx` that renders `<AppShell wide>` with a single glass `Card` (or a plain `div` with the card classes if shadcn `card` isn't scaffolded until P12-7) titled "Overview" so the shell is visibly correct.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions (English-only, no `@ts-ignore`).
> - Reuse the sibling shell classes **verbatim** (design_system.html §05); do not redesign — change only the wordmark (`nest-cache-example`) and nav items (the cache routes).
> - Use `lucide-react` icons exactly as mapped; do not substitute an icon set.
> - The active-nav recipe must be byte-identical to the design system; accessible color **+** icon **+** text (the label is always shown).
> - Keep components that don't read client state as server components; mark only `Sidebar` (and anything using hooks) `'use client'`.
>   Verification:
> - `pnpm --filter web exec tsc --noEmit` — expected: exit 0.
> - `pnpm --filter web build` — expected: exit 0; the placeholder Overview compiles inside the shell.
> - `grep -c "nest-cache-example" apps/web/components/layout/Topbar.tsx` — expected: ≥ 1.
> - `grep -c "border-l-\[#ff6224\]" apps/web/components/layout/Sidebar.tsx` — expected: ≥ 1 (the active accent).
> - Manual: `pnpm --filter web dev`, open `http://localhost:3000` — expected: 64px topbar + 250px sidebar, orange brand mark + wordmark, four nav groups, dark glass theme.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P12-3 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P12-4 — `lib/api-client.ts` — typed `fetch` wrapper + `CacheErrorCode` error union

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** M (90 min – half day)
- **Depends on:** `P12-1`

### Description

The typed transport layer between the dashboard and `apps/api` — a thin `fetch` wrapper (no axios) that returns typed results and maps the API's structured error body to a discriminated union **keyed by `CacheErrorCode`**, imported from the library's zero-dep `@bymax-one/nest-cache/shared` subpath (spec §13.1, matrix #44 + #48). This proves the dual-subpath layering: the browser bundle types its error handling with the same `cache.*` codes the server throws, **without** pulling NestJS or ioredis into the client. The API's filter serializes failures as `{ error: { code, message, details } }` (spec §19), and this client decodes exactly that.

### Acceptance Criteria

- [ ] `lib/api-client.ts` imports `CACHE_ERROR_CODES` and `type CacheErrorCode` from `@bymax-one/nest-cache/shared` (never the server subpath).
- [ ] Exports an `ApiError` type: `{ code: CacheErrorCode | 'unknown'; message: string; status: number; details?: unknown }`.
- [ ] Exports an `ApiResult<T>` discriminated union (e.g. `{ ok: true; data: T } | { ok: false; error: ApiError }`) **or** a wrapper that throws a typed `ApiError` — pick one and use it consistently; document the choice in a file-level JSDoc.
- [ ] A core `apiFetch<T>(path, init?)` reads `NEXT_PUBLIC_API_URL`, sends/accepts JSON, and on a non-2xx response parses the `{ error: { code, message, details } }` body and narrows `code` against `CACHE_ERROR_CODES` (falls back to `'unknown'` if the code isn't a known cache code).
- [ ] Typed helper methods exist for the verbs the pages need: `get`, `post`, `del` (thin wrappers over `apiFetch`).
- [ ] No `any` in the public surface; no axios; no `useEffect`+fetch (data fetching is via TanStack Query hooks built on this client).
- [ ] `pnpm --filter web exec tsc --noEmit` passes and the `/shared` import resolves.

### Files to create / modify

- `apps/web/lib/api-client.ts` — the typed fetch wrapper + `ApiError`/`ApiResult` + verb helpers.

### Agent Execution Prompt

> Role: Senior frontend engineer (TypeScript, fetch, typed APIs).
> Context: Task P12-4 of `docs/DEVELOPMENT_PLAN.md` §Phase 12. The dashboard is a thin client over `apps/api` (spec §13.1); it never talks to Redis. `apps/api`'s `CacheExceptionFilter` serializes failures as `{ error: { code, message, details } }` with the HTTP status from the exception (spec §19). The error `code` is a `CacheErrorCode` from the library's **shared** subpath — the dashboard imports it to type its handling, proving NestJS/ioredis never reach the browser bundle (spec §8.2, matrix #44 + #48). Bymax Next.js convention: **no axios, no `useEffect`+fetch** — request/response goes through this client (wrapped by TanStack Query hooks later), live data goes through the socket (P12-5).
> Objective: Create `lib/api-client.ts` — a typed `fetch` wrapper with a `CacheErrorCode`-keyed error union.
> Steps:
>
> 1. Create `apps/web/lib/api-client.ts`:
>    ```ts
>    import { CACHE_ERROR_CODES, type CacheErrorCode } from '@bymax-one/nest-cache/shared'
>
>    /** A decoded API error. `code` is narrowed to a known CacheErrorCode or 'unknown'. */
>    export interface ApiError {
>      code: CacheErrorCode | 'unknown'
>      message: string
>      status: number
>      details?: unknown
>    }
>
>    export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError }
>
>    const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
>    const KNOWN = new Set<string>(Object.values(CACHE_ERROR_CODES))
>
>    function toApiError(status: number, body: unknown): ApiError {
>      const err = (body as { error?: { code?: string; message?: string; details?: unknown } })?.error
>      const rawCode = err?.code
>      const code: CacheErrorCode | 'unknown' =
>        rawCode && KNOWN.has(rawCode) ? (rawCode as CacheErrorCode) : 'unknown'
>      return { code, message: err?.message ?? `Request failed (${status})`, status, details: err?.details }
>    }
>
>    /** Core typed fetch. Resolves ApiResult<T>; never throws on a structured API error. */
>    export async function apiFetch<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
>      const res = await fetch(`${BASE}${path}`, {
>        ...init,
>        headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
>      })
>      const body: unknown = res.status === 204 ? null : await res.json().catch(() => null)
>      if (!res.ok) return { ok: false, error: toApiError(res.status, body) }
>      return { ok: true, data: body as T }
>    }
>
>    export const api = {
>      get: <T>(path: string) => apiFetch<T>(path),
>      post: <T>(path: string, json?: unknown) =>
>        apiFetch<T>(path, { method: 'POST', body: json === undefined ? undefined : JSON.stringify(json) }),
>      del: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
>    }
>    ```
> 2. Add a file-level JSDoc stating the contract (decodes `{ error: { code, message, details } }`; `code` narrowed against `CACHE_ERROR_CODES`; the `/shared` import keeps the browser bundle library-clean).
> 3. Decide and document one error convention (the `ApiResult` union above is preferred over throwing — it composes cleanly with TanStack Query's `select`/error handling in later phases). Keep it consistent.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions (English-only, JSDoc on exports, no `@ts-ignore`).
> - Import error types from `@bymax-one/nest-cache/shared` **only** — importing the server subpath here would leak NestJS/ioredis into the browser bundle and fail the Phase 12 DoD.
> - No `any` in the public surface; no axios; no `useEffect`+fetch.
> - Do not hit the network in this task (no integration test) — the API may still be mocked until Phases 4/5 land; this is the typed client only.
>   Verification:
> - `pnpm --filter web exec tsc --noEmit` — expected: exit 0.
> - `grep -c "@bymax-one/nest-cache/shared" apps/web/lib/api-client.ts` — expected: ≥ 1.
> - `grep -c "@bymax-one/nest-cache'" apps/web/lib/api-client.ts` — expected: 0 (no bare server-subpath import).
> - `node -e "const s=require('fs').readFileSync('apps/web/lib/api-client.ts','utf8'); if(/from ['\"]axios['\"]/.test(s)) process.exit(1)"` — expected: exit 0 (no axios).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P12-4 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P12-5 — `lib/socket.ts` (3 channels) + `hooks/use-cache-socket.ts` (ring buffer + rAF)

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** M (90 min – half day)
- **Depends on:** `P12-1`

### Description

The live-feeds layer. `lib/socket.ts` is a single `socket.io-client` connection to the API gateway, multiplexing the three server→browser channels — `cache:connection` (lifecycle status + latency), `cache:event` (Pub/Sub fan-out), `cache:expired` (TTL keyspace expiry) (spec §18, DASHBOARD §18). `hooks/use-cache-socket.ts` is the consumer hook that guards a high-rate stream: it pushes incoming events into a **bounded ring buffer** (drop-oldest) and flushes them with **requestAnimationFrame batching** so a Pub/Sub burst never freezes the tab (design principle #11 — "live, but guarded"). The browser only ever **receives** on the socket; publishing is done via the REST `POST /pubsub/publish` (P12-4), not the socket.

### Acceptance Criteria

- [ ] `lib/socket.ts` exports a typed `CacheEvent` union covering the three channels — e.g. `{ kind: 'connection'; event: CacheEventName; data: Record<string, unknown>; at: number } | { kind: 'event'; channel: string; payload: unknown; at: number } | { kind: 'expired'; key: string; at: number }` — with `CacheEventName` imported from `@bymax-one/nest-cache/shared`.
- [ ] `lib/socket.ts` exports a `createCacheSocket()` (or `getSocket()`) that connects to `NEXT_PUBLIC_WS_URL` with `{ transports: ['websocket'] }` and a small `RingBuffer<T>` class (fixed capacity, `push`/`pushMany`, drop-oldest, `toArray`).
- [ ] `hooks/use-cache-socket.ts` is `'use client'`, exports `useCacheSocket(enabled: boolean)`, creates one ring buffer (capacity ≈ 5000) via `useState`, and on `enabled` subscribes to all three channels, batching pushes with `requestAnimationFrame`.
- [ ] The hook returns the buffer (and/or a snapshot) for feeds to read; it `socket.close()`s and cancels the pending rAF on cleanup / when `enabled` flips false.
- [ ] No unbounded array growth (the ring buffer caps memory); the socket is **receive-only** (no `socket.emit` of app data).
- [ ] `pnpm --filter web exec tsc --noEmit` passes.

### Files to create / modify

- `apps/web/lib/socket.ts` — socket.io-client setup, `CacheEvent` union, `RingBuffer`.
- `apps/web/hooks/use-cache-socket.ts` — `'use client'` hook: bounded ring buffer + rAF-batched flush.

### Agent Execution Prompt

> Role: Senior frontend engineer (React 19, WebSockets, performance).
> Context: Task P12-5 of `docs/DEVELOPMENT_PLAN.md` §Phase 12. The API standardizes on a `@nestjs/platform-socket.io` gateway emitting three channels — `cache:connection`, `cache:event`, `cache:expired` (spec §18, DASHBOARD §18). The reference hook in DASHBOARD §18 uses a **bounded ring buffer (drop-oldest, ~5000) + rAF-batched flush** so a high-rate Pub/Sub burst never freezes the tab (design principle #11). The socket is strictly **server→client**; the browser publishes via REST `POST /pubsub/publish`, not the socket.
> Objective: Create `lib/socket.ts` (typed 3-channel client + `RingBuffer`) and `hooks/use-cache-socket.ts` (the guarded consumer).
> Steps:
>
> 1. Create `apps/web/lib/socket.ts`:
>    ```ts
>    import { io, type Socket } from 'socket.io-client'
>    import { type CacheEventName } from '@bymax-one/nest-cache/shared'
>
>    export type CacheEvent =
>      | { kind: 'connection'; event: CacheEventName; data: Record<string, unknown>; at: number }
>      | { kind: 'event'; channel: string; payload: unknown; at: number }
>      | { kind: 'expired'; key: string; at: number }
>
>    /** Fixed-capacity ring buffer; drops the oldest entry when full. */
>    export class RingBuffer<T> {
>      private buf: T[] = []
>      constructor(private readonly capacity: number) {}
>      push(item: T): void { this.buf.push(item); if (this.buf.length > this.capacity) this.buf.shift() }
>      pushMany(items: T[]): void { for (const i of items) this.push(i) }
>      toArray(): readonly T[] { return this.buf }
>      get size(): number { return this.buf.length }
>    }
>
>    export function createCacheSocket(): Socket {
>      const url = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001'
>      return io(url, { transports: ['websocket'], autoConnect: true })
>    }
>    ```
> 2. Create `apps/web/hooks/use-cache-socket.ts` (mirror the DASHBOARD §18 reference, with the typed union):
>    ```ts
>    'use client'
>    import { useEffect, useState } from 'react'
>    import { createCacheSocket, RingBuffer, type CacheEvent } from '@/lib/socket'
>
>    export function useCacheSocket(enabled: boolean) {
>      const [buffer] = useState(() => new RingBuffer<CacheEvent>(5_000))
>      useEffect(() => {
>        if (!enabled) return
>        const socket = createCacheSocket()
>        const pending: CacheEvent[] = []
>        let raf = 0
>        const flush = () => { buffer.pushMany(pending.splice(0)); raf = 0 }
>        const schedule = (e: CacheEvent) => { pending.push(e); raf ||= requestAnimationFrame(flush) }
>        socket.on('cache:connection', (m: { event: CacheEvent extends { kind: 'connection' } ? never : unknown }) =>
>          schedule({ kind: 'connection', ...(m as object) } as CacheEvent))
>        socket.on('cache:event', (m: object) => schedule({ kind: 'event', ...(m as object) } as CacheEvent))
>        socket.on('cache:expired', (m: object) => schedule({ kind: 'expired', ...(m as object) } as CacheEvent))
>        return () => { if (raf) cancelAnimationFrame(raf); socket.close() }
>      }, [enabled, buffer])
>      return buffer
>    }
>    ```
>    (Adjust the per-channel mappers so each produces a correctly-tagged `CacheEvent`; the gateway payloads are `{ event, data, at }`, `{ channel, payload, at }`, `{ key, at }` respectively — spec §18.)
> 3. Keep the socket **receive-only** — do not call `socket.emit` with app data anywhere in the web app.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions (English-only, no `@ts-ignore`).
> - Import `CacheEventName` from `@bymax-one/nest-cache/shared` only (browser bundle stays library-clean).
> - The ring buffer is mandatory (drop-oldest, bounded) and the flush must be rAF-batched — no unbounded `setState` per message.
> - The hook must clean up (`socket.close()` + `cancelAnimationFrame`) on unmount and when `enabled` → false (off by default on first load; the Live toggle in P12-6 flips it).
> - Do not connect when `enabled` is false.
>   Verification:
> - `pnpm --filter web exec tsc --noEmit` — expected: exit 0.
> - `grep -c "requestAnimationFrame" apps/web/hooks/use-cache-socket.ts` — expected: ≥ 1.
> - `grep -c "RingBuffer" apps/web/lib/socket.ts` — expected: ≥ 1.
> - `node -e "const s=require('fs').readFileSync('apps/web/hooks/use-cache-socket.ts','utf8'); if(/socket\.emit\(/.test(s)) process.exit(1)"` — expected: exit 0 (receive-only).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P12-5 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P12-6 — `lib/cache-status.ts` + `lib/utils.ts` + `components/controls/` (nuqs URL)

- **Status:** 🔴 Not Started
- **Priority:** Medium
- **Size:** M (90 min – half day)
- **Depends on:** `P12-2`, `P12-4`

### Description

The accessible status mapping, the `cn()` utility, and the four global controls that live in the topbar. `lib/cache-status.ts` maps `CacheConnectionStatus` / hit-miss / data-type to `{ color, icon, label }` — accessible **color + icon + text, never color alone** (spec §14.4, design_system.html §08). `lib/utils.ts` is the canonical `cn()` (`twMerge(clsx(...))`). `components/controls/` holds the four topbar controls (DASHBOARD §4, spec §13.3): a read-only **NamespaceChip** (`ns: cache-example` — shown, not switched, because the library binds one namespace per instance), a **TenantSwitcher** (prefix scoping, not namespace switching), a **StatusChip** (status color+icon+text + latency + mode, corrected by the `cache:connection` feed), a **LiveToggle** (flips the socket feeds, off by default), and a **TimeRange** (relative presets, metric charts only). The Explorer filters and the time range persist in the **URL via `nuqs` typed params** so any view is a shareable deep-link — which is why `<NuqsAdapter>` (P12-2) is mandatory.

### Acceptance Criteria

- [ ] `lib/utils.ts` exports `cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))` using `clsx` + `tailwind-merge`.
- [ ] `lib/cache-status.ts` imports `type CacheConnectionStatus` (and `CacheEventName`) from `@bymax-one/nest-cache/shared` and exports a `connectionStatusMeta(status)` → `{ color, icon, label }` mapping: `ready` green `#22c55e`, `connecting` blue `#60a5fa`, `reconnecting` amber `#f59e0b`, `closed`/`end` red `#ef4444`, `error` purple `#a855f7` (spec §14.4); plus `hitMissMeta` (`hit` green / `miss` amber) and `dataTypeMeta` (`string` blue / `hash` purple / `set` green). Each entry carries a lucide `icon` and a text `label` (never color alone).
- [ ] `components/controls/NamespaceChip.tsx` — a **read-only** mono chip `ns: cache-example` (with a tooltip explaining one-namespace-per-instance; spec §12.4 / DASHBOARD §4). It does **not** switch the namespace.
- [ ] `components/controls/TenantSwitcher.tsx` — a dropdown selecting the active tenant prefix (`acme` / `globex` / …), persisted to the URL via `nuqs` (`useQueryState('tenant', …)`); it scopes the Explorer's default prefix, not the namespace.
- [ ] `components/controls/StatusChip.tsx` — `'use client'`, renders the connection status via `connectionStatusMeta` (dot/icon + label + latency + mode); reads from the `useCacheSocket` `cache:connection` feed and/or a `/health` query, defaulting to a neutral state until data arrives.
- [ ] `components/controls/LiveToggle.tsx` — toggles the socket feeds on/off (the `enabled` flag for `useCacheSocket`), **off by default**, persisted to the URL via `nuqs`.
- [ ] `components/controls/TimeRange.tsx` — relative presets `Last 5m / 15m / 1h`, persisted to the URL via `nuqs`; used by metric charts only.
- [ ] `lib/filters.ts` (or inline in the controls) defines the `nuqs` parsers; URL state round-trips (changing a control updates the query string).
- [ ] `pnpm --filter web exec tsc --noEmit` passes; controls render inside the Topbar's right slot (wired into `AppShell`/`Topbar` from P12-3).

### Files to create / modify

- `apps/web/lib/utils.ts` — `cn()`.
- `apps/web/lib/cache-status.ts` — `CacheConnectionStatus`/hit-miss/type → `{ color, icon, label }`.
- `apps/web/lib/filters.ts` — `nuqs` parsers for `tenant`, `live`, `range` (+ Explorer filter parsers stub).
- `apps/web/components/controls/NamespaceChip.tsx` — read-only ns chip.
- `apps/web/components/controls/TenantSwitcher.tsx` — tenant prefix selector (nuqs).
- `apps/web/components/controls/StatusChip.tsx` — connection status chip.
- `apps/web/components/controls/LiveToggle.tsx` — socket-feeds toggle (nuqs).
- `apps/web/components/controls/TimeRange.tsx` — relative-range selector (nuqs).

### Agent Execution Prompt

> Role: Senior frontend engineer (Next.js App Router, accessible UI, URL state).
> Context: Task P12-6 of `docs/DEVELOPMENT_PLAN.md` §Phase 12. Status/severity must be accessible — **color + icon + text, never color alone** (spec §14.4, design_system.html §08). The four global controls live in the topbar (DASHBOARD §4): the **NamespaceChip is read-only** because the library binds **one `namespace` per module instance** (spec §12.4) — multi-tenancy is **prefix scoping** (the TenantSwitcher), not namespace switching. Explorer filters + the time range persist in the **URL via `nuqs` typed params** for shareable deep-links (design principle #10), which is why `<NuqsAdapter>` was added in P12-2. The LiveToggle gates the `useCacheSocket` `enabled` flag (P12-5) and is **off by default**.
> Objective: Create `lib/utils.ts`, `lib/cache-status.ts`, the `nuqs` parsers, and the five control components.
> Steps:
>
> 1. `apps/web/lib/utils.ts`:
>    ```ts
>    import { clsx, type ClassValue } from 'clsx'
>    import { twMerge } from 'tailwind-merge'
>    /** Merge Tailwind class lists, de-duping conflicts. */
>    export function cn(...inputs: ClassValue[]): string { return twMerge(clsx(inputs)) }
>    ```
> 2. `apps/web/lib/cache-status.ts` — import `type CacheConnectionStatus` from `@bymax-one/nest-cache/shared`; export `connectionStatusMeta`, `hitMissMeta`, `dataTypeMeta`, each returning `{ color: string; icon: LucideIcon; label: string }`. Use the exact §14.4 palette (ready `#22c55e`, connecting `#60a5fa`, reconnecting `#f59e0b`, closed/end `#ef4444`, error `#a855f7`; hit green / miss amber; string blue / hash purple / set green). Choose sensible lucide icons (e.g. `CheckCircle2`, `Loader2`, `RefreshCw`, `XCircle`, `AlertTriangle`).
> 3. `apps/web/lib/filters.ts` — define `nuqs` parsers (`parseAsString`, `parseAsBoolean`, `parseAsStringLiteral` for the range presets). Export the `tenant`, `live` (boolean, default false), and `range` (`'5m' | '15m' | '1h'`, default `'15m'`) parsers; stub the Explorer filter parsers (`prefix`, `pattern`, `type`, `hasTtl`, `strategy`) for Phase 13 to flesh out.
> 4. Build the five controls under `components/controls/`:
>    - **NamespaceChip** — a read-only mono chip `ns: cache-example` (use the `chip` recipe / shadcn `badge`), with a `tooltip` noting "one namespace per module instance; tenants are prefixes" (spec §12.4). No interactivity.
>    - **TenantSwitcher** — a `select`/`dropdown-menu` bound to `useQueryState('tenant', …)`; options `acme`, `globex` (extendable).
>    - **StatusChip** — `'use client'`; render `connectionStatusMeta(status)` (dot/icon + label) + latency + mode; source the status from the `cache:connection` feed (`useCacheSocket`) and/or a `/health` `useQuery` via `api` (P12-4); default to a neutral "connecting"/"unknown" state until data lands.
>    - **LiveToggle** — a toggle bound to `useQueryState('live', parseAsBoolean.withDefault(false))`; its value is the `enabled` flag passed to `useCacheSocket`.
>    - **TimeRange** — a small segmented control / `select` bound to `useQueryState('range', …)` with presets `Last 5m / 15m / 1h`.
> 5. Wire the controls into the Topbar's `right` slot (via `AppShell`/`Topbar` from P12-3) so they appear top-right.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions (English-only, JSDoc on exports, no `@ts-ignore`).
> - Import status types from `@bymax-one/nest-cache/shared` only.
> - Status surfaces are **color + icon + text** — never color alone (accessibility).
> - The NamespaceChip is read-only (the library has one namespace per instance); the TenantSwitcher does **prefix scoping**, not namespace switching.
> - URL state uses `nuqs` (`useQueryState`); the LiveToggle defaults to **off**.
> - Use the design-system chip/badge recipes; do not invent new control styling.
>   Verification:
> - `pnpm --filter web exec tsc --noEmit` — expected: exit 0.
> - `grep -c "useQueryState\|useQueryStates" apps/web/components/controls/*.tsx` — expected: ≥ 1 (URL state in use).
> - `grep -c "#22c55e" apps/web/lib/cache-status.ts` — expected: ≥ 1 (ready-green from §14.4).
> - `grep -c "twMerge" apps/web/lib/utils.ts` — expected: ≥ 1.
> - Manual: `pnpm --filter web dev`, toggle the TenantSwitcher / TimeRange / Live — expected: the query string updates (shareable deep-link).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P12-6 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P12-7 — shadcn component set scaffold + phase verification (`build`, shell, status)

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** M (90 min – half day)
- **Depends on:** `P12-1`, `P12-2`, `P12-3`, `P12-4`, `P12-5`, `P12-6`

### Description

Scaffold the shadcn `new-york` primitive set the dashboard pages (Phases 13–14) will compose, override `button` to the pill + brand-gradient variant and `card` to the glass variant (design_system.html §07/§10 step 4, DASHBOARD §19), and run the **Phase 12 Definition of Done** gate. This closes the skeleton: the shell renders the orange/glass dark theme + brand mark + cache nav, the status chip turns green when the API is up, `pnpm --filter web build` succeeds, and — the headline proof — the `@bymax-one/nest-cache/shared` import resolves with **no NestJS/ioredis in the client bundle** (spec §8.2, matrix #48).

### Acceptance Criteria

- [ ] shadcn components scaffolded under `components/ui/`: `button`, `card`, `badge`, `input`, `label`, `select`, `table`, `tabs`, `tooltip`, `dialog`, `dropdown-menu`, `popover`, `scroll-area`, `skeleton`, `sonner`, `command` (DASHBOARD §19 component set).
- [ ] `button` is overridden to the pill + brand-gradient `default` variant (`rounded-full bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-sm hover:shadow-(--shadow-primary) hover:scale-[1.02] active:scale-[0.98]`, sizes `h-10 px-6` / `sm h-8 px-4 text-xs` / `lg h-12 px-8` / `icon h-10 w-10`); `outline`/`ghost` use the glass tokens.
- [ ] `card` is overridden to the glass variant (`border-(--glass-border) bg-(--glass-card-bg) rounded-2xl border shadow-sm backdrop-blur-md`; `CardTitle` `font-mono text-xl font-bold`).
- [ ] `pnpm --filter web build` succeeds (exit 0).
- [ ] `pnpm --filter web exec tsc --noEmit` passes; `pnpm lint` is clean for `apps/web`.
- [ ] **Visual:** running `apps/web` + `apps/api`, the shell renders the orange/glass dark theme + brand mark + grouped cache nav; placed beside a sibling example screenshot the chrome is indistinguishable (spec §14.5).
- [ ] **Live status:** with the API up (`/health` reachable and/or the `cache:connection` feed), the StatusChip turns **green** (`ready`).
- [ ] **Bundle proof:** the `@bymax-one/nest-cache/shared` import resolves in the client and the production client bundle contains **no** NestJS or ioredis modules (verified by grepping `.next` output / a bundle check) — matrix #48.

### Files to create / modify

- `apps/web/components/ui/*` — the scaffolded + overridden shadcn primitives (button, card, badge, input, label, select, table, tabs, tooltip, dialog, dropdown-menu, popover, scroll-area, skeleton, sonner, command).
- _(verification only for the gate — fix earlier P12 task files if a check fails.)_

### Agent Execution Prompt

> Role: Senior frontend engineer (shadcn/ui, Next.js build, bundle analysis).
> Context: Final task P12-7 of `docs/DEVELOPMENT_PLAN.md` §Phase 12. Scaffold the shadcn `new-york` set (DASHBOARD §19), override `button`/`card` to the brand recipes (design_system.html §07/§10 step 4), then run the Phase 12 DoD gate. The headline acceptance: the shell is visually indistinguishable from a sibling example (spec §14.5), the status chip turns green when the API is up, `pnpm --filter web build` succeeds, and the `/shared` import resolves with **no NestJS/ioredis in the client bundle** (spec §8.2, matrix #48). Demonstrates matrix rows **#44** (`CacheErrorCode` in `api-client.ts`), **#46** (`CacheConnectionStatus` badge in `cache-status.ts`/`StatusChip`), **#48** (the shared subpath in the browser bundle).
> Objective: Scaffold + override the shadcn set and verify the full Phase 12 skeleton.
> Steps:
>
> 1. Scaffold the components with the shadcn CLI against the copied `components.json` (`new-york`, lucide, cssVariables):
>    `pnpm --filter web dlx shadcn@latest add button card badge input label select table tabs tooltip dialog dropdown-menu popover scroll-area skeleton sonner command` (run from `apps/web`). If the CLI prompts, accept the `components/ui` path from `components.json`.
> 2. Override `components/ui/button.tsx` — replace the CVA `variants.variant.default` and `size` map with the design-system pill + brand-gradient recipe (classes in the acceptance criteria / DASHBOARD §19); keep `outline`/`ghost` on glass tokens. Async-action callers disable + show a spinner (no double-fire) — document this in the button JSDoc for later pages.
> 3. Override `components/ui/card.tsx` — apply the glass surface (`border-(--glass-border) bg-(--glass-card-bg) rounded-2xl border shadow-sm backdrop-blur-md`) and `CardTitle` to `font-mono text-xl font-bold`.
> 4. Confirm `sonner` scaffolded a `Toaster` compatible with the one wired in `app/providers.tsx` (P12-2) — keep a single `<Toaster theme="dark">`.
> 5. Run the Phase 12 DoD verification (below). If any check fails, fix the corresponding earlier P12 task file, then return here. Do NOT lower a threshold, add `next-themes`/`autoprefixer`, or `@ts-ignore` to pass.
> 6. Bundle proof (matrix #48): build, then confirm the client chunks under `apps/web/.next` reference the `/shared` types but contain **no** `@nestjs` or `ioredis` modules. A quick check: `grep -rl "ioredis\|@nestjs" apps/web/.next/static 2>/dev/null` should return nothing. (The `/shared` subpath is zero-dep by design — spec §8.2.)
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions (English-only, no `@ts-ignore`, no `eslint-disable`).
> - Keep the design system **verbatim** — overrides only adapt `button`/`card` to the documented brand recipes; do not restyle the token block or invent variants.
> - Do NOT add `next-themes`, `autoprefixer`, or `postcss-import`.
> - The browser bundle must stay library-clean: imports come from `@bymax-one/nest-cache/shared` only.
> - This is a verification gate — prove it green; do not paper over a failure with placeholder content.
>   Verification:
> - `pnpm --filter web exec tsc --noEmit` — expected: exit 0.
> - `pnpm --filter web build` — expected: exit 0.
> - `pnpm lint` — expected: exit 0 (clean for `apps/web`).
> - `ls apps/web/components/ui/button.tsx apps/web/components/ui/card.tsx` — expected: both exist; `grep -c "from-brand-500" apps/web/components/ui/button.tsx` ≥ 1; `grep -c "glass-card-bg" apps/web/components/ui/card.tsx` ≥ 1.
> - `grep -rl "ioredis" apps/web/.next/static 2>/dev/null; grep -rl "@nestjs" apps/web/.next/static 2>/dev/null` — expected: no output (no server-only deps in the client bundle).
> - Manual: run `apps/api` (`pnpm --filter api start:dev`) + `apps/web` (`pnpm --filter web dev`); open `http://localhost:3000` — expected: the orange/glass dark shell with brand mark + grouped cache nav; the StatusChip turns **green** (`ready`) once `/health` / the `cache:connection` feed reports up.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P12-7 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

When this task is 🟢, Phase 12 is 7/7 — switch the Phase 12 row in `DEVELOPMENT_PLAN.md` Progress Summary to 🟢 Done.

⚠️ Never mark done with failing verification.

---

## Completion log

_(Agents append one line per finished task, newest at the bottom.)_
