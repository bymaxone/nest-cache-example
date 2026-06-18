/**
 * @fileoverview `SerializerView` — the interactive body of the Serializer Lab
 * (DASHBOARD §12). A payload input + a `json | msgpack` codec label drive
 * `POST /serializer/roundtrip`, rendered as a {@link SerializerCompare} of raw
 * stored bytes vs decoded value. A dedicated `Date` caveat run
 * (`POST /serializer/caveat`) proves the `SerializableValue` boundary — `Date`
 * becomes an ISO string under JSON but survives a structure-preserving codec. The
 * active serializer is fixed per instance (`BYMAX_CACHE_SERIALIZER`), surfaced via
 * `GET /serializer/active`.
 *
 * @module components/labs/SerializerView
 */

'use client'

import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { type SerializableValue } from '@bymax-one/nest-cache/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { SerializerCompare } from './SerializerCompare'
import {
  serializerApi,
  type CaveatResult,
  type RoundtripResult,
  type SerializerCodec,
} from '@/lib/labs-api'
import { ApiRequestError, unwrap } from '@/lib/cache-api'

/** The codec labels the selector offers. */
const CODECS: readonly SerializerCodec[] = ['json', 'msgpack']

/**
 * A default payload containing a `Date`-shaped ISO string and nested structure —
 * typed as {@link SerializableValue} to make the JSON-survivable boundary explicit.
 */
const DEFAULT_PAYLOAD: SerializableValue = {
  id: 42,
  when: '2026-06-01T12:00:00.000Z',
  tags: ['a', 'b'],
  active: true,
}

/**
 * The Serializer Lab page body.
 *
 * @returns The input, the round-trip comparison, the caveat proof, and the banner.
 */
export function SerializerView() {
  const [codec, setCodec] = useState<SerializerCodec>('json')
  const [payload, setPayload] = useState(JSON.stringify(DEFAULT_PAYLOAD, null, 2))
  const [jsonError, setJsonError] = useState<string | null>(null)

  const active = useQuery({
    queryKey: ['serializer', 'active'],
    queryFn: () => serializerApi.active(),
  })
  const activeName = active.data?.ok ? active.data.data.serializer : undefined

  const roundtrip = useMutation<RoundtripResult, Error, Record<string, unknown>>({
    mutationFn: (body: Record<string, unknown>) =>
      serializerApi.roundtrip(codec, body).then(unwrap),
    onError: (error) =>
      toast.error('Round-trip failed', {
        description: error instanceof ApiRequestError ? error.apiError.message : error.message,
      }),
  })

  const caveat = useMutation<CaveatResult, Error, void>({
    mutationFn: () => serializerApi.caveat(codec).then(unwrap),
    onError: (error) =>
      toast.error('Caveat run failed', {
        description: error instanceof ApiRequestError ? error.apiError.message : error.message,
      }),
  })

  const handleRoundtrip = (): void => {
    let parsed: unknown
    try {
      parsed = JSON.parse(payload)
    } catch {
      setJsonError('Payload is not valid JSON')
      toast.error('Payload is not valid JSON')
      return
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      setJsonError('Payload must be a JSON object')
      return
    }
    setJsonError(null)
    roundtrip.mutate(parsed as Record<string, unknown>)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader accent>
          <CardTitle className="text-base">Input</CardTitle>
          <p className="font-mono text-xs text-muted-foreground">
            POST /serializer/roundtrip
            {activeName ? (
              <>
                {' · active: '}
                <span className="text-foreground">{activeName}</span>
              </>
            ) : null}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="serializer-payload" className="text-xs">
              payload (JSON object)
            </Label>
            <textarea
              id="serializer-payload"
              value={payload}
              onChange={(event) => setPayload(event.target.value)}
              rows={6}
              className="w-full rounded-lg border border-(--glass-border) bg-(--glass-bg) p-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {jsonError ? <p className="text-xs text-(--color-danger)">{jsonError}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-full border border-(--glass-border) p-0.5">
              {CODECS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={codec === option}
                  onClick={() => setCodec(option)}
                  className={
                    codec === option
                      ? 'rounded-full bg-brand-500 px-3 py-1 text-xs font-medium text-white'
                      : 'rounded-full px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground'
                  }
                >
                  {option}
                </button>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              disabled={roundtrip.isPending}
              onClick={handleRoundtrip}
            >
              {roundtrip.isPending ? 'Storing…' : 'Round-trip'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={caveat.isPending}
              onClick={() => caveat.mutate()}
            >
              {caveat.isPending ? 'Running…' : 'Run Date caveat'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            The active codec is fixed per instance via{' '}
            <span className="font-mono text-foreground">BYMAX_CACHE_SERIALIZER</span> — the selector
            labels the request. Run the API with{' '}
            <span className="font-mono text-foreground">CACHE_SERIALIZER=json</span> vs{' '}
            <span className="font-mono text-foreground">=msgpack</span> to compare both.
          </p>
        </CardContent>
      </Card>

      {roundtrip.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : roundtrip.data ? (
        <Card>
          <CardHeader accent>
            <CardTitle className="text-base">Round-trip — raw bytes vs decoded</CardTitle>
          </CardHeader>
          <CardContent>
            <SerializerCompare
              codecLabel={roundtrip.data.codec}
              raw={roundtrip.data.raw}
              decoded={roundtrip.data.decoded}
              rawBytes={roundtrip.data.rawBytes}
            />
          </CardContent>
        </Card>
      ) : null}

      {caveat.data ? (
        <Card>
          <CardHeader accent>
            <CardTitle className="text-base">Date caveat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Badge variant={caveat.data.dateSurvived ? 'secondary' : 'destructive'}>
              {caveat.data.dateSurvived ? 'Date survived' : 'Date lost (→ ISO string)'}
            </Badge>
            <p className="text-sm text-muted-foreground">{caveat.data.note}</p>
            <SerializerCompare
              codecLabel={caveat.data.codec}
              raw={caveat.data.raw}
              decoded={caveat.data.decoded}
              rawBytes={
                caveat.data.raw === null ? 0 : new TextEncoder().encode(caveat.data.raw).byteLength
              }
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="flex gap-3 p-4 text-sm text-muted-foreground">
          <span aria-hidden="true" className="text-lg">
            ⚠️
          </span>
          <p>
            <span className="text-foreground">SerializableValue caveat:</span> JSON does not
            preserve <span className="font-mono text-foreground">Date</span> (becomes an ISO
            string), <span className="font-mono text-foreground">Map</span>,{' '}
            <span className="font-mono text-foreground">Set</span>,{' '}
            <span className="font-mono text-foreground">BigInt</span>, or{' '}
            <span className="font-mono text-foreground">undefined</span>. A structure-preserving
            codec (MessagePack) keeps them intact. Supply a custom{' '}
            <span className="font-mono text-foreground">ISerializer</span> when you need them.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
