/**
 * @fileoverview Typed endpoint surface over the thin {@link api} transport.
 *
 * `lib/api-client.ts` is the generic, error-decoding `fetch` wrapper; this module
 * layers the dashboard's concrete REST contract on top of it — one typed function
 * per backend route, each returning the same `ApiResult<T>` discriminated union so
 * callers (the TanStack Query hooks) never throw on a structured API error.
 *
 * Keeping the route catalog here — rather than inlining paths in every hook — gives
 * the Observe pages a single source of truth for endpoint shapes that mirrors the
 * NestJS controllers (`admin`, `metrics`, `tenants`, and the Playground groups
 * `catalog`/`counters`/`collections`). Response interfaces are hand-mirrored from
 * the controllers' declared return types.
 *
 * @module lib/cache-api
 */

import { api, type ApiError, type ApiResult } from './api-client'

/**
 * An `Error` wrapper around a decoded {@link ApiError}.
 *
 * The transport returns a non-throwing `ApiResult`; mutations, however, need a
 * thrown value so TanStack Query routes it to `onError` (and skips `onSuccess`
 * invalidation). {@link unwrap} raises this so the original typed error — code,
 * message, status, details — survives on `.apiError` for severity-aware toasts.
 */
export class ApiRequestError extends Error {
  /**
   * @param apiError - The decoded error returned by the transport.
   */
  constructor(readonly apiError: ApiError) {
    super(apiError.message)
    this.name = 'ApiRequestError'
  }
}

/**
 * Unwrap an {@link ApiResult}, throwing an {@link ApiRequestError} on failure.
 *
 * Used by the write hooks so a structured API error becomes a rejected mutation;
 * read hooks keep the raw `ApiResult` so the UI can render the error inline.
 *
 * @typeParam T - The success payload type.
 * @param result - The transport result to unwrap.
 * @returns The success payload when `ok`.
 * @throws {ApiRequestError} When the result carries a decoded error.
 */
export function unwrap<T>(result: ApiResult<T>): T {
  if (!result.ok) throw new ApiRequestError(result.error)
  return result.data
}

/** Redis data types the demo domain exercises (the `KeyQuery.type` facet). */
export type CacheKeyType = 'string' | 'hash' | 'set'

/** SCAN (non-blocking, default) vs KEYS (O(N), dev-only) listing strategy. */
export type KeyListStrategy = 'scan' | 'keys'

/** Query parameters accepted by `GET /admin/keys` — mirrors the API `KeyQuery` DTO. */
export interface KeyListParams {
  /** Entity-group prefix (e.g. `product`); empty matches all prefixes. */
  prefix?: string
  /** Glob for the id segment (default `*`). */
  pattern?: string
  /** Scopes the match to `tenant:{id}:…`. */
  tenant?: string
  /** Redis data-type facet. */
  type?: CacheKeyType
  /** Restrict to keys that have (or lack) a TTL. */
  hasTtl?: boolean
  /** Listing strategy; `scan` is the safe default. */
  strategy?: KeyListStrategy
  /** Opaque SCAN cursor for the next page. */
  cursor?: string
  /** Page size hint (default 200, max 1000). */
  limit?: number
}

/** Response of `GET /admin/keys` — a page of fully-namespaced keys plus the cursor. */
export interface KeyListResponse {
  /** Fully-namespaced keys, e.g. `cache-example:product:42`. */
  keys: string[]
  /** Opaque next-page cursor, or `null` when the scan is exhausted. */
  cursor: string | null
  /** The strategy the server actually used. */
  strategy: KeyListStrategy
  /** Present only for `strategy=keys` — the blocking-command warning. */
  warning?: string
}

/** Response of `GET /admin/keys/:key` — a full single-key inspection. */
export interface KeyInspectResponse {
  /** The fully-namespaced key. */
  key: string
  /** Redis data type (`string` / `hash` / `set` / …). */
  type: string
  /** Decoded value (dispatched by type on the server). */
  value: unknown
  /** Raw stored string (string keys only; `null` otherwise). */
  raw: string | null
  /** TTL in seconds; `-1` persisted, `-2` missing. */
  ttl: number
  /** Per-key byte size via `MEMORY USAGE`. */
  memoryBytes: number
}

/** Sampled keyspace breakdown backing the Overview keyspace panels. */
export interface KeyspaceBreakdown {
  /** Key counts by Redis data type (sampled). */
  byType: { string: number; hash: number; set: number }
  /** Estimated memory bytes per entity prefix (sampled). */
  byPrefix: Array<{ prefix: string; bytes: number }>
  /** Split of sampled keys with vs without an active TTL. */
  expiry: { withTtl: number; noTtl: number }
}

