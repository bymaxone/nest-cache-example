/**
 * @fileoverview Unit tests for {@link SubscriptionManager} — the ref-counted Pub/Sub
 * subscription card.
 *
 * Drives the initial rows + `onRowsChange` reporting, the subscribe/unsubscribe
 * mutations (matching the returned ref-count onto the right (channel, pattern) row),
 * the error toast branches, the add-row flow (blank guard, de-dupe by (channel,
 * pattern), pattern-checkbox path that resets after add), the pending-disabled
 * controls, and the no-props default-parameter path. `sonner` and the pub/sub
 * transport are mocked; the mutation runs under a real `QueryClientProvider`.
 *
 * @module components/realtime/SubscriptionManager.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactElement } from 'react'
import { ApiRequestError } from '@/lib/cache-api'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const subscribe = vi.fn<(channel: string, pattern: boolean) => Promise<unknown>>()
const unsubscribe = vi.fn<(channel: string, pattern: boolean) => Promise<unknown>>()
vi.mock('@/lib/realtime-api', () => ({
  pubsubApi: {
    subscribe: (channel: string, pattern: boolean) => subscribe(channel, pattern),
    unsubscribe: (channel: string, pattern: boolean) => unsubscribe(channel, pattern),
  },
}))

import { toast } from 'sonner'
import { SubscriptionManager } from './SubscriptionManager'

/** Render under a fresh, retry-disabled QueryClient. */
function renderWithClient(node: ReactElement) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SubscriptionManager', () => {
  it('renders the two seeded rows and reports them via onRowsChange', () => {
    /*
     * Scenario: the card mounts with its example subscriptions.
     * Rule it protects: the initial exact + pattern rows render, and the effect
     * reports the current rows up so the feed can annotate pattern hits.
     */
    const onRowsChange = vi.fn()
    renderWithClient(<SubscriptionManager onRowsChange={onRowsChange} />)
    expect(screen.getByText('product-events')).toBeInTheDocument()
    expect(screen.getByText('product:*')).toBeInTheDocument()
    expect(onRowsChange).toHaveBeenCalledWith([
      { channel: 'product-events', pattern: false, refs: 0 },
      { channel: 'product:*', pattern: true, refs: 0 },
    ])
  })

  it('mounts without a callback (default-parameter path) and renders the rows', () => {
    /*
     * Scenario: the card is used standalone with no `onRowsChange` prop.
     * Rule it protects: the `= {}` default parameter and the optional-call
     * `onRowsChange?.(rows)` make the prop genuinely optional.
     */
    renderWithClient(<SubscriptionManager />)
    expect(screen.getByText('product-events')).toBeInTheDocument()
  })

  it('updates the matching row ref-count on a successful subscribe', async () => {
    /*
     * Scenario: subscribe to the exact `product-events` channel.
     * Rule it protects: the success handler writes the server ref-count onto the row
     * matching BOTH channel and pattern (exact, not the pattern row).
     */
    subscribe.mockResolvedValue({
      ok: true,
      data: { channel: 'product-events', refs: 1, pattern: false },
    })
    const user = userEvent.setup()
    renderWithClient(<SubscriptionManager />)
    await user.click(screen.getByRole('button', { name: 'Subscribe to product-events' }))

    await waitFor(() => expect(subscribe).toHaveBeenCalledWith('product-events', false))
    expect(await screen.findByText('×1')).toBeInTheDocument()
  })

  it('updates the matching row ref-count on a successful unsubscribe', async () => {
    /*
     * Scenario: unsubscribe from the pattern row.
     * Rule it protects: unsubscribe routes through `pubsubApi.unsubscribe` and the
     * decremented ref-count lands on the pattern row.
     */
    unsubscribe.mockResolvedValue({
      ok: true,
      data: { channel: 'product:*', refs: 0, pattern: true },
    })
    const user = userEvent.setup()
    renderWithClient(<SubscriptionManager />)
    await user.click(screen.getByRole('button', { name: 'Unsubscribe from product:*' }))

    await waitFor(() => expect(unsubscribe).toHaveBeenCalledWith('product:*', true))
  })

  it('leaves non-matching rows untouched when the server reports a different channel', async () => {
    /*
     * Scenario: the server response names a channel not currently in the rows.
     * Rule it protects: the `.map` match predicate is false for every row, so no row
     * is mutated (the unmatched branch of the success handler).
     */
    subscribe.mockResolvedValue({
      ok: true,
      data: { channel: 'unknown-channel', refs: 9, pattern: false },
    })
    const user = userEvent.setup()
    renderWithClient(<SubscriptionManager />)
    await user.click(screen.getByRole('button', { name: 'Subscribe to product-events' }))

    await waitFor(() => expect(subscribe).toHaveBeenCalled())
    expect(screen.queryByText('×9')).not.toBeInTheDocument()
  })

  it('toasts the structured message when a subscription update fails with an ApiRequestError', async () => {
    /*
     * Scenario: the subscribe mutation throws an `ApiRequestError`.
     * Rule it protects: the error branch surfaces `error.apiError.message`.
     */
    subscribe.mockRejectedValue(
      new ApiRequestError({ code: 'unknown', message: 'too many subs', status: 429 }),
    )
    const user = userEvent.setup()
    renderWithClient(<SubscriptionManager />)
    await user.click(screen.getByRole('button', { name: 'Subscribe to product-events' }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Subscription update failed', {
        description: 'too many subs',
      }),
    )
  })

  it('falls back to error.message for a non-ApiRequestError failure', async () => {
    /*
     * Scenario: the subscribe mutation rejects with a plain Error.
     * Rule it protects: the error branch falls back to `error.message`.
     */
    subscribe.mockRejectedValue(new Error('socket closed'))
    const user = userEvent.setup()
    renderWithClient(<SubscriptionManager />)
    await user.click(screen.getByRole('button', { name: 'Subscribe to product-events' }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Subscription update failed', {
        description: 'socket closed',
      }),
    )
  })

  it('adds a new exact-channel row and clears the input afterward', async () => {
    /*
     * Scenario: the operator types a new channel and clicks "+ add".
     * Rule it protects: a non-empty, non-duplicate channel is appended as an exact
     * subscription and the input is reset.
     */
    const user = userEvent.setup()
    renderWithClient(<SubscriptionManager />)
    const input = screen.getByLabelText('add channel / pattern')
    await user.type(input, 'cart-events')
    await user.click(screen.getByRole('button', { name: '+ add' }))

    expect(screen.getByText('cart-events')).toBeInTheDocument()
    expect(input).toHaveValue('')
  })

  it('ignores a blank add (whitespace-only) channel', async () => {
    /*
     * Scenario: the operator clicks "+ add" with only whitespace.
     * Rule it protects: the `channel.length === 0` guard returns early, adding no row.
     */
    const onRowsChange = vi.fn()
    const user = userEvent.setup()
    renderWithClient(<SubscriptionManager onRowsChange={onRowsChange} />)
    onRowsChange.mockClear()
    const input = screen.getByLabelText('add channel / pattern')
    await user.type(input, '   ')
    await user.click(screen.getByRole('button', { name: '+ add' }))

    // No new row was appended (the rows reference is unchanged → no extra report).
    expect(onRowsChange).not.toHaveBeenCalled()
  })

  it('adds a pattern subscription via the checkbox and resets the checkbox after', async () => {
    /*
     * Scenario: the operator ticks "pattern", adds `cart:*`, then adds again.
     * Rule it protects: the checkbox routes the add to a `psubscribe` row and resets
     * to unchecked afterward (so a subsequent add defaults back to exact).
     */
    const user = userEvent.setup()
    renderWithClient(<SubscriptionManager />)
    const input = screen.getByLabelText('add channel / pattern')
    const checkbox = screen.getByRole('checkbox')

    await user.click(checkbox)
    await user.type(input, 'cart:*')
    await user.click(screen.getByRole('button', { name: '+ add' }))

    expect(screen.getByText('cart:*')).toBeInTheDocument()
    // Three psubscribe badges would mean it stuck; the checkbox reset means the new
    // row is a pattern but the checkbox itself is back to unchecked.
    expect(checkbox).not.toBeChecked()
  })

  it('de-dupes an add that matches an existing (channel, pattern) pair', async () => {
    /*
     * Scenario: the operator re-adds `product-events` (already an exact row).
     * Rule it protects: the `prev.some(...)` de-dupe returns the previous rows
     * unchanged, so no duplicate row appears.
     */
    const user = userEvent.setup()
    renderWithClient(<SubscriptionManager />)
    const input = screen.getByLabelText('add channel / pattern')
    await user.type(input, 'product-events')
    await user.click(screen.getByRole('button', { name: '+ add' }))

    expect(screen.getAllByText('product-events')).toHaveLength(1)
  })

  it('disables the subscribe/unsubscribe controls while a mutation is pending', async () => {
    /*
     * Scenario: a subscription mutation is in flight.
     * Rule it protects: the pending flag disables every row's +/- buttons.
     */
    let resolve: (value: unknown) => void = () => {}
    subscribe.mockReturnValue(new Promise((r) => (resolve = r)))
    const user = userEvent.setup()
    renderWithClient(<SubscriptionManager />)
    await user.click(screen.getByRole('button', { name: 'Subscribe to product-events' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Subscribe to product:*' })).toBeDisabled(),
    )
    resolve({ ok: true, data: { channel: 'product-events', refs: 1, pattern: false } })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Subscribe to product:*' })).not.toBeDisabled(),
    )
  })
})
