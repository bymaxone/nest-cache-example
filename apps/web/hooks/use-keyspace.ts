/**
 * @fileoverview `useKeyspace` — reads the sampled keyspace breakdown via
 * `GET /admin/keyspace` (keys-by-type, memory-by-prefix, expiry split). Backs the
 * Overview keyspace panels, which group by bounded dimensions only (type/prefix) —
 * the browser never SCANs to build these charts. Reads go through the typed
 * {@link cacheApi}; no `useEffect`+fetch, no axios.
 *
 * @module hooks/use-keyspace
 */

'use client'

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { cacheApi, type KeyspaceBreakdown } from '@/lib/cache-api'
import { type ApiResult } from '@/lib/api-client'

/** Stable query-key root for the sampled keyspace breakdown. */
export const KEYSPACE_QUERY_ROOT = 'keyspace'

/** How often to re-sample the keyspace breakdown, in milliseconds. */
const KEYSPACE_REFETCH_INTERVAL_MS = 10_000

/**
 * Subscribe to the sampled keyspace breakdown for the Overview panels.
 *
 * @returns The query result whose `data` is `ApiResult<KeyspaceBreakdown>`.
 */
export function useKeyspace(): UseQueryResult<ApiResult<KeyspaceBreakdown>, Error> {
  return useQuery({
    queryKey: [KEYSPACE_QUERY_ROOT],
    queryFn: () => cacheApi.getKeyspace(),
    refetchInterval: KEYSPACE_REFETCH_INTERVAL_MS,
  })
}
