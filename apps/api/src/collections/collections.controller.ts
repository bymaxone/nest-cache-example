/**
 * Collections controller — cart hash and tag set routes.
 *
 * Layer: collections. Thin controller; delegates all logic to CollectionsService.
 * No business logic here — only input binding and HTTP method semantics.
 *
 * Route overview (all under /collections/:id):
 *   GET    /:id/cart           — read all cart lines (hgetall)
 *   GET    /:id/cart/:field    — read one cart line (hget)
 *   POST   /:id/cart           — add/update a cart line (hset)
 *   DELETE /:id/cart/:field    — remove a cart line (hdel)
 *   POST   /:id/tags           — add tags to a product (sadd)
 *   GET    /:id/tags           — list all tags + count (smembers + scard)
 *   GET    /:id/tags/:tag      — test tag membership (sismember)
 *   DELETE /:id/tags/:tag      — remove a tag (srem)
 */
import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common'
import { z } from 'zod'
import { CollectionsService } from './collections.service.js'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import { CartItemSchema } from './dto/cart-item.dto.js'
import { TagsSchema } from './dto/tags.dto.js'
import type { CartLine } from './collection.types.js'

/** Validates the `:id` path param shared by every collections route. */
export const collectionIdSchema = z.object({ id: z.string().min(1) })
/** Validates the `:id` + `:field` path params for a single cart line. */
export const cartLineParamsSchema = z.object({ id: z.string().min(1), field: z.string().min(1) })
/** Validates the `:id` + `:tag` path params for a single tag operation. */
export const tagParamsSchema = z.object({ id: z.string().min(1), tag: z.string().min(1) })

/**
 * Handles all /collections routes (carts as hashes, tags as sets).
 *
 * Each route delegates immediately to CollectionsService; this class owns only
 * input binding and HTTP status semantics.
 */
@Controller('collections')
export class CollectionsController {
  constructor(private readonly service: CollectionsService) {}

  // ── Cart (hash) routes ──────────────────────────────────────────────────────

  /**
   * GET /collections/:id/cart — read the entire cart hash.
   *
   * Hash field values are deserialized CartLine objects (JSON round-trip).
   *
   * @param params - Path params containing the cart `id`.
   * @returns All cart line items as `Record<field, CartLine>`; `{}` when absent.
   */
  @Get(':id/cart')
  async getCart(
    @Param(new ZodValidationPipe(collectionIdSchema)) params: { id: string },
  ): Promise<Record<string, CartLine>> {
    return this.service.getCart(params.id)
  }

  /**
   * GET /collections/:id/cart/:field — read one cart line item.
   *
   * @param params - Path params containing the cart `id` and hash `field`.
   * @returns The CartLine, or `null` when the field does not exist.
   */
  @Get(':id/cart/:field')
  async getCartLine(
    @Param(new ZodValidationPipe(cartLineParamsSchema)) params: { id: string; field: string },
  ): Promise<CartLine | null> {
    return this.service.getCartLine(params.id, params.field)
  }

  /**
   * POST /collections/:id/cart — add or update a cart line item.
   *
   * Body: `{ field: string, value: { quantity, priceCents } }`.
   *
   * @param params - Path params containing the cart `id`.
   * @param body - The cart item to store.
   * @returns `1` when the field is new; `0` when it overwrote an existing field.
   */
  @Post(':id/cart')
  async setCartLine(
    @Param(new ZodValidationPipe(collectionIdSchema)) params: { id: string },
    @Body(new ZodValidationPipe(CartItemSchema)) body: { field: string; value: CartLine },
  ): Promise<number> {
    return this.service.setCartLine(params.id, body.field, body.value)
  }

  /**
   * DELETE /collections/:id/cart/:field — remove a cart line item.
   *
   * @param params - Path params containing the cart `id` and hash `field`.
   * @returns The number of fields removed (`0` or `1`).
   */
  @Delete(':id/cart/:field')
  async removeCartLine(
    @Param(new ZodValidationPipe(cartLineParamsSchema)) params: { id: string; field: string },
  ): Promise<number> {
    return this.service.removeCartLine(params.id, params.field)
  }

  // ── Tags (set) routes ───────────────────────────────────────────────────────

  /**
   * POST /collections/:id/tags — add tags to a product's tag set.
   *
   * Set members are stored RAW — the serializer is NOT applied. Members are
   * plain strings, not JSON-encoded objects (library design).
   *
   * Body: `{ tags: string[] }` (at least one non-empty string).
   *
   * @param params - Path params containing the product `id`.
   * @param body - The tags to add.
   * @returns The number of members newly added (excludes already-present ones).
   */
  @Post(':id/tags')
  async addTags(
    @Param(new ZodValidationPipe(collectionIdSchema)) params: { id: string },
    @Body(new ZodValidationPipe(TagsSchema)) body: { tags: string[] },
  ): Promise<number> {
    return this.service.addTags(params.id, body.tags)
  }

  /**
   * GET /collections/:id/tags — list all tags and cardinality.
   *
   * Set members are returned as raw strings — not deserialized objects.
   *
   * @param params - Path params containing the product `id`.
   * @returns `{ tags: string[], count: number }`.
   */
  @Get(':id/tags')
  async listTags(
    @Param(new ZodValidationPipe(collectionIdSchema)) params: { id: string },
  ): Promise<{ tags: string[]; count: number }> {
    return this.service.listTags(params.id)
  }

  /**
   * GET /collections/:id/tags/:tag — test tag membership.
   *
   * @param params - Path params containing the product `id` and `tag` to test.
   * @returns `true` when the tag is a member of the set; `false` otherwise.
   */
  @Get(':id/tags/:tag')
  async hasTag(
    @Param(new ZodValidationPipe(tagParamsSchema)) params: { id: string; tag: string },
  ): Promise<boolean> {
    return this.service.hasTag(params.id, params.tag)
  }

  /**
   * DELETE /collections/:id/tags/:tag — remove a tag from the set.
   *
   * @param params - Path params containing the product `id` and `tag` to remove.
   * @returns The number of members removed (`0` or `1`).
   */
  @Delete(':id/tags/:tag')
  async removeTag(
    @Param(new ZodValidationPipe(tagParamsSchema)) params: { id: string; tag: string },
  ): Promise<number> {
    return this.service.removeTag(params.id, params.tag)
  }
}
