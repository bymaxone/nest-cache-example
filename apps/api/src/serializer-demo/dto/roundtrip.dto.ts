/**
 * Zod schemas for the serializer-demo endpoints.
 *
 * Layer: serializer-demo. Validates the `?codec=` query parameter shared by
 * POST /serializer/roundtrip and POST /serializer/caveat.
 */
import { z } from 'zod'

/** Validated query for the roundtrip and caveat endpoints. */
export const RoundtripQuerySchema = z.object({
  codec: z.enum(['json', 'msgpack']).default('json'),
})

/** Inferred query type. */
export type RoundtripQuery = z.infer<typeof RoundtripQuerySchema>

/** Accepts any non-empty JSON object as the payload to round-trip. */
export const RoundtripBodySchema = z
  .record(z.string(), z.unknown())
  .refine((v) => Object.keys(v).length > 0, { message: 'body must contain at least one field' })

/** Inferred body type. */
export type RoundtripBody = z.infer<typeof RoundtripBodySchema>
