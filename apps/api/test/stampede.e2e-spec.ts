/**
 * Cache-stampede single-flight E2E (real Redis via Testcontainers).
 *
 * Fires N concurrent contenders for one uncached product through the production
 * `StampedeService` and asserts the Lua single-flight lock collapses them into
 * exactly one origin fetch plus N−1 cache hits. Also exercises the
 * `ScriptManagerService` SHA resolution and the transparent `EVALSHA`→`NOSCRIPT`
 * reload path against the real server.
 *
 * @module test/stampede.e2e-spec
 */
import { BYMAX_CACHE_SCRIPT_REGISTRY, type ScriptManagerService } from '@bymax-one/nest-cache'
import type { StartedRedisContainer } from '@testcontainers/redis'
import { startRedisContainer } from './helpers/redis-container.js'
import { createTestApp, type TestApiApp } from './helpers/test-app.js'
import { StampedeService } from '../src/stampede/stampede.service.js'

/** Burst size — comfortably above the 1 winner so the N−1 collapse is meaningful. */
const CONCURRENCY = 12
/** Lock TTL (ms) and the wait cap — well above the 400ms simulated origin latency. */
const LOCK_MS = 3_000
/** A Redis SHA1 digest: 40 lowercase hex characters. */
const SHA1_PATTERN = /^[0-9a-f]{40}$/

describe('cache-stampede single-flight (real Redis)', () => {
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

  it('collapses N concurrent contenders into one origin fetch + N−1 cache hits', async () => {
    /*
     * Scenario: a thundering herd hits one uncached key at once.
     * Rule it protects: the Lua SET-NX lock elects a single fetcher — exactly one
     * contender pays the origin, the other N−1 read the value it cached — so the
     * origin is shielded from the herd, the entire point of single-flight.
     */
    const stampede = api.app.get(StampedeService)
    const result = await stampede.run({
      productId: 's1',
      concurrency: CONCURRENCY,
      lockMs: LOCK_MS,
    })

    expect(result.summary.concurrency).toBe(CONCURRENCY)
    expect(result.summary.originFetches).toBe(1)
    expect(result.summary.cacheHits).toBe(CONCURRENCY - 1)
    expect(result.script.name).toBe('acquireLock')
    expect(result.script.sha).toMatch(SHA1_PATTERN)
  })

  it('resolves a stable script SHA and survives a forced NOSCRIPT reload', async () => {
    /*
     * Scenario: the server-side script cache is wiped mid-life (a Redis restart or
     * SCRIPT FLUSH).
     * Rule it protects: ScriptManagerService.load returns a stable SHA1, and a
     * subsequent eval whose EVALSHA hits NOSCRIPT transparently reloads the script
     * and retries — so a flushed cache never surfaces as a failed operation.
     */
    const scripts = api.app.get<ScriptManagerService>(BYMAX_CACHE_SCRIPT_REGISTRY)
    const firstSha = await scripts.load('acquireLock')
    const secondSha = await scripts.load('acquireLock')
    expect(firstSha).toMatch(SHA1_PATTERN)
    expect(secondSha).toBe(firstSha)

    // Wipe the server-side script cache so the next EVALSHA must reload (NOSCRIPT).
    await api.cache.getClient().call('SCRIPT', 'FLUSH')
    const won = await api.cache.eval(
      'acquireLock',
      ['stampede:reload-probe'],
      ['reload-token', LOCK_MS],
    )
    expect(won).toBe(1)
  })
})
