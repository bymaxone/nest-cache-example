/**
 * @fileoverview Unit tests for {@link FlushNamespaceButton} — the guarded
 * namespace-flush action. Mocks the `useFlushNamespace` mutation hook and the
 * `sonner` toaster to drive every branch: opening/closing the confirm dialog
 * (with the reset-on-close path), the idle vs pending button label, a successful
 * flush (toast + close), and a structured `ApiRequestError` rendering the
 * severity alert inline while keeping the dialog open.
 *
 * @module components/explorer/FlushNamespaceButton.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiRequestError } from '@/lib/cache-api'
import { type ApiError } from '@/lib/api-client'
import { FlushNamespaceButton } from './FlushNamespaceButton'

const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => void toastSuccess(...args),
    error: (...args: unknown[]) => void toastError(...args),
  },
}))

/** The mutation surface the component reads — controlled per test. */
interface FlushMock {
  mutate: ReturnType<typeof vi.fn>
  reset: ReturnType<typeof vi.fn>
  isPending: boolean
  error: Error | null
}

const flushMock: FlushMock = {
  mutate: vi.fn(),
  reset: vi.fn(),
  isPending: false,
  error: null,
}

vi.mock('@/hooks/use-cache-mutations', () => ({
  useFlushNamespace: () => flushMock,
}))

beforeEach(() => {
  flushMock.mutate = vi.fn()
  flushMock.reset = vi.fn()
  flushMock.isPending = false
  flushMock.error = null
  toastSuccess.mockClear()
  toastError.mockClear()
})

describe('FlushNamespaceButton', () => {
  it('opens the confirmation dialog from the trigger without resetting the mutation', async () => {
    /*
     * Scenario: the user clicks the page-header flush trigger.
     * Rule it protects: the destructive confirm dialog opens with its full warning copy,
     * and the `if (!open) flush.reset()` guard fires reset ONLY on close — opening must
     * NOT reset (forcing the guard true, or dropping the `!`, would reset on open).
     */
    const user = userEvent.setup()
    render(<FlushNamespaceButton />)
    await user.click(screen.getByRole('button', { name: /Flush namespace/ }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/This deletes every key under/)).toBeInTheDocument()
    expect(screen.getByText(/This cannot be undone/)).toBeInTheDocument()
    // Opening the dialog must not reset the mutation — only closing does.
    expect(flushMock.reset).not.toHaveBeenCalled()
  })

  it('shows the idle Flush label and confirms a flush, toasting and closing on success', async () => {
    /*
     * Scenario: the user confirms a flush that succeeds.
     * Rule it protects: the confirm button reads "Flush" while idle, invokes the
     * mutation, and the success callback toasts the flushed count and closes.
     */
    flushMock.mutate = vi.fn(
      (_input: undefined, opts: { onSuccess: (r: { flushed: number }) => void }) => {
        opts.onSuccess({ flushed: 7 })
      },
    )
    const user = userEvent.setup()
    render(<FlushNamespaceButton />)
    await user.click(screen.getByRole('button', { name: /Flush namespace/ }))
    await user.click(screen.getByRole('button', { name: 'Flush' }))
    expect(flushMock.mutate).toHaveBeenCalledTimes(1)
    expect(toastSuccess).toHaveBeenCalledWith('Flushed 7 keys from cache-example')
    // The dialog closes after a successful flush.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the pending label and disables the confirm button while flushing', async () => {
    /*
     * Scenario: a flush request is in flight.
     * Rule it protects: the confirm button reads "Flushing…" and is disabled.
     */
    flushMock.isPending = true
    const user = userEvent.setup()
    render(<FlushNamespaceButton />)
    await user.click(screen.getByRole('button', { name: /Flush namespace/ }))
    const confirm = screen.getByRole('button', { name: 'Flushing…' })
    expect(confirm).toBeDisabled()
  })

  it('renders the structured severity alert for an ApiRequestError', async () => {
    /*
     * Scenario: the flush is rejected by the production guard (403).
     * Rule it protects: an `ApiRequestError` surfaces the severity label, the
     * status, the canonical code, and the message inline (color + icon + text).
     */
    const apiError: ApiError = {
      code: 'cache.flush_disabled_in_production',
      message: 'Flush is disabled in production',
      status: 403,
    }
    flushMock.error = new ApiRequestError(apiError)
    const user = userEvent.setup()
    render(<FlushNamespaceButton />)
    await user.click(screen.getByRole('button', { name: /Flush namespace/ }))
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Client Error · 403')
    expect(alert).toHaveTextContent('cache.flush_disabled_in_production')
    expect(alert).toHaveTextContent('Flush is disabled in production')
    // The 4xx severity palette is amber; the alert border and the label span both paint
    // `severity.color` via inline style, so a blanked style object is detectable.
    expect(alert).toHaveStyle({ borderColor: '#f59e0b' })
    expect(screen.getByText(/Client Error/)).toHaveStyle({ color: '#f59e0b' })
  })

  it('resets the mutation when the dialog is closed via Cancel', async () => {
    /*
     * Scenario: the user opens then cancels the dialog.
     * Rule it protects: closing the dialog runs the mutation reset so a stale error
     * never lingers for the next open.
     */
    const user = userEvent.setup()
    render(<FlushNamespaceButton />)
    await user.click(screen.getByRole('button', { name: /Flush namespace/ }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(flushMock.reset).toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
