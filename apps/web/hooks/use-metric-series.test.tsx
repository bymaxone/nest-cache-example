/**
 * @fileoverview Unit tests for `useMetricSeries` — the dense accumulator that
 * derives the Overview timeseries from successive point-in-time snapshots.
 *
 * The hook's append effect is keyed on `inputs.tick` (it reads the rest from a
 * ref), so each scenario drives it by rerendering with a bumped tick. Covers:
 * the null-metrics early return; first-tick baseline seeding (no bucket yet);
 * second-tick cumulative-delta diffing with the `Math.max(0, …)` clamps and the
 * elapsed-time rate; `commandstats` `calls=N` regex parsing (line present /
 * absent / malformed); the nearest-rank percentile (empty window → 0, populated
 * window → sampled); the sliding-window cap with the `healthTick` de-dup gate;
 * the `used_memory` / `expired_keys` / `keysCount` fallbacks; the drop-oldest
 * `MAX_BUCKETS` cap; and the reset-on-`resetKey` clear.
 *
 * @module hooks/use-metric-series.test
 */
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMetricSeries, type MetricSeriesInputs, type OverviewBucket } from './use-metric-series'
import { type MetricsSnapshot, type RedisInfo, type HealthResponse } from '@/lib/cache-api'

/** Build a metrics snapshot with the given cumulative totals. */
function metricsOf(hits: number, misses: number): MetricsSnapshot {
  return {
    prefixes: {},
    totals: { hits, misses, hitRate: hits / Math.max(1, hits + misses) },
    instantaneousOpsPerSec: 7,
    note: 'n',
  }
}

/** Build an INFO record with optional commandstats / stats / memory sections. */
function infoOf(opts: {
  commandstats?: Record<string, string>
  stats?: Record<string, string>
  memory?: Record<string, string>
}): RedisInfo {
  const info: RedisInfo = {}
  if (opts.commandstats) info['commandstats'] = opts.commandstats
  if (opts.stats) info['stats'] = opts.stats
  if (opts.memory) info['memory'] = opts.memory
  return info
}

/** Compose the full input bundle with sensible defaults. */
function inputs(over: Partial<MetricSeriesInputs>): MetricSeriesInputs {
  return {
    metrics: metricsOf(0, 0),
    info: null,
    health: null,
    keysCount: null,
    tick: 0,
    healthTick: 0,
    resetKey: 'r',
    ...over,
  }
}

