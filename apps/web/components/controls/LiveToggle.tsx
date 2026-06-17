/**
 * @fileoverview Live-feeds toggle. Flips the `live` URL flag that gates the
 * `useCacheSocket` `enabled` parameter — when on, the dashboard opens the socket
 * and streams `cache:connection`/`cache:event`/`cache:expired`. Off by default
 * (no socket until the user opts in), persisted to the URL.
 *
 * @module components/controls/LiveToggle
 */

'use client'

import { useQueryState } from 'nuqs'
import { cn } from '@/lib/utils'
import { liveParser } from '@/lib/filters'

/** Toggle that enables/disables the live socket feeds, persisted to the URL. */
export function LiveToggle() {
  const [live, setLive] = useQueryState('live', liveParser)
  return (
    <button
      type="button"
      aria-pressed={live}
      onClick={() => void setLive(!live)}
      className={cn(
        'inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors',
        live
          ? 'border-(--color-success)/40 bg-(--color-success)/10 text-(--color-success)'
          : 'border-(--glass-border) text-white/55 hover:bg-white/5',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'h-2 w-2 rounded-full',
          live ? 'animate-pulse bg-(--color-success)' : 'bg-white/35',
        )}
      />
      Live
    </button>
  )
}
