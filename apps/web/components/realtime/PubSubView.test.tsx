/**
 * @fileoverview Unit tests for {@link PubSubView} — the Pub/Sub page body.
 *
 * Drives `deNamespace` (prefixed vs bare channel), `globToRegExp` (star collapse,
 * metachar escaping, `?` single-char, and the invalid-pattern catch → never-match),
 * the `activeMatchers` memo (only `pattern` rows compile), and the per-row pattern
 * annotation (matched → `≈ pattern`, unmatched → none). The socket buffer is mocked
 * via its hook; `nuqs`, the publish/subscription cards, and `EventFeed` are mocked
 * so the page's own filtering/matching logic is asserted in isolation.
 *
 * @module components/realtime/PubSubView.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { type ReactNode } from 'react'
import { type CacheEvent } from '@/lib/socket'
import { type SubscriptionRow } from './SubscriptionManager'

// Recording spy so the `useQueryState('live', …)` query-key the page subscribes to
// is observable; it still returns the inert `[false, setter]` pair.
const useQueryStateSpy = vi.fn<(...args: unknown[]) => unknown>(() => [false, vi.fn()])
vi.mock('nuqs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('nuqs')>()),
  useQueryState: (...args: unknown[]) => useQueryStateSpy(...args),
}))

const socketEvents: CacheEvent[] = []
vi.mock('@/hooks/use-cache-socket', () => ({
  useCacheSocket: () => ({ toArray: () => socketEvents }),
}))

vi.mock('./PublishCard', () => ({ PublishCard: () => <div data-testid="publish-card" /> }))

// Capture the SubscriptionManager's `onRowsChange` so a test can push active rows.
let reportRows: ((rows: readonly SubscriptionRow[]) => void) | undefined
vi.mock('./SubscriptionManager', () => ({
  SubscriptionManager: ({
    onRowsChange,
  }: {
    onRowsChange?: (rows: readonly SubscriptionRow[]) => void
  }) => {
    reportRows = onRowsChange
    return <div data-testid="subscription-manager" />
  },
}))

vi.mock('./EventFeed', () => ({
  EventFeed: ({
    items,
    emptyState,
    renderRow,
    getKey,
  }: {
    items: readonly CacheEvent[]
    emptyState: ReactNode
    renderRow: (item: CacheEvent) => ReactNode
    getKey: (item: CacheEvent, index: number) => string
  }) => (
    <div data-testid="event-feed">
      {items.length === 0
        ? emptyState
        : items.map((item, i) => (
            // Surface the caller's key so a test can assert `getKey` actually ran
            // (a `() => undefined` mutant would emit an empty `data-key`).
            <div key={getKey(item, i)} data-key={getKey(item, i)}>
              {renderRow(item)}
            </div>
          ))}
    </div>
  ),
}))

import { act } from '@testing-library/react'
import { PubSubView } from './PubSubView'

/** An `event`-kind socket event fixture. */
function channelEvent(channel: string, payload: unknown, seq = 1): CacheEvent {
  return { kind: 'event', seq, channel, payload, at: 1_700_000_000_000 }
}

beforeEach(() => {
  vi.clearAllMocks()
  socketEvents.length = 0
  reportRows = undefined
})

