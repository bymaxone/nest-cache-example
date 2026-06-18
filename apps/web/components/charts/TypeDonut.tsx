/**
 * @fileoverview `TypeDonut` — keys-by-type donut (string / hash / set), a bounded
 * dimension. Clicking a slice is **click-to-filter**: it calls `onSelect` with the
 * type so the page can pivot to the Explorer pre-filtered to that type.
 *
 * @module components/charts/TypeDonut
 */

'use client'

import { Cell, Pie, PieChart, Tooltip } from 'recharts'
import { ChartContainer, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { ChartFrame } from './ChartFrame'
import { type TypeDatum } from './types'
import { dataTypeMeta, type CacheDataType } from '@/lib/cache-status'
import { formatCount } from '@/lib/format'

/** Props for {@link TypeDonut}. */
export interface TypeDonutProps {
  /** Keys-by-type counts (sampled). */
  data: TypeDatum[]
  /** When true, render the loading skeleton. */
  isLoading?: boolean
  /** Called with the type when a slice is clicked (pivot to the Explorer). */
  onSelect?: (type: CacheDataType) => void
}

const TYPE_CONFIG: ChartConfig = {
  string: { label: 'String', color: dataTypeMeta('string').color },
  hash: { label: 'Hash', color: dataTypeMeta('hash').color },
  set: { label: 'Set', color: dataTypeMeta('set').color },
}

/**
 * Keys-by-type donut with click-to-filter slices.
 *
 * @param props - The type counts, loading flag, and select callback.
 * @returns The composed panel.
 */
export function TypeDonut({ data, isLoading = false, onSelect }: TypeDonutProps) {
  const nonEmpty = data.filter((d) => d.count > 0)
  const total = nonEmpty.reduce((sum, d) => sum + d.count, 0)
  const srSummary =
    total > 0
      ? `Keys by type — ${nonEmpty.map((d) => `${d.type}: ${formatCount(d.count)}`).join(', ')}.`
      : undefined

  return (
    <ChartFrame
      title="Keys by type"
      description="Click a slice to filter the Explorer."
      isLoading={isLoading}
      isEmpty={total === 0}
      srSummary={srSummary}
      height={220}
    >
      <ChartContainer config={TYPE_CONFIG}>
        <PieChart>
          <Tooltip content={<ChartTooltipContent valueFormatter={formatCount} />} />
          <Pie
            data={nonEmpty}
            dataKey="count"
            nameKey="type"
            innerRadius="55%"
            outerRadius="85%"
            paddingAngle={2}
            isAnimationActive={false}
          >
            {nonEmpty.map((entry) => (
              <Cell
                key={entry.type}
                fill={dataTypeMeta(entry.type).color}
                className={onSelect ? 'cursor-pointer' : undefined}
                onClick={() => onSelect?.(entry.type)}
              />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
    </ChartFrame>
  )
}
