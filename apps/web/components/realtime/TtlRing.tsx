/**
 * @fileoverview `TtlRing` — a bespoke SVG radial countdown for the TTL Live wall
 * (custom SVG, never a chart library — DASHBOARD §15). A draining arc plus a
 * centered `mm:ss` / `∞` / `—` label decrements client-side from the seeded TTL;
 * on reaching zero it holds an "expiring…" terminal state and **never** removes
 * itself — confirmation of expiry is the server's keyspace event (wired by the
 * TTL Live page), never the local timer hitting zero.
 *
 * This is the larger, card-centred sibling of the Explorer's inline `TtlRing`:
 * same Redis TTL conventions (`-1` persisted → `∞`, other negatives → absent),
 * sized for the countdown grid. The arc transition honours `prefers-reduced-motion`.
 *
 * @module components/realtime/TtlRing
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { formatTtlLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Props for {@link TtlRing}. */
export interface TtlRingProps {
  /** Current TTL in seconds (Redis convention: `-1` persisted, `<-1` absent). */
  ttlSeconds: number
  /** Ring diameter in pixels (default 88). */
  size?: number
  /** Arc stroke width in pixels (default 8). */
  strokeWidth?: number
  /** Extra classes for the wrapper. */
  className?: string
}

/** Fraction above which the arc is green. */
const HEALTHY_FRACTION = 0.5

/** Fraction above which the arc is amber (below is red). */
const WARN_FRACTION = 0.2

/** Resolve the arc color for a remaining fraction. */
function arcColor(fraction: number): string {
  if (fraction > HEALTHY_FRACTION) return '#22c55e'
  if (fraction > WARN_FRACTION) return '#f59e0b'
  return '#ef4444'
}

/** Whether the user has requested reduced motion (SSR-safe). */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * A card-sized draining TTL ring with a centered label and an accessible
 * remaining-time description.
 *
 * @param props - The TTL plus sizing options.
 * @returns The SVG ring with its centered `mm:ss` / `∞` / `—` label.
 */
export function TtlRing({ ttlSeconds, size = 88, strokeWidth = 8, className }: TtlRingProps) {
  const isPersisted = ttlSeconds === -1
  const isAbsent = ttlSeconds < 0 && ttlSeconds !== -1

  const [remaining, setRemaining] = useState(Math.max(0, ttlSeconds))
  // The denominator for the drain fraction — captured from the seed TTL and
  // resynced whenever the source prop changes.
  const initialRef = useRef(Math.max(1, ttlSeconds))

  useEffect(() => {
    initialRef.current = Math.max(1, ttlSeconds)
    setRemaining(Math.max(0, ttlSeconds))
  }, [ttlSeconds])

  // Tick the displayed countdown down to zero; never below, and never for a
  // persisted/absent key. Removal is event-driven, so the ring only drains.
  useEffect(() => {
    if (isPersisted || isAbsent) return
    const timer = setInterval(() => setRemaining((prev) => (prev > 0 ? prev - 1 : 0)), 1_000)
    return () => clearInterval(timer)
  }, [isPersisted, isAbsent])

  const fraction = isPersisted ? 1 : Math.max(0, Math.min(1, remaining / initialRef.current))
  const isExpiring = !isPersisted && !isAbsent && remaining <= 0
  const color = isPersisted ? '#ff6224' : isAbsent ? 'rgba(255,255,255,0.25)' : arcColor(fraction)

  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = isPersisted ? 0 : circumference * (1 - fraction)

  const centerLabel = isPersisted ? '∞' : isAbsent ? '—' : formatTtlLabel(remaining)
  const ariaLabel = isPersisted
    ? 'TTL: persisted, no expiry'
    : isAbsent
      ? 'TTL: absent'
      : isExpiring
        ? 'TTL: expiring'
        : `TTL: ${remaining} seconds remaining`

  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
        />
        {!isAbsent ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={
              prefersReducedMotion()
                ? undefined
                : { transition: 'stroke-dashoffset 1s linear, stroke 1s linear' }
            }
          />
        ) : null}
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-lg font-bold tabular-nums" style={{ color }}>
          {centerLabel}
        </span>
        {isExpiring ? (
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            expiring…
          </span>
        ) : null}
      </span>
    </span>
  )
}
