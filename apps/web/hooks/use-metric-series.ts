/**
 * @fileoverview `useMetricSeries` — accumulates the Overview's timeseries from the
 * polled point-in-time snapshots. `GET /metrics` and `GET /admin/info` return
 * cumulative counters, not series, so each tick this hook diffs the latest snapshot
 * against the previous one to derive per-bucket hit/miss counts and per-command
 * ops/sec (from `INFO commandstats` call deltas), and computes latency percentiles
 * over a sliding window of `/health` ping samples. Buckets are bounded (drop-oldest).
 *
 * @module hooks/use-metric-series
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { type HealthResponse, type MetricsSnapshot, type RedisInfo } from '@/lib/cache-api'

/** One accumulated Overview bucket spanning all golden-signal series. */
export interface OverviewBucket {
  /** Bucket timestamp (epoch ms). */
  t: number
  /** Hits recorded in the bucket (delta). */
  hit: number
  /** Misses recorded in the bucket (delta). */
  miss: number
  /** GET-family ops/sec. */
  get: number
  /** SET-family ops/sec. */
  set: number
  /** DEL-family ops/sec. */
  del: number
  /** 50th-percentile ping latency (ms). */
  p50: number
  /** 95th-percentile ping latency (ms). */
  p95: number
  /** 99th-percentile ping latency (ms). */
  p99: number
  /** Cumulative hit rate at the bucket (ratio). */
  hitRate: number
  /** Sampled instantaneous ops/sec (app-level). */
  opsTotal: number
  /** `used_memory` bytes at the bucket. */
  usedMemory: number
  /** Namespace key count at the bucket (sampled). */
  keysCount: number
  /** Cumulative `expired_keys` at the bucket. */
  expiredKeys: number
}

/** Inputs to {@link useMetricSeries} — the latest fetched snapshots. */
export interface MetricSeriesInputs {
  /** Latest metrics snapshot, or `null` when unavailable. */
  metrics: MetricsSnapshot | null
  /** Latest parsed `INFO` (fetch the `everything` section for commandstats). */
  info: RedisInfo | null
  /** Latest health snapshot (ping latency feeds the percentile window). */
  health: HealthResponse | null
  /** Latest sampled namespace key count. */
  keysCount: number | null
  /** A monotonically-changing tick (e.g. metrics `dataUpdatedAt`) that drives appends. */
  tick: number
  /** The health `dataUpdatedAt`; gates pushing a fresh ping sample (avoids duplicates). */
  healthTick: number
  /** Changing this clears the accumulated series (e.g. the active time range). */
  resetKey: string
}

/** Maximum retained buckets (drop-oldest). */
const MAX_BUCKETS = 60

/** Sliding window of ping samples used to compute latency percentiles. */
const LATENCY_WINDOW = 60

/** GET-family command names summed for the GET ops/sec series. */
const GET_CMDS = ['get', 'mget', 'hget', 'hgetall', 'smembers', 'sismember', 'scard', 'exists']

/** SET-family command names summed for the SET ops/sec series. */
const SET_CMDS = ['set', 'setnx', 'mset', 'hset', 'sadd', 'incr', 'incrby', 'decr', 'decrby']

/** DEL-family command names summed for the DEL ops/sec series. */
const DEL_CMDS = ['del', 'unlink', 'hdel', 'srem', 'persist', 'expire']

/** Snapshot of cumulative counters retained between ticks to compute deltas. */
interface CounterSnapshot {
  hits: number
  misses: number
  get: number
  set: number
  del: number
  at: number
}

/** Extract the `calls=N` count for one command from the `commandstats` section. */
function callsOf(commandstats: Record<string, string> | undefined, command: string): number {
  const line = commandstats?.[`cmdstat_${command}`]
  if (!line) return 0
  const match = /calls=(\d+)/.exec(line)
  return match ? Number(match[1]) : 0
}

/** Sum `calls` across a command family. */
function sumCalls(commandstats: Record<string, string> | undefined, commands: string[]): number {
  return commands.reduce((total, command) => total + callsOf(commandstats, command), 0)
}

