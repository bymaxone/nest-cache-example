/**
 * Unit: PubSubBridgeService — ref-counted Pub/Sub subscriptions → gateway.
 *
 * Constructs the bridge with a narrow `FakePubSub` (the real `PubSubService` is
 * assignable to it, so the bridge is a plain supertype→subtype assertion — no
 * `any`/`unknown`) and a mocked `EventsGateway`. Drives every documented branch:
 * the default `onModuleInit` subscriptions (exact + pattern + throwing handler),
 * the forward/forwardPattern bodies (invoked via the captured handlers), the
 * ref-count add (new vs existing), the ref-count remove (unknown / still-referenced
 * / last-listener), `onModuleDestroy` (settles every unsubscribe even on reject),
 * `publish`, and `triggerErrorDemo`.
 *
 * @module pubsub/pubsub.bridge.service.spec
 */
import { jest } from '@jest/globals'
import type {
  IPubSubHandler,
  IPubSubPatternHandler,
  PubSubService,
  Unsubscribe,
} from '@bymax-one/nest-cache'
import type { EventsGateway } from '../events/events.gateway.js'
import { PubSubBridgeService } from './pubsub.bridge.service.js'

/** Channel the bridge wires a throwing handler on (private static in the source). */
const ERROR_DEMO_CHANNEL = 'pubsub-error-demo'

/** Narrow Pub/Sub surface; the real `PubSubService` is assignable to it. */
interface FakePubSub {
  subscribe(channel: string, handler: IPubSubHandler<unknown>): Promise<Unsubscribe>
  psubscribe(pattern: string, handler: IPubSubPatternHandler<unknown>): Promise<Unsubscribe>
  publish(channel: string, message: unknown): Promise<number>
}

/**
 * Builds the bridge with fully controllable Pub/Sub and gateway mocks.
 *
 * @returns The service plus every inner mock for stubbing and assertions.
 */
function setup() {
  const subscribe = jest.fn<FakePubSub['subscribe']>()
  const psubscribe = jest.fn<FakePubSub['psubscribe']>()
  const publish = jest.fn<FakePubSub['publish']>()
  const pubsubMock: FakePubSub = { subscribe, psubscribe, publish }

  const emitMessage = jest.fn<EventsGateway['emitMessage']>()
  const gatewayMock: Partial<EventsGateway> = { emitMessage }

  const service = new PubSubBridgeService(pubsubMock as PubSubService, gatewayMock as EventsGateway)
  return { service, subscribe, psubscribe, publish, emitMessage }
}

/** A resolved no-op `Unsubscribe` double, distinct per call for identity assertions. */
function makeUnsub(): jest.Mock<Unsubscribe> {
  return jest.fn<Unsubscribe>(() => Promise.resolve())
}

