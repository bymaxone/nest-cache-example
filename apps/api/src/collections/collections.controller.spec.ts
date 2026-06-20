/**
 * Unit: CollectionsController — thin HTTP binding over CollectionsService.
 *
 * Constructs the controller directly with a hand-mocked service and asserts each
 * cart/tag route delegates with the right arguments and returns the service
 * result verbatim. A second block pins the route decorator metadata (path + HTTP
 * method) via `Reflector` against accidental mutation.
 *
 * @module collections/collections.controller.spec
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { RequestMethod } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { CartLine } from './collection.types.js'
import {
  CollectionsController,
  collectionIdSchema,
  cartLineParamsSchema,
  tagParamsSchema,
} from './collections.controller.js'
import { CollectionsService } from './collections.service.js'

/** NestJS route-metadata keys (mirror @nestjs/common/constants, which has no NodeNext type subpath). */
const PATH_METADATA = 'path'
const METHOD_METADATA = 'method'

/** A deterministic cart line for the delegation assertions. */
const LINE: CartLine = { quantity: 2, priceCents: 500 }

/**
 * Builds the controller with a fully mocked CollectionsService.
 *
 * @returns The controller plus each service mock for stubbing and assertions.
 */
function setup() {
  const getCart = jest.fn<CollectionsService['getCart']>()
  const getCartLine = jest.fn<CollectionsService['getCartLine']>()
  const setCartLine = jest.fn<CollectionsService['setCartLine']>()
  const removeCartLine = jest.fn<CollectionsService['removeCartLine']>()
  const addTags = jest.fn<CollectionsService['addTags']>()
  const listTags = jest.fn<CollectionsService['listTags']>()
  const hasTag = jest.fn<CollectionsService['hasTag']>()
  const removeTag = jest.fn<CollectionsService['removeTag']>()

  const serviceMock: Partial<CollectionsService> = {
    getCart,
    getCartLine,
    setCartLine,
    removeCartLine,
    addTags,
    listTags,
    hasTag,
    removeTag,
  }

  const controller = new CollectionsController(serviceMock as CollectionsService)
  return {
    controller,
    getCart,
    getCartLine,
    setCartLine,
    removeCartLine,
    addTags,
    listTags,
    hasTag,
    removeTag,
  }
}

