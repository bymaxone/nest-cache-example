/**
 * Unit: CollectionsService — cart hashes and tag sets over the cache facade.
 *
 * Constructs the service directly with a hand-mocked `CacheService`. Hash
 * operations (`hget`/`hset`/`hgetall`) are generic on the facade, so they are
 * mocked as real generic arrows delegating to inner `jest.fn()`s; set operations
 * are non-generic and mocked directly. Each method is asserted to delegate to the
 * correct prefix (`cart` vs `tags`) and to pass its arguments through unchanged.
 *
 * @module collections/collections.service.spec
 */
import { jest } from '@jest/globals'
import type { CacheService } from '@bymax-one/nest-cache'
import type { CartLine } from './collection.types.js'
import { CollectionsService } from './collections.service.js'

/** A deterministic cart line for the hash round-trip assertions. */
const LINE: CartLine = { quantity: 2, priceCents: 500 }

/**
 * Builds the CollectionsService with a fully controllable cache facade.
 *
 * @returns The service plus every inner cache mock for stubbing and assertions.
 */
function setup() {
  const hgetall = jest.fn<(prefix: string, id: string) => Promise<Record<string, CartLine>>>()
  const hget = jest.fn<(prefix: string, id: string, field: string) => Promise<CartLine | null>>()
  const hset =
    jest.fn<(prefix: string, id: string, field: string, value: unknown) => Promise<number>>()
  const hdel = jest.fn<CacheService['hdel']>()
  const sadd = jest.fn<CacheService['sadd']>()
  const srem = jest.fn<CacheService['srem']>()
  const smembers = jest.fn<CacheService['smembers']>()
  const scard = jest.fn<CacheService['scard']>()
  const sismember = jest.fn<CacheService['sismember']>()

  const cacheMock: Partial<CacheService> = {
    hgetall: <T>(prefix: string, id: string): Promise<Record<string, T>> =>
      hgetall(prefix, id) as Promise<Record<string, T>>,
    hget: <T>(prefix: string, id: string, field: string): Promise<T | null> =>
      hget(prefix, id, field) as Promise<T | null>,
    hset: <T>(prefix: string, id: string, field: string, value: T): Promise<number> =>
      hset(prefix, id, field, value),
    hdel,
    sadd,
    srem,
    smembers,
    scard,
    sismember,
  }

  const service = new CollectionsService(cacheMock as CacheService)
  return { service, hgetall, hget, hset, hdel, sadd, srem, smembers, scard, sismember }
}

describe('CollectionsService (unit)', () => {
  describe('cart (hash) operations', () => {
    it('getCart reads the whole hash under the cart prefix', async () => {
      /*
       * Scenario: fetch every line of a cart.
       * Rule it protects: getCart delegates to `hgetall('cart', id)` and returns the
       * decoded record verbatim.
       */
      const { service, hgetall } = setup()
      hgetall.mockResolvedValue({ p1: LINE })

      await expect(service.getCart('c1')).resolves.toEqual({ p1: LINE })
      expect(hgetall).toHaveBeenCalledWith('cart', 'c1')
    })

    it('getCartLine reads a single field under the cart prefix', async () => {
      /*
       * Scenario: fetch one line item by field.
       * Rule it protects: getCartLine delegates to `hget('cart', id, field)`.
       */
      const { service, hget } = setup()
      hget.mockResolvedValue(LINE)

      await expect(service.getCartLine('c1', 'p1')).resolves.toBe(LINE)
      expect(hget).toHaveBeenCalledWith('cart', 'c1', 'p1')
    })

    it('setCartLine writes a field and returns the new-field flag', async () => {
      /*
       * Scenario: add or overwrite a cart line.
       * Rule it protects: setCartLine delegates to `hset('cart', id, field, value)` and
       * surfaces the 1/0 new-vs-overwrite result.
       */
      const { service, hset } = setup()
      hset.mockResolvedValue(1)

      await expect(service.setCartLine('c1', 'p1', LINE)).resolves.toBe(1)
      expect(hset).toHaveBeenCalledWith('cart', 'c1', 'p1', LINE)
    })

    it('removeCartLine deletes a field and returns the removed count', async () => {
      /*
       * Scenario: remove a cart line.
       * Rule it protects: removeCartLine delegates to `hdel('cart', id, field)`.
       */
      const { service, hdel } = setup()
      hdel.mockResolvedValue(1)

      await expect(service.removeCartLine('c1', 'p1')).resolves.toBe(1)
      expect(hdel).toHaveBeenCalledWith('cart', 'c1', 'p1')
    })
  })

  describe('tags (set) operations', () => {
    it('addTags spreads members into sadd under the tags prefix', async () => {
      /*
       * Scenario: add several raw string tags at once.
       * Rule it protects: addTags spreads `tags` into `sadd('tags', id, ...tags)` and
       * returns the count of newly added members.
       */
      const { service, sadd } = setup()
      sadd.mockResolvedValue(2)

      await expect(service.addTags('p1', ['a', 'b'])).resolves.toBe(2)
      expect(sadd).toHaveBeenCalledWith('tags', 'p1', 'a', 'b')
    })

    it('listTags returns members and cardinality from a parallel read', async () => {
      /*
       * Scenario: list a tag set with its size.
       * Rule it protects: listTags fans out `smembers` + `scard` (both under the tags
       * prefix) and shapes the result as `{ tags, count }`.
       */
      const { service, smembers, scard } = setup()
      smembers.mockResolvedValue(['a', 'b'])
      scard.mockResolvedValue(2)

      await expect(service.listTags('p1')).resolves.toEqual({ tags: ['a', 'b'], count: 2 })
      expect(smembers).toHaveBeenCalledWith('tags', 'p1')
      expect(scard).toHaveBeenCalledWith('tags', 'p1')
    })

    it('hasTag tests set membership under the tags prefix', async () => {
      /*
       * Scenario: check whether a tag is present.
       * Rule it protects: hasTag delegates to `sismember('tags', id, tag)`.
       */
      const { service, sismember } = setup()
      sismember.mockResolvedValue(true)

      await expect(service.hasTag('p1', 'a')).resolves.toBe(true)
      expect(sismember).toHaveBeenCalledWith('tags', 'p1', 'a')
    })

    it('removeTag removes one member under the tags prefix', async () => {
      /*
       * Scenario: remove a tag from the set.
       * Rule it protects: removeTag delegates to `srem('tags', id, tag)`.
       */
      const { service, srem } = setup()
      srem.mockResolvedValue(1)

      await expect(service.removeTag('p1', 'a')).resolves.toBe(1)
      expect(srem).toHaveBeenCalledWith('tags', 'p1', 'a')
    })
  })
})
