/**
 * @fileoverview Unit tests for {@link PublishCard} — the Pub/Sub publish form.
 *
 * Drives the JSON-validation fork (`parsePayload` invalid → inline error + toast,
 * no mutation; valid → mutate), the success path (subscriber count surfaced inline
 * + success toast), both error-toast branches (`ApiRequestError` structured message
 * vs a plain `Error.message`), the pending button-label/disabled state, and the
 * empty-channel disabled guard. `sonner` and the publish transport are mocked; the
 * mutation runs under a real `QueryClientProvider`.
 *
 * @module components/realtime/PublishCard.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactElement } from 'react'
import { ApiRequestError } from '@/lib/cache-api'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const publish = vi.fn<(channel: string, message: unknown) => Promise<unknown>>()
vi.mock('@/lib/realtime-api', () => ({
  pubsubApi: { publish: (channel: string, message: unknown) => publish(channel, message) },
}))

import { toast } from 'sonner'
import { PublishCard } from './PublishCard'

/** Render under a fresh, retry-disabled QueryClient so failures resolve immediately. */
function renderWithClient(node: ReactElement) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
  publish.mockResolvedValue({ ok: true, data: { channel: 'product-events', subscribers: 3 } })
})

describe('PublishCard', () => {
  it('publishes a valid payload, surfacing the subscriber count inline and as a toast', async () => {
    /*
     * Scenario: the operator publishes the default valid JSON payload.
     * Rule it protects: `parsePayload` succeeds, the mutation fires, and on success
     * the subscriber count is shown inline and a success toast is raised.
     */
    const user = userEvent.setup()
    renderWithClient(<PublishCard />)
    await user.click(screen.getByRole('button', { name: 'Publish' }))

    await waitFor(() => expect(publish).toHaveBeenCalledWith('product-events', expect.anything()))
    expect(toast.success).toHaveBeenCalledWith('Published', {
      description: 'Delivered to 3 subscriber(s) on product-events',
    })
    expect(await screen.findByText('3')).toBeInTheDocument()
  })

  it('blocks submit and shows an inline + toast error for invalid JSON', async () => {
    /*
     * Scenario: the payload textarea holds malformed JSON.
     * Rule it protects: the invalid branch sets the inline error, toasts it, and
     * never calls the publish transport.
     */
    const user = userEvent.setup()
    renderWithClient(<PublishCard />)
    const payload = screen.getByLabelText('payload (JSON)')
    await user.clear(payload)
    await user.type(payload, 'not json{{')
    await user.click(screen.getByRole('button', { name: 'Publish' }))

    expect(screen.getByText('Payload is not valid JSON')).toBeInTheDocument()
    expect(toast.error).toHaveBeenCalledWith('Payload is not valid JSON')
    expect(publish).not.toHaveBeenCalled()
  })

  it('clears a prior inline JSON error once a valid payload is submitted', async () => {
    /*
     * Scenario: the operator fixes invalid JSON and resubmits.
     * Rule it protects: a successful parse resets `jsonError` to null, removing the
     * inline error message.
     */
    const user = userEvent.setup()
    renderWithClient(<PublishCard />)
    const payload = screen.getByLabelText('payload (JSON)')
    await user.clear(payload)
    await user.type(payload, 'bad')
    await user.click(screen.getByRole('button', { name: 'Publish' }))
    expect(screen.getByText('Payload is not valid JSON')).toBeInTheDocument()

    await user.clear(payload)
    await user.type(payload, '123')
    await user.click(screen.getByRole('button', { name: 'Publish' }))
    await waitFor(() => expect(publish).toHaveBeenCalled())
    expect(screen.queryByText('Payload is not valid JSON')).not.toBeInTheDocument()
  })

  it('toasts the structured message when the publish fails with an ApiRequestError', async () => {
    /*
     * Scenario: the transport unwrap throws an `ApiRequestError`.
     * Rule it protects: the error branch prefers `error.apiError.message` for a
     * structured API failure.
     */
    publish.mockRejectedValue(
      new ApiRequestError({ code: 'unknown', message: 'channel rejected', status: 400 }),
    )
    const user = userEvent.setup()
    renderWithClient(<PublishCard />)
    await user.click(screen.getByRole('button', { name: 'Publish' }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Publish failed', {
        description: 'channel rejected',
      }),
    )
  })

  it('falls back to error.message for a non-ApiRequestError failure', async () => {
    /*
     * Scenario: the transport rejects with a plain Error (e.g. network).
     * Rule it protects: the error branch falls back to `error.message` when the
     * error is not an `ApiRequestError`.
     */
    publish.mockRejectedValue(new Error('network down'))
    const user = userEvent.setup()
    renderWithClient(<PublishCard />)
    await user.click(screen.getByRole('button', { name: 'Publish' }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Publish failed', { description: 'network down' }),
    )
  })

  it('disables the Publish button when the channel is blank', async () => {
    /*
     * Scenario: the channel input is cleared.
     * Rule it protects: `channel.trim().length === 0` disables the publish button so
     * an empty-channel publish cannot fire.
     */
    const user = userEvent.setup()
    renderWithClient(<PublishCard />)
    const channel = screen.getByLabelText('channel')
    await user.clear(channel)
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
  })

  it('shows the pending label and disables the button while publishing', async () => {
    /*
     * Scenario: a publish round-trip is in flight.
     * Rule it protects: while pending the button reads "Publishing…" and is disabled,
     * preventing a duplicate publish.
     */
    let resolvePublish: (value: unknown) => void = () => {}
    publish.mockReturnValue(new Promise((resolve) => (resolvePublish = resolve)))
    const user = userEvent.setup()
    renderWithClient(<PublishCard />)
    await user.click(screen.getByRole('button', { name: 'Publish' }))

    const pendingButton = await screen.findByRole('button', { name: 'Publishing…' })
    expect(pendingButton).toBeDisabled()

    resolvePublish({ ok: true, data: { channel: 'product-events', subscribers: 1 } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument())
  })
})