/** Per-prefix hit/miss stats with a derived hit rate (from `GET /metrics`). */
export interface PrefixStats {
  /** Cache hits recorded for the prefix. */
  hits: number
  /** Cache misses recorded for the prefix. */
  misses: number
  /** Ratio of hits to total requests; `0` when no requests recorded. */
  hitRate: number
}

/** Response of `GET /metrics` — the in-process, app-level hit/miss snapshot. */
export interface MetricsSnapshot {
  /** Per-prefix stats keyed by `CacheKeyPrefix` (e.g. `product`). */
  prefixes: Record<string, PrefixStats>
  /** Aggregated totals across all prefixes. */
  totals: PrefixStats
  /** Sampled request rate over the last measurement window. */
  instantaneousOpsPerSec: number
  /** Disclaimer restating that these counters are app-level / in-process. */
  note: string
}

/** Parsed Redis `INFO`: `section → { field: value }`. */
export type RedisInfo = Record<string, Record<string, string>>

/** Response of `GET /health` — the status chip baseline. */
export interface HealthResponse {
  /** Overall health classification. */
  status: 'ok' | 'degraded'
  /** Round-trip `PING` latency in milliseconds. */
  latencyMs: number
}

/** A product as stored by the catalog/tenants demo domain. */
export interface Product {
  id: string
  name: string
  priceCents: number
  tags: string[]
  stock: number
}

