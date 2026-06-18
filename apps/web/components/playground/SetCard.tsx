/**
 * @fileoverview `SetCard` — the set data-structure card. Exercises a product's tag
 * set (`cache-example:tags:{id}`): `sadd`, `srem`, `sismember`, and `smembers` +
 * `scard`. Set members are stored as raw strings — the serializer is intentionally
 * not applied to them (a documented library behaviour).
 *
 * @module components/playground/SetCard
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PlaygroundCard } from './PlaygroundCard'
import { usePlaygroundOp } from './use-playground-op'
import { collectionsApi } from '@/lib/playground-api'
import { APP_NAMESPACE } from '@/lib/constants'

/** The Sets (tags) playground card. */
export function SetCard() {
  const { outcome, isPending, runOp } = usePlaygroundOp()
  const [id, setId] = useState('p1')
  const [tag, setTag] = useState('sale')

  const key = `${APP_NAMESPACE}:tags:${id}`
  const explorerHref = '/explorer?prefix=tags'

  return (
    <PlaygroundCard
      title="Sets (tags)"
      ops="sadd · srem · sismember · smembers · scard"
      note="Raw string members — the serializer is intentionally not applied to set members."
      outcome={outcome}
      explorerHref={explorerHref}
    >
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="set-id" className="text-xs">
            product id
          </Label>
          <Input id="set-id" value={id} onChange={(e) => setId(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="set-tag" className="text-xs">
            tag
          </Label>
          <Input id="set-tag" value={tag} onChange={(e) => setTag(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() =>
            void runOp({
              label: 'sadd',
              run: () => collectionsApi.addTags(id, [tag]),
              resultingKey: key,
              explorerHref,
            })
          }
        >
          sadd
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() =>
            void runOp({
              label: 'srem',
              run: () => collectionsApi.removeTag(id, tag),
              resultingKey: key,
              explorerHref,
            })
          }
        >
          srem
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() =>
            void runOp({
              label: 'sismember',
              run: () => collectionsApi.hasTag(id, tag),
              resultingKey: key,
            })
          }
        >
          sismember
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() =>
            void runOp({
              label: 'smembers + scard',
              run: () => collectionsApi.listTags(id),
              resultingKey: key,
              explorerHref,
            })
          }
        >
          smembers
        </Button>
      </div>
    </PlaygroundCard>
  )
}
