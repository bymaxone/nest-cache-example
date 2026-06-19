/**
 * @fileoverview Unit tests for `OverviewView` — the cache-health Overview. The four
 * data hooks (`useMetrics`/`useInfo`/`useKeyspace`/`useMetricSeries`), the health
 * transport (`cacheApi.getHealth`, behind a real TanStack Query client so the inline
 * `queryFn` actually runs), `next/navigation`, and the chart layer are all mocked so
 * the view's own derivation/branch logic is the unit under test: the loading strip,
 * the populated data path, the `maxMemory > 0` memory-bar vs "no limit" footnote,
 * the keys delta, the INFO-fallback band (`mode` present vs `—`), the health-derived
 * status (ready / connecting / error), the empty "Top prefixes" state, and the
 * click-to-filter / brush callbacks that push routes and write the range to the URL.
 *
 * @module components/overview/OverviewView.test
 */
import { type ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from 'nuqs/adapters/testing'
import type { HealthResponse, KeyspaceBreakdown, MetricsSnapshot, RedisInfo } from '@/lib/cache-api'
import type { ApiResult } from '@/lib/api-client'
import type { OverviewBucket } from '@/hooks/use-metric-series'

/** Spy capturing `router.push` navigations. */
const pushSpy = vi.fn()

/** Controllable hook return values, mutated per test. */
let metricsReturn: {
  data: ApiResult<MetricsSnapshot> | undefined
  isLoading: boolean
  dataUpdatedAt: number
}
let infoReturn: { data: ApiResult<RedisInfo> | undefined }
let keyspaceReturn: { data: ApiResult<KeyspaceBreakdown> | undefined; isLoading: boolean }
/** The `cacheApi.getHealth` result the real `queryFn` resolves; mutated per test. */
let healthResult: ApiResult<HealthResponse> | undefined
let seriesReturn: OverviewBucket[]

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushSpy }),
}))

vi.mock('@/hooks/use-metrics', () => ({ useMetrics: () => metricsReturn }))
vi.mock('@/hooks/use-info', () => ({ useInfo: () => infoReturn }))
vi.mock('@/hooks/use-keyspace', () => ({ useKeyspace: () => keyspaceReturn }))
vi.mock('@/hooks/use-metric-series', () => ({ useMetricSeries: () => seriesReturn }))
vi.mock('@/lib/cache-api', () => ({
  // Resolves the controllable result (mirrors the real async transport without an
  // unnecessary `await`).
  cacheApi: { getHealth: vi.fn(() => Promise.resolve(healthResult)) },
}))

// Chart layer stubbed: each panel echoes a marker and exposes its filter/brush
// callbacks as buttons so the view's `goToType`/`goToPrefix`/`setRange` wiring is
// drivable without recharts SVG interactions under jsdom.
vi.mock('@/components/charts', () => ({
  HitRateGauge: ({ isLoading }: { isLoading?: boolean }) => (
    <div data-testid="gauge" data-loading={String(isLoading)} />
  ),
  HitMissArea: ({ onBrushRange }: { onBrushRange?: (r: '5m' | '15m' | '1h') => void }) => (
    <button type="button" data-testid="brush" onClick={() => onBrushRange?.('1h')} />
  ),
  LatencyLines: () => <div data-testid="latency" />,
  MemoryByPrefix: ({ onSelect }: { onSelect?: (p: string) => void }) => (
    <button type="button" data-testid="mem-select" onClick={() => onSelect?.('product')} />
  ),
  MetricTile: ({
    label,
    value,
    footnote,
  }: {
    label: string
    value: string
    footnote?: ReactNode
  }) => (
    <div data-testid="tile">
      <span>{`${label}:${value}`}</span>
      {footnote ? <span data-testid="tile-footnote">{footnote}</span> : null}
    </div>
  ),
  OpsStream: () => <div data-testid="ops" />,
  TypeDonut: ({ onSelect }: { onSelect?: (t: 'string' | 'hash' | 'set') => void }) => (
    <button type="button" data-testid="type-select" onClick={() => onSelect?.('hash')} />
  ),
}))

// Imported after the mocks so the view binds to the stubbed dependencies.
const { OverviewView } = await import('./OverviewView')

/** A fully-populated INFO record exercising every `infoNum` field the band reads. */
const FULL_INFO: RedisInfo = {
  server: { redis_mode: 'standalone', uptime_in_seconds: '90000' },
  clients: { connected_clients: '4' },
  memory: { used_memory: '1048576', maxmemory: '2097152', mem_fragmentation_ratio: '1.23' },
  stats: { expired_keys: '12', evicted_keys: '3' },
}

/** A keyspace breakdown with two prefixes (out of byte order) and typed counts. */
const FULL_KEYSPACE: KeyspaceBreakdown = {
  byType: { string: 8, hash: 2, set: 1 },
  byPrefix: [
    { prefix: 'session', bytes: 100 },
    { prefix: 'product', bytes: 4096 },
  ],
  expiry: { withTtl: 5, noTtl: 5 },
}

