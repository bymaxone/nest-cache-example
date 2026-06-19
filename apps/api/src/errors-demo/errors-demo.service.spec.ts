/**
 * Unit: ErrorsDemoService — provokes every canonical CacheException on demand.
 *
 * Constructs the service directly with a hand-mocked `CacheService` (whose
 * methods are stubbed to reject with the same `CacheException` the real library
 * would raise) and a real `ConfigService` over an in-memory env. Covers all 15
 * trigger-table entries: the request-reachable codes driven through the library
 * API, the serializer/cluster config forks (both arms), the boot/topology-only
 * codes thrown as tagged simulations, and the fail-closed `trigger()` throw when
 * a real-library call unexpectedly resolves.
 *
 * @module errors-demo/errors-demo.service.spec
 */
import { jest } from '@jest/globals'
import { ConfigService } from '@nestjs/config'
import type { Redis } from 'ioredis'
import { CacheException } from '@bymax-one/nest-cache'
import type { CacheService } from '@bymax-one/nest-cache'
import { CACHE_ERROR_CODES, type CacheErrorCode } from '@bymax-one/nest-cache/shared'
import type { Env } from '../config/env.schema.js'
import { ErrorsDemoService } from './errors-demo.service.js'

/**
 * Narrows an unknown thrown value to a `CacheException` without a cast.
 *
 * @param err - The rejected value captured from `trigger()`.
 * @returns The same value, typed as `CacheException`.
 * @throws When `err` is not a `CacheException` (the assertion the test relies on).
 */
function asCacheException(err: unknown): CacheException {
  if (err instanceof CacheException) return err
  throw new Error(`expected a CacheException, got ${String(err)}`)
}

/**
 * Builds the service with controllable cache mocks and a config over the given env.
 *
 * @param env - Env overrides layered over the JSON/standalone defaults the service reads.
 * @returns The service plus every inner cache mock for stubbing and assertions.
 */
function setup(env: Partial<Env> = {}) {
  const getInner = jest.fn<(prefix: string, id: string) => Promise<unknown>>()
  const setInner =
    jest.fn<(prefix: string, id: string, value: unknown, ttl?: number) => Promise<void>>()
  const setRaw = jest.fn<CacheService['setRaw']>()
  const evalFn = jest.fn<CacheService['eval']>()
  const getClient = jest.fn<() => Redis>()

  const cacheMock: Partial<CacheService> = {
    get: <T>(prefix: string, id: string): Promise<T | null> =>
      getInner(prefix, id) as Promise<T | null>,
    set: <T>(prefix: string, id: string, value: T, ttl?: number): Promise<void> =>
      setInner(prefix, id, value, ttl),
    setRaw,
    eval: evalFn,
    getClient,
  }

  const config = new ConfigService<Env, true>({
    CACHE_SERIALIZER: 'json',
    CACHE_MODE: 'standalone',
    ...env,
  })

  const service = new ErrorsDemoService(cacheMock as CacheService, config)
  return { service, getInner, setInner, setRaw, evalFn, getClient }
}

/** Codes that can only arise from boot/topology/shutdown/env state — thrown as tagged sims. */
const SIMULATED_ONLY_CODES: readonly CacheErrorCode[] = [
  CACHE_ERROR_CODES.CONNECTION_FAILED,
  CACHE_ERROR_CODES.COMMAND_TIMEOUT,
  CACHE_ERROR_CODES.CONNECTION_LOST,
  CACHE_ERROR_CODES.INVALID_NAMESPACE,
  CACHE_ERROR_CODES.SCRIPT_REGISTRY_MISSING,
  CACHE_ERROR_CODES.CLUSTER_MISCONFIGURED,
  CACHE_ERROR_CODES.SENTINEL_MISCONFIGURED,
  CACHE_ERROR_CODES.SHUTDOWN_TIMEOUT,
  CACHE_ERROR_CODES.FLUSH_DISABLED_IN_PRODUCTION,
]

