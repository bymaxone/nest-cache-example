/**
 * TTL keyspace-notification subscriber — the library's documented escape hatch.
 *
 * Layer: ttl-events. Streams real Redis key-expiry events to the browser by
 * opening a DEDICATED raw subscriber through the library's
 * {@link ConnectionManager} (via the `BYMAX_CACHE_CONNECTION` token), subscribing
 * to Redis' fixed keyspace channel `__keyevent@<db>__:expired`, filtering by the
 * app namespace prefix, and forwarding survivors to the {@link EventsGateway}.
 *
 * ## Why the raw subscriber and not `PubSubService`
 *
 * `PubSubService.subscribe(channel)` NAMESPACES every channel it touches, so
 * `subscribe('__keyevent@0__:expired')` would actually listen on
 * `cache-example:__keyevent@0__:expired` — a channel Redis NEVER publishes to,
 * so the handler would silently never fire. Redis keyspace-notification channels
 * are fixed and live OUTSIDE any app namespace; the only correct way to receive
 * them is a dedicated, un-namespaced subscriber. That is exactly what
 * {@link ConnectionManager.createSubscriberClient} provides (spec §4 / §17.3).
 *
 * Ownership of that connection transfers to this service: it registers the
 * subscriber's `error` listener and quits it on shutdown
 * ({@link TtlEventsService.onModuleDestroy}). Keyspace notifications also need a
 * subscription per shard, so the feed is disabled in cluster mode (the demo
 * treats cluster fan-out as out of scope).
 *
 * Requires `notify-keyspace-events Ex` in `redis.conf` (delivered with the dev
 * infra); without it Redis emits no expiry events and nothing fires.
 */
import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'node:crypto'
import {
  BYMAX_CACHE_CONNECTION,
  BYMAX_CACHE_KEY_BUILDER,
  CacheService,
  type ConnectionManager,
  type KeyBuilder,
} from '@bymax-one/nest-cache'
import type { Redis } from 'ioredis'
import { EventsGateway } from '../events/events.gateway.js'
import { CACHE_PREFIX } from '../common/cache-keys.js'
import type { Env } from '../config/env.schema.js'

/** Marker payload stored under a seeded TTL key — content is irrelevant; it only expires. */
interface TtlDemoValue {
  id: string
  kind: 'ttl-demo'
}

/**
 * Bridges Redis key-expiry notifications to the WebSocket gateway and exposes a
 * short-TTL seed helper for the dashboard demo.
 *
 * The subscriber is the only place the example reaches under the library facade —
 * deliberately, because keyspace channels are fixed and un-namespaced (see the
 * class-level rationale above).
 */
@Injectable()
export class TtlEventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TtlEventsService.name)

  /** Dedicated subscriber connection; owned by this service and quit on destroy. */
  private sub?: Redis | undefined

  /** Demo-only entity prefix — keeps throwaway TTL keys off the real `product` surface. */
  private readonly prefix = CACHE_PREFIX.ttl

  constructor(
    @Inject(BYMAX_CACHE_CONNECTION) private readonly connection: ConnectionManager,
    @Inject(BYMAX_CACHE_KEY_BUILDER) private readonly keys: KeyBuilder,
    private readonly cache: CacheService,
    private readonly gateway: EventsGateway,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Opens the dedicated subscriber and wires the keyspace-expiry listener.
   *
   * Subscribes to the fixed `__keyevent@<db>__:expired` channel (db from
   * `REDIS_DB`) and forwards only expiries inside this app's namespace prefix —
   * foreign-namespace keys are dropped so the demo feed stays scoped. No-ops in
   * cluster mode, where a single-channel subscribe cannot cover every shard.
   *
   * @returns Resolves once the subscription is active (or immediately in cluster mode).
   */
  async onModuleInit(): Promise<void> {
    const mode = this.config.get('CACHE_MODE', { infer: true })
    if (mode === 'cluster') {
      // Keyspace notifications require a subscription per shard; a single-channel
      // subscribe cannot cover a cluster, so the TTL feed is disabled there.
      this.logger.warn('Keyspace notifications are unsupported in cluster mode; TTL feed disabled.')
      return
    }

    const db = this.config.get('REDIS_DB', { infer: true })
    // createSubscriberClient() returns a FRESH, DEDICATED connection whose
    // ownership transfers to us (spec §4/§17.3); we quit() it in onModuleDestroy.
    // The `as Redis` narrowing is safe here — cluster mode already returned above.
    this.sub = this.connection.createSubscriberClient() as Redis
    // The raw subscriber is ours to manage: register an `error` listener so a
    // Redis drop surfaces as a log line instead of an uncaught EventEmitter
    // 'error' (the library only manages errors on its OWN clients).
    this.sub.on('error', (err: Error) => {
      this.logger.error('TTL subscriber connection error', err.stack ?? err.message)
    })
    await this.sub.subscribe(`__keyevent@${db}__:expired`)
    const nsPrefix = this.keys.getNamespacePrefix() // e.g. 'cache-example:'
    this.sub.on('message', (_channel, key: string) => {
      // Forward only expiries inside our namespace; foreign-ns keys are ignored.
      if (!key.startsWith(nsPrefix)) return
      try {
        this.gateway.emitExpired(key)
      } catch (err) {
        this.logger.error(
          `Failed to forward expiry for ${key}`,
          err instanceof Error ? err.stack : String(err),
        )
      }
    })
  }

  /**
   * Quits the dedicated subscriber connection on shutdown.
   *
   * `createSubscriberClient()` transferred ownership to this service (spec
   * §4/§17.3), so closing it here is mandatory — `app.enableShutdownHooks()`
   * invokes this on SIGINT/SIGTERM and the process then exits without a dangling
   * Redis socket. `quit()` (graceful drain) is preferred over `disconnect()`
   * (abrupt), but it can reject if the connection already dropped; the rejection
   * is caught and logged so a teardown error never interrupts Nest's shutdown
   * sequence (mirroring the defensive teardown in `PubSubBridgeService`). The
   * field is cleared first, so a partial-init or double-invoke is a safe no-op.
   *
   * @returns Resolves once the connection is closed (or immediately if unset).
   */
  async onModuleDestroy(): Promise<void> {
    const sub = this.sub
    this.sub = undefined
    if (!sub) return
    try {
      await sub.quit()
    } catch (err) {
      this.logger.warn(
        `TTL subscriber quit() failed during shutdown: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  /**
   * Seeds a namespaced key with a short TTL so the dashboard can watch it expire.
   *
   * Reuses the catalog write path (`CacheService.set`) so the key is namespaced and
   * serialized exactly like every other cached value — no bespoke key building or
   * serialization. Writes under a demo-only prefix so it never collides with real
   * catalog data. The short TTL lets the countdown ring drain and the
   * `cache:expired` event arrive within the demo window.
   *
   * @param ttlSeconds - Expiry in seconds (caller-validated to a small range).
   * @param id - Optional explicit id (caller-validated charset); a UUID is generated when omitted.
   * @returns The resolved namespaced key and the applied `ttlSeconds`.
   */
  async seed(ttlSeconds: number, id?: string): Promise<{ key: string; ttlSeconds: number }> {
    const resolvedId = id ?? randomUUID()
    const value: TtlDemoValue = { id: resolvedId, kind: 'ttl-demo' }
    await this.cache.set<TtlDemoValue>(this.prefix, resolvedId, value, ttlSeconds)
    return { key: this.keys.build(this.prefix, resolvedId), ttlSeconds }
  }
}