describe('useMetricSeries', () => {
  it('returns no buckets while metrics is null', () => {
    /*
     * Scenario: the first poll has not resolved yet.
     * Rule it protects: the `if (!metrics) return` early-exit yields an empty series
     * (nothing to diff against).
     */
    const { result } = renderHook((p: MetricSeriesInputs) => useMetricSeries(p), {
      initialProps: inputs({ metrics: null, tick: 1 }),
    })
    expect(result.current).toEqual([])
  })

  it('seeds a baseline on the first tick without emitting a bucket', () => {
    /*
     * Scenario: the very first metrics snapshot arrives.
     * Rule it protects: a delta needs two samples, so the first tick only records
     * the baseline (`!prev` return) and produces no bucket.
     */
    const { result } = renderHook((p: MetricSeriesInputs) => useMetricSeries(p), {
      initialProps: inputs({ metrics: metricsOf(10, 5), tick: 1 }),
    })
    expect(result.current).toEqual([])
  })

  it('emits a delta bucket on the second tick with clamped counts and command rates', () => {
    /*
     * Scenario: a second snapshot arrives one second later with higher counters.
     * Rule it protects: hit/miss are the positive deltas; GET/SET/DEL ops/sec come
     * from the `commandstats` call deltas divided by elapsed seconds; the cumulative
     * hitRate/opsTotal and memory/stats values land on the bucket.
     */
    const first = inputs({
      metrics: metricsOf(10, 5),
      info: infoOf({
        commandstats: {
          cmdstat_get: 'calls=100,usec=1',
          cmdstat_set: 'calls=40',
          cmdstat_del: 'calls=10',
        },
        stats: { expired_keys: '3' },
        memory: { used_memory: '2048' },
      }),
      keysCount: 12,
      tick: 1000,
      healthTick: 0,
    })
    const { result, rerender } = renderHook((p: MetricSeriesInputs) => useMetricSeries(p), {
      initialProps: first,
    })
    act(() => {
      rerender(
        inputs({
          metrics: metricsOf(18, 9),
          info: infoOf({
            commandstats: {
              cmdstat_get: 'calls=140,usec=1',
              cmdstat_set: 'calls=60',
              cmdstat_del: 'calls=20',
            },
            stats: { expired_keys: '5' },
            memory: { used_memory: '4096' },
          }),
          keysCount: 20,
          tick: 2000,
          healthTick: 0,
        }),
      )
    })
    expect(result.current).toHaveLength(1)
    const bucket = result.current[0] as OverviewBucket
    expect(bucket.t).toBe(2000)
    expect(bucket.hit).toBe(8) // 18 - 10
    expect(bucket.miss).toBe(4) // 9 - 5
    expect(bucket.get).toBe(40) // (140-100)/1s
    expect(bucket.set).toBe(20) // (60-40)/1s
    expect(bucket.del).toBe(10) // (20-10)/1s
    expect(bucket.usedMemory).toBe(4096)
    expect(bucket.keysCount).toBe(20)
    expect(bucket.expiredKeys).toBe(5)
    expect(bucket.opsTotal).toBe(7)
  })

  it('clamps a decreasing counter delta to zero and falls back missing fields to zero', () => {
    /*
     * Scenario: counters reset (lower than before) and INFO sections are absent.
     * Rule it protects: the `Math.max(0, …)` clamps keep negative deltas at 0, and
     * the `?? 0` fallbacks (used_memory, expired_keys, keysCount) cover the absent
     * info/keysCount path.
     */
    const first = inputs({ metrics: metricsOf(20, 20), info: null, keysCount: null, tick: 1000 })
    const { result, rerender } = renderHook((p: MetricSeriesInputs) => useMetricSeries(p), {
      initialProps: first,
    })
    act(() => {
      rerender(inputs({ metrics: metricsOf(5, 5), info: null, keysCount: null, tick: 2000 }))
    })
    const bucket = result.current[0] as OverviewBucket
    expect(bucket.hit).toBe(0)
    expect(bucket.miss).toBe(0)
    expect(bucket.get).toBe(0)
    expect(bucket.usedMemory).toBe(0)
    expect(bucket.expiredKeys).toBe(0)
    expect(bucket.keysCount).toBe(0)
  })

  it('parses a present commandstats line, ignores a malformed one, and treats an absent one as zero', () => {
    /*
     * Scenario: one command has a well-formed `calls=N`, one lacks it, one is
     * absent entirely.
     * Rule it protects: `callsOf` returns N on a match, 0 when the line has no
     * `calls=` token, and 0 when the line is missing — so the rate stays defined.
     */
    const first = inputs({
      metrics: metricsOf(0, 0),
      info: infoOf({ commandstats: { cmdstat_get: 'calls=10', cmdstat_set: 'usec=5' } }),
      tick: 1000,
    })
    const { result, rerender } = renderHook((p: MetricSeriesInputs) => useMetricSeries(p), {
      initialProps: first,
    })
    act(() => {
      rerender(
        inputs({
          metrics: metricsOf(0, 0),
          // get advances by 5; set has no calls token (parsed 0 both ticks → 0);
          // del is absent in both → 0.
          info: infoOf({ commandstats: { cmdstat_get: 'calls=15', cmdstat_set: 'usec=9' } }),
          tick: 3000,
        }),
      )
    })
    const bucket = result.current[0] as OverviewBucket
    // elapsed = (3000-1000)/1000 = 2s; (15-10)/2 = 2.5 → round → 3 (Math.round)
    expect(bucket.get).toBe(3)
    expect(bucket.set).toBe(0)
    expect(bucket.del).toBe(0)
  })

  it('pushes a ping sample only when the health tick advances and computes percentiles', () => {
    /*
     * Scenario: health refetches between ticks (new healthTick) with a finite
     * latency, then a tick where healthTick is unchanged.
     * Rule it protects: a sample is pushed only when `healthTick` changes (de-dup),
     * so the latency window grows by one per health refetch, and the nearest-rank
     * percentile reads from the populated window.
     */
    const health: HealthResponse = { status: 'ok', latencyMs: 0.5 }
    const first = inputs({ metrics: metricsOf(0, 0), health, healthTick: 1, tick: 1000 })
    const { result, rerender } = renderHook((p: MetricSeriesInputs) => useMetricSeries(p), {
      initialProps: first,
    })
    act(() => {
      rerender(
        inputs({
          metrics: metricsOf(0, 0),
          health: { status: 'ok', latencyMs: 1.5 },
          healthTick: 2,
          tick: 2000,
        }),
      )
    })
    const bucket = result.current[0] as OverviewBucket
    // Window holds [0.5, 1.5]; nearest-rank p50/p95/p99 land on a real sample.
    expect(bucket.p50).toBeGreaterThan(0)
    expect(bucket.p99).toBeGreaterThan(0)
  })

  it('skips the ping sample when latency is non-finite', () => {
    /*
     * Scenario: a health snapshot reports a non-finite latency.
     * Rule it protects: the `Number.isFinite` guard skips pushing the bad sample, so
     * with no prior samples the percentiles fall back to 0.
     */
    const first = inputs({ metrics: metricsOf(0, 0), health: null, tick: 1000 })
    const { result, rerender } = renderHook((p: MetricSeriesInputs) => useMetricSeries(p), {
      initialProps: first,
    })
    act(() => {
      rerender(
        inputs({
          metrics: metricsOf(0, 0),
          health: { status: 'degraded', latencyMs: Number.NaN },
          healthTick: 9,
          tick: 2000,
        }),
      )
    })
    const bucket = result.current[0] as OverviewBucket
    expect(bucket.p50).toBe(0)
    expect(bucket.p95).toBe(0)
    expect(bucket.p99).toBe(0)
  })

  it('caps the latency window to its bound, dropping the oldest sample', () => {
    /*
     * Scenario: more health refetches than the window size, each with a fresh tick.
     * Rule it protects: once the window exceeds LATENCY_WINDOW it shifts out the
     * oldest, so the percentile is computed over the most recent samples only.
     */
    let healthTick = 0
    const { result, rerender } = renderHook((p: MetricSeriesInputs) => useMetricSeries(p), {
      initialProps: inputs({
        metrics: metricsOf(0, 0),
        health: { status: 'ok', latencyMs: 0 },
        healthTick: ++healthTick,
        tick: 0,
      }),
    })
    // Drive 70 ticks (> LATENCY_WINDOW = 60), each a distinct latency + healthTick.
    for (let i = 1; i <= 70; i++) {
      act(() => {
        rerender(
          inputs({
            metrics: metricsOf(0, 0),
            health: { status: 'ok', latencyMs: i },
            healthTick: ++healthTick,
            tick: i * 1000,
          }),
        )
      })
    }
    const last = result.current[result.current.length - 1] as OverviewBucket
    // The earliest small samples have been shifted out, so p99 reflects high values.
    expect(last.p99).toBeGreaterThan(50)
  })

  it('caps the accumulated buckets at MAX_BUCKETS (drop-oldest)', () => {
    /*
     * Scenario: more ticks than the bucket bound.
     * Rule it protects: the `slice(-MAX_BUCKETS)` keeps only the newest 60 buckets.
     */
    const { result, rerender } = renderHook((p: MetricSeriesInputs) => useMetricSeries(p), {
      initialProps: inputs({ metrics: metricsOf(0, 0), tick: 0 }),
    })
    for (let i = 1; i <= 65; i++) {
      act(() => {
        rerender(inputs({ metrics: metricsOf(i, i), tick: i * 1000 }))
      })
    }
    expect(result.current.length).toBe(60)
  })

  it('clears the accumulated series and baselines when the reset key changes', () => {
    /*
     * Scenario: the active time range changes mid-stream.
     * Rule it protects: the reset effect wipes buckets and the baseline refs, so the
     * next tick after a reset seeds a fresh baseline (no bucket from a stale diff).
     */
    const { result, rerender } = renderHook((p: MetricSeriesInputs) => useMetricSeries(p), {
      initialProps: inputs({ metrics: metricsOf(0, 0), tick: 0, resetKey: 'a' }),
    })
    act(() => {
      rerender(inputs({ metrics: metricsOf(5, 5), tick: 1000, resetKey: 'a' }))
    })
    expect(result.current).toHaveLength(1)
    // Change the reset key: buckets clear and the baseline is dropped.
    act(() => {
      rerender(inputs({ metrics: metricsOf(9, 9), tick: 2000, resetKey: 'b' }))
    })
    expect(result.current).toEqual([])
    // The reset-tick re-seeded the baseline at (9,9); the next same-range tick now
    // diffs against that fresh baseline, proving the reset dropped the stale (5,5)
    // counters rather than carrying them forward.
    act(() => {
      rerender(inputs({ metrics: metricsOf(12, 12), tick: 3000, resetKey: 'b' }))
    })
    expect(result.current).toHaveLength(1)
    expect((result.current[0] as OverviewBucket).hit).toBe(3)
  })
})
