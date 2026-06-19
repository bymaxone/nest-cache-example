/**
 * @fileoverview Unit tests for the shared `nuqs` URL-state parsers (`lib/filters`).
 *
 * Each parser is a value: this verifies its default (so consumers never see
 * `undefined`), its happy-path parse, and — for the string-literal parsers —
 * that an off-list value is rejected to `null`. Also pins the exported preset
 * tuples (`RANGE_PRESETS`, `SCAN_STRATEGIES`, `KEY_TYPES`) the UI selects from.
 *
 * @module lib/filters.test
 */
import { describe, it, expect } from 'vitest'
import {
  RANGE_PRESETS,
  SCAN_STRATEGIES,
  KEY_TYPES,
  tenantParser,
  liveParser,
  rangeParser,
  prefixParser,
  patternParser,
  typeParser,
  hasTtlParser,
  strategyParser,
  scanStrategyParser,
  keyTypeParser,
} from './filters'

describe('preset tuples', () => {
  it('expose the exact range / strategy / key-type facet values', () => {
    /*
     * Scenario: the control bar renders selectable presets from these tuples.
     * Rule it protects: the UI's choices stay pinned to the documented sets, so a
     * silent reorder or addition is caught.
     */
    expect(RANGE_PRESETS).toEqual(['5m', '15m', '1h'])
    expect(SCAN_STRATEGIES).toEqual(['scan', 'keys'])
    expect(KEY_TYPES).toEqual(['string', 'hash', 'set'])
  })
})

describe('plain string / boolean parsers', () => {
  it('default the free-text filters to empty and the booleans to false', () => {
    /*
     * Scenario: a fresh page load with no query string.
     * Rule it protects: every base control resolves to a concrete default
     * (`''` / `false`), keeping `undefined` out of consumers.
     */
    expect(tenantParser.defaultValue).toBe('')
    expect(prefixParser.defaultValue).toBe('')
    expect(patternParser.defaultValue).toBe('')
    expect(typeParser.defaultValue).toBe('')
    expect(strategyParser.defaultValue).toBe('')
    expect(liveParser.defaultValue).toBe(false)
    expect(hasTtlParser.defaultValue).toBe(false)
  })

  it('parse a present query value', () => {
    /*
     * Scenario: a deep-link carries a tenant prefix and the live toggle on.
     * Rule it protects: a present value round-trips through the parser (string
     * passthrough, boolean coercion of `true`).
     */
    expect(tenantParser.parse('acme')).toBe('acme')
    expect(liveParser.parse('true')).toBe(true)
    expect(hasTtlParser.parse('true')).toBe(true)
  })
})

describe('string-literal parsers', () => {
  it('default the range to 15m and the scan strategy to scan', () => {
    /*
     * Scenario: a page load with no explicit range or strategy.
     * Rule it protects: the safe defaults (`15m`, `scan`) apply.
     */
    expect(rangeParser.defaultValue).toBe('15m')
    expect(scanStrategyParser.defaultValue).toBe('scan')
  })

  it('parse an in-list value and reject an off-list value to null', () => {
    /*
     * Scenario: the URL carries a known preset, then a corrupted one.
     * Rule it protects: literal parsers accept only listed members; anything else
     * resolves to `null` (the key-type facet has no default, so null = all types).
     */
    expect(rangeParser.parse('1h')).toBe('1h')
    expect(rangeParser.parse('99h')).toBeNull()
    expect(scanStrategyParser.parse('keys')).toBe('keys')
    expect(scanStrategyParser.parse('nope')).toBeNull()
    expect(keyTypeParser.parse('hash')).toBe('hash')
    expect(keyTypeParser.parse('bogus')).toBeNull()
  })
})
