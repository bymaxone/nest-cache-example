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

// Mutable virtual-window shape so a boundary test can place the LAST virtual item
// exactly on, or short of, the final loaded row — the only way to exercise the
// load-more guard's `>=` boundary deterministically in jsdom. `trailingOffset` is
// added to `count`: 1 (the default) emits the trailing out-of-range item; 0 lands
// the last item on the final row; -1 stops one row short. Reset to 1 before each test.
const virtualWindow = vi.hoisted(() => ({ trailingOffset: 1 }))

// Deterministic virtual-row windowing: TanStack Virtual's measurement is flaky in
// jsdom, so the virtualizer is stubbed to surface every row in order, which is
// exactly what the size polyfills aim for but cannot guarantee. The stub also
// invokes the `getScrollElement`/`estimateSize` option callbacks the component
// supplies (keeping that wiring exercised). An empty list yields no virtual items —
// exercising the load-more effect's `!last` early return — while a non-empty list
// emits `trailingOffset` extra items: at the default of 1 that trailing out-of-range
// item (which the real virtualizer can briefly produce mid-remeasure) makes the row
// map's `!row` guard render null for it.
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
        Array.from(
          { length: opts.count === 0 ? 0 : opts.count + virtualWindow.trailingOffset },
          (_, index) => ({
            index,
            key: index,
            start: index * 44,
            size: 44,
          }),
        ),
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
  virtualWindow.trailingOffset = 1
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
     * Rule it protects: each data row renders the key text, its data-type badge, the
     * lazy TTL ring (not the error dash), and the formatted byte size — so the TTL
     * cell's success branch renders the ring rather than falling through to `—`.
     */
    inspectByKey['cache-example:product:1'] = ok('string', 120, 256)
    render(<KeyTable keys={['cache-example:product:1']} />)
    expect(screen.getByText('cache-example:product:1')).toBeInTheDocument()
    expect(screen.getByText('string')).toBeInTheDocument()
    expect(screen.getByText('256 B')).toBeInTheDocument()
    // The TTL cell resolved successfully, so its `TtlRing` (an accessible SVG) renders
    // with the formatted countdown — not the `—` error placeholder.
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'TTL 02:00')
  })

  it.each([
    ['string', 'rgb(96, 165, 250)'],
    ['hash', 'rgb(168, 85, 247)'],
    ['set', 'rgb(34, 197, 94)'],
  ])('renders the %s type as a colored badge from its data-type meta', (type, expectedColor) => {
    /*
     * Scenario: a row whose type is one of the faceted Redis types (string/hash/set).
     * Rule it protects: a faceted type renders the `Badge` carrying its data-type meta
     * color inline — distinguishing the badge branch from the plain mono-text fallback.
     * Each type pins its own equality arm and the per-type literal in the guard.
     */
    inspectByKey['cache-example:typed:1'] = ok(type, 60, 64)
    render(<KeyTable keys={['cache-example:typed:1']} />)
    const badge = screen.getByText(type)
    expect(badge.style.color).toBe(expectedColor)
  })

  it('renders a non-facet type without the badge color (plain mono fallback)', () => {
    /*
     * Scenario: a row whose type is outside the faceted set (e.g. `list`).
     * Rule it protects: an unmapped type takes the plain-text branch, which carries no
     * inline color — confirming the type guard did not match and no badge was rendered.
     */
    inspectByKey['cache-example:queue:9'] = ok('list', 60, 64)
    render(<KeyTable keys={['cache-example:queue:9']} />)
    expect(screen.getByText('list').style.color).toBe('')
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

  it('highlights the selected row and forwards its key on click', async () => {
    /*
     * Scenario: a row matches the selected key.
     * Rule it protects: the `isSelected` branch applies the selection-highlight
     * affordance (`bg-brand-500/10`, the row's only DOM selection signal) to the matched
     * row, and a click forwards the row key to `onRowClick`.
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
    const row = screen.getByRole('button')
    expect(row).toHaveClass('bg-brand-500/10')
    await user.click(screen.getByText('cache-example:product:42'))
    expect(onRowClick).toHaveBeenCalledWith('cache-example:product:42')
  })

  it('does not highlight a row that is not the selected key', () => {
    /*
     * Scenario: a row whose key differs from `selectedKey` (or none is selected).
     * Rule it protects: the `selectedKey === row.original` guard is exact — an
     * unmatched row omits the `bg-brand-500/10` highlight (pins the equality and the
     * `isSelected && …` class toggle against always-on / inverted mutations).
     */
    inspectByKey['cache-example:product:7'] = ok('hash', 30, 128)
    render(
      <KeyTable keys={['cache-example:product:7']} selectedKey="cache-example:product:OTHER" />,
    )
    expect(screen.getByRole('button')).not.toHaveClass('bg-brand-500/10')
  })

  it('renders each data row as a full-width, color-transitioning button', () => {
    /*
     * Scenario: a single loaded key renders one data row button.
     * Rule it protects: the row carries its real structural classes — `w-full` (the
     * row spans the table) and `transition-colors` (the hover affordance) — so emptying
     * the row's base className string is caught. The selection highlight is a separate
     * conditional class covered by the highlight tests.
     */
    inspectByKey['cache-example:product:1'] = ok('string', 10, 16)
    render(<KeyTable keys={['cache-example:product:1']} />)
    const row = screen.getByRole('button')
    expect(row).toHaveClass('w-full')
    expect(row).toHaveClass('transition-colors')
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

  it('does not advance the cursor when no next page exists (the default)', () => {
    /*
     * Scenario: the last row is visible but `hasNextPage` is left at its default.
     * Rule it protects: `hasNextPage` defaults to `false` and gates the effect — with
     * no next page the cursor never advances. Pins the default against `true` and the
     * `&& hasNextPage` conjunction against being weakened to `||`.
     */
    inspectByKey['cache-example:product:1'] = ok('string', 10, 16)
    const onLoadMore = vi.fn()
    render(<KeyTable keys={['cache-example:product:1']} onLoadMore={onLoadMore} />)
    expect(onLoadMore).not.toHaveBeenCalled()
  })

  it('advances the cursor with the default isFetchingNextPage (false)', () => {
    /*
     * Scenario: a next page exists and `isFetchingNextPage` is left at its default.
     * Rule it protects: `isFetchingNextPage` defaults to `false`, so the `!isFetching`
     * guard passes and the cursor advances. Pins the default against `true` (which would
     * wrongly suppress the very first load-more).
     */
    inspectByKey['cache-example:product:1'] = ok('string', 10, 16)
    const onLoadMore = vi.fn()
    render(<KeyTable keys={['cache-example:product:1']} hasNextPage onLoadMore={onLoadMore} />)
    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('advances only when the LAST virtual row reaches the end of the loaded rows', () => {
    /*
     * Scenario: several loaded rows with a next page available.
     * Rule it protects: the effect reads the LAST virtual item (`at(-1)`), not an
     * arbitrary earlier one, before comparing its index to `rows.length - 1`. With more
     * than one row, a non-last item would fail the boundary and never load more — so
     * reading the final item is what lets the cursor advance here.
     */
    inspectByKey['cache-example:a'] = ok('string', 10, 16)
    inspectByKey['cache-example:b'] = ok('string', 10, 16)
    inspectByKey['cache-example:c'] = ok('string', 10, 16)
    const onLoadMore = vi.fn()
    render(
      <KeyTable
        keys={['cache-example:a', 'cache-example:b', 'cache-example:c']}
        hasNextPage
        onLoadMore={onLoadMore}
      />,
    )
    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('advances when the last virtual row lands exactly on the final loaded row', () => {
    /*
     * Scenario: the LAST virtual item's index equals `rows.length - 1` exactly (the
     * trailing out-of-range item is suppressed), with a next page available.
     * Rule it protects: the boundary comparison is `>=`, not `>`, so a last index
     * that merely reaches (not exceeds) the final row still advances the cursor —
     * `onLoadMore` fires exactly once. Pins `>=` against a `>` mutation.
     */
    virtualWindow.trailingOffset = 0
    inspectByKey['cache-example:product:1'] = ok('string', 10, 16)
    const onLoadMore = vi.fn()
    render(<KeyTable keys={['cache-example:product:1']} hasNextPage onLoadMore={onLoadMore} />)
    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('does not advance when the last virtual row stops short of the final loaded row', () => {
    /*
     * Scenario: the LAST virtual item's index is below `rows.length - 1` (the window
     * stops one row short) while a next page is available and none is loading.
     * Rule it protects: the guard genuinely gates on the last index reaching the end —
     * when it has not, the cursor must NOT advance. Pins the
     * `last.index >= rows.length - 1` comparison against being forced unconditionally true.
     */
    virtualWindow.trailingOffset = -1
    inspectByKey['cache-example:a'] = ok('string', 10, 16)
    inspectByKey['cache-example:b'] = ok('string', 10, 16)
    const onLoadMore = vi.fn()
    render(
      <KeyTable
        keys={['cache-example:a', 'cache-example:b']}
        hasNextPage
        onLoadMore={onLoadMore}
      />,
    )
    expect(onLoadMore).not.toHaveBeenCalled()
  })

  it('re-evaluates the cursor when hasNextPage flips from false to true', () => {
    /*
     * Scenario: a row is mounted with no next page, then a next page becomes available.
     * Rule it protects: the effect's dependency array re-runs the load-more check when
     * its inputs change. With an empty deps array the effect would never re-fire and the
     * newly available page would never load — here the flip must trigger exactly one call.
     */
    inspectByKey['cache-example:product:1'] = ok('string', 10, 16)
    const onLoadMore = vi.fn()
    const { rerender } = render(
      <KeyTable keys={['cache-example:product:1']} hasNextPage={false} onLoadMore={onLoadMore} />,
    )
    expect(onLoadMore).not.toHaveBeenCalled()
    rerender(<KeyTable keys={['cache-example:product:1']} hasNextPage onLoadMore={onLoadMore} />)
    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('reaches the end of the loaded rows without an onLoadMore handler safely', () => {
    /*
     * Scenario: the cursor reaches the end with a next page available but no handler.
     * Rule it protects: the load-more call is optional-chained (`onLoadMore?.()`), so an
     * omitted handler is a no-op rather than a thrown `TypeError`. The row still renders.
     */
    inspectByKey['cache-example:product:1'] = ok('string', 10, 16)
    expect(() => render(<KeyTable keys={['cache-example:product:1']} hasNextPage />)).not.toThrow()
    expect(screen.getByText('cache-example:product:1')).toBeInTheDocument()
  })

  it('renders the four column headers', () => {
    /*
     * Scenario: any rendered table (here, the empty state still draws the header row).
     * Rule it protects: the header row maps over the header group and renders each
     * column label — Key / Type / TTL / Size. Pins the header `.map` against returning
     * nothing (which would blank the column headers).
     */
    render(<KeyTable keys={[]} />)
    for (const header of ['Key', 'Type', 'TTL', 'Size']) {
      expect(screen.getByText(header)).toBeInTheDocument()
    }
  })

  it('renders the header row with its uppercase, separated styling', () => {
    /*
     * Scenario: any rendered table draws the header row.
     * Rule it protects: the header container carries its real structural styling —
     * the `uppercase` column-label treatment and the `border-b` divider that separates
     * it from the rows — so emptying the entire header className string is caught.
     */
    render(<KeyTable keys={[]} />)
    const headerRow = screen.getByText('Key').closest('div')
    expect(headerRow).toHaveClass('uppercase')
    expect(headerRow).toHaveClass('border-b')
  })

  it('does not throw when a row is clicked without an onRowClick handler', async () => {
    /*
     * Scenario: a clickable row rendered without an `onRowClick` callback.
     * Rule it protects: the click handler is optional-chained (`onRowClick?.(…)`), so a
     * click with no handler is a no-op rather than a thrown `TypeError`.
     */
    inspectByKey['cache-example:product:5'] = ok('string', 10, 16)
    const user = userEvent.setup()
    render(<KeyTable keys={['cache-example:product:5']} />)
    await user.click(screen.getByText('cache-example:product:5'))
    expect(screen.getByText('cache-example:product:5')).toBeInTheDocument()
  })
})
