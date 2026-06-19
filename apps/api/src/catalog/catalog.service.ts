/**
 * Catalog service — read-through cache with batch, seed, and TTL operations.
 *
 * Layer: catalog. Houses all cache interactions for the product domain so the
 * controller stays thin. The read-through pattern (get → miss → origin → set)
 * is the canonical demo of how the library short-circuits a slow origin store.
 *
 * All CacheService calls use the (prefix, id, …) argument shape — keys are
 * auto-namespaced by the library and never hand-built here.
 */
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CacheService } from '@bymax-one/nest-cache'
import type { Env } from '../config/env.schema.js'
import { CACHE_PREFIX } from '../common/cache-keys.js'
import { MetricsService } from '../metrics/metrics.service.js'
import { ProductOriginStore } from './product-origin.store.js'
import { SEED_PRODUCTS } from './product.types.js'
import type { Product } from './product.types.js'
import type { SeedProduct } from './dto/seed-product.dto.js'

/**
 * Business logic for the product catalog.
 *
 * Demonstrates get/set (read-through), mget/mset (batch), setNx/exists
 * (idempotent seed), and expire/ttl/persist (TTL lifecycle) against
 * a single CacheKeyPrefix so the hit/miss ratio in GET /metrics is meaningful.
 */
@Injectable()
export class CatalogService {
  private readonly prefix = CACHE_PREFIX.product
  private readonly ttlSeconds: number

  constructor(
    private readonly cache: CacheService,
    private readonly origin: ProductOriginStore,
    private readonly config: ConfigService<Env, true>,
    private readonly metrics: MetricsService,
  ) {
    this.ttlSeconds = this.config.get('CACHE_DEFAULT_TTL', { infer: true })
  }

  /**
   * Fetches a single product via the read-through pattern.
   *
   * Cache hit: returned immediately, hit recorded.
   * Cache miss: fetches from the origin store, writes the result to cache,
   * miss recorded.
   *
   * @param id - The product id.
   * @returns The product, or `null` when the origin has no such product.
   */
  async getProduct(id: string): Promise<Product | null> {
    const cached = await this.cache.get<Product>(this.prefix, id)
    if (cached !== null) {
      this.metrics.recordHit(this.prefix)
      return cached
    }
    this.metrics.recordMiss(this.prefix)
    const fresh = await this.origin.find(id)
    if (fresh !== null) {
      await this.cache.set(this.prefix, id, fresh, this.ttlSeconds)
    }
    return fresh
  }

  /**
   * Fetches many products via the batch read-through pattern.
   *
   * Known cache hits are returned immediately; missing ids are fetched from the
   * origin in a single round-trip and written back to cache. Results are
   * returned in the same order as the input `ids` array.
   *
   * @param ids - The product ids to fetch.
   * @returns Values positionally aligned with `ids`; `null` for unknown ids.
   */
  async getProducts(ids: string[]): Promise<Array<Product | null>> {
    const cached = await this.cache.mget<Product>(this.prefix, ids)

    const missingIds: string[] = []
    for (const [i, id] of ids.entries()) {
      const slot = cached[i]
      if (slot !== null && slot !== undefined) {
        this.metrics.recordHit(this.prefix)
      } else {
        this.metrics.recordMiss(this.prefix)
        missingIds.push(id)
      }
    }

    const freshResults = await this.origin.findMany(missingIds)
    const entries: Array<readonly [string, Product]> = []
    const freshMap = new Map<string, Product | null>()

    for (const [i, id] of missingIds.entries()) {
      const product = freshResults[i]
      freshMap.set(id, product ?? null)
      if (product !== null && product !== undefined) {
        entries.push([id, product])
      }
    }

    if (entries.length > 0) {
      await this.cache.mset<Product>(this.prefix, entries)
    }

    return ids.map((id, i) => {
      const cachedSlot = cached[i]
      if (cachedSlot !== null && cachedSlot !== undefined) return cachedSlot
      return freshMap.get(id) ?? null
    })
  }

  /**
   * Idempotent product seed via setNx.
   *
   * Writes the product to cache only when the key is absent. A second call
   * with the same id is a no-op (`created: false`). The `exists` flag confirms
   * current key presence independently of the write result.
   *
   * @param id - The product id to seed.
   * @param overrides - Optional field overrides merged over the origin row.
   * @returns `{ isCreated }` (whether the write occurred) and `{ isPresent }` (key present now).
   */
  async seedProduct(
    id: string,
    overrides: SeedProduct,
  ): Promise<{ isCreated: boolean; isPresent: boolean }> {
    const originProduct = await this.origin.find(id)
    const seedRow = SEED_PRODUCTS.find((p) => p.id === id)
    const base = originProduct ?? seedRow ?? null

    const value: Product = {
      id,
      name: overrides.name ?? base?.name ?? id,
      priceCents: overrides.priceCents ?? base?.priceCents ?? 0,
      tags: overrides.tags ?? base?.tags ?? [],
      stock: overrides.stock ?? base?.stock ?? 0,
    }

    const isCreated = await this.cache.setNx(this.prefix, id, value, this.ttlSeconds)
    const isPresent = await this.cache.exists(this.prefix, id)
    return { isCreated, isPresent }
  }

  /**
   * Sets a TTL on an existing catalog key.
   *
   * @param id - The product id.
   * @param ttlSeconds - Expiry in seconds (must be positive).
   * @returns `true` when the timeout was set, `false` when the key does not exist.
   */
  async setTtl(id: string, ttlSeconds: number): Promise<boolean> {
    return this.cache.expire(this.prefix, id, ttlSeconds)
  }

  /**
   * Reads the remaining TTL of a catalog key.
   *
   * Redis TTL semantics: `-2` means the key does not exist; `-1` means the key
   * exists but has no expiry (persistent). Any positive value is the remaining
   * seconds.
   *
   * @param id - The product id.
   * @returns TTL in seconds; `-2` = no such key; `-1` = key exists, no expiry.
   */
  async getTtl(id: string): Promise<number> {
    return this.cache.ttl(this.prefix, id)
  }

  /**
   * Removes the TTL of a catalog key, making it persistent.
   *
   * @param id - The product id.
   * @returns `true` when a TTL was removed, `false` when the key has no TTL or does not exist.
   */
  async persistKey(id: string): Promise<boolean> {
    return this.cache.persist(this.prefix, id)
  }
}
