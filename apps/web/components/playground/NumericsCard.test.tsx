/**
 * @fileoverview Unit tests for {@link NumericsCard} — the numeric (counters)
 * Playground card.
 *
 * Drives the four ops (get views, incr, incr +N, decr stock), the views/stock key
 * + href derivation, the `incrViews` step argument (none for incr, `INCR_STEP` for
 * incr +N), and the pending-disabled state. The shared {@link usePlaygroundOp} hook
 * and the counters api are mocked.
 *
 * @module components/playground/NumericsCard.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const runOp = vi.fn()
const opState = { isPending: false }

vi.mock('./use-playground-op', () => ({
  usePlaygroundOp: () => ({ outcome: null, isPending: opState.isPending, runOp }),
}))

const views = vi.fn<(...args: unknown[]) => Promise<unknown>>(() =>
  Promise.resolve({ ok: true, data: 0 }),
)
const incrViews = vi.fn<(...args: unknown[]) => Promise<unknown>>(() =>
  Promise.resolve({ ok: true, data: 1 }),
)
const decrStock = vi.fn<(...args: unknown[]) => Promise<unknown>>(() =>
  Promise.resolve({ ok: true, data: 1 }),
)

vi.mock('@/lib/playground-api', () => ({
  countersApi: {
    views: (...a: unknown[]) => views(...a),
    incrViews: (...a: unknown[]) => incrViews(...a),
    decrStock: (...a: unknown[]) => decrStock(...a),
  },
}))

import { NumericsCard } from './NumericsCard'

beforeEach(() => {
  vi.clearAllMocks()
  opState.isPending = false
})

describe('NumericsCard', () => {
  it('runs "get views" against the views key/href', async () => {
    /*
     * Scenario: the operator reads the current view count.
     * Rule it protects: the get handler calls `runOp` with the `views:{id}` key +
     * views href and delegates to `countersApi.views(id)`.
     */
    const user = userEvent.setup()
    render(<NumericsCard />)
    await user.click(screen.getByRole('button', { name: 'get views' }))

    expect(runOp).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'views',
        resultingKey: 'cache-example:views:p1',
        explorerHref: '/explorer?prefix=views&pattern=p1',
      }),
    )
    const args = runOp.mock.calls[0]?.[0] as { run: () => Promise<unknown> }
    await args.run()
    expect(views).toHaveBeenCalledWith('p1')
  })

  it('runs incr with no step argument', async () => {
    /*
     * Scenario: the operator clicks the unit incr.
     * Rule it protects: the incr handler calls `incrViews(id)` with no `by` step.
     */
    const user = userEvent.setup()
    render(<NumericsCard />)
    await user.click(screen.getByRole('button', { name: 'incr' }))
    const args = runOp.mock.calls[0]?.[0] as { label: string; run: () => Promise<unknown> }
    expect(args.label).toBe('incr')
    await args.run()
    expect(incrViews).toHaveBeenCalledWith('p1')
  })

  it('runs "incr +5" with the INCR_STEP argument', async () => {
    /*
     * Scenario: the operator clicks the stepped incr.
     * Rule it protects: the +N handler labels the op `incr +5` and calls
     * `incrViews(id, 5)` with the configured step.
     */
    const user = userEvent.setup()
    render(<NumericsCard />)
    await user.click(screen.getByRole('button', { name: 'incr +5' }))
    const args = runOp.mock.calls[0]?.[0] as { label: string; run: () => Promise<unknown> }
    expect(args.label).toBe('incr +5')
    await args.run()
    expect(incrViews).toHaveBeenCalledWith('p1', 5)
  })

  it('runs "decr stock" against the stock key/href', async () => {
    /*
     * Scenario: the operator decrements stock.
     * Rule it protects: the decr handler targets the separate `stock:{id}` key +
     * stock href and delegates to `countersApi.decrStock(id)`.
     */
    const user = userEvent.setup()
    render(<NumericsCard />)
    await user.click(screen.getByRole('button', { name: 'decr stock' }))

    expect(runOp).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'decr stock',
        resultingKey: 'cache-example:stock:p1',
        explorerHref: '/explorer?prefix=stock&pattern=p1',
      }),
    )
    const args = runOp.mock.calls[0]?.[0] as { run: () => Promise<unknown> }
    await args.run()
    expect(decrStock).toHaveBeenCalledWith('p1')
  })

  it('recomputes keys/hrefs when the id changes', async () => {
    /*
     * Scenario: the id input is edited to "p2".
     * Rule it protects: views/stock keys and hrefs track the id state for the next op.
     */
    const user = userEvent.setup()
    render(<NumericsCard />)
    const idInput = screen.getByLabelText('id')
    await user.clear(idInput)
    await user.type(idInput, 'p2')
    await user.click(screen.getByRole('button', { name: 'incr' }))

    expect(runOp).toHaveBeenCalledWith(
      expect.objectContaining({ resultingKey: 'cache-example:views:p2' }),
    )
  })

  it('disables every op button while an op is pending', () => {
    /*
     * Scenario: a counter op is in flight.
     * Rule it protects: the pending flag disables all four op buttons.
     */
    opState.isPending = true
    render(<NumericsCard />)
    for (const name of ['get views', 'incr', 'incr +5', 'decr stock']) {
      expect(screen.getByRole('button', { name })).toBeDisabled()
    }
  })
})
