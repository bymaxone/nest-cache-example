/**
 * Zod schema for the tags body.
 *
 * Layer: collections. Validates the `{ tags }` body for
 * POST /collections/:id/tags. Tags are raw string set members — the serializer
 * is intentionally NOT applied to set members (see CollectionsService JSDoc).
 */
import { z } from 'zod'

/**
 * Validates the body for adding tags to a product's tag set.
 *
 * Members must be non-empty strings; at least one tag is required per call.
 * Tags are stored as raw strings — not JSON-encoded objects.
 */
export const TagsSchema = z.object({
  tags: z.array(z.string().min(1)).min(1),
})

/** Inferred type from TagsSchema. */
export type Tags = z.infer<typeof TagsSchema>
