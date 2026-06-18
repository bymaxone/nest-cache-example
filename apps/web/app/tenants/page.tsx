/**
 * @fileoverview Tenants route — proves the two isolation stories: in-namespace
 * per-tenant prefix scoping (the {@link TenantSplit}) and app-level namespace
 * isolation (the {@link IsolationProof}). The route segment is a Server Component
 * fixing the dynamic rendering mode and the chart-wide shell.
 *
 * @module app/tenants/page
 */

import { AppShell } from '@/components/layout/AppShell'
import { Card, CardContent } from '@/components/ui/card'
import { TenantSplit } from '@/components/tenants/TenantSplit'
import { IsolationProof } from '@/components/tenants/IsolationProof'

// The split reads the active tenant from the nuqs `tenant` param, so render dynamically.
export const dynamic = 'force-dynamic'

/**
 * The Namespace & Tenants page.
 *
 * @returns The tenant split, isolation proof, and honesty callout in the shell.
 */
export default function TenantsPage() {
  return (
    <AppShell wide>
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="font-mono text-2xl font-bold">Namespace &amp; Tenants</h1>
          <p className="text-sm text-muted-foreground">
            Per-tenant prefix scoping within one namespace, plus the namespace boundary.
          </p>
        </header>

        <TenantSplit />
        <IsolationProof />

        {/* Honesty callout — how multi-tenancy actually works here. */}
        <Card>
          <CardContent className="flex gap-3 p-4 text-sm text-muted-foreground">
            <span aria-hidden="true" className="text-lg">
              🎓
            </span>
            <p>
              <span className="font-mono text-foreground">namespace</span> is fixed per instance;
              tenants are <span className="text-foreground">prefixes</span> within it. The
              production &quot;namespace per tenant&quot; pattern is one app instance per tenant
              with <span className="font-mono text-foreground">namespace</span> taken from env — not
              runtime namespace switching.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
