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

vi.mock('nuqs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('nuqs')>()),
  useQueryState: () => [false, vi.fn()] as const,
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
        : items.map((item, i) => <div key={getKey(item, i)}>{renderRow(item)}</div>)}
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
    render(<PubSubView />)
    expect(screen.getByTestId('publish-card')).toBeInTheDocument()
    expect(screen.getByTestId('subscription-manager')).toBeInTheDocument()
    expect(screen.getByText(/Channels are/)).toBeInTheDocument()
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
    socketEvents.push(channelEvent('cache-example:product-events', { type: 'price' }))
    render(<PubSubView />)
    const feed = screen.getByTestId('event-feed')
    expect(within(feed).getByText('product-events')).toBeInTheDocument()
    expect(within(feed).getByText('{"type":"price"}')).toBeInTheDocument()
    expect(within(feed).queryByText(/≈/)).not.toBeInTheDocument()
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
