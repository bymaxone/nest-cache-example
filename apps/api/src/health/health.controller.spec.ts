/**
 * Unit: HealthController — probe-safe liveness surface over CacheService.
 *
 * Constructs the controller directly with a hand-mocked `CacheService` and covers
 * all three outcomes: healthy (`isHealthy` true), degraded-but-reachable
 * (`isHealthy` false), and the try/catch fallback when a probe throws — proving
 * the endpoint never surfaces a 500. A second block locks the route metadata.
 *
 * @module health/health.controller.spec
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { RequestMethod } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { CacheService } from '@bymax-one/nest-cache'
import { HealthController } from './health.controller.js'

/** NestJS route-metadata keys (mirror @nestjs/common/constants, which has no NodeNext type subpath). */
const PATH_METADATA = 'path'
const METHOD_METADATA = 'method'

/**
 * Builds the controller with controllable `isHealthy` / `ping` mocks.
 *
 * @returns The controller plus both probe mocks for stubbing and assertions.
 */
function setup() {
  const isHealthy = jest.fn<CacheService['isHealthy']>()
  const ping = jest.fn<CacheService['ping']>()
  const cacheMock: Partial<CacheService> = { isHealthy, ping }
  const controller = new HealthController(cacheMock as CacheService)
  return { controller, isHealthy, ping }
}

describe('HealthController (unit)', () => {
  describe('health', () => {
    it('returns ok when the connection is healthy and the ping succeeds', async () => {
      /*
       * Scenario: Redis is reachable and reports healthy.
       * Rule it protects: the `isHealthy ? 'ok' : 'degraded'` ternary takes the
       * true arm after a successful `ping`, with a non-negative latency.
       */
      const { controller, isHealthy, ping } = setup()
      isHealthy.mockResolvedValue(true)
      ping.mockResolvedValue('PONG')

      const result = await controller.health()
      expect(result.status).toBe('ok')
      expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    })

    it('returns degraded when the connection reports unhealthy', async () => {
      /*
       * Scenario: the ping succeeds but `isHealthy` is false.
       * Rule it protects: the ternary takes the false arm so a load balancer can
       * drain the instance, while the endpoint still resolves 200.
       */
      const { controller, isHealthy, ping } = setup()
      isHealthy.mockResolvedValue(false)
      ping.mockResolvedValue('PONG')

      await expect(controller.health()).resolves.toMatchObject({ status: 'degraded' })
    })

    it('returns degraded without throwing when a probe rejects', async () => {
      /*
       * Scenario: `isHealthy` throws (Redis unreachable).
       * Rule it protects: the try/catch swallows the error and returns a degraded
       * status with a latency reading — the probe is never a 500.
       */
      const { controller, isHealthy } = setup()
      isHealthy.mockRejectedValue(new Error('redis down'))

      const result = await controller.health()
      expect(result.status).toBe('degraded')
      expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    })
  })

  describe('route metadata', () => {
    const reflector = new Reflector()

    it('mounts the controller at the root path', () => {
      /*
       * Scenario: inspect the empty @Controller base path.
       * Rule it protects: an argument-less @Controller resolves to the `/` base.
       */
      expect(reflector.get<string>(PATH_METADATA, HealthController)).toBe('/')
    })

    it('declares GET health for the health handler', () => {
      /*
       * Scenario: inspect the route's verb and sub-path.
       * Rule it protects: the GET verb and the literal `health` sub-path are pinned
       * so a StringLiteral or method mutant is caught.
       */
      // Indexed (not dotted) access so the handler is read as data, not an unbound
      // method reference; the `keyof` type keeps the key checked against the class.
      const handler: keyof HealthController = 'health'
      const fn = HealthController.prototype[handler]
      expect(reflector.get<number>(METHOD_METADATA, fn)).toBe(RequestMethod.GET)
      expect(reflector.get<string>(PATH_METADATA, fn)).toBe('health')
    })
  })
})
