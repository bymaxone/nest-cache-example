/**
 * Zod schema for catalog route path parameters.
 *
 * Layer: catalog. Validates the `:id` segment shared across all single-product
 * routes — reused by the seed, TTL, and read-through endpoints.
 */
import { z } from 'zod'

/** Validates the `{ id }` path-params object for single-product routes. */
export const ProductParamsSchema = z.object({
  id: z.string().min(1),
})

/** Inferred type from ProductParamsSchema. */
export type ProductParams = z.infer<typeof ProductParamsSchema>
