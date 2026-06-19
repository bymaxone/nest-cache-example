/**
 * @fileoverview Unit tests for `useFollowMode` — the pin / un-pin / arrival-count
 * state machine behind every live {@link EventFeed}.
 *
 * The hook returns a `scrollRef` the component normally attaches to its scroll
 * container; here a fake element (with a controllable `scrollTop` and a spied
 * `scrollTo`) is assigned to `scrollRef.current` so the imperative callbacks can be
 * driven directly. Covers: starts pinned; auto-snap-to-top on arrival while pinned;
 * un-pin once scrolled away; arrivals accumulate while un-pinned; re-pin + count
 * reset at the top edge; the functional count bail-out; `jumpToLatest` honouring
 * `prefers-reduced-motion` (smooth vs auto); and the null-ref guards.
 *
 * @module hooks/use-follow-mode.test
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFollowMode } from './use-follow-mode'

/**
 * Build a real `div`, give it a settable `scrollTop` and a spied `scrollTo`, and
 * attach it to the hook's scrollRef — so the imperative callbacks read/write a
 * genuine `HTMLDivElement` (no type assertion needed). The `scrollTo` spy is
 * returned alongside the element so assertions reference the bound mock directly
 * rather than the element's unbound method.
 */
function attach(
  scrollRef: { current: HTMLDivElement | null },
  scrollTop = 0,
): { el: HTMLDivElement; scrollTo: ReturnType<typeof vi.fn> } {
  const el = document.createElement('div')
  let top = scrollTop
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => top,
    set: (next: number) => {
      top = next
    },
  })
  const scrollTo = vi.fn()
  el.scrollTo = scrollTo
  scrollRef.current = el
  return { el, scrollTo }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useFollowMode', () => {
  it('starts pinned with a zero arrival count', () => {
    /*
     * Scenario: a feed mounts.
     * Rule it protects: the machine starts pinned (auto-following) with no pending
     * arrivals.
     */
    const { result } = renderHook(() => useFollowMode())
    expect(result.current.isPinned).toBe(true)
    expect(result.current.newCount).toBe(0)
  })

  it('snaps to the top and keeps the count at zero on arrival while pinned', () => {
    /*
     * Scenario: new events arrive while the feed is pinned.
     * Rule it protects: each arrival instantly snaps the container to the top
     * (no animation) and the "N new" count stays 0.
     */
    const { result } = renderHook(() => useFollowMode())
    const { scrollTo } = attach(result.current.scrollRef)
    act(() => result.current.registerArrival(3))
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 })
    expect(result.current.newCount).toBe(0)
  })

  it('un-pins when the reader scrolls away from the top', () => {
    /*
     * Scenario: the reader scrolls down to inspect history.
     * Rule it protects: an `onScroll` past the top threshold un-pins the feed so it
     * stops auto-snapping.
     */
    const { result } = renderHook(() => useFollowMode())
    attach(result.current.scrollRef, 200)
    act(() => result.current.onScroll())
    expect(result.current.isPinned).toBe(false)
  })

  it('accumulates the arrival count while un-pinned', () => {
    /*
     * Scenario: events keep arriving after the reader scrolled away.
     * Rule it protects: while un-pinned, arrivals add to `newCount` (driving the
     * "N new" pill) instead of yanking the viewport. The default step is 1.
     */
    const { result } = renderHook(() => useFollowMode())
    const { scrollTo } = attach(result.current.scrollRef, 200)
    act(() => result.current.onScroll())
    act(() => result.current.registerArrival(2))
    act(() => result.current.registerArrival())
    expect(result.current.newCount).toBe(3)
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('re-pins and clears the count when scrolled back to the top', () => {
    /*
     * Scenario: the reader scrolls back up to the newest row.
     * Rule it protects: reaching the top edge re-pins and resets `newCount` to 0.
     */
    const { result } = renderHook(() => useFollowMode())
    const { el } = attach(result.current.scrollRef, 200)
    act(() => result.current.onScroll())
    act(() => result.current.registerArrival(4))
    el.scrollTop = 0
    act(() => result.current.onScroll())
    expect(result.current.isPinned).toBe(true)
    expect(result.current.newCount).toBe(0)
  })

  it('bails out of a re-render at the top edge when already pinned with a zero count', () => {
    /*
     * Scenario: repeated scroll events fire at the top while already pinned.
     * Rule it protects: the functional `setNewCount` returns the same 0 and
     * `setPinned` is skipped (already pinned), so churn-free scrolling at the top
     * leaves state untouched.
     */
    const { result } = renderHook(() => useFollowMode())
    attach(result.current.scrollRef, 0)
    act(() => result.current.onScroll())
    expect(result.current.isPinned).toBe(true)
    expect(result.current.newCount).toBe(0)
  })

  it('returns early from onScroll when no element is attached', () => {
    /*
     * Scenario: an `onScroll` fires before the ref is wired (or after unmount).
     * Rule it protects: the `if (!el) return` guard makes the handler a safe no-op
     * with no element to read.
     */
    const { result } = renderHook(() => useFollowMode())
    expect(() => act(() => result.current.onScroll())).not.toThrow()
    expect(result.current.isPinned).toBe(true)
  })

  it('jumpToLatest re-pins and scrolls smoothly when motion is allowed', () => {
    /*
     * Scenario: the reader taps "jump to latest" with reduced-motion off.
     * Rule it protects: it re-pins, clears the count, and animates the scroll
     * (`behavior: 'smooth'`).
     */
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList)
    const { result } = renderHook(() => useFollowMode())
    const { scrollTo } = attach(result.current.scrollRef, 200)
    act(() => result.current.onScroll())
    act(() => result.current.registerArrival(5))
    act(() => result.current.jumpToLatest())
    expect(result.current.isPinned).toBe(true)
    expect(result.current.newCount).toBe(0)
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })

  it('jumpToLatest scrolls instantly when reduced-motion is requested', () => {
    /*
     * Scenario: the user has `prefers-reduced-motion: reduce`.
     * Rule it protects: the explicit jump honours the preference and uses
     * `behavior: 'auto'` (no unstoppable motion).
     */
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList)
    const { result } = renderHook(() => useFollowMode())
    const { scrollTo } = attach(result.current.scrollRef)
    act(() => result.current.jumpToLatest())
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' })
  })

  it('registerArrival while pinned is a no-op when no element is attached', () => {
    /*
     * Scenario: an arrival lands before the scroll container mounts.
     * Rule it protects: the optional-chaining `scrollRef.current?.scrollTo` guards
     * the null ref, so the count still resets without throwing.
     */
    const { result } = renderHook(() => useFollowMode())
    expect(() => act(() => result.current.registerArrival(2))).not.toThrow()
    expect(result.current.newCount).toBe(0)
  })
})
