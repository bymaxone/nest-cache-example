/**
 * @fileoverview Unit tests for {@link usePlaygroundOp} — the shared op runner behind
 * every Playground card.
 *
 * Drives every branch of `runOp`: the success path (outcome set, success toast,
 * with/without `resultingKey` and with/without an Explorer action), the structured
 * `ApiResult` error path (error toast, no outcome), and the network-rejection catch
 * path. Also exercises the toast action's `router.push` deep-link and the pending
 * flag lifecycle. `next/navigation` and `sonner` are mocked.
 *
 * @module components/playground/use-playground-op.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { type ApiResult } from '@/lib/api-client'
import { usePlaygroundOp } from './use-playground-op'

const pushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// Imported after the mock so the spy identities resolve to the mocked module.
import { toast } from 'sonner'

beforeEach(() => {
  vi.clearAllMocks()
})

/** A success `ApiResult` fixture. */
function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

/** A structured-error `ApiResult` fixture. */
function fail(message: string): ApiResult<never> {
  return { ok: false, error: { code: 'unknown', message, status: 500 } }
}

/**
 * Narrow a sonner toast action (typed `ReactNode | Action`) to the navigating click
 * handler the Playground supplies, so its `onClick` can be invoked type-safely.
 */
function hasOnClick(value: unknown): value is { onClick: () => void } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'onClick' in value &&
    typeof value.onClick === 'function'
  )
}

describe('usePlaygroundOp', () => {
  it('starts with no outcome and not pending', () => {
    /*
     * Scenario: the hook is first mounted.
     * Rule it protects: the initial surface is `{ outcome: null, isPending: false }`.
     */
    const { result } = renderHook(() => usePlaygroundOp())
    expect(result.current.outcome).toBeNull()
    expect(result.current.isPending).toBe(false)
  })

  it('sets the outcome with its resulting key and toasts success with an Explorer action', async () => {
    /*
     * Scenario: a successful op that targets one key and offers an Explorer link.
     * Rule it protects: the success branch stores `{ label, value, resultingKey }`,
     * toasts the label with the key description and a "View in Explorer →" action.
     */
    const { result } = renderHook(() => usePlaygroundOp())
    await act(async () => {
      await result.current.runOp({
        label: 'get',
        run: () => Promise.resolve(ok({ id: '42' })),
        resultingKey: 'cache-example:product:42',
        explorerHref: '/explorer?prefix=product',
      })
    })

    expect(result.current.outcome).toEqual({
      label: 'get',
      value: { id: '42' },
      resultingKey: 'cache-example:product:42',
    })
    expect(toast.success).toHaveBeenCalledWith(
      'get',
      expect.objectContaining({
        description: 'cache-example:product:42',
        action: expect.objectContaining({ label: 'View in Explorer →' }),
      }),
    )
  })

  it('routes to the Explorer href when the success toast action is clicked', async () => {
    /*
     * Scenario: the user clicks the "View in Explorer →" action on the success toast.
     * Rule it protects: the action's onClick pushes the provided Explorer deep-link
     * onto the router.
     */
    const { result } = renderHook(() => usePlaygroundOp())
    await act(async () => {
      await result.current.runOp({
        label: 'hset',
        run: () => Promise.resolve(ok(1)),
        resultingKey: 'cache-example:cart:u_7',
        explorerHref: '/explorer?prefix=cart',
      })
    })

    const action = vi.mocked(toast.success).mock.calls[0]?.[1]?.action
    expect(hasOnClick(action)).toBe(true)
    if (hasOnClick(action)) {
      act(() => {
        action.onClick()
      })
    }
    expect(pushMock).toHaveBeenCalledWith('/explorer?prefix=cart')
  })

  it('omits the resulting key and the Explorer action when neither is provided', async () => {
    /*
     * Scenario: an op with no resulting key and no Explorer href (e.g. sismember).
     * Rule it protects: the conditional-spread branches drop `resultingKey` from the
     * outcome and both `description`/`action` from the toast options.
     */
    const { result } = renderHook(() => usePlaygroundOp())
    await act(async () => {
      await result.current.runOp({
        label: 'sismember',
        run: () => Promise.resolve(ok(true)),
      })
    })

    expect(result.current.outcome).toEqual({ label: 'sismember', value: true })
    expect(result.current.outcome).not.toHaveProperty('resultingKey')
    expect(toast.success).toHaveBeenCalledWith('sismember', {})
  })

  it('toasts the structured error and leaves the outcome untouched on a failed ApiResult', async () => {
    /*
     * Scenario: the transport returns a structured `{ ok: false }` error.
     * Rule it protects: the error branch toasts "<label> failed" with the API
     * message and never sets an outcome (the inline result stays empty).
     */
    const { result } = renderHook(() => usePlaygroundOp())
    await act(async () => {
      await result.current.runOp({
        label: 'get',
        run: () => Promise.resolve(fail('Key not found')),
      })
    })

    expect(result.current.outcome).toBeNull()
    expect(toast.error).toHaveBeenCalledWith('get failed', { description: 'Key not found' })
  })

  it('toasts a network error when the transport call rejects', async () => {
    /*
     * Scenario: the transport rejects at the network layer (a thrown promise).
     * Rule it protects: the catch branch surfaces a generic "Network error" toast
     * and the pending flag is still cleared by the finally block.
     */
    const { result } = renderHook(() => usePlaygroundOp())
    await act(async () => {
      await result.current.runOp({
        label: 'incr',
        run: () => Promise.reject(new Error('offline')),
      })
    })

    expect(toast.error).toHaveBeenCalledWith('incr failed', { description: 'Network error' })
    expect(result.current.isPending).toBe(false)
  })

  it('flips isPending true while in flight and false once settled', async () => {
    /*
     * Scenario: a long-running op is observed mid-flight.
     * Rule it protects: `isPending` is set true before the call and reset by the
     * finally block, so cards can disable their buttons during the round-trip.
     */
    let resolveRun: (value: ApiResult<number>) => void = () => {}
    const { result } = renderHook(() => usePlaygroundOp())

    let pending: Promise<void> = Promise.resolve()
    act(() => {
      pending = result.current.runOp({
        label: 'views',
        run: () => new Promise<ApiResult<number>>((resolve) => (resolveRun = resolve)),
      })
    })

    await waitFor(() => expect(result.current.isPending).toBe(true))

    await act(async () => {
      resolveRun(ok(7))
      await pending
    })
    expect(result.current.isPending).toBe(false)
    expect(result.current.outcome).toEqual({ label: 'views', value: 7 })
  })
})
