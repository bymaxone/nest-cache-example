/**
 * @fileoverview Unit tests for `useCacheSocket` — the guarded, rAF-batched consumer
 * of the live cache socket.
 *
 * Only `createCacheSocket` is mocked (the real {@link RingBuffer} and per-channel
 * parsers are exercised), returning a fake `Socket` that records its `on` handlers
 * so incoming frames can be simulated. Fake timers drive `requestAnimationFrame`.
 * Covers: the `enabled` gate (no socket while off), the three channel
 * subscriptions, the per-frame batching (many pushes coalesce into a single flush
 * that fills the buffer and bumps the version), the next-frame schedule after a
 * flush, and teardown (cancel pending frame, detach listeners, close) on disable.
 *
 * @module hooks/use-cache-socket.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

/** A fake socket.io socket recording its registered channel handlers. */
interface FakeSocket {
  handlers: Map<string, (raw: unknown) => void>
  on: ReturnType<typeof vi.fn>
  removeAllListeners: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
}

let socket: FakeSocket
const createCacheSocket = vi.fn(() => socket)

vi.mock('@/lib/socket', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/socket')>()
  return { ...actual, createCacheSocket: () => createCacheSocket() }
})

const { useCacheSocket } = await import('./use-cache-socket')

/** Build a fresh fake socket whose `on` stores handlers by channel name. */
function makeSocket(): FakeSocket {
  const handlers = new Map<string, (raw: unknown) => void>()
  return {
    handlers,
    on: vi.fn((event: string, cb: (raw: unknown) => void) => {
      handlers.set(event, cb)
    }),
    removeAllListeners: vi.fn(),
    close: vi.fn(),
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  socket = makeSocket()
  createCacheSocket.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useCacheSocket', () => {
  it('opens no socket while disabled and returns an empty buffer', () => {
    /*
     * Scenario: the Live toggle is off (the default).
     * Rule it protects: the `enabled` gate skips opening the socket; the hook still
     * returns its (empty) ring buffer.
     */
    const { result } = renderHook(() => useCacheSocket(false))
    expect(createCacheSocket).not.toHaveBeenCalled()
    expect(result.current.size).toBe(0)
  })

  it('subscribes to the three live channels when enabled', () => {
    /*
     * Scenario: the Live toggle is on.
     * Rule it protects: exactly the connection / event / expired channels are
     * subscribed on the receive-only socket.
     */
    renderHook(() => useCacheSocket(true))
    expect(createCacheSocket).toHaveBeenCalledTimes(1)
    expect([...socket.handlers.keys()]).toEqual([
      'cache:connection',
      'cache:event',
      'cache:expired',
    ])
  })

  it('coalesces a burst into one per-frame flush that fills the buffer', () => {
    /*
     * Scenario: several frames arrive within a single animation frame.
     * Rule it protects: rAF batching means all pending events flush together once
     * the frame fires — the buffer holds every parsed event (one update per frame).
     */
    const { result } = renderHook(() => useCacheSocket(true))
    act(() => {
      socket.handlers.get('cache:connection')?.({ event: 'ready', data: {}, at: 1 })
      socket.handlers.get('cache:event')?.({ channel: 'orders', payload: { x: 1 }, at: 2 })
      socket.handlers.get('cache:expired')?.({ key: 'cache-example:k', at: 3 })
    })
    // Before the frame fires, the buffer is still empty (events are pending).
    expect(result.current.size).toBe(0)
    act(() => {
      vi.advanceTimersToNextFrame()
    })
    expect(result.current.size).toBe(3)
    const events = [...result.current.toArray()]
    expect(events.map((e) => e.kind)).toEqual(['connection', 'event', 'expired'])
    // Monotonic seq is assigned in arrival order.
    expect(events.map((e) => e.seq)).toEqual([0, 1, 2])
  })

  it('schedules a fresh frame for events that arrive after a flush', () => {
    /*
     * Scenario: a second burst lands after the first frame already flushed.
     * Rule it protects: `raf` is reset to 0 on flush, so the next event schedules a
     * new frame and is not lost.
     */
    const { result } = renderHook(() => useCacheSocket(true))
    act(() => {
      socket.handlers.get('cache:expired')?.({ key: 'a', at: 1 })
    })
    act(() => {
      vi.advanceTimersToNextFrame()
    })
    expect(result.current.size).toBe(1)
    act(() => {
      socket.handlers.get('cache:expired')?.({ key: 'b', at: 2 })
    })
    act(() => {
      vi.advanceTimersToNextFrame()
    })
    expect(result.current.size).toBe(2)
  })

  it('tears down (cancels the pending frame, detaches listeners, closes) on disable', () => {
    /*
     * Scenario: the Live toggle flips off while a frame is still pending.
     * Rule it protects: cleanup cancels the queued rAF, removes all listeners (since
     * socket.io does not detach on close), and closes the socket — so no late event
     * fires a handler after teardown.
     */
    const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame')
    const { rerender } = renderHook(({ enabled }) => useCacheSocket(enabled), {
      initialProps: { enabled: true },
    })
    // Queue an event so a frame is pending (raf !== 0) at teardown time.
    act(() => {
      socket.handlers.get('cache:expired')?.({ key: 'a', at: 1 })
    })
    rerender({ enabled: false })
    expect(cancelSpy).toHaveBeenCalled()
    expect(socket.removeAllListeners).toHaveBeenCalledTimes(1)
    expect(socket.close).toHaveBeenCalledTimes(1)
  })

  it('tears down without cancelling a frame when none is pending', () => {
    /*
     * Scenario: the toggle flips off with no event buffered (raf === 0).
     * Rule it protects: the `if (raf)` guard skips `cancelAnimationFrame`, still
     * detaching listeners and closing the socket.
     */
    const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame')
    const { rerender } = renderHook(({ enabled }) => useCacheSocket(enabled), {
      initialProps: { enabled: true },
    })
    rerender({ enabled: false })
    expect(cancelSpy).not.toHaveBeenCalled()
    expect(socket.removeAllListeners).toHaveBeenCalledTimes(1)
    expect(socket.close).toHaveBeenCalledTimes(1)
  })
})
