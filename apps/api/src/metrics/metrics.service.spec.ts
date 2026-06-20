/**
 * Unit specs for the in-process cache metrics service.
 *
 * Constructs the service directly and covers: the empty/zero snapshot (the
 * `totalOps > 0` false arm), hit/miss accumulation across prefixes (the `bump`
 * create-vs-reuse arms), derived hit rates, the ops/sec sampler, and the
 * snapshot's reset of the sampler window.
 *
 * @module metrics/metrics.service.spec
 */
import { jest } from '@jest/globals'
import { MetricsService } from './metrics.service.js'

describe('MetricsService', () => {
  it('returns a zeroed snapshot before anything is recorded', () => {
    /*
     * Scenario: snapshot a fresh service.
     * Rule it protects: with no counters, `prefixes` is empty and the totals
     * hit-rate takes the `totalOps > 0 ? ... : 0` false arm (0, no division), and
     * the sampler reports 0 ops/sec.
     */
    const snapshot = new MetricsService().snapshot()

    expect(snapshot.prefixes).toEqual({})
    expect(snapshot.totals).toEqual({ hits: 0, misses: 0, hitRate: 0 })
    expect(snapshot.instantaneousOpsPerSec).toBe(0)
    expect(snapshot.note).toContain('app-level')
  })

  it('accumulates hits and misses per prefix and derives hit rates', () => {
    /*
     * Scenario: record hits and misses across two prefixes, hitting the same
     * prefix more than once.
     * Rule it protects: `bump` creates a counter on first touch and reuses it on
     * later touches (both `?? { hits: 0, misses: 0 }` arms); per-prefix hitRate is
     * hits/total and the aggregate totals sum across prefixes with `totalOps > 0`.
     */
    const service = new MetricsService()
    service.recordHit('product') // creates the 'product' entry
    service.recordHit('product') // reuses the 'product' entry
    service.recordMiss('product')
    service.recordMiss('cart') // creates the 'cart' entry

    const snapshot = service.snapshot()

    expect(snapshot.prefixes.product).toEqual({ hits: 2, misses: 1, hitRate: 2 / 3 })
    expect(snapshot.prefixes.cart).toEqual({ hits: 0, misses: 1, hitRate: 0 })
    expect(snapshot.totals).toEqual({ hits: 2, misses: 2, hitRate: 0.5 })
    // Four ops were recorded; within a sub-second window the rate equals the count.
    expect(snapshot.instantaneousOpsPerSec).toBe(4)
  })

  it('divides by the real elapsed window when more than a second has passed', () => {
    /*
     * Scenario: four ops recorded, then a snapshot taken two seconds after the window
     * opened (Date.now pinned to 0 at construction, 2000 at snapshot).
     * Rule it protects: `elapsedMs = Math.max(now - windowStart, 1)` keeps the REAL
     * 2000ms span (a `Math.min` mutant would collapse it to 1ms and, after the
     * SAMPLE_WINDOW_MS floor, report the raw count of 4 instead of the true 2/sec).
     */
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(0)
    const service = new MetricsService() // windowStart = 0
    service.recordHit('product')
    service.recordHit('product')
    service.recordMiss('product')
    service.recordMiss('cart')
    nowSpy.mockReturnValue(2_000) // snapshot two seconds later

    // 4 ops over 2000ms ⇒ round(4 / 2000 * 1000) = 2 ops/sec.
    expect(service.snapshot().instantaneousOpsPerSec).toBe(2)
  })

  it('resets the ops/sec sampler on each snapshot but keeps the counters', () => {
    /*
     * Scenario: snapshot twice with no new ops between the two reads.
     * Rule it protects: snapshot zeroes the op count and restarts the window, so a
     * second immediate snapshot reports 0 ops/sec — while the hit/miss counters
     * (not part of the sampler) persist across snapshots.
     */
    const service = new MetricsService()
    service.recordHit('views')

    expect(service.snapshot().instantaneousOpsPerSec).toBe(1)

    const second = service.snapshot()
    expect(second.instantaneousOpsPerSec).toBe(0)
    expect(second.prefixes.views).toEqual({ hits: 1, misses: 0, hitRate: 1 })
  })
})
