/**
 * @fileoverview Serializer Lab route — store the same object through the default
 * `JsonSerializer` and a custom `MsgPackSerializer` and compare the raw stored
 * bytes to the decoded value, surfacing the JSON round-trip caveats. The route
 * segment is a Server Component fixing the shell; {@link SerializerView} owns the
 * round-trip and caveat interactions.
 *
 * @module app/serializer/page
 */

import { AppShell } from '@/components/layout/AppShell'
import { SerializerView } from '@/components/labs/SerializerView'

// Fully interactive client page (round-trip + caveat results); render dynamically.
export const dynamic = 'force-dynamic'

/**
 * The Serializer Lab page.
 *
 * @returns The serializer input, comparison panels, and caveat banner in the shell.
 */
export default function SerializerPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="font-mono text-2xl font-bold">Serializer Lab</h1>
          <p className="text-sm text-muted-foreground">
            JSON vs MessagePack — the raw stored bytes beside the decoded value.
          </p>
        </header>
        <SerializerView />
      </div>
    </AppShell>
  )
}
