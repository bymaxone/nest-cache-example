/**
 * @fileoverview `OverviewView` — the cache-health Overview, laid out general →
 * specific per DASHBOARD §5: a golden-signal health strip, the signature brushable
 * hit/miss area, a throughput + latency row, the bounded-dimension keyspace
 * breakdown (click-to-filter into the Explorer), and an INFO-sourced connection /
 * pipeline health band. Every panel is fed by the server endpoints (`/metrics`,
 * `/admin/info`, `/admin/keyspace`, `/health`) — the browser never SCANs for a chart.
 *
 * @module components/overview/OverviewView
 */

'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useQueryState } from 'nuqs'
import { Activity, Boxes, Clock, Database, Gauge } from 'lucide-react'
import {
  HitRateGauge,
  HitMissArea,
  LatencyLines,
  MemoryByPrefix,
  MetricTile,
  OpsStream,
  TypeDonut,
} from '@/components/charts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useMetrics } from '@/hooks/use-metrics'
import { useInfo } from '@/hooks/use-info'
import { useKeyspace } from '@/hooks/use-keyspace'
import { useMetricSeries } from '@/hooks/use-metric-series'
import { cacheApi, type CacheKeyType } from '@/lib/cache-api'
import { rangeParser } from '@/lib/filters'
import { connectionStatusMeta } from '@/lib/cache-status'
import {
  formatBytes,
  formatCount,
  formatLatencyMs,
  formatPercent,
  formatUptime,
} from '@/lib/format'

/** How often to re-poll `/health` for the latency window, in milliseconds. */
const HEALTH_REFETCH_INTERVAL_MS = 5_000

/** Read a numeric INFO field with a fallback. */
function infoNum(
  info: Record<string, Record<string, string>> | null,
  section: string,
  field: string,
): number {
  return Number(info?.[section]?.[field] ?? 0)
}

/** A single labelled stat in the connection/pipeline band. */
function BandStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-mono text-sm">{value}</p>
    </div>
  )
}

