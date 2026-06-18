/**
 * Read-through cache + TTL keyspace-expiry E2E (real Redis via Testcontainers).
 *
 * Exercises the canonical read-through flow through the production `CatalogService`:
 * a cold miss fetches the origin once and caches it, a warm read is a pure cache
 * hit (no second origin call), and after the short TTL elapses Redis emits a real
 * `__keyevent@0__:expired` notification for the namespaced key — observed here on a
 * dedicated raw subscriber — after which a re-read re-populates from origin.
 *
 * The expiry assertion depends on the container's `--notify-keyspace-events Ex`
 * (set by the redis-container helper); a default redis:7-alpine never fires the event.
 *
 * @module test/read-through.e2e-spec
 */
import { jest } from '@jest/globals'
import { Redis } from 'ioredis'
import type { StartedRedisContainer } from '@testcontainers/redis'
import { startRedisContainer } from './helpers/redis-container.js'
import { createTestApp, type TestApiApp } from './helpers/test-app.js'
import { CatalogService } from '../src/catalog/catalog.service.js'
import { ProductOriginStore } from '../src/catalog/product-origin.store.js'

/** Short TTL so the expiry path runs inside the test window. */
const TTL_SECONDS = 2
/** Redis keyspace-expiry channel; REDIS_DB defaults to 0 in the test env. */
const EXPIRED_CHANNEL = '__keyevent@0__:expired'
/** The namespaced key the catalog writes for product `p1`. */
const PRODUCT_KEY = 'cache-example:product:p1'
/** Upper bound for the expiry event — comfortably above the TTL + Redis expiry cycle. */
const EXPIRY_TIMEOUT_MS = 10_000

/**
 * Resolves when the keyspace subscriber reports `key` expired, rejecting on timeout.
 *
 * A low-frequency `EXISTS` nudge on the main client forces passive expiry so the
 * notification fires promptly even if Redis' active-expiry cycle is slow to sample
 * a single key.
 *
 * @param subscriber - A connection already subscribed to the expiry channel.
 * @param key - The full namespaced key whose expiry is awaited.
 * @param client - The main client used to nudge passive expiry.
 * @param timeoutMs - Maximum time to wait before rejecting.
 * @returns The expired key once observed.
 */
function waitForExpiry(
  subscriber: Redis,
  key: string,
  client: Redis,
  timeoutMs: number,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const nudge = setInterval(() => {
      void client.exists(key)
    }, 200)
    const onMessage = (_channel: string, expiredKey: string): void => {
      if (expiredKey !== key) return
      cleanup()
      resolve(expiredKey)
    }
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`Timed out waiting for expiry of ${key}`))
    }, timeoutMs)
    const cleanup = (): void => {
      clearInterval(nudge)
      clearTimeout(timer)
      subscriber.off('message', onMessage)
    }
    subscriber.on('message', onMessage)
  })
}

describe('read-through cache + TTL expiry (real Redis)', () => {
  let container: StartedRedisContainer
  let api: TestApiApp
  let subscriber: Redis

  beforeAll(async () => {
    container = await startRedisContainer()
    // Short default TTL so getProduct() writes a key that expires within the test.
    api = await createTestApp(container.getConnectionUrl(), {
      CACHE_DEFAULT_TTL: String(TTL_SECONDS),
    })
    subscriber = new Redis(container.getConnectionUrl())
    await subscriber.subscribe(EXPIRED_CHANNEL)
  })

  afterAll(async () => {
    subscriber?.disconnect() // ioredis disconnect() is synchronous (void) — no await.
    await api?.app.close()
    await container?.stop()
  })

  it('serves a cold miss from origin, a warm hit from cache, then re-populates after expiry', async () => {
    /*
     * Scenario: the read-through contract end to end against a real server.
     * Rule it protects: a miss costs exactly one origin fetch, a warm read costs
     * zero, the key really expires (a genuine keyspace notification, not a timer),
     * and a post-expiry read pays for origin again — proving the cache, not the
     * test, drives hit/miss accounting.
     */
    const catalog = api.app.get(CatalogService)
    const origin = api.app.get(ProductOriginStore)
    const originSpy = jest.spyOn(origin, 'find')

    // (a) cold read → miss → exactly one origin fetch → value cached.
    const first = await catalog.getProduct('p1')
    expect(first).not.toBeNull()
    expect(originSpy).toHaveBeenCalledTimes(1)

    // (b) immediate re-read → cache hit, no second origin fetch.
    const second = await catalog.getProduct('p1')
    expect(second).toEqual(first)
    expect(originSpy).toHaveBeenCalledTimes(1)

    // (c) the real keyspace notification fires for the namespaced key, and it is gone.
    await expect(
      waitForExpiry(subscriber, PRODUCT_KEY, api.cache.getClient(), EXPIRY_TIMEOUT_MS),
    ).resolves.toBe(PRODUCT_KEY)
    expect(await api.cache.get('product', 'p1')).toBeNull()

    // (d) re-read after expiry re-populates → a second origin fetch.
    const third = await catalog.getProduct('p1')
    expect(third).toEqual(first)
    expect(originSpy).toHaveBeenCalledTimes(2)
  })
})
