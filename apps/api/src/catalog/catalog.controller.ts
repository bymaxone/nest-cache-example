/**
 * Catalog controller — product read-through, batch, seed, and TTL routes.
 *
 * Layer: catalog. Thin controller: validates inputs via Zod, delegates to
 * CatalogService, and returns the typed result. No business logic here.
 *
 * Route overview (all under /catalog/products):
 *   GET  /               — batch read-through (?ids=a,b,c)
 *   GET  /:id/ttl        — remaining TTL (-2 = missing, -1 = no expiry)
 *   GET  /:id            — single read-through
 *   POST /:id/seed       — idempotent seed via setNx
 *   POST /:id/expire     — set a TTL on an existing key
 *   POST /:id/persist    — remove a key's TTL (make it persistent)
 */
import { Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common'
import { CatalogService } from './catalog.service.js'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import { ProductParamsSchema } from './dto/product-params.dto.js'
import { ProductsQuerySchema } from './dto/products-query.dto.js'
import { SeedProductSchema } from './dto/seed-product.dto.js'
import { ExpireSchema } from './dto/expire.dto.js'
import type { Product } from './product.types.js'

/**
 * Handles all /catalog/products routes.
 *
 * Every route delegates immediately to CatalogService; this class owns only
 * input binding and HTTP status semantics.
 */
@Controller('catalog/products')
export class CatalogController {
  constructor(private readonly service: CatalogService) {}

  /**
   * GET /catalog/products?ids=a,b,c — batch read-through.
   *
   * Parses a comma-separated `ids` query param (1–50 ids), returns a
   * positionally-aligned array of products (null for unknown ids). Cache hits
   * served from Redis; misses fetched from the origin and back-filled.
   *
   * @param query - Validated query containing the `ids` string array.
   * @returns Array of Product|null aligned with the requested ids.
   */
  @Get()
  async getProducts(
    @Query(new ZodValidationPipe(ProductsQuerySchema)) query: { ids: string[] },
  ): Promise<Array<Product | null>> {
    return this.service.getProducts(query.ids)
  }

  /**
   * GET /catalog/products/:id/ttl — remaining TTL of a catalog key.
   *
   * Redis semantics: `-2` = key does not exist; `-1` = key exists but has no
   * expiry; any positive value = remaining seconds.
   *
   * @param params - Path params containing the product `id`.
   * @returns TTL in seconds (or -2/-1 per Redis convention).
   */
  @Get(':id/ttl')
  async getTtl(
    @Param(new ZodValidationPipe(ProductParamsSchema)) params: { id: string },
  ): Promise<number> {
    return this.service.getTtl(params.id)
  }

  /**
   * GET /catalog/products/:id — single-product read-through.
   *
   * Cache hit returns immediately (fast). Cache miss fetches from the origin
   * store (slow — artificial latency) and populates the cache for subsequent
   * requests. Returns 404 when the origin has no such product.
   *
   * @param params - Path params containing the product `id`.
   * @returns The Product JSON.
   * @throws NotFoundException when the product is unknown.
   */
  @Get(':id')
  async getProduct(
    @Param(new ZodValidationPipe(ProductParamsSchema)) params: { id: string },
  ): Promise<Product> {
    const product = await this.service.getProduct(params.id)
    if (product === null) throw new NotFoundException(`Product '${params.id}' not found`)
    return product
  }

  /**
   * POST /catalog/products/:id/seed — idempotent cache seed via setNx.
   *
   * Writes the product into the cache only when the key is absent. A second
   * call with the same id is a no-op (`created: false`). The optional body
   * fields override the corresponding origin-store values.
   *
   * @param params - Path params containing the product `id`.
   * @param body - Optional field overrides.
   * @returns `{ isCreated, isPresent }` — whether the write occurred and whether the key is currently present.
   */
  @Post(':id/seed')
  async seedProduct(
    @Param(new ZodValidationPipe(ProductParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(SeedProductSchema))
    body: { name?: string; priceCents?: number; tags?: string[]; stock?: number },
  ): Promise<{ isCreated: boolean; isPresent: boolean }> {
    return this.service.seedProduct(params.id, body)
  }

  /**
   * POST /catalog/products/:id/expire — set a TTL on an existing catalog key.
   *
   * @param params - Path params containing the product `id`.
   * @param body - `{ ttlSeconds }` — positive integer expiry.
   * @returns `true` when the timeout was set; `false` when the key does not exist.
   */
  @Post(':id/expire')
  async setTtl(
    @Param(new ZodValidationPipe(ProductParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(ExpireSchema)) body: { ttlSeconds: number },
  ): Promise<boolean> {
    return this.service.setTtl(params.id, body.ttlSeconds)
  }

  /**
   * POST /catalog/products/:id/persist — remove a catalog key's TTL.
   *
   * Makes the key persistent (no expiry). Returns `false` when the key has
   * no TTL or does not exist.
   *
   * @param params - Path params containing the product `id`.
   * @returns `true` when a TTL was removed; `false` otherwise.
   */
  @Post(':id/persist')
  async persistKey(
    @Param(new ZodValidationPipe(ProductParamsSchema)) params: { id: string },
  ): Promise<boolean> {
    return this.service.persistKey(params.id)
  }
}
