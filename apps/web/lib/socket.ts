/**
 * @fileoverview Live-feeds transport — a single `socket.io-client` connection to
 * the API gateway, multiplexing the three server→browser channels:
 * `cache:connection` (lifecycle status + latency), `cache:event` (Pub/Sub
 * fan-out), and `cache:expired` (TTL keyspace expiry).
 *
 * The socket is strictly **receive-only**: the browser publishes via the REST
 * `POST /pubsub/publish` endpoint, never by emitting on this socket. The
 * `RingBuffer` caps memory under a high-rate burst (drop-oldest), and the pure
 * per-channel parsers narrow the untyped gateway payloads into the typed
 * {@link CacheEvent} union. `CacheEventName` comes from the zero-dependency
 * `@bymax-one/nest-cache/shared` subpath, keeping the browser bundle library-clean.
 *
 * @module lib/socket
 */

import { io, type Socket } from 'socket.io-client'
import { type CacheEventName } from '@bymax-one/nest-cache/shared'

/**
 * A normalized live event from one of the three gateway channels.
 *
 * `seq` is a monotonic ingestion counter assigned by the consumer
 * ({@link useCacheSocket}); it gives every buffered event a stable, unique
 * identity for React keys (the wall-clock `at` can repeat within a burst).
 */
export type CacheEvent =
  | {
      kind: 'connection'
      seq: number
      event: CacheEventName
      data: Record<string, unknown>
      at: number
    }
  | { kind: 'event'; seq: number; channel: string; payload: unknown; at: number }
  | { kind: 'expired'; seq: number; key: string; at: number }

/** Fixed-capacity ring buffer; drops the oldest entries once `capacity` is exceeded. */
export class RingBuffer<T> {
  private buf: T[] = []

  /**
   * @param capacity - Maximum retained entries; older entries are dropped first.
   */
  constructor(private readonly capacity: number) {}

  /** Append one entry, dropping the oldest if over capacity. */
  push(item: T): void {
    this.buf.push(item)
    this.trim()
  }

  /** Append many entries in order, trimming once at the end. */
  pushMany(items: readonly T[]): void {
    for (const item of items) this.buf.push(item)
    this.trim()
  }

  /**
   * A live, read-only view of the retained entries (oldest first).
   *
   * This is the backing array itself, not a snapshot — it is mutated in place by
   * `push`/`pushMany`/`trim`. Callers that need a stable point-in-time copy must
   * clone it (`[...buffer.toArray()]`).
   */
  toArray(): readonly T[] {
    return this.buf
  }

  /** Number of retained entries. */
  get size(): number {
    return this.buf.length
  }

  /** Drop oldest entries until the buffer is within capacity. */
  private trim(): void {
    if (this.buf.length > this.capacity) {
      this.buf.splice(0, this.buf.length - this.capacity)
    }
  }
}

/**
 * Open the live socket to the API gateway (`NEXT_PUBLIC_WS_URL`), WebSocket transport only.
 *
 * @returns A connected `socket.io-client` `Socket`. Callers must `close()` it on cleanup.
 */
export function createCacheSocket(): Socket {
  const url = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001'
  return io(url, { transports: ['websocket'], autoConnect: true })
}

/** Narrow an unknown value to a plain object record. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Read a numeric timestamp from a payload, falling back to the local clock. */
function timestampOf(value: unknown): number {
  return typeof value === 'number' ? value : Date.now()
}

/**
 * Parse a raw `cache:connection` payload (`{ event, data, at }`) into a {@link CacheEvent}.
 *
 * @param raw - The untyped gateway payload.
 * @param seq - Monotonic ingestion counter used as the event's stable identity.
 * @returns A `connection`-tagged event.
 */
export function parseConnectionEvent(raw: unknown, seq: number): CacheEvent {
  const r = raw as { event?: unknown; data?: unknown; at?: unknown }
  return {
    kind: 'connection',
    seq,
    event: (typeof r.event === 'string' ? r.event : 'error') as CacheEventName,
    data: isRecord(r.data) ? r.data : {},
    at: timestampOf(r.at),
  }
}

/**
 * Parse a raw `cache:event` payload (`{ channel, payload, at }`) into a {@link CacheEvent}.
 *
 * @param raw - The untyped gateway payload.
 * @param seq - Monotonic ingestion counter used as the event's stable identity.
 * @returns An `event`-tagged event.
 */
export function parseChannelEvent(raw: unknown, seq: number): CacheEvent {
  const r = raw as { channel?: unknown; payload?: unknown; at?: unknown }
  return {
    kind: 'event',
    seq,
    channel: typeof r.channel === 'string' ? r.channel : '',
    payload: r.payload,
    at: timestampOf(r.at),
  }
}

/**
 * Parse a raw `cache:expired` payload (`{ key, at }`) into a {@link CacheEvent}.
 *
 * @param raw - The untyped gateway payload.
 * @param seq - Monotonic ingestion counter used as the event's stable identity.
 * @returns An `expired`-tagged event.
 */
export function parseExpiredEvent(raw: unknown, seq: number): CacheEvent {
  const r = raw as { key?: unknown; at?: unknown }
  return {
    kind: 'expired',
    seq,
    key: typeof r.key === 'string' ? r.key : '',
    at: timestampOf(r.at),
  }
}
