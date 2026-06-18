/**
 * @fileoverview `TenantPanel` — one side of the tenant split. Shows the tenant's
 * prefix (`tenant:{id}:product`), live key count, a session hit rate, a key list,
 * and the [Seed 10] / [Clear this tenant] actions. Seeding fires read-throughs
 * (cache miss → populate, hit on repeat); clearing runs the server-side
 * `scan` → `delMany`, leaving the other tenant untouched (prefix-scoping proof).
 *
 * @module components/tenants/TenantPanel
 */

'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useKeys, flattenKeyPages, KEYS_QUERY_ROOT } from '@/hooks/use-keys'
import { useClearTenant } from '@/hooks/use-cache-mutations'
import { tenantsApi } from '@/lib/cache-api'
import { formatCount, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Props for {@link TenantPanel}. */
export interface TenantPanelProps {
  /** The tenant id (e.g. `acme`). */
  tenant: string
  /** Whether this is the globally-active tenant (highlighted). */
  isActive?: boolean
}

/** Number of products seeded by the [Seed 10] action. */
const SEED_COUNT = 10

/**
 * A single tenant panel.
 *
 * @param props - The tenant id and whether it is the active tenant.
 * @returns The composed panel card.
 */
export function TenantPanel({ tenant, isActive = false }: TenantPanelProps) {
  const queryClient = useQueryClient()
  const clearTenant = useClearTenant()
  const [isSeeding, setIsSeeding] = useState(false)
  const [session, setSession] = useState({ hits: 0, total: 0 })

  const query = useKeys({ tenant, prefix: 'product' })
  const keys = flattenKeyPages(query.data?.pages ?? [])
  const hitRate = session.total > 0 ? session.hits / session.total : 0

  const handleSeed = async () => {
    setIsSeeding(true)
    try {
      let hits = 0
      for (let i = 1; i <= SEED_COUNT; i++) {
        const result = await tenantsApi.getProduct(tenant, String(i))
        if (result.ok && result.data.source === 'cache') hits++
      }
      setSession((prev) => ({ hits: prev.hits + hits, total: prev.total + SEED_COUNT }))
      void queryClient.invalidateQueries({ queryKey: [KEYS_QUERY_ROOT] })
      toast.success(`Seeded ${SEED_COUNT} products for ${tenant}`)
    } catch {
      // The transport rejects only on a network-layer failure; surface it and
      // always clear the seeding flag so the button never gets stuck.
      toast.error(`Could not seed ${tenant}`)
    } finally {
      setIsSeeding(false)
    }
  }

  const handleClear = () => {
    clearTenant.mutate(tenant, {
      onSuccess: (result) => toast.success(`Cleared ${result.deleted} keys for ${tenant}`),
      onError: (error) => toast.error(error.message),
    })
  }

  return (
    <Card className={cn(isActive && 'ring-1 ring-brand-500/40')}>
      <CardHeader accent className="space-y-1">
        <CardTitle className="text-base">
          {tenant}
          {isActive ? <span className="ml-2 text-xs text-brand-500">active</span> : null}
        </CardTitle>
        <p className="font-mono text-xs text-muted-foreground">tenant:{tenant}:product</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-6 text-sm">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Keys</p>
            <p className="font-mono text-lg font-bold">{formatCount(keys.length)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Hit % (session)
            </p>
            <p className="font-mono text-lg font-bold">
              {session.total > 0 ? formatPercent(hitRate) : '—'}
            </p>
          </div>
        </div>

        <div className="max-h-40 space-y-1 overflow-auto rounded-lg border border-(--glass-border) bg-(--glass-bg) p-2">
          {query.isLoading ? (
            <Skeleton className="h-4 w-3/4" />
          ) : keys.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">
              No keys — seed this tenant →
            </p>
          ) : (
            keys.map((key) => (
              <p key={key} className="truncate font-mono text-[11px]" title={key}>
                {key}
              </p>
            ))
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Button type="button" size="sm" disabled={isSeeding} onClick={() => void handleSeed()}>
            {isSeeding ? 'Seeding…' : `Seed ${SEED_COUNT}`}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={clearTenant.isPending}
            onClick={handleClear}
          >
            Clear this tenant
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
