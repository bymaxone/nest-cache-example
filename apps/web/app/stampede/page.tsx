/**
 * @fileoverview Stampede Lab route — fire N concurrent requests for an uncached
 * key and watch a single-flight Lua lock collapse them into one origin fetch. The
 * route segment is a Server Component fixing the shell; {@link StampedeView} owns
 * the controls, the bespoke swimlane, and the result strip.
 *
 * @module app/stampede/page
 */

import { AppShell } from '@/components/layout/AppShell'
import { StampedeView } from '@/components/labs/StampedeView'

// Fully interactive client page (burst controls + timeline); render dynamically.
export const dynamic = 'force-dynamic'

/**
 * The Stampede Lab page.
 *
 * @returns The stampede controls, timeline, and result strip in the app shell.
 */
export default function StampedePage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="font-mono text-2xl font-bold">Stampede Lab</h1>
          <p className="text-sm text-muted-foreground">
            Fire N concurrent requests for one uncached key — one origin fetch, N−1 cache hits.
          </p>
        </header>
        <StampedeView />
      </div>
    </AppShell>
  )
}
