/**
 * @fileoverview Unit tests for {@link HashCard} — the hash (cart) Playground card.
 *
 * Drives all four ops (hset / hget / hgetall / hdel), the derived key and
 * pattern-scoped Explorer href, the numeric value coercion passed to `hset`, and
 * the pending-disabled state. The shared {@link usePlaygroundOp} hook and the
 * collections api are mocked so each handler's `runOp` arguments are asserted.
 *
 * @module components/playground/HashCard.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const runOp = vi.fn()
const opState = { isPending: false }

vi.mock('./use-playground-op', () => ({
  usePlaygroundOp: () => ({ outcome: null, isPending: opState.isPending, runOp }),
}))

const setCartLine = vi.fn<(...args: unknown[]) => Promise<unknown>>(() =>
  Promise.resolve({ ok: true, data: 1 }),
)
const getCartLine = vi.fn<(...args: unknown[]) => Promise<unknown>>(() =>
  Promise.resolve({ ok: true, data: null }),
)
const getCart = vi.fn<(...args: unknown[]) => Promise<unknown>>(() =>
  Promise.resolve({ ok: true, data: {} }),
)
const removeCartLine = vi.fn<(...args: unknown[]) => Promise<unknown>>(() =>
  Promise.resolve({ ok: true, data: 1 }),
)

vi.mock('@/lib/playground-api', () => ({
  collectionsApi: {
    setCartLine: (...a: unknown[]) => setCartLine(...a),
    getCartLine: (...a: unknown[]) => getCartLine(...a),
    getCart: (...a: unknown[]) => getCart(...a),
    removeCartLine: (...a: unknown[]) => removeCartLine(...a),
  },
}))

import { HashCard } from './HashCard'

beforeEach(() => {
  vi.clearAllMocks()
  opState.isPending = false
})

describe('HashCard', () => {
  it('runs hset with the numeric-coerced cart line and the derived cart key', async () => {
    /*
     * Scenario: the operator clicks hset with the default cart fields.
     * Rule it protects: hset calls `runOp` with the `cart:{id}` key and the
     * pattern-scoped Explorer href, and the transport receives the coerced
     * `{ quantity, priceCents }` numbers (from the string inputs).
     */
    const user = userEvent.setup()
    render(<HashCard />)
    await user.click(screen.getByRole('button', { name: 'hset' }))

    expect(runOp).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'hset',
        resultingKey: 'cache-example:cart:u_7',
        explorerHref: '/explorer?prefix=cart&pattern=u_7',
      }),
    )
    const args = runOp.mock.calls[0]?.[0] as { run: () => Promise<unknown> }
    await args.run()
    expect(setCartLine).toHaveBeenCalledWith('u_7', 'sku_1', { quantity: 2, priceCents: 999 })
  })

  it('runs hget against one field', async () => {
    /*
     * Scenario: the operator clicks hget.
     * Rule it protects: hget delegates to `collectionsApi.getCartLine(id, field)`.
     */
    const user = userEvent.setup()
    render(<HashCard />)
    await user.click(screen.getByRole('button', { name: 'hget' }))
    const args = runOp.mock.calls[0]?.[0] as { label: string; run: () => Promise<unknown> }
    expect(args.label).toBe('hget')
    await args.run()
    expect(getCartLine).toHaveBeenCalledWith('u_7', 'sku_1')
  })

  it('runs hgetall against the whole hash', async () => {
    /*
     * Scenario: the operator clicks hgetall.
     * Rule it protects: hgetall delegates to `collectionsApi.getCart(id)`.
     */
    const user = userEvent.setup()
    render(<HashCard />)
    await user.click(screen.getByRole('button', { name: 'hgetall' }))
    const args = runOp.mock.calls[0]?.[0] as { label: string; run: () => Promise<unknown> }
    expect(args.label).toBe('hgetall')
    await args.run()
    expect(getCart).toHaveBeenCalledWith('u_7')
  })

  it('runs hdel against one field', async () => {
    /*
     * Scenario: the operator clicks hdel.
     * Rule it protects: hdel delegates to `collectionsApi.removeCartLine(id, field)`.
     */
    const user = userEvent.setup()
    render(<HashCard />)
    await user.click(screen.getByRole('button', { name: 'hdel' }))
    const args = runOp.mock.calls[0]?.[0] as { label: string; run: () => Promise<unknown> }
    expect(args.label).toBe('hdel')
    await args.run()
    expect(removeCartLine).toHaveBeenCalledWith('u_7', 'sku_1')
  })

  it('recomputes the key/value when every field input changes', async () => {
    /*
     * Scenario: all four inputs (id, field, quantity, priceCents) are edited.
     * Rule it protects: each input's `onChange` updates its state — the derived key,
     * pattern href, and the numeric-coerced hset value all reflect the edits.
     */
    const user = userEvent.setup()
    render(<HashCard />)
    const idInput = screen.getByLabelText('cart id')
    const fieldInput = screen.getByLabelText('field')
    const qtyInput = screen.getByLabelText('quantity')
    const priceInput = screen.getByLabelText('priceCents')
    await user.clear(idInput)
    await user.type(idInput, 'u_9')
    await user.clear(fieldInput)
    await user.type(fieldInput, 'sku_2')
    await user.clear(qtyInput)
    await user.type(qtyInput, '5')
    await user.clear(priceInput)
    await user.type(priceInput, '1500')
    await user.click(screen.getByRole('button', { name: 'hset' }))

    expect(runOp).toHaveBeenCalledWith(
      expect.objectContaining({
        resultingKey: 'cache-example:cart:u_9',
        explorerHref: '/explorer?prefix=cart&pattern=u_9',
      }),
    )
    const args = runOp.mock.calls[0]?.[0] as { run: () => Promise<unknown> }
    await args.run()
    expect(setCartLine).toHaveBeenCalledWith('u_9', 'sku_2', { quantity: 5, priceCents: 1500 })
  })

  it('disables every op button while an op is pending', () => {
    /*
     * Scenario: a hash op is in flight.
     * Rule it protects: the pending flag disables all four op buttons.
     */
    opState.isPending = true
    render(<HashCard />)
    for (const name of ['hset', 'hget', 'hgetall', 'hdel']) {
      expect(screen.getByRole('button', { name })).toBeDisabled()
    }
  })
})