describe('ErrorsDemoService (unit)', () => {
  it('throws a tagged simulation for every boot/topology/shutdown/env-only code', async () => {
    /*
     * Scenario: each code that no request can raise against a healthy standalone
     * deployment is requested in turn.
     * Rule it protects: `simulate()` throws the exact `CacheException` for that
     * code with `details.simulated === true`, never touching the cache.
     */
    for (const code of SIMULATED_ONLY_CODES) {
      const { service } = setup()
      const err = await service.trigger(code).catch((e: unknown) => e)
      const ex = asCacheException(err)
      expect(ex.code).toBe(code)
      expect(ex.details).toMatchObject({ simulated: true })
    }
  })

  it('drives INVALID_KEY through the real library API (empty prefix rejects)', async () => {
    /*
     * Scenario: the empty-prefix `get('', 'demo')` is the request-reachable surface.
     * Rule it protects: the library's own `CacheException(INVALID_KEY)` bubbles out
     * unchanged — the demo does not re-wrap it.
     */
    const { service, getInner } = setup()
    getInner.mockRejectedValue(new CacheException(CACHE_ERROR_CODES.INVALID_KEY))

    const err = await service.trigger(CACHE_ERROR_CODES.INVALID_KEY).catch((e: unknown) => e)
    expect(asCacheException(err).code).toBe(CACHE_ERROR_CODES.INVALID_KEY)
    expect(getInner).toHaveBeenCalledWith('', 'demo')
  })

  it('fails closed when a real-library trigger unexpectedly resolves', async () => {
    /*
     * Scenario: a request-reachable trigger (INVALID_KEY) returns normally instead
     * of throwing.
     * Rule it protects: `trigger()` never returns — it forces the requested code
     * with the `trigger did not raise; forced` note so the always-error contract holds.
     */
    const { service, getInner } = setup()
    getInner.mockResolvedValue(null)

    const err = await service.trigger(CACHE_ERROR_CODES.INVALID_KEY).catch((e: unknown) => e)
    const ex = asCacheException(err)
    expect(ex.code).toBe(CACHE_ERROR_CODES.INVALID_KEY)
    expect(ex.details).toMatchObject({ simulated: true, note: 'trigger did not raise; forced' })
  })

  it('drives SERIALIZATION_FAILED through the JSON serializer set call', async () => {
    /*
     * Scenario: the default JSON codec rejects a BigInt-bearing value.
     * Rule it protects: under `CACHE_SERIALIZER=json` the real `set` is exercised
     * and its `CacheException(SERIALIZATION_FAILED)` surfaces.
     */
    const { service, setInner } = setup({ CACHE_SERIALIZER: 'json' })
    setInner.mockRejectedValue(new CacheException(CACHE_ERROR_CODES.SERIALIZATION_FAILED))

    const err = await service
      .trigger(CACHE_ERROR_CODES.SERIALIZATION_FAILED)
      .catch((e: unknown) => e)
    expect(asCacheException(err).code).toBe(CACHE_ERROR_CODES.SERIALIZATION_FAILED)
    expect(setInner).toHaveBeenCalledWith(
      'errors-demo',
      'serialization',
      { amount: 10n },
      undefined,
    )
  })

  it('simulates SERIALIZATION_FAILED for a non-JSON serializer without calling set', async () => {
    /*
     * Scenario: a non-default codec is configured, so the real BigInt path is not honest.
     * Rule it protects: the `CACHE_SERIALIZER !== 'json'` arm throws a tagged
     * simulation directly and never invokes `set`.
     */
    const { service, setInner } = setup({ CACHE_SERIALIZER: 'msgpack' })

    const err = await service
      .trigger(CACHE_ERROR_CODES.SERIALIZATION_FAILED)
      .catch((e: unknown) => e)
    const ex = asCacheException(err)
    expect(ex.code).toBe(CACHE_ERROR_CODES.SERIALIZATION_FAILED)
    expect(ex.details).toMatchObject({ simulated: true })
    expect(setInner).not.toHaveBeenCalled()
  })

  it('drives DESERIALIZATION_FAILED by writing a corrupt payload then reading it back', async () => {
    /*
     * Scenario: a deliberately corrupt raw value is stored, then read through the codec.
     * Rule it protects: `setRaw` writes the short-TTL corrupt key and the failing
     * `get` raises `CacheException(DESERIALIZATION_FAILED)`.
     */
    const { service, setRaw, getInner } = setup()
    setRaw.mockResolvedValue()
    getInner.mockRejectedValue(new CacheException(CACHE_ERROR_CODES.DESERIALIZATION_FAILED))

    const err = await service
      .trigger(CACHE_ERROR_CODES.DESERIALIZATION_FAILED)
      .catch((e: unknown) => e)
    expect(asCacheException(err).code).toBe(CACHE_ERROR_CODES.DESERIALIZATION_FAILED)
    expect(setRaw).toHaveBeenCalledWith('errors-demo', 'deserialization', '%%not-valid-json%%', 60)
    expect(getInner).toHaveBeenCalledWith('errors-demo', 'deserialization')
  })

  it('drives SCRIPT_NOT_REGISTERED by eval of an unregistered script name', async () => {
    /*
     * Scenario: `eval` is asked for a name that was never registered.
     * Rule it protects: the library raises `CacheException(SCRIPT_NOT_REGISTERED)`
     * and the demo forwards the exact key/arg shape.
     */
    const { service, evalFn } = setup()
    evalFn.mockRejectedValue(new CacheException(CACHE_ERROR_CODES.SCRIPT_NOT_REGISTERED))

    const err = await service
      .trigger(CACHE_ERROR_CODES.SCRIPT_NOT_REGISTERED)
      .catch((e: unknown) => e)
    expect(asCacheException(err).code).toBe(CACHE_ERROR_CODES.SCRIPT_NOT_REGISTERED)
    expect(evalFn).toHaveBeenCalledWith('__unregistered_script__', ['errors-demo'], [])
  })

  it('drives SCRIPT_EXECUTION_FAILED by eval of acquireLock with a bad PX argument', async () => {
    /*
     * Scenario: a registered script is handed a non-numeric PX argument.
     * Rule it protects: Redis raises a Lua runtime error surfaced as
     * `CacheException(SCRIPT_EXECUTION_FAILED)` with the documented key/arg shape.
     */
    const { service, evalFn } = setup()
    evalFn.mockRejectedValue(new CacheException(CACHE_ERROR_CODES.SCRIPT_EXECUTION_FAILED))

    const err = await service
      .trigger(CACHE_ERROR_CODES.SCRIPT_EXECUTION_FAILED)
      .catch((e: unknown) => e)
    expect(asCacheException(err).code).toBe(CACHE_ERROR_CODES.SCRIPT_EXECUTION_FAILED)
    expect(evalFn).toHaveBeenCalledWith(
      'acquireLock',
      ['errors-demo:lock'],
      ['token', 'not-a-number'],
    )
  })

  it('drives UNSUPPORTED_IN_CLUSTER through the raw-client guard in cluster mode', async () => {
    /*
     * Scenario: in cluster mode the raw-client escape hatch is rejected synchronously.
     * Rule it protects: the `CACHE_MODE === 'cluster'` arm calls `getClient()`,
     * which throws `CacheException(UNSUPPORTED_IN_CLUSTER)`.
     */
    const { service, getClient } = setup({ CACHE_MODE: 'cluster' })
    getClient.mockImplementation(() => {
      throw new CacheException(CACHE_ERROR_CODES.UNSUPPORTED_IN_CLUSTER)
    })

    const err = await service
      .trigger(CACHE_ERROR_CODES.UNSUPPORTED_IN_CLUSTER)
      .catch((e: unknown) => e)
    expect(asCacheException(err).code).toBe(CACHE_ERROR_CODES.UNSUPPORTED_IN_CLUSTER)
    expect(getClient).toHaveBeenCalledTimes(1)
  })

  it('simulates UNSUPPORTED_IN_CLUSTER outside cluster mode without calling getClient', async () => {
    /*
     * Scenario: standalone mode, where the restricted methods do not throw.
     * Rule it protects: the non-cluster arm falls through to a tagged simulation
     * and never touches the raw client.
     */
    const { service, getClient } = setup({ CACHE_MODE: 'standalone' })

    const err = await service
      .trigger(CACHE_ERROR_CODES.UNSUPPORTED_IN_CLUSTER)
      .catch((e: unknown) => e)
    const ex = asCacheException(err)
    expect(ex.code).toBe(CACHE_ERROR_CODES.UNSUPPORTED_IN_CLUSTER)
    expect(ex.details).toMatchObject({ simulated: true })
    expect(getClient).not.toHaveBeenCalled()
  })
})
