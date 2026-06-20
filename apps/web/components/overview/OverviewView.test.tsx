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
  // Gauge echoes its numeric `value` and `isLoading` so the hit-rate derivation and the
  // loading flag are both observable from the DOM.
  HitRateGauge: ({ value, isLoading }: { value?: number; isLoading?: boolean }) => (
    <div data-testid="gauge" data-loading={String(isLoading)} data-value={String(value)} />
  ),
  // Hit/miss area exposes its brush callback plus the loading flag, the point count, and the
  // serialized data it was fed — so the brush wiring, the `isLoading && buckets.length === 0`
  // gate, the derived data length, AND the per-bucket `{ t, hit, miss }` point content are all
  // assertable (length alone hides a map arrow collapsed to `undefined` or an emptied point).
  HitMissArea: ({
    data,
    isLoading,
    onBrushRange,
  }: {
    data?: unknown[]
    isLoading?: boolean
    onBrushRange?: (r: '5m' | '15m' | '1h') => void
  }) => (
    <button
      type="button"
      data-testid="brush"
      data-loading={String(isLoading)}
      data-points={String(data?.length ?? 0)}
      data-content={JSON.stringify(data ?? [])}
      onClick={() => onBrushRange?.('1h')}
    />
  ),
  // Latency/Ops panels echo their loading flag, point count, and serialized data so the shared
  // `isLoading && buckets.length === 0` gate, the derived series length, and the per-bucket
  // point content (`{ t, p50, p95, p99 }` / `{ t, get, set, del }`) are all observable.
  LatencyLines: ({ data, isLoading }: { data?: unknown[]; isLoading?: boolean }) => (
    <div
      data-testid="latency"
      data-loading={String(isLoading)}
      data-points={String(data?.length ?? 0)}
      data-content={JSON.stringify(data ?? [])}
    />
  ),
  OpsStream: ({ data, isLoading }: { data?: unknown[]; isLoading?: boolean }) => (
    <div
      data-testid="ops"
      data-loading={String(isLoading)}
      data-points={String(data?.length ?? 0)}
      data-content={JSON.stringify(data ?? [])}
    />
  ),
  // Memory-by-prefix echoes its select callback, point count, and serialized data so the
  // panel's input ORDER (the defensive `.slice()` that protects it from the in-place sort in
  // the Top-prefixes card) is observable, not just its length.
  MemoryByPrefix: ({ data, onSelect }: { data?: unknown[]; onSelect?: (p: string) => void }) => (
    <button
      type="button"
      data-testid="mem-select"
      data-points={String(data?.length ?? 0)}
      data-content={JSON.stringify(data ?? [])}
      onClick={() => onSelect?.('product')}
    />
  ),
  // The tile echoes label, value, footnote, the signed `delta`, the loading flag, the length
  // of the sparkline series, AND its serialized values — so each derived quantity surfaces as
  // assertable text and a sparkline map arrow collapsed to `undefined` (same length, `[null]`
  // content) is detectable.
  MetricTile: ({
    label,
    value,
    footnote,
    delta,
    sparkline,
    isLoading,
  }: {
    label: string
    value: string
    footnote?: ReactNode
    delta?: number
    sparkline?: number[]
    isLoading?: boolean
  }) => (
    <div
      data-testid="tile"
      data-loading={String(isLoading)}
      data-spark={String(sparkline?.length ?? 0)}
      data-spark-content={JSON.stringify(sparkline ?? [])}
    >
      <span>{`${label}:${value}`}</span>
      {delta !== undefined ? <span data-testid="tile-delta">{`delta:${delta}`}</span> : null}
      {footnote ? <span data-testid="tile-footnote">{footnote}</span> : null}
    </div>
  ),
  // The donut echoes the per-type counts it was fed so the `typeData` derivation is
  // observable, and still exposes its select callback for the routing assertion.
  TypeDonut: ({
    data,
    onSelect,
  }: {
    data?: { type: string; count: number }[]
    onSelect?: (t: 'string' | 'hash' | 'set') => void
  }) => (
    <button
      type="button"
      data-testid="type-select"
      data-types={(data ?? []).map((d) => `${d.type}=${d.count}`).join(',')}
      onClick={() => onSelect?.('hash')}
    />
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
    // Absent keyspace → `keyspace?.byPrefix ?? []` yields an EMPTY array (not a sentinel),
    // so the memory-by-prefix panel receives zero points.
    expect(screen.getByTestId('mem-select')).toHaveAttribute('data-points', '0')
    // Absent keyspace → `typeData` is the empty else-arm (not a sentinel array), so the
    // donut receives no type slices.
    expect(screen.getByTestId('type-select')).toHaveAttribute('data-types', '')
    // The Top-prefixes list's `?? []` fallback is genuinely empty, so no prefix row (and
    // hence no bare "0 B" size label) is rendered — only the empty-state copy.
    expect(screen.getByText('No prefixes yet.')).toBeInTheDocument()
    expect(screen.queryByText('0 B')).toBeNull()
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
    // The maxmemory-present footnote shows the "% of <max>" copy. memoryPct =
    // used_memory(1048576) / maxmemory(2097152) = 0.5 → "50.0% of 2.0 MB".
    expect(screen.getByText(/50\.0% of 2\.0 MB/)).toBeInTheDocument()
    // Tile values are derived from the live data: instantaneousOpsPerSec → Throughput,
    // used_memory → Memory, the INFO stats → Expired (+ evicted footnote). A blanked
    // INFO section/field literal would collapse these to 0/0 B.
    expect(screen.getByText('Throughput:120 op/s')).toBeInTheDocument()
    expect(screen.getByText('Memory:1.0 MB')).toBeInTheDocument()
    expect(screen.getByText('Expired:12')).toBeInTheDocument()
    expect(screen.getByText('evicted 3')).toBeInTheDocument()
    // With empty buckets, latency falls back to the health body's latencyMs (2 → "2.00ms").
    expect(screen.getByText('Latency p95:2.00ms')).toBeInTheDocument()
    // The hit rate (0.9) flows verbatim to the gauge value.
    expect(screen.getByTestId('gauge')).toHaveAttribute('data-value', '0.9')
    // The keyspace counts flow to the type donut as string=8, hash=2, set=1.
    expect(screen.getByTestId('type-select')).toHaveAttribute('data-types', 'string=8,hash=2,set=1')
    // The two-prefix keyspace flows to the memory-by-prefix panel via `?? []`; a `&&`
    // swap would drop it to the empty fallback.
    expect(screen.getByTestId('mem-select')).toHaveAttribute('data-points', '2')
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
    // keysNow is 11 (8+2+1); previous bucket keysCount is 5 → delta = 11 - 5 = 6.
    expect(screen.getByText('Keys (ns):11')).toBeInTheDocument()
    // The Keys tile is the only tile fed a `delta`; its echoed value pins the exact
    // subtraction, the `buckets.at(-2)` index, and the `?? keysNow` fallback.
    expect(screen.getByText('delta:6')).toBeInTheDocument()
    // With a non-empty series, latency comes from the LAST bucket's p95 (0.5 → "0.500ms"),
    // not the health fallback — pinning `buckets.at(-1)?.p95` ahead of `health?.latencyMs`.
    expect(screen.getByText('Latency p95:0.500ms')).toBeInTheDocument()
  })

  it('reads the latency and keys-delta from the negative tail of the series', () => {
    /*
     * Scenario: a three-point series whose tail buckets carry distinct p95 and keysCount
     * so the negative indices `at(-1)` / `at(-2)` are distinguishable from their positive
     * counterparts.
     * Rule it protects: latency uses the LAST bucket's p95 via `buckets.at(-1)` and the
     * keys delta subtracts the SECOND-TO-LAST via `buckets.at(-2)`. Flipping `-1`→`+1` or
     * `-2`→`+2` would read the wrong end of the array and change both observed values.
     * Series p95: [0.111, 0.222, 0.999], keysCount: [3, 4, 9].
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
    seriesReturn = [makeBucket(3, 0.111), makeBucket(4, 0.222), makeBucket(9, 0.999)]

    renderView()
    // `at(-1)` is the last bucket → p95 0.999 → "0.999ms" (not at(+1)'s 0.222).
    expect(screen.getByText('Latency p95:0.999ms')).toBeInTheDocument()
    // keysNow 11; `at(-2)` is the second-to-last bucket (keysCount 4) → delta 11 - 4 = 7
    // (not at(+2)'s 9, which would give delta 2).
    expect(screen.getByText('delta:7')).toBeInTheDocument()
  })

  it('feeds the derived series and loading flags into every chart panel', () => {
    /*
     * Scenario: data resolved (metrics not loading) but with an accumulated three-point
     * series.
     * Rule it protects: `hitMissData`/`opsData`/`latencyData` are mapped from `buckets`
     * (so each chart receives three points), the sparkline tiles receive the same length,
     * and the `isLoading && buckets.length === 0` gate is false once buckets exist — so
     * the panels render in their loaded state. Blanking a `.map` or flipping the gate
     * would change the observed point count / loading flag.
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
    seriesReturn = [makeBucket(1), makeBucket(2), makeBucket(3)]

    renderView()
    // Each panel receives the three derived points.
    expect(screen.getByTestId('brush')).toHaveAttribute('data-points', '3')
    expect(screen.getByTestId('ops')).toHaveAttribute('data-points', '3')
    expect(screen.getByTestId('latency')).toHaveAttribute('data-points', '3')
    // Sparkline tiles get the same series length.
    expect(screen.getAllByTestId('tile')[0]).toHaveAttribute('data-spark', '3')
    // Buckets present → `isLoading && buckets.length === 0` is false; panels render loaded.
    expect(screen.getByTestId('brush')).toHaveAttribute('data-loading', 'false')
    expect(screen.getByTestId('ops')).toHaveAttribute('data-loading', 'false')
    expect(screen.getByTestId('latency')).toHaveAttribute('data-loading', 'false')
  })

  it('gates the signature panels into the loading state only while loading with no buckets', () => {
    /*
     * Scenario: first paint — metrics still loading and the series is empty.
     * Rule it protects: `isLoading && buckets.length === 0` is true, so the hit/miss,
     * ops, and latency panels render in their loading state. Flipping the `&&` to `||`,
     * the `=== 0` to `!== 0`, or short-circuiting the gate would change the flag.
     */
    metricsReturn = { data: undefined, isLoading: true, dataUpdatedAt: 0 }
    seriesReturn = []

    renderView()
    expect(screen.getByTestId('brush')).toHaveAttribute('data-loading', 'true')
    expect(screen.getByTestId('ops')).toHaveAttribute('data-loading', 'true')
    expect(screen.getByTestId('latency')).toHaveAttribute('data-loading', 'true')
    // Empty series → the panels receive zero points.
    expect(screen.getByTestId('brush')).toHaveAttribute('data-points', '0')
  })

  it('keeps the signature panels loaded when buckets exist even while metrics reload', () => {
    /*
     * Scenario: a background refetch flips `isLoading` true, but an accumulated series is
     * still present.
     * Rule it protects: `isLoading && buckets.length === 0` is FALSE because
     * `buckets.length === 0` is false — the panels stay loaded across a reload. This pins
     * the `=== 0` boundary and the `&&` (an `||` would force the loading state here).
     */
    metricsReturn = { data: undefined, isLoading: true, dataUpdatedAt: 0 }
    seriesReturn = [makeBucket(1)]

    renderView()
    expect(screen.getByTestId('brush')).toHaveAttribute('data-loading', 'false')
    expect(screen.getByTestId('ops')).toHaveAttribute('data-loading', 'false')
    expect(screen.getByTestId('latency')).toHaveAttribute('data-loading', 'false')
  })

  it('renders the memory bar width as the used/max percentage', () => {
    /*
     * Scenario: INFO reports used_memory below maxmemory.
     * Rule it protects: the bar width is `Math.min(100, memoryPct * 100)%` where
     * memoryPct = used_memory / maxmemory. Here 786432 / 2097152 = 0.375 → "37.5%" copy
     * and a 37.5% bar. This pins the division (vs multiplication), the `* 100` scale, and
     * the `Math.min(100, …)` clamp head.
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
    infoReturn = {
      data: {
        ok: true,
        data: {
          server: { redis_mode: 'standalone' },
          memory: { used_memory: '786432', maxmemory: '2097152' },
        },
      },
    }
    keyspaceReturn = { data: { ok: true, data: FULL_KEYSPACE }, isLoading: false }
    healthResult = { ok: true, data: { status: 'ok', latencyMs: 2 } }

    const { container } = renderView()
    // 786432 / 2097152 = 0.375 → the footnote shows "37.5% of 2.0 MB".
    expect(screen.getByText(/37\.5% of 2\.0 MB/)).toBeInTheDocument()
    // The bar element's inline width mirrors the percentage (clamped to 100).
    const bar = container.querySelector<HTMLElement>('span[style*="width"]')
    expect(bar).not.toBeNull()
    expect(bar?.style.width).toBe('37.5%')
  })

  it('clamps the memory bar width to 100% when usage exceeds maxmemory', () => {
    /*
     * Scenario: used_memory reported above maxmemory (an over-limit edge).
     * Rule it protects: `Math.min(100, memoryPct * 100)` caps the bar at 100% rather than
     * overflowing — killing the `Math.min` → `Math.max` swap, which would yield 200%.
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
    infoReturn = {
      data: {
        ok: true,
        data: {
          server: { redis_mode: 'standalone' },
          memory: { used_memory: '4194304', maxmemory: '2097152' },
        },
      },
    }
    keyspaceReturn = { data: { ok: true, data: FULL_KEYSPACE }, isLoading: false }
    healthResult = { ok: true, data: { status: 'ok', latencyMs: 2 } }

    const { container } = renderView()
    const bar = container.querySelector<HTMLElement>('span[style*="width"]')
    expect(bar?.style.width).toBe('100%')
  })

  it('falls back to the em-dash mode when INFO has no server section at all', () => {
    /*
     * Scenario: INFO resolved but the `server` section is entirely absent.
     * Rule it protects: `info?.['server']?.['redis_mode']` must short-circuit on the
     * MISSING server section (the inner optional chain) — dropping that `?.` would
     * dereference `undefined['redis_mode']` and crash the render. The mode shows "—".
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
    // No `server` key — only `memory`, so `info` is truthy but `info.server` is undefined.
    infoReturn = { data: { ok: true, data: { memory: { used_memory: '512' } } } }
    keyspaceReturn = { data: { ok: true, data: FULL_KEYSPACE }, isLoading: false }
    healthResult = { ok: true, data: { status: 'ok', latencyMs: 2 } }

    renderView()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders the connection-status accent color and the band stat labels', async () => {
    /*
     * Scenario: a healthy, fully-populated band.
     * Rule it protects: the status accent inline color comes from `statusMeta.color`
     * (Ready → #22c55e), and every band stat label (Mode/Uptime/Clients/Fragmentation/
     * Evicted/Expired) plus their INFO-derived values render. Blanking a label literal or
     * an `infoNum` section/field would drop the text or zero the value.
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

    renderView()
    // Band labels are static copy — a blanked literal removes the heading.
    for (const label of ['Mode', 'Uptime', 'Clients', 'Fragmentation', 'Evicted', 'Expired']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    // Card titles and the demo callout copy.
    expect(screen.getByText('Top prefixes')).toBeInTheDocument()
    expect(screen.getByText('Connection & pipeline health')).toBeInTheDocument()
    // INFO-derived band values: uptime 90000s → "1d 1h"; clients 4; fragmentation 1.23.
    expect(screen.getByText('1d 1h')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('1.23')).toBeInTheDocument()
    // The Ready status accent paints the design-system green (the status resolves async).
    const accent = (await screen.findByText('Ready')).closest('span')
    expect(accent).toHaveStyle({ color: '#22c55e' })
  })

  it('lists the top prefixes in descending byte order with formatted sizes', () => {
    /*
     * Scenario: a keyspace with three prefixes given out of byte order.
     * Rule it protects: the Top-prefixes card sorts by `b.bytes - a.bytes` (descending),
     * renders each prefix label and its `formatBytes` size. A swapped subtraction would
     * reverse the order; a blanked size formatter would drop the byte label.
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
          byType: { string: 1, hash: 1, set: 1 },
          byPrefix: [
            { prefix: 'small', bytes: 100 },
            { prefix: 'large', bytes: 8192 },
            { prefix: 'medium', bytes: 2048 },
          ],
          expiry: { withTtl: 0, noTtl: 0 },
        },
      },
      isLoading: false,
    }
    healthResult = { ok: true, data: { status: 'ok', latencyMs: 2 } }

    renderView()
    // Each prefix row carries its formatted byte size: 8192 → "8.0 KB", 2048 → "2.0 KB",
    // 100 → "100 B".
    expect(screen.getByText('8.0 KB')).toBeInTheDocument()
    expect(screen.getByText('2.0 KB')).toBeInTheDocument()
    expect(screen.getByText('100 B')).toBeInTheDocument()
    // The rows are ordered largest-first: large → medium → small.
    const rows = screen
      .getAllByRole('button')
      .filter((b) => /large|medium|small/.test(b.textContent ?? ''))
    expect(rows.map((b) => b.textContent)).toEqual([
      expect.stringContaining('large'),
      expect.stringContaining('medium'),
      expect.stringContaining('small'),
    ])
    // With prefixes present the `(… .length ?? 0) === 0` guard is FALSE, so the empty-state
    // copy must NOT appear — a forced-true condition or a `&&`-collapsed length would show
    // it here.
    expect(screen.queryByText('No prefixes yet.')).toBeNull()
  })

  it('renders the demo callout copy verbatim', () => {
    /*
     * Scenario: the always-present honest-scope callout at the foot of the view.
     * Rule it protects: the explanatory copy fragments are static literals; blanking any
     * of them removes the corresponding text from the callout.
     */
    renderView()
    // The header subtitle and the two emphasised inner spans are their own text nodes.
    expect(screen.getByText('Cache golden signals for the namespace.')).toBeInTheDocument()
    expect(screen.getByText('in-process per prefix')).toBeInTheDocument()
    expect(screen.getByText('INFO stats')).toBeInTheDocument()
    // The interleaved plain-text fragments of the callout paragraph share one `<p>`, so we
    // pin each fragment against the paragraph's combined text — blanking any one literal
    // drops its fragment from the paragraph.
    const para = screen.getByText(/Scoped demo of cache observability/)
    expect(para).toHaveTextContent('Scoped demo of cache observability. Hit/miss here is tracked')
    expect(para).toHaveTextContent('(reset on restart) for an exact per-prefix breakdown')
    expect(para).toHaveTextContent('A real deployment scrapes')
  })

  it('echoes the exact derived chart series and per-tile sparkline content', () => {
    /*
     * Scenario: data resolved with a single accumulated bucket carrying mutually-distinct
     * field values.
     * Rule it protects: each signature panel is fed the array mapped from `buckets`
     * (`{ t, hit, miss }` / `{ t, get, set, del }` / `{ t, p50, p95, p99 }`), and each tile's
     * sparkline is the array mapped from a single bucket field (`opsTotal` / `p95` /
     * `usedMemory` / `keysCount` / `expiredKeys`). Replacing a map arrow with `() => undefined`
     * collapses a point to `null`, and emptying a point object literal to `{}` drops every
     * field — both keep the array LENGTH unchanged, so only the serialized CONTENT detects them.
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
    seriesReturn = [
      detailedBucket({
        t: 11,
        hit: 7,
        miss: 3,
        get: 20,
        set: 5,
        del: 2,
        p50: 0.1,
        p95: 0.9,
        p99: 1.5,
        hitRate: 0.7,
        opsTotal: 27,
        usedMemory: 555,
        keysCount: 13,
        expiredKeys: 4,
      }),
    ]

    renderView()
    // Each panel's serialized data pins its per-bucket point object field-by-field.
    expect(screen.getByTestId('brush')).toHaveAttribute(
      'data-content',
      JSON.stringify([{ t: 11, hit: 7, miss: 3 }]),
    )
    expect(screen.getByTestId('ops')).toHaveAttribute(
      'data-content',
      JSON.stringify([{ t: 11, get: 20, set: 5, del: 2 }]),
    )
    expect(screen.getByTestId('latency')).toHaveAttribute(
      'data-content',
      JSON.stringify([{ t: 11, p50: 0.1, p95: 0.9, p99: 1.5 }]),
    )
    // Tiles render in source order: Throughput, Latency, Memory, Keys, Expired. Each
    // sparkline is the single mapped bucket field; `() => undefined` would yield `[null]`.
    const tiles = screen.getAllByTestId('tile')
    expect(tiles[0]).toHaveAttribute('data-spark-content', JSON.stringify([27]))
    expect(tiles[1]).toHaveAttribute('data-spark-content', JSON.stringify([0.9]))
    expect(tiles[2]).toHaveAttribute('data-spark-content', JSON.stringify([555]))
    expect(tiles[3]).toHaveAttribute('data-spark-content', JSON.stringify([13]))
    expect(tiles[4]).toHaveAttribute('data-spark-content', JSON.stringify([4]))
  })

  it('recomputes the memoized chart series when the bucket data changes', () => {
    /*
     * Scenario: the view renders one bucket, then a fresh metric series replaces it on a
     * re-render of the SAME component instance.
     * Rule it protects: `hitMissData`/`opsData`/`latencyData` are memoized on `[buckets]`, so a
     * new series reference must re-derive each array. Dropping the dependency array to `[]`
     * would freeze the panels on the first bucket forever — the post-update content pins it.
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
    seriesReturn = [detailedBucket({ t: 1, hit: 1, get: 10, p50: 0.1 })]

    const { rerender } = renderView()
    expect(screen.getByTestId('brush')).toHaveAttribute(
      'data-content',
      JSON.stringify([{ t: 1, hit: 1, miss: 0 }]),
    )
    expect(screen.getByTestId('ops')).toHaveAttribute(
      'data-content',
      JSON.stringify([{ t: 1, get: 10, set: 0, del: 0 }]),
    )
    expect(screen.getByTestId('latency')).toHaveAttribute(
      'data-content',
      JSON.stringify([{ t: 1, p50: 0.1, p95: 0, p99: 0 }]),
    )

    // A new bucket reference must flow through the memo dependency and re-derive each series.
    seriesReturn = [detailedBucket({ t: 2, hit: 2, get: 20, p50: 0.2 })]
    rerender(<OverviewView />)
    expect(screen.getByTestId('brush')).toHaveAttribute(
      'data-content',
      JSON.stringify([{ t: 2, hit: 2, miss: 0 }]),
    )
    expect(screen.getByTestId('ops')).toHaveAttribute(
      'data-content',
      JSON.stringify([{ t: 2, get: 20, set: 0, del: 0 }]),
    )
    expect(screen.getByTestId('latency')).toHaveAttribute(
      'data-content',
      JSON.stringify([{ t: 2, p50: 0.2, p95: 0, p99: 0 }]),
    )
  })

  it('caps the top-prefix list at the six largest prefixes', () => {
    /*
     * Scenario: a keyspace with eight prefixes feeds the Top-prefixes card.
     * Rule it protects: the card renders only the top six by bytes via the trailing
     * `.slice(0, 6)`; dropping that slice would spill all eight rows. The two smallest
     * (`p7`, `p8`) must be excluded.
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
          byType: { string: 1, hash: 1, set: 1 },
          byPrefix: [
            { prefix: 'p1', bytes: 800 },
            { prefix: 'p2', bytes: 700 },
            { prefix: 'p3', bytes: 600 },
            { prefix: 'p4', bytes: 500 },
            { prefix: 'p5', bytes: 400 },
            { prefix: 'p6', bytes: 300 },
            { prefix: 'p7', bytes: 200 },
            { prefix: 'p8', bytes: 100 },
          ],
          expiry: { withTtl: 0, noTtl: 0 },
        },
      },
      isLoading: false,
    }
    healthResult = { ok: true, data: { status: 'ok', latencyMs: 2 } }

    renderView()
    const rows = screen.getAllByRole('button').filter((b) => /^p\d/.test(b.textContent ?? ''))
    // Exactly six rows render — the cap holds even though eight prefixes were supplied.
    expect(rows).toHaveLength(6)
    // The largest six are present; the two smallest are sliced off.
    expect(screen.getByText('p6')).toBeInTheDocument()
    expect(screen.queryByText('p7')).toBeNull()
    expect(screen.queryByText('p8')).toBeNull()
  })

  it('feeds the memory-by-prefix panel the keyspace order, not the top-prefix sort order', () => {
    /*
     * Scenario: a keyspace whose `byPrefix` is given in a non-byte-sorted order; both the
     * memory-by-prefix panel and the Top-prefixes card read from it.
     * Rule it protects: the Top-prefixes card sorts a defensive `.slice()` COPY, so the
     * original `byPrefix` (handed to `MemoryByPrefix`) keeps its source order. Dropping that
     * copy would `.sort()` the shared array in place and reorder the panel's input.
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
          byType: { string: 1, hash: 1, set: 1 },
          // Input order is NOT byte-descending: alpha (smaller) precedes omega (larger).
          byPrefix: [
            { prefix: 'alpha', bytes: 50 },
            { prefix: 'omega', bytes: 900 },
          ],
          expiry: { withTtl: 0, noTtl: 0 },
        },
      },
      isLoading: false,
    }
    healthResult = { ok: true, data: { status: 'ok', latencyMs: 2 } }

    renderView()
    // MemoryByPrefix must receive the untouched source order; an in-place sort would put
    // omega first.
    expect(screen.getByTestId('mem-select')).toHaveAttribute(
      'data-content',
      JSON.stringify([
        { prefix: 'alpha', bytes: 50 },
        { prefix: 'omega', bytes: 900 },
      ]),
    )
  })

  it('renders the no-limit footnote with no memory bar when maxmemory is exactly zero', () => {
    /*
     * Scenario: INFO reports `maxmemory: '0'` — Redis's explicit "unbounded" sentinel.
     * Rule it protects: the memory tile treats a non-positive maxmemory as "no limit",
     * rendering the "no maxmemory limit" copy with no percentage and no width bar. A boundary
     * slip that admitted zero as a limit would paint a (degenerate) bar at the zero edge.
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
    infoReturn = {
      data: {
        ok: true,
        data: {
          server: { redis_mode: 'standalone' },
          memory: { used_memory: '512', maxmemory: '0' },
        },
      },
    }
    keyspaceReturn = { data: { ok: true, data: FULL_KEYSPACE }, isLoading: false }
    healthResult = { ok: true, data: { status: 'ok', latencyMs: 2 } }

    const { container } = renderView()
    expect(screen.getByText('no maxmemory limit')).toBeInTheDocument()
    // No percentage copy and no inline-width bar element exist at the zero boundary.
    expect(screen.queryByText(/% of/)).toBeNull()
    expect(container.querySelector('span[style*="width"]')).toBeNull()
  })

  it('preserves the inter-fragment spacing in the demo callout copy', () => {
    /*
     * Scenario: the honest-scope callout paragraph, whose fragments are joined by explicit
     * `{' '}` separators between the plain text and the emphasised spans.
     * Rule it protects: each separator string keeps the surrounding words apart; blanking one
     * to `""` would fuse two words. Asserting each space-spanning phrase detects a dropped
     * separator that a single-word substring (already covered above) would miss.
     */
    renderView()
    const para = screen.getByText(/Scoped demo of cache observability/)
    // Separator before the first emphasised span ("in-process per prefix").
    expect(para).toHaveTextContent('Hit/miss here is tracked in-process per prefix')
    // Separator before the "INFO stats" span.
    expect(para).toHaveTextContent('cross-checked against Redis INFO stats')
    // Separator before the trailing "INFO" span.
    expect(para).toHaveTextContent('A real deployment scrapes INFO with Prometheus')
  })
})

/** Build a minimal accumulated bucket with the given key count and (optional) p95. */
function makeBucket(keysCount: number, p95 = 0.5): OverviewBucket {
  return {
    t: 0,
    hit: 0,
    miss: 0,
    get: 0,
    set: 0,
    del: 0,
    p50: 0,
    p95,
    p99: 0,
    hitRate: 0,
    opsTotal: 0,
    usedMemory: 0,
    keysCount,
    expiredKeys: 0,
  }
}

/**
 * Build a bucket with every field defaulting to 0 and the given overrides applied, so
 * content-level assertions can pin exact per-field values in the derived chart series and
 * the tile sparklines.
 */
function detailedBucket(overrides: Partial<OverviewBucket> = {}): OverviewBucket {
  return {
    t: 0,
    hit: 0,
    miss: 0,
    get: 0,
    set: 0,
    del: 0,
    p50: 0,
    p95: 0,
    p99: 0,
    hitRate: 0,
    opsTotal: 0,
    usedMemory: 0,
    keysCount: 0,
    expiredKeys: 0,
    ...overrides,
  }
}
