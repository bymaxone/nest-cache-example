/**
 * Application-level cache metrics service.
 *
 * Layer: metrics. Tracks per-prefix hit/miss counters IN PROCESS — these
 * counters reset on restart and are NOT a library feature. The catalog service
 * (and any other cache consumer) calls `recordHit` / `recordMiss` at every
 * cache branch point so the dashboard can display an accurate hit rate.
 *
 * An internal ops-per-second sampler accumulates op counts between `snapshot()`
 * calls, then computes the rate over the elapsed interval and resets on read.
 */
import { Injectable } from '@nestjs/common'
import type { MetricsSnapshot, PrefixStats } from './metrics.types.js'

/** Minimum elapsed time (ms) required to compute a meaningful ops/sec rate. */
const SAMPLE_WINDOW_MS = 1_000

/**
 * In-process cache metrics.
 *
 * Counters are held in a `Map` and reset on restart. Inject this service into
 * any cache consumer and call `recordHit` / `recordMiss` at the cache branch
 * points — these are app-level observations, not library instrumentation.
 */
@Injectable()
export class MetricsService {
  private readonly counters = new Map<string, { hits: number; misses: number }>()
  private opCount = 0
  private windowStart = Date.now()

  /**
   * Records a cache hit for the given prefix.
   *
   * @param prefix - The CacheKeyPrefix that was hit (e.g. `'product'`).
   */
  recordHit(prefix: string): void {
    this.bump(prefix, 'hits')
  }

  /**
   * Records a cache miss for the given prefix.
   *
   * @param prefix - The CacheKeyPrefix that was missed (e.g. `'product'`).
   */
  recordMiss(prefix: string): void {
    this.bump(prefix, 'misses')
  }

  /**
   * Returns a point-in-time snapshot of all recorded metrics and resets the
   * ops-per-second sampler window.
   *
   * @returns The current MetricsSnapshot (app-level; in-process; reset on restart).
   */
  snapshot(): MetricsSnapshot {
    const now = Date.now()
    const elapsedMs = Math.max(now - this.windowStart, 1)
    const instantaneousOpsPerSec =
      elapsedMs >= SAMPLE_WINDOW_MS ? Math.round((this.opCount / elapsedMs) * 1_000) : this.opCount

    this.opCount = 0
    this.windowStart = now

    const prefixes: Record<string, PrefixStats> = {}
    let totalHits = 0
    let totalMisses = 0

    for (const [prefix, entry] of this.counters) {
      const { hits, misses } = entry
      const total = hits + misses
      prefixes[prefix] = { hits, misses, hitRate: total > 0 ? hits / total : 0 }
      totalHits += hits
      totalMisses += misses
    }

    const totalOps = totalHits + totalMisses
    return {
      prefixes,
      totals: {
        hits: totalHits,
        misses: totalMisses,
        hitRate: totalOps > 0 ? totalHits / totalOps : 0,
      },
      instantaneousOpsPerSec,
      note: 'app-level, in-process counters; reset on restart — not a library feature',
    }
  }

  private bump(prefix: string, field: 'hits' | 'misses'): void {
    const entry = this.counters.get(prefix) ?? { hits: 0, misses: 0 }
    entry[field]++
    this.counters.set(prefix, entry)
    this.opCount++
  }
}
