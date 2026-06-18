/**
 * @fileoverview Pub/Sub route — publish from the browser (over REST) and watch the
 * message fan out to every connected tab's live `cache:event` feed, plus a
 * ref-counted subscription manager. The route segment is a Server Component fixing
 * the dynamic rendering mode and the shell; {@link PubSubView} owns the interactivity.
 *
 * @module app/pubsub/page
 */

import { AppShell } from '@/components/layout/AppShell'
import { PubSubView } from '@/components/realtime/PubSubView'

// The view reads the `live` URL flag and the live socket buffer, so render dynamically.
export const dynamic = 'force-dynamic'

/**
 * The Pub/Sub page.
 *
 * @returns The publish/subscribe cards and live feed in the app shell.
 */
export default function PubSubPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="font-mono text-2xl font-bold">Pub/Sub</h1>
          <p className="text-sm text-muted-foreground">
            Publish over REST, watch it fan out to every tab — with ref-counted subscriptions.
          </p>
        </header>
        <PubSubView />
      </div>
    </AppShell>
  )
}
