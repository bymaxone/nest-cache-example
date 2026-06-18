/**
 * @fileoverview `MetricTile` — a golden-signal KPI tile: a mono title, a big mono
 * value, an optional sparkline, and an optional Δ badge versus the previous equal
 * window. Status is encoded as **color + icon + text** (never color alone —
 * DASHBOARD §2 principle 7), and loading renders a skeleton, not a spinner.
 *
 * @module components/charts/MetricTile
 */

'use client'

import { type ReactNode } from 'react'
import { Area, AreaChart } from 'recharts'
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { type StatusMeta } from '@/lib/cache-status'
import { formatDelta } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Props for {@link MetricTile}. */
export interface MetricTileProps {
  /** Tile title (rendered mono, uppercase tracking). */
  label: string
  /** Pre-formatted display value (e.g. `94.2%`, `0.412ms`). */
  value: string
  /** Optional leading icon. */
  icon?: LucideIcon
  /** Optional sparkline series (oldest → newest). */
  sparkline?: number[]
  /** Optional Δ versus the previous equal window. */
  delta?: number
  /** Optional accessible status (color + icon + text). */
  status?: StatusMeta
  /** Optional footnote under the value. */
  footnote?: ReactNode
  /** When true, render skeleton placeholders. */
  isLoading?: boolean
}

/** Sparkline stroke color (brand orange). */
const SPARK_COLOR = '#ff6224'

const SPARK_CONFIG: ChartConfig = { v: { label: 'value', color: SPARK_COLOR } }

/** Render the Δ badge with an arrow icon + signed text + semantic color. */
function DeltaBadge({ delta }: { delta: number }) {
  const isUp = delta > 0
  const isFlat = delta === 0
  const Icon = isFlat ? Minus : isUp ? ArrowUpRight : ArrowDownRight
  // Up = success green, down = danger red; status colors go through inline style to
  // match the `lib/cache-status` palette convention. Flat uses the muted token.
  const style = isFlat ? undefined : { color: isUp ? '#22c55e' : '#ef4444' }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium',
        isFlat && 'text-muted-foreground',
      )}
      style={style}
    >
      <Icon aria-hidden="true" className="h-3 w-3" />
      {formatDelta(delta)}
    </span>
  )
}

/**
 * A single golden-signal KPI tile.
 *
 * @param props - The tile content (label, value, optional sparkline/delta/status).
 * @returns The composed tile card.
 */
export function MetricTile({
  label,
  value,
  icon: Icon,
  sparkline,
  delta,
  status,
  footnote,
  isLoading = false,
}: MetricTileProps) {
  const sparkData = sparkline?.map((v, i) => ({ i, v })) ?? []
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            {Icon ? <Icon aria-hidden="true" className="h-3.5 w-3.5" /> : null}
            {label}
          </span>
          {delta !== undefined && !isLoading ? <DeltaBadge delta={delta} /> : null}
        </div>

        {isLoading ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <p className="font-mono text-2xl font-bold leading-none">{value}</p>
        )}

        {sparkData.length > 1 && !isLoading ? (
          <div className="h-8 w-full">
            <ChartContainer config={SPARK_CONFIG}>
              <AreaChart data={sparkData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={SPARK_COLOR}
                  fill={SPARK_COLOR}
                  fillOpacity={0.15}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                  dot={false}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        ) : null}

        {status ? (
          <span
            className="inline-flex items-center gap-1 text-xs font-medium"
            style={{ color: status.color }}
          >
            <status.icon aria-hidden="true" className="h-3.5 w-3.5" />
            {status.label}
          </span>
        ) : null}

        {footnote ? <p className="text-[11px] text-muted-foreground">{footnote}</p> : null}
      </CardContent>
    </Card>
  )
}
