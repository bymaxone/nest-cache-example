/**
 * @fileoverview Overview route — the cache-health landing page. The route segment
 * is a Server Component fixing the dynamic rendering mode and the chart-wide shell;
 * the golden-signal strip, charts, and breakdowns live in the client
 * {@link OverviewView}.
 *
 * @module app/page
 */

import { AppShell } from '@/components/layout/AppShell'
import { OverviewView } from '@/components/overview/OverviewView'

// URL-driven dashboard: the global controls and the brushable time range read live
// search params via nuqs, so the page renders dynamically rather than prerendered.
export const dynamic = 'force-dynamic'

/**
 * The Overview page.
 *
 * @returns The Overview view wrapped in the app shell.
 */
export default function OverviewPage() {
  return (
    <AppShell wide>
      <OverviewView />
    </AppShell>
  )
}
