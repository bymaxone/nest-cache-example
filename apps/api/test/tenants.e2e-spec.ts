/**
 * Tenants HTTP E2E (real Redis via Testcontainers).
 *
 * Drives all four `/tenants` routes over `supertest`: the prefix-scoped
 * read-through (whose `source` flips origin→cache), the per-tenant cache clear
 * (scoped to one tenant), the foreign-namespace seed, and the isolation proof
 * (a foreign key survives a namespace flush). Tenant-id validation is exercised
 * through the production Zod pipe. Every key operation runs against a genuine
 * container through the published library.
 *
 * @module test/tenants.e2e-spec
 */
import type { StartedRedisContainer } from '@testcontainers/redis'
import { startRedisContainer } from './helpers/redis-container.js'
import { createTestApp, type TestApiApp } from './helpers/test-app.js'
import { httpAgent } from './helpers/http.js'

describe('tenants HTTP flows (real Redis)', () => {
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

  it('read-through flips origin→cache and clearing one tenant leaves another intact', async () => {
    /*
     * Scenario: two tenants read the same product id; one tenant's cache is cleared.
     * Rule it protects: a miss synthesizes + caches (`source: 'origin'`) and the
     * repeat is served from cache (`source: 'cache'`); `clearTenant` is prefix-scoped,
     * so clearing `acme` forces it back to origin while `globex` still hits cache —
     * the in-namespace multi-tenancy isolation guarantee.
     */
    const miss = await httpAgent(api.app).get('/tenants/acme/products/sku1')
    expect(miss.status).toBe(200)
    expect(miss.body).toEqual({
      data: { id: 'sku1', name: 'Product sku1', priceCents: 999, tags: ['tenant:acme'], stock: 1 },
      source: 'origin',
    })

    const hit = await httpAgent(api.app).get('/tenants/acme/products/sku1')
    expect(hit.body.source).toBe('cache')

    // A second tenant caches its own isolated copy of the same id.
    const globexMiss = await httpAgent(api.app).get('/tenants/globex/products/sku1')
    expect(globexMiss.body.source).toBe('origin')

    const cleared = await httpAgent(api.app).delete('/tenants/acme/cache')
    expect(cleared.status).toBe(200)
    expect(cleared.body.tenant).toBe('acme')
    expect(cleared.body.scannedKeys).toBeGreaterThanOrEqual(1)
    expect(cleared.body.deleted).toBeGreaterThanOrEqual(1)

    // acme was cleared → back to origin; globex was untouched → still cache.
    const acmeAfter = await httpAgent(api.app).get('/tenants/acme/products/sku1')
    expect(acmeAfter.body.source).toBe('origin')
    const globexAfter = await httpAgent(api.app).get('/tenants/globex/products/sku1')
    expect(globexAfter.body.source).toBe('cache')
  })

  it('seed-foreign writes a foreign key and prove-isolation shows it surviving a flush', async () => {
    /*
     * Scenario: a foreign-namespace key is seeded, then the namespace is flushed.
     * Rule it protects: `seedForeign` writes `other-app:demo` outside the namespace,
     * and `proveIsolation` flushes `cache-example:*` while reporting the foreign key
     * survived — the namespace-boundary guarantee surfaced over HTTP.
     */
    const seeded = await httpAgent(api.app).post('/tenants/seed-foreign')
    expect(seeded.status).toBe(201)
    expect(seeded.body).toEqual({ key: 'other-app:demo', written: true })

    const proof = await httpAgent(api.app).post('/tenants/prove-isolation')
    expect(proof.status).toBe(201)
    expect(proof.body.foreignKeySurvived).toBe(true)
    // The read-through test left both tenants' keys in the namespace, so the
    // flush must remove at least one — a `>= 0` bound would pass on a broken flush.
    expect(proof.body.flushedNamespaceKeys).toBeGreaterThanOrEqual(1)
  })

  it('rejects an invalid tenant id with the Zod 400 envelope', async () => {
    /*
     * Scenario: tenant ids that violate the `[a-z0-9-]{1,32}` charset.
     * Rule it protects: an uppercase id and an underscore id are both rejected by
     * the Zod tenant pattern with the stable 400 envelope, so a malformed tenant
     * prefix never reaches Redis.
     */
    const uppercase = await httpAgent(api.app).get('/tenants/ACME/products/sku1')
    expect(uppercase.status).toBe(400)
    expect(uppercase.body.error.code).toBe('validation_failed')

    const underscore = await httpAgent(api.app).delete('/tenants/bad_tenant/cache')
    expect(underscore.status).toBe(400)
  })
})
