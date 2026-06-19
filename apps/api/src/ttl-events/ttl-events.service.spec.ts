/**
 * Unit: TtlEventsService — raw keyspace-expiry subscriber → gateway.
 *
 * Constructs the service directly with a narrow `FakeSubscriber` (the real
 * ioredis `Redis` is assignable to it, so the bridge is a plain supertype→subtype
 * assertion — no `any`/`unknown`), a mocked `ConnectionManager`/`KeyBuilder`/
 * `CacheService`/`EventsGateway`, and a real `ConfigService` seeded per scenario.
 *
 * Drives every documented branch: the cluster-mode early return (no subscriber
 * wired), the standalone wiring (subscribe + error/message listeners), the
 * namespace-prefix filter (in-namespace key forwarded vs foreign key dropped), the
 * message-forward catch (Error vs non-Error), the connection `error` listener
 * (`err.stack` vs `err.message`), `onModuleDestroy` (unset no-op / graceful quit /
 * quit-rejects catch for Error and non-Error), and `seed` (explicit id vs UUID).
 *
 * @module ttl-events/ttl-events.service.spec
 */
import { jest } from '@jest/globals'
import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Redis } from 'ioredis'
import type { CacheService, ConnectionManager, KeyBuilder } from '@bymax-one/nest-cache'
import type { Env } from '../config/env.schema.js'
import type { EventsGateway } from '../events/events.gateway.js'
import { TtlEventsService } from './ttl-events.service.js'

/** The namespace prefix the mocked KeyBuilder reports throughout. */
const NS = 'cache-example:'

/** Narrow raw-subscriber surface; the real `Redis` is assignable to it. */
interface FakeSubscriber {
  on(event: string, listener: (...args: unknown[]) => void): unknown
  subscribe(channel: string): Promise<unknown>
  quit(): Promise<'OK'>
}

/**
 * Builds the service with controllable connection/keys/cache/gateway/config mocks
 * and silenced Logger spies.
 *
 * @param config - The validated env the real ConfigService should resolve.
 * @returns The service plus every inner mock for stubbing and assertions.
 */
function setup(config: Partial<Env>) {
  const on = jest.fn<(event: string, listener: (...args: unknown[]) => void) => unknown>()
  const subscribe = jest.fn<(channel: string) => Promise<unknown>>(() => Promise.resolve())
  const quit = jest.fn<() => Promise<'OK'>>(() => Promise.resolve('OK'))
  const fakeSub: FakeSubscriber = { on, subscribe, quit }

  const createSubscriberClient = jest.fn<() => Redis>(() => fakeSub as Redis)
  const connectionMock: Partial<ConnectionManager> = { createSubscriberClient }

  const getNamespacePrefix = jest.fn<() => string>(() => NS)
  const build = jest.fn<(prefix: string, id: string) => string>((p, id) => `${NS}${p}:${id}`)
  const keyBuilderMock: Partial<KeyBuilder> = { getNamespacePrefix, build }

  const set = jest.fn<CacheService['set']>(() => Promise.resolve())
  const cacheMock: Partial<CacheService> = { set }

  const emitExpired = jest.fn<EventsGateway['emitExpired']>()
  const gatewayMock: Partial<EventsGateway> = { emitExpired }

  const configService = new ConfigService<Env, true>(config)

  const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
  const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)

  const service = new TtlEventsService(
    connectionMock as ConnectionManager,
    keyBuilderMock as KeyBuilder,
    cacheMock as CacheService,
    gatewayMock as EventsGateway,
    configService,
  )

  return {
    service,
    createSubscriberClient,
    on,
    subscribe,
    quit,
    set,
    build,
    emitExpired,
    errorSpy,
    warnSpy,
  }
}

/**
 * Finds the listener registered for a given subscriber event.
 *
 * @param on - The `on` mock recording every registration.
 * @param event - The event name (`'error'` or `'message'`).
 * @returns The registered listener.
 */
function listenerFor(
  on: ReturnType<typeof setup>['on'],
  event: string,
): (...args: unknown[]) => void {
  const call = on.mock.calls.find(([registered]) => registered === event)
  if (!call) throw new Error(`no listener registered for '${event}'`)
  return call[1]
}

