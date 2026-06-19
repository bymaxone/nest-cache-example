/**
 * Unit: SerializerDemoController — thin HTTP binding over SerializerDemoService.
 *
 * Constructs the controller directly with a hand-mocked service and asserts each
 * route delegates and merges the `codec` label into the service result. A second
 * block locks the route table (path + HTTP method) via `Reflector`.
 *
 * @module serializer-demo/serializer-demo.controller.spec
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { RequestMethod } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { SerializerDemoController } from './serializer-demo.controller.js'
import type { SerializerDemoService } from './serializer-demo.service.js'

/** NestJS route-metadata keys (mirror @nestjs/common/constants, which has no NodeNext type subpath). */
const PATH_METADATA = 'path'
const METHOD_METADATA = 'method'

/**
 * Builds the controller with a fully mocked SerializerDemoService.
 *
 * @returns The controller plus each service mock for stubbing and assertions.
 */
function setup() {
  const roundtrip = jest.fn<SerializerDemoService['roundtrip']>()
  const caveat = jest.fn<SerializerDemoService['caveat']>()
  const activeSerializer = jest.fn<SerializerDemoService['activeSerializer']>()

  const serviceMock: Partial<SerializerDemoService> = { roundtrip, caveat, activeSerializer }
  const controller = new SerializerDemoController(serviceMock as SerializerDemoService)
  return { controller, roundtrip, caveat, activeSerializer }
}

describe('SerializerDemoController (unit)', () => {
  describe('delegation', () => {
    it('roundtrip forwards the body and prepends the codec label to the result', async () => {
      /*
       * Scenario: round-trip a payload with an explicit codec query.
       * Rule it protects: the controller passes `body` to the service and merges
       * `query.codec` ahead of the service's `{ raw, decoded, rawBytes, rawBypass }`.
       */
      const { controller, roundtrip } = setup()
      roundtrip.mockResolvedValue({
        raw: '{"x":1}',
        decoded: { x: 1 },
        rawBytes: 7,
        rawBypass: '{"x":1}',
      })

      await expect(controller.roundtrip({ codec: 'msgpack' }, { x: 1 })).resolves.toEqual({
        codec: 'msgpack',
        raw: '{"x":1}',
        decoded: { x: 1 },
        rawBytes: 7,
        rawBypass: '{"x":1}',
      })
      expect(roundtrip).toHaveBeenCalledWith({ x: 1 })
    })

    it('caveat delegates and prepends the codec label to the caveat result', async () => {
      /*
       * Scenario: run the caveat demo with a codec query.
       * Rule it protects: the controller calls `caveat()` and merges `query.codec`
       * ahead of the service's `{ raw, decoded, dateSurvived, note }`.
       */
      const { controller, caveat } = setup()
      caveat.mockResolvedValue({
        raw: '<bytes>',
        decoded: { when: 'x' },
        dateSurvived: false,
        note: 'JSON does not preserve Date — it became an ISO string',
      })

      await expect(controller.caveat({ codec: 'json' })).resolves.toEqual({
        codec: 'json',
        raw: '<bytes>',
        decoded: { when: 'x' },
        dateSurvived: false,
        note: 'JSON does not preserve Date — it became an ISO string',
      })
      expect(caveat).toHaveBeenCalledWith()
    })

    it('active wraps the service codec name in a { serializer } envelope', () => {
      /*
       * Scenario: report the active codec.
       * Rule it protects: the controller returns `{ serializer: <name> }` from the
       * synchronous `activeSerializer()` call.
       */
      const { controller, activeSerializer } = setup()
      activeSerializer.mockReturnValue('JsonSerializer')

      expect(controller.active()).toEqual({ serializer: 'JsonSerializer' })
      expect(activeSerializer).toHaveBeenCalledWith()
    })
  })

  describe('route metadata', () => {
    const reflector = new Reflector()

    it('mounts the controller under serializer', () => {
      /*
       * Scenario: inspect the @Controller base path.
       * Rule it protects: the base path string is exactly `serializer`.
       */
      expect(reflector.get<string>(PATH_METADATA, SerializerDemoController)).toBe('serializer')
    })

    it('declares the expected method + path for every handler', () => {
      /*
       * Scenario: inspect each route's verb and sub-path.
       * Rule it protects: the POST/GET verbs and the literal sub-paths are pinned
       * so a StringLiteral or method mutant on any route is caught.
       */
      const routes: Array<[keyof SerializerDemoController, RequestMethod, string]> = [
        ['roundtrip', RequestMethod.POST, 'roundtrip'],
        ['caveat', RequestMethod.POST, 'caveat'],
        ['active', RequestMethod.GET, 'active'],
      ]
      for (const [handler, method, path] of routes) {
        const fn = SerializerDemoController.prototype[handler]
        expect(reflector.get<number>(METHOD_METADATA, fn)).toBe(method)
        expect(reflector.get<string>(PATH_METADATA, fn)).toBe(path)
      }
    })
  })
})
