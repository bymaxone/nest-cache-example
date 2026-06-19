/**
 * Unit specs for the cache key-prefix constants.
 *
 * Asserts every centralized prefix value so a rename or accidental drop is caught
 * at the single source of truth the feature modules compose keys from.
 *
 * @module common/cache-keys.spec
 */
import { CACHE_PREFIX } from './cache-keys.js'

describe('CACHE_PREFIX', () => {
  it('exposes the exact prefix string for every feature family', () => {
    /*
     * Scenario: read every centralized prefix constant.
     * Rule it protects: these literals are the single source of truth for key
     * composition (`{namespace}:{prefix}:{id}`); a drift here silently reshapes
     * every key, so the full set is pinned.
     */
    expect(CACHE_PREFIX).toEqual({
      product: 'product',
      cart: 'cart',
      tags: 'tags',
      views: 'views',
      stock: 'stock',
      stampede: 'stampede',
      ttl: 'ttl',
    })
  })
})
