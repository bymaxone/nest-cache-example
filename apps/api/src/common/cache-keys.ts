/**
 * Typed cache key-prefix constants.
 *
 * Layer: common. The single source of truth for every key prefix used by the
 * app's feature modules. The library's `KeyBuilder` composes the full key as
 * `{namespace}:{prefix}:{id}` — e.g. `cache-example:product:42`. Extended with
 * additional prefixes as later phases add feature modules.
 *
 * All values satisfy `CacheKeyPrefix` (which the library defines as `string`),
 * so a raw string literal cannot be passed where a prefix constant is expected.
 * Compose with `CacheService` / `KeyBuilder` via `build(CACHE_PREFIX.product, id)`.
 */
export const CACHE_PREFIX = {
  product: 'product',
  cart: 'cart',
  tags: 'tags',
  views: 'views',
  stock: 'stock',
  stampede: 'stampede',
} as const satisfies Record<string, string>
