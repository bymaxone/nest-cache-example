/**
 * @fileoverview `HitMissArea` — the signature Overview panel: a stacked area of
 * cache hits (green) vs misses (amber) over time. It is **brushable**: dragging
 * the brush maps the selected span to the nearest time-range preset and writes it
 * back through `onBrushRange`, which the page binds to the same `nuqs` `range` param
 * the global TimeRange control reads.
 *
 * @module components/charts/HitMissArea
 */

'use client'

import { Area, AreaChart, Brush, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { ChartFrame } from './ChartFrame'
import { type HitMissPoint } from './types'
import { RANGE_PRESETS, type RangePreset } from '@/lib/filters'
import { formatClock, formatCount } from '@/lib/format'

/** Props for {@link HitMissArea}. */
export interface HitMissAreaProps {
  /** Bucketed hit/miss series (oldest → newest). */
  data: HitMissPoint[]
  /** When true, render the loading skeleton. */
  isLoading?: boolean
  /** Called with the preset the brushed span maps to (page writes it to the URL). */
  onBrushRange?: (range: RangePreset) => void
}

const HIT_MISS_CONFIG: ChartConfig = {
  hit: { label: 'Hits', color: '#22c55e' },
  miss: { label: 'Misses', color: '#f59e0b' },
}

/** Brushed fraction at or below which the narrowest range preset is selected. */
const NARROW_BRUSH_FRACTION = 0.4

/** Brushed fraction at or below which the medium range preset is selected. */
const MEDIUM_BRUSH_FRACTION = 0.75

/**
 * Map a brushed fraction of the full window to a time-range preset.
 *
 * A narrow brush expresses interest in a shorter window, so it snaps to a shorter
 * preset; the preset order in {@link RANGE_PRESETS} is shortest → longest.
 *
 * @param fraction - The brushed span as a fraction of the full series `(0, 1]`.
 * @returns The matching preset.
 */
function fractionToPreset(fraction: number): RangePreset {
  if (fraction <= NARROW_BRUSH_FRACTION) return RANGE_PRESETS[0]
  if (fraction <= MEDIUM_BRUSH_FRACTION) return RANGE_PRESETS[1]
  return RANGE_PRESETS[2]
}

/**
 * Stacked, brushable hit/miss area chart.
 *
 * @param props - The series, loading flag, and brush-range callback.
 * @returns The composed panel.
 */
export function HitMissArea({ data, isLoading = false, onBrushRange }: HitMissAreaProps) {
  const latest = data.at(-1)
  const srSummary = latest
    ? `Latest bucket: ${formatCount(latest.hit)} hits, ${formatCount(latest.miss)} misses across ${data.length} buckets.`
    : undefined

  const handleBrush = (range: { startIndex?: number; endIndex?: number }) => {
    if (!onBrushRange || data.length === 0) return
    const start = range.startIndex ?? 0
    const end = range.endIndex ?? data.length - 1
    const fraction = (end - start + 1) / data.length
    onBrushRange(fractionToPreset(fraction))
  }

  return (
    <ChartFrame
      title="Hit / miss over time"
      description="Stacked ratio per bucket — drag the brush to set the time range."
      isLoading={isLoading}
      isEmpty={data.length === 0}
      srSummary={srSummary}
      height={280}
    >
      <ChartContainer config={HIT_MISS_CONFIG}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="t"
            tickFormatter={formatClock}
            tick={{ fontSize: 11 }}
            minTickGap={48}
            stroke="rgba(255,255,255,0.3)"
          />
          <YAxis tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.3)" width={40} />
          <Tooltip
            content={
              <ChartTooltipContent valueFormatter={formatCount} labelFormatter={formatClock} />
            }
          />
          <Area
            type="monotone"
            dataKey="hit"
            stackId="ratio"
            stroke="#22c55e"
            fill="#22c55e"
            fillOpacity={0.25}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="miss"
            stackId="ratio"
            stroke="#f59e0b"
            fill="#f59e0b"
            fillOpacity={0.25}
            isAnimationActive={false}
          />
          <Brush
            dataKey="t"
            height={20}
            travellerWidth={8}
            stroke="#ff6224"
            fill="rgba(255,98,36,0.08)"
            tickFormatter={formatClock}
            onChange={handleBrush}
          />
        </AreaChart>
      </ChartContainer>
    </ChartFrame>
  )
}
