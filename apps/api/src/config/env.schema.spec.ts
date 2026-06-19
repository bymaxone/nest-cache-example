/**
 * Unit specs for the environment schema and bootstrap validator.
 *
 * Covers the default-fill path, the deliberately coercion-free
 * `ALLOW_FLUSH_IN_PRODUCTION` transform (every operand of its `||` chain), and
 * both arms of `validateEnv` (success returns typed data; failure throws a
 * readable aggregated error).
 *
 * @module config/env.schema.spec
 */
import { envSchema, validateEnv } from './env.schema.js'

describe('envSchema defaults', () => {
  it('fills every default when the input is empty', () => {
    /*
     * Scenario: parse an empty object.
     * Rule it protects: each declared `.default(...)` is applied so the standalone
     * path never requires any env var, and the optional REDIS_PASSWORD stays absent.
     */
    const env = envSchema.parse({})

    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3001,
      WEB_ORIGIN: 'http://localhost:3000',
      REDIS_URL: 'redis://localhost:6379',
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6379,
      REDIS_DB: 0,
      CACHE_MODE: 'standalone',
      REDIS_SENTINEL_MASTER: 'mymaster',
      REDIS_SENTINEL_ROLE: 'master',
      REDIS_SENTINEL_NAT_MAP: '',
      REDIS_CLUSTER_NAT_MAP: '',
      CACHE_NAMESPACE: 'cache-example',
      CACHE_KEY_SEPARATOR: ':',
      CACHE_DEFAULT_TTL: 60,
      CACHE_SERIALIZER: 'json',
      ALLOW_FLUSH_IN_PRODUCTION: false,
      SHUTDOWN_TIMEOUT_MS: 5000,
    })
    expect(env.REDIS_PASSWORD).toBeUndefined()
  })

  it('coerces numeric string env values to numbers', () => {
    /*
     * Scenario: PORT/REDIS_PORT/REDIS_DB arrive as strings (as real env always does).
     * Rule it protects: the `z.coerce.number()` declarations narrow the string env
     * to a number, so downstream consumers receive numeric types.
     */
    const env = envSchema.parse({ PORT: '8080', REDIS_PORT: '6380', REDIS_DB: '2' })

    expect(env.PORT).toBe(8080)
    expect(env.REDIS_PORT).toBe(6380)
    expect(env.REDIS_DB).toBe(2)
  })
})

describe('ALLOW_FLUSH_IN_PRODUCTION transform', () => {
  it('treats boolean true as enabled (first operand)', () => {
    /*
     * Scenario: the flag is the real boolean `true`.
     * Rule it protects: the transform's `value === true` operand enables flushing.
     */
    expect(envSchema.parse({ ALLOW_FLUSH_IN_PRODUCTION: true }).ALLOW_FLUSH_IN_PRODUCTION).toBe(
      true,
    )
  })

  it("treats the string 'true' as enabled (second operand)", () => {
    /*
     * Scenario: the flag is the string 'true'.
     * Rule it protects: the `value === 'true'` operand enables flushing for the
     * common string env form.
     */
    expect(envSchema.parse({ ALLOW_FLUSH_IN_PRODUCTION: 'true' }).ALLOW_FLUSH_IN_PRODUCTION).toBe(
      true,
    )
  })

  it("treats the string '1' as enabled (third operand)", () => {
    /*
     * Scenario: the flag is the string '1'.
     * Rule it protects: the `value === '1'` operand enables flushing.
     */
    expect(envSchema.parse({ ALLOW_FLUSH_IN_PRODUCTION: '1' }).ALLOW_FLUSH_IN_PRODUCTION).toBe(true)
  })

  it("treats the string 'false' as DISABLED (no coercion trap)", () => {
    /*
     * Scenario: the flag is the string 'false'.
     * Rule it protects: this is WHY the field avoids `z.coerce.boolean()` —
     * `Boolean('false') === true` would silently disable the production guard.
     * All three operands are false, so the safety flag stays off.
     */
    expect(envSchema.parse({ ALLOW_FLUSH_IN_PRODUCTION: 'false' }).ALLOW_FLUSH_IN_PRODUCTION).toBe(
      false,
    )
  })
})

describe('validateEnv', () => {
  it('returns the parsed typed env on valid input', () => {
    /*
     * Scenario: a valid raw config record.
     * Rule it protects: the success arm returns `parsed.data` (typed Env), the
     * value ConfigModule.forRoot stores after validation.
     */
    const env = validateEnv({ NODE_ENV: 'production', PORT: '4000' })

    expect(env.NODE_ENV).toBe('production')
    expect(env.PORT).toBe(4000)
  })

  it('throws a readable aggregated error on invalid input', () => {
    /*
     * Scenario: WEB_ORIGIN is not a URL and PORT is non-numeric.
     * Rule it protects: the failure arm throws a single Error whose message embeds
     * the flattened field errors, so a boot misconfig is human-debuggable.
     */
    expect(() => validateEnv({ WEB_ORIGIN: 'not-a-url', PORT: 'abc' })).toThrow(
      /Invalid environment:/,
    )
    expect(() => validateEnv({ WEB_ORIGIN: 'not-a-url' })).toThrow(/WEB_ORIGIN/)
  })
})