describe('CollectionsController (unit)', () => {
  describe('delegation', () => {
    it('getCart forwards the cart id', async () => {
      /*
       * Scenario: read the whole cart hash.
       * Rule it protects: the controller delegates `params.id` to `service.getCart`.
       */
      const { controller, getCart } = setup()
      getCart.mockResolvedValue({ p1: LINE })

      await expect(controller.getCart({ id: 'c1' })).resolves.toEqual({ p1: LINE })
      expect(getCart).toHaveBeenCalledWith('c1')
    })

    it('getCartLine forwards id and field', async () => {
      /*
       * Scenario: read one cart line.
       * Rule it protects: the controller delegates `(params.id, params.field)`.
       */
      const { controller, getCartLine } = setup()
      getCartLine.mockResolvedValue(LINE)

      await expect(controller.getCartLine({ id: 'c1', field: 'p1' })).resolves.toBe(LINE)
      expect(getCartLine).toHaveBeenCalledWith('c1', 'p1')
    })

    it('setCartLine forwards id, body field and value', async () => {
      /*
       * Scenario: add/update a cart line.
       * Rule it protects: the controller unpacks the body into `(id, field, value)`.
       */
      const { controller, setCartLine } = setup()
      setCartLine.mockResolvedValue(1)

      await expect(
        controller.setCartLine({ id: 'c1' }, { field: 'p1', value: LINE }),
      ).resolves.toBe(1)
      expect(setCartLine).toHaveBeenCalledWith('c1', 'p1', LINE)
    })

    it('removeCartLine forwards id and field', async () => {
      /*
       * Scenario: remove a cart line.
       * Rule it protects: the controller delegates `(params.id, params.field)`.
       */
      const { controller, removeCartLine } = setup()
      removeCartLine.mockResolvedValue(1)

      await expect(controller.removeCartLine({ id: 'c1', field: 'p1' })).resolves.toBe(1)
      expect(removeCartLine).toHaveBeenCalledWith('c1', 'p1')
    })

    it('addTags forwards id and the tags array', async () => {
      /*
       * Scenario: add tags to a product set.
       * Rule it protects: the controller delegates `(params.id, body.tags)`.
       */
      const { controller, addTags } = setup()
      addTags.mockResolvedValue(2)

      await expect(controller.addTags({ id: 'p1' }, { tags: ['a', 'b'] })).resolves.toBe(2)
      expect(addTags).toHaveBeenCalledWith('p1', ['a', 'b'])
    })

    it('listTags forwards the id', async () => {
      /*
       * Scenario: list tags and cardinality.
       * Rule it protects: the controller delegates `params.id` to `service.listTags`.
       */
      const { controller, listTags } = setup()
      listTags.mockResolvedValue({ tags: ['a'], count: 1 })

      await expect(controller.listTags({ id: 'p1' })).resolves.toEqual({ tags: ['a'], count: 1 })
      expect(listTags).toHaveBeenCalledWith('p1')
    })

    it('hasTag forwards id and tag', async () => {
      /*
       * Scenario: test tag membership.
       * Rule it protects: the controller delegates `(params.id, params.tag)`.
       */
      const { controller, hasTag } = setup()
      hasTag.mockResolvedValue(true)

      await expect(controller.hasTag({ id: 'p1', tag: 'a' })).resolves.toBe(true)
      expect(hasTag).toHaveBeenCalledWith('p1', 'a')
    })

    it('removeTag forwards id and tag', async () => {
      /*
       * Scenario: remove a tag.
       * Rule it protects: the controller delegates `(params.id, params.tag)`.
       */
      const { controller, removeTag } = setup()
      removeTag.mockResolvedValue(1)

      await expect(controller.removeTag({ id: 'p1', tag: 'a' })).resolves.toBe(1)
      expect(removeTag).toHaveBeenCalledWith('p1', 'a')
    })
  })

  describe('route metadata', () => {
    const reflector = new Reflector()

    it('mounts the controller under collections', () => {
      /*
       * Scenario: inspect the @Controller base path.
       * Rule it protects: the base path string is exactly `collections`.
       */
      expect(reflector.get<string>(PATH_METADATA, CollectionsController)).toBe('collections')
    })

    it('declares the expected method + path for every handler', () => {
      /*
       * Scenario: inspect each route's verb and sub-path.
       * Rule it protects: GET/POST/DELETE verbs and the literal sub-paths are pinned so
       * a StringLiteral or method mutant on any cart/tag route is caught.
       */
      const routes: Array<[keyof CollectionsController, RequestMethod, string]> = [
        ['getCart', RequestMethod.GET, ':id/cart'],
        ['getCartLine', RequestMethod.GET, ':id/cart/:field'],
        ['setCartLine', RequestMethod.POST, ':id/cart'],
        ['removeCartLine', RequestMethod.DELETE, ':id/cart/:field'],
        ['addTags', RequestMethod.POST, ':id/tags'],
        ['listTags', RequestMethod.GET, ':id/tags'],
        ['hasTag', RequestMethod.GET, ':id/tags/:tag'],
        ['removeTag', RequestMethod.DELETE, ':id/tags/:tag'],
      ]
      for (const [handler, method, path] of routes) {
        const fn = CollectionsController.prototype[handler]
        expect(reflector.get<number>(METHOD_METADATA, fn)).toBe(method)
        expect(reflector.get<string>(PATH_METADATA, fn)).toBe(path)
      }
    })
  })

  describe('inline param schemas', () => {
    /*
     * Each route validates its path params with an inline Zod schema applied via the
     * ZodValidationPipe. The accept cases use multi-character values: a `.min(1)` →
     * `.max(1)` mutant would reject any value longer than one character, so accepting
     * a two-char value pins every `.min(1)`. The reject cases empty one field at a
     * time: degrading the schema to `z.object({})` would strip and accept anything,
     * so rejecting an empty field pins the object shape.
     */
    it('collectionIdSchema accepts a non-empty id and rejects an empty one', () => {
      expect(collectionIdSchema.safeParse({ id: 'c1' }).success).toBe(true)
      expect(collectionIdSchema.safeParse({ id: '' }).success).toBe(false)
    })

    it('cartLineParamsSchema requires a non-empty id and field', () => {
      expect(cartLineParamsSchema.safeParse({ id: 'c1', field: 'p1' }).success).toBe(true)
      expect(cartLineParamsSchema.safeParse({ id: '', field: 'p1' }).success).toBe(false)
      expect(cartLineParamsSchema.safeParse({ id: 'c1', field: '' }).success).toBe(false)
    })

    it('tagParamsSchema requires a non-empty id and tag', () => {
      expect(tagParamsSchema.safeParse({ id: 'p1', tag: 't1' }).success).toBe(true)
      expect(tagParamsSchema.safeParse({ id: '', tag: 't1' }).success).toBe(false)
      expect(tagParamsSchema.safeParse({ id: 'p1', tag: '' }).success).toBe(false)
    })
  })
})
