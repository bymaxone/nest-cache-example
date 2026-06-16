/**
 * Zod schema for the cart-item body.
 *
 * Layer: collections. Validates the `{ field, value }` body for
 * POST /collections/:id/cart — field is the hash field name (product id),
 * value is the CartLine (serialized through the JSON serializer).
 */
import { z } from 'zod'

/** Validates the body for adding or updating a cart line item. */
export const CartItemSchema = z.object({
  field: z.string().min(1),
  value: z.object({
    quantity: z.number().int().positive(),
    priceCents: z.number().int().nonnegative(),
  }),
})

/** Inferred type from CartItemSchema. */
export type CartItem = z.infer<typeof CartItemSchema>
