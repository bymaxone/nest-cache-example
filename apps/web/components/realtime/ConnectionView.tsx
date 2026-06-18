/**
 * @fileoverview `ConnectionView` — the interactive body of the Connection &
 * Topology page (DASHBOARD §14). It surfaces the library's connection lifecycle
 * and the Redis-server view: a `CacheConnectionStatus` badge (color + icon + text)
 * with `ping` latency + mode, a lifecycle {@link EventFeed} of `cache:connection`
 * events styled by the status palette, a mode selector documenting the active
 * `CACHE_MODE`, and an `INFO` section viewer rendering parsed `info(section)` as a
 * mono key/value grid. Live data reads the shared {@link useCacheSocket} buffer;
 * `INFO` reads via TanStack Query.
 *
 * @module components/realtime/ConnectionView
 */

'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useQueryState } from 'nuqs'
import { type CacheConnectionStatus, type CacheEventName } from '@bymax-one/nest-cache/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EventFeed } from './EventFeed'
import { useCacheSocket } from '@/hooks/use-cache-socket'
import { useInfo } from '@/hooks/use-info'
import { cacheApi, type HealthResponse } from '@/lib/cache-api'
import { liveParser } from '@/lib/filters'
import { type CacheEvent } from '@/lib/socket'
import {
  connectionStatusMeta,
  eventToConnectionState,
  type ConnectionState,
} from '@/lib/cache-status'
import { formatClock, formatLatencyMs } from '@/lib/format'
import { cn } from '@/lib/utils'

/** A `cache:connection` item from the live socket buffer. */
type ConnectionEvent = Extract<CacheEvent, { kind: 'connection' }>

/** The INFO sections the viewer offers (DASHBOARD §14). */
const INFO_SECTIONS = ['server', 'clients', 'memory', 'stats', 'replication'] as const

/** A single INFO section name. */
type InfoSection = (typeof INFO_SECTIONS)[number]

/** The connection topologies the library supports. */
const MODES: readonly { mode: string; summary: string }[] = [
  { mode: 'standalone', summary: 'Default. Admin ops (scan, flushNamespace, getClient) succeed.' },
  { mode: 'sentinel', summary: 'High availability via a sentinel quorum; same API surface.' },
  {
    mode: 'cluster',
    summary: 'Sharded. scan / flushNamespace / getClient throw UNSUPPORTED_IN_CLUSTER.',
  },
]

/** The connection topologies surfaced via the live feed's `data.mode`. */
const TOPOLOGY_MODES = new Set<string>(['standalone', 'sentinel', 'cluster'])

/** How often to re-poll `/health` for the baseline status, in milliseconds. */
const HEALTH_REFETCH_INTERVAL_MS = 10_000

/** Narrow an arbitrary `Select` value to a known {@link InfoSection}. */
function isInfoSection(value: string): value is InfoSection {
  return (INFO_SECTIONS as readonly string[]).includes(value)
}

/**
 * The Connection & Topology page body.
 *
 * @returns The status badge, mode selector, INFO viewer, and lifecycle feed.
 */