/** Build the `GET /admin/keys` query string from typed params (omitting empties). */
function keyListQuery(params: KeyListParams): string {
  const search = new URLSearchParams()
  if (params.prefix) search.set('prefix', params.prefix)
  if (params.pattern) search.set('pattern', params.pattern)
  if (params.tenant) search.set('tenant', params.tenant)
  if (params.type) search.set('type', params.type)
  if (params.hasTtl) search.set('hasTtl', 'true')
  if (params.strategy) search.set('strategy', params.strategy)
  if (params.cursor) search.set('cursor', params.cursor)
  if (params.limit !== undefined) search.set('limit', String(params.limit))
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

/**
 * Encode a fully-namespaced key for use as a path segment.
 *
 * Keys contain `:` which `encodeURIComponent` escapes to `%3A`; the NestJS route
 * decodes it back, so the colon-delimited key reaches the controller intact.
 *
 * @param key - The fully-namespaced key (e.g. `cache-example:product:42`).
 * @returns The percent-encoded path segment.
 */
function encodeKey(key: string): string {
  return encodeURIComponent(key)
}

/** Typed Cache Admin API endpoints (`/admin/*`, `/metrics`, `/health`). */
export const cacheApi = {
  /**
   * List a page of namespaced keys via the SCAN (default) or KEYS strategy.
   *
   * @param params - Filter + pagination parameters mirroring the `KeyQuery` DTO.
   * @returns The page of keys plus the next cursor (and a warning for `keys`).
   */
  listKeys: (params: KeyListParams): Promise<ApiResult<KeyListResponse>> =>
    api.get<KeyListResponse>(`/admin/keys${keyListQuery(params)}`),

  /**
   * Inspect one fully-namespaced key (value, raw string, TTL, byte size).
   *
   * @param key - The fully-namespaced key to inspect.
   * @returns The decoded value plus metadata, or a typed error.
   */
  inspectKey: (key: string): Promise<ApiResult<KeyInspectResponse>> =>
    api.get<KeyInspectResponse>(`/admin/keys/${encodeKey(key)}`),

  /**
   * Delete one fully-namespaced key.
   *
   * @param key - The fully-namespaced key to delete.
   * @returns `{ deleted }` — `0` when the key did not exist.
   */
  deleteKey: (key: string): Promise<ApiResult<{ deleted: number }>> =>
    api.del<{ deleted: number }>(`/admin/keys/${encodeKey(key)}`),

  /**
   * Remove a key's TTL, making it persistent.
   *
   * @param key - The fully-namespaced key to persist.
   * @returns `{ ttl: -1 }`.
   */
  persistKey: (key: string): Promise<ApiResult<{ ttl: number }>> =>
    api.post<{ ttl: number }>(`/admin/keys/${encodeKey(key)}/persist`),

  /**
   * Set a new TTL on a key.
   *
   * @param key - The fully-namespaced key to expire.
   * @param seconds - The new TTL in seconds (positive integer).
   * @returns `{ ttl }` — the TTL that was set.
   */
  expireKey: (key: string, seconds: number): Promise<ApiResult<{ ttl: number }>> =>
    api.post<{ ttl: number }>(`/admin/keys/${encodeKey(key)}/expire`, { seconds }),

  /**
   * Bulk-seed demo product keys via the server-side `pipeline()`.
   *
   * @param count - Number of demo product keys to write.
   * @returns `{ seeded }` — the count actually written.
   */
  seed: (count: number): Promise<ApiResult<{ seeded: number }>> =>
    api.post<{ seeded: number }>(`/admin/seed?count=${count}`),

  /**
   * Flush every key in the `cache-example:` namespace (guarded in production).
   *
   * @returns `{ flushed }` on success, or a typed `403`/cluster error.
   */
  flushNamespace: (): Promise<ApiResult<{ flushed: number }>> =>
    api.del<{ flushed: number }>('/admin/namespace'),

  /**
   * Read parsed Redis `INFO`, optionally restricted to one section.
   *
   * @param section - Optional INFO section (e.g. `memory`, `stats`).
   * @returns The parsed `section → field/value` record.
   */
  getInfo: (section?: string): Promise<ApiResult<RedisInfo>> =>
    api.get<RedisInfo>(
      section ? `/admin/info?section=${encodeURIComponent(section)}` : '/admin/info',
    ),

  /**
   * Read the sampled keyspace breakdown for the Overview panels.
   *
   * @returns `{ byType, byPrefix, expiry }`.
   */
  getKeyspace: (): Promise<ApiResult<KeyspaceBreakdown>> =>
    api.get<KeyspaceBreakdown>('/admin/keyspace'),

  /**
   * Read the in-process metrics snapshot (per-prefix hit/miss + ops/sec).
   *
   * @returns The {@link MetricsSnapshot}.
   */
  getMetrics: (): Promise<ApiResult<MetricsSnapshot>> => api.get<MetricsSnapshot>('/metrics'),

  /**
   * Read the health snapshot (status + ping latency).
   *
   * @returns The {@link HealthResponse}.
   */
  getHealth: (): Promise<ApiResult<HealthResponse>> => api.get<HealthResponse>('/health'),
}

/** Typed Tenants API endpoints (`/tenants/*`) — prefix isolation + flush proof. */
export const tenantsApi = {
  /**
   * Clear one tenant's keys via the server-side `scan` → `delMany`.
   *
   * @param tenant - The tenant id whose keys should be cleared.
   * @returns `{ tenant, scannedKeys, deleted }`.
   */
  clearTenant: (
    tenant: string,
  ): Promise<ApiResult<{ tenant: string; scannedKeys: number; deleted: number }>> =>
    api.del<{ tenant: string; scannedKeys: number; deleted: number }>(
      `/tenants/${encodeURIComponent(tenant)}/cache`,
    ),

  /**
   * Tenant-scoped product read-through — populates `tenant:{t}:product:{id}`.
   *
   * Used by the Tenants page to seed per-tenant keys (a cache miss caches the
   * value; the `source` field reveals hit vs miss).
   *
   * @param tenant - The tenant id.
   * @param id - The product id to read through.
   * @returns `{ data, source }` where `source` is `cache` or `origin`.
   */
  getProduct: (
    tenant: string,
    id: string,
  ): Promise<ApiResult<{ data: Product; source: 'cache' | 'origin' }>> =>
    api.get<{ data: Product; source: 'cache' | 'origin' }>(
      `/tenants/${encodeURIComponent(tenant)}/products/${encodeURIComponent(id)}`,
    ),

  /**
   * Seed the foreign-namespace key `other-app:demo` via the raw client.
   *
   * The documented anti-pattern that proves `flushNamespace()` leaves keys
   * outside `cache-example:*` intact.
   *
   * @returns `{ key, written }`.
   */
  seedForeign: (): Promise<ApiResult<{ key: string; written: true }>> =>
    api.post<{ key: string; written: true }>('/tenants/seed-foreign'),

  /**
   * Flush the namespace then assert the foreign key survived.
   *
   * @returns `{ flushedNamespaceKeys, foreignKeySurvived }`, or the guarded error.
   */
  proveIsolation: (): Promise<
    ApiResult<{ flushedNamespaceKeys: number; foreignKeySurvived: boolean }>
  > =>
    api.post<{ flushedNamespaceKeys: number; foreignKeySurvived: boolean }>(
      '/tenants/prove-isolation',
    ),
}
