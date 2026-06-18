/**
 * Pub/Sub fan-out + ref-counted unsubscribe E2E (real Redis via Testcontainers).
 *
 * Drives the library `PubSubService` directly: a published message reaches both an
 * exact `subscribe` and a matching `psubscribe`, the channel is namespaced on the
 * wire, and the ref-counted `Unsubscribe` keeps delivery alive while any listener
 * remains — with a double-unsubscribe proven to be a safe no-op.
 *
 * Dedicated test channels (`e2e-*`) keep this isolated from the app's default
 * Pub/Sub bridge subscriptions, which share the same subscriber connection.
 *
 * @module test/pubsub.e2e-spec
 */
import { PubSubService } from '@bymax-one/nest-cache'
import type { StartedRedisContainer } from '@testcontainers/redis'
import { startRedisContainer } from './helpers/redis-container.js'
import { createTestApp, type TestApiApp } from './helpers/test-app.js'
import { waitUntil } from './helpers/async.js'

describe('pubsub fan-out + ref-counted unsubscribe (real Redis)', () => {
  let container: StartedRedisContainer
  let api: TestApiApp
  let pubsub: PubSubService

  beforeAll(async () => {
    container = await startRedisContainer()
    api = await createTestApp(container.getConnectionUrl())
    pubsub = api.app.get(PubSubService)
  })

  afterAll(async () => {
    await api?.app.close()
    await container?.stop()
  })

  it('delivers one publish to both an exact and a pattern subscriber, namespaced', async () => {
    /*
     * Scenario: fan-out to heterogeneous subscribers.
     * Rule it protects: a single publish reaches an exact-channel listener AND a
     * glob pattern listener, and the library hands the pattern handler the
     * NAMESPACED concrete channel — proving channels are namespaced on the wire,
     * never leaked raw.
     */
    const exact: unknown[] = []
    const pattern: Array<{ message: unknown; channel: string }> = []

    const unsubExact = await pubsub.subscribe<unknown>('e2e-fanout', (message) => {
      exact.push(message)
    })
    const unsubPattern = await pubsub.psubscribe<unknown>('e2e-pattern:*', (message, channel) => {
      pattern.push({ message, channel })
    })

    try {
      const receivers = await pubsub.publish('e2e-fanout', { hello: 'world' })
      expect(receivers).toBeGreaterThanOrEqual(1)
      await pubsub.publish('e2e-pattern:42', { n: 42 })

      await waitUntil(() => exact.length >= 1 && pattern.length >= 1)
      expect(exact[0]).toEqual({ hello: 'world' })
      expect(pattern[0]?.message).toEqual({ n: 42 })
      expect(pattern[0]?.channel).toBe('cache-example:e2e-pattern:42')
    } finally {
      await unsubExact()
      await unsubPattern()
    }
  })

  it('keeps delivery alive after one of two unsubscribes; double-unsubscribe is safe', async () => {
    /*
     * Scenario: two listeners on one channel, one detaches.
     * Rule it protects: the Unsubscribe is ref-counted per channel — detaching one
     * listener must not tear down the shared subscription, so the remaining listener
     * still receives; and calling an already-spent Unsubscribe again is idempotent,
     * never throwing.
     */
    const received: unknown[] = []
    const first = await pubsub.subscribe<unknown>('e2e-ref', () => {
      received.push('first')
    })
    const second = await pubsub.subscribe<unknown>('e2e-ref', (message) => {
      received.push(message)
    })

    await first() // detach the first listener; `second` keeps the channel alive.
    const receivers = await pubsub.publish('e2e-ref', { keep: true })
    expect(receivers).toBeGreaterThanOrEqual(1)

    await waitUntil(() => received.some((entry) => typeof entry === 'object'))
    expect(received).toContainEqual({ keep: true })

    await second() // last listener → the library fires the Redis UNSUBSCRIBE.
    await expect(second()).resolves.toBeUndefined() // double-unsubscribe: safe no-op.
  })
})
