/**
 * @fileoverview Key Explorer route — the daily-driver namespace key browser. The
 * route segment is a Server Component that fixes the dynamic rendering mode and the
 * chart-wide shell; all interactive, URL-driven state lives in the client
 * {@link ExplorerView}.
 *
 * @module app/explorer/page
 */

import { AppShell } from '@/components/layout/AppShell'
import { ExplorerView } from '@/components/explorer/ExplorerView'

// URL-driven view: the filter rail, strategy toggle, and tenant all read live
// search params via nuqs, so the page renders dynamically.
export const dynamic = 'force-dynamic'

/**
 * The Key Explorer page.
 *
 * @returns The Explorer view wrapped in the app shell.
 */
export default function ExplorerPage() {
  return (
    <AppShell wide>
      <ExplorerView />
    </AppShell>
  )
}
