/**
 * @fileoverview Unit tests for the presentation formatters (`lib/format`).
 *
 * Exercises every branch of the dashboard's number/byte/latency/uptime/clock/TTL
 * formatting rules — in particular the design-system invariant that sub-millisecond
 * latency keeps µs precision and is NEVER rounded away to `0ms` (DASHBOARD §2).
 *
 * @module lib/format.test
 */
import { describe, it, expect } from 'vitest'
import {
  formatLatencyMs,
  formatBytes,
  formatPercent,
  formatCount,
  formatDelta,
  formatUptime,
  formatClock,
  formatTtlLabel,
} from './format'

describe('formatLatencyMs', () => {
  it('renders a non-finite latency as an em dash', () => {
    /*
     * Scenario: a latency sample is missing (NaN/Infinity).
     * Rule it protects: a non-finite value renders the "no data" em dash, never a
     * misleading numeric latency.
     */
    expect(formatLatencyMs(Number.NaN)).toBe('—')
    expect(formatLatencyMs(Number.POSITIVE_INFINITY)).toBe('—')
  })

  it('renders a genuine zero as 0ms', () => {
    /*
     * Scenario: no sample was taken (a true zero latency).
     * Rule it protects: an exact 0 reads `0ms` — distinct from a rounded-away
     * sub-ms value — so the absence of a sample is visible.
     */
    expect(formatLatencyMs(0)).toBe('0ms')
  })

  it('keeps three decimals for sub-millisecond latency', () => {
    /*
     * Scenario: a fast cache hit resolves in under a millisecond.
     * Rule it protects: values < 1ms keep µs precision (`0.412ms`) and never
     * collapse to `0ms`.
     */
    expect(formatLatencyMs(0.412)).toBe('0.412ms')
  })

  it('keeps two decimals for millisecond-and-up latency', () => {
    /*
     * Scenario: a slower round-trip of several milliseconds.
     * Rule it protects: values ≥ 1ms keep two decimals (`12.34ms`).
     */
    expect(formatLatencyMs(12.34)).toBe('12.34ms')
  })
})

describe('formatBytes', () => {
  it('renders non-finite or non-positive byte counts as 0 B', () => {
    /*
     * Scenario: a byte count is missing or zero/negative.
     * Rule it protects: the guard collapses all non-positive / non-finite inputs
     * to `0 B` rather than emitting NaN or a negative size.
     */
    expect(formatBytes(Number.NaN)).toBe('0 B')
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(-5)).toBe('0 B')
  })

  it('renders bytes with no decimals in the base unit', () => {
    /*
     * Scenario: a small payload under 1 KB.
     * Rule it protects: the base (B) unit uses zero decimals (`312 B`).
     */
    expect(formatBytes(312)).toBe('312 B')
  })

  it('renders one decimal for scaled values below 10', () => {
    /*
     * Scenario: a value that scales up to a single-digit KB/MB.
     * Rule it protects: scaled units below 10 keep one decimal (`1.2 MB`).
     */
    expect(formatBytes(1.2 * 1024 * 1024)).toBe('1.2 MB')
  })

  it('renders no decimals for scaled values of ten or more', () => {
    /*
     * Scenario: a value that scales to a double-digit KB.
     * Rule it protects: scaled units ≥ 10 drop the decimal (`12 KB`).
     */
    expect(formatBytes(12 * 1024)).toBe('12 KB')
  })

  it('caps at the largest unit (TB) and stops scaling', () => {
    /*
     * Scenario: an enormous value beyond the petabyte boundary.
     * Rule it protects: the loop stops at the last unit (TB), so an out-of-range
     * size still labels with the top unit instead of overflowing the table.
     */
    expect(formatBytes(5 * 1024 ** 5)).toBe('5120 TB')
  })
})

describe('formatPercent', () => {
  it('renders a non-finite ratio as an em dash', () => {
    /*
     * Scenario: a hit-rate ratio is undefined (division by zero upstream).
     * Rule it protects: a non-finite ratio shows the em dash, never `NaN%`.
     */
    expect(formatPercent(Number.NaN)).toBe('—')
  })

  it('formats a ratio at the default one decimal', () => {
    /*
     * Scenario: a 94.2% hit rate tile.
     * Rule it protects: the default precision is one decimal.
     */
    expect(formatPercent(0.942)).toBe('94.2%')
  })

  it('honours an explicit decimals argument', () => {
    /*
     * Scenario: a caller wants whole-percent precision.
     * Rule it protects: the optional `decimals` override is applied.
     */
    expect(formatPercent(0.5, 0)).toBe('50%')
  })
})

