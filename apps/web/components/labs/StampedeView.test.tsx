/**
 * @fileoverview Unit tests for {@link StampedeView} — the Stampede Lab body.
 * Mocks the `stampedeApi.run` transport and the `sonner` toaster, wraps the view
 * in a retry-disabled TanStack Query client, and drives the empty state, a
 * successful burst (timeline + result strip + script SHA + load-reduction math),
 * the structured `ApiRequestError` failure path, the input clamping for the Fire
 * label, and the disabled-fire guard for an empty productId.
 *
 * @module components/labs/StampedeView.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode } from 'react'
import { type ApiResult } from '@/lib/api-client'
import { type StampedeResult } from '@/lib/labs-api'
import { StampedeView } from './StampedeView'

const runMock = vi.fn<() => Promise<ApiResult<StampedeResult>>>()
vi.mock('@/lib/labs-api', () => ({
  stampedeApi: { run: (...args: unknown[]) => runMock(...(args as [])) },
}))

const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => void toastSuccess(...args),
    error: (...args: unknown[]) => void toastError(...args),
  },
}))

/** A successful burst result with one origin fetch and nine cache hits. */
function okBurst(): ApiResult<StampedeResult> {
  return {
    ok: true,
    data: {
      productId: '77',
      timeline: [
        {
          index: 0,
          token: 'win',
          role: 'won',
          outcome: 'origin',
          startedAt: 1_000,
          finishedAt: 1_100,
          durationMs: 100,
        },
        {
          index: 1,
          token: 'wait',
          role: 'waited',
          outcome: 'hit',
          startedAt: 1_010,
          finishedAt: 1_060,
          durationMs: 50,
        },
      ],
      summary: { concurrency: 10, originFetches: 1, cacheHits: 9, hitRate: 0.9 },
      script: { name: 'acquireLock', sha: 'abcdef1234567890' },
    },
  }
}

/** Wrap children in a retry-disabled query client. */
function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  runMock.mockReset()
  toastSuccess.mockClear()
  toastError.mockClear()
})

