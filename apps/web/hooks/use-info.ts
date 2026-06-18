/**
 * @fileoverview `useInfo` — reads parsed Redis `INFO` via `GET /admin/info`,
 * optionally restricted to a single section. Backs the Overview connection/memory
 * panels. Reads go through the typed {@link cacheApi}; no `useEffect`+fetch, no axios.
 *
 * @module hooks/use-info
 */

'use client'

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { cacheApi, type RedisInfo } from '@/lib/cache-api'
import { type ApiResult } from '@/lib/api-client'

/** Stable query-key root for the parsed `INFO` record. */
export const INFO_QUERY_ROOT = 'info'

/** How often to re-poll `INFO` for the connection/memory panels, in milliseconds. */
const INFO_REFETCH_INTERVAL_MS = 5_000

/**
 * Subscribe to the parsed Redis `INFO` record.
 *
 * @param section - Optional INFO section (e.g. `memory`, `stats`); omit for the default set.
 * @returns The query result whose `data` is `ApiResult<RedisInfo>`.
 */
export function useInfo(section?: string): UseQueryResult<ApiResult<RedisInfo>, Error> {
  return useQuery({
    queryKey: [INFO_QUERY_ROOT, section ?? null],
    queryFn: () => cacheApi.getInfo(section),
    refetchInterval: INFO_REFETCH_INTERVAL_MS,
  })
}
