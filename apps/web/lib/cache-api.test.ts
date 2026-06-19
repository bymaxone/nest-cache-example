/**
 * @fileoverview Unit tests for the typed Cache Admin / Tenants endpoint surface
 * (`lib/cache-api`).
 *
 * The transport (`api.get/post/del`) is mocked, so each typed endpoint is asserted
 * purely by the verb + path/query it builds and the result it threads back.
 * Covers the `keyListQuery` builder across every populated and omitted param, the
 * `encodeKey` percent-encoding of namespaced keys, the conditional `getInfo`
 * section query, and the `unwrap` / {@link ApiRequestError} helper on both the ok
 * and error branches.
 *
 * @module lib/cache-api.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { type ApiError, type ApiResult } from './api-client'

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

const { cacheApi, tenantsApi, unwrap, ApiRequestError } = await import('./cache-api')

const okResult: ApiResult<unknown> = { ok: true, data: {} }

beforeEach(() => {
  get.mockReset().mockReturnValue(okResult)
  post.mockReset().mockReturnValue(okResult)
  del.mockReset().mockReturnValue(okResult)
})

describe('unwrap / ApiRequestError', () => {
  it('returns the data on an ok result', () => {
    /*
     * Scenario: a write hook unwraps a successful transport result.
     * Rule it protects: `unwrap` returns the payload unchanged on `ok: true`.
     */
    expect(unwrap({ ok: true, data: 42 })).toBe(42)
  })

  it('throws an ApiRequestError carrying the decoded error on a failure result', () => {
    /*
     * Scenario: a structured API error reaches a mutation's unwrap.
     * Rule it protects: `unwrap` throws an `ApiRequestError` whose `.apiError`
     * preserves the original code/message/status for severity-aware toasts.
     */
    const error: ApiError = { code: 'cache.invalid_key', message: 'nope', status: 400 }
    try {
      unwrap({ ok: false, error })
      expect.unreachable('unwrap should have thrown')
    } catch (caught) {
      expect(caught).toBeInstanceOf(ApiRequestError)
      const err = caught as InstanceType<typeof ApiRequestError>
      expect(err.message).toBe('nope')
      expect(err.name).toBe('ApiRequestError')
      expect(err.apiError).toBe(error)
    }
  })
})

describe('keyListQuery via listKeys', () => {
  it('omits the query string entirely when no filter params are set', () => {
    /*
     * Scenario: an unfiltered key listing.
     * Rule it protects: with only the default-falsey params, `keyListQuery` yields
     * an empty string so the path is bare `/admin/keys`.
     */
    void cacheApi.listKeys({})
    expect(get).toHaveBeenCalledWith('/admin/keys')
  })

  it('encodes every populated filter param into the query string', () => {
    /*
     * Scenario: a fully-specified Explorer filter.
     * Rule it protects: each truthy param (and `hasTtl=true` / numeric `limit`) is
     * serialized into the SCAN query string.
     */
    void cacheApi.listKeys({
      prefix: 'product',
      pattern: '4*',
      tenant: 'acme',
      type: 'hash',
      hasTtl: true,
      strategy: 'keys',
      cursor: 'c1',
      limit: 50,
    })
    const path = get.mock.calls[0]?.[0] as string
    expect(path).toContain('prefix=product')
    expect(path).toContain('pattern=4')
    expect(path).toContain('tenant=acme')
    expect(path).toContain('type=hash')
    expect(path).toContain('hasTtl=true')
    expect(path).toContain('strategy=keys')
    expect(path).toContain('cursor=c1')
    expect(path).toContain('limit=50')
  })

  it('serializes a zero limit (explicitly set) but omits hasTtl when false', () => {
    /*
     * Scenario: a caller passes `limit: 0` and `hasTtl: false`.
     * Rule it protects: `limit` is gated on `!== undefined` (so 0 is sent), while
     * `hasTtl` is gated on truthiness (so false is omitted) — distinct guards.
     */
    void cacheApi.listKeys({ limit: 0, hasTtl: false })
    const path = get.mock.calls[0]?.[0] as string
    expect(path).toContain('limit=0')
    expect(path).not.toContain('hasTtl')
  })
})

