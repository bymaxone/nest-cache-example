/**
 * Zod schema for the batch catalog query.
 *
 * Layer: catalog. Parses the `?ids=a,b,c` query string into a validated
 * string array — trimmed, de-emptied, and capped at 50 ids per request.
 */
import { z } from 'zod'

/**
 * Validates the `?ids=` query parameter for GET /catalog/products.
 *
 * Accepts a single comma-separated string and transforms it to a non-empty
 * array of trimmed strings, capped at 50 elements.
 */
export const ProductsQuerySchema = z.object({
  ids: z
    .string()
    .transform((s) =>
      s
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    )
    .pipe(z.array(z.string().min(1)).min(1).max(50)),
})

/** Inferred type from ProductsQuerySchema. */
export type ProductsQuery = z.infer<typeof ProductsQuerySchema>
