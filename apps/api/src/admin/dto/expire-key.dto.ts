/**
 * Validated body shape for setting a TTL on an existing key.
 *
 * Layer: admin/dto. Used by POST /admin/keys/:key/expire. The body is
 * JSON-parsed, so `seconds` arrives as a number — no coercion needed.
 */
import { z } from 'zod'

/** Validates the `{ seconds }` body for the expire endpoint. */
export const expireKeySchema = z.object({
  seconds: z.number().int().positive(),
})

/** Inferred expire-key body type. */
export type ExpireKey = z.infer<typeof expireKeySchema>
