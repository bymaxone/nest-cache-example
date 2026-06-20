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

// Render the structured body as its serialized form so ErrorsView's own
// `{ error: { code, message, details: details ?? null } }` shaping is observable —
// the real tree (covered by its own spec) collapses nested nodes and does not expose
// a `null` leaf as plain matchable text, which hides the `details ?? null` fallback.
vi.mock('@/components/ui/json-tree', () => ({
  JsonTree: ({ value }: { value: unknown }) => (
    <pre data-testid="json-tree">{JSON.stringify(value)}</pre>
  ),
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
    // No severity label is shown either: pins the `response && meta && ResponseIcon`
    // gate so a mutant forcing the panel branch on (which would dereference the
    // undefined meta) cannot quietly render an empty severity row.
    expect(screen.queryByText('Client Error')).not.toBeInTheDocument()
    expect(screen.queryByText('Server Error')).not.toBeInTheDocument()
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
    // With a present `details` payload the body keeps it (`details ?? null`), so no
    // `null` node appears in the tree: pins the nullish-coalescing so a mutant that
    // swaps `??` for `&&` (which would null out a populated details object) is caught.
    expect(screen.queryByText('null')).not.toBeInTheDocument()
    // The serialized body keeps the populated details object verbatim. Under the
    // `details && null` mutant it would collapse to `"details":null`, so pinning the
    // exact serialized object kills that nullish-coalescing swap.
    expect(screen.getByTestId('json-tree')).toHaveTextContent('"details":{"key":"bad key"}')
    // The status pill carries the severity className plus the inline severity color
    // (4xx amber #f59e0b → rgb) and the translucent background (`${color}1f` → rgba),
    // so an emptied className/style object or a blanked background template fails.
    const statusBadge = screen.getByText('HTTP 400')
    expect(statusBadge).toHaveClass(
      'rounded-full',
      'px-2',
      'py-0.5',
      'font-mono',
      'text-xs',
      'font-semibold',
    )
    expect(statusBadge.style.color).toBe('rgb(245, 158, 11)')
    expect(statusBadge.style.backgroundColor).toBe('rgba(245, 158, 11, 0.12)')
    const severityIcon = statusBadge.parentElement?.querySelector<SVGElement>('svg')
    if (!severityIcon) throw new Error('expected the severity icon svg')
    expect(severityIcon.style.color).toBe('rgb(245, 158, 11)')
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
    // No `details` on the error → `details ?? null` serializes an explicit
    // `"details":null`. The `details && null` mutant yields `undefined`, which
    // `JSON.stringify` drops entirely, so asserting the literal null key kills it.
    expect(screen.getByTestId('json-tree')).toHaveTextContent('"details":null')
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
    // Only the in-flight row disables: every other row stays enabled because
    // `isPending` is `trigger.isPending && selectedCode === code`. Pinning a sibling
    // row enabled catches a mutant that ORs the two flags (which would disable the
    // whole list during any request) or forces the per-row code match always-true.
    const otherRow = screen.getByText('connection_failed').closest('li')
    expect(otherRow).not.toBeNull()
    if (otherRow) {
      expect(within(otherRow).getByRole('button', { name: 'Trigger' })).toBeEnabled()
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

  it('rings the triggered row and leaves the other rows unringed', async () => {
    /*
     * Scenario: triggering `invalid_key` selects its row.
     * Rule it protects: `isSelected = selectedCode === code` adds the
     * `ring-1 ring-brand-500/40` accent to the triggered row only. A forced
     * true/false condition would ring every row or none, and an inverted equality
     * would ring the wrong rows — so the selected row must carry the ring and a
     * sibling must not.
     */
    triggerMock.mockResolvedValue({
      ok: false,
      error: { code: 'cache.invalid_key', message: 'The key is invalid', status: 400 },
    })
    const user = userEvent.setup()
    render(<ErrorsView />, { wrapper: Wrapper })
    const selectedRow = screen.getByText('invalid_key').closest('li')
    expect(selectedRow).not.toBeNull()
    if (selectedRow) {
      await user.click(within(selectedRow).getByRole('button', { name: 'Trigger' }))
    }
    await waitFor(() => expect(screen.getByText('HTTP 400')).toBeInTheDocument())
    expect(selectedRow).toHaveClass('ring-1', 'ring-brand-500/40')
    const otherRow = screen.getByText('connection_failed').closest('li')
    expect(otherRow).not.toHaveClass('ring-1')
  })

  it('renders the prod-guard explainer with intact spacing between its segments', () => {
    /*
     * Scenario: the static NODE_ENV=production guard explainer label.
     * Rule it protects: the `{' '}` spacer literals between the bold lead-in, the
     * `flushNamespace` mention, the 403 code, and the NODE_ENV hint are preserved —
     * blanking any spacer would fuse two words, so the label textContent pins the
     * spaced boundaries.
     */
    render(<ErrorsView />, { wrapper: Wrapper })
    const guardLabel = screen.getByText('Run API as NODE_ENV=production.').closest('label')
    expect(guardLabel).not.toBeNull()
    expect(guardLabel?.textContent).toContain('NODE_ENV=production. The live')
    expect(guardLabel?.textContent).toContain('returns 403 cache.flush_disabled_in_production')
    expect(guardLabel?.textContent).toContain('cache.flush_disabled_in_production in production')
    expect(guardLabel?.textContent).toContain('start the API with NODE_ENV=production')
  })
})
