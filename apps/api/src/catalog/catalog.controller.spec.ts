/**
 * Unit: CatalogController — thin HTTP binding over CatalogService.
 *
 * Constructs the controller directly with a hand-mocked service and asserts that
 * every route delegates with the right arguments and surfaces the right value —
 * crucially that a `null` product becomes a `NotFoundException`. A second block
 * reads the route decorator metadata (path + HTTP method) via `Reflector` to lock
 * the route table against accidental string/method mutations.
 *
 * @module catalog/catalog.controller.spec
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { NotFoundException, RequestMethod } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Product } from './product.types.js'
import { CatalogController } from './catalog.controller.js'
import { CatalogService } from './catalog.service.js'

/** NestJS route-metadata keys (mirror @nestjs/common/constants, which has no NodeNext type subpath). */
const PATH_METADATA = 'path'
const METHOD_METADATA = 'method'

/** A deterministic product for the delegation assertions. */
const PRODUCT: Product = { id: 'p1', name: 'Alpha', priceCents: 100, tags: ['x'], stock: 5 }

/**
 * Builds the controller with a fully mocked CatalogService.
 *
 * @returns The controller plus each service mock for stubbing and assertions.
 */
function setup() {
  const getProducts = jest.fn<CatalogService['getProducts']>()
  const getTtl = jest.fn<CatalogService['getTtl']>()
  const getProduct = jest.fn<CatalogService['getProduct']>()
  const seedProduct = jest.fn<CatalogService['seedProduct']>()
  const setTtl = jest.fn<CatalogService['setTtl']>()
  const persistKey = jest.fn<CatalogService['persistKey']>()

  const serviceMock: Partial<CatalogService> = {
    getProducts,
    getTtl,
    getProduct,
    seedProduct,
    setTtl,
    persistKey,
  }

  const controller = new CatalogController(serviceMock as CatalogService)
  return { controller, getProducts, getTtl, getProduct, seedProduct, setTtl, persistKey }
}

describe('CatalogController (unit)', () => {
  describe('delegation', () => {
    it('getProducts forwards the validated ids array to the service', async () => {
      /*
       * Scenario: batch read with a parsed ids array.
       * Rule it protects: the controller passes `query.ids` straight through and
       * returns the positional result unchanged.
       */
      const { controller, getProducts } = setup()
      getProducts.mockResolvedValue([PRODUCT, null])

      await expect(controller.getProducts({ ids: ['p1', 'p2'] })).resolves.toEqual([PRODUCT, null])
      expect(getProducts).toHaveBeenCalledWith(['p1', 'p2'])
    })

    it('getTtl forwards the id and returns the TTL', async () => {
      /*
       * Scenario: read a key's TTL.
       * Rule it protects: the controller delegates `params.id` to `service.getTtl`.
       */
      const { controller, getTtl } = setup()
      getTtl.mockResolvedValue(-1)

      await expect(controller.getTtl({ id: 'p1' })).resolves.toBe(-1)
      expect(getTtl).toHaveBeenCalledWith('p1')
    })

    it('getProduct returns the product when the service resolves one', async () => {
      /*
       * Scenario: read-through hit/miss that yields a product.
       * Rule it protects: a non-null service result is returned as-is (no 404).
       */
      const { controller, getProduct } = setup()
      getProduct.mockResolvedValue(PRODUCT)

      await expect(controller.getProduct({ id: 'p1' })).resolves.toBe(PRODUCT)
      expect(getProduct).toHaveBeenCalledWith('p1')
    })

    it('getProduct throws NotFoundException when the service resolves null', async () => {
      /*
       * Scenario: the origin has no such product (service returns null).
       * Rule it protects: the controller maps a null result to a 404 NotFoundException
       * carrying the offending id — the one piece of HTTP semantics it owns.
       */
      const { controller, getProduct } = setup()
      getProduct.mockResolvedValue(null)

      await expect(controller.getProduct({ id: 'ghost' })).rejects.toBeInstanceOf(NotFoundException)
      await expect(controller.getProduct({ id: 'ghost' })).rejects.toThrow(
        "Product 'ghost' not found",
      )
    })

    it('seedProduct forwards the id and override body to the service', async () => {
      /*
       * Scenario: idempotent seed with override fields.
       * Rule it protects: the controller passes `(params.id, body)` and returns the
       * `{ isCreated, isPresent }` result unchanged.
       */
      const { controller, seedProduct } = setup()
      seedProduct.mockResolvedValue({ isCreated: true, isPresent: true })

      await expect(controller.seedProduct({ id: 'p1' }, { name: 'Override' })).resolves.toEqual({
        isCreated: true,
        isPresent: true,
      })
      expect(seedProduct).toHaveBeenCalledWith('p1', { name: 'Override' })
    })

    it('setTtl forwards id and ttlSeconds to the service', async () => {
      /*
       * Scenario: set a TTL on an existing key.
       * Rule it protects: the controller delegates `(params.id, body.ttlSeconds)`.
       */
      const { controller, setTtl } = setup()
      setTtl.mockResolvedValue(true)

      await expect(controller.setTtl({ id: 'p1' }, { ttlSeconds: 30 })).resolves.toBe(true)
      expect(setTtl).toHaveBeenCalledWith('p1', 30)
    })

    it('persistKey forwards the id to the service', async () => {
      /*
       * Scenario: remove a key's TTL.
       * Rule it protects: the controller delegates `params.id` to `service.persistKey`.
       */
      const { controller, persistKey } = setup()
      persistKey.mockResolvedValue(false)

      await expect(controller.persistKey({ id: 'p1' })).resolves.toBe(false)
      expect(persistKey).toHaveBeenCalledWith('p1')
    })
  })

  describe('route metadata', () => {
    const reflector = new Reflector()

    it('mounts the controller under catalog/products', () => {
      /*
       * Scenario: inspect the @Controller base path.
       * Rule it protects: the base path string is exactly `catalog/products`.
       */
      expect(reflector.get<string>(PATH_METADATA, CatalogController)).toBe('catalog/products')
    })

    it('declares the expected method + path for every handler', () => {
      /*
       * Scenario: inspect each route's verb and sub-path.
       * Rule it protects: GET/POST verbs and the literal sub-paths are pinned so a
       * StringLiteral or method mutant on any route is caught.
       */
      const routes: Array<[keyof CatalogController, RequestMethod, string]> = [
        ['getProducts', RequestMethod.GET, '/'],
        ['getTtl', RequestMethod.GET, ':id/ttl'],
        ['getProduct', RequestMethod.GET, ':id'],
        ['seedProduct', RequestMethod.POST, ':id/seed'],
        ['setTtl', RequestMethod.POST, ':id/expire'],
        ['persistKey', RequestMethod.POST, ':id/persist'],
      ]
      for (const [handler, method, path] of routes) {
        const fn = CatalogController.prototype[handler]
        expect(reflector.get<number>(METHOD_METADATA, fn)).toBe(method)
        expect(reflector.get<string>(PATH_METADATA, fn)).toBe(path)
      }
    })
  })
})
