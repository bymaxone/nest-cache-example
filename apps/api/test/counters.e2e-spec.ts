/**
 * Counters HTTP E2E (real Redis via Testcontainers).
 *
 * Drives all three `/counters/:id` routes over `supertest`: the views read,
 * the atomic `INCR`/`INCRBY` view increment, and the atomic `DECR`/`DECRBY`
 * stock decrement (which may go negative) — both the default step and the
 * `{ by }` branch — plus the Zod 400 envelope on a non-positive `by`. The
 * atomic math runs against a genuine container through the published library.
 *
 * @module test/counters.e2e-spec
 */
import type { StartedRedisContainer } from '@testcontainers/redis'
import { startRedisContainer } from './helpers/redis-container.js'
import { createTestApp, type TestApiApp } from './helpers/test-app.js'
import { httpAgent, scalarBody } from './helpers/http.js'

describe('counters HTTP flows (real Redis)', () => {
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

  it('views: reads 0 when absent, increments by 1, then by an explicit step', async () => {
    /*
     * Scenario: a fresh view counter is read, then bumped two ways.
     * Rule it protects: a missing counter reads as 0 (never an error), a bare
     * increment applies +1 (`INCR`), and `{ by: N }` applies +N (`INCRBY`), with
     * the post-increment value returned each time — the atomic view-count contract.
     */
    const initial = await httpAgent(api.app).get('/counters/views-1/views')
    expect(initial.status).toBe(200)
    expect(scalarBody(initial)).toBe(0)

    const byOne = await httpAgent(api.app).post('/counters/views-1/views/incr').send({})
    expect(byOne.status).toBe(201)
    expect(scalarBody(byOne)).toBe(1)

    const byFive = await httpAgent(api.app).post('/counters/views-1/views/incr').send({ by: 5 })
    expect(scalarBody(byFive)).toBe(6)

    const total = await httpAgent(api.app).get('/counters/views-1/views')
    expect(scalarBody(total)).toBe(6)
  })

  it('stock: decrements from absent into negative, default step and explicit by', async () => {
    /*
     * Scenario: an unseeded stock counter is decremented past zero.
     * Rule it protects: `DECR`/`DECRBY` operate atomically from an absent key (0),
     * so a bare decrement yields -1 and `{ by: 3 }` yields -4 — proving stock can
     * legitimately go negative and the returned value reflects the new total.
     */
    const byOne = await httpAgent(api.app).post('/counters/stock-1/stock/decr').send({})
    expect(byOne.status).toBe(201)
    expect(scalarBody(byOne)).toBe(-1)

    const byThree = await httpAgent(api.app).post('/counters/stock-1/stock/decr').send({ by: 3 })
    expect(scalarBody(byThree)).toBe(-4)
  })

  it('rejects a non-positive by with the Zod 400 envelope', async () => {
    /*
     * Scenario: a caller asks to increment by 0.
     * Rule it protects: the `by` field (positive int) rejects via the Zod pipe with
     * the stable 400 envelope, so a meaningless step never reaches Redis.
     */
    const bad = await httpAgent(api.app).post('/counters/views-1/views/incr').send({ by: 0 })
    expect(bad.status).toBe(400)
    expect(bad.body.error.code).toBe('validation_failed')
  })
})
