/**
 * @fileoverview `useKeyInspect` — lazily fetches a single key's inspection
 * (`GET /admin/keys/:key`: type, decoded value, raw string, TTL, byte size). The
 * Explorer's virtualized table mounts a row's cells only when the row scrolls into
 * view, so calling this from those cells fetches `MEMORY USAGE` (and the rest) on
 * demand rather than for every row up front; identical concurrent calls dedupe via
 * the shared query key.
 *
 * @module hooks/use-key-inspect
 */

'use client'

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { cacheApi, type KeyInspectResponse } from '@/lib/cache-api'
import { type ApiResult } from '@/lib/api-client'

/** Stable query-key root for single-key inspections. */
export const KEY_INSPECT_QUERY_ROOT = 'key-inspect'

/**
 * Subscribe to a single key's inspection.
 *
 * @param key - The fully-namespaced key to inspect.
 * @param enabled - When false, the query stays idle (e.g. drawer closed).
 * @returns The query result whose `data` is `ApiResult<KeyInspectResponse>`.
 */
export function useKeyInspect(
  key: string,
  enabled = true,
): UseQueryResult<ApiResult<KeyInspectResponse>, Error> {
  return useQuery({
    queryKey: [KEY_INSPECT_QUERY_ROOT, key],
    queryFn: () => cacheApi.inspectKey(key),
    enabled: enabled && key.length > 0,
  })
}
