/**
 * Unit: CountersService — atomic view/stock counters over the cache facade.
 *
 * Constructs the service directly with a hand-mocked `CacheService`. `get` is
 * generic so it is mocked as a generic arrow delegating to an inner `jest.fn()`;
 * `incr`/`decr` are non-generic. Covers the absent-counter default (`?? 0`) and
 * both the with-step and default-step (`by === undefined`) branches.
 *
 * @module counters/counters.service.spec
 */
import { jest } from '@jest/globals'
import type { CacheService } from '@bymax-one/nest-cache'
import { CountersService } from './counters.service.js'

/**
 * Builds the CountersService with a fully controllable cache facade.
 *
 * @returns The service plus the inner cache mocks for stubbing and assertions.
 */
function setup() {
  const get = jest.fn<(prefix: string, id: string) => Promise<number | null>>()
  const incr = jest.fn<CacheService['incr']>()
  const decr = jest.fn<CacheService['decr']>()

  const cacheMock: Partial<CacheService> = {
    get: <T>(prefix: string, id: string): Promise<T | null> => get(prefix, id) as Promise<T | null>,
    incr,
    decr,
  }

  const service = new CountersService(cacheMock as CacheService)
  return { service, get, incr, decr }
}

describe('CountersService (unit)', () => {
  describe('getViews', () => {
    it('returns the stored count under the views prefix', async () => {
      /*
       * Scenario: the views key holds a number.
       * Rule it protects: getViews reads `get('views', id)` and returns it (left arm
       * of `?? 0`).
       */
      const { service, get } = setup()
      get.mockResolvedValue(7)

      await expect(service.getViews('p1')).resolves.toBe(7)
      expect(get).toHaveBeenCalledWith('views', 'p1')
    })

    it('returns 0 when the views key is absent', async () => {
      /*
       * Scenario: the views key has never been set.
       * Rule it protects: a null read collapses to `0` via the right arm of `?? 0`.
       */
      const { service, get } = setup()
      get.mockResolvedValue(null)

      await expect(service.getViews('p1')).resolves.toBe(0)
    })
  })

  describe('incrViews', () => {
    it('increments by 1 when no step is provided', async () => {
      /*
       * Scenario: bump a view counter with the default step.
       * Rule it protects: with `by === undefined` the service calls `incr('views', id)`
       * with no step argument (Redis INCR).
       */
      const { service, incr } = setup()
      incr.mockResolvedValue(1)

      await expect(service.incrViews('p1')).resolves.toBe(1)
      expect(incr).toHaveBeenCalledWith('views', 'p1')
    })

    it('increments by the provided step', async () => {
      /*
       * Scenario: bump a view counter by an explicit step.
       * Rule it protects: with a defined `by` the service calls `incr('views', id, by)`
       * (Redis INCRBY).
       */
      const { service, incr } = setup()
      incr.mockResolvedValue(5)

      await expect(service.incrViews('p1', 5)).resolves.toBe(5)
      expect(incr).toHaveBeenCalledWith('views', 'p1', 5)
    })
  })

  describe('decrStock', () => {
    it('decrements by 1 when no step is provided', async () => {
      /*
       * Scenario: drop stock by the default step.
       * Rule it protects: with `by === undefined` the service calls `decr('stock', id)`
       * with no step argument (Redis DECR).
       */
      const { service, decr } = setup()
      decr.mockResolvedValue(9)

      await expect(service.decrStock('p1')).resolves.toBe(9)
      expect(decr).toHaveBeenCalledWith('stock', 'p1')
    })

    it('decrements by the provided step', async () => {
      /*
       * Scenario: drop stock by an explicit step.
       * Rule it protects: with a defined `by` the service calls `decr('stock', id, by)`
       * (Redis DECRBY).
       */
      const { service, decr } = setup()
      decr.mockResolvedValue(3)

      await expect(service.decrStock('p1', 2)).resolves.toBe(3)
      expect(decr).toHaveBeenCalledWith('stock', 'p1', 2)
    })
  })
})
