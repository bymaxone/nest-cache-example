/**
 * @fileoverview Unit tests for {@link KeyTable} — the Explorer's virtualized key
 * browser. Mocks the lazy per-row `useKeyInspect` (dispatching by key so each
 * cell branch — loading skeleton, error dash, typed badge, non-facet type, TTL
 * ring, byte size — is exercised) and stubs `next/link`. The TanStack Virtual
 * row windowing is deterministically stubbed via `@tanstack/react-virtual` so
 * jsdom reliably yields the loaded rows (its measurement is non-deterministic
 * under jsdom even with the size polyfills). Covers the loading, empty, and data
 * states plus the selected-row highlight and the load-more cursor effect.
 *
 * @module components/explorer/KeyTable.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { type ApiResult } from '@/lib/api-client'
import { type KeyInspectResponse } from '@/lib/cache-api'
import { KeyTable } from './KeyTable'

// `next/link` renders a plain anchor here — routing is irrelevant to the table.
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

// Deterministic virtual-row windowing: TanStack Virtual's measurement is flaky in
// jsdom, so the virtualizer is stubbed to surface every row in order, which is
// exactly what the size polyfills aim for but cannot guarantee. The stub also
// invokes the `getScrollElement`/`estimateSize` option callbacks the component
// supplies (keeping that wiring exercised). An empty list yields no virtual items —
// exercising the load-more effect's `!last` early return — while a non-empty list
// emits one trailing out-of-range item (which the real virtualizer can briefly
// produce mid-remeasure) so the row map's `!row` guard renders null for it.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (opts: {
    count: number
    getScrollElement: () => Element | null
    estimateSize: (index: number) => number
  }) => {
    opts.getScrollElement()
    opts.estimateSize(0)
    return {
      getTotalSize: () => opts.count * 44,
      getVirtualItems: () =>
        Array.from({ length: opts.count === 0 ? 0 : opts.count + 1 }, (_, index) => ({
          index,
          key: index,
          start: index * 44,
          size: 44,
        })),
    }
  },
}))

/** Per-key inspect fixtures keyed by the row's key string. */
const inspectByKey: Record<string, ApiResult<KeyInspectResponse> | undefined> = {}

vi.mock('@/hooks/use-key-inspect', () => ({
  useKeyInspect: (key: string) => ({ data: inspectByKey[key] }),
}))

/** Build a successful inspection for a key. */
function ok(type: string, ttl: number, memoryBytes: number): ApiResult<KeyInspectResponse> {
  return {
    ok: true,
    data: { key: 'k', type, value: null, raw: null, ttl, memoryBytes },
  }
}

/**
 * Count the rendered `Skeleton` placeholders. The design-system Skeleton primitive
 * is a content-free div whose only observable affordance is its pulse animation —
 * this shadcn vintage carries no `data-slot` marker — so the `animate-pulse` class
 * is the stable, behavioral signal that a loading placeholder is on screen.
 */
function skeletonCount(container: HTMLElement): number {
  return container.querySelectorAll('.animate-pulse').length
}

beforeEach(() => {
  for (const key of Object.keys(inspectByKey)) delete inspectByKey[key]
})

