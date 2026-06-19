/**
 * Unit: MetricsController — thin HTTP binding over MetricsService.
 *
 * Constructs the controller directly with a hand-mocked service and asserts the
 * single route returns the in-process snapshot unchanged. A second block locks
 * the route metadata (path + HTTP method) via `Reflector`.
 *
 * @module metrics/metrics.controller.spec
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { RequestMethod } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { MetricsController } from './metrics.controller.js'
import type { MetricsService } from './metrics.service.js'
import type { MetricsSnapshot } from './metrics.types.js'

/** NestJS route-metadata keys (mirror @nestjs/common/constants, which has no NodeNext type subpath). */
const PATH_METADATA = 'path'
const METHOD_METADATA = 'method'

/** A representative snapshot the mocked service returns. */
const SNAPSHOT: MetricsSnapshot = {
  prefixes: { product: { hits: 3, misses: 1, hitRate: 0.75 } },
  totals: { hits: 3, misses: 1, hitRate: 0.75 },
  instantaneousOpsPerSec: 4,
  note: 'app-level, in-process counters',
}

/**
 * Builds the controller with a fully mocked MetricsService.
 *
 * @returns The controller plus the `snapshot` mock for stubbing and assertions.
 */
function setup() {
  const snapshot = jest.fn<MetricsService['snapshot']>()
  const serviceMock: Partial<MetricsService> = { snapshot }
  const controller = new MetricsController(serviceMock as MetricsService)
  return { controller, snapshot }
}

describe('MetricsController (unit)', () => {
  describe('delegation', () => {
    it('returns the service snapshot unchanged', () => {
      /*
       * Scenario: read the in-process metrics.
       * Rule it protects: the controller returns `metrics.snapshot()` verbatim with
       * no transformation of its own.
       */
      const { controller, snapshot } = setup()
      snapshot.mockReturnValue(SNAPSHOT)

      expect(controller.getMetrics()).toBe(SNAPSHOT)
      expect(snapshot).toHaveBeenCalledWith()
    })
  })

  describe('route metadata', () => {
    const reflector = new Reflector()

    it('mounts the controller under metrics', () => {
      /*
       * Scenario: inspect the @Controller base path.
       * Rule it protects: the base path string is exactly `metrics`.
       */
      expect(reflector.get<string>(PATH_METADATA, MetricsController)).toBe('metrics')
    })

    it('declares GET / for the getMetrics handler', () => {
      /*
       * Scenario: inspect the route's verb and sub-path.
       * Rule it protects: the GET verb and the root `/` sub-path are pinned so a
       * StringLiteral or method mutant is caught.
       */
      // Indexed (not dotted) access so the handler is read as data, not an unbound
      // method reference; the `keyof` type keeps the key checked against the class.
      const handler: keyof MetricsController = 'getMetrics'
      const fn = MetricsController.prototype[handler]
      expect(reflector.get<number>(METHOD_METADATA, fn)).toBe(RequestMethod.GET)
      expect(reflector.get<string>(PATH_METADATA, fn)).toBe('/')
    })
  })
})
