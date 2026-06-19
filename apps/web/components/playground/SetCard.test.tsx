/**
 * @fileoverview Unit tests for {@link SetCard} — the set (tags) Playground card.
 *
 * Drives all four ops (sadd / srem / sismember / smembers+scard), the tag key +
 * pattern href derivation, the sadd single-tag-array argument, the deliberate
 * absence of an Explorer href on the sismember op, and the pending-disabled state.
 * The shared {@link usePlaygroundOp} hook and the collections api are mocked.
 *
 * @module components/playground/SetCard.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const runOp = vi.fn()
const opState = { isPending: false }

vi.mock('./use-playground-op', () => ({
  usePlaygroundOp: () => ({ outcome: null, isPending: opState.isPending, runOp }),
}))

const addTags = vi.fn<(...args: unknown[]) => Promise<unknown>>(() =>
  Promise.resolve({ ok: true, data: 1 }),
)
const removeTag = vi.fn<(...args: unknown[]) => Promise<unknown>>(() =>
  Promise.resolve({ ok: true, data: 1 }),
)
const hasTag = vi.fn<(...args: unknown[]) => Promise<unknown>>(() =>
  Promise.resolve({ ok: true, data: true }),
)
const listTags = vi.fn<(...args: unknown[]) => Promise<unknown>>(() =>
  Promise.resolve({ ok: true, data: { tags: [], count: 0 } }),
)

vi.mock('@/lib/playground-api', () => ({
  collectionsApi: {
    addTags: (...a: unknown[]) => addTags(...a),
    removeTag: (...a: unknown[]) => removeTag(...a),
    hasTag: (...a: unknown[]) => hasTag(...a),
    listTags: (...a: unknown[]) => listTags(...a),
  },
}))

import { SetCard } from './SetCard'

beforeEach(() => {
  vi.clearAllMocks()
  opState.isPending = false
})

describe('SetCard', () => {
  it('runs sadd with the tag wrapped in an array and the tags key/href', async () => {
    /*
     * Scenario: the operator adds the default "sale" tag.
     * Rule it protects: sadd calls `runOp` with the `tags:{id}` key + pattern href
     * and delegates to `addTags(id, [tag])` (the single tag wrapped in an array).
     */
    const user = userEvent.setup()
    render(<SetCard />)
    await user.click(screen.getByRole('button', { name: 'sadd' }))

    expect(runOp).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'sadd',
        resultingKey: 'cache-example:tags:p1',
        explorerHref: '/explorer?prefix=tags&pattern=p1',
      }),
    )
    const args = runOp.mock.calls[0]?.[0] as { run: () => Promise<unknown> }
    await args.run()
    expect(addTags).toHaveBeenCalledWith('p1', ['sale'])
  })

  it('runs srem against one tag', async () => {
    /*
     * Scenario: the operator removes a tag.
     * Rule it protects: srem delegates to `removeTag(id, tag)`.
     */
    const user = userEvent.setup()
    render(<SetCard />)
    await user.click(screen.getByRole('button', { name: 'srem' }))
    const args = runOp.mock.calls[0]?.[0] as { label: string; run: () => Promise<unknown> }
    expect(args.label).toBe('srem')
    await args.run()
    expect(removeTag).toHaveBeenCalledWith('p1', 'sale')
  })

  it('runs sismember without an Explorer href', async () => {
    /*
     * Scenario: the operator probes membership.
     * Rule it protects: the sismember op intentionally omits `explorerHref` (a
     * boolean probe targets no listable key view) and calls `hasTag(id, tag)`.
     */
    const user = userEvent.setup()
    render(<SetCard />)
    await user.click(screen.getByRole('button', { name: 'sismember' }))
    const args = runOp.mock.calls[0]?.[0] as {
      label: string
      explorerHref?: string
      run: () => Promise<unknown>
    }
    expect(args.label).toBe('sismember')
    expect(args.explorerHref).toBeUndefined()
    await args.run()
    expect(hasTag).toHaveBeenCalledWith('p1', 'sale')
  })

  it('runs smembers + scard via listTags', async () => {
    /*
     * Scenario: the operator lists the set.
     * Rule it protects: the smembers button labels the op `smembers + scard` and
     * delegates to `listTags(id)`.
     */
    const user = userEvent.setup()
    render(<SetCard />)
    await user.click(screen.getByRole('button', { name: 'smembers' }))
    const args = runOp.mock.calls[0]?.[0] as { label: string; run: () => Promise<unknown> }
    expect(args.label).toBe('smembers + scard')
    await args.run()
    expect(listTags).toHaveBeenCalledWith('p1')
  })

  it('uses the edited id and tag in the next op', async () => {
    /*
     * Scenario: both inputs are edited before adding a tag.
     * Rule it protects: the derived key/href and the transport args track the id and
     * tag state.
     */
    const user = userEvent.setup()
    render(<SetCard />)
    const idInput = screen.getByLabelText('product id')
    const tagInput = screen.getByLabelText('tag')
    await user.clear(idInput)
    await user.type(idInput, 'p9')
    await user.clear(tagInput)
    await user.type(tagInput, 'new')
    await user.click(screen.getByRole('button', { name: 'sadd' }))

    expect(runOp).toHaveBeenCalledWith(
      expect.objectContaining({ resultingKey: 'cache-example:tags:p9' }),
    )
    const args = runOp.mock.calls[0]?.[0] as { run: () => Promise<unknown> }
    await args.run()
    expect(addTags).toHaveBeenCalledWith('p9', ['new'])
  })

  it('disables every op button while an op is pending', () => {
    /*
     * Scenario: a set op is in flight.
     * Rule it protects: the pending flag disables all four op buttons.
     */
    opState.isPending = true
    render(<SetCard />)
    for (const name of ['sadd', 'srem', 'sismember', 'smembers']) {
      expect(screen.getByRole('button', { name })).toBeDisabled()
    }
  })
})
