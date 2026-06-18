/**
 * @fileoverview `HitRateGauge` — the headline cache signal as a radial gauge with
 * the exact percentage beside the arc. Thresholds follow DASHBOARD §2 principle 3:
 * green > 90%, amber 50–90%, red < 50%. The verdict is shown as color + icon +
 * text, never color alone.
 *
 * @module components/charts/HitRateGauge
 */

'use client'

import { PolarAngleAxis, RadialBar, RadialBarChart } from 'recharts'
import { AlertTriangle, CheckCircle2, XCircle, type LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { formatPercent } from '@/lib/format'

/** Props for {@link HitRateGauge}. */
export interface HitRateGaugeProps {
  /** Hit rate as a ratio in `[0, 1]`. */
  value: number
  /** When true, render a skeleton. */
  isLoading?: boolean
}

/** A resolved gauge verdict: threshold color, icon, and text label. */
interface GaugeVerdict {
  color: string
  icon: LucideIcon
  label: string
}

/** Threshold above which the cache is considered healthy. */
const HEALTHY_THRESHOLD = 0.9

/** Threshold above which the cache is considered degraded (vs poor). */
const DEGRADED_THRESHOLD = 0.5

/**
 * Resolve the threshold verdict for a hit-rate ratio.
 *
 * @param ratio - The hit rate in `[0, 1]`.
 * @returns The verdict color/icon/label.
 */
function verdictFor(ratio: number): GaugeVerdict {
  if (ratio > HEALTHY_THRESHOLD) return { color: '#22c55e', icon: CheckCircle2, label: 'Healthy' }
  if (ratio >= DEGRADED_THRESHOLD)
    return { color: '#f59e0b', icon: AlertTriangle, label: 'Degraded' }
  return { color: '#ef4444', icon: XCircle, label: 'Poor' }
}

const GAUGE_CONFIG: ChartConfig = { value: { label: 'Hit rate' } }

/**
 * Radial hit-rate gauge with the exact percentage and a threshold verdict.
 *
 * @param props - The hit-rate ratio and loading flag.
 * @returns The composed gauge tile.
 */
export function HitRateGauge({ value, isLoading = false }: HitRateGaugeProps) {
  const ratio = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
  const verdict = verdictFor(ratio)
  const pct = ratio * 100
  const VerdictIcon = verdict.icon

  return (
    <Card>
      <CardContent className="p-4">
        <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          Hit rate
        </span>
        {isLoading ? (
          <Skeleton className="mt-2 h-24 w-full" />
        ) : (
          <div className="relative mt-1 h-24">
            <ChartContainer config={GAUGE_CONFIG}>
              <RadialBarChart
                data={[{ value: pct, fill: verdict.color }]}
                startAngle={90}
                endAngle={-270}
                innerRadius="72%"
                outerRadius="100%"
              >
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
                <RadialBar
                  dataKey="value"
                  cornerRadius={8}
                  background={{ fill: 'rgba(255,255,255,0.06)' }}
                  isAnimationActive={false}
                />
              </RadialBarChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-xl font-bold" style={{ color: verdict.color }}>
                {formatPercent(ratio)}
              </span>
            </div>
          </div>
        )}
        {!isLoading ? (
          <span
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium"
            style={{ color: verdict.color }}
          >
            <VerdictIcon aria-hidden="true" className="h-3.5 w-3.5" />
            {verdict.label}
          </span>
        ) : null}
      </CardContent>
    </Card>
  )
}
