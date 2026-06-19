/**
 * @fileoverview Unit tests for the live-feeds transport primitives (`lib/socket`):
 * the drop-oldest {@link RingBuffer}, the `socket.io-client` factory
 * {@link createCacheSocket}, and the three per-channel parsers that narrow the
 * untyped gateway payloads into the typed {@link CacheEvent} union.
 *
 * `socket.io-client` is mocked so `createCacheSocket` is asserted by the URL +
 * options it passes to `io`, without opening a real connection. Each parser is
 * exercised on both a well-formed payload AND a malformed one (so the
 * type-guard fallbacks — `'error'` event, empty record/string, local-clock
 * timestamp — are covered).
 *
 * @module lib/socket.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  RingBuffer,
  createCacheSocket,
  parseConnectionEvent,
  parseChannelEvent,
  parseExpiredEvent,
} from './socket'

const ioMock = vi.fn<(url: string, opts: unknown) => { marker: string }>(() => ({
  marker: 'socket',
}))

vi.mock('socket.io-client', () => ({
  io: (url: string, opts: unknown) => ioMock(url, opts),
}))

describe('RingBuffer', () => {
  it('retains pushed items in order while under capacity', () => {
    /*
     * Scenario: a low-rate feed below the buffer cap.
     * Rule it protects: `push` appends and `toArray` reflects insertion order with
     * no dropping until capacity is exceeded.
     */
    const buf = new RingBuffer<number>(3)
    buf.push(1)
    buf.push(2)
    expect(buf.size).toBe(2)
    expect([...buf.toArray()]).toEqual([1, 2])
  })

  it('drops the oldest entries once a single push exceeds capacity', () => {
    /*
     * Scenario: a sustained burst pushes past the cap one item at a time.
     * Rule it protects: `trim` keeps only the newest `capacity` entries
     * (drop-oldest), bounding memory.
     */
    const buf = new RingBuffer<number>(2)
    buf.push(1)
    buf.push(2)
    buf.push(3)
    expect(buf.size).toBe(2)
    expect([...buf.toArray()]).toEqual([2, 3])
  })

  it('pushMany appends in order and trims once at the end', () => {
    /*
     * Scenario: a per-frame flush appends a batch larger than the remaining room.
     * Rule it protects: `pushMany` adds every item then trims a single time, so the
     * final view is the newest `capacity` entries in order.
     */
    const buf = new RingBuffer<number>(3)
    buf.push(0)
    buf.pushMany([1, 2, 3])
    expect([...buf.toArray()]).toEqual([1, 2, 3])
  })

  it('pushMany on an empty batch leaves the buffer unchanged', () => {
    /*
     * Scenario: a frame flushes with nothing pending.
     * Rule it protects: an empty `pushMany` is a no-op (loop body never runs), so
     * the existing entries survive and size is stable.
     */
    const buf = new RingBuffer<number>(3)
    buf.push(7)
    buf.pushMany([])
    expect([...buf.toArray()]).toEqual([7])
  })
})

describe('createCacheSocket', () => {
  beforeEach(() => {
    ioMock.mockClear()
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_WS_URL
  })

  it('connects to NEXT_PUBLIC_WS_URL with the WebSocket transport when set', () => {
    /*
     * Scenario: the WS URL is configured via env.
     * Rule it protects: the configured URL is used and the socket is pinned to the
     * `websocket` transport with autoConnect.
     */
    process.env.NEXT_PUBLIC_WS_URL = 'http://ws.example:9000'
    createCacheSocket()
    expect(ioMock).toHaveBeenCalledWith('http://ws.example:9000', {
      transports: ['websocket'],
      autoConnect: true,
    })
  })

  it('falls back to the localhost default when the env var is unset', () => {
    /*
     * Scenario: no WS URL is provided (local dev).
     * Rule it protects: the `?? 'http://localhost:3001'` fallback supplies a usable
     * default URL.
     */
    createCacheSocket()
    expect(ioMock).toHaveBeenCalledWith('http://localhost:3001', {
      transports: ['websocket'],
      autoConnect: true,
    })
  })
})

