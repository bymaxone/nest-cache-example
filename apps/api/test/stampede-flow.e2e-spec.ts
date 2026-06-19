/**
 * Stampede HTTP E2E (real Redis via Testcontainers).
 *
 * Drives `POST /stampede` over `supertest` and asserts the single-flight Lua
 * lock collapses N concurrent contenders into one origin fetch + N−1 cache hits,
 * returning the per-contender timeline, the burst summary, and the resolved
 * script identity — plus the Zod 400 envelope on out-of-range / missing inputs.
 * The `acquireLock` script runs against a genuine container through the
 * published library.
 *
 * @module test/stampede-flow.e2e-spec
 */
import type { StartedRedisContainer } from '@testcontainers/redis'
import { startRedisContainer } from './helpers/redis-container.js'
import { createTestApp, type TestApiApp } from './helpers/test-app.js'
import { httpAgent } from './helpers/http.js'

/** Burst size — comfortably above the single winner so the N−1 collapse is meaningful. */
const CONCURRENCY = 8
/** A Redis SHA1 digest: 40 lowercase hex characters. */
const SHA1_PATTERN = /^[0-9a-f]{40}$/

describe('stampede HTTP flow (real Redis)', () => {
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

  it('returns the single-flight timeline and summary over HTTP', async () => {
    /*
     * Scenario: a thundering herd hits one uncached product through the REST burst.
     * Rule it protects: the response carries one timeline entry per contender, and
     * the summary reports exactly one origin fetch + N−1 cache hits with the matching
     * hit rate and the resolved `acquireLock` SHA — the single-flight collapse
     * surfaced over HTTP for the Stampede Lab.
     */
    const response = await httpAgent(api.app)
      .post('/stampede')
      .query({ productId: 'sp1', concurrency: CONCURRENCY, lockMs: 2000 })

    expect(response.status).toBe(201)
    expect(response.body.productId).toBe('sp1')
    expect(response.body.timeline).toHaveLength(CONCURRENCY)
    expect(response.body.summary.concurrency).toBe(CONCURRENCY)
    expect(response.body.summary.originFetches).toBe(1)
    expect(response.body.summary.cacheHits).toBe(CONCURRENCY - 1)
    expect(response.body.summary.hitRate).toBeCloseTo((CONCURRENCY - 1) / CONCURRENCY)
    expect(response.body.script.name).toBe('acquireLock')
    expect(response.body.script.sha).toMatch(SHA1_PATTERN)
  })

  it('rejects a missing productId and an out-of-range concurrency with the Zod 400 envelope', async () => {
    /*
     * Scenario: a burst with no product id and a burst with concurrency 0.
     * Rule it protects: the required `productId` and the bounded `concurrency`
     * (1–100) each reject via the Zod pipe with the stable 400 envelope, so a
     * malformed burst never fires against Redis.
     */
    const missing = await httpAgent(api.app).post('/stampede').query({ concurrency: 4 })
    expect(missing.status).toBe(400)
    expect(missing.body.error.code).toBe('validation_failed')

    const outOfRange = await httpAgent(api.app)
      .post('/stampede')
      .query({ productId: 'sp1', concurrency: 0 })
    expect(outOfRange.status).toBe(400)
  })
})
