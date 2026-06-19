/**
 * Unit: CatalogService — read-through, batch back-fill, seed, and TTL ops.
 *
 * Constructs the service directly with hand-mocked collaborators (CacheService
 * facade, ProductOriginStore, MetricsService) and a real ConfigService so the
 * TTL is the genuine validated value. Every cache branch — hit / miss /
 * positional batch back-fill / setNx-merge precedence / expire-ttl-persist — is
 * driven through its concrete path and asserted on the exact facade calls.
 *
 * The CacheService facade is mocked as a `Partial<CacheService>`: generic
 * methods (`get`/`set`/`mget`/`mset`/`setNx`) are real generic arrows that
 * delegate to inner `jest.fn()`s (a `Mock<…>` is not assignable to a generic
 * call signature), so assertions target those inner mocks directly.
 *
 * @module catalog/catalog.service.spec
 */
import { jest } from '@jest/globals'
import { ConfigService } from '@nestjs/config'
import type { CacheService } from '@bymax-one/nest-cache'
import type { Env } from '../config/env.schema.js'
import type { MetricsService } from '../metrics/metrics.service.js'
import type { ProductOriginStore } from './product-origin.store.js'
import type { Product } from './product.types.js'
import type { SeedProduct } from './dto/seed-product.dto.js'
import { CatalogService } from './catalog.service.js'

/** The TTL the real ConfigService resolves and the service caches at construction. */
const TTL = 60

/** A deterministic product used across the read-through assertions. */
const PRODUCT_A: Product = { id: 'a', name: 'Alpha', priceCents: 100, tags: ['x'], stock: 5 }
const PRODUCT_B: Product = { id: 'b', name: 'Beta', priceCents: 200, tags: ['y'], stock: 7 }

/**
 * Builds the CatalogService under test with fully controllable collaborators.
 *
 * @returns The service plus every inner mock so a test can stub returns and
 *   assert the exact facade calls.
 */
function setup() {
  const get = jest.fn<(prefix: string, id: string) => Promise<Product | null>>()
  const mget = jest.fn<(prefix: string, ids: readonly string[]) => Promise<Array<Product | null>>>()
  const set = jest.fn<(prefix: string, id: string, value: unknown, ttl?: number) => Promise<void>>()
  const mset =
    jest.fn<(prefix: string, entries: ReadonlyArray<readonly [string, unknown]>) => Promise<void>>()
  const setNx =
    jest.fn<(prefix: string, id: string, value: unknown, ttl?: number) => Promise<boolean>>()
  const exists = jest.fn<CacheService['exists']>()
  const expire = jest.fn<CacheService['expire']>()
  const ttl = jest.fn<CacheService['ttl']>()
  const persist = jest.fn<CacheService['persist']>()

  const cacheMock: Partial<CacheService> = {
    get: <T>(prefix: string, id: string): Promise<T | null> => get(prefix, id) as Promise<T | null>,
    mget: <T>(prefix: string, ids: readonly string[]): Promise<Array<T | null>> =>
      mget(prefix, ids) as Promise<Array<T | null>>,
    set: <T>(prefix: string, id: string, value: T, ttlSeconds?: number): Promise<void> =>
      set(prefix, id, value, ttlSeconds),
    mset: <T>(prefix: string, entries: ReadonlyArray<readonly [string, T]>): Promise<void> =>
      mset(prefix, entries),
    setNx: <T>(prefix: string, id: string, value: T, ttlSeconds?: number): Promise<boolean> =>
      setNx(prefix, id, value, ttlSeconds),
    exists,
    expire,
    ttl,
    persist,
  }

  const find = jest.fn<(id: string) => Promise<Product | null>>()
  const findMany = jest.fn<(ids: string[]) => Promise<Array<Product | null>>>()
  const originMock: Partial<ProductOriginStore> = { find, findMany }

  const recordHit = jest.fn<(prefix: string) => void>()
  const recordMiss = jest.fn<(prefix: string) => void>()
  const metricsMock: Partial<MetricsService> = { recordHit, recordMiss }

  const config = new ConfigService<Env, true>({ CACHE_DEFAULT_TTL: TTL })

  const service = new CatalogService(
    cacheMock as CacheService,
    originMock as ProductOriginStore,
    config,
    metricsMock as MetricsService,
  )

  return {
    service,
    get,
    mget,
    set,
    mset,
    setNx,
    exists,
    expire,
    ttl,
    persist,
    find,
    findMany,
    recordHit,
    recordMiss,
  }
}

