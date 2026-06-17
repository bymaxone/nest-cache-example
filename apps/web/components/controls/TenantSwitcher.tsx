/**
 * @fileoverview Tenant prefix selector. Scopes the dashboard to a tenant by
 * choosing its key prefix (`acme`, `globex`, …); this is prefix scoping within
 * the single namespace, not namespace switching. The selection persists to the
 * URL via `nuqs` so any view is a shareable deep-link.
 *
 * @module components/controls/TenantSwitcher
 */

'use client'

import { useQueryState } from 'nuqs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { tenantParser } from '@/lib/filters'

/** The demo tenant prefixes (extendable). */
const TENANTS = ['acme', 'globex'] as const

/** Dropdown selecting the active tenant prefix, persisted to the URL. */
export function TenantSwitcher() {
  const [tenant, setTenant] = useQueryState('tenant', tenantParser)
  return (
    <Select value={tenant} onValueChange={(value) => void setTenant(value)}>
      <SelectTrigger className="h-8 w-[124px] text-xs">
        <SelectValue placeholder="Tenant" />
      </SelectTrigger>
      <SelectContent>
        {TENANTS.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
