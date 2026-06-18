/**
 * @fileoverview `PublishCard` — the Pub/Sub publish form. A channel input + a
 * JSON payload textarea (validated before submit) fire `POST /pubsub/publish`
 * (the browser publishes over REST, never the socket — DASHBOARD §18). On success
 * the returned subscriber count is surfaced inline and as a toast; the message then
 * fans out to every connected tab's live `cache:event` feed.
 *
 * @module components/realtime/PublishCard
 */

'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { pubsubApi, type PublishResponse } from '@/lib/realtime-api'
import { ApiRequestError, unwrap } from '@/lib/cache-api'

/** The default example channel + payload, so the card is usable on first render. */
const DEFAULT_CHANNEL = 'product-events'
const DEFAULT_PAYLOAD = '{ "type": "price", "id": "42", "cents": 990 }'

/** Parse the payload textarea into a JSON value, or return a parse error message. */
function parsePayload(raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(raw) as unknown }
  } catch {
    return { ok: false, error: 'Payload is not valid JSON' }
  }
}

/**
 * The publish form card.
 *
 * @returns A card with the channel/payload inputs and the publish action.
 */
export function PublishCard() {
  const [channel, setChannel] = useState(DEFAULT_CHANNEL)
  const [payload, setPayload] = useState(DEFAULT_PAYLOAD)
  const [jsonError, setJsonError] = useState<string | null>(null)

  const publish = useMutation<PublishResponse, Error, unknown>({
    mutationFn: (message: unknown) => pubsubApi.publish(channel, message).then(unwrap),
    onSuccess: (result) =>
      toast.success('Published', {
        description: `Delivered to ${result.subscribers} subscriber(s) on ${result.channel}`,
      }),
    onError: (error) =>
      toast.error('Publish failed', {
        description: error instanceof ApiRequestError ? error.apiError.message : error.message,
      }),
  })

  const handlePublish = (): void => {
    const parsed = parsePayload(payload)
    if (!parsed.ok) {
      setJsonError(parsed.error)
      toast.error(parsed.error)
      return
    }
    setJsonError(null)
    publish.mutate(parsed.value)
  }

  return (
    <Card>
      <CardHeader accent>
        <CardTitle className="text-base">Publish</CardTitle>
        <p className="font-mono text-xs text-muted-foreground">POST /pubsub/publish</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="publish-channel" className="text-xs">
            channel
          </Label>
          <Input
            id="publish-channel"
            value={channel}
            onChange={(event) => setChannel(event.target.value)}
            className="font-mono"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="publish-payload" className="text-xs">
            payload (JSON)
          </Label>
          <textarea
            id="publish-payload"
            value={payload}
            onChange={(event) => setPayload(event.target.value)}
            rows={3}
            className="w-full rounded-lg border border-(--glass-border) bg-(--glass-bg) p-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {jsonError ? <p className="text-xs text-(--color-danger)">{jsonError}</p> : null}
        </div>
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            size="sm"
            disabled={publish.isPending || channel.trim().length === 0}
            onClick={handlePublish}
          >
            {publish.isPending ? 'Publishing…' : 'Publish'}
          </Button>
          {publish.data ? (
            <span className="font-mono text-xs text-muted-foreground">
              → delivered to{' '}
              <span className="text-(--color-success)">{publish.data.subscribers}</span> sub(s)
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
