/**
 * @fileoverview `ScanStrategyToggle` — the Explorer's teaching control. `scan`
 * (default) is the non-blocking cursor; selecting `keys` reveals a persistent
 * **⚠ O(N) — blocks the server, dev only** badge (color + icon + text). In cluster
 * mode both strategies are unavailable, so the toggle is disabled with an
 * `UNSUPPORTED_IN_CLUSTER` callout.
 *
 * @module components/explorer/ScanStrategyToggle
 */

'use client'

import { AlertTriangle, Ban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SCAN_STRATEGIES, type ScanStrategy } from '@/lib/filters'
import { cn } from '@/lib/utils'

/** Props for {@link ScanStrategyToggle}. */
export interface ScanStrategyToggleProps {
  /** The active strategy. */
  value: ScanStrategy
  /** Called with the chosen strategy. */
  onChange: (strategy: ScanStrategy) => void
  /** When true, both strategies are disabled (cluster deployment). */
  isClusterMode?: boolean
}

/**
 * Strategy segmented control with the blocking-command and cluster guards.
 *
 * @param props - The active strategy, change handler, and cluster flag.
 * @returns The toggle plus any active warning/callout.
 */
export function ScanStrategyToggle({
  value,
  onChange,
  isClusterMode = false,
}: ScanStrategyToggleProps) {
  return (
    <div className="space-y-2">
      <div
        role="group"
        aria-label="Key-listing strategy"
        className="inline-flex rounded-full border border-(--glass-border) bg-(--glass-bg) p-0.5"
      >
        {SCAN_STRATEGIES.map((strategy) => (
          <Button
            key={strategy}
            type="button"
            size="sm"
            variant={value === strategy ? 'default' : 'ghost'}
            disabled={isClusterMode}
            aria-pressed={value === strategy}
            onClick={() => onChange(strategy)}
            className={cn('font-mono', value !== strategy && 'text-muted-foreground')}
          >
            {strategy}
          </Button>
        ))}
      </div>

      {isClusterMode ? (
        <p
          className="flex items-center gap-1.5 text-xs font-medium"
          role="status"
          style={{ color: '#a855f7' }}
        >
          <Ban aria-hidden="true" className="h-3.5 w-3.5" />
          UNSUPPORTED_IN_CLUSTER — scan/keys are standalone/sentinel only.
        </p>
      ) : value === 'keys' ? (
        <p
          className="flex items-center gap-1.5 text-xs font-medium"
          role="status"
          style={{ color: '#f59e0b' }}
        >
          <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />⚠ O(N) — blocks the server,
          dev only.
        </p>
      ) : null}
    </div>
  )
}