describe('PubSubBridgeService (unit)', () => {
  describe('onModuleInit', () => {
    it('wires the three default subscriptions (exact + pattern + error-demo)', async () => {
      /*
       * Scenario: module bootstrap.
       * Rule it protects: init opens an exact-channel subscribe (`product-events`),
       * a pattern psubscribe (`product:*`), and a throwing-handler subscribe on the
       * error-demo channel — the fan-out / pattern / error-isolation demos.
       */
      const { service, subscribe, psubscribe } = setup()
      subscribe.mockResolvedValueOnce(makeUnsub()).mockResolvedValueOnce(makeUnsub())
      psubscribe.mockResolvedValueOnce(makeUnsub())

      await service.onModuleInit()

      expect(subscribe).toHaveBeenNthCalledWith(1, 'product-events', expect.any(Function))
      expect(psubscribe).toHaveBeenCalledWith('product:*', expect.any(Function))
      expect(subscribe).toHaveBeenNthCalledWith(2, ERROR_DEMO_CHANNEL, expect.any(Function))
    })

    it('forwards exact-channel messages to the gateway verbatim', async () => {
      /*
       * Scenario: a message lands on the exact-channel subscription.
       * Rule it protects: the `forward` handler re-broadcasts the namespaced channel
       * and message to every tab via emitMessage (no transformation).
       */
      const { service, subscribe, psubscribe, emitMessage } = setup()
      subscribe.mockResolvedValue(makeUnsub())
      psubscribe.mockResolvedValue(makeUnsub())
      await service.onModuleInit()

      const firstSubscribe = subscribe.mock.calls[0]
      if (!firstSubscribe) throw new Error('expected subscribe() to have been called')
      const forward = firstSubscribe[1]
      // The handler's return type is `void | Promise<void>`; the bridge impl is
      // synchronous, so the call is fire-and-forget here.
      void forward({ id: 7 }, 'cache-example:product-events')

      expect(emitMessage).toHaveBeenCalledWith('cache-example:product-events', { id: 7 })
    })

    it('forwards pattern messages with the resolved concrete channel', async () => {
      /*
       * Scenario: a message matches the pattern subscription.
       * Rule it protects: the `forwardPattern` handler forwards the RESOLVED channel
       * (not the glob) and message; the trailing `pattern` arg is intentionally dropped.
       */
      const { service, subscribe, psubscribe, emitMessage } = setup()
      subscribe.mockResolvedValue(makeUnsub())
      psubscribe.mockResolvedValue(makeUnsub())
      await service.onModuleInit()

      const firstPsubscribe = psubscribe.mock.calls[0]
      if (!firstPsubscribe) throw new Error('expected psubscribe() to have been called')
      const forwardPattern = firstPsubscribe[1]
      // Fire-and-forget: the pattern handler also returns `void | Promise<void>`.
      void forwardPattern({ id: 42 }, 'cache-example:product:42', 'cache-example:product:*')

      expect(emitMessage).toHaveBeenCalledWith('cache-example:product:42', { id: 42 })
    })

    it('stores each default subscription under its own channel key with the right pattern flag', async () => {
      /*
       * Scenario: after bootstrap, re-add each default channel.
       * Rule it protects: each `subs.set` keyed the entry by its exact channel string
       * with the correct `isPattern` flag. Re-adding a known channel must find the
       * stored entry (refs 1 → 2) and echo its stored `isPattern` — a blanked key would
       * miss the entry (refs back to 1) and a flipped flag would echo the wrong kind.
       */
      const { service, subscribe, psubscribe } = setup()
      subscribe.mockResolvedValue(makeUnsub())
      psubscribe.mockResolvedValue(makeUnsub())
      await service.onModuleInit()

      await expect(service.addSubscription('product-events', false)).resolves.toEqual({
        refs: 2,
        isPattern: false,
      })
      await expect(service.addSubscription('product:*', true)).resolves.toEqual({
        refs: 2,
        isPattern: true,
      })
      await expect(service.addSubscription(ERROR_DEMO_CHANNEL, false)).resolves.toEqual({
        refs: 2,
        isPattern: false,
      })
    })

    it('registers a handler whose throw is the error-isolation demo', async () => {
      /*
       * Scenario: invoke the error-demo channel's registered handler.
       * Rule it protects: that handler throws by design — the library swallows it and
       * surfaces a `handler_error`; the demo proves a throwing handler never tears
       * down the shared subscriber.
       */
      const { service, subscribe, psubscribe } = setup()
      subscribe.mockResolvedValue(makeUnsub())
      psubscribe.mockResolvedValue(makeUnsub())
      await service.onModuleInit()

      const secondSubscribe = subscribe.mock.calls[1]
      if (!secondSubscribe) throw new Error('expected a second subscribe() call')
      const throwingHandler = secondSubscribe[1]
      expect(() => throwingHandler({ at: 'now' }, ERROR_DEMO_CHANNEL)).toThrow(
        'intentional handler failure (error-isolation demo)',
      )
    })
  })

  describe('onModuleDestroy', () => {
    it('settles every stored unsubscribe and clears the registry', async () => {
      /*
       * Scenario: module shutdown after the default subscriptions are wired.
       * Rule it protects: destroy calls every stored Unsubscribe (via allSettled, so a
       * single rejection never aborts the rest) and clears the map; a second destroy
       * is then a no-op because the registry is empty.
       */
      const { service, subscribe, psubscribe } = setup()
      const exactUnsub = makeUnsub()
      const errorUnsub = makeUnsub()
      const patternUnsub = jest.fn<Unsubscribe>(() => Promise.reject(new Error('drop')))
      subscribe.mockResolvedValueOnce(exactUnsub).mockResolvedValueOnce(errorUnsub)
      psubscribe.mockResolvedValueOnce(patternUnsub)
      await service.onModuleInit()

      await service.onModuleDestroy()

      expect(exactUnsub).toHaveBeenCalledTimes(1)
      expect(patternUnsub).toHaveBeenCalledTimes(1)
      expect(errorUnsub).toHaveBeenCalledTimes(1)

      await service.onModuleDestroy()
      expect(exactUnsub).toHaveBeenCalledTimes(1)
    })
  })

  describe('publish', () => {
    it('delegates to the library and returns the subscriber count', async () => {
      /*
       * Scenario: publish a message to a bare channel.
       * Rule it protects: publish forwards the (un-prefixed) channel and payload to the
       * library and returns its subscriber count unchanged.
       */
      const { service, publish } = setup()
      publish.mockResolvedValue(3)

      await expect(service.publish('product-events', { id: 1 })).resolves.toBe(3)
      expect(publish).toHaveBeenCalledWith('product-events', { id: 1 })
    })
  })

  describe('addSubscription', () => {
    it('opens an exact-channel subscription on first use', async () => {
      /*
       * Scenario: subscribe to a brand-new exact channel.
       * Rule it protects: the unknown-channel arm calls `subscribe` (not psubscribe),
       * stores it at refs 1, and reports `isPattern: false`.
       */
      const { service, subscribe, psubscribe } = setup()
      subscribe.mockResolvedValue(makeUnsub())

      await expect(service.addSubscription('news', false)).resolves.toEqual({
        refs: 1,
        isPattern: false,
      })
      expect(subscribe).toHaveBeenCalledWith('news', expect.any(Function))
      expect(psubscribe).not.toHaveBeenCalled()
    })

    it('opens a pattern subscription on first use', async () => {
      /*
       * Scenario: subscribe to a brand-new glob pattern.
       * Rule it protects: with `pattern: true` the unknown-channel arm calls
       * `psubscribe`, stores it at refs 1, and reports `isPattern: true`.
       */
      const { service, subscribe, psubscribe } = setup()
      psubscribe.mockResolvedValue(makeUnsub())

      await expect(service.addSubscription('orders:*', true)).resolves.toEqual({
        refs: 1,
        isPattern: true,
      })
      expect(psubscribe).toHaveBeenCalledWith('orders:*', expect.any(Function))
      expect(subscribe).not.toHaveBeenCalled()
    })

    it('increments the ref count without re-subscribing for a known channel', async () => {
      /*
       * Scenario: subscribe twice to the same channel.
       * Rule it protects: the existing-channel arm bumps the ref count (1 → 2) and
       * reports the stored `isPattern`, WITHOUT opening a 2nd Redis subscription.
       */
      const { service, subscribe } = setup()
      subscribe.mockResolvedValue(makeUnsub())
      await service.addSubscription('news', false)

      await expect(service.addSubscription('news', false)).resolves.toEqual({
        refs: 2,
        isPattern: false,
      })
      expect(subscribe).toHaveBeenCalledTimes(1)
    })
  })

  describe('removeSubscription', () => {
    it('is a safe no-op for an unknown channel', async () => {
      /*
       * Scenario: delete a channel that was never subscribed.
       * Rule it protects: the unknown-channel arm returns `{ refs: 0, isPattern: false }`
       * without throwing — double-unsubscribe is idempotent.
       */
      const { service } = setup()

      await expect(service.removeSubscription('ghost')).resolves.toEqual({
        refs: 0,
        isPattern: false,
      })
    })

    it('keeps delivery alive when other listeners remain', async () => {
      /*
       * Scenario: one of two listeners unsubscribes.
       * Rule it protects: a decrement that leaves refs > 0 returns the remaining count
       * and does NOT fire Unsubscribe — the channel stays live for the other listener.
       */
      const { service, subscribe } = setup()
      const unsub = makeUnsub()
      subscribe.mockResolvedValue(unsub)
      await service.addSubscription('news', false)
      await service.addSubscription('news', false)

      await expect(service.removeSubscription('news')).resolves.toEqual({
        refs: 1,
        isPattern: false,
      })
      expect(unsub).not.toHaveBeenCalled()
    })

    it('fires Unsubscribe and removes the entry for the last listener', async () => {
      /*
       * Scenario: the final listener unsubscribes.
       * Rule it protects: a decrement that reaches 0 calls the stored Unsubscribe (Redis
       * UNSUBSCRIBE), deletes the entry, and reports the stored `isPattern`.
       */
      const { service, psubscribe } = setup()
      const unsub = makeUnsub()
      psubscribe.mockResolvedValue(unsub)
      await service.addSubscription('orders:*', true)

      await expect(service.removeSubscription('orders:*')).resolves.toEqual({
        refs: 0,
        isPattern: true,
      })
      expect(unsub).toHaveBeenCalledTimes(1)
      // The entry is gone: a follow-up remove is the unknown-channel no-op.
      await expect(service.removeSubscription('orders:*')).resolves.toEqual({
        refs: 0,
        isPattern: false,
      })
    })
  })

  describe('triggerErrorDemo', () => {
    it('publishes a timestamped payload to the error-demo channel', async () => {
      /*
       * Scenario: trigger the handler-error isolation demo.
       * Rule it protects: triggerErrorDemo publishes an `{ at }` payload to the
       * error-demo channel, which fires the throwing handler the library swallows.
       */
      const { service, publish } = setup()
      publish.mockResolvedValue(1)

      await service.triggerErrorDemo()

      expect(publish).toHaveBeenCalledWith(ERROR_DEMO_CHANNEL, { at: expect.any(String) })
    })
  })
})
