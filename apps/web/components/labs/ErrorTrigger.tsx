/**
 * @fileoverview `ErrorTrigger` — one row in the Error Explorer trigger list. Shows
 * a canonical `CacheErrorCode` (de-prefixed for readability), its severity as
 * color + icon + text (4xx amber / 5xx red / 504 purple, via
 * {@link httpErrorSeverityMeta}), the expected HTTP status, and a Trigger button
 * that fires `POST /errors/:code`. The selected row is accented so the response
 * panel's context is clear.
 *
 * @module components/labs/ErrorTrigger
 */

'use client'

import { type CacheErrorCode } from '@bymax-one/nest-cache/shared'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { httpErrorSeverityMeta } from '@/lib/cache-status'

/** Props for {@link ErrorTrigger}. */
export interface ErrorTriggerProps {
  /** The canonical error code (e.g. `cache.invalid_key`). */
  code: CacheErrorCode
  /** The HTTP status this code maps to (drives the severity color). */
  httpStatus: number
  /** Whether a trigger request is in flight for this row. */
  isPending: boolean
  /** Whether this row is the currently-selected one. */
  isSelected: boolean
  /** Fire the trigger for this code. */
  onTrigger: () => void
}

/**
 * A single error-code trigger row.
 *
 * @param props - The code, its HTTP status, pending/selected flags, and the trigger callback.
 * @returns The trigger row.
 */
export function ErrorTrigger({
  code,
  httpStatus,
  isPending,
  isSelected,
  onTrigger,
}: ErrorTriggerProps) {
  const meta = httpErrorSeverityMeta(httpStatus)
  const Icon = meta.icon
  const label = code.startsWith('cache.') ? code.slice('cache.'.length) : code

  return (
    <li
      className={cn(
        'flex items-center justify-between gap-2 rounded-lg border border-(--glass-border) bg-(--glass-bg) p-2',
        isSelected && 'ring-1 ring-brand-500/40',
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" style={{ color: meta.color }} />
        <span className="truncate font-mono text-xs" title={code}>
          {label}
        </span>
        <span
          className="shrink-0 font-mono text-[10px] text-muted-foreground"
          style={{ color: meta.color }}
        >
          {httpStatus}
        </span>
      </div>
      <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={onTrigger}>
        Trigger
      </Button>
    </li>
  )
}
