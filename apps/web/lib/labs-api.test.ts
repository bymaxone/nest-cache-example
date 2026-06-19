/**
 * @fileoverview Unit tests for the Labs endpoint surface (`lib/labs-api`):
 * Stampede, Serializer, and the Error Explorer.
 *
 * The transport is mocked, so each typed endpoint is asserted by the verb +
 * path/query it builds. Covers the `stampedeApi.run` query assembly, the
 * codec-encoded serializer routes (`roundtrip` with payload, `caveat`, `active`),
 * the `ERROR_CODES` catalog (sourced from CACHE_ERROR_CODES), and `errorsApi.trigger`
 * encoding the canonical code into the path.
 *
 * @module lib/labs-api.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const get = vi.fn()
const post = vi.fn()
const del = vi.fn()

vi.mock('./api-client', () => ({
  // Forward only the args actually passed (rest spread), so a bodyless verb call
  // records a single argument rather than a trailing `undefined`.
  api: {
    get: (...args: unknown[]): void => void get(...args),
    post: (...args: unknown[]): void => void post(...args),
    del: (...args: unknown[]): void => void del(...args),
  },
}))

const { stampedeApi, serializerApi, errorsApi, ERROR_CODES } = await import('./labs-api')

beforeEach(() => {
  get.mockReset()
  post.mockReset()
  del.mockReset()
})

describe('stampedeApi', () => {
  it('builds the burst query from productId, concurrency, and lockMs', () => {
    /*
     * Scenario: firing a single-flight burst.
     * Rule it protects: `run` POSTs to `/stampede` with the three params serialized
     * (numbers stringified) into the query string.
     */
    void stampedeApi.run({ productId: 'p1', concurrency: 8, lockMs: 500 })
    expect(post).toHaveBeenCalledWith('/stampede?productId=p1&concurrency=8&lockMs=500')
  })
})

describe('serializerApi', () => {
  it('roundtrip encodes the codec into the query and forwards the payload body', () => {
    /*
     * Scenario: round-tripping a payload through the active serializer.
     * Rule it protects: the codec is URL-encoded into `?codec=...` and the payload
     * object is the POST body.
     */
    void serializerApi.roundtrip('msgpack', { a: 1 })
    expect(post).toHaveBeenCalledWith('/serializer/roundtrip?codec=msgpack', { a: 1 })
  })

  it('caveat encodes the codec into the query with no body', () => {
    /*
     * Scenario: running the built-in Date caveat fixture.
     * Rule it protects: `caveat` POSTs to `/serializer/caveat?codec=...` with no
     * payload.
     */
    void serializerApi.caveat('json')
    expect(post).toHaveBeenCalledWith('/serializer/caveat?codec=json')
  })

  it('active reads the injected serializer class name', () => {
    /*
     * Scenario: reading the active serializer.
     * Rule it protects: `active` GETs the fixed `/serializer/active` route.
     */
    void serializerApi.active()
    expect(get).toHaveBeenCalledWith('/serializer/active')
  })
})

describe('ERROR_CODES catalog', () => {
  it('lists the canonical cache error codes', () => {
    /*
     * Scenario: the Error Explorer renders its trigger list.
     * Rule it protects: `ERROR_CODES` is the full CACHE_ERROR_CODES set, so it is
     * non-empty and includes a known code.
     */
    expect(ERROR_CODES.length).toBeGreaterThan(0)
    expect(ERROR_CODES).toContain('cache.invalid_key')
  })
})

describe('errorsApi', () => {
  it('trigger encodes the canonical code into the path', () => {
    /*
     * Scenario: deliberately triggering a cache exception.
     * Rule it protects: `trigger` POSTs to `/errors/:code` with the code
     * URL-encoded (the `.` stays, but encoding is applied).
     */
    void errorsApi.trigger('cache.invalid_key')
    expect(post).toHaveBeenCalledWith('/errors/cache.invalid_key')
  })
})
