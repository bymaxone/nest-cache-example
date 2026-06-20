/**
 * Unit: StampedeService — the single-flight collapse, fully deterministic.
 *
 * Constructs the service directly with a hand-mocked `CacheService`
 * (`eval`/`get`/`set`) and `ScriptManagerService`, a real `ConfigService`, and
 * fake timers (`{ now: 0 }`) so `Date.now()`, the loser poll backoff, and the
 * simulated origin latency are all driven by `advanceTimersByTimeAsync` rather
 * than the wall clock.
 *
 * Each scenario fires a single contender (`concurrency: 1`) and steers it down one
 * branch by controlling the mocked `eval` (lock won = 1 / lost = 0) and `get`
 * (cache hit vs miss): the true winner (origin fetch), the winner that finds the
 * value already populated (re-check hit), the immediate loser hit, the poll-then-
 * resolve path, both bounded-wait exits (final hit / direct origin), and the
 * best-effort lock-release catch (Error and non-Error).
 *
 * @module stampede/stampede.service.spec
 */
import { jest } from '@jest/globals'
import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { CacheService, ScriptManagerService } from '@bymax-one/nest-cache'
import type { Env } from '../config/env.schema.js'
import type { StampedeProduct } from './origin.js'
import type { StampedeQuery } from './dto/stampede-query.dto.js'
import { StampedeService } from './stampede.service.js'

/** The single-flight lock script name (private constant in the source). */
const ACQUIRE_LOCK = 'acquireLock'
/** The token-safe release script name (private constant in the source). */
const RELEASE_LOCK = 'releaseLock'
/** Simulated slow-origin latency (ms) the real `fetchProductFromOrigin` waits. */
const ORIGIN_LATENCY_MS = 400
/** Fixed poll backoff (ms) a loser sleeps between checks (private constant). */
const POLL_INTERVAL_MS = 20
/** The default TTL the real ConfigService resolves and the service applies. */
const TTL = 60
/** A resolved script SHA1 the dashboard displays. */
const SHA = 'sha1-fixed'

/** A representative origin product the winner caches. */
const PRODUCT: StampedeProduct = {
  id: 'p1',
  name: 'Product p1',
  priceCents: 1000,
  tags: [],
  stock: 100,
}

/**
 * Builds the service with controllable cache + script-registry mocks and a real
 * ConfigService seeded with the default TTL.
 *
 * @returns The service plus every inner mock for stubbing and assertions.
 */
function setup() {
  const evalFn = jest.fn<CacheService['eval']>()
  const getFn = jest.fn<(prefix: string, id: string) => Promise<StampedeProduct | null>>()
  const setFn = jest.fn<CacheService['set']>(() => Promise.resolve())
  const cacheMock: Partial<CacheService> = {
    eval: evalFn,
    get: <T>(prefix: string, id: string): Promise<T | null> =>
      getFn(prefix, id) as Promise<T | null>,
    set: setFn,
  }

  const load = jest.fn<ScriptManagerService['load']>(() => Promise.resolve(SHA))
  const scriptsMock: Partial<ScriptManagerService> = { load }

  const config = new ConfigService<Env, true>({ CACHE_DEFAULT_TTL: TTL })

  const service = new StampedeService(
    cacheMock as CacheService,
    scriptsMock as ScriptManagerService,
    config,
  )
  return { service, evalFn, getFn, setFn, load }
}

/** A single-contender burst query for `productId` with the given lock window. */
function singleBurst(lockMs: number): StampedeQuery {
  return { productId: 'p1', concurrency: 1, lockMs }
}

