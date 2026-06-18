/**
 * @fileoverview Error Explorer route — trigger each `CacheException` and read its
 * code + HTTP status + structured body, typed end-to-end via the library's
 * `/shared` subpath. The route segment is a Server Component fixing the shell;
 * {@link ErrorsView} owns the trigger list and response panel.
 *
 * @module app/errors/page
 */

import { AppShell } from '@/components/layout/AppShell'
import { ErrorsView } from '@/components/labs/ErrorsView'

// Fully interactive client page (triggers + response panel); render dynamically.
export const dynamic = 'force-dynamic'

/**
 * The Error Explorer page.
 *
 * @returns The error trigger list and response panel in the app shell.
 */
export default function ErrorsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="font-mono text-2xl font-bold">Error Explorer</h1>
          <p className="text-sm text-muted-foreground">
            Trigger each of the 15 cache error codes — status, structured body, canonical message.
          </p>
        </header>
        <ErrorsView />
      </div>
    </AppShell>
  )
}
