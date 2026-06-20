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

/**
 * Render under a fresh, retry-disabled QueryClient so failures resolve immediately.
 * The client is returned so tests can assert the cache invalidations the proof fires.
 */
function renderWithClient(node: ReactElement) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const result = render(<QueryClientProvider client={client}>{node}</QueryClientProvider>)
  return { ...result, client }
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
    const { container } = renderWithClient(<IsolationProof />)
    expect(screen.getByRole('button', { name: /Seed FOREIGN namespace/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Flush namespace & verify' })).toBeInTheDocument()
    // The explanatory note names the foreign key the anti-pattern writes.
    expect(screen.getByText(/other-app:demo/)).toBeInTheDocument()
    // The `{' '}` between "via raw" and the inline `getClient()` span renders a real
    // space; a blanked space literal would weld them into "rawgetClient()".
    expect(container.textContent).toContain('via raw getClient()')
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
     * Rule it protects: the `prove.data` panel reports the cleared count, names the
     * surviving `other-app:demo` key, reads "SURVIVED" (the `foreignKeySurvived` true
     * arm), and both result lines plus the panel border paint the design-system green
     * (the inline `style` colour/border objects, not color-blank).
     */
    const user = userEvent.setup()
    renderWithClient(<IsolationProof />)
    await user.click(screen.getByRole('button', { name: 'Flush namespace & verify' }))

    const cleared = await screen.findByText(/Cleared 5 keys under cache-example/)
    expect(cleared).toBeInTheDocument()
    const survived = screen.getByText(/SURVIVED/)
    expect(survived).toBeInTheDocument()
    // The success panel names the foreign key AND its verdict with the `{' '}` space
    // between them intact ("other-app:demo SURVIVED"), so a blanked space literal that
    // welds them into "other-app:demoSURVIVED" is caught.
    expect(survived).toHaveTextContent('other-app:demo SURVIVED')
    // Both result lines are painted the design-system green via the inline style color.
    expect(cleared).toHaveStyle({ color: '#22c55e' })
    expect(survived).toHaveStyle({ color: '#22c55e' })
    // The bordered panel wrapping the two lines carries the green accent border.
    expect(cleared.closest('div')).toHaveStyle({ borderColor: '#22c55e' })
  })

  it('invalidates the keys and keyspace caches after a successful flush', async () => {
    /*
     * Scenario: a flush succeeds and must refresh the dependent views.
     * Rule it protects: the `prove` `onSuccess` invalidates BOTH the keys and the
     * keyspace query roots (the two `queryKey` arrays), so the explorer/keyspace
     * surfaces re-fetch after the namespace is cleared.
     */
    const user = userEvent.setup()
    const { client } = renderWithClient(<IsolationProof />)
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    await user.click(screen.getByRole('button', { name: 'Flush namespace & verify' }))

    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['keys'] }))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['keyspace'] })
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
    // The 4xx severity palette is amber; the alert border and the label span both
    // paint `severity.color`, so a blanked inline style is detectable.
    expect(alert).toHaveStyle({ borderColor: '#f59e0b' })
    expect(screen.getByText(/Client Error/)).toHaveStyle({ color: '#f59e0b' })
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
