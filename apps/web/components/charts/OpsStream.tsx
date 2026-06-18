/**
 * @fileoverview `OpsStream` — a streaming, stacked area of throughput (ops/sec)
 * split by command family (GET / SET / DEL). It carries a **pause** control so the
 * motion can be stopped (accessibility — no unstoppable animation, DASHBOARD §15);
 * pausing freezes the rendered snapshot while the underlying series keeps updating.
 *
 * @module components/charts/OpsStream
 */

'use client'

import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'
import { Pause, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChartContainer, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { ChartFrame } from './ChartFrame'
import { type OpsPoint } from './types'
import { formatClock, formatCount } from '@/lib/format'

/** Props for {@link OpsStream}. */
export interface OpsStreamProps {
  /** Bucketed per-command ops/sec series (oldest → newest). */
  data: OpsPoint[]
  /** When true, render the loading skeleton. */
  isLoading?: boolean
}

const OPS_CONFIG: ChartConfig = {
  get: { label: 'GET', color: '#60a5fa' },
  set: { label: 'SET', color: '#ff6224' },
  del: { label: 'DEL', color: '#ef4444' },
}

/**
 * Streaming, pausable, stacked ops/sec area split by command.
 *
 * @param props - The series and loading flag.
 * @returns The composed panel.
 */
export function OpsStream({ data, isLoading = false }: OpsStreamProps) {
  const [isPaused, setIsPaused] = useState(false)
  const [frozen, setFrozen] = useState<OpsPoint[]>([])

  const togglePause = () => {
    if (!isPaused) setFrozen([...data])
    setIsPaused((prev) => !prev)
  }

  const rendered = isPaused ? frozen : data
  const latest = rendered.at(-1)
  const srSummary = latest
    ? `Latest ops/sec — GET ${formatCount(latest.get)}, SET ${formatCount(latest.set)}, DEL ${formatCount(latest.del)}.`
    : undefined

  return (
    <ChartFrame
      title="Throughput (ops/sec)"
      description="Per-command, derived from Redis INFO commandstats deltas."
      isLoading={isLoading}
      isEmpty={rendered.length === 0}
      srSummary={srSummary}
      headerRight={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={togglePause}
          aria-pressed={isPaused}
        >
          {isPaused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
          {isPaused ? 'Resume' : 'Pause'}
        </Button>
      }
    >
      <ChartContainer config={OPS_CONFIG}>
        <AreaChart data={rendered} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
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
            dataKey="get"
            stackId="ops"
            stroke="#60a5fa"
            fill="#60a5fa"
            fillOpacity={0.25}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="set"
            stackId="ops"
            stroke="#ff6224"
            fill="#ff6224"
            fillOpacity={0.25}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="del"
            stackId="ops"
            stroke="#ef4444"
            fill="#ef4444"
            fillOpacity={0.25}
            isAnimationActive={false}
          />
        </AreaChart>
      </ChartContainer>
    </ChartFrame>
  )
}
