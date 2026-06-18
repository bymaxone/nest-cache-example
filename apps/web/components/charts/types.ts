/**
 * @fileoverview Shared series-point types for the Observe charts. The chart
 * components are pure and presentational — they receive these already-bucketed
 * shapes from the pages (which accumulate them from the polled snapshots), keeping
 * the bounded-dimension rule intact (group by type/prefix, never per-key).
 *
 * @module components/charts/types
 */

/** One time bucket of cache hit/miss counts. */
export interface HitMissPoint {
  /** Bucket timestamp (epoch ms). */
  t: number
  /** Hits recorded in the bucket. */
  hit: number
  /** Misses recorded in the bucket. */
  miss: number
}

/** One time bucket of per-command throughput (ops/sec). */
export interface OpsPoint {
  /** Bucket timestamp (epoch ms). */
  t: number
  /** GET-family ops/sec. */
  get: number
  /** SET-family ops/sec. */
  set: number
  /** DEL-family ops/sec. */
  del: number
}

/** One time bucket of command-latency percentiles, in milliseconds. */
export interface LatencyPoint {
  /** Bucket timestamp (epoch ms). */
  t: number
  /** 50th-percentile latency (ms). */
  p50: number
  /** 95th-percentile latency (ms). */
  p95: number
  /** 99th-percentile latency (ms). */
  p99: number
}

/** A keys-by-type datum (bounded dimension). */
export interface TypeDatum {
  /** The Redis data type. */
  type: 'string' | 'hash' | 'set'
  /** Number of keys of this type (sampled). */
  count: number
}

/** A memory-by-prefix datum (bounded dimension). */
export interface PrefixDatum {
  /** The entity prefix (e.g. `product`). */
  prefix: string
  /** Estimated memory bytes for the prefix (sampled). */
  bytes: number
}
