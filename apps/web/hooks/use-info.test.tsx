/**
 * @fileoverview Unit tests for `useInfo` — the parsed-`INFO` polling query.
 *
 * The transport (`cacheApi.getInfo`) is mocked, so the hook is asserted by the
 * query key it builds (section vs default) and the `ApiResult` it threads back.
 * Wrapped in a non-retrying `QueryClientProvider` so the query settles
 * deterministically under `waitFor`.
 *
 * @module hooks/use-info.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { type ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ApiResult } from '@/lib/api-client'
import { type RedisInfo } from '@/lib/cache-api'

const getInfo = vi.fn<(section?: string) => Promise<ApiResult<RedisInfo>>>()

vi.mock('@/lib/cache-api', () => ({
  cacheApi: { getInfo: (section?: string) => getInfo(section) },
}))

const { useInfo, INFO_QUERY_ROOT } = await import('./use-info')

/** Wrap a hook in a fresh, non-retrying query client per render. */
function wrapper({ children }: { children: ReactNode }): ReactNode {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const info: RedisInfo = { server: { redis_version: '7.0.0' } }

beforeEach(() => {
  getInfo.mockReset().mockResolvedValue({ ok: true, data: info })
})

describe('useInfo', () => {
  it('fetches the default INFO set with a null section in the key', async () => {
    /*
     * Scenario: the Overview reads the default INFO sections.
     * Rule it protects: with no section argument, `getInfo` is called with
     * undefined and the result threads through as `ApiResult<RedisInfo>`.
     */
    const { result } = renderHook(() => useInfo(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(getInfo).toHaveBeenCalledWith(undefined)
    expect(result.current.data).toEqual({ ok: true, data: info })
  })

  it('passes a provided section through to the transport', async () => {
    /*
     * Scenario: a panel reads only the `memory` section.
     * Rule it protects: the section argument reaches `getInfo`, distinguishing the
     * scoped query from the default one.
     */
    const { result } = renderHook(() => useInfo('memory'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(getInfo).toHaveBeenCalledWith('memory')
  })

  it('exposes a stable query-key root', () => {
    /*
     * Scenario: a mutation needs to invalidate the INFO query.
     * Rule it protects: the exported root constant stays `'info'` so invalidation
     * targets the right cache entry.
     */
    expect(INFO_QUERY_ROOT).toBe('info')
  })
})
