/**
 * @fileoverview Unit tests for {@link StringsCard} — the string (catalog product)
 * Playground card.
 *
 * Drives all six ops (setNx / get / getRaw / exists / expire / persist), the
 * product key + pattern href derivation, the seed body argument, and — crucially —
 * both branches of the two inline `async run` thunks: `getRaw` maps a successful
 * inspect to its `raw` string (and passes a failure through), and `exists` maps a
 * TTL to a `!== -2` boolean (and passes a failure through). The shared
 * {@link usePlaygroundOp} hook and the two api modules are mocked.
 *
 * @module components/playground/StringsCard.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const runOp = vi.fn()
const opState = { isPending: false }

vi.mock('./use-playground-op', () => ({
  usePlaygroundOp: () => ({ outcome: null, isPending: opState.isPending, runOp }),
}))

const seed = vi.fn<(...args: unknown[]) => Promise<unknown>>(() =>
  Promise.resolve({ ok: true, data: { isCreated: true, isPresent: true } }),
)
const get = vi.fn<(...args: unknown[]) => Promise<unknown>>(() =>
  Promise.resolve({ ok: true, data: { id: '99' } }),
)
const ttl = vi.fn<(id: string) => Promise<unknown>>(() => Promise.resolve({ ok: true, data: 10 }))
const expire = vi.fn<(...args: unknown[]) => Promise<unknown>>(() =>
  Promise.resolve({ ok: true, data: true }),
)
const persist = vi.fn<(...args: unknown[]) => Promise<unknown>>(() =>
  Promise.resolve({ ok: true, data: true }),
)
const inspectKey = vi.fn<(key: string) => Promise<unknown>>(() =>
  Promise.resolve({ ok: true, data: { raw: '{"id":"99"}' } }),
)

vi.mock('@/lib/playground-api', () => ({
  catalogApi: {
    seed: (...a: unknown[]) => seed(...a),
    get: (...a: unknown[]) => get(...a),
    ttl: (id: string) => ttl(id),
    expire: (...a: unknown[]) => expire(...a),
    persist: (...a: unknown[]) => persist(...a),
  },
}))
vi.mock('@/lib/cache-api', () => ({ cacheApi: { inspectKey: (key: string) => inspectKey(key) } }))

import { StringsCard } from './StringsCard'

beforeEach(() => {
  vi.clearAllMocks()
  opState.isPending = false
  ttl.mockImplementation(() => Promise.resolve({ ok: true, data: 10 }))
  inspectKey.mockImplementation(() => Promise.resolve({ ok: true, data: { raw: '{"id":"99"}' } }))
})

describe('StringsCard', () => {
  it('runs setNx with the name body and the product key/href', async () => {
    /*
     * Scenario: the operator seeds the product with the default name.
     * Rule it protects: setNx calls `runOp` with the `product:{id}` key + pattern
     * href and delegates to `catalogApi.seed(id, { name })`.
     */
    const user = userEvent.setup()
    render(<StringsCard />)
    await user.click(screen.getByRole('button', { name: 'setNx' }))

    expect(runOp).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'setNx',
        resultingKey: 'cache-example:product:99',
        explorerHref: '/explorer?prefix=product&pattern=99',
      }),
    )
    const args = runOp.mock.calls[0]?.[0] as { run: () => Promise<unknown> }
    await args.run()
    expect(seed).toHaveBeenCalledWith('99', { name: 'Demo widget' })
  })

  it('runs get against the product', async () => {
    /*
     * Scenario: the operator reads the decoded product.
     * Rule it protects: get delegates to `catalogApi.get(id)`.
     */
    const user = userEvent.setup()
    render(<StringsCard />)
    await user.click(screen.getByRole('button', { name: 'get' }))
    const args = runOp.mock.calls[0]?.[0] as { label: string; run: () => Promise<unknown> }
    expect(args.label).toBe('get')
    await args.run()
    expect(get).toHaveBeenCalledWith('99')
  })

  it('getRaw maps a successful inspect to its raw serialized string', async () => {
    /*
     * Scenario: getRaw on a present key.
     * Rule it protects: the inline thunk's `result.ok` branch returns
     * `{ ok: true, data: result.data.raw }` — the serialized string, not the object.
     */
    const user = userEvent.setup()
    render(<StringsCard />)
    await user.click(screen.getByRole('button', { name: 'getRaw' }))
    const args = runOp.mock.calls[0]?.[0] as { run: () => Promise<unknown> }
    const result = await args.run()
    expect(inspectKey).toHaveBeenCalledWith('cache-example:product:99')
    expect(result).toEqual({ ok: true, data: '{"id":"99"}' })
  })

  it('getRaw passes a failed inspect result straight through', async () => {
    /*
     * Scenario: getRaw when the inspect call fails.
     * Rule it protects: the `result.ok` ternary's false arm returns the original
     * error result unchanged (no `.raw` access on a failure).
     */
    const failure = { ok: false, error: { code: 'unknown', message: 'boom', status: 500 } }
    inspectKey.mockResolvedValueOnce(failure)
    const user = userEvent.setup()
    render(<StringsCard />)
    await user.click(screen.getByRole('button', { name: 'getRaw' }))
    const args = runOp.mock.calls[0]?.[0] as { run: () => Promise<unknown> }
    const result = await args.run()
    expect(result).toBe(failure)
  })

  it('exists maps a present TTL to a true boolean', async () => {
    /*
     * Scenario: exists when the key is present (TTL !== -2).
     * Rule it protects: the inline thunk's `result.ok` branch returns
     * `{ ok: true, data: ttl !== -2 }` → true for a live key.
     */
    ttl.mockResolvedValueOnce({ ok: true, data: 10 })
    const user = userEvent.setup()
    render(<StringsCard />)
    await user.click(screen.getByRole('button', { name: 'exists' }))
    const args = runOp.mock.calls[0]?.[0] as { run: () => Promise<unknown> }
    const result = await args.run()
    expect(ttl).toHaveBeenCalledWith('99')
    expect(result).toEqual({ ok: true, data: true })
  })

  it('exists maps a missing TTL (-2) to a false boolean', async () => {
    /*
     * Scenario: exists when the key is absent (TTL === -2).
     * Rule it protects: the `ttl !== -2` comparison yields false for a missing key.
     */
    ttl.mockResolvedValueOnce({ ok: true, data: -2 })
    const user = userEvent.setup()
    render(<StringsCard />)
    await user.click(screen.getByRole('button', { name: 'exists' }))
    const args = runOp.mock.calls[0]?.[0] as { run: () => Promise<unknown> }
    const result = await args.run()
    expect(result).toEqual({ ok: true, data: false })
  })

  it('exists passes a failed TTL result straight through', async () => {
    /*
     * Scenario: exists when the TTL call fails.
     * Rule it protects: the `result.ok` ternary's false arm returns the error result
     * unchanged.
     */
    const failure = { ok: false, error: { code: 'unknown', message: 'boom', status: 500 } }
    ttl.mockResolvedValueOnce(failure)
    const user = userEvent.setup()
    render(<StringsCard />)
    await user.click(screen.getByRole('button', { name: 'exists' }))
    const args = runOp.mock.calls[0]?.[0] as { run: () => Promise<unknown> }
    const result = await args.run()
    expect(result).toBe(failure)
  })

  it('runs expire with the TTL_SECONDS argument and no Explorer href', async () => {
    /*
     * Scenario: the operator sets a TTL.
     * Rule it protects: the expire op is labelled `expire +60s`, omits the Explorer
     * href, and delegates to `catalogApi.expire(id, 60)`.
     */
    const user = userEvent.setup()
    render(<StringsCard />)
    await user.click(screen.getByRole('button', { name: 'expire +60s' }))
    const args = runOp.mock.calls[0]?.[0] as {
      label: string
      explorerHref?: string
      run: () => Promise<unknown>
    }
    expect(args.label).toBe('expire +60s')
    expect(args.explorerHref).toBeUndefined()
    await args.run()
    expect(expire).toHaveBeenCalledWith('99', 60)
  })

  it('runs persist with no Explorer href', async () => {
    /*
     * Scenario: the operator removes the TTL.
     * Rule it protects: persist delegates to `catalogApi.persist(id)` and omits the
     * Explorer href.
     */
    const user = userEvent.setup()
    render(<StringsCard />)
    await user.click(screen.getByRole('button', { name: 'persist' }))
    const args = runOp.mock.calls[0]?.[0] as {
      label: string
      explorerHref?: string
      run: () => Promise<unknown>
    }
    expect(args.label).toBe('persist')
    expect(args.explorerHref).toBeUndefined()
    await args.run()
    expect(persist).toHaveBeenCalledWith('99')
  })

  it('recomputes the key/href when id and name change', async () => {
    /*
     * Scenario: both inputs are edited before seeding.
     * Rule it protects: the derived key/href and the seed body track the id/name
     * state.
     */
    const user = userEvent.setup()
    render(<StringsCard />)
    const idInput = screen.getByLabelText('id')
    const nameInput = screen.getByLabelText('name')
    await user.clear(idInput)
    await user.type(idInput, '7')
    await user.clear(nameInput)
    await user.type(nameInput, 'Gadget')
    await user.click(screen.getByRole('button', { name: 'setNx' }))

    expect(runOp).toHaveBeenCalledWith(
      expect.objectContaining({
        resultingKey: 'cache-example:product:7',
        explorerHref: '/explorer?prefix=product&pattern=7',
      }),
    )
    const args = runOp.mock.calls[0]?.[0] as { run: () => Promise<unknown> }
    await args.run()
    expect(seed).toHaveBeenCalledWith('7', { name: 'Gadget' })
  })

  it('disables every op button while an op is pending', () => {
    /*
     * Scenario: a string op is in flight.
     * Rule it protects: the pending flag disables all six op buttons.
     */
    opState.isPending = true
    render(<StringsCard />)
    for (const name of ['setNx', 'get', 'getRaw', 'exists', 'expire +60s', 'persist']) {
      expect(screen.getByRole('button', { name })).toBeDisabled()
    }
  })
})
