/**
 * Unit: ErrorsDemoController — thin HTTP binding over ErrorsDemoService.
 *
 * Constructs the controller directly with a hand-mocked service and asserts the
 * single route forwards the validated `:code` and propagates the thrown
 * `CacheException` unchanged (the controller never hand-rolls a status). A second
 * block locks the route table (path + HTTP method) via `Reflector`.
 *
 * @module errors-demo/errors-demo.controller.spec
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { RequestMethod } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { CacheException } from '@bymax-one/nest-cache'
import { CACHE_ERROR_CODES } from '@bymax-one/nest-cache/shared'
import { ErrorsDemoController } from './errors-demo.controller.js'
import type { ErrorsDemoService } from './errors-demo.service.js'

/** NestJS route-metadata keys (mirror @nestjs/common/constants, which has no NodeNext type subpath). */
const PATH_METADATA = 'path'
const METHOD_METADATA = 'method'

/**
 * Builds the controller with a fully mocked ErrorsDemoService.
 *
 * @returns The controller plus the `trigger` mock for stubbing and assertions.
 */
function setup() {
  const trigger = jest.fn<ErrorsDemoService['trigger']>()
  const serviceMock: Partial<ErrorsDemoService> = { trigger }
  const controller = new ErrorsDemoController(serviceMock as ErrorsDemoService)
  return { controller, trigger }
}

describe('ErrorsDemoController (unit)', () => {
  describe('delegation', () => {
    it('forwards the validated code and propagates the thrown CacheException', async () => {
      /*
       * Scenario: a canonical code is requested and the service throws its mapped
       * CacheException.
       * Rule it protects: the controller delegates `params.code` and lets the
       * exception bubble unchanged — no status is invented here.
       */
      const { controller, trigger } = setup()
      trigger.mockRejectedValue(new CacheException(CACHE_ERROR_CODES.INVALID_KEY))

      await expect(
        controller.trigger({ code: CACHE_ERROR_CODES.INVALID_KEY }),
      ).rejects.toBeInstanceOf(CacheException)
      expect(trigger).toHaveBeenCalledWith(CACHE_ERROR_CODES.INVALID_KEY)
    })
  })

  describe('route metadata', () => {
    const reflector = new Reflector()

    it('mounts the controller under errors', () => {
      /*
       * Scenario: inspect the @Controller base path.
       * Rule it protects: the base path string is exactly `errors`.
       */
      expect(reflector.get<string>(PATH_METADATA, ErrorsDemoController)).toBe('errors')
    })

    it('declares POST :code for the trigger handler', () => {
      /*
       * Scenario: inspect the single route's verb and sub-path.
       * Rule it protects: the POST verb and the literal `:code` sub-path are pinned
       * so a StringLiteral or method mutant is caught.
       */
      // Indexed (not dotted) access so the handler is read as data, not an unbound
      // method reference; the `keyof` type keeps the key checked against the class.
      const handler: keyof ErrorsDemoController = 'trigger'
      const fn = ErrorsDemoController.prototype[handler]
      expect(reflector.get<number>(METHOD_METADATA, fn)).toBe(RequestMethod.POST)
      expect(reflector.get<string>(PATH_METADATA, fn)).toBe(':code')
    })
  })
})
