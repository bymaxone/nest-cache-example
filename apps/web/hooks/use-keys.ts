/**
 * @fileoverview `useKeys` — the Explorer's server-state hook. A TanStack Query
 * `useInfiniteQuery` over the `GET /admin/keys` SCAN cursor: each page carries an
 * opaque `cursor`, and `getNextPageParam` advances until the cursor is exhausted
 * (or stops advancing). All transport goes through the typed {@link cacheApi}; no
 * `useEffect`+fetch, no axios (Bymax Next.js conventions).
 *
 * @module hooks/use-keys
 */

'use client'

import { useInfiniteQuery, type UseInfiniteQueryResult } from '@tanstack/react-query'
import { cacheApi, type KeyListParams, type KeyListResponse } from '@/lib/cache-api'
import { type ApiResult } from '@/lib/api-client'

/** Stable query-key root for every key listing, so mutations can invalidate precisely. */
export const KEYS_QUERY_ROOT = 'keys'

/** Default page size requested per SCAN page. */
const DEFAULT_LIMIT = 200

/**
 * Subscribe to the paged key listing for the given filter.
 *
 * The page param is the opaque SCAN `cursor`. `getNextPageParam` returns the
 * server's next cursor unless it is `null` (scan complete) or it failed to
 * advance — the backend's `CacheService.scan()` restarts from the beginning of a
 * fresh scan rather than resuming an offset, so a non-advancing cursor signals
 * the end of safely-pageable results and terminates the infinite query.
 *
 * @param params - The Explorer filter (prefix/pattern/tenant/type/strategy/limit).
 * @param enabled - When false, the query is idle (e.g. cluster mode disables it).
 * @returns The infinite-query result; pages are `ApiResult<KeyListResponse>`.
 */
export function useKeys(
  params: KeyListParams,
  enabled = true,
): UseInfiniteQueryResult<{ pages: Array<ApiResult<KeyListResponse>> }, Error> {
  const limit = params.limit ?? DEFAULT_LIMIT
  return useInfiniteQuery({
    queryKey: [KEYS_QUERY_ROOT, { ...params, limit }],
    enabled,
    initialPageParam: '',
    queryFn: ({ pageParam }) =>
      cacheApi.listKeys({ ...params, limit, ...(pageParam ? { cursor: pageParam } : {}) }),
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (!lastPage.ok) return undefined
      const { cursor } = lastPage.data
      // null = scan exhausted; an unchanged cursor = the backend re-scanned from
      // the start (no resumable offset), so there is no further page to fetch.
      if (cursor === null || cursor === lastPageParam) return undefined
      return cursor
    },
  })
}

/**
 * Flatten infinite-query pages into a de-duplicated, ordered key list.
 *
 * The backend's fresh-scan paging can repeat keys across pages; de-duplicating by
 * key keeps the virtualized table stable. Failed pages contribute no keys.
 *
 * @param pages - The `data.pages` array from {@link useKeys}.
 * @returns The unique fully-namespaced keys, in first-seen order.
 */
export function flattenKeyPages(pages: ReadonlyArray<ApiResult<KeyListResponse>>): string[] {
  const seen = new Set<string>()
  for (const page of pages) {
    if (!page.ok) continue
    for (const key of page.data.keys) seen.add(key)
  }
  return [...seen]
}
