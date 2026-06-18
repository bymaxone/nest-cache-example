/**
 * @fileoverview `EventFeed` — the generic, ring-buffered live feed shared by the
 * Pub/Sub, TTL Live, and Connection pages. It renders a typed list newest-on-top
 * with a per-row render slot, a hard-capped rendered window (the backing buffer is
 * already bounded upstream by {@link useCacheSocket}; this caps the DOM), an
 * action-oriented empty state, and follow-mode (auto-scroll while pinned, a
 * "N new — jump to latest" pill while reading history) via {@link useFollowMode}.
 *
 * The component is **display-only** over a buffer it is handed — it never opens a
 * socket of its own (that is `hooks/use-cache-socket.ts`). The caller passes items
 * already ordered newest-first and filtered to the channel it cares about.
 *
 * @module components/realtime/EventFeed
 */

'use client'

import { type ReactNode, useEffect, useRef } from 'react'
import { ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFollowMode } from '@/hooks/use-follow-mode'

/** Default cap on rendered rows — bounds the DOM independently of the buffer size. */
const DEFAULT_MAX_RENDERED = 200

/** Props for {@link EventFeed}. */
export interface EventFeedProps<T> {
  /** Items to render, ordered newest-first (top). */
  items: readonly T[]
  /** Render one feed row from its item. */
  renderRow: (item: T) => ReactNode
  /** Stable React key for an item at a given index. */
  getKey: (item: T, index: number) => string
  /** Action-oriented content shown when `items` is empty (DASHBOARD §2 principle 9). */
  emptyState: ReactNode
  /** Maximum rows rendered to the DOM (default 200; the newest are kept). */
  maxRendered?: number
  /** Accessible label for the scroll region. */
  ariaLabel?: string
  /** Extra classes for the scroll container (e.g. a max-height). */
  className?: string
}

/**
 * A bounded, follow-mode live feed rendering newest-on-top.
 *
 * @typeParam T - The feed item type.
 * @param props - The items, row renderer, key extractor, and empty state.
 * @returns The scrollable feed with its "N new" pill.
 */
export function EventFeed<T>({
  items,
  renderRow,
  getKey,
  emptyState,
  maxRendered = DEFAULT_MAX_RENDERED,
  ariaLabel = 'Live event feed',
  className,
}: EventFeedProps<T>) {
  const { isPinned, newCount, scrollRef, onScroll, registerArrival, jumpToLatest } = useFollowMode()
  // Track the previous length so we register only the net new arrivals — and never
  // a false arrival on mount (delta is 0 when the buffer is pre-populated).
  const prevLengthRef = useRef(items.length)

  useEffect(() => {
    const delta = items.length - prevLengthRef.current
    prevLengthRef.current = items.length
    if (delta > 0) registerArrival(delta)
  }, [items.length, registerArrival])

  const visible = items.length > maxRendered ? items.slice(0, maxRendered) : items

  return (
    <div className="relative">
      {!isPinned && newCount > 0 ? (
        <button
          type="button"
          onClick={jumpToLatest}
          className="absolute left-1/2 top-2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-brand-500 px-3 py-1 text-xs font-medium text-white shadow-(--shadow-primary) transition-transform hover:scale-[1.03]"
        >
          <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" />
          {newCount} new — jump to latest
        </button>
      ) : null}

      <div
        ref={scrollRef}
        onScroll={onScroll}
        role="log"
        aria-label={ariaLabel}
        className={cn(
          'max-h-96 overflow-y-auto rounded-2xl border border-(--glass-border) bg-(--glass-bg)',
          className,
        )}
      >
        {items.length === 0 ? (
          <div className="flex min-h-40 items-center justify-center p-6 text-center text-sm text-muted-foreground">
            {emptyState}
          </div>
        ) : (
          <ul className="divide-y divide-(--glass-border)">
            {visible.map((item, index) => (
              <li key={getKey(item, index)}>{renderRow(item)}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
