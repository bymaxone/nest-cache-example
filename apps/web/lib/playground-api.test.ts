/**
 * @fileoverview Unit tests for the Playground endpoint surface (`lib/playground-api`):
 * the catalog (string), counters (numeric), and collections (hash/set) groups.
 *
 * The transport is mocked, so each endpoint is asserted by the verb + path it
 * builds. Covers the `seg` per-segment encoding (ids/fields/tags are user-entered),
 * the comma-joined batch path, and the optional `by` step on the counter ops
 * (present → body, absent → undefined) — both branches of the `by !== undefined`
 * guard.
 *
 * @module lib/playground-api.test
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

const { catalogApi, countersApi, collectionsApi } = await import('./playground-api')

beforeEach(() => {
  get.mockReset()
  post.mockReset()
  del.mockReset()
})

describe('catalogApi', () => {
  it('get encodes the id segment', () => {
    /*
     * Scenario: a read-through fetch of a product whose id needs encoding.
     * Rule it protects: `seg` percent-encodes the id into the path.
     */
    void catalogApi.get('a b')
    expect(get).toHaveBeenCalledWith('/catalog/products/a%20b')
  })

  it('batchGet comma-joins encoded ids into the query', () => {
    /*
     * Scenario: a positional batch read-through.
     * Rule it protects: each id is encoded and the list is comma-joined into
     * `?ids=...`.
     */
    void catalogApi.batchGet(['x', 'y/z'])
    expect(get).toHaveBeenCalledWith('/catalog/products?ids=x,y%2Fz')
  })

  it('ttl reads the id-scoped ttl sub-path', () => {
    /*
     * Scenario: reading remaining TTL.
     * Rule it protects: `ttl` GETs the `/ttl` sub-path under the encoded id.
     */
    void catalogApi.ttl('p1')
    expect(get).toHaveBeenCalledWith('/catalog/products/p1/ttl')
  })

  it('seed posts the seed body to the id-scoped seed sub-path', () => {
    /*
     * Scenario: an idempotent product seed.
     * Rule it protects: `seed` POSTs the body to `/seed`.
     */
    void catalogApi.seed('p1', { name: 'Widget', priceCents: 999 })
    expect(post).toHaveBeenCalledWith('/catalog/products/p1/seed', {
      name: 'Widget',
      priceCents: 999,
    })
  })

  it('expire posts the ttlSeconds body and persist posts bodyless', () => {
    /*
     * Scenario: setting then removing a TTL.
     * Rule it protects: `expire` POSTs `{ ttlSeconds }`, `persist` POSTs with no
     * body.
     */
    void catalogApi.expire('p1', 60)
    void catalogApi.persist('p1')
    expect(post).toHaveBeenNthCalledWith(1, '/catalog/products/p1/expire', { ttlSeconds: 60 })
    expect(post).toHaveBeenNthCalledWith(2, '/catalog/products/p1/persist')
  })
})

describe('countersApi', () => {
  it('views reads the id-scoped views count', () => {
    /*
     * Scenario: reading a product's view count.
     * Rule it protects: `views` GETs the `/views` sub-path.
     */
    void countersApi.views('p1')
    expect(get).toHaveBeenCalledWith('/counters/p1/views')
  })

  it('incrViews sends the step body when by is provided and omits it otherwise', () => {
    /*
     * Scenario: incrementing views with and without an explicit step.
     * Rule it protects: a provided `by` becomes `{ by }`; an absent one passes
     * `undefined` (both branches of the optional-step guard).
     */
    void countersApi.incrViews('p1', 3)
    void countersApi.incrViews('p1')
    expect(post).toHaveBeenNthCalledWith(1, '/counters/p1/views/incr', { by: 3 })
    expect(post).toHaveBeenNthCalledWith(2, '/counters/p1/views/incr', undefined)
  })

  it('decrStock sends the step body when by is provided and omits it otherwise', () => {
    /*
     * Scenario: decrementing stock with and without a step.
     * Rule it protects: the same optional-step guard applies to the stock decrement.
     */
    void countersApi.decrStock('p1', 2)
    void countersApi.decrStock('p1')
    expect(post).toHaveBeenNthCalledWith(1, '/counters/p1/stock/decr', { by: 2 })
    expect(post).toHaveBeenNthCalledWith(2, '/counters/p1/stock/decr', undefined)
  })
})

describe('collectionsApi', () => {
  it('getCart and getCartLine read the cart hash and one encoded line', () => {
    /*
     * Scenario: reading a whole cart, then one line.
     * Rule it protects: both the id and the field segment are encoded into the
     * cart paths.
     */
    void collectionsApi.getCart('c1')
    void collectionsApi.getCartLine('c1', 'sku 9')
    expect(get).toHaveBeenNthCalledWith(1, '/collections/c1/cart')
    expect(get).toHaveBeenNthCalledWith(2, '/collections/c1/cart/sku%209')
  })

  it('setCartLine posts the field/value body and removeCartLine deletes the encoded line', () => {
    /*
     * Scenario: writing then removing a cart line.
     * Rule it protects: `setCartLine` POSTs `{ field, value }`; `removeCartLine`
     * DELETEs the encoded field sub-path.
     */
    const value = { quantity: 2, priceCents: 500 }
    void collectionsApi.setCartLine('c1', 'sku1', value)
    void collectionsApi.removeCartLine('c1', 'sku1')
    expect(post).toHaveBeenCalledWith('/collections/c1/cart', { field: 'sku1', value })
    expect(del).toHaveBeenCalledWith('/collections/c1/cart/sku1')
  })

  it('tag ops post/get/del across the encoded tag paths', () => {
    /*
     * Scenario: adding, listing, testing membership, and removing tags.
     * Rule it protects: `addTags` POSTs `{ tags }`, `listTags` GETs the set,
     * `hasTag` GETs the encoded member, and `removeTag` DELETEs it.
     */
    void collectionsApi.addTags('c1', ['new', 'sale'])
    void collectionsApi.listTags('c1')
    void collectionsApi.hasTag('c1', 'on sale')
    void collectionsApi.removeTag('c1', 'on sale')
    expect(post).toHaveBeenCalledWith('/collections/c1/tags', { tags: ['new', 'sale'] })
    expect(get).toHaveBeenCalledWith('/collections/c1/tags')
    expect(get).toHaveBeenCalledWith('/collections/c1/tags/on%20sale')
    expect(del).toHaveBeenCalledWith('/collections/c1/tags/on%20sale')
  })
})
