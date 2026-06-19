/**
 * @fileoverview `TtlLiveView` — the interactive body of the TTL Live page
 * (DASHBOARD §10). It wires the {@link CountdownWall} to seeded TTL keys and the
 * seed controls, and renders an expiry {@link EventFeed} of `cache:expired` socket
 * messages (read from the shared, receive-only {@link useCacheSocket} buffer). When
 * a key expires, the server's keyspace event fades the matching tile and fires a
 * "Key expired — re-fetching…" toast — tile removal is driven by that event, never
 * by the local countdown reaching zero.
 *
 * @module components/realtime/TtlLiveView
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { CountdownWall, type CountdownTile } from './CountdownWall'
import { EventFeed } from './EventFeed'
import { useCacheSocket } from '@/hooks/use-cache-socket'
import { liveParser } from '@/lib/filters'
import { type CacheEvent } from '@/lib/socket'
import { ttlApi } from '@/lib/realtime-api'
import { cacheApi, unwrap, ApiRequestError } from '@/lib/cache-api'
import { APP_NAMESPACE } from '@/lib/constants'
import { formatClock } from '@/lib/format'
import { useQueryState } from 'nuqs'

/** A `cache:expired` item from the live socket buffer. */
type ExpiredEvent = Extract<CacheEvent, { kind: 'expired' }>

/** TTL (seconds) applied by the "Seed key w/ TTL: 30s" control. */
const SEED_TTL_SECONDS = 30

/** Milliseconds the tile fade runs before the tile is removed (matches the CSS transition). */
const FADE_DURATION_MS = 700

/** Strip the app namespace prefix from a key for readable display. */
function deNamespace(key: string): string {
  const prefix = `${APP_NAMESPACE}:`
  return key.startsWith(prefix) ? key.slice(prefix.length) : key
}

/** A short, stable label for a tile from its key's trailing id segment. */
function shortLabel(key: string): string {
  // `lastIndexOf(':') + 1` is `0` for a key without a separator, so `slice` yields
  // the whole key; for a namespaced key it returns the trailing id. This always
  // produces a `string` (no possibly-undefined index access), so there is no
  // unreachable fallback branch to cover.
  const id = key.slice(key.lastIndexOf(':') + 1)
  return id.length > 8 ? `${id.slice(0, 8)}…` : id
}

/**
 * The TTL Live page body.
 *
 * @returns The countdown wall, the raw-subscriber callout, and the expiry feed.
 */
