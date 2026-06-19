/**
 * Unit: TtlEventsController — thin HTTP binding over TtlEventsService.
 *
 * Constructs the controller directly with a hand-mocked service and asserts the
 * single route forwards the validated `ttlSeconds` and optional `id` and returns
 * the seed result unchanged. A second block locks the route metadata via `Reflector`.
 *
 * @module ttl-events/ttl-events.controller.spec
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { RequestMethod } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { TtlEventsController } from './ttl-events.controller.js'
import type { TtlEventsService } from './ttl-events.service.js'

/** NestJS route-metadata keys (mirror @nestjs/common/constants, which has no NodeNext type subpath). */
const PATH_METADATA = 'path'
const METHOD_METADATA = 'method'

/**
 * Builds the controller with a fully mocked TtlEventsService.
 *
 * @returns The controller plus the `seed` mock for stubbing and assertions.
 */
function setup() {
  const seed = jest.fn<TtlEventsService['seed']>()
  const serviceMock: Partial<TtlEventsService> = { seed }
  const controller = new TtlEventsController(serviceMock as TtlEventsService)
  return { controller, seed }
}

describe('TtlEventsController (unit)', () => {
  describe('delegation', () => {
    it('forwards ttlSeconds and the explicit id to the service', async () => {
      /*
       * Scenario: seed with an explicit id.
       * Rule it protects: the controller delegates `(body.ttlSeconds, body.id)` in
       * that order and returns the `{ key, ttlSeconds }` result unchanged.
       */
      const { controller, seed } = setup()
      const result = { key: 'cache-example:product:demo', ttlSeconds: 5 }
      seed.mockResolvedValue(result)

      await expect(controller.seed({ ttlSeconds: 5, id: 'demo' })).resolves.toBe(result)
      expect(seed).toHaveBeenCalledWith(5, 'demo')
    })

    it('forwards an undefined id when the body omits it', async () => {
      /*
       * Scenario: seed without an id (the service generates one).
       * Rule it protects: the controller still passes `body.id` through, here
       * `undefined`, so the service applies its own default.
       */
      const { controller, seed } = setup()
      const result = { key: 'cache-example:product:generated', ttlSeconds: 10 }
      seed.mockResolvedValue(result)

      await expect(controller.seed({ ttlSeconds: 10 })).resolves.toBe(result)
      expect(seed).toHaveBeenCalledWith(10, undefined)
    })
  })

  describe('route metadata', () => {
    const reflector = new Reflector()

    it('mounts the controller under ttl-events', () => {
      /*
       * Scenario: inspect the @Controller base path.
       * Rule it protects: the base path string is exactly `ttl-events`.
       */
      expect(reflector.get<string>(PATH_METADATA, TtlEventsController)).toBe('ttl-events')
    })

    it('declares POST seed for the seed handler', () => {
      /*
       * Scenario: inspect the route's verb and sub-path.
       * Rule it protects: the POST verb and the literal `seed` sub-path are pinned
       * so a StringLiteral or method mutant is caught.
       */
      // Indexed (not dotted) access so the handler is read as data, not an unbound
      // method reference; the `keyof` type keeps the key checked against the class.
      const handler: keyof TtlEventsController = 'seed'
      const fn = TtlEventsController.prototype[handler]
      expect(reflector.get<number>(METHOD_METADATA, fn)).toBe(RequestMethod.POST)
      expect(reflector.get<string>(PATH_METADATA, fn)).toBe('seed')
    })
  })
})