describe('StampedeService (unit)', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: 0 })
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('the lock winner fetches the origin once, populates the cache, and releases', async () => {
    /*
     * Scenario: eval wins the lock (1) and the value is not yet cached.
     * Rule it protects: the winner fetches the slow origin, sets the product under the
     * configured TTL, releases the lock, and is recorded as role=won / outcome=origin.
     */
    const { service, evalFn, getFn, setFn, load } = setup()
    evalFn.mockResolvedValue(1)
    getFn.mockResolvedValue(null)
    // Pin a non-zero start so the elapsed window is the DIFFERENCE (1400 − 1000 = 400),
    // not the sum — a `finishedAt - startedAt` → `+` mutant would report 2400.
    jest.setSystemTime(1_000)

    const promise = service.run(singleBurst(2000))
    await jest.advanceTimersByTimeAsync(ORIGIN_LATENCY_MS)
    const result = await promise

    expect(result.timeline).toHaveLength(1)
    expect(result.timeline[0]).toMatchObject({
      index: 0,
      role: 'won',
      outcome: 'origin',
      startedAt: 1_000,
      finishedAt: 1_400,
      durationMs: 400,
    })
    expect(result.summary).toEqual({
      concurrency: 1,
      originFetches: 1,
      cacheHits: 0,
      hitRate: 0,
    })
    expect(result.script).toEqual({ name: ACQUIRE_LOCK, sha: SHA })
    expect(setFn).toHaveBeenCalledWith('product', 'p1', PRODUCT, TTL)
    expect(load).toHaveBeenCalledWith(ACQUIRE_LOCK)
    // Acquire eval passes the namespaced lock KEY and the [token, lockMs] ARGV verbatim.
    expect(evalFn).toHaveBeenCalledWith(ACQUIRE_LOCK, ['stampede:p1'], [expect.any(String), 2000])
    // Released token-safely after populating.
    expect(evalFn).toHaveBeenCalledWith(RELEASE_LOCK, ['stampede:p1'], [expect.any(String)])
  })

  it('the lock winner that finds the value already populated skips the origin', async () => {
    /*
     * Scenario: eval wins the lock (1) but a prior holder already cached the value.
     * Rule it protects: the winner re-checks the cache, finds a hit, releases the lock
     * WITHOUT a redundant origin fetch, and is recorded as role=waited / outcome=hit.
     */
    const { service, evalFn, getFn, setFn } = setup()
    evalFn.mockResolvedValue(1)
    getFn.mockResolvedValue(PRODUCT)

    const result = await service.run(singleBurst(2000))

    expect(result.timeline[0]).toMatchObject({ role: 'waited', outcome: 'hit' })
    expect(result.summary).toMatchObject({ originFetches: 0, cacheHits: 1, hitRate: 1 })
    expect(setFn).not.toHaveBeenCalled()
    expect(evalFn).toHaveBeenCalledWith(RELEASE_LOCK, ['stampede:p1'], [expect.any(String)])
  })

  it('a loser that finds the value on its first read is a cache hit', async () => {
    /*
     * Scenario: eval loses the lock (0) and the value is already cached.
     * Rule it protects: a loser reads the value the holder populated and returns a hit
     * immediately — no origin fetch, no polling.
     */
    const { service, evalFn, getFn, setFn } = setup()
    evalFn.mockResolvedValue(0)
    getFn.mockResolvedValue(PRODUCT)

    const result = await service.run(singleBurst(2000))

    expect(result.timeline[0]).toMatchObject({ role: 'waited', outcome: 'hit' })
    expect(result.summary).toMatchObject({ originFetches: 0, cacheHits: 1 })
    expect(setFn).not.toHaveBeenCalled()
  })

  it('a loser polls at the fixed interval until the value lands', async () => {
    /*
     * Scenario: eval loses the lock (0); the cache is empty on the first read, then a
     * hit after one poll interval.
     * Rule it protects: a loser whose first read misses sleeps POLL_INTERVAL_MS and
     * re-reads, collapsing into a hit instead of fetching the origin.
     */
    const { service, evalFn, getFn, setFn } = setup()
    evalFn.mockResolvedValue(0)
    getFn.mockResolvedValueOnce(null).mockResolvedValueOnce(PRODUCT)

    const promise = service.run(singleBurst(2000))
    await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    const result = await promise

    expect(result.timeline[0]).toMatchObject({ role: 'waited', outcome: 'hit' })
    expect(result.summary).toMatchObject({ originFetches: 0, cacheHits: 1 })
    expect(setFn).not.toHaveBeenCalled()
  })

  it('computes the hit rate as cacheHits over concurrency for a multi-contender burst', async () => {
    /*
     * Scenario: two contenders both lose the lock and both read the value immediately.
     * Rule it protects: the summary hitRate is `cacheHits / concurrency` (2 / 2 = 1) —
     * a `*` mutant would report 4. A concurrency greater than one is required to tell
     * `/` apart from `*` (they coincide at concurrency 1).
     */
    const { service, evalFn, getFn } = setup()
    evalFn.mockResolvedValue(0)
    getFn.mockResolvedValue(PRODUCT)

    const result = await service.run({ productId: 'p1', concurrency: 2, lockMs: 2000 })

    expect(result.summary).toEqual({
      concurrency: 2,
      originFetches: 0,
      cacheHits: 2,
      hitRate: 1,
    })
  })

  it('keeps polling until a late value lands — an early break would miss it', async () => {
    /*
     * Scenario: a loser misses the first read and the first poll, then the value lands
     * on the second poll, all inside the lock window (lockMs=100).
     * Rule it protects: the loop polls until `Date.now() >= deadline` where
     * `deadline = Date.now() + lockMs`. A `-` mutant on the deadline (past deadline) or
     * a `=> true` mutant on the break guard would break on the first iteration and fall
     * through to a direct origin fetch — so asserting a HIT (not an origin) pins both.
     */
    const { service, evalFn, getFn, setFn } = setup()
    evalFn.mockResolvedValue(0)
    getFn
      .mockResolvedValueOnce(null) // first read: miss
      .mockResolvedValueOnce(null) // first poll: still missing
      .mockResolvedValueOnce(PRODUCT) // second poll: value landed

    const promise = service.run(singleBurst(100))
    await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2)
    const result = await promise

    expect(result.timeline[0]).toMatchObject({ role: 'waited', outcome: 'hit' })
    expect(result.summary).toMatchObject({ originFetches: 0, cacheHits: 1 })
    expect(setFn).not.toHaveBeenCalled()
  })

  it('a bounded-out loser returns a hit if the final read lands', async () => {
    /*
     * Scenario: eval loses the lock (0), the wait window (lockMs=0) elapses on the
     * first check, but the final read finds the value.
     * Rule it protects: once the deadline passes the loop breaks and does one last
     * read; a hit there is returned without a direct origin fetch.
     */
    const { service, evalFn, getFn, setFn } = setup()
    evalFn.mockResolvedValue(0)
    getFn.mockResolvedValueOnce(null).mockResolvedValueOnce(PRODUCT)

    const result = await service.run(singleBurst(0))

    expect(result.timeline[0]).toMatchObject({ role: 'waited', outcome: 'hit' })
    expect(result.summary).toMatchObject({ originFetches: 0, cacheHits: 1 })
    expect(setFn).not.toHaveBeenCalled()
  })

  it('a bounded-out loser fetches the origin directly when the cache stays empty', async () => {
    /*
     * Scenario: eval loses the lock (0), the window (lockMs=0) elapses, and the cache
     * is still empty on the final read.
     * Rule it protects: a contender whose bounded wait expires fetches the origin once
     * itself (role=waited / outcome=origin) so the request never hangs or 404s.
     */
    const { service, evalFn, getFn, setFn } = setup()
    evalFn.mockResolvedValue(0)
    getFn.mockResolvedValue(null)

    const promise = service.run(singleBurst(0))
    await jest.advanceTimersByTimeAsync(ORIGIN_LATENCY_MS)
    const result = await promise

    expect(result.timeline[0]).toMatchObject({ role: 'waited', outcome: 'origin' })
    expect(result.summary).toMatchObject({ originFetches: 1, cacheHits: 0 })
    // The bounded path never writes the cache — only the winner populates it.
    expect(setFn).not.toHaveBeenCalled()
  })

  it('swallows and logs an Error from the best-effort lock release', async () => {
    /*
     * Scenario: the winner populates the cache but releaseLock rejects with an Error.
     * Rule it protects: the release runs in `finally` and its failure is caught/warned
     * (the `instanceof Error` arm) — it never masks the successful fetch/set outcome.
     */
    const { service, evalFn, getFn } = setup()
    // A winner makes exactly two eval calls in order: acquire (won = 1), then release.
    evalFn.mockResolvedValueOnce(1).mockRejectedValueOnce(new Error('release boom'))
    getFn.mockResolvedValue(null)
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)

    const promise = service.run(singleBurst(2000))
    await jest.advanceTimersByTimeAsync(ORIGIN_LATENCY_MS)
    const result = await promise

    expect(result.timeline[0]).toMatchObject({ role: 'won', outcome: 'origin' })
    expect(evalFn).toHaveBeenNthCalledWith(2, RELEASE_LOCK, ['stampede:p1'], [expect.any(String)])
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('release boom'))
  })

  it('stringifies a non-Error from the best-effort lock release', async () => {
    /*
     * Scenario: releaseLock rejects with a non-Error value after a successful populate.
     * Rule it protects: the catch's `String(err)` arm handles a non-Error rejection so
     * the warning never assumes an Error shape and the winner result stands.
     */
    const { service, evalFn, getFn } = setup()
    // Acquire wins (1); the second eval (release) rejects with a non-Error value.
    evalFn.mockResolvedValueOnce(1).mockRejectedValueOnce('release string')
    getFn.mockResolvedValue(null)
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)

    const promise = service.run(singleBurst(2000))
    await jest.advanceTimersByTimeAsync(ORIGIN_LATENCY_MS)
    const result = await promise

    expect(result.timeline[0]).toMatchObject({ role: 'won', outcome: 'origin' })
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('release string'))
  })
})
