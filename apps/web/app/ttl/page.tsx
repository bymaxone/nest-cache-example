/**
 * @fileoverview TTL Live route — the headline "watch it expire" page: live
 * countdown rings plus an expiry feed driven by Redis keyspace notifications. The
 * route segment is a Server Component fixing the dynamic rendering mode and the
 * shell; {@link TtlLiveView} owns the seed actions, the countdown wall, and the
 * event-driven fade.
 *
 * @module app/ttl/page
 */

import { AppShell } from '@/components/layout/AppShell'
import { TtlLiveView } from '@/components/realtime/TtlLiveView'

// The view reads the `live` URL flag and the live socket buffer, so render dynamically.
export const dynamic = 'force-dynamic'

/**
 * The TTL Live page.
 *
 * @returns The countdown wall and expiry feed in the app shell.
 */
export default function TtlPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="font-mono text-2xl font-bold">TTL Live</h1>
          <p className="text-sm text-muted-foreground">
            Seed a short-TTL key, watch the ring drain, then the server&apos;s expiry event fades
            the card.
          </p>
        </header>
        <TtlLiveView />
      </div>
    </AppShell>
  )
}
