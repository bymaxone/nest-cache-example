/**
 * @fileoverview Playground route — one card per Redis data structure for firing
 * cache ops by hand. The route segment is a Server Component fixing the dynamic
 * rendering mode and the chart-wide shell; each card is an interactive client
 * component that fires typed ops and offers a View-in-Explorer deep-link.
 *
 * @module app/playground/page
 */

import { AppShell } from '@/components/layout/AppShell'
import { StringsCard } from '@/components/playground/StringsCard'
import { NumericsCard } from '@/components/playground/NumericsCard'
import { HashCard } from '@/components/playground/HashCard'
import { SetCard } from '@/components/playground/SetCard'
import { BatchCard } from '@/components/playground/BatchCard'

// The cards offer "View in Explorer →" links into URL-driven views, so keep the
// page dynamic rather than statically prerendered.
export const dynamic = 'force-dynamic'

/**
 * The Playground page — five data-structure cards.
 *
 * @returns The Playground grid wrapped in the app shell.
 */
export default function PlaygroundPage() {
  return (
    <AppShell wide>
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="font-mono text-2xl font-bold">Playground</h1>
          <p className="text-sm text-muted-foreground">
            Fire every cache operation by hand — one card per data structure.
          </p>
        </header>
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          <StringsCard />
          <NumericsCard />
          <HashCard />
          <SetCard />
          <BatchCard />
        </div>
      </div>
    </AppShell>
  )
}
