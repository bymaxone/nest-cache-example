/**
 * Error-surface HTTP E2E (real Redis via Testcontainers).
 *
 * Drives `POST /errors/:code` over `supertest` and asserts the global
 * `CacheExceptionFilter` maps representative codes to their canonical HTTP status
 * (4xx / 503 / 504 / 5xx) and the `{ error: { code, message, details } }`
 * envelope, plus the `errorCodeParamSchema` behaviour: a `cache.`-prefixed code
 * normalizes identically, and an unknown code is rejected by the Zod pipe with
 * the distinct `validation_failed` envelope (never a 500). The service-level
 * full 15-code sweep lives in `errors.e2e-spec.ts`; here the HTTP filter mapping
 * is what is proven.
 *
 * @module test/errors-flow.e2e-spec
 */
import { CACHE_ERROR_MESSAGES } from '@bymax-one/nest-cache'
import { CACHE_ERROR_CODES, type CacheErrorCode } from '@bymax-one/nest-cache/shared'
import type { StartedRedisContainer } from '@testcontainers/redis'
import { startRedisContainer } from './helpers/redis-container.js'
import { createTestApp, type TestApiApp } from './helpers/test-app.js'
import { httpAgent } from './helpers/http.js'

/** Representative codes spanning the 4xx / 503 / 504 / 5xx status buckets. */
const REPRESENTATIVE_CASES: ReadonlyArray<{ param: string; code: CacheErrorCode; status: number }> =
  [
    { param: 'invalid_key', code: CACHE_ERROR_CODES.INVALID_KEY, status: 400 },
    {
      param: 'flush_disabled_in_production',
      code: CACHE_ERROR_CODES.FLUSH_DISABLED_IN_PRODUCTION,
      status: 403,
    },
    { param: 'connection_lost', code: CACHE_ERROR_CODES.CONNECTION_LOST, status: 503 },
    { param: 'command_timeout', code: CACHE_ERROR_CODES.COMMAND_TIMEOUT, status: 504 },
    { param: 'serialization_failed', code: CACHE_ERROR_CODES.SERIALIZATION_FAILED, status: 500 },
  ]

describe('errors-demo HTTP flow (real Redis)', () => {
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

  it.each(REPRESENTATIVE_CASES)(
    'POST /errors/$param maps to HTTP $status with the CacheException envelope',
    async ({ param, code, status }) => {
      /*
       * Scenario: each representative failure mode is provoked through the HTTP route.
       * Rule it protects: the global CacheExceptionFilter derives the HTTP status from
       * CacheException.getStatus() and serializes the canonical
       * { error: { code, message, details } } envelope — the contract every consumer
       * switches on, proven end to end over HTTP.
       */
      const response = await httpAgent(api.app).post(`/errors/${param}`)
      const errorBody = response.body.error as { code: unknown; message: unknown; details: unknown }

      expect(response.status).toBe(status)
      expect(errorBody.code).toBe(code)
      expect(errorBody.message).toBe(CACHE_ERROR_MESSAGES.get(code))
      // The envelope is exactly { code, message, details } — no more, no less.
      expect(Object.keys(errorBody).sort()).toEqual(['code', 'details', 'message'])
    },
  )

  it('normalizes a cache.-prefixed code and rejects an unknown code with validation_failed', async () => {
    /*
     * Scenario: an already-prefixed code and a typo code.
     * Rule it protects: `errorCodeParamSchema` accepts `cache.invalid_key` identically
     * to the bare suffix (same CacheException envelope), while an unknown code is
     * rejected by the Zod pipe with the distinct `validation_failed` envelope and a
     * 400 — it never falls through to a 500.
     */
    const prefixed = await httpAgent(api.app).post('/errors/cache.invalid_key')
    expect(prefixed.status).toBe(400)
    expect(prefixed.body.error.code).toBe(CACHE_ERROR_CODES.INVALID_KEY)

    const unknown = await httpAgent(api.app).post('/errors/not-a-real-code')
    expect(unknown.status).toBe(400)
    expect(unknown.body.error.code).toBe('validation_failed')
  })
})
