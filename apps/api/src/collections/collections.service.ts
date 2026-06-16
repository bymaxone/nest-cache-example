/**
 * Collections service — cart hashes and tag sets.
 *
 * Layer: collections. Demonstrates two distinct Redis data structures:
 *
 * HASHES (cart): `hset`/`hget`/`hgetall`/`hdel` — each hash field is a
 * product id; the value is a CartLine object serialized through the configured
 * serializer (JSON by default), so typed objects round-trip correctly.
 *
 * SETS (tags): `sadd`/`srem`/`smembers`/`sismember`/`scard` — set members are
 * stored RAW; the serializer is intentionally NOT applied to set members. Tags
 * are plain strings going in and `string[]` coming out — never JSON-encoded
 * objects. This is a library design choice (sets hold ids, not values).
 */
import { Injectable } from '@nestjs/common'
import { CacheService } from '@bymax-one/nest-cache'
import { CACHE_PREFIX } from '../common/cache-keys.js'
import type { CartLine } from './collection.types.js'

/**
 * Cart (hash) and tag (set) cache operations.
 *
 * Cart lines are serialized through the JSON serializer, so CartLine objects
 * round-trip correctly. Set members (tags) are stored RAW — the serializer is
 * NOT applied; members are plain strings and must never be objects.
 */
@Injectable()
export class CollectionsService {
  private readonly cartPrefix = CACHE_PREFIX.cart
  private readonly tagsPrefix = CACHE_PREFIX.tags

  constructor(private readonly cache: CacheService) {}

  // ── Cart (hash) operations ──────────────────────────────────────────────────

  /**
   * Returns all line items in a cart hash.
   *
   * @param id - The cart id (hash key).
   * @returns A record of field → CartLine; `{}` when the cart does not exist.
   */
  async getCart(id: string): Promise<Record<string, CartLine>> {
    return this.cache.hgetall<CartLine>(this.cartPrefix, id)
  }

  /**
   * Returns a single cart line item by field name.
   *
   * @param id - The cart id (hash key).
   * @param field - The hash field (product id).
   * @returns The CartLine, or `null` when the field does not exist.
   */
  async getCartLine(id: string, field: string): Promise<CartLine | null> {
    return this.cache.hget<CartLine>(this.cartPrefix, id, field)
  }

  /**
   * Adds or updates a cart line item.
   *
   * @param id - The cart id (hash key).
   * @param field - The hash field (product id).
   * @param value - The CartLine to store (serialized through the JSON serializer).
   * @returns `1` when the field is new; `0` when it overwrote an existing field.
   */
  async setCartLine(id: string, field: string, value: CartLine): Promise<number> {
    return this.cache.hset<CartLine>(this.cartPrefix, id, field, value)
  }

  /**
   * Removes a cart line item.
   *
   * @param id - The cart id (hash key).
   * @param field - The hash field (product id) to remove.
   * @returns The number of fields actually removed (`0` or `1`).
   */
  async removeCartLine(id: string, field: string): Promise<number> {
    return this.cache.hdel(this.cartPrefix, id, field)
  }

  // ── Tags (set) operations ───────────────────────────────────────────────────

  /**
   * Adds one or more tags to a product's tag set.
   *
   * Set members are stored RAW — the serializer is NOT applied. Tags are
   * plain strings; passing objects here would store their `.toString()` form.
   *
   * @param id - The product id (set key).
   * @param tags - Raw string members to add.
   * @returns The number of members newly added (excludes already-present ones).
   */
  async addTags(id: string, tags: string[]): Promise<number> {
    return this.cache.sadd(this.tagsPrefix, id, ...tags)
  }

  /**
   * Lists all tags for a product along with the set cardinality.
   *
   * Set members are returned as raw strings — not deserialized objects.
   *
   * @param id - The product id (set key).
   * @returns `{ tags, count }` where `tags` is the raw string member list.
   */
  async listTags(id: string): Promise<{ tags: string[]; count: number }> {
    const [tags, count] = await Promise.all([
      this.cache.smembers(this.tagsPrefix, id),
      this.cache.scard(this.tagsPrefix, id),
    ])
    return { tags, count }
  }

  /**
   * Tests whether a tag is a member of the product's tag set.
   *
   * @param id - The product id (set key).
   * @param tag - The raw string member to test.
   * @returns `true` when the tag is present; `false` otherwise.
   */
  async hasTag(id: string, tag: string): Promise<boolean> {
    return this.cache.sismember(this.tagsPrefix, id, tag)
  }

  /**
   * Removes a tag from the product's tag set.
   *
   * @param id - The product id (set key).
   * @param tag - The raw string member to remove.
   * @returns The number of members actually removed (`0` or `1`).
   */
  async removeTag(id: string, tag: string): Promise<number> {
    return this.cache.srem(this.tagsPrefix, id, tag)
  }
}
