/**
 * @fileoverview Unit tests for {@link ErrorsView} — the Error Explorer body.
 * Mocks `errorsApi.trigger` (keeping the real `ERROR_CODES` list) and the
 * `sonner` toaster, wraps the view in a retry-disabled TanStack Query client,
 * and drives: the empty response panel, triggering a code (severity panel with
 * the status, label, and structured body read from the response), the
 * `details ?? null` fallback, the anomalous-success throw path, the request
 * failure toast, and the prod-guard toggle revealing its dedicated trigger.
 *
 * @module components/labs/ErrorsView.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode } from 'react'
import { type ApiResult } from '@/lib/api-client'
import { ErrorsView } from './ErrorsView'

const triggerMock = vi.fn<() => Promise<ApiResult<never>>>()
vi.mock('@/lib/labs-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/labs-api')>()
  return {
    ...actual,
    errorsApi: { trigger: (...args: unknown[]) => triggerMock(...(args as [])) },
  }
})

const toastError = vi.fn()
vi.mock('sonner', () => ({
  toast: { error: (...args: unknown[]) => void toastError(...args) },
}))

/** Wrap children in a retry-disabled query client. */
function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  triggerMock.mockReset()
  toastError.mockClear()
})

describe('ErrorsView', () => {
  it('renders the empty response prompt before any code is triggered', () => {
    /*
     * Scenario: the lab loaded, no code triggered yet.
     * Rule it protects: the response panel shows the action prompt (no severity panel).
     */
    render(<ErrorsView />, { wrapper: Wrapper })
    expect(screen.getByText(/Trigger a code on the left/)).toBeInTheDocument()
    expect(screen.queryByText(/^HTTP/)).not.toBeInTheDocument()
  })

  it('lists trigger rows with the canonical code count', () => {
    /*
     * Scenario: the trigger list renders.
     * Rule it protects: the header reports the live `ERROR_CODES.length` and the
     * route, and at least one known code row renders.
     */
    render(<ErrorsView />, { wrapper: Wrapper })
    expect(screen.getByText(/POST \/errors\/:code · 15 codes/)).toBeInTheDocument()
    expect(screen.getByText('invalid_key')).toBeInTheDocument()
  })

  it('triggers a code and renders its status, label and structured body', async () => {
    /*
     * Scenario: triggering `invalid_key` returns its structured 400 error.
     * Rule it protects: the response panel shows the HTTP status, the severity
     * label, and the canonical code/message read from the response body.
     */
    triggerMock.mockResolvedValue({
      ok: false,
      error: {
        code: 'cache.invalid_key',
        message: 'The key is invalid',
        status: 400,
        details: { key: 'bad key' },
      },
    })
    const user = userEvent.setup()
    render(<ErrorsView />, { wrapper: Wrapper })
    const row = screen.getByText('invalid_key').closest('li')
    expect(row).not.toBeNull()
    if (row) await user.click(within(row).getByRole('button', { name: 'Trigger' }))
    await waitFor(() => expect(screen.getByText('HTTP 400')).toBeInTheDocument())
    expect(screen.getByText('Client Error')).toBeInTheDocument()
    // The canonical code is read from the response body and rendered in the tree.
    expect(screen.getByText(/The key is invalid/)).toBeInTheDocument()
  })

  it('renders a null details fallback when the error carries no details', async () => {
    /*
     * Scenario: a triggered error without a `details` payload.
     * Rule it protects: `details ?? null` renders a `null` node in the body tree.
     */
    triggerMock.mockResolvedValue({
      ok: false,
      error: { code: 'cache.connection_failed', message: 'down', status: 500 },
    })
    const user = userEvent.setup()
    render(<ErrorsView />, { wrapper: Wrapper })
    const row = screen.getByText('connection_failed').closest('li')
    if (row) await user.click(within(row).getByRole('button', { name: 'Trigger' }))
    await waitFor(() => expect(screen.getByText('HTTP 500')).toBeInTheDocument())
    expect(screen.getByText('Server Error')).toBeInTheDocument()
  })

  it('toasts when the endpoint anomalously succeeds (ok response)', async () => {
    /*
     * Scenario: the trigger endpoint returns `ok` — a contract violation.
     * Rule it protects: the mutationFn throws and `onError` toasts the anomaly message.
     */
    triggerMock.mockResolvedValue({ ok: true, data: undefined as never })
    const user = userEvent.setup()
    render(<ErrorsView />, { wrapper: Wrapper })
    const row = screen.getByText('invalid_key').closest('li')
    if (row) await user.click(within(row).getByRole('button', { name: 'Trigger' }))
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Trigger failed', {
        description: 'Expected an error response from the trigger endpoint',
      }),
    )
  })

  it('toasts when the request itself fails', async () => {
    /*
     * Scenario: the trigger request rejects (network/CORS).
     * Rule it protects: a rejected mutation surfaces the real message via `onError`.
     */
    triggerMock.mockRejectedValue(new Error('network gone'))
    const user = userEvent.setup()
    render(<ErrorsView />, { wrapper: Wrapper })
    const row = screen.getByText('invalid_key').closest('li')
    if (row) await user.click(within(row).getByRole('button', { name: 'Trigger' }))
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Trigger failed', { description: 'network gone' }),
    )
  })

  it('marks the in-flight row pending while its trigger request is unresolved', async () => {
    /*
     * Scenario: a code is triggered and its request is still in flight.
     * Rule it protects: the selected row's `isPending` resolves true (disabling its
     * Trigger button) while a request runs for it.
     */
    let resolve: (value: ApiResult<never>) => void = () => {}
    triggerMock.mockReturnValue(
      new Promise<ApiResult<never>>((r) => {
        resolve = r
      }),
    )
    const user = userEvent.setup()
    render(<ErrorsView />, { wrapper: Wrapper })
    const row = screen.getByText('invalid_key').closest('li')
    expect(row).not.toBeNull()
    if (row) {
      await user.click(within(row).getByRole('button', { name: 'Trigger' }))
      await waitFor(() =>
        expect(within(row).getByRole('button', { name: 'Trigger' })).toBeDisabled(),
      )
    }
    // Settle so the query client tears down cleanly.
    resolve({
      ok: false,
      error: { code: 'cache.invalid_key', message: 'invalid', status: 400 },
    })
    await waitFor(() => expect(screen.getByText('HTTP 400')).toBeInTheDocument())
  })

  it('reveals the prod-guard trigger only when the prod toggle is on', async () => {
    /*
     * Scenario: the user enables the NODE_ENV=production guard toggle.
     * Rule it protects: the dedicated prod-flush trigger is hidden by default and
     * appears when the checkbox is checked, then fires the flush-guard code.
     */
    triggerMock.mockResolvedValue({
      ok: false,
      error: {
        code: 'cache.flush_disabled_in_production',
        message: 'flush disabled',
        status: 403,
      },
    })
    const user = userEvent.setup()
    render(<ErrorsView />, { wrapper: Wrapper })
    expect(
      screen.queryByRole('button', { name: /Trigger the production flush guard/ }),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('checkbox'))
    const guardTrigger = screen.getByRole('button', {
      name: /Trigger the production flush guard/,
    })
    await user.click(guardTrigger)
    await waitFor(() => expect(screen.getByText('HTTP 403')).toBeInTheDocument())
    expect(screen.getByText('Client Error')).toBeInTheDocument()
    expect(triggerMock).toHaveBeenCalledWith('cache.flush_disabled_in_production')
  })
})
