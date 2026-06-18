/**
 * @fileoverview `HashCard` — the hash data-structure card. Exercises a cart hash
 * (`cache-example:cart:{id}`): `hset` a line, `hget` one field, `hgetall` the whole
 * hash, and `hdel` a field. Hash field values round-trip through the serializer.
 *
 * @module components/playground/HashCard
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

/** The Hashes (cart) playground card. */
export function HashCard() {
  const { outcome, isPending, runOp } = usePlaygroundOp()
  const [id, setId] = useState('u_7')
  const [field, setField] = useState('sku_1')
  const [quantity, setQuantity] = useState('2')
  const [priceCents, setPriceCents] = useState('999')

  const key = `${APP_NAMESPACE}:cart:${id}`
  // Deep-link pre-filtered to the resulting key via the `pattern` (id glob) param.
  const explorerHref = `/explorer?prefix=cart&pattern=${encodeURIComponent(id)}`
  const value = { quantity: Number(quantity), priceCents: Number(priceCents) }

  return (
    <PlaygroundCard
      title="Hashes (cart)"
      ops="hset · hget · hgetall · hdel"
      outcome={outcome}
      explorerHref={explorerHref}
    >
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="hash-id" className="text-xs">
            cart id
          </Label>
          <Input id="hash-id" value={id} onChange={(e) => setId(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="hash-field" className="text-xs">
            field
          </Label>
          <Input id="hash-field" value={field} onChange={(e) => setField(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="hash-qty" className="text-xs">
            quantity
          </Label>
          <Input
            id="hash-qty"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="hash-price" className="text-xs">
            priceCents
          </Label>
          <Input
            id="hash-price"
            type="number"
            value={priceCents}
            onChange={(e) => setPriceCents(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() =>
            void runOp({
              label: 'hset',
              run: () => collectionsApi.setCartLine(id, field, value),
              resultingKey: key,
              explorerHref,
            })
          }
        >
          hset
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() =>
            void runOp({
              label: 'hget',
              run: () => collectionsApi.getCartLine(id, field),
              resultingKey: key,
              explorerHref,
            })
          }
        >
          hget
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() =>
            void runOp({
              label: 'hgetall',
              run: () => collectionsApi.getCart(id),
              resultingKey: key,
              explorerHref,
            })
          }
        >
          hgetall
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() =>
            void runOp({
              label: 'hdel',
              run: () => collectionsApi.removeCartLine(id, field),
              resultingKey: key,
              explorerHref,
            })
          }
        >
          hdel
        </Button>
      </div>
    </PlaygroundCard>
  )
}
