/**
 * @fileoverview `StampedeTimeline` — a bespoke SVG swimlane (custom SVG, never a
 * chart library — DASHBOARD §15) rendering one lane per stampede contender. The
 * single lock winner (`role: 'won'`, `outcome: 'origin'`) shows LOCK WON → origin
 * fetch (ms) → SET → release; the losers (`role: 'waited'`, `outcome: 'hit'`) show
 * a brief wait → cache HIT. Lanes are positioned on a shared time axis derived
 * from the burst's start/finish span, with a color + icon + text legend.
 *
 * @module components/labs/StampedeTimeline
 */

'use client'

import { type StampedeTimelineEntry } from '@/lib/labs-api'

/** Props for {@link StampedeTimeline}. */
export interface StampedeTimelineProps {
  /** The per-contender timeline (one entry per fired request). */
  timeline: readonly StampedeTimelineEntry[]
}

/** Lane height in SVG user units. */
const LANE_HEIGHT = 22
/** Vertical gap between lanes. */
const LANE_GAP = 6
/** Left gutter width for the `req#N` label. */
const GUTTER = 56
/** Width of the time track where bars are drawn. */
const TRACK = 440
/** Right text column for the per-lane phase description. */
const TEXT_COLUMN = 250
/** Top padding above the first lane (room for the axis ticks). */
const TOP = 18

/** Winner accent (brand orange). */
const WON_COLOR = '#ff6224'
/** Waiter accent (blue). */
const WAIT_COLOR = '#60a5fa'
/** Cache-hit accent (green). */
const HIT_COLOR = '#22c55e'

/**
 * Render the stampede swimlane.
 *
 * @param props - The contender timeline.
 * @returns The SVG swimlane, scaled responsively to its container width.
 */
export function StampedeTimeline({ timeline }: StampedeTimelineProps) {
  if (timeline.length === 0) return null

  const minStart = Math.min(...timeline.map((entry) => entry.startedAt))
  const maxEnd = Math.max(...timeline.map((entry) => entry.finishedAt))
  const span = Math.max(1, maxEnd - minStart)

  const width = GUTTER + TRACK + TEXT_COLUMN
  const height = TOP + timeline.length * (LANE_HEIGHT + LANE_GAP)
  const originFetches = timeline.filter((entry) => entry.outcome === 'origin').length

  const xFor = (epochMs: number): number => GUTTER + ((epochMs - minStart) / span) * TRACK

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      role="img"
      aria-label={`Stampede swimlane: ${timeline.length} contenders, ${originFetches} origin fetch(es), ${timeline.length - originFetches} cache hit(s)`}
      className="font-mono"
    >
      {/* Time axis ticks: 0ms at the start, the full span at the end. */}
      <text x={GUTTER} y={10} fontSize={9} fill="rgba(255,255,255,0.4)">
        0ms
      </text>
      <text x={GUTTER + TRACK} y={10} fontSize={9} textAnchor="end" fill="rgba(255,255,255,0.4)">
        {span}ms
      </text>

      {timeline.map((entry, index) => {
        const y = TOP + index * (LANE_HEIGHT + LANE_GAP)
        const center = y + LANE_HEIGHT / 2
        const x0 = xFor(entry.startedAt)
        const x1 = xFor(entry.finishedAt)
        const barWidth = Math.max(3, x1 - x0)
        const isWon = entry.role === 'won'
        const barColor = isWon ? WON_COLOR : WAIT_COLOR
        const phase = isWon
          ? `LOCK WON → origin ${entry.durationMs}ms → SET → release`
          : 'wait → cache HIT'
        const phaseColor = isWon ? WON_COLOR : HIT_COLOR

        return (
          <g key={entry.token}>
            <text x={4} y={center + 3} fontSize={9} fill="rgba(255,255,255,0.55)">
              req#{index + 1}
            </text>
            {/* Faint baseline for the whole track so empty time reads as waiting. */}
            <line
              x1={GUTTER}
              y1={center}
              x2={GUTTER + TRACK}
              y2={center}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
              strokeDasharray={isWon ? undefined : '2 3'}
            />
            <rect
              x={x0}
              y={y}
              width={barWidth}
              height={LANE_HEIGHT}
              rx={4}
              fill={barColor}
              fillOpacity={isWon ? 0.9 : 0.55}
            />
            {/* The cache-hit marker at the loser's resolution point. */}
            {!isWon ? <circle cx={x1} cy={center} r={3} fill={HIT_COLOR} /> : null}
            <text x={GUTTER + TRACK + 8} y={center + 3} fontSize={9} fill={phaseColor}>
              {phase}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
