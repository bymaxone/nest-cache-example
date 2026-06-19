/**
 * Pub/Sub HTTP + WebSocket E2E (real Redis via Testcontainers).
 *
 * Drives all four `/pubsub` routes over `supertest` AND asserts the WebSocket
 * fan-out: a REST publish to a subscribed channel arrives on the `cache:event`
 * socket channel — both for an exact channel and a `product:*` pattern match,
 * with the namespaced channel surfaced. Also proves the ref-counted
 * subscribe/unsubscribe lifecycle (a double/unknown unsubscribe is a safe no-op)
 * and that a throwing handler does not break delivery on other channels. The
 * published library performs every publish/subscribe against a genuine container.
 *
 * @module test/pubsub-flows.e2e-spec
 */
import type { StartedRedisContainer } from '@testcontainers/redis'
import { startRedisContainer } from './helpers/redis-container.js'
import { createTestApp, type TestApiApp } from './helpers/test-app.js'
import { httpAgent } from './helpers/http.js'
import { connectSocketClient, type SocketCapture } from './helpers/socket-client.js'

/** Reads the `tag` marker a test publishes, so frame predicates stay specific. */
function tagOf(payload: unknown): string | undefined {
  // The publish DTO accepts any JSON value (incl. null), so guard before reading.
  if (typeof payload !== 'object' || payload === null) return undefined
  const tag = (payload as { tag?: unknown }).tag
  return typeof tag === 'string' ? tag : undefined
}

describe('pubsub HTTP + WebSocket flows (real Redis)', () => {
  let container: StartedRedisContainer
  let api: TestApiApp
  let ws: SocketCapture

  beforeAll(async () => {
    container = await startRedisContainer()
    api = await createTestApp(container.getConnectionUrl())
    ws = await connectSocketClient(api.baseUrl)
  })

  afterAll(async () => {
    await ws?.close()
    await api?.app.close()
    await container?.stop()
  })

  it('a REST publish fans out to cache:event for an exact channel and a pattern match', async () => {
    /*
     * Scenario: publish over REST to the bootstrap exact channel and a pattern channel.
     * Rule it protects: the bridge forwards each library message to the `cache:event`
     * socket channel carrying the NAMESPACED channel — `product-events` →
     * `cache-example:product-events` and `product:42` → `cache-example:product:42` —
     * so the dashboard receives the resolved channel, never the bare one.
     */
    const exact = await httpAgent(api.app)
      .post('/pubsub/publish')
      .send({ channel: 'product-events', message: { tag: 'exact-1' } })
    expect(exact.status).toBe(201)
    expect(exact.body.channel).toBe('product-events')
    expect(exact.body.subscribers).toBeGreaterThanOrEqual(1)

    const exactFrame = await ws.waitForEvent(
      'cache:event',
      (frame) =>
        frame.channel === 'cache-example:product-events' && tagOf(frame.payload) === 'exact-1',
    )
    expect(exactFrame.payload).toEqual({ tag: 'exact-1' })

    await httpAgent(api.app)
      .post('/pubsub/publish')
      .send({ channel: 'product:42', message: { tag: 'pattern-1' } })
    const patternFrame = await ws.waitForEvent(
      'cache:event',
      (frame) =>
        frame.channel === 'cache-example:product:42' && tagOf(frame.payload) === 'pattern-1',
    )
    expect(patternFrame.payload).toEqual({ tag: 'pattern-1' })
  })

  it('subscribe/unsubscribe is ref-counted; an unknown unsubscribe is a safe no-op', async () => {
    /*
     * Scenario: re-subscribe an existing channel, then add new exact/pattern channels,
     * then unsubscribe a channel that was never subscribed.
     * Rule it protects: a 2nd subscribe to `product-events` increments refs to 2
     * (no 2nd Redis subscription) and a single unsubscribe returns it to 1; a new
     * channel/pattern reports refs 1 with the right kind; and an unknown unsubscribe
     * safely returns refs 0 without throwing — the ref-counting contract.
     */
    const incremented = await httpAgent(api.app)
      .post('/pubsub/subscribe')
      .send({ channel: 'product-events' })
    expect(incremented.status).toBe(201)
    expect(incremented.body).toEqual({ channel: 'product-events', refs: 2, pattern: false })

    const decremented = await httpAgent(api.app)
      .delete('/pubsub/subscribe')
      .send({ channel: 'product-events' })
    expect(decremented.status).toBe(200)
    expect(decremented.body).toEqual({ channel: 'product-events', refs: 1, pattern: false })

    const newExact = await httpAgent(api.app)
      .post('/pubsub/subscribe')
      .send({ channel: 'orders-feed' })
    expect(newExact.body).toEqual({ channel: 'orders-feed', refs: 1, pattern: false })

    const newPattern = await httpAgent(api.app)
      .post('/pubsub/subscribe')
      .send({ channel: 'orders:*', pattern: true })
    expect(newPattern.body).toEqual({ channel: 'orders:*', refs: 1, pattern: true })

    const unknown = await httpAgent(api.app)
      .delete('/pubsub/subscribe')
      .send({ channel: 'never-subscribed' })
    expect(unknown.status).toBe(200)
    expect(unknown.body).toEqual({ channel: 'never-subscribed', refs: 0, pattern: false })
  })

  it('a throwing handler does not break delivery on other channels', async () => {
    /*
     * Scenario: trigger the error-demo throwing handler, then publish to a healthy channel.
     * Rule it protects: the library swallows the handler throw and keeps the shared
     * subscriber alive, so a subsequent publish to `product-events` still fans out
     * to `cache:event` — handler-error isolation, never a torn-down subscriber.
     */
    const thrown = await httpAgent(api.app).post('/pubsub/throw')
    expect(thrown.status).toBe(201)
    expect(thrown.body).toEqual({ triggered: true })

    await httpAgent(api.app)
      .post('/pubsub/publish')
      .send({ channel: 'product-events', message: { tag: 'after-throw' } })
    const frame = await ws.waitForEvent(
      'cache:event',
      (f) => f.channel === 'cache-example:product-events' && tagOf(f.payload) === 'after-throw',
    )
    expect(frame.payload).toEqual({ tag: 'after-throw' })
  })
})
