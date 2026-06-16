/**
 * Domain types for the collections feature.
 *
 * Layer: collections. CartLine is stored as a hash field value (serialized
 * through the JSON serializer). Tags are stored as raw set members — the
 * serializer is intentionally NOT applied to set members, so they are plain
 * strings (see CollectionsService JSDoc).
 */

/**
 * A single line item in a shopping cart hash.
 *
 * Stored as the value of a hash field via `hset`; round-trips through the
 * configured serializer (JSON by default), so nested objects are preserved.
 */
export interface CartLine {
  quantity: number
  priceCents: number
}