describe('PubSubView', () => {
  it('renders the publish + subscription cards and the namespaced explainer', () => {
    /*
     * Scenario: the page mounts.
     * Rule it protects: it composes the publish and subscription cards and shows the
     * namespace-teaching callout.
     */
    const { container } = render(<PubSubView />)
    // The page binds the global Live toggle to the `live` query-key (a blanked key
    // string would subscribe to the wrong param and never gate the socket buffer).
    expect(useQueryStateSpy).toHaveBeenCalledWith('live', expect.anything())
    expect(screen.getByTestId('publish-card')).toBeInTheDocument()
    expect(screen.getByTestId('subscription-manager')).toBeInTheDocument()
    expect(screen.getByText(/Channels are/)).toBeInTheDocument()
    // The callout teaches namespacing with a literal example; these emphasized
    // fragments must survive (StringLiteral guards on the inline `<span>` text).
    expect(screen.getByText('namespaced')).toBeInTheDocument()
    expect(screen.getByText("publish('product-events')")).toBeInTheDocument()
    // The `{' '}` separators around those inline `<span>` terms render real spaces;
    // a blanked space literal would weld the emphasized example to the prose.
    const text = container.textContent ?? ''
    expect(text).toContain('namespaced: publish')
    expect(text).toContain("publish('product-events') hits")
  })

  it('shows the feed empty state when no channel events are buffered', () => {
    /*
     * Scenario: no `cache:event` messages.
     * Rule it protects: the feed renders its action-oriented empty state.
     */
    render(<PubSubView />)
    expect(screen.getByText(/No messages yet/)).toBeInTheDocument()
  })

  it('de-namespaces the channel and renders the payload for a buffered message', () => {
    /*
     * Scenario: a namespaced message is buffered.
     * Rule it protects: `deNamespace` strips the `cache-example:` prefix for display
     * and the JSON payload is shown; with no active pattern rows, no `≈` annotation.
     */
    socketEvents.push(channelEvent('cache-example:product-events', { type: 'price' }, 7))
    render(<PubSubView />)
    const feed = screen.getByTestId('event-feed')
    expect(within(feed).getByText('product-events')).toBeInTheDocument()
    expect(within(feed).getByText('{"type":"price"}')).toBeInTheDocument()
    expect(within(feed).queryByText(/≈/)).not.toBeInTheDocument()
    // The row key is derived from `String(event.seq)`; a `() => undefined` getKey
    // mutant would leave the row's `data-key` empty.
    expect(feed.querySelector('[data-key="7"]')).not.toBeNull()
  })

  it('leaves a non-namespaced channel name untouched', () => {
    /*
     * Scenario: a message on a channel without the app prefix.
     * Rule it protects: the `startsWith(prefix)` guard's false branch returns the
     * channel verbatim.
     */
    socketEvents.push(channelEvent('foreign-channel', 1))
    render(<PubSubView />)
    expect(
      within(screen.getByTestId('event-feed')).getByText('foreign-channel'),
    ).toBeInTheDocument()
  })

  it('renders Pub/Sub messages newest-first and excludes non-event buffer entries', () => {
    /*
     * Scenario: the buffer holds a connection-kind entry plus two `cache:event`
     * messages in arrival order.
     * Rule it protects: the feed reads `buffer.toArray().filter(kind === 'event')
     * .slice().reverse()`. The `.filter` drops the connection entry (which has no
     * `channel`/`payload` and would crash `deNamespace`), and `.reverse()` flips the
     * oldest-first buffer to newest-first — so `second` renders above `first`.
     */
    socketEvents.push(
      { kind: 'connection', seq: 1, event: 'ready', data: {}, at: 1_700_000_000_000 },
      channelEvent('cache-example:first', 1, 2),
      channelEvent('cache-example:second', 2, 3),
    )
    render(<PubSubView />)
    const feed = screen.getByTestId('event-feed')
    const channelNames = within(feed)
      .getAllByText(/^(first|second)$/)
      .map((node) => node.textContent)
    // Newest-first: the later-arriving `second` precedes `first`; `ready` is excluded.
    expect(channelNames).toEqual(['second', 'first'])
  })

  it('annotates a row with the matching glob pattern (star + ? compiled to a matcher)', () => {
    /*
     * Scenario: an active `product:*?` pattern subscription and a matching message.
     * Rule it protects: `globToRegExp` compiles `*` (→ `.*`) and `?` (→ `.`); the
     * per-row `activeMatchers.find` finds the match and renders `≈ product:*?`.
     */
    socketEvents.push(channelEvent('cache-example:product:42', 'x'))
    render(<PubSubView />)
    act(() => {
      reportRows?.([
        { channel: 'product:*?', pattern: true, refs: 1 },
        // An exact (non-pattern) row is filtered out of the matchers.
        { channel: 'cart-events', pattern: false, refs: 0 },
      ])
    })
    expect(within(screen.getByTestId('event-feed')).getByText('≈ product:*?')).toBeInTheDocument()
  })

  it('never annotates from an exact (non-pattern) subscription, even on a name match', () => {
    /*
     * Scenario: the only active row is an EXACT subscription whose channel equals the
     * message channel.
     * Rule it protects: `activeMatchers` is built by `subs.filter(row => row.pattern)
     * .map(...)` — only pattern rows compile a matcher. An exact row must never
     * annotate. Dropping the `.filter().map()` chain (so `activeMatchers` is the raw
     * rows) would leave matchers without a `.regExp`, throwing on `.regExp.test`; the
     * filtered, matcher-free result instead renders cleanly with no `≈`.
     */
    socketEvents.push(channelEvent('cache-example:orders', 'x'))
    render(<PubSubView />)
    act(() => {
      reportRows?.([{ channel: 'orders', pattern: false, refs: 0 }])
    })
    const feed = screen.getByTestId('event-feed')
    expect(within(feed).getByText('orders')).toBeInTheDocument()
    expect(within(feed).queryByText(/≈/)).not.toBeInTheDocument()
  })

  it('does not annotate a row when no active pattern matches', () => {
    /*
     * Scenario: an active pattern that does not match the message channel.
     * Rule it protects: `activeMatchers.find` returns undefined, so the optional
     * `pattern ?` annotation branch renders nothing.
     */
    socketEvents.push(channelEvent('cache-example:order:1', 'x'))
    render(<PubSubView />)
    act(() => {
      reportRows?.([{ channel: 'product:*', pattern: true, refs: 1 }])
    })
    expect(within(screen.getByTestId('event-feed')).queryByText(/≈/)).not.toBeInTheDocument()
  })

  it('compiles an invalid glob (unbalanced class) to a never-matching pattern', () => {
    /*
     * Scenario: an active pattern with an unbalanced character class.
     * Rule it protects: the `new RegExp` throws and the catch returns `/$^/`, which
     * matches nothing — so even a plausible channel gets no annotation.
     */
    socketEvents.push(channelEvent('cache-example:weird', 'x'))
    render(<PubSubView />)
    act(() => {
      reportRows?.([{ channel: 'weird[', pattern: true, refs: 1 }])
    })
    expect(within(screen.getByTestId('event-feed')).queryByText(/≈/)).not.toBeInTheDocument()
  })

  it('compiles `?` to a single-character matcher (matches one char, not zero)', () => {
    /*
     * Scenario: a `cart:?` pattern and a `cart:1` channel (exactly one char after the
     * colon).
     * Rule it protects: `globToRegExp` rewrites `?` to `.` (any single char) via
     * `.replace(/\?/g, '.')`. Replacing the `.` with `''` would delete the `?` instead,
     * turning `cart:?` into `cart:` and matching `cart:1` only by accident of `.*`; here
     * the trailing single char is mandatory, so the matcher must annotate `cart:1`.
     */
    socketEvents.push(channelEvent('cache-example:cart:1', 'x'))
    render(<PubSubView />)
    act(() => {
      reportRows?.([{ channel: 'cart:?', pattern: true, refs: 1 }])
    })
    expect(within(screen.getByTestId('event-feed')).getByText('≈ cart:?')).toBeInTheDocument()
  })

  it('does not match `?` against a missing character (mandatory single char)', () => {
    /*
     * Scenario: the same `cart:?` pattern but a `cart:` channel with no trailing char.
     * Rule it protects: `?` → `.` requires exactly one char, so `cart:` does NOT match.
     * The `'.'` → `''` mutant would turn `cart:?` into `^cart:$`, which WOULD match
     * `cart:` — so the absence of an annotation here pins the single-char semantics.
     */
    socketEvents.push(channelEvent('cache-example:cart:', 'x'))
    render(<PubSubView />)
    act(() => {
      reportRows?.([{ channel: 'cart:?', pattern: true, refs: 1 }])
    })
    expect(within(screen.getByTestId('event-feed')).queryByText(/≈/)).not.toBeInTheDocument()
  })

  it('escapes regex metacharacters in a glob so they match literally', () => {
    /*
     * Scenario: a pattern containing a literal dot.
     * Rule it protects: `globToRegExp` escapes `.` so `a.b` matches the literal
     * `a.b` channel (not "a<any>b"); the matcher annotates the row.
     */
    socketEvents.push(channelEvent('cache-example:a.b', 'x'))
    render(<PubSubView />)
    act(() => {
      reportRows?.([{ channel: 'a.b', pattern: true, refs: 1 }])
    })
    expect(within(screen.getByTestId('event-feed')).getByText('≈ a.b')).toBeInTheDocument()
  })
})
