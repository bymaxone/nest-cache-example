/**
 * Counters service — atomic increment and decrement operations.
 *
 * Layer: counters. Demonstrates that `incr`/`decr` are server-atomic Redis
 * commands — no read-modify-write race is possible. Views and stock use
 * distinct CacheKeyPrefix constants so their key spaces never collide.
 */
import { Injectable } from '@nestjs/common'
import { CacheService } from '@bymax-one/nest-cache'
import { CACHE_PREFIX } from '../common/cache-keys.js'

/**
 * Atomic numeric counter operations.
 *
 * View counts live under the `views` prefix; stock levels under `stock`.
 * Both prefixes are distinct from the `product` prefix used by CatalogService —
 * counter keys store numeric strings, not serialized Product objects.
 */
@Injectable()
export class CountersService {
  constructor(private readonly cache: CacheService) {}

  /**
   * Returns the current view count for a product (0 when the key is absent).
   *
   * @param id - The product id.
   * @returns The current view count.
   */
  async getViews(id: string): Promise<number> {
    return (await this.cache.get<number>(CACHE_PREFIX.views, id)) ?? 0
  }

  /**
   * Atomically increments the view counter for a product.
   *
   * Uses `incr` (or `incrby` when `by` is provided) — a single server-side
   * atomic command, never a read-modify-write sequence.
   *
   * @param id - The product id.
   * @param by - Step size; defaults to `1`.
   * @returns The counter value after the increment.
   */
  async incrViews(id: string, by?: number): Promise<number> {
    if (by !== undefined) {
      return this.cache.incr(CACHE_PREFIX.views, id, by)
    }
    return this.cache.incr(CACHE_PREFIX.views, id)
  }

  /**
   * Atomically decrements the stock counter for a product.
   *
   * Uses `decr` (or `decrby` when `by` is provided) — a single server-side
   * atomic command, never a read-modify-write sequence.
   *
   * @param id - The product id.
   * @param by - Step size; defaults to `1`.
   * @returns The stock value after the decrement.
   */
  async decrStock(id: string, by?: number): Promise<number> {
    if (by !== undefined) {
      return this.cache.decr(CACHE_PREFIX.stock, id, by)
    }
    return this.cache.decr(CACHE_PREFIX.stock, id)
  }
}
