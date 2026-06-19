/**
 * Accept/reject specs for the cart-item body DTO.
 *
 * @module collections/dto/cart-item.dto.spec
 */
import { CartItemSchema } from './cart-item.dto.js'

describe('CartItemSchema', () => {
  it('accepts a non-empty field with a valid cart line', () => {
    /* Accept: field present; quantity positive int; priceCents nonnegative int. */
    const item = { field: 'sku-1', value: { quantity: 2, priceCents: 0 } }
    expect(CartItemSchema.parse(item)).toEqual(item)
  })

  it('rejects an empty field', () => {
    /* Reject: field min(1). */
    expect(
      CartItemSchema.safeParse({ field: '', value: { quantity: 1, priceCents: 1 } }).success,
    ).toBe(false)
  })

  it('rejects a non-positive quantity or negative price', () => {
    /* Reject: quantity must be a positive integer; priceCents must be nonnegative. */
    expect(
      CartItemSchema.safeParse({ field: 's', value: { quantity: 0, priceCents: 1 } }).success,
    ).toBe(false)
    expect(
      CartItemSchema.safeParse({ field: 's', value: { quantity: 1, priceCents: -1 } }).success,
    ).toBe(false)
  })
})
