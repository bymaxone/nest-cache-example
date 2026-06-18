/**
 * @fileoverview `NumericsCard` — the numeric data-structure card. Exercises the
 * atomic counter ops: `incr` / `incr +N` on the views counter
 * (`cache-example:views:{id}`) and `decr` on the stock counter
 * (`cache-example:stock:{id}`). These are server-atomic — no read-modify-write race.
 *
 * @module components/playground/NumericsCard
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PlaygroundCard } from './PlaygroundCard'
import { usePlaygroundOp } from './use-playground-op'
import { countersApi } from '@/lib/playground-api'
import { APP_NAMESPACE } from '@/lib/constants'

/** Step size for the "incr +N" action. */
const INCR_STEP = 5

/** The Numerics (counters) playground card. */
export function NumericsCard() {
  const { outcome, isPending, runOp } = usePlaygroundOp()
  const [id, setId] = useState('p1')

  const viewsKey = `${APP_NAMESPACE}:views:${id}`
  const stockKey = `${APP_NAMESPACE}:stock:${id}`
  // Deep-links pre-filtered to the resulting key via the `pattern` (id glob) param.
  const viewsHref = `/explorer?prefix=views&pattern=${encodeURIComponent(id)}`
  const stockHref = `/explorer?prefix=stock&pattern=${encodeURIComponent(id)}`

  return (
    <PlaygroundCard
      title="Numerics"
      ops="incr · incr +N · decr"
      note="Atomic Redis counters — no read-modify-write race."
      outcome={outcome}
      explorerHref={viewsHref}
    >
      <div className="space-y-1">
        <Label htmlFor="numerics-id" className="text-xs">
          id
        </Label>
        <Input id="numerics-id" value={id} onChange={(e) => setId(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() =>
            void runOp({
              label: 'views',
              run: () => countersApi.views(id),
              resultingKey: viewsKey,
              explorerHref: viewsHref,
            })
          }
        >
          get views
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() =>
            void runOp({
              label: 'incr',
              run: () => countersApi.incrViews(id),
              resultingKey: viewsKey,
              explorerHref: viewsHref,
            })
          }
        >
          incr
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() =>
            void runOp({
              label: `incr +${INCR_STEP}`,
              run: () => countersApi.incrViews(id, INCR_STEP),
              resultingKey: viewsKey,
              explorerHref: viewsHref,
            })
          }
        >
          incr +{INCR_STEP}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() =>
            void runOp({
              label: 'decr stock',
              run: () => countersApi.decrStock(id),
              resultingKey: stockKey,
              explorerHref: stockHref,
            })
          }
        >
          decr stock
        </Button>
      </div>
    </PlaygroundCard>
  )
}