describe('StampedeView', () => {
  it('shows the action-oriented empty state before the first burst', () => {
    /*
     * Scenario: the lab has just loaded, no burst fired.
     * Rule it protects: the empty state prompts the user to fire a burst, and no
     * result strip is shown yet.
     */
    render(<StampedeView />, { wrapper: Wrapper })
    expect(screen.getByText(/Fire a burst above/)).toBeInTheDocument()
    expect(screen.queryByText('hit rate')).not.toBeInTheDocument()
  })

  it('clamps the concurrency input into the Fire button label', async () => {
    /*
     * Scenario: the user enters an over-max concurrency (999).
     * Rule it protects: `clampInt` floors it to the 100 max, reflected in the
     * "Fire 100 requests" button label.
     */
    const user = userEvent.setup()
    render(<StampedeView />, { wrapper: Wrapper })
    const concurrency = screen.getByLabelText('concurrency')
    await user.clear(concurrency)
    await user.type(concurrency, '999')
    expect(screen.getByRole('button', { name: 'Fire 100 requests' })).toBeInTheDocument()
  })

  it('accepts edits to the lockMs control', async () => {
    /*
     * Scenario: the user changes the lock TTL field.
     * Rule it protects: the lockMs input is controlled and reflects typed edits.
     */
    const user = userEvent.setup()
    render(<StampedeView />, { wrapper: Wrapper })
    const lockMs = screen.getByLabelText('lockMs')
    await user.clear(lockMs)
    await user.type(lockMs, '500')
    expect(lockMs).toHaveValue(500)
  })

  it('falls back to the default Fire count when concurrency is not a number', async () => {
    /*
     * Scenario: the concurrency field is emptied (NaN parse).
     * Rule it protects: a non-finite parse uses the default count (10) in the label.
     */
    const user = userEvent.setup()
    render(<StampedeView />, { wrapper: Wrapper })
    const concurrency = screen.getByLabelText('concurrency')
    await user.clear(concurrency)
    expect(screen.getByRole('button', { name: 'Fire 10 requests' })).toBeInTheDocument()
  })

  it('disables Fire when the productId is blank', async () => {
    /*
     * Scenario: the user clears the productId field.
     * Rule it protects: a blank (trimmed) productId disables the Fire button.
     */
    const user = userEvent.setup()
    render(<StampedeView />, { wrapper: Wrapper })
    await user.clear(screen.getByLabelText('productId'))
    expect(screen.getByRole('button', { name: /Fire/ })).toBeDisabled()
  })

  it('runs a burst and renders the timeline, result strip, script SHA, and reduction', async () => {
    /*
     * Scenario: a successful single-flight collapse (1 origin / 9 hits of 10).
     * Rule it protects: the timeline renders, the result strip shows the counts and
     * hit rate, the script SHA is truncated, the load-reduction is `concurrency /
     * originFetches`×, and the success toast fires.
     */
    runMock.mockResolvedValue(okBurst())
    const user = userEvent.setup()
    render(<StampedeView />, { wrapper: Wrapper })
    await user.click(screen.getByRole('button', { name: /Fire/ }))
    await waitFor(() => expect(screen.getByText('hit rate')).toBeInTheDocument())
    expect(screen.getByText('origin fetches')).toBeInTheDocument()
    expect(screen.getByText('1 / 10')).toBeInTheDocument()
    expect(screen.getByText('9 / 10')).toBeInTheDocument()
    expect(screen.getByText('90.0%')).toBeInTheDocument()
    // load reduction = concurrency / originFetches = 10 / 1 = 10×.
    expect(screen.getByText('10×')).toBeInTheDocument()
    // The script SHA is truncated to ten chars + ellipsis.
    expect(screen.getByText('abcdef1234…')).toBeInTheDocument()
    expect(screen.getByText('acquireLock')).toBeInTheDocument()
    expect(toastSuccess).toHaveBeenCalledWith('Burst complete', {
      description: '1 origin fetch · 9 hits',
    })
  })

  it('uses concurrency as the reduction when no origin fetch occurred', async () => {
    /*
     * Scenario: a degenerate burst with zero origin fetches.
     * Rule it protects: the reduction falls back to the raw concurrency (no divide).
     */
    const burst = okBurst()
    const result = burst.ok
      ? {
          ...burst,
          data: {
            ...burst.data,
            summary: { concurrency: 4, originFetches: 0, cacheHits: 4, hitRate: 1 },
          },
        }
      : burst
    runMock.mockResolvedValue(result)
    const user = userEvent.setup()
    render(<StampedeView />, { wrapper: Wrapper })
    await user.click(screen.getByRole('button', { name: /Fire/ }))
    await waitFor(() => expect(screen.getByText('4×')).toBeInTheDocument())
  })

  it('shows the Firing label and the skeleton while a burst is in flight', async () => {
    /*
     * Scenario: a burst is fired but has not resolved yet.
     * Rule it protects: the in-flight state reads "Firing…" on the button and shows
     * the timeline skeleton instead of the empty state.
     */
    let resolve: (value: ApiResult<StampedeResult>) => void = () => {}
    runMock.mockReturnValue(
      new Promise<ApiResult<StampedeResult>>((r) => {
        resolve = r
      }),
    )
    const user = userEvent.setup()
    render(<StampedeView />, { wrapper: Wrapper })
    await user.click(screen.getByRole('button', { name: /Fire/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Firing…' })).toBeInTheDocument())
    // The skeleton replaces the empty state while the request is pending.
    expect(screen.queryByText(/Fire a burst above/)).not.toBeInTheDocument()
    // Resolve so the query client settles before teardown.
    resolve(okBurst())
    await waitFor(() => expect(screen.getByText('hit rate')).toBeInTheDocument())
  })

  it('toasts the structured error message when the burst fails', async () => {
    /*
     * Scenario: the burst endpoint returns a structured cache error.
     * Rule it protects: an `ApiRequestError` (from `unwrap`) surfaces its message
     * via the error toast, and the empty state remains.
     */
    runMock.mockResolvedValue({
      ok: false,
      error: { code: 'cache.script_execution_failed', message: 'Lua blew up', status: 500 },
    })
    const user = userEvent.setup()
    render(<StampedeView />, { wrapper: Wrapper })
    await user.click(screen.getByRole('button', { name: /Fire/ }))
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Stampede failed', { description: 'Lua blew up' }),
    )
  })

  it('toasts a plain error message when the run rejects with a non-API error', async () => {
    /*
     * Scenario: the run rejects with a generic Error (network/CORS).
     * Rule it protects: the non-`ApiRequestError` branch uses the error's own message.
     */
    runMock.mockRejectedValue(new Error('network down'))
    const user = userEvent.setup()
    render(<StampedeView />, { wrapper: Wrapper })
    await user.click(screen.getByRole('button', { name: /Fire/ }))
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Stampede failed', { description: 'network down' }),
    )
  })

  it('reflects the typed productId in the namespace callout', async () => {
    /*
     * Scenario: the user changes the productId.
     * Rule it protects: the eval-namespace callout interpolates the current
     * productId (the `productId || '77'` branch uses the live value).
     */
    const user = userEvent.setup()
    render(<StampedeView />, { wrapper: Wrapper })
    const product = screen.getByLabelText('productId')
    await user.clear(product)
    await user.type(product, '99')
    expect(screen.getByText('cache-example:stampede:99')).toBeInTheDocument()
  })

  it('sends the trimmed productId and clamped numeric fields to the run endpoint', async () => {
    /*
     * Scenario: the productId has surrounding whitespace; concurrency/lockMs are default.
     * Rule it protects: the mutation body is the real `{ productId: trim(), concurrency,
     * lockMs }` object — not an empty object — and `productId.trim()` strips the
     * whitespace before the request is sent.
     */
    runMock.mockResolvedValue(okBurst())
    const user = userEvent.setup()
    render(<StampedeView />, { wrapper: Wrapper })
    const product = screen.getByLabelText('productId')
    await user.clear(product)
    await user.type(product, '  abc  ')
    await user.click(screen.getByRole('button', { name: /Fire/ }))
    await waitFor(() => expect(runMock).toHaveBeenCalledTimes(1))
    expect(runMock).toHaveBeenCalledWith({ productId: 'abc', concurrency: 10, lockMs: 2000 })
  })

  it('disables Fire when the productId is only whitespace', async () => {
    /*
     * Scenario: the productId field holds spaces only.
     * Rule it protects: the disabled guard trims before measuring length, so a
     * whitespace-only productId is treated as blank and disables Fire — a dropped
     * `.trim()` would leave the button enabled.
     */
    const user = userEvent.setup()
    render(<StampedeView />, { wrapper: Wrapper })
    const product = screen.getByLabelText('productId')
    await user.clear(product)
    await user.type(product, '   ')
    expect(screen.getByRole('button', { name: /Fire/ })).toBeDisabled()
  })

  it('computes load reduction as concurrency ÷ originFetches', async () => {
    /*
     * Scenario: a burst with concurrency 10 and two origin fetches.
     * Rule it protects: reduction = round(concurrency / originFetches) = round(10/2)
     * = 5× — distinguishing the division from a multiplication mutant (which would
     * read 20×) and pinning the `originFetches > 0` guard as taken.
     */
    const burst = okBurst()
    const result = burst.ok
      ? {
          ...burst,
          data: {
            ...burst.data,
            summary: { concurrency: 10, originFetches: 2, cacheHits: 8, hitRate: 0.8 },
          },
        }
      : burst
    runMock.mockResolvedValue(result)
    const user = userEvent.setup()
    render(<StampedeView />, { wrapper: Wrapper })
    await user.click(screen.getByRole('button', { name: /Fire/ }))
    await waitFor(() => expect(screen.getByText('5×')).toBeInTheDocument())
    expect(screen.queryByText('20×')).not.toBeInTheDocument()
  })

  it('labels the script SHA strip and the namespace callout with their literal prefixes', async () => {
    /*
     * Scenario: a successful burst plus the default productId in the callout.
     * Rule it protects: the SHA strip renders the literal `script:`/`sha:` labels and
     * the callout renders the `eval` / namespaced-key explainer text — pinning those
     * string literals against empty-string mutants.
     */
    runMock.mockResolvedValue(okBurst())
    const user = userEvent.setup()
    render(<StampedeView />, { wrapper: Wrapper })
    await user.click(screen.getByRole('button', { name: /Fire/ }))
    await waitFor(() => expect(screen.getByText('acquireLock')).toBeInTheDocument())
    expect(screen.getByText(/script:/)).toBeInTheDocument()
    expect(screen.getByText(/sha:/)).toBeInTheDocument()
    expect(screen.getByText('eval')).toBeInTheDocument()
    expect(screen.getByText(/namespaced by/)).toBeInTheDocument()
    expect(screen.getByText('IScriptDefinition')).toBeInTheDocument()
  })
})