export function TtlLiveView() {
  const [live] = useQueryState('live', liveParser)
  const buffer = useCacheSocket(live)
  const [tiles, setTiles] = useState<readonly CountdownTile[]>([])

  // Latest tile keys (ref-mirror) + the set of already-handled expiries, so the
  // expiry effect fades/toasts a tile exactly once and ignores foreign keys.
  const tileKeysRef = useRef<Set<string>>(new Set())
  const handledRef = useRef<Set<string>>(new Set())
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  useEffect(() => {
    tileKeysRef.current = new Set(tiles.map((tile) => tile.key))
  }, [tiles])

  // Clear any pending fade-removal timers on unmount.
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      for (const timer of timers) clearTimeout(timer)
      timers.clear()
    }
  }, [])

  const addTile = (key: string, ttlSeconds: number): void => {
    setTiles((prev) =>
      prev.some((tile) => tile.key === key)
        ? prev
        : [...prev, { key, label: shortLabel(key), prefix: 'ttl', ttlSeconds }],
    )
  }

  const seedTtl = useMutation<{ key: string; ttlSeconds: number }, Error, void>({
    mutationFn: () => ttlApi.seed(SEED_TTL_SECONDS).then(unwrap),
    onSuccess: (result) => {
      addTile(result.key, result.ttlSeconds)
      toast.success(`Seeded ${result.ttlSeconds}s key`, { description: deNamespace(result.key) })
    },
    onError: (error) =>
      toast.error('Seed failed', {
        description: error instanceof ApiRequestError ? error.apiError.message : error.message,
      }),
  })

  const seedPersisted = useMutation<string, Error, void>({
    // Seed a key, then persist it (remove its TTL) so the tile renders `∞` — a
    // real two-step proof of `set(ttl)` followed by `persist`.
    mutationFn: async () => {
      const seeded = await ttlApi.seed(SEED_TTL_SECONDS).then(unwrap)
      await cacheApi.persistKey(seeded.key).then(unwrap)
      return seeded.key
    },
    onSuccess: (key) => {
      addTile(key, -1)
      toast.success('Seeded persisted key (∞)', { description: deNamespace(key) })
    },
    onError: (error) =>
      toast.error('Seed failed', {
        description: error instanceof ApiRequestError ? error.apiError.message : error.message,
      }),
  })

  // All expiry events in the buffer (oldest-first); namespace-scoped by the server.
  const expiredEvents = buffer
    .toArray()
    .filter((event): event is ExpiredEvent => event.kind === 'expired')

  // Mirror the latest events into a ref so the effect can read them without listing
  // the per-render array (a new reference each render) as a dependency — the effect
  // re-runs only when the expiry *count* changes, not on every rAF flush.
  const expiredRef = useRef(expiredEvents)
  expiredRef.current = expiredEvents

  // React to newly-arrived expiries: fade the matching tile, toast, then remove it
  // after the fade. Driven by the server event — not the local countdown.
  useEffect(() => {
    for (const event of expiredRef.current) {
      // Only act on expiries for a currently-rendered tile; a foreign or
      // not-yet-registered key is skipped WITHOUT being marked handled, so a tile
      // registered after its event can still fade on a later pass.
      if (!tileKeysRef.current.has(event.key)) continue
      if (handledRef.current.has(event.key)) continue
      handledRef.current.add(event.key)
      setTiles((prev) =>
        prev.map((tile) => (tile.key === event.key ? { ...tile, fading: true } : tile)),
      )
      toast('Key expired — re-fetching…', { description: deNamespace(event.key) })
      const timer = setTimeout(() => {
        setTiles((prev) => prev.filter((tile) => tile.key !== event.key))
        timersRef.current.delete(timer)
      }, FADE_DURATION_MS)
      timersRef.current.add(timer)
    }
  }, [expiredEvents.length])

  const feedItems = expiredEvents.slice().reverse()

  return (
    <div className="space-y-6">
      <CountdownWall
        tiles={tiles}
        isSeeding={seedTtl.isPending || seedPersisted.isPending}
        onSeedTtl={() => seedTtl.mutate()}
        onSeedPersisted={() => seedPersisted.mutate()}
      />

      <Card>
        <CardContent className="flex gap-3 p-4 text-sm text-muted-foreground">
          <span aria-hidden="true" className="text-lg">
            🔧
          </span>
          <p>
            Expiry uses the <span className="text-foreground">raw subscriber</span>, not{' '}
            <span className="font-mono text-foreground">PubSubService</span>: Redis keyspace
            channels (<span className="font-mono text-foreground">__keyevent@0__:expired</span>) are
            fixed and live outside any app namespace, so they cannot be subscribed through the
            namespacing Pub/Sub API. The API filters them by the{' '}
            <span className="font-mono text-foreground">{APP_NAMESPACE}:</span> prefix. Requires{' '}
            <span className="font-mono text-foreground">notify-keyspace-events Ex</span> in
            redis.conf.
          </p>
        </CardContent>
      </Card>

      <EventFeed<ExpiredEvent>
        items={feedItems}
        ariaLabel="Live TTL expiry feed"
        getKey={(event) => String(event.seq)}
        emptyState={
          <span>
            No expiries yet — enable the <span className="text-foreground">Live</span> toggle and
            seed a short-TTL key above →
          </span>
        }
        renderRow={(event) => (
          <div className="flex items-center gap-3 px-3 py-2 text-xs">
            <span className="shrink-0 font-mono text-muted-foreground">
              {formatClock(event.at)}
            </span>
            <span className="shrink-0 rounded bg-(--color-danger)/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-(--color-danger)">
              EXPIRED
            </span>
            <span className="min-w-0 flex-1 truncate font-mono text-foreground" title={event.key}>
              {deNamespace(event.key)}
            </span>
          </div>
        )}
      />
    </div>
  )
}
