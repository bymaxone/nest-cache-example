/**
 * Unit tests for the accessible status/severity mappings (`lib/cache-status`).
 *
 * Asserts every row of the design-system status table (DASHBOARD §18) returns a
 * `{ color, icon, label }` triple — color AND icon AND a non-empty text label, so
 * status is never conveyed by color alone. Also proves the zero-dependency
 * `@bymax-one/nest-cache/shared` subpath resolves inside the browser/jsdom bundle
 * (Feature-Coverage-Matrix row #48).
 *
 * @module lib/cache-status.test
 */
import { describe, it, expect } from 'vitest'
import { CACHE_ERROR_CODES, type CacheConnectionStatus } from '@bymax-one/nest-cache/shared'
import {
  connectionStatusMeta,
  hitMissMeta,
  dataTypeMeta,
  httpErrorSeverityMeta,
  eventToConnectionState,
  type ConnectionState,
  type StatusMeta,
} from './cache-status'

/**
 * Asserts a descriptor carries all three accessible channels: a hex color, a
 * truthy icon component, and a non-empty text label.
 *
 * @param meta - The descriptor under test.
 */
function expectAccessible(meta: StatusMeta): void {
  expect(meta.color).toMatch(/^#[0-9a-fA-F]{6}$/)
  expect(meta.icon).toBeTruthy()
  expect(meta.label.length).toBeGreaterThan(0)
}

describe('connectionStatusMeta', () => {
  const cases: ReadonlyArray<readonly [ConnectionState, string, string]> = [
    ['connecting', '#60a5fa', 'Connecting'],
    ['ready', '#22c55e', 'Ready'],
    ['reconnecting', '#f59e0b', 'Reconnecting'],
    ['closed', '#ef4444', 'Closed'],
    ['end', '#ef4444', 'Ended'],
    ['error', '#a855f7', 'Error'],
  ]

  it.each(cases)('maps %s to its accessible color + icon + label', (state, color, label) => {
    /*
     * Scenario: a connection lifecycle state is rendered in the status badge.
     * Rule it protects: each state resolves to its design-system color AND a text
     * label AND an icon, so the badge is distinguishable without relying on hue.
     */
    const meta = connectionStatusMeta(state)
    expect(meta.color).toBe(color)
    expect(meta.label).toBe(label)
    expectAccessible(meta)
  })
})

describe('hitMissMeta', () => {
  it('maps a hit to green and a miss to amber, each with a label and icon', () => {
    /*
     * Scenario: the cache hit/miss outcome chip.
     * Rule it protects: hit reads green and miss amber, each with a text label and
     * icon — the most-glanced-at signal must never rely on color alone.
     */
    expect(hitMissMeta('hit').color).toBe('#22c55e')
    expect(hitMissMeta('hit').label).toBe('Hit')
    expect(hitMissMeta('miss').color).toBe('#f59e0b')
    expect(hitMissMeta('miss').label).toBe('Miss')
    expectAccessible(hitMissMeta('hit'))
    expectAccessible(hitMissMeta('miss'))
  })
})

describe('dataTypeMeta', () => {
  const cases: ReadonlyArray<readonly ['string' | 'hash' | 'set', string, string]> = [
    ['string', '#60a5fa', 'String'],
    ['hash', '#a855f7', 'Hash'],
    ['set', '#22c55e', 'Set'],
  ]

  it.each(cases)('maps the %s data type to its chip descriptor', (type, color, label) => {
    /*
     * Scenario: a Redis data-type chip in the key explorer.
     * Rule it protects: each type maps to its color plus a text label and icon, so
     * the colour-coded keyspace stays accessible to color-blind readers.
     */
    const meta = dataTypeMeta(type)
    expect(meta.color).toBe(color)
    expect(meta.label).toBe(label)
    expectAccessible(meta)
  })
})

describe('httpErrorSeverityMeta', () => {
  it('follows the error palette: 504 purple, 5xx red, 4xx amber, else blue', () => {
    /*
     * Scenario: an HTTP error status surfaced in the Errors lab.
     * Rule it protects: severity colours follow the status class (504 purple, other
     * 5xx red, 4xx amber, else blue) and each tier keeps a text label.
     */
    expect(httpErrorSeverityMeta(504).color).toBe('#a855f7')
    expect(httpErrorSeverityMeta(500).color).toBe('#ef4444')
    expect(httpErrorSeverityMeta(400).color).toBe('#f59e0b')
    expect(httpErrorSeverityMeta(200).color).toBe('#60a5fa')
    expectAccessible(httpErrorSeverityMeta(504))
    expectAccessible(httpErrorSeverityMeta(400))
  })
})

describe('eventToConnectionState', () => {
  const cases: ReadonlyArray<
    readonly ['connect' | 'ready' | 'reconnecting' | 'close' | 'end' | 'error', ConnectionState]
  > = [
    ['ready', 'ready'],
    ['connect', 'connecting'],
    ['reconnecting', 'reconnecting'],
    ['close', 'closed'],
    ['end', 'end'],
    ['error', 'error'],
  ]

  it.each(cases)('maps the %s lifecycle event to its display state', (event, expected) => {
    /*
     * Scenario: a raw cache lifecycle event arrives on the socket feed.
     * Rule it protects: each library event maps to exactly the display state the UI
     * renders, so the badge reflects the true connection state.
     */
    expect(eventToConnectionState(event)).toBe(expected)
  })
})

describe('@bymax-one/nest-cache/shared resolves in the browser bundle', () => {
  it('imports CACHE_ERROR_CODES and CacheConnectionStatus under jsdom', () => {
    /*
     * Scenario: client code imports the library's zero-dependency /shared subpath.
     * Rule it protects: Feature-Coverage-Matrix row #48 — the published /shared
     * export resolves in a browser/jsdom context, shipping browser-safe types and
     * constants without pulling NestJS or ioredis into the bundle.
     */
    const codes = Object.values(CACHE_ERROR_CODES)
    expect(codes.length).toBeGreaterThan(0)
    expect(codes).toContain('cache.invalid_key')

    const status: CacheConnectionStatus = 'ready'
    expect(status).toBe('ready')
  })
})
