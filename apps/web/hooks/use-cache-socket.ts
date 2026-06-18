/**
 * @fileoverview Guarded consumer for the live cache socket. Pushes incoming
 * events into a bounded {@link RingBuffer} (drop-oldest, ~5000) and flushes them
 * with `requestAnimationFrame` batching, so a high-rate Pub/Sub burst coalesces
 * into at most one state update per frame and never freezes the tab.
 *
 * The socket is opened only while `enabled` is true (the Live toggle is off by
 * default) and is torn down — pending frame cancelled, socket closed — on
 * cleanup or when `enabled` flips false. The socket is receive-only.
 *
 * @module hooks/use-cache-socket
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import {
  createCacheSocket,
  parseChannelEvent,
  parseConnectionEvent,
  parseExpiredEvent,
  RingBuffer,
  type CacheEvent,
} from '@/lib/socket'

/** Ring-buffer capacity — caps memory under a sustained event burst. */
const BUFFER_CAPACITY = 5_000

/**
 * Subscribe to the three live cache channels while `enabled`, buffering events
 * in a bounded ring and flushing them once per animation frame.
 *
 * @param enabled - When true, opens the socket and subscribes; when false, stays disconnected.
 * @returns The ring buffer holding the most recent events (read via `toArray()`).
 */
export function useCacheSocket(enabled: boolean): RingBuffer<CacheEvent> {
  const [buffer] = useState(() => new RingBuffer<CacheEvent>(BUFFER_CAPACITY))
  // Bumped once per flush so the host component re-renders and re-reads the buffer.
  const [, setVersion] = useState(0)
  // Monotonic, never-reset identity counter shared across reconnects, so a key
  // never collides with a still-buffered event after the Live toggle cycles.
  const seqRef = useRef(0)

  useEffect(() => {
    if (!enabled) return

    const socket = createCacheSocket()
    const pending: CacheEvent[] = []
    let raf = 0

    const flush = () => {
      buffer.pushMany(pending.splice(0))
      raf = 0
      setVersion((v) => v + 1)
    }
    const schedule = (event: CacheEvent) => {
      pending.push(event)
      raf ||= requestAnimationFrame(flush)
    }

    socket.on('cache:connection', (raw: unknown) =>
      schedule(parseConnectionEvent(raw, seqRef.current++)),
    )
    socket.on('cache:event', (raw: unknown) => schedule(parseChannelEvent(raw, seqRef.current++)))
    socket.on('cache:expired', (raw: unknown) => schedule(parseExpiredEvent(raw, seqRef.current++)))

    return () => {
      if (raf) cancelAnimationFrame(raf)
      // socket.io-client does not detach listeners on close(); remove them first
      // so a late in-flight event cannot fire a handler after teardown.
      socket.removeAllListeners()
      socket.close()
    }
  }, [enabled, buffer])

  return buffer
}
