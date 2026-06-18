/**
 * @fileoverview `SubscriptionManager` — the Pub/Sub subscription card. Toggles
 * exact `subscribe` and pattern `psubscribe` (e.g. `product:*`) against
 * `POST`/`DELETE /pubsub/subscribe`, showing the library's **ref-count per
 * channel**. It demonstrates the ref-counted lifecycle: `subscribe×2 →
 * unsubscribe×1` keeps delivery alive, and a double-unsubscribe is a safe no-op
 * (the server returns the authoritative ref-count after every call).
 *
 * @module components/realtime/SubscriptionManager
 */

'use client'

import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Minus, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { pubsubApi, type SubscriptionResponse } from '@/lib/realtime-api'
import { ApiRequestError, unwrap } from '@/lib/cache-api'

/** A tracked subscription row: its channel/pattern and the server-reported ref-count. */
export interface SubscriptionRow {
  /** Exact channel or glob pattern. */
  channel: string
  /** Whether it is a `psubscribe` pattern subscription. */
  pattern: boolean
  /** The last ref-count the server reported for this channel. */
  refs: number
}

/** Props for {@link SubscriptionManager}. */
export interface SubscriptionManagerProps {
  /** Notified with the current rows whenever they change, so the feed can annotate pattern hits. */
  onRowsChange?: (rows: readonly SubscriptionRow[]) => void
}

/** The example rows seeded so the ref-count mechanics are visible immediately. */
const INITIAL_ROWS: readonly SubscriptionRow[] = [
  { channel: 'product-events', pattern: false, refs: 0 },
  { channel: 'product:*', pattern: true, refs: 0 },
]

/** Mutation arguments: the channel, whether it is a pattern, and the direction. */
interface MutateArgs {
  channel: string
  pattern: boolean
  direction: 'subscribe' | 'unsubscribe'
}

/**
 * The subscription manager card.
 *
 * @param props - Optional `onRowsChange` callback reporting the current rows.
 * @returns A card with the subscription rows and the add-subscription control.
 */
export function SubscriptionManager({ onRowsChange }: SubscriptionManagerProps = {}) {
  const [rows, setRows] = useState<readonly SubscriptionRow[]>(INITIAL_ROWS)
  const [newChannel, setNewChannel] = useState('')
  const [isPattern, setIsPattern] = useState(false)

  // Report row changes up so the live feed can flag which pattern matched a message.
  useEffect(() => onRowsChange?.(rows), [rows, onRowsChange])

  const mutate = useMutation<SubscriptionResponse, Error, MutateArgs>({
    mutationFn: ({ channel, pattern, direction }: MutateArgs) =>
      (direction === 'subscribe'
        ? pubsubApi.subscribe(channel, pattern)
        : pubsubApi.unsubscribe(channel, pattern)
      ).then(unwrap),
    onSuccess: (result) =>
      setRows((prev) =>
        prev.map((row) => (row.channel === result.channel ? { ...row, refs: result.refs } : row)),
      ),
    onError: (error) =>
      toast.error('Subscription update failed', {
        description: error instanceof ApiRequestError ? error.apiError.message : error.message,
      }),
  })

  const addRow = (): void => {
    const channel = newChannel.trim()
    if (channel.length === 0) return
    setRows((prev) =>
      prev.some((row) => row.channel === channel)
        ? prev
        : [...prev, { channel, pattern: isPattern, refs: 0 }],
    )
    setNewChannel('')
    setIsPattern(false)
  }

  return (
    <Card>
      <CardHeader accent>
        <CardTitle className="text-base">Subscriptions</CardTitle>
        <p className="font-mono text-xs text-muted-foreground">
          POST / DELETE /pubsub/subscribe · ref-counted
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.channel}
              className="flex items-center justify-between gap-2 rounded-lg border border-(--glass-border) bg-(--glass-bg) p-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {row.pattern ? 'psubscribe' : 'subscribe'}
                </Badge>
                <span className="truncate font-mono text-xs" title={row.channel}>
                  {row.channel}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="font-mono text-xs text-muted-foreground">
                  refs <span className="text-foreground">×{row.refs}</span>
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                  aria-label={`Subscribe to ${row.channel}`}
                  disabled={mutate.isPending}
                  onClick={() =>
                    mutate.mutate({
                      channel: row.channel,
                      pattern: row.pattern,
                      direction: 'subscribe',
                    })
                  }
                >
                  <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                  aria-label={`Unsubscribe from ${row.channel}`}
                  disabled={mutate.isPending}
                  onClick={() =>
                    mutate.mutate({
                      channel: row.channel,
                      pattern: row.pattern,
                      direction: 'unsubscribe',
                    })
                  }
                >
                  <Minus aria-hidden="true" className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex items-end gap-2 border-t border-(--glass-border) pt-3">
          <div className="flex-1 space-y-1">
            <Label htmlFor="sub-channel" className="text-xs">
              add channel / pattern
            </Label>
            <Input
              id="sub-channel"
              value={newChannel}
              placeholder="e.g. cart:*"
              onChange={(event) => setNewChannel(event.target.value)}
              className="font-mono"
            />
          </div>
          <label className="flex h-10 items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={isPattern}
              onChange={(event) => setIsPattern(event.target.checked)}
              className="accent-brand-500"
            />
            pattern
          </label>
          <Button type="button" size="sm" variant="outline" onClick={addRow}>
            + add
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Subscribe twice, then unsubscribe once — delivery survives while the ref-count stays above
          zero; a second unsubscribe is a safe no-op.
        </p>
      </CardContent>
    </Card>
  )
}
