/**
 * @fileoverview Unit tests for {@link ExplorerView} — the Key Explorer client
 * orchestrator. Mocks the `useKeys` infinite query (and `flattenKeyPages`) plus
 * the heavy child components (`KeyTable`, `KeyDetailDrawer`, `FlushNamespaceButton`)
 * so the spec drives ExplorerView's own branches: the resolved KeyBuilder pattern
 * across tenant/prefix/pattern permutations, cluster-mode detection from the API
 * error, the generic failed-list error surface, the happy KeyTable path, the
 * filter/strategy callbacks writing URL state, and opening the detail drawer on a
 * row click. nuqs URL state is provided by `NuqsTestingAdapter`.
 *
 * @module components/explorer/ExplorerView.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from 'nuqs/adapters/testing'
import { type ReactNode } from 'react'
import { CACHE_ERROR_CODES } from '@bymax-one/nest-cache/shared'
import { type ApiResult } from '@/lib/api-client'
import { type KeyListResponse } from '@/lib/cache-api'
import { ExplorerView } from './ExplorerView'

/** Controlled `useKeys` query surface — only what ExplorerView reads. */
interface KeysQueryState {
  data: { pages: Array<ApiResult<KeyListResponse>> } | undefined
  isLoading: boolean
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: ReturnType<typeof vi.fn>
}

const keysQuery: KeysQueryState = {
  data: undefined,
  isLoading: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: vi.fn(),
}

vi.mock('@/hooks/use-keys', () => ({
  useKeys: () => keysQuery,
  // Flatten the mocked pages the same way the real helper does, so the table
  // receives the keys driven by each test.
  flattenKeyPages: (pages: ReadonlyArray<ApiResult<KeyListResponse>>) => {
    const seen = new Set<string>()
    for (const page of pages) {
      if (!page.ok) continue
      for (const key of page.data.keys) seen.add(key)
    }
    return [...seen]
  },
}))

// Heavy children are exercised by their own specs; here they are stubbed to keep
// ExplorerView's branches isolated. The table stub surfaces the keys it received
// and a row button that forwards the row click to open the drawer.
vi.mock('./KeyTable', () => ({
  KeyTable: ({
    keys,
    onRowClick,
    onLoadMore,
  }: {
    keys: string[]
    onRowClick?: (key: string) => void
    onLoadMore?: () => void
  }) => (
    <div data-testid="key-table">
      <span data-testid="key-count">{keys.length}</span>
      <button type="button" onClick={() => onRowClick?.('cache-example:product:42')}>
        open-row
      </button>
      <button type="button" onClick={() => onLoadMore?.()}>
        load-more
      </button>
    </div>
  ),
}))
vi.mock('./KeyDetailDrawer', () => ({
  KeyDetailDrawer: ({ keyName, onClose }: { keyName: string | null; onClose: () => void }) => (
    <div data-testid="drawer">
      {keyName ?? 'closed'}
      <button type="button" onClick={onClose}>
        close-drawer
      </button>
    </div>
  ),
}))
vi.mock('./FlushNamespaceButton', () => ({
  FlushNamespaceButton: () => <button type="button">Flush namespace</button>,
}))

/** Build a successful key-list page. */
function okPage(keys: string[]): ApiResult<KeyListResponse> {
  return { ok: true, data: { keys, cursor: null, strategy: 'scan' } }
}

/**
 * Render {@link ExplorerView} inside the nuqs testing adapter with optional
 * initial search params and an optional URL-write spy.
 *
 * @param searchParams - Initial URL search params for the nuqs state.
 * @param onUrlUpdate - Spy invoked on each URL write (to assert the exact param name).
 * @returns The render result.
 */
function renderView(searchParams = '', onUrlUpdate?: OnUrlUpdateFunction) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NuqsTestingAdapter searchParams={searchParams} {...(onUrlUpdate ? { onUrlUpdate } : {})}>
      {children}
    </NuqsTestingAdapter>
  )
  return render(<ExplorerView />, { wrapper })
}

beforeEach(() => {
  keysQuery.data = undefined
  keysQuery.isLoading = false
  keysQuery.hasNextPage = false
  keysQuery.isFetchingNextPage = false
  keysQuery.fetchNextPage = vi.fn()
})

