/**
 * @fileoverview `MemoryByPrefix` — a horizontal bar of `MEMORY USAGE` sampled per
 * entity prefix (a bounded dimension). Clicking a bar is **click-to-filter**: it
 * calls `onSelect` with the prefix so the page can pivot to the Explorer.
 *
 * @module components/charts/MemoryByPrefix
 */

'use client'

import { Bar, BarChart, Cell, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { ChartFrame } from './ChartFrame'
import { type PrefixDatum } from './types'
import { formatBytes } from '@/lib/format'

/** Props for {@link MemoryByPrefix}. */
export interface MemoryByPrefixProps {
  /** Memory-by-prefix data (sampled). */
  data: PrefixDatum[]
  /** When true, render the loading skeleton. */
  isLoading?: boolean
  /** Called with the prefix when a bar is clicked (pivot to the Explorer). */
  onSelect?: (prefix: string) => void
}

const MEMORY_CONFIG: ChartConfig = { bytes: { label: 'Memory', color: '#ff6224' } }

/**
 * Horizontal memory-by-prefix bar chart with click-to-filter bars.
 *
 * @param props - The per-prefix bytes, loading flag, and select callback.
 * @returns The composed panel.
 */
export function MemoryByPrefix({ data, isLoading = false, onSelect }: MemoryByPrefixProps) {
  const sorted = [...data].sort((a, b) => b.bytes - a.bytes)
  const srSummary =
    sorted.length > 0
      ? `Memory by prefix — ${sorted.map((d) => `${d.prefix}: ${formatBytes(d.bytes)}`).join(', ')}.`
      : undefined

  return (
    <ChartFrame
      title="Memory by prefix"
      description="Sampled MEMORY USAGE — click a bar to filter."
      isLoading={isLoading}
      isEmpty={sorted.length === 0}
      srSummary={srSummary}
      height={220}
    >
      <ChartContainer config={MEMORY_CONFIG}>
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 4, right: 12, bottom: 4, left: 8 }}
        >
          <XAxis type="number" tickFormatter={formatBytes} tick={{ fontSize: 11 }} hide />
          <YAxis
            type="category"
            dataKey="prefix"
            tick={{ fontSize: 11 }}
            width={72}
            stroke="rgba(255,255,255,0.3)"
          />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            content={<ChartTooltipContent valueFormatter={formatBytes} />}
          />
          <Bar dataKey="bytes" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {sorted.map((entry) => (
              <Cell
                key={entry.prefix}
                fill="#ff6224"
                className={onSelect ? 'cursor-pointer' : undefined}
                onClick={() => onSelect?.(entry.prefix)}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </ChartFrame>
  )
}
