/**
 * @fileoverview Unit tests for `useKeys` (the Explorer's infinite SCAN query) and
 * the pure `flattenKeyPages` helper.
 *
 * The transport (`cacheApi.listKeys`) is mocked. The query tests cover the page
 * param plumbing (initial empty cursor → no cursor in params; a subsequent fetch
 * carries the prior cursor) and the three `getNextPageParam` terminations:
 * advancing cursor (more pages), `null` cursor (scan exhausted), and an unchanged
 * cursor (backend re-scanned, no resumable offset). `flattenKeyPages` covers
 * de-duplication across pages and skipping failed pages.
 *
 * @module hooks/use-keys.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { type ReactNode } from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ApiResult } from '@/lib/api-client'
import { type KeyListParams, type KeyListResponse } from '@/lib/cache-api'

const listKeys = vi.fn<(params: KeyListParams) => Promise<ApiResult<KeyListResponse>>>()

vi.mock('@/lib/cache-api', () => ({
  cacheApi: { listKeys: (params: KeyListParams) => listKeys(params) },
}))

const { useKeys, flattenKeyPages, KEYS_QUERY_ROOT } = await import('./use-keys')

function wrapper({ children }: { children: ReactNode }): ReactNode {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

/** Build an ok key-list page. */
function page(keys: string[], cursor: string | null): ApiResult<KeyListResponse> {
  return { ok: true, data: { keys, cursor, strategy: 'scan' } }
}

beforeEach(() => {
  listKeys.mockReset()
})

describe('flattenKeyPages', () => {
  it('de-duplicates keys across pages, in first-seen order, skipping failed pages', () => {
    /*
     * Scenario: a fresh-scan paging that repeats a key, plus one failed page.
     * Rule it protects: keys are de-duplicated by first-seen order and a non-ok
     * page contributes nothing.
     */
    const pages: Array<ApiResult<KeyListResponse>> = [
      page(['a', 'b'], 'c1'),
      { ok: false, error: { code: 'unknown', message: 'x', status: 500 } },
      page(['b', 'c'], null),
    ]
    expect(flattenKeyPages(pages)).toEqual(['a', 'b', 'c'])
  })
})

describe('useKeys', () => {
  it('requests the first page with the default limit and no cursor', async () => {
    /*
     * Scenario: the Explorer opens with an unfiltered listing.
     * Rule it protects: the initial page param is the empty cursor, so the params
     * carry the default limit (200) and NO cursor key.
     */
    listKeys.mockResolvedValue(page(['a'], null))
    const { result } = renderHook(() => useKeys({ prefix: 'product' }), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(listKeys).toHaveBeenCalledWith({ prefix: 'product', limit: 200 })
    expect(result.current.hasNextPage).toBe(false)
  })

  it('advances to the next page carrying the prior cursor when one is returned', async () => {
    /*
     * Scenario: the first page returns an advancing cursor and the table fetches more.
     * Rule it protects: `getNextPageParam` surfaces the new cursor (hasNextPage),
     * and the next fetch threads that cursor into the params.
     */
    listKeys.mockResolvedValueOnce(page(['a'], 'cur1')).mockResolvedValueOnce(page(['b'], null))
    const { result } = renderHook(() => useKeys({}), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.hasNextPage).toBe(true)

    await act(async () => {
      await result.current.fetchNextPage()
    })
    await waitFor(() => expect(result.current.hasNextPage).toBe(false))
    expect(listKeys).toHaveBeenNthCalledWith(2, { limit: 200, cursor: 'cur1' })
  })

  it('terminates when the cursor stops advancing (backend re-scan, no offset)', async () => {
    /*
     * Scenario: the server returns the same cursor it was given.
     * Rule it protects: an unchanged cursor (`cursor === lastPageParam`) ends the
     * infinite query — there is no resumable offset to page past.
     */
    // First page param is '' and the page returns '' as cursor — unchanged.
    listKeys.mockResolvedValue(page(['a'], ''))
    const { result } = renderHook(() => useKeys({}), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.hasNextPage).toBe(false)
  })

  it('reports no next page when the last page failed', async () => {
    /*
     * Scenario: the page fetch resolves a structured error.
     * Rule it protects: a non-ok last page makes `getNextPageParam` return
     * undefined, so the query does not try to page past a failure.
     */
    listKeys.mockResolvedValue({ ok: false, error: { code: 'unknown', message: 'x', status: 500 } })
    const { result } = renderHook(() => useKeys({}), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.hasNextPage).toBe(false)
  })

  it('stays idle when disabled', async () => {
    /*
     * Scenario: cluster mode disables the listing.
     * Rule it protects: `enabled: false` keeps the query idle so no SCAN fires.
     */
    const { result } = renderHook(() => useKeys({}, false), { wrapper })
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'))
    expect(listKeys).not.toHaveBeenCalled()
  })

  it('honours an explicit limit override', async () => {
    /*
     * Scenario: a caller requests a smaller page.
     * Rule it protects: a provided `limit` replaces the default in the params.
     */
    listKeys.mockResolvedValue(page([], null))
    const { result } = renderHook(() => useKeys({ limit: 25 }), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(listKeys).toHaveBeenCalledWith({ limit: 25 })
  })

  it('exposes a stable query-key root', () => {
    /*
     * Scenario: a write mutation invalidates every key listing.
     * Rule it protects: the exported root stays `'keys'`.
     */
    expect(KEYS_QUERY_ROOT).toBe('keys')
  })
})
