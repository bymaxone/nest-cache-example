/**
 * @fileoverview `TenantSplit` — two {@link TenantPanel}s side by side for the demo
 * tenants. The globally-selected tenant (from the `nuqs` `tenant` param) is
 * highlighted as active; clearing one panel leaves the other visibly intact, which
 * is the prefix-scoping isolation proof.
 *
 * @module components/tenants/TenantSplit
 */

'use client'

import { useQueryState } from 'nuqs'
import { TenantPanel } from './TenantPanel'
import { tenantParser } from '@/lib/filters'

/** The demo tenant ids shown side by side. */
const DEMO_TENANTS = ['acme', 'globex'] as const

/**
 * The two-panel tenant split.
 *
 * @returns The two demo tenant panels side by side, with the active one highlighted.
 */
export function TenantSplit() {
  const [activeTenant] = useQueryState('tenant', tenantParser)
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {DEMO_TENANTS.map((tenant) => (
        <TenantPanel key={tenant} tenant={tenant} isActive={tenant === activeTenant} />
      ))}
    </div>
  )
}
