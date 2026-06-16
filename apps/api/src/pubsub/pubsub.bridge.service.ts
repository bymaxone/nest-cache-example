/**
 * Pub/Sub bridge service — forwards library messages to the WebSocket gateway
 * and manages per-channel ref-counted subscriptions.
 *
 * Layer: pubsub. Injects the global `PubSubService` (provided by `BymaxCacheModule`)
 * and `EventsGateway` (exported by `EventsModule`). Demonstrates:
 *   - Exact-channel subscribe (product-events)
 *   - Pattern subscribe via psubscribe (product:*)
 *   - Ref-counted Unsubscribe lifecycle (subscribe×2 + unsub×1 keeps delivery)
 *   - Handler-error isolation: a throwing handler is swallowed by the library
 *     and forwarded to events.onEvent as reason: 'handler_error' (spec §17.1)
 */
import { Injectable } from '@nestjs/common'
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import {
  PubSubService,
  type IPubSubHandler,
  type IPubSubPatternHandler,
  type Unsubscribe,
} from '@bymax-one/nest-cache'
import { EventsGateway } from '../events/events.gateway.js'

interface SubEntry {
  unsubscribe: Unsubscribe
  refs: number
  /** Whether this entry was created via psubscribe (true) or subscribe (false). */
  isPattern: boolean
}

/**
 * Bridges library Pub/Sub messages to all connected WebSocket clients, and
 * exposes ref-counted subscribe/unsubscribe lifecycle methods for the controller.
 */
@Injectable()
export class PubSubBridgeService implements OnModuleInit, OnModuleDestroy {
  /** Channel used to demonstrate handler-error isolation (spec §17.1). */
  private static readonly ERROR_DEMO_CHANNEL = 'pubsub-error-demo'

  /** Per-channel (or per-pattern) ref count and stored Unsubscribe. */
  private readonly subs = new Map<string, SubEntry>()

  constructor(
    private readonly pubsub: PubSubService,
    private readonly gateway: EventsGateway,
  ) {}

  /**
   * Handler for exactly-named channel subscriptions.
   * IPubSubHandler<T> = (message: T, channel: string) => void | Promise<void>.
   * The library passes the NAMESPACED channel string (e.g. 'cache-example:product-events');
   * re-broadcast as-is to every connected tab.
   */
  private readonly forward: IPubSubHandler<unknown> = (message, channel) => {
    this.gateway.emitMessage(channel, message)
  }

  /**
   * Handler for pattern subscriptions.
   * IPubSubPatternHandler<T> = (message: T, channel: string, pattern: string) => void | Promise<void>.
   * The library passes the NAMESPACED concrete channel (e.g. 'cache-example:product:42');
   * re-broadcast to every tab. The pattern arg is not forwarded — the frontend receives
   * the resolved channel instead. TypeScript allows omitting trailing params when the handler
   * is only interested in a prefix of the signature.
   */
  private readonly forwardPattern: IPubSubPatternHandler<unknown> = (message, channel) => {
    this.gateway.emitMessage(channel, message)
  }

  /**
   * Bootstraps the default demo subscriptions:
   *  - 'product-events' — exact-channel subscribe (fan-out demo, spec §17.2)
   *  - 'product:*'      — pattern subscribe (pattern-match demo, matrix #31)
   *  - 'pubsub-error-demo' — throwing handler to prove handler-error isolation (spec §17.1)
   *
   * Each returned Unsubscribe is stored keyed by channel so onModuleDestroy
   * and addSubscription/removeSubscription share a single source of truth.
   */
  async onModuleInit(): Promise<void> {
    // Exact-channel subscription: gateway fans every message out to all tabs (spec §17.2).
    // The library namespaces the channel: 'product-events' → 'cache-example:product-events'.
    const exactUnsub = await this.pubsub.subscribe<unknown>('product-events', this.forward)
    this.subs.set('product-events', { unsubscribe: exactUnsub, refs: 1, isPattern: false })

    // Pattern subscription: matches e.g. 'product:42'. Pattern namespaced by library (spec §17.1).
    const patternUnsub = await this.pubsub.psubscribe<unknown>('product:*', this.forwardPattern)
    this.subs.set('product:*', { unsubscribe: patternUnsub, refs: 1, isPattern: true })

    // The library SWALLOWS a handler throw — it must NOT tear down the shared subscriber —
    // and forwards it to events.onEvent as an `error` with reason: 'handler_error' (spec §17.1).
    const errUnsub = await this.pubsub.subscribe<unknown>(
      PubSubBridgeService.ERROR_DEMO_CHANNEL,
      () => {
        throw new Error('intentional handler failure (error-isolation demo)')
      },
    )
    this.subs.set(PubSubBridgeService.ERROR_DEMO_CHANNEL, {
      unsubscribe: errUnsub,
      refs: 1,
      isPattern: false,
    })
  }

