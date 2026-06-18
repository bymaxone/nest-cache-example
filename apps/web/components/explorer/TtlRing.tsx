/**
 * @fileoverview `TtlRing` — a bespoke SVG radial countdown (not a chart-library
 * widget). It renders a draining arc plus the `mm:ss` / `∞` / `—` label, following
 * Redis TTL conventions (`-1` persisted, `<0` absent, `≥0` seconds). When
 * `countdown` is set it ticks the arc down once per second client-side and resyncs
 * whenever the source TTL prop changes; it never optimistically deletes anything.
 *
 * @module components/explorer/TtlRing
 */

'use client'

import { useEffect, useState } from 'react'
import { formatTtlLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Props for {@link TtlRing}. */
export interface TtlRingProps {
  /** Current TTL in seconds (Redis convention: `-1` persisted, `<0` absent). */
  ttlSeconds: number
  /** Seconds that map to a full ring (default 300). */
  maxSeconds?: number
  /** Ring diameter in pixels (default 28). */
  size?: number
  /** Arc stroke width in pixels (default 3). */
  strokeWidth?: number
  /** When true, decrement the displayed TTL once per second. */
  countdown?: boolean
  /** When true, render the `mm:ss` / `∞` / `—` label beside the ring. */
  showLabel?: boolean
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

/**
 * A draining TTL ring with an accessible label.
 *
 * @param props - The TTL plus presentation options.
 * @returns The SVG ring (and optional label).
 */
export function TtlRing({
  ttlSeconds,
  maxSeconds = 300,
  size = 28,
  strokeWidth = 3,
  countdown = false,
  showLabel = false,
  className,
}: TtlRingProps) {
  const [remaining, setRemaining] = useState(ttlSeconds)

  // Resync whenever the source TTL changes (refetch, persist, extend).
  useEffect(() => setRemaining(ttlSeconds), [ttlSeconds])

  // Tick the displayed countdown down to zero; never below.
  useEffect(() => {
    if (!countdown || ttlSeconds < 0) return
    const timer = setInterval(() => setRemaining((prev) => (prev > 0 ? prev - 1 : 0)), 1_000)
    return () => clearInterval(timer)
  }, [countdown, ttlSeconds])

  const isPersisted = ttlSeconds === -1
  const isAbsent = ttlSeconds < 0 && ttlSeconds !== -1
  const fraction = isPersisted ? 1 : Math.max(0, Math.min(1, remaining / maxSeconds))
  const color = isPersisted ? '#ff6224' : isAbsent ? 'rgba(255,255,255,0.25)' : arcColor(fraction)

  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = isAbsent ? circumference : circumference * (1 - fraction)
  const label = formatTtlLabel(isPersisted || isAbsent ? ttlSeconds : remaining)

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`TTL ${label}`}
      >
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
          />
        ) : null}
      </svg>
      {showLabel ? (
        <span className="font-mono text-xs tabular-nums" style={{ color }}>
          {label}
        </span>
      ) : null}
    </span>
  )
}
