/**
 * Unit specs for the stampede lab's simulated slow origin.
 *
 * Drives both exported helpers with fake timers so the artificial latency is
 * deterministic and instantaneous: `delay` resolves only once its timer fires,
 * and `fetchProductFromOrigin` returns the fixed demo `Product` shape after its
 * latency elapses (the value the lock winner caches for the losers to read).
 *
 * @module stampede/origin.spec
 */
import { jest } from '@jest/globals'
import { delay, fetchProductFromOrigin } from './origin.js'

describe('stampede origin helpers', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('delay resolves only after its timer has elapsed', async () => {
    /*
     * Scenario: schedule a delay and advance the clock to exactly its duration.
     * Rule it protects: `delay(ms)` stays pending until `ms` has passed, then
     * resolves to `undefined` — the shared backoff primitive both the origin
     * latency and the loser poll rely on.
     */
    const onResolve = jest.fn()
    const pending = delay(400).then(onResolve)

    expect(onResolve).not.toHaveBeenCalled()
    await jest.advanceTimersByTimeAsync(400)
    await pending
    expect(onResolve).toHaveBeenCalledTimes(1)
  })

  it('fetchProductFromOrigin returns the deterministic demo product after its latency', async () => {
    /*
     * Scenario: fetch a product id from the simulated origin and let the latency elapse.
     * Rule it protects: the resolved value is the exact catalog-shaped product
     * (interpolated id, fixed price/stock, empty tags) so a later catalog read of
     * the same key is never left with missing fields.
     */
    const pending = fetchProductFromOrigin('p1')
    await jest.advanceTimersByTimeAsync(400)

    await expect(pending).resolves.toEqual({
      id: 'p1',
      name: 'Product p1',
      priceCents: 1000,
      tags: [],
      stock: 100,
    })
  })
})
