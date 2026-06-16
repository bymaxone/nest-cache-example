/**
 * Zod schema for the idempotent product seed body.
 *
 * Layer: catalog. All fields are optional overrides — the seed service fills
 * missing fields from the origin store or sane defaults. Defaults to `{}` so
 * a POST with no body is valid (seed the origin row as-is).
 */
import { z } from 'zod'

/**
 * Optional overrides for an idempotent product seed.
 *
 * Fields present in the body override the corresponding origin-store values;
 * absent fields fall back to the origin product or safe defaults.
 */
export const SeedProductSchema = z
  .object({
    name: z.string().min(1).optional(),
    priceCents: z.number().int().nonnegative().optional(),
    tags: z.array(z.string()).optional(),
    stock: z.number().int().nonnegative().optional(),
  })
  .default({})

/** Inferred type from SeedProductSchema. */
export type SeedProduct = z.infer<typeof SeedProductSchema>
