/**
 * @fileoverview Relative time-range selector for the metric charts. A small
 * segmented control with `Last 5m / 15m / 1h` presets, persisted to the URL via
 * `nuqs` so the selected window is part of the shareable deep-link.
 *
 * @module components/controls/TimeRange
 */

'use client'

import { useQueryState } from 'nuqs'
import { cn } from '@/lib/utils'
import { RANGE_PRESETS, rangeParser } from '@/lib/filters'

/** Segmented relative-range selector (`5m` / `15m` / `1h`), persisted to the URL. */
export function TimeRange() {
  const [range, setRange] = useQueryState('range', rangeParser)
  return (
    <div
      role="radiogroup"
      aria-label="Time range"
      className="inline-flex h-8 items-center rounded-full border border-(--glass-border) p-0.5"
    >
      {RANGE_PRESETS.map((preset) => {
        const isActive = range === preset
        return (
          <button
            key={preset}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => void setRange(preset)}
            className={cn(
              'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
              isActive ? 'bg-brand-500 text-white' : 'text-white/55 hover:text-white',
            )}
          >
            {preset}
          </button>
        )
      })}
    </div>
  )
}
