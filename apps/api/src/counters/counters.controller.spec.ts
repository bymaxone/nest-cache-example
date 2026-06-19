/**
 * Unit: CountersController — thin HTTP binding over CountersService.
 *
 * Constructs the controller directly with a hand-mocked service and asserts each
 * route delegates correctly, including the optional `{ by }` step (present vs
 * absent). A second block pins the route decorator metadata via `Reflector`.
 *
 * @module counters/counters.controller.spec
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { RequestMethod } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { CountersController } from './counters.controller.js'
import { CountersService } from './counters.service.js'

/** NestJS route-metadata keys (mirror @nestjs/common/constants, which has no NodeNext type subpath). */
const PATH_METADATA = 'path'
const METHOD_METADATA = 'method'

/**
 * Builds the controller with a fully mocked CountersService.
 *
 * @returns The controller plus each service mock for stubbing and assertions.
 */
function setup() {
  const getViews = jest.fn<CountersService['getViews']>()
  const incrViews = jest.fn<CountersService['incrViews']>()
  const decrStock = jest.fn<CountersService['decrStock']>()

  const serviceMock: Partial<CountersService> = { getViews, incrViews, decrStock }

  const controller = new CountersController(serviceMock as CountersService)
  return { controller, getViews, incrViews, decrStock }
}

describe('CountersController (unit)', () => {
  describe('delegation', () => {
    it('getViews forwards the id', async () => {
      /*
       * Scenario: read the current view count.
       * Rule it protects: the controller delegates `params.id` to `service.getViews`.
       */
      const { controller, getViews } = setup()
      getViews.mockResolvedValue(7)

      await expect(controller.getViews({ id: 'p1' })).resolves.toBe(7)
      expect(getViews).toHaveBeenCalledWith('p1')
    })

    it('incrViews forwards an explicit step from the body', async () => {
      /*
       * Scenario: increment with an explicit `{ by }`.
       * Rule it protects: the controller passes `(params.id, body.by)` so the step
       * reaches the service.
       */
      const { controller, incrViews } = setup()
      incrViews.mockResolvedValue(5)

      await expect(controller.incrViews({ id: 'p1' }, { by: 5 })).resolves.toBe(5)
      expect(incrViews).toHaveBeenCalledWith('p1', 5)
    })

    it('incrViews forwards undefined when the body omits the step', async () => {
      /*
       * Scenario: increment with an empty body.
       * Rule it protects: the controller forwards `body.by` (undefined), letting the
       * service apply its default step.
       */
      const { controller, incrViews } = setup()
      incrViews.mockResolvedValue(1)

      await expect(controller.incrViews({ id: 'p1' }, {})).resolves.toBe(1)
      expect(incrViews).toHaveBeenCalledWith('p1', undefined)
    })

    it('decrStock forwards an explicit step from the body', async () => {
      /*
       * Scenario: decrement with an explicit `{ by }`.
       * Rule it protects: the controller passes `(params.id, body.by)`.
       */
      const { controller, decrStock } = setup()
      decrStock.mockResolvedValue(3)

      await expect(controller.decrStock({ id: 'p1' }, { by: 2 })).resolves.toBe(3)
      expect(decrStock).toHaveBeenCalledWith('p1', 2)
    })

    it('decrStock forwards undefined when the body omits the step', async () => {
      /*
       * Scenario: decrement with an empty body.
       * Rule it protects: the controller forwards `body.by` (undefined) for the default.
       */
      const { controller, decrStock } = setup()
      decrStock.mockResolvedValue(9)

      await expect(controller.decrStock({ id: 'p1' }, {})).resolves.toBe(9)
      expect(decrStock).toHaveBeenCalledWith('p1', undefined)
    })
  })

  describe('route metadata', () => {
    const reflector = new Reflector()

    it('mounts the controller under counters', () => {
      /*
       * Scenario: inspect the @Controller base path.
       * Rule it protects: the base path string is exactly `counters`.
       */
      expect(reflector.get<string>(PATH_METADATA, CountersController)).toBe('counters')
    })

    it('declares the expected method + path for every handler', () => {
      /*
       * Scenario: inspect each route's verb and sub-path.
       * Rule it protects: the GET/POST verbs and literal counter sub-paths are pinned.
       */
      const routes: Array<[keyof CountersController, RequestMethod, string]> = [
        ['getViews', RequestMethod.GET, ':id/views'],
        ['incrViews', RequestMethod.POST, ':id/views/incr'],
        ['decrStock', RequestMethod.POST, ':id/stock/decr'],
      ]
      for (const [handler, method, path] of routes) {
        const fn = CountersController.prototype[handler]
        expect(reflector.get<number>(METHOD_METADATA, fn)).toBe(method)
        expect(reflector.get<string>(PATH_METADATA, fn)).toBe(path)
      }
    })
  })
})
