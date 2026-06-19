/**
 * TTL-events + connection-lifecycle WebSocket E2E (real Redis via Testcontainers).
 *
 * Asserts the two WebSocket channels the dashboard's live pages depend on:
 *   - `cache:expired` — `POST /ttl-events/seed` writes a short-TTL key whose real
 *     Redis expiry (the container runs `--notify-keyspace-events Ex`) arrives as a
 *     frame for the namespaced key.
 *   - `cache:connection` — the library's connection-lifecycle bridge forwards a
 *     `ready` event to every connected client.
 * Both run against a genuine container through the published library.
 *
 * @module test/ttl-events.e2e-spec
 */
import { CACHE_EVENT_NAMES } from '@bymax-one/nest-cache/shared'
import type { StartedRedisContainer } from '@testcontainers/redis'
import { startRedisContainer } from './helpers/redis-container.js'
import { createTestApp, type TestApiApp } from './helpers/test-app.js'
import { httpAgent } from './helpers/http.js'
import { connectSocketClient, type SocketCapture } from './helpers/socket-client.js'
import { CacheEventsBridge } from '../src/cache/cache.events.js'

/** Generous window for active-expiry + keyspace-notification delivery on a cold container. */
const EXPIRY_TIMEOUT_MS = 12_000

describe('ttl-events + connection WebSocket flows (real Redis)', () => {
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

  it('a seeded short-TTL key fires a cache:expired frame for its namespaced key', async () => {
    /*
     * Scenario: the dashboard seeds a key with a 1s TTL and watches it expire.
     * Rule it protects: when Redis evicts the key it publishes a keyspace `expired`
     * notification; the raw subscriber forwards it as a `cache:expired` frame for
     * the exact namespaced key — the live countdown-ring expiry signal.
     */
    const seeded = await httpAgent(api.app)
      .post('/ttl-events/seed')
      .send({ ttlSeconds: 1, id: 'expiry-probe' })
    expect(seeded.status).toBe(201)
    expect(seeded.body).toEqual({ key: 'cache-example:ttl:expiry-probe', ttlSeconds: 1 })

    const frame = await ws.waitForEvent(
      'cache:expired',
      (f) => f.key === 'cache-example:ttl:expiry-probe',
      EXPIRY_TIMEOUT_MS,
    )
    expect(frame.key).toBe('cache-example:ttl:expiry-probe')
  })

  it('the connection-lifecycle bridge emits a cache:connection frame to the socket', async () => {
    /*
     * Scenario: the library reports a connection-lifecycle event.
     * Rule it protects: the `CacheEventsBridge` forwards each lifecycle event to the
     * `cache:connection` socket channel as `{ event, data }`, so every dashboard tab
     * sees connection state changes in real time.
     */
    // Drive the exact callback the library invokes on a real lifecycle event.
    const { onEvent } = api.app.get(CacheEventsBridge).toCacheEvents()
    if (!onEvent) throw new Error('CacheEventsBridge.toCacheEvents() did not expose onEvent')
    onEvent(CACHE_EVENT_NAMES.READY, { role: 'main', probe: 'ttl-spec' })

    const frame = await ws.waitForEvent(
      'cache:connection',
      (f) => f.event === CACHE_EVENT_NAMES.READY && f.data.probe === 'ttl-spec',
    )
    expect(frame.data).toMatchObject({ role: 'main', probe: 'ttl-spec' })
  })
})
