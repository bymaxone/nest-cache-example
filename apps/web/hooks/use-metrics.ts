/**
 * @fileoverview `useMetrics` — polls `GET /metrics` (the in-process per-prefix
 * hit/miss + ops snapshot) on an interval derived from the active time range. The
 * endpoint returns a point-in-time snapshot, not a series, so the streaming/area
 * panels accumulate buckets client-side from successive snapshots. Reads go through
 * the typed {@link cacheApi}; no `useEffect`+fetch, no axios.
 *
 * @module hooks/use-metrics
 */

'use client'

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { cacheApi, type MetricsSnapshot } from '@/lib/cache-api'
import { type ApiResult } from '@/lib/api-client'
import { type RangePreset } from '@/lib/filters'

/** Stable query-key root for the metrics snapshot. */
export const METRICS_QUERY_ROOT = 'metrics'

/** Poll cadence per time range, in milliseconds — shorter ranges refresh faster. */
const REFETCH_INTERVAL_BY_RANGE: Record<RangePreset, number> = {
  '5m': 2_000,
  '15m': 5_000,
  '1h': 15_000,
}

/**
 * Subscribe to the metrics snapshot, polling at a range-appropriate cadence.
 *
 * @param range - The active time-range preset (drives the poll interval + key).
 * @returns The query result whose `data` is `ApiResult<MetricsSnapshot>`.
 */
export function useMetrics(range: RangePreset): UseQueryResult<ApiResult<MetricsSnapshot>, Error> {
  return useQuery({
    queryKey: [METRICS_QUERY_ROOT, range],
    queryFn: () => cacheApi.getMetrics(),
    refetchInterval: REFETCH_INTERVAL_BY_RANGE[range],
  })
}
