/**
 * @fileoverview Overview page. Renders the app shell around a single glass
 * panel, exercising the chrome (topbar, sidebar, dark glass theme) end to end.
 *
 * @module app/page
 */

import { AppShell } from '@/components/layout/AppShell'

// URL-driven dashboard: the global controls read live search params via nuqs,
// so the page renders dynamically rather than being statically prerendered.
export const dynamic = 'force-dynamic'

/**
 * Placeholder Overview route — proves the shell renders the orange/glass dark
 * theme with the brand mark and grouped cache nav.
 *
 * @returns The Overview page wrapped in the app shell.
 */
export default function OverviewPage() {
  return (
    <AppShell wide>
      <div className="rounded-2xl border border-(--glass-border) bg-(--glass-card-bg) p-6 shadow-sm backdrop-blur-md">
        <h1 className="font-mono text-xl font-bold">Overview</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cache Observability &amp; Control Console for{' '}
          <span className="font-mono text-brand-500">@bymax-one/nest-cache</span>.
        </p>
      </div>
    </AppShell>
  )
}
