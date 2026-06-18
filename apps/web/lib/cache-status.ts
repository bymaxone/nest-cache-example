/**
 * @fileoverview Accessible status/severity mappings — color **+ icon + text**,
 * never color alone. Maps the library's `CacheConnectionStatus` (plus the
 * `error`/`end` lifecycle events), cache hit/miss, and Redis data types to a
 * `{ color, icon, label }` triple consumed by the status surfaces.
 *
 * `CacheConnectionStatus`/`CacheEventName` come from the zero-dependency
 * `@bymax-one/nest-cache/shared` subpath, keeping the browser bundle library-clean.
 *
 * @module lib/cache-status
 */

import { type CacheConnectionStatus, type CacheEventName } from '@bymax-one/nest-cache/shared'
import {
  AlertTriangle,
  Braces,
  CheckCircle2,
  Hash,
  Loader2,
  RefreshCw,
  Type,
  XCircle,
  type LucideIcon,
} from 'lucide-react'

/** A presentational status descriptor: a hex color, a lucide icon, and a text label. */
export interface StatusMeta {
  /** Hex color for the dot/icon/border accent. */
  color: string
  /** Lucide icon shown beside the label. */
  icon: LucideIcon
  /** Always-visible text label (so status never relies on color alone). */
  label: string
}

/**
 * The display states for a connection: the four library `CacheConnectionStatus`
 * values plus the `error`/`end` lifecycle events surfaced by the socket feed.
 */
export type ConnectionState = CacheConnectionStatus | Extract<CacheEventName, 'error' | 'end'>

const CONNECTION_STATUS_META: Record<ConnectionState, StatusMeta> = {
  connecting: { color: '#60a5fa', icon: Loader2, label: 'Connecting' },
  ready: { color: '#22c55e', icon: CheckCircle2, label: 'Ready' },
  reconnecting: { color: '#f59e0b', icon: RefreshCw, label: 'Reconnecting' },
  closed: { color: '#ef4444', icon: XCircle, label: 'Closed' },
  end: { color: '#ef4444', icon: XCircle, label: 'Ended' },
  error: { color: '#a855f7', icon: AlertTriangle, label: 'Error' },
}

/**
 * Resolve the accessible descriptor for a connection state.
 *
 * @param status - The connection display state.
 * @returns Its `{ color, icon, label }` descriptor.
 */
export function connectionStatusMeta(status: ConnectionState): StatusMeta {
  return CONNECTION_STATUS_META[status]
}

/**
 * Resolve the accessible severity descriptor for an HTTP error status.
 *
 * Follows the design-system error palette: `504` purple (gateway timeout),
 * other `5xx` red (server error), `4xx` amber (client error), anything else blue.
 *
 * @param status - The HTTP status code of the failing response.
 * @returns Its `{ color, icon, label }` descriptor.
 */
export function httpErrorSeverityMeta(status: number): StatusMeta {
  if (status === 504) return { color: '#a855f7', icon: AlertTriangle, label: 'Gateway Timeout' }
  if (status >= 500) return { color: '#ef4444', icon: XCircle, label: 'Server Error' }
  if (status >= 400) return { color: '#f59e0b', icon: AlertTriangle, label: 'Client Error' }
  return { color: '#60a5fa', icon: AlertTriangle, label: 'Notice' }
}

/** Cache lookup outcome. */
export type HitMiss = 'hit' | 'miss'

const HIT_MISS_META: Record<HitMiss, StatusMeta> = {
  hit: { color: '#22c55e', icon: CheckCircle2, label: 'Hit' },
  miss: { color: '#f59e0b', icon: XCircle, label: 'Miss' },
}

/**
 * Resolve the accessible descriptor for a cache hit/miss outcome.
 *
 * @param value - `'hit'` or `'miss'`.
 * @returns Its `{ color, icon, label }` descriptor.
 */
export function hitMissMeta(value: HitMiss): StatusMeta {
  return HIT_MISS_META[value]
}

/** The Redis data types the demo domain exercises. */
export type CacheDataType = 'string' | 'hash' | 'set'

const DATA_TYPE_META: Record<CacheDataType, StatusMeta> = {
  string: { color: '#60a5fa', icon: Type, label: 'String' },
  hash: { color: '#a855f7', icon: Hash, label: 'Hash' },
  set: { color: '#22c55e', icon: Braces, label: 'Set' },
}

/**
 * Resolve the accessible descriptor for a Redis data type.
 *
 * @param value - `'string'`, `'hash'`, or `'set'`.
 * @returns Its `{ color, icon, label }` descriptor.
 */
export function dataTypeMeta(value: CacheDataType): StatusMeta {
  return DATA_TYPE_META[value]
}

/**
 * Map a raw connection lifecycle event to its display {@link ConnectionState}.
 *
 * @param event - A `CacheEventName` from the `cache:connection` feed.
 * @returns The corresponding display state.
 */
export function eventToConnectionState(event: CacheEventName): ConnectionState {
  switch (event) {
    case 'ready':
      return 'ready'
    case 'connect':
      return 'connecting'
    case 'reconnecting':
      return 'reconnecting'
    case 'close':
      return 'closed'
    case 'end':
      return 'end'
    case 'error':
      return 'error'
  }
}
