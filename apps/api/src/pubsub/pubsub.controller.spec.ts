/**
 * Unit: PubSubController — thin HTTP binding over PubSubBridgeService.
 *
 * Constructs the controller directly with a hand-mocked bridge and asserts each
 * route delegates with the right arguments and reshapes the bridge result into
 * the documented response envelope (`refs`/`pattern` re-keyed from
 * `refs`/`isPattern`). A second block locks the route table via `Reflector`.
 *
 * @module pubsub/pubsub.controller.spec
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { RequestMethod } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { PubSubController } from './pubsub.controller.js'
import type { PubSubBridgeService } from './pubsub.bridge.service.js'

/** NestJS route-metadata keys (mirror @nestjs/common/constants, which has no NodeNext type subpath). */
const PATH_METADATA = 'path'
const METHOD_METADATA = 'method'

/**
 * Builds the controller with a fully mocked PubSubBridgeService.
 *
 * @returns The controller plus each bridge mock for stubbing and assertions.
 */
function setup() {
  const publish = jest.fn<PubSubBridgeService['publish']>()
  const addSubscription = jest.fn<PubSubBridgeService['addSubscription']>()
  const removeSubscription = jest.fn<PubSubBridgeService['removeSubscription']>()
  const triggerErrorDemo = jest.fn<PubSubBridgeService['triggerErrorDemo']>()

  const bridgeMock: Partial<PubSubBridgeService> = {
    publish,
    addSubscription,
    removeSubscription,
    triggerErrorDemo,
  }

  const controller = new PubSubController(bridgeMock as PubSubBridgeService)
  return { controller, publish, addSubscription, removeSubscription, triggerErrorDemo }
}

describe('PubSubController (unit)', () => {
  describe('delegation', () => {
    it('publish forwards channel + message and returns the subscriber count', async () => {
      /*
       * Scenario: publish a message to a channel.
       * Rule it protects: the controller calls `publish(channel, message)` and
       * echoes the channel with the bridge's subscriber count.
       */
      const { controller, publish } = setup()
      publish.mockResolvedValue(2)

      await expect(
        controller.publish({ channel: 'product-events', message: { a: 1 } }),
      ).resolves.toEqual({ channel: 'product-events', subscribers: 2 })
      expect(publish).toHaveBeenCalledWith('product-events', { a: 1 })
    })

    it('subscribe forwards channel + pattern and re-keys refs/isPattern', async () => {
      /*
       * Scenario: add a pattern subscription.
       * Rule it protects: the controller calls `addSubscription(channel, pattern)`
       * and maps the bridge's `{ refs, isPattern }` to `{ channel, refs, pattern }`.
       */
      const { controller, addSubscription } = setup()
      addSubscription.mockResolvedValue({ refs: 1, isPattern: true })

      await expect(controller.subscribe({ channel: 'product:*', pattern: true })).resolves.toEqual({
        channel: 'product:*',
        refs: 1,
        pattern: true,
      })
      expect(addSubscription).toHaveBeenCalledWith('product:*', true)
    })

    it('unsubscribe forwards only the channel and re-keys refs/isPattern', async () => {
      /*
       * Scenario: remove a subscription.
       * Rule it protects: the controller calls `removeSubscription(channel)` (no
       * pattern arg) and maps `{ refs, isPattern }` to `{ channel, refs, pattern }`.
       */
      const { controller, removeSubscription } = setup()
      removeSubscription.mockResolvedValue({ refs: 0, isPattern: false })

      await expect(
        controller.unsubscribe({ channel: 'product-events', pattern: false }),
      ).resolves.toEqual({ channel: 'product-events', refs: 0, pattern: false })
      expect(removeSubscription).toHaveBeenCalledWith('product-events')
    })

    it('triggerHandlerError delegates and confirms the trigger was sent', async () => {
      /*
       * Scenario: fire the intentional handler-error demo.
       * Rule it protects: the controller awaits `triggerErrorDemo()` and returns
       * `{ triggered: true }`.
       */
      const { controller, triggerErrorDemo } = setup()
      triggerErrorDemo.mockResolvedValue()

      await expect(controller.triggerHandlerError()).resolves.toEqual({ triggered: true })
      expect(triggerErrorDemo).toHaveBeenCalledWith()
    })
  })

  describe('route metadata', () => {
    const reflector = new Reflector()

    it('mounts the controller under pubsub', () => {
      /*
       * Scenario: inspect the @Controller base path.
       * Rule it protects: the base path string is exactly `pubsub`.
       */
      expect(reflector.get<string>(PATH_METADATA, PubSubController)).toBe('pubsub')
    })

    it('declares the expected method + path for every handler', () => {
      /*
       * Scenario: inspect each route's verb and sub-path.
       * Rule it protects: the POST/DELETE verbs and the literal sub-paths are pinned
       * (including the shared `subscribe` path on different verbs) so a StringLiteral
       * or method mutant is caught.
       */
      const routes: Array<[keyof PubSubController, RequestMethod, string]> = [
        ['publish', RequestMethod.POST, 'publish'],
        ['subscribe', RequestMethod.POST, 'subscribe'],
        ['unsubscribe', RequestMethod.DELETE, 'subscribe'],
        ['triggerHandlerError', RequestMethod.POST, 'throw'],
      ]
      for (const [handler, method, path] of routes) {
        const fn = PubSubController.prototype[handler]
        expect(reflector.get<number>(METHOD_METADATA, fn)).toBe(method)
        expect(reflector.get<string>(PATH_METADATA, fn)).toBe(path)
      }
    })
  })
})
