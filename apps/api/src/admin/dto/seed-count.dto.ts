/**
 * Validated query shape for the bulk-seed endpoint (POST /admin/seed?count=N).
 *
 * Layer: admin/dto. The `count` value arrives as a query-string (always a
 * string), so `z.coerce` is appropriate. Capped at 10_000 to prevent
 * accidentally large pipeline flushes.
 */
import { z } from 'zod'

/** Validates the `count` query param for the seed endpoint. */
export const seedCountSchema = z.object({
  count: z.coerce.number().int().positive().max(10_000).default(50),
})

/** Inferred seed-count query type. */
export type SeedCount = z.infer<typeof seedCountSchema>
