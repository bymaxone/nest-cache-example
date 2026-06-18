/**
 * Namespace-isolation E2E (real Redis via Testcontainers).
 *
 * Proves `flushNamespace()` is scoped: it SCAN+UNLINKs only keys under the app's
 * `cache-example:` namespace and leaves a foreign, un-namespaced key untouched.
 * The foreign key is written through the raw `getClient()` escape hatch — the
 * documented anti-pattern — precisely to demonstrate it survives a namespace flush.
 *
 * @module test/namespace.e2e-spec
 */
import type { StartedRedisContainer } from '@testcontainers/redis'
import { startRedisContainer } from './helpers/redis-container.js'
import { createTestApp, type TestApiApp } from './helpers/test-app.js'

/** A key OUTSIDE the app namespace, written raw to prove the flush leaves it alone. */
const FOREIGN_KEY = 'other-app:demo'
/** The value stored under the foreign key; asserted intact after the flush. */
const FOREIGN_VALUE = 'survivor'

describe('namespace isolation + flushNamespace (real Redis)', () => {
  let container: StartedRedisContainer
  let api: TestApiApp

  beforeAll(async () => {
    container = await startRedisContainer()
    api = await createTestApp(container.getConnectionUrl())
  })

  afterAll(async () => {
    await api?.app.close()
    await container?.stop()
  })

  it('flushNamespace removes only cache-example:* keys; a foreign key survives', async () => {
    /*
     * Scenario: a tenant flush must never cross namespace boundaries.
     * Rule it protects: flushNamespace() is bounded to the configured namespace
     * prefix, so seeding several cache-example:* keys plus one raw foreign key and
     * then flushing clears exactly the namespaced set and never the foreign key —
     * the guarantee that one app/tenant cannot wipe another's data.
     */
    // Seed several namespaced keys through the library (auto-namespaced writes).
    await api.cache.set('product', 'n1', { id: 'n1' })
    await api.cache.set('product', 'n2', { id: 'n2' })
    await api.cache.set('cart', 'c1', { items: 1 })

    // Foreign, un-namespaced key via the raw client (the documented anti-pattern).
    await api.cache.getClient().set(FOREIGN_KEY, FOREIGN_VALUE)

    const removed = await api.cache.flushNamespace()
    expect(removed).toBeGreaterThanOrEqual(3)

    // Every namespaced key is gone…
    const remaining = await api.cache.getClient().keys('cache-example:*')
    expect(remaining).toEqual([])

    // …and the foreign-namespace key is untouched.
    expect(await api.cache.getClient().get(FOREIGN_KEY)).toBe(FOREIGN_VALUE)
  })
})