export function ConnectionView() {
  const [live] = useQueryState('live', liveParser)
  const buffer = useCacheSocket(live)
  const [section, setSection] = useState<InfoSection>('memory')

  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => cacheApi.getHealth(),
    refetchInterval: HEALTH_REFETCH_INTERVAL_MS,
  })
  const info = useInfo(section)

  // All connection lifecycle events (oldest-first); the latest drives the badge.
  const connectionEvents = buffer
    .toArray()
    .filter((event): event is ConnectionEvent => event.kind === 'connection')
  const latest =
    connectionEvents.length > 0 ? connectionEvents[connectionEvents.length - 1] : undefined

  // The lifecycle event name is the library's `CacheEventName` (from `/shared`).
  const latestEvent: CacheEventName | undefined = latest?.event
  const liveState: ConnectionState | undefined = latestEvent
    ? eventToConnectionState(latestEvent)
    : undefined
  const rawLatency = latest?.data['latencyMs']
  const liveLatency = typeof rawLatency === 'number' ? rawLatency : undefined
  const rawMode = latest?.data['mode']
  const liveMode = typeof rawMode === 'string' && TOPOLOGY_MODES.has(rawMode) ? rawMode : undefined

  const healthData: HealthResponse | undefined = health.data?.ok ? health.data.data : undefined
  const healthState: ConnectionState | undefined =
    health.data === undefined
      ? undefined
      : !health.data.ok || health.data.data.status === 'degraded'
        ? 'error'
        : 'ready'
  // The baseline before any signal is the library's `connecting` `CacheConnectionStatus`.
  const defaultStatus: CacheConnectionStatus = 'connecting'
  const state: ConnectionState = liveState ?? healthState ?? defaultStatus
  const meta = connectionStatusMeta(state)
  const StatusIcon = meta.icon
  const latencyMs = liveLatency ?? healthData?.latencyMs
  const activeMode = liveMode ?? 'standalone'

  const infoSections = info.data?.ok ? Object.entries(info.data.data) : []

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader accent>
            <CardTitle className="text-base">Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <StatusIcon aria-hidden="true" className="h-5 w-5" style={{ color: meta.color }} />
              <span className="font-mono text-xl font-bold" style={{ color: meta.color }}>
                {meta.label}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  ping latency
                </dt>
                <dd className="font-mono">
                  {typeof latencyMs === 'number' ? formatLatencyMs(latencyMs) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">mode</dt>
                <dd className="font-mono">{activeMode}</dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground">
              Enable the <span className="text-foreground">Live</span> toggle to correct this badge
              in real time from the lifecycle feed.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader accent>
            <CardTitle className="text-base">Mode</CardTitle>
            <p className="font-mono text-xs text-muted-foreground">
              CACHE_MODE · active: {activeMode}
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {MODES.map((entry) => (
              <div
                key={entry.mode}
                className={cn(
                  'rounded-lg border border-(--glass-border) bg-(--glass-bg) p-2.5',
                  entry.mode === activeMode && 'ring-1 ring-brand-500/40',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold">{entry.mode}</span>
                  {entry.mode === activeMode ? (
                    <span className="text-[10px] text-brand-500">active</span>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">{entry.summary}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader accent className="flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">INFO</CardTitle>
          <Select
            value={section}
            onValueChange={(value) => {
              if (isInfoSection(value)) setSection(value)
            }}
          >
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="Section" />
            </SelectTrigger>
            <SelectContent>
              {INFO_SECTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {info.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : infoSections.length === 0 ? (
            <div className="flex min-h-32 items-center justify-center rounded-2xl border border-(--glass-border) bg-(--glass-bg) p-6 text-center text-sm text-muted-foreground">
              No INFO returned for this section.
            </div>
          ) : (
            <div className="space-y-4">
              {infoSections.map(([sectionName, fields]) => (
                <div key={sectionName} className="space-y-1.5">
                  <p className="font-mono text-xs uppercase tracking-wide text-brand-500">
                    {sectionName}
                  </p>
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                    {Object.entries(fields).map(([field, value]) => (
                      <div key={field} className="flex justify-between gap-3 font-mono text-xs">
                        <dt className="truncate text-muted-foreground" title={field}>
                          {field}
                        </dt>
                        <dd className="shrink-0 text-foreground">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader accent>
          <CardTitle className="text-base">Lifecycle events</CardTitle>
          <p className="font-mono text-xs text-muted-foreground">cache:connection</p>
        </CardHeader>
        <CardContent>
          <EventFeed<ConnectionEvent>
            items={connectionEvents.slice().reverse()}
            ariaLabel="Live connection lifecycle feed"
            getKey={(event) => String(event.seq)}
            emptyState={
              <span>
                No lifecycle events yet — enable the <span className="text-foreground">Live</span>{' '}
                toggle; reconnect Redis to see connect / ready rows →
              </span>
            }
            renderRow={(event) => {
              const rowState = eventToConnectionState(event.event)
              const rowMeta = connectionStatusMeta(rowState)
              const RowIcon = rowMeta.icon
              return (
                <div className="flex items-center gap-3 px-3 py-2 text-xs">
                  <span className="shrink-0 font-mono text-muted-foreground">
                    {formatClock(event.at)}
                  </span>
                  <span
                    className="inline-flex shrink-0 items-center gap-1 font-mono"
                    style={{ color: rowMeta.color }}
                  >
                    <RowIcon aria-hidden="true" className="h-3.5 w-3.5" />
                    {event.event}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-muted-foreground">
                    {JSON.stringify(event.data)}
                  </span>
                </div>
              )
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