describe('parseConnectionEvent', () => {
  it('narrows a well-formed connection payload', () => {
    /*
     * Scenario: a valid `cache:connection` frame arrives.
     * Rule it protects: a string `event`, record `data`, and numeric `at` pass
     * through, tagged `connection` with the supplied seq.
     */
    const ev = parseConnectionEvent({ event: 'ready', data: { latencyMs: 1 }, at: 1234 }, 7)
    expect(ev).toEqual({
      kind: 'connection',
      seq: 7,
      event: 'ready',
      data: { latencyMs: 1 },
      at: 1234,
    })
  })

  it('defaults event to error, data to {}, and at to the local clock on a malformed payload', () => {
    /*
     * Scenario: a corrupt frame with a non-string event and non-record data and no
     * timestamp.
     * Rule it protects: the type guards fall back to `'error'`, `{}`, and the local
     * `Date.now()` clock — the UI never crashes on a bad payload.
     */
    const before = Date.now()
    const ev = parseConnectionEvent({ event: 42, data: 'nope' }, 1)
    // Narrow the union by `kind` so the connection-specific fields are accessible.
    if (ev.kind !== 'connection') throw new Error('expected a connection event')
    expect(ev.event).toBe('error')
    expect(ev.data).toEqual({})
    expect(ev.at).toBeGreaterThanOrEqual(before)
  })
})

describe('parseChannelEvent', () => {
  it('narrows a well-formed channel payload', () => {
    /*
     * Scenario: a valid `cache:event` Pub/Sub fan-out frame.
     * Rule it protects: a string `channel`, the raw `payload`, and numeric `at`
     * pass through, tagged `event`.
     */
    const ev = parseChannelEvent({ channel: 'orders', payload: { id: 1 }, at: 500 }, 3)
    expect(ev).toEqual({ kind: 'event', seq: 3, channel: 'orders', payload: { id: 1 }, at: 500 })
  })

  it('defaults channel to empty and at to the local clock on a malformed payload', () => {
    /*
     * Scenario: a frame missing the channel and timestamp.
     * Rule it protects: a non-string channel becomes `''` and a missing `at` falls
     * back to the local clock; the raw `payload` (here undefined) is preserved.
     */
    const before = Date.now()
    const ev = parseChannelEvent({}, 2)
    // Narrow the union by `kind` so the channel-specific fields are accessible.
    if (ev.kind !== 'event') throw new Error('expected a channel event')
    expect(ev.channel).toBe('')
    expect(ev.payload).toBeUndefined()
    expect(ev.at).toBeGreaterThanOrEqual(before)
  })
})

describe('parseExpiredEvent', () => {
  it('narrows a well-formed expiry payload', () => {
    /*
     * Scenario: a valid `cache:expired` keyspace-expiry frame.
     * Rule it protects: a string `key` and numeric `at` pass through, tagged
     * `expired`.
     */
    const ev = parseExpiredEvent({ key: 'cache-example:product:1', at: 900 }, 9)
    expect(ev).toEqual({ kind: 'expired', seq: 9, key: 'cache-example:product:1', at: 900 })
  })

  it('defaults key to empty and at to the local clock on a malformed payload', () => {
    /*
     * Scenario: an expiry frame with a non-string key and no timestamp.
     * Rule it protects: the type guards fall back to `''` and the local clock.
     */
    const before = Date.now()
    const ev = parseExpiredEvent({ key: 123 }, 4)
    // Narrow the union by `kind` so the expiry-specific fields are accessible.
    if (ev.kind !== 'expired') throw new Error('expected an expired event')
    expect(ev.key).toBe('')
    expect(ev.at).toBeGreaterThanOrEqual(before)
  })
})