/** The Overview client view. */
export function OverviewView() {
  const router = useRouter()
  const [range, setRange] = useQueryState('range', rangeParser)

  const metricsQuery = useMetrics(range)
  const infoQuery = useInfo('everything')
  const keyspaceQuery = useKeyspace()
  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: () => cacheApi.getHealth(),
    refetchInterval: HEALTH_REFETCH_INTERVAL_MS,
  })

  const metrics = metricsQuery.data?.ok ? metricsQuery.data.data : null
  const info = infoQuery.data?.ok ? infoQuery.data.data : null
  const health = healthQuery.data?.ok ? healthQuery.data.data : null
  const keyspace = keyspaceQuery.data?.ok ? keyspaceQuery.data.data : null

  const keysCount = keyspace
    ? keyspace.byType.string + keyspace.byType.hash + keyspace.byType.set
    : null

  const buckets = useMetricSeries({
    metrics,
    info,
    health,
    keysCount,
    tick: metricsQuery.dataUpdatedAt,
    healthTick: healthQuery.dataUpdatedAt,
    resetKey: range,
  })

  const hitMissData = useMemo(
    () => buckets.map((b) => ({ t: b.t, hit: b.hit, miss: b.miss })),
    [buckets],
  )
  const opsData = useMemo(
    () => buckets.map((b) => ({ t: b.t, get: b.get, set: b.set, del: b.del })),
    [buckets],
  )
  const latencyData = useMemo(
    () => buckets.map((b) => ({ t: b.t, p50: b.p50, p95: b.p95, p99: b.p99 })),
    [buckets],
  )

  const isLoading = metricsQuery.isLoading
  const hitRate = metrics?.totals.hitRate ?? 0
  const opsNow = metrics?.instantaneousOpsPerSec ?? 0
  const latencyNow = buckets.at(-1)?.p95 ?? health?.latencyMs ?? 0
  const usedMemory = infoNum(info, 'memory', 'used_memory')
  const maxMemory = infoNum(info, 'memory', 'maxmemory')
  const memoryPct = maxMemory > 0 ? usedMemory / maxMemory : 0
  const keysNow = keysCount ?? 0
  const keysDelta = keysNow - (buckets.at(-2)?.keysCount ?? keysNow)
  const expiredNow = infoNum(info, 'stats', 'expired_keys')
  const evictedNow = infoNum(info, 'stats', 'evicted_keys')

  const typeData = keyspace
    ? [
        { type: 'string' as const, count: keyspace.byType.string },
        { type: 'hash' as const, count: keyspace.byType.hash },
        { type: 'set' as const, count: keyspace.byType.set },
      ]
    : []

  const status = health ? (health.status === 'ok' ? 'ready' : 'error') : 'connecting'
  const statusMeta = connectionStatusMeta(status)
  const mode = info?.['server']?.['redis_mode'] ?? '—'

  const goToType = (type: CacheKeyType) => router.push(`/explorer?type=${type}`)
  const goToPrefix = (prefix: string) =>
    router.push(`/explorer?prefix=${encodeURIComponent(prefix)}`)

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-mono text-2xl font-bold">Overview</h1>
        <p className="text-sm text-muted-foreground">Cache golden signals for the namespace.</p>
      </header>

      {/* Health strip — six golden-signal tiles. */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <HitRateGauge value={hitRate} isLoading={isLoading} />
        <MetricTile
          label="Throughput"
          icon={Activity}
          value={`${formatCount(opsNow)} op/s`}
          sparkline={buckets.map((b) => b.opsTotal)}
          isLoading={isLoading}
        />
        <MetricTile
          label="Latency p95"
          icon={Gauge}
          value={formatLatencyMs(latencyNow)}
          sparkline={buckets.map((b) => b.p95)}
          isLoading={isLoading}
          footnote="ping-sampled percentile"
        />
        <MetricTile
          label="Memory"
          icon={Database}
          value={formatBytes(usedMemory)}
          sparkline={buckets.map((b) => b.usedMemory)}
          isLoading={isLoading}
          footnote={
            maxMemory > 0 ? (
              <span className="block space-y-1">
                <span className="block">
                  {formatPercent(memoryPct)} of {formatBytes(maxMemory)}
                </span>
                <span className="block h-1.5 w-full overflow-hidden rounded-full bg-(--glass-bg-raised)">
                  <span
                    className="block h-full rounded-full bg-brand-500"
                    style={{ width: `${Math.min(100, memoryPct * 100)}%` }}
                  />
                </span>
              </span>
            ) : (
              'no maxmemory limit'
            )
          }
        />
        <MetricTile
          label="Keys (ns)"
          icon={Boxes}
          value={formatCount(keysNow)}
          delta={keysDelta}
          sparkline={buckets.map((b) => b.keysCount)}
          isLoading={isLoading}
          footnote="sampled, in namespace"
        />
        <MetricTile
          label="Expired"
          icon={Clock}
          value={formatCount(expiredNow)}
          sparkline={buckets.map((b) => b.expiredKeys)}
          isLoading={isLoading}
          footnote={`evicted ${formatCount(evictedNow)}`}
        />
      </section>

      {/* Signature hit/miss area — brushable, writes the time range to the URL. */}
      <HitMissArea
        data={hitMissData}
        isLoading={isLoading && buckets.length === 0}
        onBrushRange={(next) => void setRange(next)}
      />

      {/* Throughput & latency row. */}
      <section className="grid gap-5 lg:grid-cols-2">
        <OpsStream data={opsData} isLoading={isLoading && buckets.length === 0} />
        <LatencyLines data={latencyData} isLoading={isLoading && buckets.length === 0} />
      </section>

      {/* Keyspace breakdown — bounded dimensions, click-to-filter. */}
      <section className="grid gap-5 lg:grid-cols-3">
        <TypeDonut data={typeData} isLoading={keyspaceQuery.isLoading} onSelect={goToType} />
        <MemoryByPrefix
          data={keyspace?.byPrefix ?? []}
          isLoading={keyspaceQuery.isLoading}
          onSelect={goToPrefix}
        />
        <Card>
          <CardHeader accent>
            <CardTitle className="text-base">Top prefixes</CardTitle>
            <p className="text-xs text-muted-foreground">By sampled memory — click to filter.</p>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {(keyspace?.byPrefix ?? [])
              .slice()
              .sort((a, b) => b.bytes - a.bytes)
              .slice(0, 6)
              .map((entry) => (
                <button
                  key={entry.prefix}
                  type="button"
                  onClick={() => goToPrefix(entry.prefix)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-(--glass-bg-hover)"
                >
                  <span className="font-mono">{entry.prefix}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatBytes(entry.bytes)}
                  </span>
                </button>
              ))}
            {(keyspace?.byPrefix.length ?? 0) === 0 ? (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                No prefixes yet.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </section>

      {/* Connection & pipeline health band — sourced from INFO. */}
      <Card>
        <CardHeader accent className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Connection &amp; pipeline health</CardTitle>
          <span
            className="inline-flex items-center gap-1.5 text-sm font-medium"
            style={{ color: statusMeta.color }}
          >
            <statusMeta.icon aria-hidden="true" className="h-4 w-4" />
            {statusMeta.label}
          </span>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <BandStat label="Mode" value={mode} />
          <BandStat
            label="Uptime"
            value={formatUptime(infoNum(info, 'server', 'uptime_in_seconds'))}
          />
          <BandStat
            label="Clients"
            value={formatCount(infoNum(info, 'clients', 'connected_clients'))}
          />
          <BandStat
            label="Fragmentation"
            value={(infoNum(info, 'memory', 'mem_fragmentation_ratio') || 0).toFixed(2)}
          />
          <BandStat label="Evicted" value={formatCount(evictedNow)} />
          <BandStat label="Expired" value={formatCount(expiredNow)} />
        </CardContent>
      </Card>

      {/* Honest-scope callout — the two metric sources. */}
      <Card>
        <CardContent className="flex gap-3 p-4 text-sm text-muted-foreground">
          <span aria-hidden="true" className="text-lg">
            🎓
          </span>
          <p>
            Scoped demo of cache observability. Hit/miss here is tracked{' '}
            <span className="text-foreground">in-process per prefix</span> (reset on restart) for an
            exact per-prefix breakdown, cross-checked against Redis{' '}
            <span className="font-mono text-foreground">INFO stats</span>. A real deployment scrapes{' '}
            <span className="font-mono text-foreground">INFO</span> with Prometheus + Grafana or a
            managed-Redis metrics API.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
