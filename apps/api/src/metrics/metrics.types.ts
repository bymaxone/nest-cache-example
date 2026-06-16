/**
 * Metrics snapshot type.
 *
 * Layer: metrics. The shape returned by GET /metrics — app-level, in-process
 * hit/miss counters that reset on restart. The `note` field makes the
 * in-process scope explicit so consumers are never misled into treating these
 * as library-level or persistent metrics.
 */

/** Per-prefix hit/miss stats with a derived hit rate. */
export interface PrefixStats {
  hits: number
  misses: number
  /** Ratio of hits to total requests; `0` when no requests have been recorded. */
  hitRate: number
}

/**
 * Snapshot of the in-process cache metrics.
 *
 * All counters are in-process and reset on restart — not a library feature.
 * The `note` field restates this in the HTTP response so API consumers see it.
 */
export interface MetricsSnapshot {
  /** Per-prefix stats keyed by the CacheKeyPrefix value (e.g. `'product'`). */
  prefixes: Record<string, PrefixStats>
  /** Aggregated totals across all prefixes. */
  totals: PrefixStats
  /** Sampled request rate over the last measurement window. */
  instantaneousOpsPerSec: number
  /** Human-readable disclaimer that these are app-level / in-process counters. */
  note: string
}
