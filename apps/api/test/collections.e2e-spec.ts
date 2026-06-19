/**
 * Collections HTTP E2E (real Redis via Testcontainers).
 *
 * Drives all eight `/collections/:id` routes over `supertest`: the cart hash
 * (`hset`/`hgetall`/`hget`/`hdel`) and the tag set (`sadd`/`smembers`+`scard`/
 * `sismember`/`srem`), plus the Zod 400 envelope on malformed bodies. Each
 * Redis collection command runs against a genuine container through the
 * published library — nothing is mocked.
 *
 * @module test/collections.e2e-spec
 */
import type { StartedRedisContainer } from '@testcontainers/redis'
import { startRedisContainer } from './helpers/redis-container.js'
import { createTestApp, type TestApiApp } from './helpers/test-app.js'
import { httpAgent, scalarBody } from './helpers/http.js'

describe('collections HTTP flows (real Redis)', () => {
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

  it('cart hash lifecycle: hset (new vs overwrite), hgetall, hget, hdel', async () => {
    /*
     * Scenario: a cart hash is built, read back, and drained one line at a time.
     * Rule it protects: `hset` reports 1 for a new field and 0 for an overwrite,
     * `hgetall`/`hget` round-trip the deserialized CartLine, and `hdel` reports the
     * removed count — the hash semantics the cart UI is built on.
     */
    const created = await httpAgent(api.app)
      .post('/collections/cart-1/cart')
      .send({ field: 'sku-1', value: { quantity: 2, priceCents: 1500 } })
    expect(created.status).toBe(201)
    expect(scalarBody(created)).toBe(1)

    // Overwriting the same field is not a new field → hset returns 0.
    const overwritten = await httpAgent(api.app)
      .post('/collections/cart-1/cart')
      .send({ field: 'sku-1', value: { quantity: 3, priceCents: 1500 } })
    expect(scalarBody(overwritten)).toBe(0)

    const all = await httpAgent(api.app).get('/collections/cart-1/cart')
    expect(all.status).toBe(200)
    expect(all.body).toEqual({ 'sku-1': { quantity: 3, priceCents: 1500 } })

    const line = await httpAgent(api.app).get('/collections/cart-1/cart/sku-1')
    expect(line.body).toEqual({ quantity: 3, priceCents: 1500 })

    const missing = await httpAgent(api.app).get('/collections/cart-1/cart/sku-absent')
    expect(scalarBody(missing)).toBeNull()

    const removed = await httpAgent(api.app).delete('/collections/cart-1/cart/sku-1')
    expect(removed.status).toBe(200)
    expect(scalarBody(removed)).toBe(1)
    // A second delete removes nothing.
    const removedAgain = await httpAgent(api.app).delete('/collections/cart-1/cart/sku-1')
    expect(scalarBody(removedAgain)).toBe(0)

    const drained = await httpAgent(api.app).get('/collections/cart-1/cart')
    expect(drained.body).toEqual({})
  })

  it('tag set lifecycle: sadd (dedup), smembers + scard, sismember, srem', async () => {
    /*
     * Scenario: tags are added with overlap, listed, tested, and removed.
     * Rule it protects: `sadd` counts only newly-added members (set dedup),
     * `smembers`+`scard` report the members and cardinality, `sismember` answers
     * membership, and `srem` reports the removed count — the set contract behind
     * the tag chips.
     */
    const addedTwo = await httpAgent(api.app)
      .post('/collections/tags-1/tags')
      .send({ tags: ['red', 'blue'] })
    expect(addedTwo.status).toBe(201)
    expect(scalarBody(addedTwo)).toBe(2)

    // 'blue' is already a member, so only 'green' is newly added.
    const addedOne = await httpAgent(api.app)
      .post('/collections/tags-1/tags')
      .send({ tags: ['blue', 'green'] })
    expect(scalarBody(addedOne)).toBe(1)

    const listed = await httpAgent(api.app).get('/collections/tags-1/tags')
    expect(listed.status).toBe(200)
    expect(listed.body.count).toBe(3)
    expect(listed.body.tags).toEqual(expect.arrayContaining(['red', 'blue', 'green']))

    const isMember = await httpAgent(api.app).get('/collections/tags-1/tags/red')
    expect(scalarBody(isMember)).toBe(true)
    const notMember = await httpAgent(api.app).get('/collections/tags-1/tags/purple')
    expect(scalarBody(notMember)).toBe(false)

    const removed = await httpAgent(api.app).delete('/collections/tags-1/tags/red')
    expect(removed.status).toBe(200)
    expect(scalarBody(removed)).toBe(1)
    const removedAgain = await httpAgent(api.app).delete('/collections/tags-1/tags/red')
    expect(scalarBody(removedAgain)).toBe(0)

    const afterRemoval = await httpAgent(api.app).get('/collections/tags-1/tags')
    expect(afterRemoval.body.count).toBe(2)
  })

  it('rejects malformed cart and tag bodies with the Zod 400 envelope', async () => {
    /*
     * Scenario: a non-positive cart quantity and an empty tag list.
     * Rule it protects: the cart `value.quantity` (positive int) and the tags
     * `min(1)` array each reject via the Zod pipe with the stable 400 envelope —
     * so a bad write never reaches Redis.
     */
    const badCart = await httpAgent(api.app)
      .post('/collections/cart-1/cart')
      .send({ field: 'sku-1', value: { quantity: 0, priceCents: 10 } })
    expect(badCart.status).toBe(400)
    expect(badCart.body.error.code).toBe('validation_failed')

    const badTags = await httpAgent(api.app).post('/collections/tags-1/tags').send({ tags: [] })
    expect(badTags.status).toBe(400)
    expect(badTags.body.error.code).toBe('validation_failed')
  })
})
