/**
 * Admin / Explorer HTTP E2E (real Redis via Testcontainers).
 *
 * Drives all nine `/admin` routes over `supertest`: parsed Redis INFO, the
 * sampled keyspace breakdown, key listing (both `scan` and `keys` strategies),
 * single-key inspect (+ its 404), delete, persist, expire, bulk seed, and the
 * namespace flush — including the contract that a foreign-namespace key survives
 * the flush. Inputs are validated through the production Zod pipe, so the 400
 * envelope is exercised too. Nothing is mocked — the published library serves
 * every command against a genuine `redis:7-alpine`.
 *
 * @module test/admin.e2e-spec
 */
import type { StartedRedisContainer } from '@testcontainers/redis'
import { startRedisContainer } from './helpers/redis-container.js'
import { createTestApp, type TestApiApp } from './helpers/test-app.js'
import { httpAgent } from './helpers/http.js'

/** Warning surfaced by `GET /admin/keys?strategy=keys` (mirrors `admin.service.ts`). */
const KEYS_BLOCKING_WARNING = 'O(N) command — blocks the Redis server, dev only'
/** A key written OUTSIDE the app namespace — it must survive a namespace flush. */
const FOREIGN_KEY = 'other-app:demo'

describe('admin / explorer HTTP flows (real Redis)', () => {
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

  it('GET /admin/info returns parsed sections; a bad section is 400', async () => {
    /*
     * Scenario: the Explorer reads Redis INFO, whole and by section.
     * Rule it protects: `info` is parsed into `{ section: { field: value } }` (the
     * `server` section always carries `redis_version`), a valid `section` filter is
     * honoured, and an unknown section is rejected by the Zod enum with a 400 — so
     * the Explorer never issues an unsupported INFO section to Redis.
     */
    const all = await httpAgent(api.app).get('/admin/info')
    expect(all.status).toBe(200)
    expect(typeof all.body.server.redis_version).toBe('string')

    const memory = await httpAgent(api.app).get('/admin/info').query({ section: 'memory' })
    expect(memory.status).toBe(200)
    expect(memory.body.memory).toBeDefined()

    const bad = await httpAgent(api.app).get('/admin/info').query({ section: 'not-a-section' })
    expect(bad.status).toBe(400)
    expect(bad.body.error.code).toBe('validation_failed')
  })

  it('GET /admin/keyspace returns the sampled type/prefix/expiry breakdown', async () => {
    /*
     * Scenario: the Overview charts need a typed keyspace summary.
     * Rule it protects: after seeding TTL-less product keys, the breakdown reports
     * them under `byType.string`, the `product` entity in `byPrefix`, and the
     * `noTtl` expiry bucket — the three bounded dimensions the dashboard renders.
     */
    await httpAgent(api.app).post('/admin/seed').query({ count: 5 })

    const response = await httpAgent(api.app).get('/admin/keyspace')
    expect(response.status).toBe(200)
    expect(response.body.byType.string).toBeGreaterThanOrEqual(5)
    expect(response.body.byPrefix).toEqual(
      expect.arrayContaining([expect.objectContaining({ prefix: 'product' })]),
    )
    expect(response.body.expiry.noTtl).toBeGreaterThanOrEqual(5)
  })

  it('POST /admin/seed creates N keys visible via both list strategies', async () => {
    /*
     * Scenario: a bulk seed then a key browse.
     * Rule it protects: `seed` writes exactly `count` namespaced product keys, and
     * both the non-blocking `scan` and the O(N) `keys` strategy surface them fully
     * namespaced — with `keys` carrying its explicit blocking warning.
     */
    const seeded = await httpAgent(api.app).post('/admin/seed').query({ count: 5 })
    expect(seeded.status).toBe(201)
    expect(seeded.body).toEqual({ seeded: 5 })

    const viaKeys = await httpAgent(api.app)
      .get('/admin/keys')
      .query({ prefix: 'product', strategy: 'keys' })
    expect(viaKeys.status).toBe(200)
    expect(viaKeys.body.strategy).toBe('keys')
    expect(viaKeys.body.cursor).toBeNull()
    expect(viaKeys.body.warning).toBe(KEYS_BLOCKING_WARNING)
    expect(viaKeys.body.keys.length).toBeGreaterThanOrEqual(5)
    expect(viaKeys.body.keys).toEqual(
      expect.arrayContaining([expect.stringMatching(/^cache-example:product:/)]),
    )

    const viaScan = await httpAgent(api.app)
      .get('/admin/keys')
      .query({ prefix: 'product', strategy: 'scan', limit: 100 })
    expect(viaScan.status).toBe(200)
    expect(viaScan.body.strategy).toBe('scan')
    expect(viaScan.body.keys.length).toBeGreaterThanOrEqual(5)
  })

  it('GET /admin/keys with no prefix browses the whole namespace (Explorer landing)', async () => {
    /*
     * Scenario: the Explorer lands with neither a tenant nor a prefix selected.
     * Rule it protects: an empty prefix must NOT surface the library's
     * `cache.invalid_key` (which the facade scan/keys raise for an empty prefix);
     * the endpoint enumerates the whole namespace via the raw client and returns
     * fully-namespaced keys with a 200 — so the landing view lists keys instead of
     * an error. Both strategies are exercised.
     */
    await httpAgent(api.app).post('/admin/seed').query({ count: 5 })

    const scanAll = await httpAgent(api.app)
      .get('/admin/keys')
      .query({ strategy: 'scan', limit: 100 })
    expect(scanAll.status).toBe(200)
    expect(scanAll.body.strategy).toBe('scan')
    expect(scanAll.body.keys.length).toBeGreaterThanOrEqual(5)
    expect(scanAll.body.keys).toEqual(
      expect.arrayContaining([expect.stringMatching(/^cache-example:product:/)]),
    )

    const keysAll = await httpAgent(api.app).get('/admin/keys').query({ strategy: 'keys' })
    expect(keysAll.status).toBe(200)
    expect(keysAll.body.strategy).toBe('keys')
    expect(keysAll.body.warning).toBe(KEYS_BLOCKING_WARNING)
    expect(keysAll.body.keys.length).toBeGreaterThanOrEqual(5)
  })

  it('GET /admin/keys/:key inspects a seeded key and 404s an absent key', async () => {
    /*
     * Scenario: drill into one key, then probe a missing one.
     * Rule it protects: inspect returns the decoded value, raw string, TTL, and
     * byte size for a real string key; a `TYPE none` lookup surfaces a 404 — never
     * an empty 200 — so the Explorer can distinguish "absent" from "empty".
     */
    await httpAgent(api.app).post('/admin/seed').query({ count: 5 })

    const inspect = await httpAgent(api.app).get('/admin/keys/cache-example:product:1')
    expect(inspect.status).toBe(200)
    expect(inspect.body).toMatchObject({
      key: 'cache-example:product:1',
      type: 'string',
      value: { id: '1', name: 'Seeded #1', priceCents: 100, tags: ['seed'], stock: 1 },
      ttl: -1,
    })
    expect(typeof inspect.body.raw).toBe('string')
    expect(inspect.body.memoryBytes).toBeGreaterThan(0)

    const missing = await httpAgent(api.app).get('/admin/keys/cache-example:product:absent-xyz')
    expect(missing.status).toBe(404)
    expect(missing.body.message).toBe("Key 'cache-example:product:absent-xyz' does not exist")
  })

  it('expire then persist update a key TTL; delete removes it', async () => {
    /*
     * Scenario: the full single-key TTL lifecycle from the Explorer.
     * Rule it protects: `expire` echoes the TTL it set, `persist` returns -1 and
     * clears the expiry, and `delete` removes the key (a follow-up inspect 404s) —
     * the per-key mutation contract the Explorer buttons map to.
     */
    await httpAgent(api.app).post('/admin/seed').query({ count: 5 })

    const expired = await httpAgent(api.app)
      .post('/admin/keys/cache-example:product:2/expire')
      .send({ seconds: 50 })
    expect(expired.status).toBe(201)
    expect(expired.body).toEqual({ ttl: 50 })

    const afterExpire = await httpAgent(api.app).get('/admin/keys/cache-example:product:2')
    expect(afterExpire.body.ttl).toBeGreaterThan(0)
    expect(afterExpire.body.ttl).toBeLessThanOrEqual(50)

    const persisted = await httpAgent(api.app).post('/admin/keys/cache-example:product:2/persist')
    expect(persisted.status).toBe(201)
    expect(persisted.body).toEqual({ ttl: -1 })

    const deleted = await httpAgent(api.app).delete('/admin/keys/cache-example:product:2')
    expect(deleted.status).toBe(200)
    expect(deleted.body).toEqual({ deleted: 1 })

    const gone = await httpAgent(api.app).get('/admin/keys/cache-example:product:2')
    expect(gone.status).toBe(404)
  })

  it('rejects a non-namespaced key, a non-positive TTL, and an out-of-range count with 400', async () => {
    /*
     * Scenario: malformed admin inputs.
     * Rule it protects: the key-param refine (must be `cache-example:prefix:id`),
     * the positive-int `seconds` body, and the bounded `count` query each map a
     * violation to the stable 400 envelope — never reaching the service.
     */
    const badKey = await httpAgent(api.app).get('/admin/keys/not-namespaced')
    expect(badKey.status).toBe(400)
    expect(badKey.body.error.code).toBe('validation_failed')

    const badTtl = await httpAgent(api.app)
      .post('/admin/keys/cache-example:product:1/expire')
      .send({ seconds: 0 })
    expect(badTtl.status).toBe(400)

    const badCount = await httpAgent(api.app).post('/admin/seed').query({ count: 20000 })
    expect(badCount.status).toBe(400)
  })

  it('DELETE /admin/namespace flushes the namespace but a foreign key survives', async () => {
    /*
     * Scenario: a namespace flush with an unrelated app's key present.
     * Rule it protects: `flushNamespace` removes only `cache-example:*` keys and
     * leaves a foreign `other-app:*` key intact — proving the library's flush is
     * namespace-scoped, never a global FLUSHDB.
     */
    await httpAgent(api.app).post('/admin/seed').query({ count: 5 })
    // Raw foreign write outside the namespace — the library never touches it.
    await api.cache.getClient().set(FOREIGN_KEY, 'survive-me')

    const flushed = await httpAgent(api.app).delete('/admin/namespace')
    expect(flushed.status).toBe(200)
    expect(flushed.body.flushed).toBeGreaterThanOrEqual(5)

    // The foreign key is untouched; the namespace itself is now empty.
    expect(await api.cache.getClient().exists(FOREIGN_KEY)).toBe(1)
    const namespacedKeys = await api.cache.getClient().keys('cache-example:*')
    expect(namespacedKeys).toHaveLength(0)
  })
})
