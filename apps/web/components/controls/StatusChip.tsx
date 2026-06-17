/**
 * @fileoverview Connection status chip — accessible color + icon + text + latency
 * + mode. The status is sourced from the latest `cache:connection` event on the
 * live socket feed when Live is on, falling back to a polled `/health` query.
 * It defaults to a neutral "connecting" state until the first signal arrives.
 *
 * @module components/controls/StatusChip
 */

'use client'

import { useQuery } from '@tanstack/react-query'
import { useQueryState } from 'nuqs'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api-client'
import { liveParser } from '@/lib/filters'
import {
  connectionStatusMeta,
  eventToConnectionState,
  type ConnectionState,
} from '@/lib/cache-status'
import { useCacheSocket } from '@/hooks/use-cache-socket'
import { type CacheEvent } from '@/lib/socket'

/** How often to re-poll `/health` for the baseline status, in milliseconds. */
const HEALTH_REFETCH_INTERVAL_MS = 10_000

/** Shape of the API `GET /health` payload (matches `apps/api`'s health controller). */
interface HealthResponse {
  status: 'ok' | 'degraded'
  latencyMs: number
}

/** The connection topologies the library supports, surfaced via the live feed. */
const TOPOLOGY_MODES = new Set<string>(['standalone', 'sentinel', 'cluster'])

/** Live connection status chip with latency and topology mode. */
export function StatusChip() {
  const [live] = useQueryState('live', liveParser)
  const buffer = useCacheSocket(live)

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.get<HealthResponse>('/health'),
    refetchInterval: HEALTH_REFETCH_INTERVAL_MS,
  })

  // The most recent lifecycle event from the live feed wins over the polled /health.
  const lastConnection = buffer
    .toArray()
    .findLast((event): event is Extract<CacheEvent, { kind: 'connection' }> => {
      return event.kind === 'connection'
    })

  const liveState = lastConnection ? eventToConnectionState(lastConnection.event) : undefined
  const rawLatency = lastConnection?.data['latencyMs']
  const liveLatency = typeof rawLatency === 'number' ? rawLatency : undefined
  // Topology mode comes from the live connection feed (the API /health does not expose it).
  const rawMode = lastConnection?.data['mode']
  const mode = typeof rawMode === 'string' && TOPOLOGY_MODES.has(rawMode) ? rawMode : undefined

  const healthData = health?.ok ? health.data : undefined
  const latencyMs = liveLatency ?? healthData?.latencyMs

  // /health failure (unreachable) or a degraded body both read as an error state;
  // a healthy body reads ready. The live feed, when present, overrides this baseline.
  const healthState: ConnectionState | undefined =
    health === undefined
      ? undefined
      : !health.ok || health.data.status === 'degraded'
        ? 'error'
        : 'ready'
  const state: ConnectionState = liveState ?? healthState ?? 'connecting'
  const meta = connectionStatusMeta(state)
  const Icon = meta.icon
  const isSpinning = state === 'connecting' || state === 'reconnecting'

  return (
    <div className="inline-flex h-8 items-center gap-2 rounded-full border border-(--glass-border) bg-(--glass-bg) px-3 text-xs">
      <Icon
        aria-hidden="true"
        className={cn('h-3.5 w-3.5', isSpinning && 'animate-spin')}
        style={{ color: meta.color }}
      />
      <span className="font-medium" style={{ color: meta.color }}>
        {meta.label}
      </span>
      {typeof latencyMs === 'number' ? <span className="text-white/45">{latencyMs}ms</span> : null}
      {mode ? <span className="text-white/45">· {mode}</span> : null}
    </div>
  )
}
