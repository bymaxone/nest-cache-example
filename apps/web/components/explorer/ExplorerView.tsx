/**
 * @fileoverview `ExplorerView` — the client orchestrator for the Key Explorer.
 * Owns the URL-bound filter state (`nuqs`), runs the infinite SCAN query, shows the
 * resolved `KeyBuilder` match pattern, detects cluster mode from the API error, and
 * composes the filter rail, strategy toggle, and virtualized key table. Row clicks
 * open the {@link KeyDetailDrawer}; the page header carries the guarded flush action.
 *
 * @module components/explorer/ExplorerView
 */

'use client'

import { useCallback, useMemo, useState } from 'react'
import { useQueryState } from 'nuqs'
import { CACHE_ERROR_CODES } from '@bymax-one/nest-cache/shared'
import { FilterRail } from './FilterRail'
import { ScanStrategyToggle } from './ScanStrategyToggle'
import { KeyTable } from './KeyTable'
import { KeyDetailDrawer } from './KeyDetailDrawer'
import { FlushNamespaceButton } from './FlushNamespaceButton'
import { useKeys, flattenKeyPages } from '@/hooks/use-keys'
import {
  hasTtlParser,
  keyTypeParser,
  prefixParser,
  scanStrategyParser,
  tenantParser,
} from '@/lib/filters'
import { type KeyListParams } from '@/lib/cache-api'
import { APP_NAMESPACE } from '@/lib/constants'

/**
 * Compose the human-readable `KeyBuilder` match pattern from the active filters.
 *
 * @param tenant - The active tenant (empty = none).
 * @param prefix - The active prefix (empty = all).
 * @returns A display string such as `cache-example:tenant:acme:product:*`.
 */
function resolvedPattern(tenant: string, prefix: string): string {
  const matchPrefix = tenant ? `tenant:${tenant}:${prefix}` : prefix
  return `${APP_NAMESPACE}:${matchPrefix ? `${matchPrefix}:` : ''}*`
}

/** The Key Explorer client view. */
export function ExplorerView() {
  const [tenant] = useQueryState('tenant', tenantParser)
  const [prefix, setPrefix] = useQueryState('prefix', prefixParser)
  const [keyType, setKeyType] = useQueryState('type', keyTypeParser)
  const [hasTtl, setHasTtl] = useQueryState('hasTtl', hasTtlParser)
  const [strategy, setStrategy] = useQueryState('strategy', scanStrategyParser)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const params = useMemo<KeyListParams>(
    () => ({
      strategy,
      ...(prefix ? { prefix } : {}),
      ...(tenant ? { tenant } : {}),
      ...(keyType ? { type: keyType } : {}),
      ...(hasTtl ? { hasTtl: true } : {}),
    }),
    [strategy, prefix, tenant, keyType, hasTtl],
  )

  const query = useKeys(params)
  const pages = useMemo(() => query.data?.pages ?? [], [query.data])
  const keys = useMemo(() => flattenKeyPages(pages), [pages])

  // Stable callback so KeyTable's load-more effect does not re-fire on unrelated
  // re-renders (e.g. opening the drawer).
  const { fetchNextPage } = query
  const handleLoadMore = useCallback(() => void fetchNextPage(), [fetchNextPage])

  const firstPage = pages[0]
  const isClusterMode =
    !!firstPage &&
    !firstPage.ok &&
    firstPage.error.code === CACHE_ERROR_CODES.UNSUPPORTED_IN_CLUSTER
  const failedError = firstPage && !firstPage.ok && !isClusterMode ? firstPage.error : null

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-mono text-2xl font-bold">Key Explorer</h1>
          <p className="text-sm text-muted-foreground">
            Resolved match:{' '}
            <span className="font-mono text-brand-500">{resolvedPattern(tenant, prefix)}</span>{' '}
            <span className="text-xs">(via KeyBuilder)</span>
          </p>
        </div>
        <FlushNamespaceButton />
      </header>

      <ScanStrategyToggle
        value={strategy}
        onChange={(value) => void setStrategy(value)}
        isClusterMode={isClusterMode}
      />

      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <FilterRail
          prefix={prefix}
          onPrefixChange={(value) => void setPrefix(value)}
          type={keyType}
          onTypeChange={(value) => void setKeyType(value)}
          hasTtl={hasTtl}
          onHasTtlChange={(value) => void setHasTtl(value)}
        />

        {isClusterMode ? (
          <div className="flex items-center justify-center rounded-2xl border border-(--glass-border) bg-(--glass-card-bg) p-12 text-center text-sm text-muted-foreground backdrop-blur-md">
            Key browsing is unavailable in cluster mode — scan and keys are standalone/sentinel-only
            commands.
          </div>
        ) : failedError ? (
          <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-(--glass-border) bg-(--glass-card-bg) p-12 text-center text-sm backdrop-blur-md">
            <p className="font-medium text-destructive">Failed to list keys</p>
            <p className="text-muted-foreground">{failedError.message}</p>
          </div>
        ) : (
          <KeyTable
            keys={keys}
            isLoading={query.isLoading}
            hasNextPage={query.hasNextPage}
            isFetchingNextPage={query.isFetchingNextPage}
            onLoadMore={handleLoadMore}
            onRowClick={setSelectedKey}
            selectedKey={selectedKey}
          />
        )}
      </div>

      <KeyDetailDrawer keyName={selectedKey} onClose={() => setSelectedKey(null)} />
    </div>
  )
}