describe('TtlEventsService (unit)', () => {
  describe('onModuleInit', () => {
    it('disables the feed in cluster mode without opening a subscriber', async () => {
      /*
       * Scenario: boot under CACHE_MODE=cluster.
       * Rule it protects: a single-channel keyspace subscribe cannot cover every shard,
       * so init warns and returns early — no dedicated subscriber is minted.
       */
      const { service, createSubscriberClient } = setup({ CACHE_MODE: 'cluster' })

      await service.onModuleInit()

      expect(createSubscriberClient).not.toHaveBeenCalled()
    })

    it('opens a dedicated subscriber and wires the keyspace channel in standalone mode', async () => {
      /*
       * Scenario: boot under CACHE_MODE=standalone, REDIS_DB=0.
       * Rule it protects: init mints a dedicated subscriber, registers an `error`
       * listener, and subscribes to the fixed `__keyevent@<db>__:expired` channel.
       */
      const { service, createSubscriberClient, on, subscribe } = setup({
        CACHE_MODE: 'standalone',
        REDIS_DB: 0,
      })

      await service.onModuleInit()

      expect(createSubscriberClient).toHaveBeenCalledTimes(1)
      expect(subscribe).toHaveBeenCalledWith('__keyevent@0__:expired')
      expect(on).toHaveBeenCalledWith('error', expect.any(Function))
      expect(on).toHaveBeenCalledWith('message', expect.any(Function))
    })

    it('forwards an in-namespace expiry to the gateway', async () => {
      /*
       * Scenario: an expiry fires for a key inside this app's namespace.
       * Rule it protects: the message listener keeps keys that start with the namespace
       * prefix and forwards them via emitExpired.
       */
      const { service, on, emitExpired } = setup({ CACHE_MODE: 'standalone', REDIS_DB: 0 })
      await service.onModuleInit()

      listenerFor(on, 'message')('__keyevent@0__:expired', `${NS}ttl:abc`)

      expect(emitExpired).toHaveBeenCalledWith(`${NS}ttl:abc`)
    })

    it('drops a foreign-namespace expiry', async () => {
      /*
       * Scenario: an expiry fires for a key OUTSIDE this app's namespace.
       * Rule it protects: the prefix filter returns early for foreign keys so the demo
       * feed never leaks another tenant's expiries.
       */
      const { service, on, emitExpired } = setup({ CACHE_MODE: 'standalone', REDIS_DB: 0 })
      await service.onModuleInit()

      listenerFor(on, 'message')('__keyevent@0__:expired', 'other-app:ttl:abc')

      expect(emitExpired).not.toHaveBeenCalled()
    })

    it('logs an Error stack when forwarding an expiry throws', async () => {
      /*
       * Scenario: emitExpired throws an `Error` while forwarding.
       * Rule it protects: the catch logs the failure with the error's `stack` (the
       * `err instanceof Error` arm) and never lets the listener reject.
       */
      const { service, on, emitExpired, errorSpy } = setup({
        CACHE_MODE: 'standalone',
        REDIS_DB: 0,
      })
      await service.onModuleInit()
      const boom = new Error('gateway down')
      emitExpired.mockImplementation(() => {
        throw boom
      })

      expect(() =>
        listenerFor(on, 'message')('__keyevent@0__:expired', `${NS}ttl:abc`),
      ).not.toThrow()
      expect(errorSpy).toHaveBeenCalledWith(`Failed to forward expiry for ${NS}ttl:abc`, boom.stack)
    })

    it('stringifies a non-Error thrown while forwarding an expiry', async () => {
      /*
       * Scenario: emitExpired throws a non-Error value.
       * Rule it protects: the catch's `String(err)` arm handles a thrown primitive so
       * logging never assumes an Error shape.
       */
      const { service, on, emitExpired, errorSpy } = setup({
        CACHE_MODE: 'standalone',
        REDIS_DB: 0,
      })
      await service.onModuleInit()
      const nonError: unknown = 'plain failure'
      emitExpired.mockImplementation(() => {
        throw nonError
      })

      listenerFor(on, 'message')('__keyevent@0__:expired', `${NS}ttl:abc`)

      expect(errorSpy).toHaveBeenCalledWith(
        `Failed to forward expiry for ${NS}ttl:abc`,
        'plain failure',
      )
    })

    it('logs the connection error stack when the subscriber errors', async () => {
      /*
       * Scenario: the dedicated subscriber emits a connection `error` carrying a stack.
       * Rule it protects: the error listener logs `err.stack` (the left arm of the
       * `?? err.message` fallback) so a Redis drop surfaces as a log line.
       */
      const { service, on, errorSpy } = setup({ CACHE_MODE: 'standalone', REDIS_DB: 0 })
      await service.onModuleInit()
      const err = new Error('ECONNRESET')

      listenerFor(on, 'error')(err)

      expect(errorSpy).toHaveBeenCalledWith('TTL subscriber connection error', err.stack)
    })

    it('falls back to the message when the connection error has no stack', async () => {
      /*
       * Scenario: the subscriber errors with an Error whose `stack` is undefined.
       * Rule it protects: the `?? err.message` fallback logs the message when no stack
       * is present — the right arm of the nullish coalesce.
       */
      const { service, on, errorSpy } = setup({ CACHE_MODE: 'standalone', REDIS_DB: 0 })
      await service.onModuleInit()
      const err = new Error('no-stack')
      // `exactOptionalPropertyTypes` forbids assigning `undefined` to the optional
      // `stack`; deleting the property models a stackless Error precisely.
      delete err.stack

      listenerFor(on, 'error')(err)

      expect(errorSpy).toHaveBeenCalledWith('TTL subscriber connection error', 'no-stack')
    })
  })

  describe('onModuleDestroy', () => {
    it('is a no-op when no subscriber was opened', async () => {
      /*
       * Scenario: shutdown after a cluster-mode boot (subscriber never minted).
       * Rule it protects: with `sub` unset destroy returns immediately without calling
       * quit — a partial-init or double-invoke is safe.
       */
      const { service, quit } = setup({ CACHE_MODE: 'cluster' })
      await service.onModuleInit()

      await service.onModuleDestroy()

      expect(quit).not.toHaveBeenCalled()
    })

    it('quits the dedicated subscriber gracefully', async () => {
      /*
       * Scenario: shutdown after a standalone boot.
       * Rule it protects: destroy quits the owned subscriber once, and a second destroy
       * is a no-op because the field is cleared first.
       */
      const { service, quit } = setup({ CACHE_MODE: 'standalone', REDIS_DB: 0 })
      await service.onModuleInit()

      await service.onModuleDestroy()
      await service.onModuleDestroy()

      expect(quit).toHaveBeenCalledTimes(1)
    })

    it('catches and logs an Error rejection from quit()', async () => {
      /*
       * Scenario: quit() rejects with an Error during shutdown.
       * Rule it protects: the catch warns with `err.message` (the `instanceof Error`
       * arm) so a teardown failure never interrupts Nest's shutdown sequence.
       */
      const { service, quit, warnSpy } = setup({ CACHE_MODE: 'standalone', REDIS_DB: 0 })
      await service.onModuleInit()
      quit.mockRejectedValue(new Error('already closed'))

      await expect(service.onModuleDestroy()).resolves.toBeUndefined()
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('already closed'))
    })

    it('catches and stringifies a non-Error rejection from quit()', async () => {
      /*
       * Scenario: quit() rejects with a non-Error value during shutdown.
       * Rule it protects: the catch's `String(err)` arm handles a non-Error rejection so
       * shutdown still completes cleanly.
       */
      const { service, quit, warnSpy } = setup({ CACHE_MODE: 'standalone', REDIS_DB: 0 })
      await service.onModuleInit()
      quit.mockRejectedValue('socket gone')

      await expect(service.onModuleDestroy()).resolves.toBeUndefined()
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('socket gone'))
    })
  })

  describe('seed', () => {
    it('seeds a short-TTL key under the demo prefix with an explicit id', async () => {
      /*
       * Scenario: seed with a caller-supplied id.
       * Rule it protects: seed writes `{ id, kind: 'ttl-demo' }` through the catalog
       * write path under the `ttl` prefix and returns the built key + applied TTL.
       */
      const { service, set, build } = setup({ CACHE_MODE: 'standalone', REDIS_DB: 0 })

      await expect(service.seed(5, 'fixed-id')).resolves.toEqual({
        key: `${NS}ttl:fixed-id`,
        ttlSeconds: 5,
      })
      expect(set).toHaveBeenCalledWith('ttl', 'fixed-id', { id: 'fixed-id', kind: 'ttl-demo' }, 5)
      expect(build).toHaveBeenCalledWith('ttl', 'fixed-id')
    })

    it('generates a UUID id when none is supplied', async () => {
      /*
       * Scenario: seed without an id.
       * Rule it protects: the `id ?? randomUUID()` fallback mints a fresh id, which is
       * used consistently for both the cache write and the returned key.
       */
      const { service, set } = setup({ CACHE_MODE: 'standalone', REDIS_DB: 0 })

      const result = await service.seed(3)

      expect(result.ttlSeconds).toBe(3)
      const firstSet = set.mock.calls[0]
      if (!firstSet) throw new Error('expected set() to have been called')
      const [prefix, id, value, ttl] = firstSet
      expect(prefix).toBe('ttl')
      expect(typeof id).toBe('string')
      expect(value).toEqual({ id, kind: 'ttl-demo' })
      expect(ttl).toBe(3)
      expect(result.key).toBe(`${NS}ttl:${id}`)
    })
  })
})