describe('CatalogService (unit)', () => {
  describe('getProduct', () => {
    it('returns the cached value and records a hit without touching the origin', async () => {
      /*
       * Scenario: GET key is present in cache (get resolves a non-null product).
       * Rule it protects: a hit short-circuits — recordHit fires, the origin is
       * never queried, and the cache is not re-written.
       */
      const { service, get, set, find, recordHit, recordMiss } = setup()
      get.mockResolvedValue(PRODUCT_A)

      const result = await service.getProduct('a')

      expect(result).toBe(PRODUCT_A)
      expect(get).toHaveBeenCalledWith('product', 'a')
      expect(recordHit).toHaveBeenCalledWith('product')
      expect(recordMiss).not.toHaveBeenCalled()
      expect(find).not.toHaveBeenCalled()
      expect(set).not.toHaveBeenCalled()
    })

    it('on a miss fetches the origin and back-fills the cache with the TTL', async () => {
      /*
       * Scenario: cache miss (get → null) but the origin has the product.
       * Rule it protects: the read-through writes the fresh value back with the
       * configured TTL and records a miss.
       */
      const { service, get, set, find, recordMiss, recordHit } = setup()
      get.mockResolvedValue(null)
      find.mockResolvedValue(PRODUCT_B)

      const result = await service.getProduct('b')

      expect(result).toBe(PRODUCT_B)
      expect(recordMiss).toHaveBeenCalledWith('product')
      expect(recordHit).not.toHaveBeenCalled()
      expect(find).toHaveBeenCalledWith('b')
      expect(set).toHaveBeenCalledWith('product', 'b', PRODUCT_B, TTL)
    })

    it('on a miss with an unknown id returns null and never writes the cache', async () => {
      /*
       * Scenario: cache miss and the origin also has no such product.
       * Rule it protects: the `fresh !== null` guard suppresses the back-fill —
       * an absent origin row must not poison the cache with a null write.
       */
      const { service, get, set, find } = setup()
      get.mockResolvedValue(null)
      find.mockResolvedValue(null)

      const result = await service.getProduct('missing')

      expect(result).toBeNull()
      expect(find).toHaveBeenCalledWith('missing')
      expect(set).not.toHaveBeenCalled()
    })
  })

  describe('getProducts', () => {
    it('mixes hits and misses, back-fills only found rows, and aligns the result positionally', async () => {
      /*
       * Scenario: ids [a,b,c] where a hits, b misses→found, c misses→not-found.
       * The mget array is length-2 so slot[2] is `undefined` (shorter than ids).
       * Rule it protects: hit slots are returned verbatim; missing ids are fetched
       * once and only found rows are mset back; the output is aligned to `ids`.
       */
      const { service, mget, mset, findMany, recordHit, recordMiss } = setup()
      mget.mockResolvedValue([PRODUCT_A, null])
      findMany.mockResolvedValue([PRODUCT_B, null])

      const result = await service.getProducts(['a', 'b', 'c'])

      expect(result).toEqual([PRODUCT_A, PRODUCT_B, null])
      expect(mget).toHaveBeenCalledWith('product', ['a', 'b', 'c'])
      expect(findMany).toHaveBeenCalledWith(['b', 'c'])
      expect(mset).toHaveBeenCalledWith('product', [['b', PRODUCT_B]])
      expect(recordHit).toHaveBeenCalledTimes(1)
      expect(recordMiss).toHaveBeenCalledTimes(2)
    })

    it('skips the back-fill write when every id is a cache hit', async () => {
      /*
       * Scenario: all ids hit (mget returns every value).
       * Rule it protects: with no missing ids `entries` is empty, so mset is NOT
       * called (the `entries.length > 0` guard), and findMany runs on an empty list.
       */
      const { service, mget, mset, findMany, recordHit, recordMiss } = setup()
      mget.mockResolvedValue([PRODUCT_A, PRODUCT_B])
      findMany.mockResolvedValue([])

      const result = await service.getProducts(['a', 'b'])

      expect(result).toEqual([PRODUCT_A, PRODUCT_B])
      expect(findMany).toHaveBeenCalledWith([])
      expect(mset).not.toHaveBeenCalled()
      expect(recordHit).toHaveBeenCalledTimes(2)
      expect(recordMiss).not.toHaveBeenCalled()
    })

    it('treats an origin row missing from the batch (undefined) as null and skips its write', async () => {
      /*
       * Scenario: one miss whose origin lookup yields `undefined` (findMany array
       * shorter than missingIds), distinct from an explicit null.
       * Rule it protects: the `product !== undefined` arm of the push guard rejects
       * the ghost row, mset is skipped, and the slot resolves to null.
       */
      const { service, mget, mset, findMany } = setup()
      mget.mockResolvedValue([])
      findMany.mockResolvedValue([])

      const result = await service.getProducts(['x'])

      expect(result).toEqual([null])
      expect(findMany).toHaveBeenCalledWith(['x'])
      expect(mset).not.toHaveBeenCalled()
    })
  })

  describe('seedProduct', () => {
    it('fills every field from the origin row when no overrides are supplied', async () => {
      /*
       * Scenario: origin has the product and the body is the default empty object.
       * Rule it protects: with `base = originProduct`, each field falls to the
       * origin value (the middle arm of every `?? ` chain), and the write uses the TTL.
       */
      const { service, find, setNx, exists } = setup()
      find.mockResolvedValue(PRODUCT_A)
      setNx.mockResolvedValue(true)
      exists.mockResolvedValue(true)
      const overrides: SeedProduct = {}

      const result = await service.seedProduct('a', overrides)

      expect(result).toEqual({ isCreated: true, isPresent: true })
      expect(setNx).toHaveBeenCalledWith('product', 'a', PRODUCT_A, TTL)
      expect(exists).toHaveBeenCalledWith('product', 'a')
    })

    it('falls back to the SEED_PRODUCTS row when the origin has no product', async () => {
      /*
       * Scenario: origin miss but the id matches a static seed row (p1).
       * Rule it protects: `base = originProduct ?? seedRow` selects the seed row, so
       * the cached value mirrors the seed catalog rather than collapsing to defaults.
       */
      const { service, find, setNx, exists } = setup()
      find.mockResolvedValue(null)
      setNx.mockResolvedValue(true)
      exists.mockResolvedValue(true)

      const result = await service.seedProduct('p1', {})

      expect(result).toEqual({ isCreated: true, isPresent: true })
      expect(setNx).toHaveBeenCalledWith(
        'product',
        'p1',
        {
          id: 'p1',
          name: 'Wireless Headphones',
          priceCents: 7999,
          tags: ['electronics', 'audio'],
          stock: 42,
        },
        TTL,
      )
    })

    it('uses safe defaults when neither origin nor seed row exist', async () => {
      /*
       * Scenario: unknown id absent from both origin and SEED_PRODUCTS, empty body.
       * Rule it protects: `base = null`, so every `base?.field` is undefined and the
       * final default arms apply — name=id, priceCents=0, tags=[], stock=0.
       */
      const { service, find, setNx, exists } = setup()
      find.mockResolvedValue(null)
      setNx.mockResolvedValue(false)
      exists.mockResolvedValue(false)

      const result = await service.seedProduct('zzz', {})

      expect(result).toEqual({ isCreated: false, isPresent: false })
      expect(setNx).toHaveBeenCalledWith(
        'product',
        'zzz',
        { id: 'zzz', name: 'zzz', priceCents: 0, tags: [], stock: 0 },
        TTL,
      )
    })

    it('prefers explicit body overrides over the origin row for every field', async () => {
      /*
       * Scenario: origin has the product but the body overrides all four fields.
       * Rule it protects: each `overrides.field ?? …` chain takes the override arm,
       * so the body wins over the origin precedence for name/priceCents/tags/stock.
       */
      const { service, find, setNx, exists } = setup()
      find.mockResolvedValue(PRODUCT_A)
      setNx.mockResolvedValue(true)
      exists.mockResolvedValue(true)
      const overrides: SeedProduct = { name: 'Override', priceCents: 999, tags: ['z'], stock: 1 }

      await service.seedProduct('a', overrides)

      expect(setNx).toHaveBeenCalledWith(
        'product',
        'a',
        { id: 'a', name: 'Override', priceCents: 999, tags: ['z'], stock: 1 },
        TTL,
      )
    })
  })

  describe('TTL lifecycle', () => {
    it('setTtl delegates to cache.expire and returns its result', async () => {
      /*
       * Scenario: set a positive TTL on an existing key.
       * Rule it protects: setTtl is a thin pass-through to `expire(prefix, id, ttl)`.
       */
      const { service, expire } = setup()
      expire.mockResolvedValue(true)

      await expect(service.setTtl('a', 30)).resolves.toBe(true)
      expect(expire).toHaveBeenCalledWith('product', 'a', 30)
    })

    it('getTtl delegates to cache.ttl and surfaces the Redis value', async () => {
      /*
       * Scenario: read the remaining TTL of a key.
       * Rule it protects: getTtl returns `ttl(prefix, id)` verbatim, preserving the
       * -2/-1 Redis sentinels.
       */
      const { service, ttl } = setup()
      ttl.mockResolvedValue(-2)

      await expect(service.getTtl('a')).resolves.toBe(-2)
      expect(ttl).toHaveBeenCalledWith('product', 'a')
    })

    it('persistKey delegates to cache.persist and returns its result', async () => {
      /*
       * Scenario: strip the TTL from a key.
       * Rule it protects: persistKey is a thin pass-through to `persist(prefix, id)`.
       */
      const { service, persist } = setup()
      persist.mockResolvedValue(true)

      await expect(service.persistKey('a')).resolves.toBe(true)
      expect(persist).toHaveBeenCalledWith('product', 'a')
    })
  })
})