describe('formatCount', () => {
  it('renders a non-finite value as an em dash', () => {
    /*
     * Scenario: a counter is unavailable.
     * Rule it protects: a non-finite count shows the em dash.
     */
    expect(formatCount(Number.NaN)).toBe('—')
  })

  it('groups counts below ten thousand with locale separators', () => {
    /*
     * Scenario: a four-digit op count.
     * Rule it protects: values under 10,000 use locale grouping (`1,204`).
     */
    expect(formatCount(1204)).toBe('1,204')
  })

  it('renders large counts compactly', () => {
    /*
     * Scenario: a count in the millions.
     * Rule it protects: values ≥ 10,000 switch to compact notation (`3.4M`).
     */
    expect(formatCount(3_400_000)).toBe('3.4M')
  })
})

describe('formatDelta', () => {
  it('renders a non-finite delta as an em dash', () => {
    /*
     * Scenario: a delta is unavailable.
     * Rule it protects: a non-finite delta shows the em dash.
     */
    expect(formatDelta(Number.NaN)).toBe('—')
  })

  it('prefixes a positive delta with an explicit plus sign', () => {
    /*
     * Scenario: a metric ticked up since the last bucket.
     * Rule it protects: positive deltas carry a leading `+`.
     */
    expect(formatDelta(18)).toBe('+18')
  })

  it('keeps the native minus for a negative delta and no sign for zero', () => {
    /*
     * Scenario: a metric dropped, or did not move.
     * Rule it protects: negatives keep their `-`; zero carries no sign.
     */
    expect(formatDelta(-3)).toBe('-3')
    expect(formatDelta(0)).toBe('0')
  })
})

describe('formatUptime', () => {
  it('renders a non-finite or negative uptime as an em dash', () => {
    /*
     * Scenario: uptime is unknown or nonsensical.
     * Rule it protects: non-finite/negative seconds show the em dash.
     */
    expect(formatUptime(Number.NaN)).toBe('—')
    expect(formatUptime(-1)).toBe('—')
  })

  it('renders a multi-day uptime as days and hours', () => {
    /*
     * Scenario: the server has been up for days.
     * Rule it protects: when days > 0 the label is `Nd Nh`.
     */
    expect(formatUptime(3 * 86_400 + 1 * 3_600)).toBe('3d 1h')
  })

  it('renders a same-day uptime as hours and minutes', () => {
    /*
     * Scenario: uptime under a day but over an hour.
     * Rule it protects: when hours > 0 (and days = 0) the label is `Nh Nm`.
     */
    expect(formatUptime(4 * 3_600 + 12 * 60)).toBe('4h 12m')
  })

  it('renders a sub-hour uptime as minutes only', () => {
    /*
     * Scenario: a freshly-started server.
     * Rule it protects: under an hour the label is just minutes (`5m`).
     */
    expect(formatUptime(5 * 60)).toBe('5m')
  })
})

describe('formatClock', () => {
  it('formats a numeric epoch as a 24-hour HH:MM:SS label', () => {
    /*
     * Scenario: a Recharts axis tick receives an epoch-ms number.
     * Rule it protects: a finite number renders a 24-hour wall-clock label.
     */
    const ms = Date.UTC(2026, 0, 1, 0, 0, 0)
    expect(formatClock(ms)).toMatch(/^\d{2}:\d{2}:\d{2}$/)
  })

  it('coerces a numeric string epoch before formatting', () => {
    /*
     * Scenario: Recharts passes the value as a string.
     * Rule it protects: a numeric string is coerced and formatted, not rejected.
     */
    const ms = String(Date.UTC(2026, 0, 1, 0, 0, 0))
    expect(formatClock(ms)).toMatch(/^\d{2}:\d{2}:\d{2}$/)
  })

  it('renders a non-numeric input as an em dash', () => {
    /*
     * Scenario: a malformed tick value reaches the formatter.
     * Rule it protects: a non-finite coercion shows the em dash, never `Invalid
     * Date`.
     */
    expect(formatClock('not-a-number')).toBe('—')
  })
})

describe('formatTtlLabel', () => {
  it('renders the persisted sentinel (-1) as the infinity glyph', () => {
    /*
     * Scenario: a key has no expiry (Redis TTL -1).
     * Rule it protects: -1 maps to `∞` (persisted).
     */
    expect(formatTtlLabel(-1)).toBe('∞')
  })

  it('renders any other negative TTL as an em dash (absent key)', () => {
    /*
     * Scenario: a missing key (Redis TTL -2, or any negative ≠ -1).
     * Rule it protects: negatives other than -1 read the em dash (absent).
     */
    expect(formatTtlLabel(-2)).toBe('—')
  })

  it('renders a remaining TTL as zero-padded mm:ss', () => {
    /*
     * Scenario: a key counting down toward expiry.
     * Rule it protects: a non-negative TTL renders as zero-padded `mm:ss`.
     */
    expect(formatTtlLabel(65)).toBe('01:05')
    expect(formatTtlLabel(5)).toBe('00:05')
  })
})
