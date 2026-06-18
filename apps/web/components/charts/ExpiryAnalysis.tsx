/**
 * @fileoverview `ExpiryAnalysis` — the share of keys with vs without a TTL, as a
 * donut (a bounded two-slice dimension). Answers "how much of the keyspace is
 * volatile vs persisted" at a glance.
 *
 * @module components/charts/ExpiryAnalysis
 */

'use client'

import { Cell, Pie, PieChart, Tooltip } from 'recharts'
import { ChartContainer, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { ChartFrame } from './ChartFrame'
import { formatCount, formatPercent } from '@/lib/format'

/** Props for {@link ExpiryAnalysis}. */
export interface ExpiryAnalysisProps {
  /** Count of sampled keys with an active TTL. */
  withTtl: number
  /** Count of sampled keys with no TTL (persisted). */
  noTtl: number
  /** When true, render the loading skeleton. */
  isLoading?: boolean
}

const EXPIRY_CONFIG: ChartConfig = {
  withTtl: { label: 'With TTL', color: '#22c55e' },
  noTtl: { label: 'No TTL', color: '#60a5fa' },
}

/**
 * Donut of keys with vs without a TTL.
 *
 * @param props - The with/without-TTL counts and loading flag.
 * @returns The composed panel.
 */
export function ExpiryAnalysis({ withTtl, noTtl, isLoading = false }: ExpiryAnalysisProps) {
  const total = withTtl + noTtl
  const data = [
    { key: 'withTtl', label: 'With TTL', value: withTtl, color: '#22c55e' },
    { key: 'noTtl', label: 'No TTL', value: noTtl, color: '#60a5fa' },
  ].filter((d) => d.value > 0)
  const srSummary =
    total > 0
      ? `Expiry — with TTL: ${formatCount(withTtl)} (${formatPercent(withTtl / total)}), no TTL: ${formatCount(noTtl)} (${formatPercent(noTtl / total)}).`
      : undefined

  return (
    <ChartFrame
      title="Expiry analysis"
      description="Volatile (TTL) vs persisted keys."
      isLoading={isLoading}
      isEmpty={total === 0}
      srSummary={srSummary}
      height={220}
    >
      <ChartContainer config={EXPIRY_CONFIG}>
        <PieChart>
          <Tooltip content={<ChartTooltipContent valueFormatter={formatCount} />} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="key"
            innerRadius="55%"
            outerRadius="85%"
            paddingAngle={2}
            isAnimationActive={false}
          >
            {data.map((entry) => (
              <Cell key={entry.key} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
    </ChartFrame>
  )
}
