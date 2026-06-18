/**
 * @fileoverview `BatchCard` — the batch data-structure card. `mget` reads several
 * products in one round-trip (`GET /catalog/products?ids=`); the bulk write seeds N
 * products in a single `pipeline()` round-trip (`POST /admin/seed`) — the demo's
 * mset-style batch write. Resulting keys are `cache-example:product:{n}`.
 *
 * @module components/playground/BatchCard
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PlaygroundCard } from './PlaygroundCard'
import { usePlaygroundOp } from './use-playground-op'
import { catalogApi } from '@/lib/playground-api'
import { cacheApi } from '@/lib/cache-api'
import { APP_NAMESPACE } from '@/lib/constants'

/** Parse a comma-separated id list into trimmed, non-empty ids. */
function parseIds(raw: string): string[] {
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

/** The Batch (mget / bulk seed) playground card. */
export function BatchCard() {
  const { outcome, isPending, runOp } = usePlaygroundOp()
  const [ids, setIds] = useState('1,2,3')

  const parsed = parseIds(ids)
  const explorerHref = '/explorer?prefix=product'

  return (
    <PlaygroundCard
      title="Batch"
      ops="mget · mset (pipeline seed)"
      note="mget reads many keys in one round-trip; the bulk seed writes N via pipeline()."
      outcome={outcome}
      explorerHref={explorerHref}
    >
      <div className="space-y-1">
        <Label htmlFor="batch-ids" className="text-xs">
          ids (comma-separated)
        </Label>
        <Input id="batch-ids" value={ids} onChange={(e) => setIds(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending || parsed.length === 0}
          onClick={() =>
            void runOp({
              label: 'mget',
              run: () => catalogApi.batchGet(parsed),
              resultingKey: `${APP_NAMESPACE}:product:{${parsed.join(',')}}`,
              explorerHref,
            })
          }
        >
          mget
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isPending || parsed.length === 0}
          onClick={() =>
            void runOp({
              label: 'mset (pipeline seed)',
              run: () => cacheApi.seed(parsed.length),
              resultingKey: `${APP_NAMESPACE}:product:1..${parsed.length}`,
              explorerHref,
            })
          }
        >
          mset
        </Button>
      </div>
    </PlaygroundCard>
  )
}
