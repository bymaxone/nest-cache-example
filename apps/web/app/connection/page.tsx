/**
 * @fileoverview Connection & Topology route — the library's connection lifecycle
 * and the Redis-server view: a status badge, a lifecycle feed, the mode selector,
 * and the parsed `INFO` sections. The route segment is a Server Component fixing
 * the dynamic rendering mode and the shell; {@link ConnectionView} owns the live
 * data and INFO reads.
 *
 * @module app/connection/page
 */

import { AppShell } from '@/components/layout/AppShell'
import { ConnectionView } from '@/components/realtime/ConnectionView'

// The view reads the `live` URL flag and the live socket buffer, so render dynamically.
export const dynamic = 'force-dynamic'

/**
 * The Connection & Topology page.
 *
 * @returns The status badge, mode selector, INFO viewer, and lifecycle feed in the shell.
 */
export default function ConnectionPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="font-mono text-2xl font-bold">Connection &amp; Topology</h1>
          <p className="text-sm text-muted-foreground">
            The connection lifecycle, the active mode, and the Redis server view.
          </p>
        </header>
        <ConnectionView />
      </div>
    </AppShell>
  )
}
