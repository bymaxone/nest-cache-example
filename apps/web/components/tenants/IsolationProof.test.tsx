/**
 * @fileoverview Unit tests for {@link IsolationProof} — the namespace-boundary proof.
 *
 * The two `tenantsApi` calls (`seedForeign`, `proveIsolation`) are mocked while the
 * real `unwrap`/`ApiRequestError` stay live, so a `{ ok: false }` transport result
 * becomes a genuinely rejected mutation. Drives: the foreign-seed success/failure
 * toasts, the flush-and-verify success panel (both the `foreignKeySurvived` SURVIVED
 * and removed arms), the guarded `403` `ApiRequestError` rendering the inline severity
 * alert (no toast), the network-layer `Error` falling back to a toast (no alert), and
 * the in-flight "Flushing…" label. Mutations run under a real, retry-disabled
 * `QueryClientProvider`; `sonner` is mocked.
 *
 * @module components/tenants/IsolationProof.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactElement } from 'react'
import { IsolationProof } from './IsolationProof'

/** The two transport calls the proof issues, hoisted for the partial module mock. */
const { seedForeign, proveIsolation } = vi.hoisted(() => ({
  seedForeign: vi.fn(),
  proveIsolation: vi.fn(),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// Replace only the transport methods; `unwrap`/`ApiRequestError` stay real so an
// `{ ok: false }` result throws the same structured error the production code sees.
vi.mock('@/lib/cache-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/cache-api')>()
  return { ...actual, tenantsApi: { seedForeign, proveIsolation } }
})

import { toast } from 'sonner'

/** Render under a fresh, retry-disabled QueryClient so failures resolve immediately. */
function renderWithClient(node: ReactElement) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
  seedForeign.mockResolvedValue({ ok: true, data: { key: 'other-app:demo', written: true } })
  proveIsolation.mockResolvedValue({
    ok: true,
    data: { flushedNamespaceKeys: 5, foreignKeySurvived: true },
  })
})

describe('IsolationProof', () => {
  it('renders the controls with no result panel or alert before any action', () => {
    /*
     * Scenario: the proof band is first mounted.
     * Rule it protects: the `prove.data` and `proveError && severity` branches both
     * start false — no success panel and no error alert until an action runs.
     */
    renderWithClient(<IsolationProof />)
    expect(screen.getByRole('button', { name: /Seed FOREIGN namespace/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Flush namespace & verify' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText(/SURVIVED/)).not.toBeInTheDocument()
  })

  it('toasts the written key after seeding the foreign namespace', async () => {
    /*
     * Scenario: the operator seeds the foreign `other-app:*` key.
     * Rule it protects: the seed `onSuccess` toasts the written key returned by the
     * unwrapped transport result.
     */
    const user = userEvent.setup()
    renderWithClient(<IsolationProof />)
    await user.click(screen.getByRole('button', { name: /Seed FOREIGN namespace/ }))

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Wrote foreign key other-app:demo'),
    )
  })

  it('toasts the error message when seeding the foreign namespace fails', async () => {
    /*
     * Scenario: the foreign-seed transport returns a structured failure.
     * Rule it protects: `unwrap` throws an `ApiRequestError` which routes to the seed
     * `onError`, surfacing the message as a toast.
     */
    seedForeign.mockResolvedValue({
      ok: false,
      error: { code: 'unknown', message: 'seed rejected', status: 500 },
    })
    const user = userEvent.setup()
    renderWithClient(<IsolationProof />)
    await user.click(screen.getByRole('button', { name: /Seed FOREIGN namespace/ }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('seed rejected'))
  })

  it('renders the success panel with the survived foreign key after a flush', async () => {
    /*
     * Scenario: the flush clears the namespace and the foreign key survives.
     * Rule it protects: the `prove.data` panel reports the cleared count and the
     * `foreignKeySurvived` true arm reads "SURVIVED".
     */
    const user = userEvent.setup()
    renderWithClient(<IsolationProof />)
    await user.click(screen.getByRole('button', { name: 'Flush namespace & verify' }))

    expect(await screen.findByText(/Cleared 5 keys under cache-example/)).toBeInTheDocument()
    expect(screen.getByText(/SURVIVED/)).toBeInTheDocument()
  })

  it('reports an unexpectedly-removed foreign key when it did not survive', async () => {
    /*
     * Scenario: the flush removed the foreign key (the boundary failed).
     * Rule it protects: the `foreignKeySurvived` false arm reads "was unexpectedly
     * removed" instead of "SURVIVED".
     */
    proveIsolation.mockResolvedValue({
      ok: true,
      data: { flushedNamespaceKeys: 2, foreignKeySurvived: false },
    })
    const user = userEvent.setup()
    renderWithClient(<IsolationProof />)
    await user.click(screen.getByRole('button', { name: 'Flush namespace & verify' }))

    expect(await screen.findByText(/was unexpectedly removed/)).toBeInTheDocument()
  })

  it('renders the inline severity alert (and no toast) for a guarded 403', async () => {
    /*
     * Scenario: the flush is blocked by the production guard (403).
     * Rule it protects: an `ApiRequestError` is rendered as the inline severity alert
     * (label · status, code, message) and, being structured, is NOT toasted.
     */
    proveIsolation.mockResolvedValue({
      ok: false,
      error: {
        code: 'cache.flush_disabled_in_production',
        message: 'Flush is disabled in production',
        status: 403,
      },
    })
    const user = userEvent.setup()
    renderWithClient(<IsolationProof />)
    await user.click(screen.getByRole('button', { name: 'Flush namespace & verify' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Client Error · 403')
    expect(alert).toHaveTextContent('cache.flush_disabled_in_production')
    expect(alert).toHaveTextContent('Flush is disabled in production')
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('falls back to a toast (and no alert) for a network-layer failure', async () => {
    /*
     * Scenario: the flush rejects with a plain Error (no decoded API error).
     * Rule it protects: a non-`ApiRequestError` failure is toasted and renders no
     * inline alert, since there is no `apiError` to display.
     */
    proveIsolation.mockRejectedValue(new Error('network down'))
    const user = userEvent.setup()
    renderWithClient(<IsolationProof />)
    await user.click(screen.getByRole('button', { name: 'Flush namespace & verify' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('network down'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the Flushing… label and disables the button while verifying', async () => {
    /*
     * Scenario: a flush-and-verify round-trip is in flight.
     * Rule it protects: the `prove.isPending` branch swaps the label to "Flushing…"
     * and disables the button to prevent a duplicate flush.
     */
    let resolveProve: (value: unknown) => void = () => {}
    proveIsolation.mockReturnValue(
      new Promise((resolve) => {
        resolveProve = resolve
      }),
    )
    const user = userEvent.setup()
    renderWithClient(<IsolationProof />)
    await user.click(screen.getByRole('button', { name: 'Flush namespace & verify' }))

    const flushing = await screen.findByRole('button', { name: 'Flushing…' })
    expect(flushing).toBeDisabled()
    resolveProve({ ok: true, data: { flushedNamespaceKeys: 0, foreignKeySurvived: true } })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Flush namespace & verify' })).toBeInTheDocument(),
    )
  })
})