  /** Tears down every active subscription on module shutdown. All entries are attempted even if one rejects. */
  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([...this.subs.values()].map((e) => e.unsubscribe()))
    this.subs.clear()
  }

  /**
   * Publishes a message to a (library-namespaced) channel; returns the subscriber count.
   *
   * The library namespaces the channel: 'product-events' → 'cache-example:product-events'
   * (spec §17.1). We pass the bare channel; the namespace is applied transparently.
   *
   * @param channel - Bare channel name (not prefixed by hand).
   * @param message - Arbitrary payload, serialized by the library.
   * @returns The number of subscribers that received the message.
   * @throws {CacheException} SERIALIZATION_FAILED when the message cannot be encoded.
   */
  async publish<T>(channel: string, message: T): Promise<number> {
    return this.pubsub.publish<T>(channel, message)
  }

  /**
   * Adds a subscription (or increments its ref count when one already exists).
   *
   * Demonstrates the library's ref-counted Unsubscribe: subscribing to the same
   * channel twice does NOT open a 2nd Redis subscription — it increments the ref count.
   * The underlying SUBSCRIBE / PSUBSCRIBE fires only on the first caller (spec §17.2).
   *
   * @param channel - Bare channel name or glob pattern.
   * @param pattern - When true, uses psubscribe instead of subscribe.
   * @returns The updated ref count and the actual subscription kind (isPattern).
   * @throws {CacheException} When the library's subscribe or psubscribe call fails (e.g. connection error).
   */
  async addSubscription(
    channel: string,
    pattern: boolean,
  ): Promise<{ refs: number; isPattern: boolean }> {
    const existing = this.subs.get(channel)
    if (existing) {
      // ref-counted: a 2nd subscribe does NOT open a 2nd Redis subscription
      existing.refs += 1
      return { refs: existing.refs, isPattern: existing.isPattern }
    }
    const unsubscribe = pattern
      ? await this.pubsub.psubscribe<unknown>(channel, this.forwardPattern)
      : await this.pubsub.subscribe<unknown>(channel, this.forward)
    this.subs.set(channel, { unsubscribe, refs: 1, isPattern: pattern })
    return { refs: 1, isPattern: pattern }
  }

  /**
   * Decrements the ref count for a channel and calls Unsubscribe only when the
   * count reaches zero.
   *
   * A DELETE on an unknown (or already-removed) channel is a safe no-op: the
   * library's Unsubscribe is idempotent, and double-unsubscribe never throws.
   *
   * @param channel - Bare channel name or glob pattern.
   * @returns The remaining ref count and the actual subscription kind (isPattern). When the channel
   *   was unknown, `isPattern` defaults to false.
   * @throws {CacheException} When the underlying unsubscribe call fails (e.g. connection error).
   */
  async removeSubscription(channel: string): Promise<{ refs: number; isPattern: boolean }> {
    const existing = this.subs.get(channel)
    if (!existing) return { refs: 0, isPattern: false } // double-unsubscribe / unknown channel is safe (idempotent)
    existing.refs -= 1
    if (existing.refs > 0) return { refs: existing.refs, isPattern: existing.isPattern } // still other listeners → keep delivery alive
    await existing.unsubscribe() // last listener → library fires Redis UNSUBSCRIBE
    this.subs.delete(channel)
    return { refs: 0, isPattern: existing.isPattern }
  }

  /**
   * Publishes to the error-demo channel to trigger the registered throwing handler.
   *
   * The library swallows the throw and forwards it to events.onEvent as an 'error'
   * with reason: 'handler_error'. Delivery on other channels is unaffected (spec §17.1).
   *
   * @throws {CacheException} SERIALIZATION_FAILED when the payload cannot be encoded.
   */
  async triggerErrorDemo(): Promise<void> {
    await this.publish(PubSubBridgeService.ERROR_DEMO_CHANNEL, { at: new Date().toISOString() })
  }
}
