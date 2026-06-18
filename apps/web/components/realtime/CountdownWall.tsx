/**
 * @fileoverview `CountdownWall` — a responsive grid of TTL countdown tiles plus
 * the seed controls, for the TTL Live page (DASHBOARD §10). Each tile pairs a
 * bespoke {@link TtlRing} with its key label and entity-prefix chip. The wall is
 * presentation-only: it takes its tiles and seed callbacks via props so the TTL
 * Live page owns the live TTL data, the seed mutations, and the event-driven fade —
 * a tile fades (and is then removed by the page) only when its `fading` flag is
 * set from a confirmed `cache:expired` event, never from the local timer.
 *
 * @module components/realtime/CountdownWall
 */

'use client'

import { type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { TtlRing } from './TtlRing'

/** One countdown tile — a TTL'd (or persisted) key the wall renders. */
export interface CountdownTile {
  /** Fully-namespaced key (stable React key + identity for expiry matching). */
  key: string
  /** Short id label shown under the ring. */
  label: string
  /** Entity-prefix chip (e.g. `product`, `ttl-demo`). */
  prefix: string
  /** TTL in seconds (Redis convention: `-1` persisted). */
  ttlSeconds: number
  /** When true, the tile fades out (a confirmed `cache:expired` event arrived). */
  fading?: boolean
}

/** Props for {@link CountdownWall}. */
export interface CountdownWallProps {
  /** The tiles to render. */
  tiles: readonly CountdownTile[]
  /** Seed a key with a short (30s) TTL. */
  onSeedTtl: () => void
  /** Seed a persisted (no-expiry) key. */
  onSeedPersisted: () => void
  /** Disable the seed controls while a seed mutation is in flight. */
  isSeeding?: boolean
  /** Optional override for the action-oriented empty state. */
  emptyState?: ReactNode
}

/**
 * Render the seed controls and the grid of TTL countdown tiles.
 *
 * @param props - The tiles, seed callbacks, and pending flag.
 * @returns The countdown wall.
 */
export function CountdownWall({
  tiles,
  onSeedTtl,
  onSeedPersisted,
  isSeeding = false,
  emptyState,
}: CountdownWallProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={isSeeding} onClick={onSeedTtl}>
          Seed key w/ TTL: 30s
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isSeeding}
          onClick={onSeedPersisted}
        >
          Seed persisted (∞)
        </Button>
      </div>

      {tiles.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center rounded-2xl border border-(--glass-border) bg-(--glass-bg) p-6 text-center text-sm text-muted-foreground">
          {emptyState ?? 'No TTL keys yet — seed one above to watch it drain and expire.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {tiles.map((tile) => (
            <div
              key={tile.key}
              className={cn(
                'flex flex-col items-center gap-3 rounded-2xl border border-(--glass-border) bg-(--glass-bg) p-4 transition-opacity duration-700',
                tile.fading && 'opacity-0',
              )}
            >
              <TtlRing ttlSeconds={tile.ttlSeconds} />
              <div className="flex flex-col items-center gap-1 text-center">
                <Badge variant="outline" className="font-mono text-[10px]">
                  {tile.prefix}
                </Badge>
                <span className="font-mono text-xs text-muted-foreground">{tile.label}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
