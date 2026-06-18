/**
 * @fileoverview Write hooks for the Observe pages — seed, delete, persist, expire,
 * flush-namespace, and clear-tenant. Each is a TanStack Query `useMutation` that
 * unwraps the typed transport result (throwing {@link ApiRequestError} on a
 * structured error so it routes to `onError`) and, on success, invalidates exactly
 * the affected query roots so the lists re-render without a manual refresh.
 *
 * @module hooks/use-cache-mutations
 */

'use client'

import {
  useMutation,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import { cacheApi, tenantsApi, unwrap } from '@/lib/cache-api'
import { KEYS_QUERY_ROOT } from './use-keys'
import { METRICS_QUERY_ROOT } from './use-metrics'
import { INFO_QUERY_ROOT } from './use-info'
import { KEYSPACE_QUERY_ROOT } from './use-keyspace'
import { KEY_INSPECT_QUERY_ROOT } from './use-key-inspect'

/**
 * Invalidate a set of query roots so dependent reads refetch.
 *
 * @param client - The active query client.
 * @param roots - Query-key roots to invalidate (each matches all keys under it).
 */
function invalidateRoots(client: QueryClient, roots: readonly string[]): void {
  for (const root of roots) void client.invalidateQueries({ queryKey: [root] })
}

/**
 * Bulk-seed demo product keys.
 *
 * @returns A mutation taking the key count; invalidates keys/keyspace/info on success.
 */
export function useSeed(): UseMutationResult<{ seeded: number }, Error, number> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (count: number) => cacheApi.seed(count).then(unwrap),
    onSuccess: () =>
      invalidateRoots(client, [KEYS_QUERY_ROOT, KEYSPACE_QUERY_ROOT, INFO_QUERY_ROOT]),
  })
}

/**
 * Delete one fully-namespaced key.
 *
 * @returns A mutation taking the key; invalidates keys/keyspace on success.
 */
export function useDeleteKey(): UseMutationResult<{ deleted: number }, Error, string> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (key: string) => cacheApi.deleteKey(key).then(unwrap),
    onSuccess: () =>
      invalidateRoots(client, [KEYS_QUERY_ROOT, KEYSPACE_QUERY_ROOT, KEY_INSPECT_QUERY_ROOT]),
  })
}

/**
 * Remove a key's TTL (make it persistent).
 *
 * @returns A mutation taking the key; invalidates the keys list on success.
 */
export function usePersistKey(): UseMutationResult<{ ttl: number }, Error, string> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (key: string) => cacheApi.persistKey(key).then(unwrap),
    onSuccess: () => invalidateRoots(client, [KEYS_QUERY_ROOT, KEY_INSPECT_QUERY_ROOT]),
  })
}

/** Arguments for {@link useExpireKey}: the key and the new TTL in seconds. */
export interface ExpireKeyArgs {
  /** The fully-namespaced key to expire. */
  key: string
  /** The new TTL in seconds. */
  seconds: number
}

/**
 * Set a new TTL on a key.
 *
 * @returns A mutation taking `{ key, seconds }`; invalidates the keys list on success.
 */
export function useExpireKey(): UseMutationResult<{ ttl: number }, Error, ExpireKeyArgs> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ key, seconds }: ExpireKeyArgs) => cacheApi.expireKey(key, seconds).then(unwrap),
    onSuccess: () => invalidateRoots(client, [KEYS_QUERY_ROOT, KEY_INSPECT_QUERY_ROOT]),
  })
}

/**
 * Flush the whole `cache-example:` namespace (guarded in production).
 *
 * @returns A mutation (no args); invalidates keys/keyspace/info/metrics on success.
 */
export function useFlushNamespace(): UseMutationResult<{ flushed: number }, Error, void> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => cacheApi.flushNamespace().then(unwrap),
    onSuccess: () =>
      invalidateRoots(client, [
        KEYS_QUERY_ROOT,
        KEYSPACE_QUERY_ROOT,
        INFO_QUERY_ROOT,
        METRICS_QUERY_ROOT,
      ]),
  })
}

/**
 * Clear one tenant's keys via the server-side `scan` → `delMany`.
 *
 * @returns A mutation taking the tenant id; invalidates the keys list on success.
 */
export function useClearTenant(): UseMutationResult<
  { tenant: string; scannedKeys: number; deleted: number },
  Error,
  string
> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (tenant: string) => tenantsApi.clearTenant(tenant).then(unwrap),
    onSuccess: () => invalidateRoots(client, [KEYS_QUERY_ROOT, KEYSPACE_QUERY_ROOT]),
  })
}