describe('ExplorerView', () => {
  it('resolves a namespace-only pattern when no filters are set', () => {
    /*
     * Scenario: a fresh explorer with no tenant/prefix/pattern.
     * Rule it protects: the resolved KeyBuilder match is `namespace:*` with no
     * stray colon segments. The paragraph textContent also pins the `{' '}` spacer
     * literals flanking the mono match span, so blanking a spacer (which would fuse
     * the label or the trailing hint onto the pattern) is caught.
     */
    renderView()
    expect(screen.getByText('cache-example:*')).toBeInTheDocument()
    const matchLine = screen.getByText('cache-example:*').closest('p')
    expect(matchLine).not.toBeNull()
    expect(matchLine?.textContent).toContain('Resolved match: cache-example:*')
    expect(matchLine?.textContent).toContain('cache-example:* (via KeyBuilder)')
  })

  it('composes tenant, prefix and pattern segments into the resolved match', () => {
    /*
     * Scenario: a deep-linked explorer scoped to a tenant, prefix and id glob.
     * Rule it protects: tenant adds `tenant:<id>`, the prefix is appended, and the
     * pattern replaces the `*` id glob.
     */
    renderView('?tenant=acme&prefix=product&pattern=99')
    expect(screen.getByText('cache-example:tenant:acme:product:99')).toBeInTheDocument()
  })

  it('renders the key table for a successful, non-empty page', () => {
    /*
     * Scenario: the SCAN returned a page of keys.
     * Rule it protects: the happy path renders the table with the flattened keys.
     */
    keysQuery.data = { pages: [okPage(['cache-example:product:1', 'cache-example:product:2'])] }
    renderView()
    expect(screen.getByTestId('key-table')).toBeInTheDocument()
    expect(screen.getByTestId('key-count')).toHaveTextContent('2')
  })

  it('renders the cluster-mode notice when the API reports UNSUPPORTED_IN_CLUSTER', () => {
    /*
     * Scenario: the first page failed with the cluster-unsupported code.
     * Rule it protects: cluster mode replaces the table with its explanatory notice
     * and never renders the key table.
     */
    keysQuery.data = {
      pages: [
        {
          ok: false,
          error: {
            code: CACHE_ERROR_CODES.UNSUPPORTED_IN_CLUSTER,
            message: 'no scan in cluster',
            status: 500,
          },
        },
      ],
    }
    renderView()
    expect(screen.getByText(/Key browsing is unavailable in cluster mode/)).toBeInTheDocument()
    expect(screen.queryByTestId('key-table')).not.toBeInTheDocument()
  })

  it('renders the generic failed-list surface for a non-cluster error', () => {
    /*
     * Scenario: the first page failed with a non-cluster error.
     * Rule it protects: a generic error shows the "Failed to list keys" surface with
     * the API message, not the cluster notice.
     */
    keysQuery.data = {
      pages: [
        {
          ok: false,
          error: { code: 'cache.connection_failed', message: 'redis down', status: 500 },
        },
      ],
    }
    renderView()
    expect(screen.getByText('Failed to list keys')).toBeInTheDocument()
    expect(screen.getByText('redis down')).toBeInTheDocument()
    expect(screen.queryByTestId('key-table')).not.toBeInTheDocument()
  })

  it('disables the strategy toggle in cluster mode', () => {
    /*
     * Scenario: cluster mode propagates to the strategy toggle.
     * Rule it protects: ExplorerView passes `isClusterMode` so the toggle disables.
     */
    keysQuery.data = {
      pages: [
        {
          ok: false,
          error: {
            code: CACHE_ERROR_CODES.UNSUPPORTED_IN_CLUSTER,
            message: 'no scan in cluster',
            status: 500,
          },
        },
      ],
    }
    renderView()
    expect(screen.getByRole('button', { name: 'scan' })).toBeDisabled()
  })

  it('writes the chosen strategy to URL state when the toggle changes', async () => {
    /*
     * Scenario: the user selects the `keys` strategy.
     * Rule it protects: the strategy change handler runs `setStrategy`, surfacing the
     * O(N) warning that only the `keys` value produces. Asserting the literal
     * `strategy` param name pins the `useQueryState('strategy', …)` key so a mutant
     * renaming it (which keeps the round-trip self-consistent) is caught.
     */
    const user = userEvent.setup()
    const onUrlUpdate = vi.fn()
    renderView('', onUrlUpdate)
    await user.click(screen.getByRole('button', { name: 'keys' }))
    expect(screen.getByRole('status')).toHaveTextContent('O(N) — blocks the server')
    const last = onUrlUpdate.mock.calls.at(-1)?.[0]
    expect(last?.searchParams.get('strategy')).toBe('keys')
  })

  it('writes the prefix filter to URL state via the rail', async () => {
    /*
     * Scenario: the user picks the `product` prefix chip.
     * Rule it protects: the prefix change handler runs `setPrefix`, reflected in the
     * resolved KeyBuilder match.
     */
    const user = userEvent.setup()
    renderView()
    await user.click(screen.getByRole('button', { name: 'product' }))
    expect(screen.getByText('cache-example:product:*')).toBeInTheDocument()
  })

  it('toggles the type and has-TTL facets through their handlers', async () => {
    /*
     * Scenario: the user selects a data type and the has-TTL facet.
     * Rule it protects: the type and has-TTL change handlers run and write their
     * respective URL params. Asserting the exact `type`/`hasTtl` param names and
     * values pins both `useQueryState` keys and proves the rail's `onTypeChange` /
     * `onHasTtlChange` callbacks actually invoke the setters — a no-op handler mutant
     * would write nothing, and a renamed param would land under a different key.
     */
    const user = userEvent.setup()
    const onUrlUpdate = vi.fn()
    renderView('', onUrlUpdate)
    await user.click(screen.getByRole('button', { name: 'String' }))
    expect(onUrlUpdate.mock.calls.at(-1)?.[0]?.searchParams.get('type')).toBe('string')

    const ttlToggle = screen.getByRole('button', { name: 'Has TTL' })
    await user.click(ttlToggle)
    expect(ttlToggle).toHaveAttribute('aria-pressed', 'true')
    expect(onUrlUpdate.mock.calls.at(-1)?.[0]?.searchParams.get('hasTtl')).toBe('true')
  })

  it('opens the detail drawer when a key row is clicked', async () => {
    /*
     * Scenario: the user clicks a row in the table.
     * Rule it protects: the row click sets `selectedKey`, opening the drawer for it.
     */
    keysQuery.data = { pages: [okPage(['cache-example:product:42'])] }
    const user = userEvent.setup()
    renderView()
    expect(screen.getByTestId('drawer')).toHaveTextContent('closed')
    await user.click(screen.getByRole('button', { name: 'open-row' }))
    expect(screen.getByTestId('drawer')).toHaveTextContent('cache-example:product:42')
  })

  it('closes the detail drawer when it requests to close', async () => {
    /*
     * Scenario: the open drawer requests close.
     * Rule it protects: the drawer's `onClose` clears `selectedKey`, returning the
     * drawer to its closed state.
     */
    keysQuery.data = { pages: [okPage(['cache-example:product:42'])] }
    const user = userEvent.setup()
    renderView()
    await user.click(screen.getByRole('button', { name: 'open-row' }))
    expect(screen.getByTestId('drawer')).toHaveTextContent('cache-example:product:42')
    await user.click(screen.getByRole('button', { name: 'close-drawer' }))
    expect(screen.getByTestId('drawer')).toHaveTextContent('closed')
  })

  it('forwards the table load-more request to the infinite query', async () => {
    /*
     * Scenario: the key table asks ExplorerView for the next page.
     * Rule it protects: `handleLoadMore` calls through to the query's `fetchNextPage`.
     * The arrow-returning-undefined mutant (a no-op body that never calls through)
     * would leave the infinite query un-paged, so the spy must be invoked.
     */
    keysQuery.data = { pages: [okPage(['cache-example:product:1'])] }
    const user = userEvent.setup()
    renderView()
    await user.click(screen.getByRole('button', { name: 'load-more' }))
    expect(keysQuery.fetchNextPage).toHaveBeenCalledTimes(1)
  })
})