describe('single-key endpoints encode the key', () => {
  it('inspectKey percent-encodes the namespaced key into the path', () => {
    /*
     * Scenario: inspecting a colon-delimited namespaced key.
     * Rule it protects: `encodeKey` escapes the `:` to `%3A` so the colon survives
     * the route to the controller.
     */
    void cacheApi.inspectKey('cache-example:product:42')
    expect(get).toHaveBeenCalledWith('/admin/keys/cache-example%3Aproduct%3A42')
  })

  it('deleteKey targets the DELETE verb on the encoded key', () => {
    /*
     * Scenario: deleting one key.
     * Rule it protects: `deleteKey` uses DELETE on the encoded key path.
     */
    void cacheApi.deleteKey('cache-example:k')
    expect(del).toHaveBeenCalledWith('/admin/keys/cache-example%3Ak')
  })

  it('persistKey posts to the persist sub-path', () => {
    /*
     * Scenario: making a key persistent.
     * Rule it protects: `persistKey` POSTs to `/persist` under the encoded key.
     */
    void cacheApi.persistKey('cache-example:k')
    expect(post).toHaveBeenCalledWith('/admin/keys/cache-example%3Ak/persist')
  })

  it('expireKey posts the seconds body to the expire sub-path', () => {
    /*
     * Scenario: setting a new TTL on a key.
     * Rule it protects: `expireKey` POSTs `{ seconds }` to `/expire`.
     */
    void cacheApi.expireKey('cache-example:k', 30)
    expect(post).toHaveBeenCalledWith('/admin/keys/cache-example%3Ak/expire', { seconds: 30 })
  })
})

describe('admin bulk + info endpoints', () => {
  it('seed posts the count as a query param', () => {
    /*
     * Scenario: bulk-seeding demo keys.
     * Rule it protects: `seed` POSTs to `/admin/seed?count=N`.
     */
    void cacheApi.seed(25)
    expect(post).toHaveBeenCalledWith('/admin/seed?count=25')
  })

  it('flushNamespace deletes the whole namespace', () => {
    /*
     * Scenario: flushing the bound namespace.
     * Rule it protects: `flushNamespace` issues DELETE `/admin/namespace`.
     */
    void cacheApi.flushNamespace()
    expect(del).toHaveBeenCalledWith('/admin/namespace')
  })

  it('getInfo omits the section query when no section is given', () => {
    /*
     * Scenario: reading the default INFO set.
     * Rule it protects: without a section, the path is the bare `/admin/info`.
     */
    void cacheApi.getInfo()
    expect(get).toHaveBeenCalledWith('/admin/info')
  })

  it('getInfo encodes a provided section into the query', () => {
    /*
     * Scenario: reading one INFO section.
     * Rule it protects: a section is URL-encoded into `?section=...`.
     */
    void cacheApi.getInfo('memory')
    expect(get).toHaveBeenCalledWith('/admin/info?section=memory')
  })

  it('getKeyspace, getMetrics, and getHealth hit their fixed routes', () => {
    /*
     * Scenario: the Overview panels read keyspace, metrics, and health.
     * Rule it protects: each maps to its fixed GET route.
     */
    void cacheApi.getKeyspace()
    void cacheApi.getMetrics()
    void cacheApi.getHealth()
    expect(get).toHaveBeenNthCalledWith(1, '/admin/keyspace')
    expect(get).toHaveBeenNthCalledWith(2, '/metrics')
    expect(get).toHaveBeenNthCalledWith(3, '/health')
  })
})

describe('tenantsApi', () => {
  it('clearTenant deletes the tenant cache on the encoded tenant id', () => {
    /*
     * Scenario: clearing one tenant's keys.
     * Rule it protects: `clearTenant` DELETEs the encoded `/tenants/:t/cache` route.
     */
    void tenantsApi.clearTenant('ac me')
    expect(del).toHaveBeenCalledWith('/tenants/ac%20me/cache')
  })

  it('getProduct reads the tenant-scoped product through encoded segments', () => {
    /*
     * Scenario: a tenant-scoped read-through.
     * Rule it protects: both the tenant and product id are URL-encoded into the
     * path.
     */
    void tenantsApi.getProduct('acme', 'p/1')
    expect(get).toHaveBeenCalledWith('/tenants/acme/products/p%2F1')
  })

  it('seedForeign and proveIsolation hit their fixed POST routes', () => {
    /*
     * Scenario: the isolation-proof flow seeds a foreign key then proves survival.
     * Rule it protects: both endpoints POST to their fixed `/tenants/*` routes.
     */
    void tenantsApi.seedForeign()
    void tenantsApi.proveIsolation()
    expect(post).toHaveBeenNthCalledWith(1, '/tenants/seed-foreign')
    expect(post).toHaveBeenNthCalledWith(2, '/tenants/prove-isolation')
  })
})
