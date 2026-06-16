/**
 * Typed cache key-prefix constants.
 *
 * Layer: common. The single source of truth for every key prefix used by the
 * app's feature modules. The library's `KeyBuilder` composes the full key as
 * `{namespace}:{prefix}:{id}` — e.g. `cache-example:product:42`.
 *
 * All values are typed as `CacheKeyPrefix` (the library's alias for `string`).
 * Centralising them here means a rename touches one file, not every call site.
 * Compose with `CacheService` / `KeyBuilder` via `build(CACHE_PREFIX.product, id)`.
 */
import type { CacheKeyPrefix } from '@bymax-one/nest-cache'

export const CACHE_PREFIX = {
  product: 'product',
  cart: 'cart',
  tags: 'tags',
  views: 'views',
  stock: 'stock',
  stampede: 'stampede',
} as const satisfies Record<string, CacheKeyPrefix>
