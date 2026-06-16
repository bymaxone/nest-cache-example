/**
 * Zod schema for the TTL-set body.
 *
 * Layer: catalog. Validates the `ttlSeconds` field for POST /catalog/products/:id/expire.
 */
import { z } from 'zod'

/** Validates the body for setting a TTL on a catalog key. */
export const ExpireSchema = z.object({
  ttlSeconds: z.number().int().positive(),
})

/** Inferred type from ExpireSchema. */
export type Expire = z.infer<typeof ExpireSchema>
