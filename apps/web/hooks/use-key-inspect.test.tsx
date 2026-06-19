/**
 * @fileoverview Unit tests for `useKeyInspect` — the lazy single-key inspection.
 *
 * The transport (`cacheApi.inspectKey`) is mocked; this exercises both halves of
 * the `enabled && key.length > 0` gate: it fetches only when enabled with a
 * non-empty key, and stays idle when disabled OR when the key is empty (so a
 * closed drawer / unselected row never fires `MEMORY USAGE`).
 *
 * @module hooks/use-key-inspect.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { type ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ApiResult } from '@/lib/api-client'
import { type KeyInspectResponse } from '@/lib/cache-api'

const inspectKey = vi.fn<(key: string) => Promise<ApiResult<KeyInspectResponse>>>()

vi.mock('@/lib/cache-api', () => ({
  cacheApi: { inspectKey: (key: string) => inspectKey(key) },
}))

const { useKeyInspect, KEY_INSPECT_QUERY_ROOT } = await import('./use-key-inspect')

function wrapper({ children }: { children: ReactNode }): ReactNode {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const inspection: KeyInspectResponse = {
  key: 'cache-example:product:1',
  type: 'string',
  value: { id: '1' },
  raw: '{"id":"1"}',
  ttl: -1,
  memoryBytes: 64,
}

beforeEach(() => {
  inspectKey.mockReset().mockResolvedValue({ ok: true, data: inspection })
})

describe('useKeyInspect', () => {
  it('fetches the inspection when enabled with a non-empty key', async () => {
    /*
     * Scenario: a visible Explorer row inspects its key.
     * Rule it protects: with enabled (default) and a non-empty key, `inspectKey`
     * runs and the result threads through.
     */
    const { result } = renderHook(() => useKeyInspect('cache-example:product:1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(inspectKey).toHaveBeenCalledWith('cache-example:product:1')
    expect(result.current.data).toEqual({ ok: true, data: inspection })
  })

  it('stays idle for an empty key even when enabled', async () => {
    /*
     * Scenario: no row is selected (empty key) while the hook is otherwise enabled.
     * Rule it protects: the `key.length > 0` half of the gate keeps the query
     * disabled so no request fires.
     */
    const { result } = renderHook(() => useKeyInspect(''), { wrapper })
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'))
    expect(result.current.isPending).toBe(true)
    expect(inspectKey).not.toHaveBeenCalled()
  })

  it('stays idle when explicitly disabled (e.g. a closed drawer)', async () => {
    /*
     * Scenario: the inspection drawer is closed.
     * Rule it protects: the `enabled` half of the gate keeps the query idle even
     * with a valid key.
     */
    const { result } = renderHook(() => useKeyInspect('cache-example:product:1', false), {
      wrapper,
    })
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'))
    expect(inspectKey).not.toHaveBeenCalled()
  })

  it('exposes a stable query-key root', () => {
    /*
     * Scenario: a delete mutation invalidates the open inspection.
     * Rule it protects: the exported root stays `'key-inspect'`.
     */
    expect(KEY_INSPECT_QUERY_ROOT).toBe('key-inspect')
  })
})