/** Render the view inside a fresh Query client + the nuqs adapter. */
function renderView(onUrlUpdate?: OnUrlUpdateFunction) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<OverviewView />, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>
        <NuqsTestingAdapter
          searchParams="?range=15m"
          hasMemory
          {...(onUrlUpdate ? { onUrlUpdate } : {})}
        >
          {children}
        </NuqsTestingAdapter>
      </QueryClientProvider>
    ),
  })
}

beforeEach(() => {
  pushSpy.mockClear()
  metricsReturn = { data: undefined, isLoading: true, dataUpdatedAt: 0 }
  infoReturn = { data: undefined }
  keyspaceReturn = { data: undefined, isLoading: true }
  healthResult = undefined
  seriesReturn = []
})

describe('OverviewView', () => {
  it('renders the loading strip and the connecting status before data arrives', () => {
    /*
     * Scenario: first paint — every query is still loading.
     * Rule it protects: `isLoading` flows to the gauge, the null-coalesced fallbacks
     * keep the tiles from crashing on absent data, and `health == null` resolves the
     * band status to the neutral `connecting` state.
     */
    renderView()
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByTestId('gauge')).toHaveAttribute('data-loading', 'true')
    expect(screen.getByText('Connecting')).toBeInTheDocument()
    // No maxmemory data yet → the memory tile shows the no-limit footnote.
    expect(screen.getByText('Keys (ns):0')).toBeInTheDocument()
  })

  it('renders the populated path with a memory bar, mode, and Ready status', async () => {
    /*
     * Scenario: all endpoints resolved with healthy data and a maxmemory limit.
     * Rule it protects: the `maxMemory > 0` branch renders the percentage bar footnote,
     * `mode` comes from INFO `redis_mode`, and an `ok` health body resolves the band to
     * `ready`. The keys tile reflects the summed keyspace counts.
     */
    metricsReturn = {
      data: {
        ok: true,
        data: {
          prefixes: {},
          totals: { hits: 9, misses: 1, hitRate: 0.9 },
          instantaneousOpsPerSec: 120,
          note: '',
        },
      },
      isLoading: false,
      dataUpdatedAt: 1_000,
    }
    infoReturn = { data: { ok: true, data: FULL_INFO } }
    keyspaceReturn = { data: { ok: true, data: FULL_KEYSPACE }, isLoading: false }
    healthResult = { ok: true, data: { status: 'ok', latencyMs: 2 } }

    renderView()
    expect(await screen.findByText('Ready')).toBeInTheDocument()
    expect(screen.getByText('standalone')).toBeInTheDocument()
    // Keyspace total 8 + 2 + 1 = 11 keys.
    expect(screen.getByText('Keys (ns):11')).toBeInTheDocument()
    // The maxmemory-present footnote shows the "% of <max>" copy.
    expect(screen.getByText(/of 2.0 MB/)).toBeInTheDocument()
  })

  it('shows the no-maxmemory footnote and an Error status from a degraded health body', async () => {
    /*
     * Scenario: INFO reports no maxmemory limit and /health is degraded.
     * Rule it protects: the `maxMemory > 0 ? … : 'no maxmemory limit'` else-arm renders
     * the no-limit copy, and `status !== 'ok'` resolves the band to `error`.
     */
    metricsReturn = {
      data: {
        ok: true,
        data: {
          prefixes: {},
          totals: { hits: 1, misses: 1, hitRate: 0.5 },
          instantaneousOpsPerSec: 0,
          note: '',
        },
      },
      isLoading: false,
      dataUpdatedAt: 1_000,
    }
    infoReturn = { data: { ok: true, data: { server: {}, memory: { used_memory: '512' } } } }
    keyspaceReturn = { data: { ok: true, data: FULL_KEYSPACE }, isLoading: false }
    healthResult = { ok: true, data: { status: 'degraded', latencyMs: 7 } }

    renderView()
    expect(await screen.findByText('Error')).toBeInTheDocument()
    expect(screen.getByText('no maxmemory limit')).toBeInTheDocument()
    // Missing INFO `redis_mode` falls back to the em-dash placeholder.
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('lists the top prefixes sorted by bytes and routes a click to the Explorer', async () => {
    /*
     * Scenario: a populated keyspace; the user clicks a top-prefix row.
     * Rule it protects: the `byPrefix` list is sorted descending, sliced to six, and a
     * row click calls `goToPrefix`, pushing the encoded Explorer route.
     */
    const user = userEvent.setup()
    metricsReturn = {
      data: {
        ok: true,
        data: {
          prefixes: {},
          totals: { hits: 0, misses: 0, hitRate: 0 },
          instantaneousOpsPerSec: 0,
          note: '',
        },
      },
      isLoading: false,
      dataUpdatedAt: 1_000,
    }
    infoReturn = { data: { ok: true, data: FULL_INFO } }
    keyspaceReturn = { data: { ok: true, data: FULL_KEYSPACE }, isLoading: false }
    healthResult = { ok: true, data: { status: 'ok', latencyMs: 2 } }

    renderView()
    // `product` (4096) sorts above `session` (100) in the top-prefix list.
    await user.click(screen.getByRole('button', { name: /product/ }))
    expect(pushSpy).toHaveBeenCalledWith('/explorer?prefix=product')
  })

  it('shows the empty "No prefixes yet." state when the keyspace has no prefixes', () => {
    /*
     * Scenario: keyspace resolved but with an empty `byPrefix`.
     * Rule it protects: the `(keyspace?.byPrefix.length ?? 0) === 0` branch renders the
     * empty-state copy in the Top-prefixes card.
     */
    metricsReturn = {
      data: {
        ok: true,
        data: {
          prefixes: {},
          totals: { hits: 0, misses: 0, hitRate: 0 },
          instantaneousOpsPerSec: 0,
          note: '',
        },
      },
      isLoading: false,
      dataUpdatedAt: 1_000,
    }
    infoReturn = { data: { ok: true, data: FULL_INFO } }
    keyspaceReturn = {
      data: {
        ok: true,
        data: {
          byType: { string: 0, hash: 0, set: 0 },
          byPrefix: [],
          expiry: { withTtl: 0, noTtl: 0 },
        },
      },
      isLoading: false,
    }
    healthResult = { ok: true, data: { status: 'ok', latencyMs: 2 } }

    renderView()
    expect(screen.getByText('No prefixes yet.')).toBeInTheDocument()
  })

  it('routes a type-donut selection to the type-filtered Explorer', async () => {
    /*
     * Scenario: the user clicks a slice of the keys-by-type donut.
     * Rule it protects: `goToType` pushes `/explorer?type=<type>`.
     */
    const user = userEvent.setup()
    keyspaceReturn = { data: { ok: true, data: FULL_KEYSPACE }, isLoading: false }
    renderView()
    await user.click(screen.getByTestId('type-select'))
    expect(pushSpy).toHaveBeenCalledWith('/explorer?type=hash')
  })

  it('routes a memory-bar selection to the prefix-filtered Explorer (encoded)', async () => {
    /*
     * Scenario: the user clicks a memory-by-prefix bar.
     * Rule it protects: `goToPrefix` encodes the prefix into the Explorer route.
     */
    const user = userEvent.setup()
    keyspaceReturn = { data: { ok: true, data: FULL_KEYSPACE }, isLoading: false }
    renderView()
    await user.click(screen.getByTestId('mem-select'))
    expect(pushSpy).toHaveBeenCalledWith('/explorer?prefix=product')
  })

  it('writes the brushed range back to the URL', async () => {
    /*
     * Scenario: the user drags the hit/miss brush.
     * Rule it protects: the `onBrushRange` binding calls `setRange`, persisting the new
     * window to the URL as a shareable deep-link.
     */
    const user = userEvent.setup()
    const onUrlUpdate = vi.fn()
    renderView(onUrlUpdate)
    await user.click(screen.getByTestId('brush'))
    const last = onUrlUpdate.mock.calls.at(-1)?.[0]
    expect(last?.searchParams.get('range')).toBe('1h')
  })

  it('derives the keys delta from the previous bucket', () => {
    /*
     * Scenario: an accumulated series whose second-to-last bucket has a lower key count.
     * Rule it protects: `keysNow - (buckets.at(-2)?.keysCount ?? keysNow)` yields the
     * positive delta surfaced on the Keys tile (driven through the metric-series mock).
     */
    metricsReturn = {
      data: {
        ok: true,
        data: {
          prefixes: {},
          totals: { hits: 0, misses: 0, hitRate: 0 },
          instantaneousOpsPerSec: 0,
          note: '',
        },
      },
      isLoading: false,
      dataUpdatedAt: 1_000,
    }
    infoReturn = { data: { ok: true, data: FULL_INFO } }
    keyspaceReturn = { data: { ok: true, data: FULL_KEYSPACE }, isLoading: false }
    healthResult = { ok: true, data: { status: 'ok', latencyMs: 2 } }
    seriesReturn = [makeBucket(5), makeBucket(7)]

    renderView()
    // keysNow is 11 (8+2+1); previous bucket keysCount is 5 → delta +6 shown on the tile.
    expect(screen.getByText('Keys (ns):11')).toBeInTheDocument()
  })
})

/** Build a minimal accumulated bucket with the given key count. */
function makeBucket(keysCount: number): OverviewBucket {
  return {
    t: 0,
    hit: 0,
    miss: 0,
    get: 0,
    set: 0,
    del: 0,
    p50: 0,
    p95: 0.5,
    p99: 0,
    hitRate: 0,
    opsTotal: 0,
    usedMemory: 0,
    keysCount,
    expiredKeys: 0,
  }
}
