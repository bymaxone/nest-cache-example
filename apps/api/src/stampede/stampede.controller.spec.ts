/**
 * Unit: StampedeController — thin HTTP binding over StampedeService.
 *
 * Constructs the controller directly with a hand-mocked service and asserts the
 * single route forwards the validated burst query and returns the timeline
 * result unchanged. A second block locks the route table via `Reflector`.
 *
 * @module stampede/stampede.controller.spec
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { RequestMethod } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { StampedeController } from './stampede.controller.js'
import type { StampedeService } from './stampede.service.js'
import type { StampedeQuery } from './dto/stampede-query.dto.js'
import type { StampedeResult } from './stampede.types.js'

/** NestJS route-metadata keys (mirror @nestjs/common/constants, which has no NodeNext type subpath). */
const PATH_METADATA = 'path'
const METHOD_METADATA = 'method'

/** A representative burst result the mocked service resolves. */
const RESULT: StampedeResult = {
  productId: 'p1',
  timeline: [],
  summary: { concurrency: 10, originFetches: 1, cacheHits: 9, hitRate: 0.9 },
  script: { name: 'acquireLock', sha: 'abc123' },
}

/**
 * Builds the controller with a fully mocked StampedeService.
 *
 * @returns The controller plus the `run` mock for stubbing and assertions.
 */
function setup() {
  const run = jest.fn<StampedeService['run']>()
  const serviceMock: Partial<StampedeService> = { run }
  const controller = new StampedeController(serviceMock as StampedeService)
  return { controller, run }
}

describe('StampedeController (unit)', () => {
  describe('delegation', () => {
    it('forwards the validated query to run and returns the result', async () => {
      /*
       * Scenario: fire a single-flight burst.
       * Rule it protects: the controller passes the whole validated `query` to
       * `service.run` and returns its `StampedeResult` verbatim.
       */
      const { controller, run } = setup()
      const query: StampedeQuery = { productId: 'p1', concurrency: 10, lockMs: 2000 }
      run.mockResolvedValue(RESULT)

      await expect(controller.fire(query)).resolves.toBe(RESULT)
      expect(run).toHaveBeenCalledWith(query)
    })
  })

  describe('route metadata', () => {
    const reflector = new Reflector()

    it('mounts the controller under stampede', () => {
      /*
       * Scenario: inspect the @Controller base path.
       * Rule it protects: the base path string is exactly `stampede`.
       */
      expect(reflector.get<string>(PATH_METADATA, StampedeController)).toBe('stampede')
    })

    it('declares POST / for the fire handler', () => {
      /*
       * Scenario: inspect the single route's verb and sub-path.
       * Rule it protects: the POST verb and the root `/` sub-path are pinned so a
       * StringLiteral or method mutant is caught.
       */
      // Indexed (not dotted) access so the handler is read as data, not an unbound
      // method reference; the `keyof` type keeps the key checked against the class.
      const handler: keyof StampedeController = 'fire'
      const fn = StampedeController.prototype[handler]
      expect(reflector.get<number>(METHOD_METADATA, fn)).toBe(RequestMethod.POST)
      expect(reflector.get<string>(PATH_METADATA, fn)).toBe('/')
    })
  })
})
