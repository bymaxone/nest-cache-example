/**
 * @fileoverview Unit tests for {@link EventFeed} — the generic bounded follow-mode
 * live feed shared by the real-time pages.
 *
 * Covers the empty vs populated fork, the `maxRendered` DOM cap, the
 * `getKey`/`renderRow` slots, the default vs explicit `ariaLabel`, the arrival
 * registration on length change (and the no-false-arrival on mount), and the
 * "N new — jump to latest" pill that appears only while un-pinned. The real
 * {@link useFollowMode} hook is exercised through DOM scroll events.
 *
 * @module components/realtime/EventFeed.test
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EventFeed } from './EventFeed'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** A trivial numeric item type for the generic feed. */
interface Item {
  id: number
}

/** Render the feed with sensible defaults plus per-test overrides. */
function renderFeed(items: readonly Item[], maxRendered?: number, ariaLabel?: string) {
  return render(
    <EventFeed<Item>
      items={items}
      getKey={(item) => String(item.id)}
      renderRow={(item) => <span>row-{item.id}</span>}
      emptyState={<span>nothing here yet</span>}
      {...(maxRendered !== undefined ? { maxRendered } : {})}
      {...(ariaLabel !== undefined ? { ariaLabel } : {})}
    />,
  )
}

describe('EventFeed', () => {
  it('renders the empty state and the default aria label when there are no items', () => {
    /*
     * Scenario: a feed mounted with no events.
     * Rule it protects: the empty branch shows the action-oriented empty state, and
     * the scroll region carries the default "Live event feed" accessible label.
     */
    renderFeed([])
    expect(screen.getByText('nothing here yet')).toBeInTheDocument()
    expect(screen.getByRole('log', { name: 'Live event feed' })).toBeInTheDocument()
  })

  it('renders one row per item via getKey/renderRow and honours a custom aria label', () => {
    /*
     * Scenario: a populated feed with a bespoke region label.
     * Rule it protects: the populated branch maps each item through `renderRow`, and
     * the explicit `ariaLabel` overrides the default.
     */
    renderFeed([{ id: 1 }, { id: 2 }], undefined, 'My feed')
    expect(screen.getByText('row-1')).toBeInTheDocument()
    expect(screen.getByText('row-2')).toBeInTheDocument()
    expect(screen.getByRole('log', { name: 'My feed' })).toBeInTheDocument()
  })

  it('caps the rendered rows at maxRendered, keeping the newest (top) slice', () => {
    /*
     * Scenario: more items than the DOM cap.
     * Rule it protects: when `items.length > maxRendered`, only the first
     * `maxRendered` (newest, since the list is newest-first) are rendered.
     */
    const items: Item[] = Array.from({ length: 5 }, (_, i) => ({ id: i }))
    renderFeed(items, 3)
    // The first three (ids 0,1,2) are kept; the older 3,4 are dropped from the DOM.
    expect(screen.getByText('row-0')).toBeInTheDocument()
    expect(screen.getByText('row-2')).toBeInTheDocument()
    expect(screen.queryByText('row-3')).not.toBeInTheDocument()
    expect(screen.queryByText('row-4')).not.toBeInTheDocument()
  })

  it('renders every row when the item count is within the cap', () => {
    /*
     * Scenario: fewer items than the cap.
     * Rule it protects: the `items.length > maxRendered ? slice : items` branch
     * keeps the full list when under the cap.
     */
    renderFeed([{ id: 7 }, { id: 8 }], 10)
    expect(screen.getByText('row-7')).toBeInTheDocument()
    expect(screen.getByText('row-8')).toBeInTheDocument()
  })

  it('does not show the "N new" pill on mount even when pre-populated', () => {
    /*
     * Scenario: a feed mounted with a pre-filled buffer.
     * Rule it protects: the arrival effect computes a delta of 0 on mount (prev = the
     * initial length), so no false "N new" pill flashes while pinned at the top.
     */
    renderFeed([{ id: 1 }, { id: 2 }])
    expect(screen.queryByText(/jump to latest/)).not.toBeInTheDocument()
  })

  it('surfaces and dismisses the "N new — jump to latest" pill across un-pin and arrivals', async () => {
    /*
     * Scenario: the reader scrolls into history, new events arrive, then they jump back.
     * Rule it protects: scrolling away un-pins; subsequent arrivals bump `newCount`
     * and render the pill; clicking it re-pins and clears the count (the pill hides).
     */
    const user = userEvent.setup()
    const { rerender } = render(
      <EventFeed<Item>
        items={[{ id: 1 }]}
        getKey={(item) => String(item.id)}
        renderRow={(item) => <span>row-{item.id}</span>}
        emptyState={<span>empty</span>}
      />,
    )

    // Un-pin by scrolling the log region away from the top edge. jsdom does not
    // implement `Element.scrollTo`, which `jumpToLatest` calls; stub it here.
    const region = screen.getByRole('log')
    Object.defineProperty(region, 'scrollTo', { value: vi.fn(), configurable: true })
    Object.defineProperty(region, 'scrollTop', { value: 100, configurable: true })
    fireEvent.scroll(region)

    // A new event arrives while un-pinned → the pill appears with the new count.
    rerender(
      <EventFeed<Item>
        items={[{ id: 0 }, { id: 1 }]}
        getKey={(item) => String(item.id)}
        renderRow={(item) => <span>row-{item.id}</span>}
        emptyState={<span>empty</span>}
      />,
    )
    const pill = await screen.findByRole('button', { name: /1 new — jump to latest/ })
    expect(pill).toBeInTheDocument()

    // Jumping to latest re-pins and clears the count, hiding the pill.
    await user.click(pill)
    expect(screen.queryByText(/jump to latest/)).not.toBeInTheDocument()
  })

  it('re-pins and hides the pill when the reader scrolls back to the top', () => {
    /*
     * Scenario: the reader scrolls down (un-pin), an event arrives, then scrolls back up.
     * Rule it protects: `onScroll` at the top edge re-pins and resets `newCount`, so
     * the pill disappears without needing the explicit jump button.
     */
    const { rerender } = render(
      <EventFeed<Item>
        items={[{ id: 1 }]}
        getKey={(item) => String(item.id)}
        renderRow={(item) => <span>row-{item.id}</span>}
        emptyState={<span>empty</span>}
      />,
    )
    const region = screen.getByRole('log')
    Object.defineProperty(region, 'scrollTop', { value: 100, configurable: true })
    fireEvent.scroll(region)

    rerender(
      <EventFeed<Item>
        items={[{ id: 0 }, { id: 1 }]}
        getKey={(item) => String(item.id)}
        renderRow={(item) => <span>row-{item.id}</span>}
        emptyState={<span>empty</span>}
      />,
    )
    expect(screen.getByText(/1 new/)).toBeInTheDocument()

    // Scroll back to the top edge → re-pin, clear count, hide pill.
    Object.defineProperty(region, 'scrollTop', { value: 0, configurable: true })
    fireEvent.scroll(region)
    expect(screen.queryByText(/jump to latest/)).not.toBeInTheDocument()
  })
})
