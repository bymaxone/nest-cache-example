/**
 * Accept/reject specs for the idempotent product-seed body DTO.
 *
 * @module catalog/dto/seed-product.dto.spec
 */
import { SeedProductSchema } from './seed-product.dto.js'

describe('SeedProductSchema', () => {
  it('defaults to {} when the body is absent', () => {
    /* Accept: a POST with no body → {} (seed the origin row as-is). */
    expect(SeedProductSchema.parse(undefined)).toEqual({})
  })

  it('accepts a full override body', () => {
    /* Accept: all optional override fields within bounds. */
    const body = { name: 'Widget', priceCents: 1999, tags: ['a', 'b'], stock: 5 }
    expect(SeedProductSchema.parse(body)).toEqual(body)
  })

  it('rejects an empty name, negative price, negative stock, or fractional price', () => {
    /* Reject: name min(1), priceCents/stock nonnegative integers. */
    expect(SeedProductSchema.safeParse({ name: '' }).success).toBe(false)
    expect(SeedProductSchema.safeParse({ priceCents: -1 }).success).toBe(false)
    expect(SeedProductSchema.safeParse({ stock: -1 }).success).toBe(false)
    expect(SeedProductSchema.safeParse({ priceCents: 1.5 }).success).toBe(false)
  })
})
