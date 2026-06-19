/**
 * @fileoverview Unit tests for the Observe write hooks (`use-cache-mutations`):
 * seed, delete, persist, expire, flush-namespace, and clear-tenant.
 *
 * The typed endpoints (`cacheApi`, `tenantsApi`) are mocked; `unwrap` and
 * `ApiRequestError` keep their real behaviour so a structured error rejects the
 * mutation. A real `QueryClient` is used with a spy on `invalidateQueries`, so each
 * hook is asserted by (a) the endpoint it calls with the right argument and (b) the
 * exact set of query roots it invalidates on success. One error-path test proves a
 * failed transport routes to `onError` and invalidates nothing.
 *
 * @module hooks/use-cache-mutations.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { type ReactNode } from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { type MockInstance } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ApiError, type ApiResult } from '@/lib/api-client'

// Typed to resolve an `ApiResult` (never `any`) so the mock wrappers below have a
// concrete, lint-safe return type.
const seed = vi.fn<(count: number) => Promise<ApiResult<unknown>>>()
const deleteKey = vi.fn<(key: string) => Promise<ApiResult<unknown>>>()
const persistKey = vi.fn<(key: string) => Promise<ApiResult<unknown>>>()
const expireKey = vi.fn<(key: string, seconds: number) => Promise<ApiResult<unknown>>>()
const flushNamespace = vi.fn<() => Promise<ApiResult<unknown>>>()
const clearTenant = vi.fn<(tenant: string) => Promise<ApiResult<unknown>>>()

vi.mock('@/lib/cache-api', () => {
  /** Real unwrap behaviour so a failure result rejects the mutation. */
  class ApiRequestError extends Error {
    constructor(readonly apiError: ApiError) {
      super(apiError.message)
      this.name = 'ApiRequestError'
    }
  }
  return {
    ApiRequestError,
    unwrap: <T,>(result: ApiResult<T>): T => {
      if (!result.ok) throw new ApiRequestError(result.error)
      return result.data
    },
    cacheApi: {
      seed: (count: number) => seed(count),
      deleteKey: (key: string) => deleteKey(key),
      persistKey: (key: string) => persistKey(key),
      expireKey: (key: string, seconds: number) => expireKey(key, seconds),
      flushNamespace: () => flushNamespace(),
    },
    tenantsApi: { clearTenant: (tenant: string) => clearTenant(tenant) },
  }
})

const mutations = await import('./use-cache-mutations')

let client: QueryClient
let invalidateSpy: MockInstance<QueryClient['invalidateQueries']>

function wrapper({ children }: { children: ReactNode }): ReactNode {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

/** Collect the query-key roots passed to every `invalidateQueries` call. */
function invalidatedRoots(): string[] {
  return invalidateSpy.mock.calls
    .map((call) => call[0]?.queryKey?.[0])
    .filter((root): root is string => typeof root === 'string')
}

beforeEach(() => {
  seed.mockReset().mockResolvedValue({ ok: true, data: { seeded: 5 } })
  deleteKey.mockReset().mockResolvedValue({ ok: true, data: { deleted: 1 } })
  persistKey.mockReset().mockResolvedValue({ ok: true, data: { ttl: -1 } })
  expireKey.mockReset().mockResolvedValue({ ok: true, data: { ttl: 30 } })
  flushNamespace.mockReset().mockResolvedValue({ ok: true, data: { flushed: 9 } })
  clearTenant
    .mockReset()
    .mockResolvedValue({ ok: true, data: { tenant: 't', scannedKeys: 3, deleted: 3 } })
  client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  invalidateSpy = vi.spyOn(client, 'invalidateQueries').mockResolvedValue()
})

describe('useSeed', () => {
  it('seeds the count and invalidates keys, keyspace, and info', async () => {
    /*
     * Scenario: bulk-seeding demo keys succeeds.
     * Rule it protects: `seed(count)` is unwrapped, and exactly the keys/keyspace/
     * info roots are invalidated so those reads refetch.
     */
    const { result } = renderHook(() => mutations.useSeed(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync(5)
    })
    expect(seed).toHaveBeenCalledWith(5)
    expect(invalidatedRoots()).toEqual(['keys', 'keyspace', 'info'])
  })
})

describe('useDeleteKey', () => {
  it('deletes the key and invalidates keys, keyspace, and key-inspect', async () => {
    /*
     * Scenario: deleting one key.
     * Rule it protects: the affected list + the open inspection are invalidated.
     */
    const { result } = renderHook(() => mutations.useDeleteKey(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync('cache-example:k')
    })
    expect(deleteKey).toHaveBeenCalledWith('cache-example:k')
    expect(invalidatedRoots()).toEqual(['keys', 'keyspace', 'key-inspect'])
  })

  it('routes a structured error to onError and invalidates nothing', async () => {
    /*
     * Scenario: the delete transport returns a structured failure.
     * Rule it protects: `unwrap` throws an `ApiRequestError`, the mutation rejects,
     * and `onSuccess` (the invalidation) never runs.
     */
    deleteKey.mockResolvedValue({
      ok: false,
      error: { code: 'cache.invalid_key', message: 'bad', status: 400 },
    })
    const { result } = renderHook(() => mutations.useDeleteKey(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync('bad-key').catch(() => undefined)
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(Error)
    expect(invalidateSpy).not.toHaveBeenCalled()
  })
})

describe('usePersistKey', () => {
  it('persists the key and invalidates keys and key-inspect', async () => {
    /*
     * Scenario: removing a key's TTL.
     * Rule it protects: only the keys list and the inspection are invalidated.
     */
    const { result } = renderHook(() => mutations.usePersistKey(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync('cache-example:k')
    })
    expect(persistKey).toHaveBeenCalledWith('cache-example:k')
    expect(invalidatedRoots()).toEqual(['keys', 'key-inspect'])
  })
})

describe('useExpireKey', () => {
  it('expires the key with the new TTL and invalidates keys and key-inspect', async () => {
    /*
     * Scenario: setting a new TTL on a key.
     * Rule it protects: the `{ key, seconds }` args reach `expireKey`, and the keys
     * list + inspection are invalidated.
     */
    const { result } = renderHook(() => mutations.useExpireKey(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({ key: 'cache-example:k', seconds: 30 })
    })
    expect(expireKey).toHaveBeenCalledWith('cache-example:k', 30)
    expect(invalidatedRoots()).toEqual(['keys', 'key-inspect'])
  })
})

describe('useFlushNamespace', () => {
  it('flushes and invalidates keys, keyspace, info, and metrics', async () => {
    /*
     * Scenario: flushing the whole namespace.
     * Rule it protects: the broadest invalidation set (keys/keyspace/info/metrics)
     * fires so every Observe surface refetches.
     */
    const { result } = renderHook(() => mutations.useFlushNamespace(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync()
    })
    expect(flushNamespace).toHaveBeenCalledTimes(1)
    expect(invalidatedRoots()).toEqual(['keys', 'keyspace', 'info', 'metrics'])
  })
})

describe('useClearTenant', () => {
  it('clears the tenant and invalidates keys and keyspace', async () => {
    /*
     * Scenario: clearing one tenant's keys.
     * Rule it protects: the tenant id reaches `clearTenant`, and the keys + keyspace
     * roots are invalidated.
     */
    const { result } = renderHook(() => mutations.useClearTenant(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync('acme')
    })
    expect(clearTenant).toHaveBeenCalledWith('acme')
    expect(invalidatedRoots()).toEqual(['keys', 'keyspace'])
  })
})
