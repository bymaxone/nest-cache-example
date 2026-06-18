/**
 * @fileoverview `useFollowMode` — the follow-mode state machine shared by every
 * live {@link EventFeed}. It keeps the feed pinned to the newest row (top, since
 * feeds render newest-on-top) and auto-snaps back as events arrive; the moment the
 * reader scrolls down to inspect history it un-pins, counts subsequent arrivals,
 * and surfaces a "N new — jump to latest" affordance without yanking the viewport.
 *
 * Extracting the mechanics here keeps `EventFeed` a thin presentational shell and
 * makes the pin/un-pin/arrival-count behaviour independently unit-testable. The
 * auto-follow snap is instant (no animation) so a high-rate burst never janks;
 * only the explicit `jumpToLatest` animates, and it honours
 * `prefers-reduced-motion` (DASHBOARD §15 — no unstoppable motion).
 *
 * @module hooks/use-follow-mode
 */

'use client'

import { type RefObject, useCallback, useRef, useState } from 'react'

/** Distance (px) from the top within which the feed is considered pinned to the latest row. */
const TOP_THRESHOLD_PX = 8

/** The follow-mode surface consumed by {@link EventFeed}. */
export interface FollowMode {
  /** Whether the feed is pinned to the newest row (auto-following). */
  isPinned: boolean
  /** Arrivals counted while un-pinned (drives the "N new" pill); `0` while pinned. */
  newCount: number
  /** Ref to attach to the scrollable feed container. */
  scrollRef: RefObject<HTMLDivElement | null>
  /** `onScroll` handler: re-pins at the top edge, un-pins once scrolled away. */
  onScroll: () => void
  /** Register `count` newly-arrived items: snaps to top while pinned, else bumps `newCount`. */
  registerArrival: (count?: number) => void
  /** Re-pin and scroll back to the newest row (smooth unless reduced-motion). */
  jumpToLatest: () => void
}

/** Whether the user has requested reduced motion (SSR-safe). */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Follow-mode state machine for a newest-on-top live feed.
 *
 * Starts pinned. While pinned, each {@link FollowMode.registerArrival} snaps the
 * container to the top so the newest row stays visible; once the reader scrolls
 * down, {@link FollowMode.onScroll} un-pins and arrivals accumulate in `newCount`
 * until they scroll back to the top or call {@link FollowMode.jumpToLatest}.
 *
 * @returns The {@link FollowMode} surface to wire into a scrollable feed.
 */
export function useFollowMode(): FollowMode {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  // Mirror of `isPinned` read by the imperative callbacks so they never see a
  // stale closure value between renders.
  const pinnedRef = useRef(true)
  const [isPinned, setIsPinned] = useState(true)
  const [newCount, setNewCount] = useState(0)

  const setPinned = useCallback((next: boolean): void => {
    pinnedRef.current = next
    setIsPinned(next)
  }, [])

  const onScroll = useCallback((): void => {
    const el = scrollRef.current
    if (!el) return
    const isAtTop = el.scrollTop <= TOP_THRESHOLD_PX
    if (isAtTop) {
      if (!pinnedRef.current) setPinned(true)
      // Functional bail-out: React skips the re-render when the count is already 0,
      // so scroll events at the top edge don't churn.
      setNewCount((current) => (current === 0 ? current : 0))
    } else if (pinnedRef.current) {
      setPinned(false)
    }
  }, [setPinned])

  const registerArrival = useCallback((count = 1): void => {
    if (pinnedRef.current) {
      // Auto-follow: snap to the newest row instantly (never animated, so a
      // high-rate burst cannot jank the viewport).
      scrollRef.current?.scrollTo({ top: 0 })
      setNewCount(0)
    } else {
      setNewCount((current) => current + count)
    }
  }, [])

  const jumpToLatest = useCallback((): void => {
    setPinned(true)
    setNewCount(0)
    scrollRef.current?.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }, [setPinned])

  return { isPinned, newCount, scrollRef, onScroll, registerArrival, jumpToLatest }
}
