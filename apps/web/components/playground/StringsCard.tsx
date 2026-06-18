/**
 * @fileoverview `StringsCard` — the string data-structure card. Exercises the
 * catalog product key (`cache-example:product:{id}`): idempotent `setNx` seed,
 * read-through `get`, `getRaw` (the serialized string, via the admin inspect), an
 * `exists` probe (via TTL), and TTL set/persist. The honest label explains that
 * `getRaw` returns the serialized JSON string while `get` returns the decoded value.
 *
 * @module components/playground/StringsCard
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

/** Seconds added by the card's "set TTL" action. */
const TTL_SECONDS = 60

/** The Strings (catalog product) playground card. */
export function StringsCard() {
  const { outcome, isPending, runOp } = usePlaygroundOp()
  const [id, setId] = useState('99')
  const [name, setName] = useState('Demo widget')

  const key = `${APP_NAMESPACE}:product:${id}`
  // Deep-link pre-filtered to the resulting key via the `pattern` (id glob) param.
  const explorerHref = `/explorer?prefix=product&pattern=${encodeURIComponent(id)}`

  return (
    <PlaygroundCard
      title="Strings"
      ops="setNx · get · getRaw · exists · expire · persist"
      note="getRaw returns the serialized string Redis stores; get returns the decoded value."
      outcome={outcome}
      explorerHref={explorerHref}
    >
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="strings-id" className="text-xs">
            id
          </Label>
          <Input id="strings-id" value={id} onChange={(e) => setId(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="strings-name" className="text-xs">
            name
          </Label>
          <Input id="strings-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() =>
            void runOp({
              label: 'setNx',
              run: () => catalogApi.seed(id, { name }),
              resultingKey: key,
              explorerHref,
            })
          }
        >
          setNx
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() =>
            void runOp({
              label: 'get',
              run: () => catalogApi.get(id),
              resultingKey: key,
              explorerHref,
            })
          }
        >
          get
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() =>
            void runOp({
              label: 'getRaw',
              run: async () => {
                const result = await cacheApi.inspectKey(key)
                return result.ok ? { ok: true, data: result.data.raw } : result
              },
              resultingKey: key,
              explorerHref,
            })
          }
        >
          getRaw
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() =>
            void runOp({
              label: 'exists',
              run: async () => {
                const result = await catalogApi.ttl(id)
                return result.ok ? { ok: true, data: result.data !== -2 } : result
              },
              resultingKey: key,
            })
          }
        >
          exists
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() =>
            void runOp({
              label: `expire +${TTL_SECONDS}s`,
              run: () => catalogApi.expire(id, TTL_SECONDS),
              resultingKey: key,
            })
          }
        >
          expire +{TTL_SECONDS}s
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() =>
            void runOp({ label: 'persist', run: () => catalogApi.persist(id), resultingKey: key })
          }
        >
          persist
        </Button>
      </div>
    </PlaygroundCard>
  )
}
