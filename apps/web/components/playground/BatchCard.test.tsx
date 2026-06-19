/**
 * @fileoverview Unit tests for {@link BatchCard} — the batch (mget / pipeline seed)
 * Playground card.
 *
 * Drives `parseIds` (trimming, blank filtering, all-empty → disabled buttons),
 * both op handlers (mget via `catalogApi.batchGet`, mset via `cacheApi.seed`) with
 * their resulting-key labels, and the disabled state when an op is pending. The
 * shared {@link usePlaygroundOp} hook and the two api modules are mocked so the
 * card's own branches are asserted in isolation.
 *
 * @module components/playground/BatchCard.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const runOp = vi.fn()
const opState = { outcome: null as unknown, isPending: false }

vi.mock('./use-playground-op', () => ({
  usePlaygroundOp: () => ({ outcome: opState.outcome, isPending: opState.isPending, runOp }),
}))

const batchGet = vi.fn<(...args: unknown[]) => Promise<unknown>>(() =>
  Promise.resolve({ ok: true, data: [] }),
)
const seed = vi.fn<(...args: unknown[]) => Promise<unknown>>(() =>
  Promise.resolve({ ok: true, data: { seeded: 3 } }),
)

vi.mock('@/lib/playground-api', () => ({
  catalogApi: { batchGet: (...args: unknown[]) => batchGet(...args) },
}))
vi.mock('@/lib/cache-api', () => ({ cacheApi: { seed: (...args: unknown[]) => seed(...args) } }))

import { BatchCard } from './BatchCard'

beforeEach(() => {
  vi.clearAllMocks()
  opState.outcome = null
  opState.isPending = false
})

describe('BatchCard', () => {
  it('runs mget with parsed ids and the {1,2,3} resulting key', async () => {
    /*
     * Scenario: the operator clicks mget with the default "1,2,3" ids.
     * Rule it protects: the mget handler parses the ids and calls `runOp` with the
     * `catalogApi.batchGet` transport and the `product:{1,2,3}` resulting key.
     */
    const user = userEvent.setup()
    render(<BatchCard />)
    await user.click(screen.getByRole('button', { name: 'mget' }))

    expect(runOp).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'mget',
        resultingKey: 'cache-example:product:{1,2,3}',
        explorerHref: '/explorer?prefix=product',
      }),
    )
    // The `run` thunk delegates to the mocked transport with the parsed ids.
    const args = runOp.mock.calls[0]?.[0] as { run: () => Promise<unknown> }
    await args.run()
    expect(batchGet).toHaveBeenCalledWith(['1', '2', '3'])
  })

  it('runs mset with the parsed-length resulting key range', async () => {
    /*
     * Scenario: the operator clicks mset.
     * Rule it protects: the mset handler calls `runOp` with the `cacheApi.seed`
     * transport and the `product:1..N` range key (N = parsed id count).
     */
    const user = userEvent.setup()
    render(<BatchCard />)
    await user.click(screen.getByRole('button', { name: 'mset' }))

    expect(runOp).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'mset (pipeline seed)',
        resultingKey: 'cache-example:product:1..3',
      }),
    )
    const args = runOp.mock.calls[0]?.[0] as { run: () => Promise<unknown> }
    await args.run()
    expect(seed).toHaveBeenCalledWith(3)
  })

  it('trims and drops blank ids, reflecting the count in the resulting key', async () => {
    /*
     * Scenario: the ids field is edited to a messy " 4 , , 5 " list.
     * Rule it protects: `parseIds` trims each segment and drops empties, so two ids
     * survive and the resulting-key range reads `1..2`.
     */
    const user = userEvent.setup()
    render(<BatchCard />)
    const input = screen.getByLabelText('ids (comma-separated)')
    await user.clear(input)
    await user.type(input, ' 4 , , 5 ')
    await user.click(screen.getByRole('button', { name: 'mget' }))

    expect(runOp).toHaveBeenCalledWith(
      expect.objectContaining({ resultingKey: 'cache-example:product:{4,5}' }),
    )
  })

  it('disables both op buttons when the parsed id list is empty', async () => {
    /*
     * Scenario: the ids field is cleared entirely.
     * Rule it protects: `parsed.length === 0` disables mget and mset so an empty
     * batch op cannot fire.
     */
    const user = userEvent.setup()
    render(<BatchCard />)
    const input = screen.getByLabelText('ids (comma-separated)')
    await user.clear(input)
    expect(screen.getByRole('button', { name: 'mget' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'mset' })).toBeDisabled()
  })

  it('disables both op buttons while an op is pending', () => {
    /*
     * Scenario: a batch op is in flight (`isPending`).
     * Rule it protects: the pending flag disables both buttons regardless of the id
     * list, preventing a concurrent second op.
     */
    opState.isPending = true
    render(<BatchCard />)
    expect(screen.getByRole('button', { name: 'mget' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'mset' })).toBeDisabled()
  })
})
