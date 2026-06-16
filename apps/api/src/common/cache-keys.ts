/**
 * Typed cache key-prefix constants.
 *
 * Layer: common. The single source of truth for every key prefix used by the
 * app's feature modules. The library's `KeyBuilder` composes the full key as
 * `{namespace}:{prefix}:{id}` — e.g. `cache-example:product:42`. Extended with
 * additional prefixes as later phases add feature modules.
 */
import type { CacheKeyPrefix } from '@bymax-one/nest-cache/shared'

/**
 * Typed key-prefix constants — compose with `CacheService` / `KeyBuilder` via
 * `build(CACHE_PREFIX.product, id)`. All values are typed as `CacheKeyPrefix`
 * so a raw string literal cannot be passed where a prefix constant is expected.
 */
export const CACHE_PREFIX = {
  product: 'product',
  cart: 'cart',
  tags: 'tags',
  stampede: 'stampede',
} as const satisfies Record<string, CacheKeyPrefix>