/** Nearest-rank percentile of an ascending-sorted sample array. */
function percentile(sortedAsc: number[], p: number): number {
  const index = Math.min(sortedAsc.length - 1, Math.floor((p / 100) * sortedAsc.length))
  // `noUncheckedIndexedAccess` widens the element to `number | undefined`; the read
  // is `undefined` exactly when the window is empty (`index === -1`), which is the
  // same case the `?? 0` fallback handles — so an empty window returns 0 and a
  // populated one returns the nearest-rank sample.
  return sortedAsc[index] ?? 0
}

/**
 * Accumulate the Overview timeseries from successive snapshots.
 *
 * @param inputs - The latest fetched snapshots plus a tick that drives appends.
 * @returns The bounded array of accumulated buckets (oldest → newest).
 */
export function useMetricSeries(inputs: MetricSeriesInputs): OverviewBucket[] {
  const [buckets, setBuckets] = useState<OverviewBucket[]>([])

  // Keep the latest inputs in refs so the tick-driven effect reads current values
  // without re-running on every individual snapshot refetch.
  const inputsRef = useRef(inputs)
  inputsRef.current = inputs
  const prevRef = useRef<CounterSnapshot | null>(null)
  const latencyWindowRef = useRef<number[]>([])
  const lastHealthTickRef = useRef(0)

  // Clear the accumulated series and baselines when the reset key (time range)
  // changes, so a new range starts fresh rather than diffing against stale counters.
  useEffect(() => {
    prevRef.current = null
    latencyWindowRef.current = []
    lastHealthTickRef.current = 0
    setBuckets([])
  }, [inputs.resetKey])

  useEffect(() => {
    const { metrics, info, health, keysCount, tick, healthTick } = inputsRef.current
    if (!metrics) return

    // Push a ping sample only when the health query actually refetched, so a faster
    // metrics cadence does not over-weight the same latency value in the window.
    if (health && Number.isFinite(health.latencyMs) && healthTick !== lastHealthTickRef.current) {
      lastHealthTickRef.current = healthTick
      latencyWindowRef.current.push(health.latencyMs)
      if (latencyWindowRef.current.length > LATENCY_WINDOW) latencyWindowRef.current.shift()
    }
    const sorted = [...latencyWindowRef.current].sort((a, b) => a - b)

    const commandstats = info?.['commandstats']
    const stats = info?.['stats']
    const memory = info?.['memory']
    const getCalls = sumCalls(commandstats, GET_CMDS)
    const setCalls = sumCalls(commandstats, SET_CMDS)
    const delCalls = sumCalls(commandstats, DEL_CMDS)

    const prev = prevRef.current
    const next: CounterSnapshot = {
      hits: metrics.totals.hits,
      misses: metrics.totals.misses,
      get: getCalls,
      set: setCalls,
      del: delCalls,
      at: tick,
    }
    prevRef.current = next

    // The first tick only seeds the baseline — a delta needs two samples.
    if (!prev) return
    const elapsed = Math.max(1, (next.at - prev.at) / 1_000)
    const rate = (current: number, before: number) =>
      Math.max(0, Math.round((current - before) / elapsed))

    const bucket: OverviewBucket = {
      t: next.at,
      hit: Math.max(0, next.hits - prev.hits),
      miss: Math.max(0, next.misses - prev.misses),
      get: rate(getCalls, prev.get),
      set: rate(setCalls, prev.set),
      del: rate(delCalls, prev.del),
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
      hitRate: metrics.totals.hitRate,
      opsTotal: metrics.instantaneousOpsPerSec,
      usedMemory: Number(memory?.['used_memory'] ?? 0),
      keysCount: keysCount ?? 0,
      expiredKeys: Number(stats?.['expired_keys'] ?? 0),
    }
    setBuckets((current) => [...current, bucket].slice(-MAX_BUCKETS))
  }, [inputs.tick])

  return buckets
}
