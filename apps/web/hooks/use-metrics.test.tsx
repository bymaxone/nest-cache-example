/**
 * @fileoverview Unit tests for `useMetrics` — the range-cadenced metrics snapshot
 * poll.
 *
 * The transport (`cacheApi.getMetrics`) is mocked; the hook is asserted by the
 * `ApiResult` it threads back and the exported query-key root. Each supported
 * range preset is exercised so the per-range refetch-interval lookup is covered.
 *
 * @module hooks/use-metrics.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { type ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ApiResult } from '@/lib/api-client'
import { type MetricsSnapshot } from '@/lib/cache-api'
import { type RangePreset } from '@/lib/filters'

const getMetrics = vi.fn<() => Promise<ApiResult<MetricsSnapshot>>>()

vi.mock('@/lib/cache-api', () => ({
  cacheApi: { getMetrics: () => getMetrics() },
}))

const { useMetrics, METRICS_QUERY_ROOT } = await import('./use-metrics')

function wrapper({ children }: { children: ReactNode }): ReactNode {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const snapshot: MetricsSnapshot = {
  prefixes: {},
  totals: { hits: 1, misses: 1, hitRate: 0.5 },
  instantaneousOpsPerSec: 10,
  note: 'app-level',
}

beforeEach(() => {
  getMetrics.mockReset().mockResolvedValue({ ok: true, data: snapshot })
})

describe('useMetrics', () => {
  const ranges: readonly RangePreset[] = ['5m', '15m', '1h']

  it.each(ranges)('polls the metrics snapshot for the %s range', async (range) => {
    /*
     * Scenario: the streaming panels poll at a range-appropriate cadence.
     * Rule it protects: each preset resolves a valid refetch interval (the
     * per-range lookup) and the snapshot threads through as the query data.
     */
    const { result } = renderHook(() => useMetrics(range), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ ok: true, data: snapshot })
  })

  it('exposes a stable query-key root', () => {
    /*
     * Scenario: a flush mutation invalidates the metrics query.
     * Rule it protects: the exported root stays `'metrics'`.
     */
    expect(METRICS_QUERY_ROOT).toBe('metrics')
  })
})
