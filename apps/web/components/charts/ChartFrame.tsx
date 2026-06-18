/**
 * @fileoverview `ChartFrame` — the shared glass-card shell every Observe panel
 * composes. It enforces the design-system loading/empty rules in one place:
 * a **skeleton** while loading (never a spinner — DASHBOARD §2 principle 8), an
 * **action-oriented** empty state (principle 9), and a visually-hidden
 * screen-reader summary so each chart ships a non-visual fallback.
 *
 * @module components/charts/ChartFrame
 */

import { type ReactNode } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/** Props for {@link ChartFrame}. */
export interface ChartFrameProps {
  /** Panel title (rendered mono). */
  title: string
  /** Optional supporting copy under the title. */
  description?: ReactNode
  /** Optional right-aligned header slot (controls such as a pause toggle). */
  headerRight?: ReactNode
  /** When true, render skeleton placeholders instead of the chart body. */
  isLoading?: boolean
  /** When true, render the action-oriented empty state instead of the chart body. */
  isEmpty?: boolean
  /** A non-visual summary of the panel's current data for screen readers. */
  srSummary?: string | undefined
  /** Body height in pixels (the chart area). */
  height?: number
  /** The chart element(s) to render when data is present. */
  children: ReactNode
  /** Extra classes for the card. */
  className?: string
}

/** Default chart-body height in pixels. */
const DEFAULT_HEIGHT = 240

/**
 * Action-oriented empty state: a short prompt plus a link to seed data.
 *
 * @returns The empty-state body pointing users at the Playground.
 */
function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
      <p>No data yet.</p>
      <Link href="/playground" className="font-medium text-brand-500 hover:underline">
        Seed a key from the Playground →
      </Link>
    </div>
  )
}

/**
 * Glass panel shell with built-in loading / empty / screen-reader handling.
 *
 * @param props - The frame configuration and chart body.
 * @returns The composed panel.
 */
export function ChartFrame({
  title,
  description,
  headerRight,
  isLoading = false,
  isEmpty = false,
  srSummary,
  height = DEFAULT_HEIGHT,
  children,
  className,
}: ChartFrameProps) {
  return (
    <Card className={className}>
      <CardHeader accent className="flex-row items-start justify-between gap-2 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {headerRight}
      </CardHeader>
      <CardContent>
        <div style={{ height }} className={cn('w-full', isLoading && 'space-y-3 py-4')}>
          {isLoading ? (
            <>
              <Skeleton className="h-full w-full" />
            </>
          ) : isEmpty ? (
            <EmptyState />
          ) : (
            children
          )}
        </div>
        {srSummary ? <p className="sr-only">{srSummary}</p> : null}
      </CardContent>
    </Card>
  )
}
