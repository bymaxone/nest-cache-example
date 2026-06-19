/**
 * Catalog HTTP E2E (real Redis via Testcontainers).
 *
 * Drives all six `/catalog/products` routes over `supertest` against the booted
 * app: batch read-through (positional `null` for unknown ids), single
 * read-through with its 404, idempotent `setNx` seed, and the TTL lifecycle
 * (`/ttl`, `/expire`, `/persist`). Also asserts the Zod pipe rejects bad input
 * with the production `{ error: { code, issues } }` envelope. The published
 * library serves every cache branch — nothing is mocked.
 *
 * @module test/catalog.e2e-spec
 */
import type { StartedRedisContainer } from '@testcontainers/redis'
import { startRedisContainer } from './helpers/redis-container.js'
import { createTestApp, type TestApiApp } from './helpers/test-app.js'
import { httpAgent, scalarBody } from './helpers/http.js'

/** Origin-store fixtures (`product-origin.store.ts`) used for exact body assertions. */
const PRODUCT_P1 = {
  id: 'p1',
  name: 'Wireless Headphones',
  priceCents: 7999,
  tags: ['electronics', 'audio'],
  stock: 42,
}
const PRODUCT_P2 = {
  id: 'p2',
  name: 'Mechanical Keyboard',
  priceCents: 12999,
  tags: ['electronics', 'input'],
  stock: 15,
}

describe('catalog HTTP flows (real Redis)', () => {
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

  it('batch read-through returns products positionally aligned, null for unknown ids', async () => {
    /*
     * Scenario: a mixed batch of known and unknown ids in one request.
     * Rule it protects: GET /catalog/products?ids= preserves request order and
     * fills `null` for ids the origin cannot resolve — so a caller can zip the
     * response straight back onto its id list without a re-key.
     */
    const response = await httpAgent(api.app).get('/catalog/products').query({ ids: 'p1,nope,p2' })

    expect(response.status).toBe(200)
    expect(response.body).toEqual([PRODUCT_P1, null, PRODUCT_P2])
  })

  it('single read-through returns the product and 404s an unknown id', async () => {
    /*
     * Scenario: one cached/origin hit and one genuine miss.
     * Rule it protects: a resolvable id read-throughs to the exact origin row,
     * while an unknown id surfaces a 404 (never a 500 or an empty 200) — the
     * controller's NotFound contract.
     */
    const hit = await httpAgent(api.app).get('/catalog/products/p1')
    expect(hit.status).toBe(200)
    expect(hit.body).toEqual(PRODUCT_P1)

    const miss = await httpAgent(api.app).get('/catalog/products/does-not-exist')
    expect(miss.status).toBe(404)
    expect(miss.body.message).toBe("Product 'does-not-exist' not found")
  })

  it('seed is idempotent: created on first call, a no-op on the second', async () => {
    /*
     * Scenario: the same key is seeded twice.
     * Rule it protects: `setNx` writes only when the key is absent, so the first
     * seed reports `isCreated: true` and the second reports `isCreated: false`
     * while `isPresent` stays true — the idempotency the dashboard relies on.
     */
    const first = await httpAgent(api.app).post('/catalog/products/seed-idempotent/seed').send({})
    expect(first.status).toBe(201)
    expect(first.body).toEqual({ isCreated: true, isPresent: true })

    const second = await httpAgent(api.app).post('/catalog/products/seed-idempotent/seed').send({})
    expect(second.status).toBe(201)
    expect(second.body).toEqual({ isCreated: false, isPresent: true })
  })

  it('TTL lifecycle: -2 absent, positive after seed, settable, then -1 after persist', async () => {
    /*
     * Scenario: a key walks the full expiry lifecycle.
     * Rule it protects: `/ttl` honours Redis conventions (-2 absent, -1 no-expiry,
     * positive seconds), `/expire` lowers the timeout, and `/persist` strips it —
     * the TTL surface the dashboard's countdown ring is built on.
     */
    const absent = await httpAgent(api.app).get('/catalog/products/ttl-lifecycle/ttl')
    expect(absent.status).toBe(200)
    expect(scalarBody(absent)).toBe(-2)

    // Seed writes with the default 60s TTL, so the remaining TTL is in (0, 60].
    await httpAgent(api.app).post('/catalog/products/ttl-lifecycle/seed').send({})
    const seededTtl = scalarBody(
      await httpAgent(api.app).get('/catalog/products/ttl-lifecycle/ttl'),
    )
    expect(seededTtl).toBeGreaterThan(0)
    expect(seededTtl).toBeLessThanOrEqual(60)

    const expireResponse = await httpAgent(api.app)
      .post('/catalog/products/ttl-lifecycle/expire')
      .send({ ttlSeconds: 30 })
    expect(expireResponse.status).toBe(201)
    expect(scalarBody(expireResponse)).toBe(true)
    const loweredTtl = scalarBody(
      await httpAgent(api.app).get('/catalog/products/ttl-lifecycle/ttl'),
    )
    expect(loweredTtl).toBeGreaterThan(0)
    expect(loweredTtl).toBeLessThanOrEqual(30)

    const persisted = await httpAgent(api.app).post('/catalog/products/ttl-lifecycle/persist')
    expect(persisted.status).toBe(201)
    expect(scalarBody(persisted)).toBe(true)
    const noExpiry = await httpAgent(api.app).get('/catalog/products/ttl-lifecycle/ttl')
    expect(scalarBody(noExpiry)).toBe(-1)
  })

  it('rejects invalid input with the Zod 400 envelope', async () => {
    /*
     * Scenario: an empty id batch and a non-positive TTL.
     * Rule it protects: the global Zod pipe maps a validation failure to HTTP 400
     * with the stable `{ error: { code: 'validation_failed', issues } }` body — so
     * clients get a structured, machine-readable rejection, never a 500.
     */
    const emptyBatch = await httpAgent(api.app).get('/catalog/products').query({ ids: '' })
    expect(emptyBatch.status).toBe(400)
    expect(emptyBatch.body.error.code).toBe('validation_failed')
    expect(emptyBatch.body.error.issues).toBeDefined()

    const badTtl = await httpAgent(api.app)
      .post('/catalog/products/p1/expire')
      .send({ ttlSeconds: 0 })
    expect(badTtl.status).toBe(400)
    expect(badTtl.body.error.code).toBe('validation_failed')
  })
})
