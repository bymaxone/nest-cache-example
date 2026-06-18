/**
 * @fileoverview Chart primitive — a thin wrapper over Recharts v3 that injects the
 * design-system colors as CSS variables and provides a glass-styled tooltip. Charts
 * declare a {@link ChartConfig} mapping each series key to a label + color; the
 * container exposes those as `--color-<key>` custom properties so series can
 * reference `var(--color-hit)` etc., keeping the orange/glass palette consistent.
 *
 * Adapted from the shadcn/ui `new-york` chart component, trimmed to the container
 * and tooltip the Observe charts actually use, and typed without `any`.
 */

'use client'

import * as React from 'react'
import { ResponsiveContainer } from 'recharts'

import { cn } from '@/lib/utils'

/** Per-series presentation config: a label and a CSS color. */
export interface ChartSeriesConfig {
  /** Human-readable series label (legend / tooltip). */
  label?: React.ReactNode
  /** CSS color applied as `--color-<key>`. */
  color?: string
}

/** Maps each data-series key to its {@link ChartSeriesConfig}. */
export type ChartConfig = Record<string, ChartSeriesConfig>

const ChartContext = React.createContext<ChartConfig | null>(null)

/**
 * Read the active {@link ChartConfig} from context.
 *
 * @returns The chart config provided by the nearest {@link ChartContainer}.
 * @throws {Error} When used outside a {@link ChartContainer}.
 */
function useChartConfig(): ChartConfig {
  const config = React.useContext(ChartContext)
  if (!config) throw new Error('useChartConfig must be used within a <ChartContainer>')
  return config
}

/** Build the `--color-<key>` custom-property style object from a config. */
function configToStyle(config: ChartConfig): React.CSSProperties {
  const style: Record<string, string> = {}
  for (const [key, value] of Object.entries(config)) {
    if (value.color) style[`--color-${key}`] = value.color
  }
  return style
}

/** Props for {@link ChartContainer}. */
export interface ChartContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The per-series color/label config exposed as CSS variables. */
  config: ChartConfig
  /** A single Recharts chart element (the responsive container's only child). */
  children: React.ReactElement
}

/**
 * Responsive chart shell — injects series colors as CSS vars and sizes the chart
 * to its container.
 *
 * @param props - Container props including the {@link ChartConfig} and chart child.
 * @returns The chart wrapped in a sized, theme-scoped container.
 */
export function ChartContainer({ config, className, children, ...props }: ChartContainerProps) {
  return (
    <ChartContext.Provider value={config}>
      <div
        className={cn(
          'h-full w-full [&_.recharts-cartesian-grid_line]:stroke-(--glass-border)',
          className,
        )}
        style={configToStyle(config)}
        {...props}
      >
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

/** One entry of a Recharts tooltip payload (loosely typed — Recharts injects these). */
interface TooltipPayloadEntry {
  /** The series value at the hovered point. */
  value?: number | string
  /** The series display name. */
  name?: string
  /** The series data key. */
  dataKey?: string | number
  /** The series stroke/fill color. */
  color?: string
}

/** Props injected by Recharts into a tooltip `content` element. */
export interface ChartTooltipContentProps {
  /** Whether the tooltip is active (hovering a point). */
  active?: boolean
  /** The hovered point's series entries. */
  payload?: TooltipPayloadEntry[]
  /** The hovered x-axis label. */
  label?: string | number
  /** Optional per-value formatter. */
  valueFormatter?: (value: number) => string
  /** Optional x-axis label formatter. */
  labelFormatter?: (label: string | number) => string
}

/**
 * Glass-styled tooltip body. Resolves each entry's label/color from the active
 * {@link ChartConfig} so the tooltip matches the chart's palette.
 *
 * @param props - The Recharts-injected tooltip props plus optional formatters.
 * @returns The tooltip card, or `null` when inactive/empty.
 */
export function ChartTooltipContent({
  active,
  payload,
  label,
  valueFormatter,
  labelFormatter,
}: ChartTooltipContentProps) {
  const config = useChartConfig()
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-lg border border-(--glass-border) bg-(--color-bg-primary)/95 px-3 py-2 text-xs shadow-lg backdrop-blur-md">
      {label !== undefined ? (
        <p className="mb-1 font-mono text-muted-foreground">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      ) : null}
      <ul className="space-y-1">
        {payload.map((entry, index) => {
          const key = String(entry.dataKey ?? entry.name ?? index)
          const seriesLabel = config[key]?.label ?? entry.name ?? key
          const color = config[key]?.color ?? entry.color
          const value =
            typeof entry.value === 'number' && valueFormatter
              ? valueFormatter(entry.value)
              : entry.value
          return (
            <li key={key} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-muted-foreground">{seriesLabel}</span>
              </span>
              <span className="font-mono font-medium text-foreground">{value}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
