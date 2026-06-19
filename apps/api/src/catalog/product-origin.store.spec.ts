/**
 * Unit: ProductOriginStore — in-memory origin with simulated latency.
 *
 * Constructs the real store (it has no injected collaborators) and drives both
 * read paths under fake timers so the artificial 120 ms delay is fast-forwarded
 * rather than waited on. Covers the seeded-hit and unknown-id (`?? null`) arms
 * of `find` and the per-element mapping of `findMany`.
 *
 * @module catalog/product-origin.store.spec
 */
import { jest } from '@jest/globals'
import { SEED_PRODUCTS } from './product.types.js'
import type { Product } from './product.types.js'
import { ProductOriginStore } from './product-origin.store.js'

/** First seed row — the deterministic anchor for the hit assertions. */
const FIRST: Product = SEED_PRODUCTS[0] as Product

describe('ProductOriginStore (unit)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('find resolves a seeded product after the simulated latency', async () => {
    /*
     * Scenario: read a known id; the constructor seeded the store from SEED_PRODUCTS.
     * Rule it protects: after the 120 ms delay elapses, `store.get(id)` returns the
     * seeded row (left arm of `?? null`).
     */
    const store = new ProductOriginStore()

    const pending = store.find(FIRST.id)
    await jest.advanceTimersByTimeAsync(120)

    await expect(pending).resolves.toEqual(FIRST)
  })

  it('find resolves null for an unknown id', async () => {
    /*
     * Scenario: read an id that was never seeded.
     * Rule it protects: a store miss collapses to `null` via the right arm of
     * `?? null` — the store never throws on unknown ids.
     */
    const store = new ProductOriginStore()

    const pending = store.find('does-not-exist')
    await jest.advanceTimersByTimeAsync(120)

    await expect(pending).resolves.toBeNull()
  })

  it('findMany returns values positionally aligned with ids, null for misses', async () => {
    /*
     * Scenario: batch read mixing a known id and an unknown id.
     * Rule it protects: one delay covers the whole batch and each slot maps to the
     * seeded row or null, preserving input order.
     */
    const store = new ProductOriginStore()

    const pending = store.findMany([FIRST.id, 'ghost'])
    await jest.advanceTimersByTimeAsync(120)

    await expect(pending).resolves.toEqual([FIRST, null])
  })
})
