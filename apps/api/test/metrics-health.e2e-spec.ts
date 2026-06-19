/**
 * Metrics + health HTTP E2E (real Redis via Testcontainers).
 *
 * Asserts the app-level hit/miss snapshot at `GET /metrics` moves after real
 * catalog read-throughs, and that `GET /health` honours its probe-safe,
 * never-500 contract with a non-negative latency. Both run over `supertest`
 * against the booted app and the published library.
 *
 * @module test/metrics-health.e2e-spec
 */
import type { StartedRedisContainer } from '@testcontainers/redis'
import { startRedisContainer } from './helpers/redis-container.js'
import { createTestApp, type TestApiApp } from './helpers/test-app.js'
import { httpAgent } from './helpers/http.js'

describe('metrics + health HTTP flows (real Redis)', () => {
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

  it('GET /health returns 200 ok with a non-negative latency', async () => {
    /*
     * Scenario: a load-balancer probe hits the liveness route against a healthy Redis.
     * Rule it protects: /health answers 200 `{ status: 'ok', latencyMs >= 0 }` when
     * the connection is live — the signal a balancer uses to keep the instance in
     * rotation. The route never throws a 500 (the probe-safe contract).
     */
    const response = await httpAgent(api.app).get('/health')

    expect(response.status).toBe(200)
    expect(response.body.status).toBe('ok')
    expect(response.body.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('GET /metrics reflects hit/miss accounting after catalog reads', async () => {
    /*
     * Scenario: a miss (first read) then a hit (second read) of the same product.
     * Rule it protects: the catalog read-through records one miss then one hit
     * under the `product` prefix, and GET /metrics surfaces both in the per-prefix
     * and aggregate totals — proving the snapshot tracks real cache branches.
     */
    // First read misses and back-fills the cache; the second read is a hit.
    await httpAgent(api.app).get('/catalog/products/p1')
    await httpAgent(api.app).get('/catalog/products/p1')

    const response = await httpAgent(api.app).get('/metrics')
    expect(response.status).toBe(200)
    expect(response.body.totals.hits).toBeGreaterThanOrEqual(1)
    expect(response.body.totals.misses).toBeGreaterThanOrEqual(1)
    expect(response.body.prefixes.product.hits).toBeGreaterThanOrEqual(1)
    expect(response.body.prefixes.product.misses).toBeGreaterThanOrEqual(1)
    expect(response.body.note).toContain('in-process')
  })
})
