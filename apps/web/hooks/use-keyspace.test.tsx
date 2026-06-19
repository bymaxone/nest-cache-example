/**
 * @fileoverview Unit tests for `useKeyspace` — the sampled keyspace-breakdown query.
 *
 * The transport (`cacheApi.getKeyspace`) is mocked; the hook is asserted by the
 * fixed query key it builds and the `ApiResult` it threads back. Wrapped in a
 * non-retrying `QueryClientProvider`.
 *
 * @module hooks/use-keyspace.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { type ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ApiResult } from '@/lib/api-client'
import { type KeyspaceBreakdown } from '@/lib/cache-api'

const getKeyspace = vi.fn<() => Promise<ApiResult<KeyspaceBreakdown>>>()

vi.mock('@/lib/cache-api', () => ({
  cacheApi: { getKeyspace: () => getKeyspace() },
}))

const { useKeyspace, KEYSPACE_QUERY_ROOT } = await import('./use-keyspace')

function wrapper({ children }: { children: ReactNode }): ReactNode {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const breakdown: KeyspaceBreakdown = {
  byType: { string: 3, hash: 1, set: 0 },
  byPrefix: [{ prefix: 'product', bytes: 1024 }],
  expiry: { withTtl: 2, noTtl: 2 },
}

beforeEach(() => {
  getKeyspace.mockReset().mockResolvedValue({ ok: true, data: breakdown })
})

describe('useKeyspace', () => {
  it('reads the sampled keyspace breakdown into the query result', async () => {
    /*
     * Scenario: the Overview keyspace panels mount.
     * Rule it protects: `getKeyspace` is invoked and its `ApiResult` threads through
     * as the query data.
     */
    const { result } = renderHook(() => useKeyspace(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(getKeyspace).toHaveBeenCalledTimes(1)
    expect(result.current.data).toEqual({ ok: true, data: breakdown })
  })

  it('exposes a stable query-key root', () => {
    /*
     * Scenario: a mutation invalidates the keyspace panels after a write.
     * Rule it protects: the exported root stays `'keyspace'`.
     */
    expect(KEYSPACE_QUERY_ROOT).toBe('keyspace')
  })
})
