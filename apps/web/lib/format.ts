/**
 * @fileoverview Presentation formatters shared by the Observe charts and tiles.
 *
 * Centralizes the dashboard's number/byte/latency formatting rules — notably the
 * design-system requirement that sub-millisecond cache latency is rendered with
 * µs precision and **never** rounded to `0ms` (DASHBOARD §2 principle 4).
 *
 * @module lib/format
 */

/** Bytes-per-unit step for the binary size scale. */
const BYTES_STEP = 1024

/** Binary size unit labels, ascending. */
const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

/**
 * Format a latency in milliseconds with µs precision, never collapsing to `0ms`.
 *
 * Sub-millisecond values keep three decimals (`0.412ms`); values ≥ 1ms keep two
 * (`12.34ms`). A genuine zero renders as `0ms` (no sample), distinct from a
 * rounded-away sub-ms value.
 *
 * @param ms - The latency in milliseconds.
 * @returns A human label such as `0.412ms` or `12.34ms`.
 */
export function formatLatencyMs(ms: number): string {
  if (!Number.isFinite(ms)) return '—'
  if (ms === 0) return '0ms'
  if (ms < 1) return `${ms.toFixed(3)}ms`
  return `${ms.toFixed(2)}ms`
}

/**
 * Format a byte count on the binary scale (B/KB/MB/GB/TB).
 *
 * @param bytes - The byte count.
 * @returns A compact label such as `312 B` or `1.2 MB`.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  let value = bytes
  let unit = 0
  while (value >= BYTES_STEP && unit < BYTE_UNITS.length - 1) {
    value /= BYTES_STEP
    unit++
  }
  const decimals = unit === 0 ? 0 : value < 10 ? 1 : 0
  return `${value.toFixed(decimals)} ${BYTE_UNITS[unit]}`
}

/**
 * Format a 0–1 ratio as a percentage string.
 *
 * @param ratio - The ratio in `[0, 1]`.
 * @param decimals - Fractional digits (default 1).
 * @returns A label such as `94.2%`.
 */
export function formatPercent(ratio: number, decimals = 1): string {
  if (!Number.isFinite(ratio)) return '—'
  return `${(ratio * 100).toFixed(decimals)}%`
}

/**
 * Format an integer compactly (`1,204`, `1.2k`, `3.4M`).
 *
 * @param value - The number to format.
 * @returns A locale-grouped or compact label.
 */
export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (Math.abs(value) < 10_000) return value.toLocaleString('en-US')
  return Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

/**
 * Format a signed delta with an explicit sign (`+18`, `-3`, `0`).
 *
 * @param value - The delta value.
 * @returns A signed compact label.
 */
export function formatDelta(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatCount(value)}`
}

/**
 * Format an uptime in seconds as a compact `Nd Nh Nm` label.
 *
 * @param seconds - The uptime in seconds.
 * @returns A label such as `4h 12m` or `3d 1h`.
 */
export function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—'
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

/**
 * Format an epoch-ms timestamp as a `HH:MM:SS` wall-clock label for chart axes.
 *
 * Accepts `number | string` so it slots directly into Recharts axis/tooltip
 * formatters (which type their value loosely) without a wrapper.
 *
 * @param epochMs - The timestamp in milliseconds since the epoch.
 * @returns A 24-hour `HH:MM:SS` label.
 */
export function formatClock(epochMs: number | string): string {
  const ms = typeof epochMs === 'number' ? epochMs : Number(epochMs)
  if (!Number.isFinite(ms)) return '—'
  return new Date(ms).toLocaleTimeString('en-US', { hour12: false })
}

/**
 * Format a TTL in seconds as the Explorer's label: `mm:ss`, `∞`, or `—`.
 *
 * Follows Redis TTL conventions: `-1` = persisted (no expiry → `∞`); `-2` or any
 * negative value other than `-1` = absent (`—`); `0`+ = remaining seconds.
 *
 * @param ttlSeconds - The TTL in seconds (Redis convention).
 * @returns The countdown label.
 */
export function formatTtlLabel(ttlSeconds: number): string {
  if (ttlSeconds === -1) return '∞'
  if (ttlSeconds < 0) return '—'
  const mins = Math.floor(ttlSeconds / 60)
  const secs = Math.floor(ttlSeconds % 60)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}