describe('KeyTable', () => {
  it('renders skeleton rows while the first page is loading', () => {
    /*
     * Scenario: the initial SCAN is loading.
     * Rule it protects: the loading branch renders skeleton rows and no data rows.
     */
    const { container } = render(<KeyTable keys={[]} isLoading />)
    expect(skeletonCount(container)).toBeGreaterThan(0)
    expect(screen.queryByText(/No keys in this namespace/)).not.toBeInTheDocument()
  })

  it('renders the empty state with a Playground link when there are no keys', () => {
    /*
     * Scenario: the namespace has no keys.
     * Rule it protects: the empty branch prompts seeding from the Playground.
     */
    render(<KeyTable keys={[]} />)
    expect(screen.getByText('No keys in this namespace yet.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Seed one from the Playground/ })).toHaveAttribute(
      'href',
      '/playground',
    )
  })

  it('renders a row per key with its typed badge, TTL ring, and byte size', () => {
    /*
     * Scenario: a page of keys, each with a resolved string-type inspection.
     * Rule it protects: each data row renders the key text, its data-type badge, and
     * the formatted byte size from the lazy inspection.
     */
    inspectByKey['cache-example:product:1'] = ok('string', 120, 256)
    render(<KeyTable keys={['cache-example:product:1']} />)
    expect(screen.getByText('cache-example:product:1')).toBeInTheDocument()
    expect(screen.getByText('string')).toBeInTheDocument()
    expect(screen.getByText('256 B')).toBeInTheDocument()
  })

  it('renders the loading skeletons in each cell while a row inspection is pending', () => {
    /*
     * Scenario: a row whose inspection has not resolved.
     * Rule it protects: each cell (type/TTL/size) renders its own skeleton when the
     * inspect data is undefined.
     */
    inspectByKey['cache-example:product:2'] = undefined
    const { container } = render(<KeyTable keys={['cache-example:product:2']} />)
    expect(screen.getByText('cache-example:product:2')).toBeInTheDocument()
    expect(skeletonCount(container)).toBeGreaterThan(0)
  })

  it('renders the dash fallback in each cell when a row inspection errors', () => {
    /*
     * Scenario: a row whose inspection resolved a typed error.
     * Rule it protects: every cell renders the `—` placeholder on an error result.
     */
    inspectByKey['cache-example:product:3'] = {
      ok: false,
      error: { code: 'unknown', message: 'gone', status: 500 },
    }
    render(<KeyTable keys={['cache-example:product:3']} />)
    // Three dash placeholders — one per lazy cell (type/TTL/size).
    expect(screen.getAllByText('—')).toHaveLength(3)
  })

  it('renders a non-facet Redis type as plain mono text rather than a badge', () => {
    /*
     * Scenario: a row whose type is outside the string/hash/set facet (e.g. `list`).
     * Rule it protects: an unmapped type falls through to the mono text branch.
     */
    inspectByKey['cache-example:queue:1'] = ok('list', -1, 64)
    render(<KeyTable keys={['cache-example:queue:1']} />)
    expect(screen.getByText('list')).toBeInTheDocument()
  })

  it('highlights the selected row', async () => {
    /*
     * Scenario: a row matches the selected key.
     * Rule it protects: the `isSelected` branch renders (the row is still clickable),
     * and a click forwards the row key to `onRowClick`.
     */
    inspectByKey['cache-example:product:42'] = ok('hash', 30, 128)
    const onRowClick = vi.fn()
    const user = userEvent.setup()
    render(
      <KeyTable
        keys={['cache-example:product:42']}
        selectedKey="cache-example:product:42"
        onRowClick={onRowClick}
      />,
    )
    await user.click(screen.getByText('cache-example:product:42'))
    expect(onRowClick).toHaveBeenCalledWith('cache-example:product:42')
  })

  it('renders the next-page skeleton row while fetching the next page', () => {
    /*
     * Scenario: another page is loading behind the cursor.
     * Rule it protects: the `isFetchingNextPage` branch appends a skeleton row.
     */
    inspectByKey['cache-example:product:1'] = ok('set', 90, 32)
    const { container } = render(<KeyTable keys={['cache-example:product:1']} isFetchingNextPage />)
    expect(skeletonCount(container)).toBeGreaterThan(0)
  })

  it('advances the cursor when the viewport reaches the end with a next page available', () => {
    /*
     * Scenario: the last row is visible, a next page exists, and none is loading.
     * Rule it protects: the load-more effect fires `onLoadMore` exactly once.
     */
    inspectByKey['cache-example:product:1'] = ok('string', 10, 16)
    const onLoadMore = vi.fn()
    render(
      <KeyTable
        keys={['cache-example:product:1']}
        hasNextPage
        isFetchingNextPage={false}
        onLoadMore={onLoadMore}
      />,
    )
    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('does not advance the cursor when a next page is already loading', () => {
    /*
     * Scenario: the last row is visible but the next page is already loading.
     * Rule it protects: the effect's `!isFetchingNextPage` guard suppresses the
     * duplicate load-more call.
     */
    inspectByKey['cache-example:product:1'] = ok('string', 10, 16)
    const onLoadMore = vi.fn()
    render(
      <KeyTable
        keys={['cache-example:product:1']}
        hasNextPage
        isFetchingNextPage
        onLoadMore={onLoadMore}
      />,
    )
    expect(onLoadMore).not.toHaveBeenCalled()
  })
})
