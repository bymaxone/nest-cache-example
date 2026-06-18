/**
 * `CacheException` error-surface E2E (real Redis via Testcontainers).
 *
 * Sweeps every one of the 15 canonical `CACHE_ERROR_CODES` through the production
 * `ErrorsDemoService` and asserts each raises a `CacheException` carrying the
 * matching code, the canonical message, the structured `{ error: { code, message,
 * details } }` body, and the canonical HTTP status. The sweep is driven from the
 * library constant — not hard-coded literals — so a new library code that lacks a
 * trigger or status mapping fails the suite instead of slipping past.
 *
 * @module test/errors.e2e-spec
 */
import { HttpStatus } from '@nestjs/common'
import { CacheException, CACHE_ERROR_MESSAGES } from '@bymax-one/nest-cache'
import { CACHE_ERROR_CODES, type CacheErrorCode } from '@bymax-one/nest-cache/shared'
import type { StartedRedisContainer } from '@testcontainers/redis'
import { startRedisContainer } from './helpers/redis-container.js'
import { createTestApp, type TestApiApp } from './helpers/test-app.js'
import { ErrorsDemoService } from '../src/errors-demo/errors-demo.service.js'

/** Every canonical error code, sourced from the library (never hand-listed). */
const ALL_CODES = Object.values(CACHE_ERROR_CODES)

/** The expected count — a guard so a new library code can't silently slip past. */
const EXPECTED_CODE_COUNT = 15

/**
 * Canonical code→HTTP-status contract (TECHNICAL_SPECIFICATION.md §12.2). Keyed by
 * `CacheErrorCode`, so the compiler rejects this file if the library adds a code
 * without a mapping here — keeping the sweep honest as the package evolves.
 */
const EXPECTED_STATUS: Record<CacheErrorCode, number> = {
  [CACHE_ERROR_CODES.CONNECTION_FAILED]: HttpStatus.INTERNAL_SERVER_ERROR,
  [CACHE_ERROR_CODES.COMMAND_TIMEOUT]: HttpStatus.GATEWAY_TIMEOUT,
  [CACHE_ERROR_CODES.CONNECTION_LOST]: HttpStatus.SERVICE_UNAVAILABLE,
  [CACHE_ERROR_CODES.SERIALIZATION_FAILED]: HttpStatus.INTERNAL_SERVER_ERROR,
  [CACHE_ERROR_CODES.DESERIALIZATION_FAILED]: HttpStatus.INTERNAL_SERVER_ERROR,
  [CACHE_ERROR_CODES.INVALID_NAMESPACE]: HttpStatus.INTERNAL_SERVER_ERROR,
  [CACHE_ERROR_CODES.INVALID_KEY]: HttpStatus.BAD_REQUEST,
  [CACHE_ERROR_CODES.SCRIPT_NOT_REGISTERED]: HttpStatus.INTERNAL_SERVER_ERROR,
  [CACHE_ERROR_CODES.SCRIPT_EXECUTION_FAILED]: HttpStatus.INTERNAL_SERVER_ERROR,
  [CACHE_ERROR_CODES.SCRIPT_REGISTRY_MISSING]: HttpStatus.INTERNAL_SERVER_ERROR,
  [CACHE_ERROR_CODES.FLUSH_DISABLED_IN_PRODUCTION]: HttpStatus.FORBIDDEN,
  [CACHE_ERROR_CODES.CLUSTER_MISCONFIGURED]: HttpStatus.INTERNAL_SERVER_ERROR,
  [CACHE_ERROR_CODES.SENTINEL_MISCONFIGURED]: HttpStatus.INTERNAL_SERVER_ERROR,
  [CACHE_ERROR_CODES.SHUTDOWN_TIMEOUT]: HttpStatus.INTERNAL_SERVER_ERROR,
  [CACHE_ERROR_CODES.UNSUPPORTED_IN_CLUSTER]: HttpStatus.INTERNAL_SERVER_ERROR,
}

describe('CacheException error surface (real Redis)', () => {
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

  it('exposes exactly the expected number of canonical error codes', () => {
    /*
     * Scenario: the library's error-code set is a public contract.
     * Rule it protects: the count is pinned, so adding or removing a code is a
     * deliberate, visible change rather than an accidental drift the sweep misses.
     */
    expect(ALL_CODES).toHaveLength(EXPECTED_CODE_COUNT)
  })

  it.each(ALL_CODES)(
    'surfaces %s with its code, canonical message, structured body, and HTTP status',
    async (code) => {
      /*
       * Scenario: every documented failure mode is provoked through the real API.
       * Rule it protects: each code maps to exactly one CacheException whose code,
       * canonical message, structured { error: { code, message, details } } body,
       * and HTTP status match the published contract — the guarantee consumers
       * switch on. Driving the sweep from CACHE_ERROR_CODES ties it to the package.
       */
      const errors = api.app.get(ErrorsDemoService)

      let thrown: unknown
      try {
        await errors.trigger(code)
      } catch (err) {
        thrown = err
      }

      // Narrow with a real guard (not a cast) so a wrong/absent throw fails here
      // with a clear message instead of a cryptic TypeError further down.
      if (!(thrown instanceof CacheException)) {
        throw new Error(`Expected a CacheException for ${code}, got: ${String(thrown)}`)
      }
      expect(thrown.code).toBe(code)
      expect(thrown.getStatus()).toBe(EXPECTED_STATUS[code])
      // The structured { error: { code, message, details } } body carries the contract.
      expect(thrown.getResponse()).toMatchObject({
        error: { code, message: CACHE_ERROR_MESSAGES.get(code) },
      })
    },
  )
})
