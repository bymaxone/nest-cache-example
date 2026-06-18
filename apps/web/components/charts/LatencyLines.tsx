/**
 * @fileoverview `LatencyLines` — command latency as p50/p95/p99 **lines** (never an
 * average — DASHBOARD §2 principle 4). Values render in ms with µs precision and
 * are never rounded to `0ms`, since Redis cache latency is typically sub-millisecond.
 *
 * @module components/charts/LatencyLines
 */

'use client'

import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { ChartFrame } from './ChartFrame'
import { type LatencyPoint } from './types'
import { formatClock, formatLatencyMs } from '@/lib/format'

/** Props for {@link LatencyLines}. */
export interface LatencyLinesProps {
  /** Bucketed latency-percentile series (oldest → newest). */
  data: LatencyPoint[]
  /** When true, render the loading skeleton. */
  isLoading?: boolean
}

const LATENCY_CONFIG: ChartConfig = {
  p50: { label: 'p50', color: '#22c55e' },
  p95: { label: 'p95', color: '#f59e0b' },
  p99: { label: 'p99', color: '#ef4444' },
}

/**
 * Command-latency percentile lines (p50/p95/p99) with µs precision.
 *
 * @param props - The series and loading flag.
 * @returns The composed panel.
 */
export function LatencyLines({ data, isLoading = false }: LatencyLinesProps) {
  const latest = data.at(-1)
  const srSummary = latest
    ? `Latest latency — p50 ${formatLatencyMs(latest.p50)}, p95 ${formatLatencyMs(latest.p95)}, p99 ${formatLatencyMs(latest.p99)}.`
    : undefined

  return (
    <ChartFrame
      title="Command latency (p50 / p95 / p99)"
      description="Percentiles over sampled ping timings — µs precision, never 0ms."
      isLoading={isLoading}
      isEmpty={data.length === 0}
      srSummary={srSummary}
    >
      <ChartContainer config={LATENCY_CONFIG}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="t"
            tickFormatter={formatClock}
            tick={{ fontSize: 11 }}
            minTickGap={48}
            stroke="rgba(255,255,255,0.3)"
          />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="rgba(255,255,255,0.3)"
            width={56}
            tickFormatter={formatLatencyMs}
          />
          <Tooltip
            content={
              <ChartTooltipContent valueFormatter={formatLatencyMs} labelFormatter={formatClock} />
            }
          />
          <Line
            type="monotone"
            dataKey="p50"
            stroke="#22c55e"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="p95"
            stroke="#f59e0b"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="p99"
            stroke="#ef4444"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
    </ChartFrame>
  )
}
