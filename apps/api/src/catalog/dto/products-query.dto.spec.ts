/**
 * Accept/reject specs for the batch catalog query DTO.
 *
 * Covers the comma-split transform (trim + drop-empty) and the piped
 * array bounds (min 1, max 50, non-empty members).
 *
 * @module catalog/dto/products-query.dto.spec
 */
import { ProductsQuerySchema } from './products-query.dto.js'

describe('ProductsQuerySchema', () => {
  it('splits a comma list into a trimmed, de-emptied array', () => {
    /* Accept: surrounding spaces are trimmed and blank segments dropped. */
    expect(ProductsQuerySchema.parse({ ids: ' a , , b ,c ' })).toEqual({ ids: ['a', 'b', 'c'] })
  })

  it('rejects an input that yields zero ids', () => {
    /* Reject: an all-blank input collapses to [] which fails the array min(1) bound. */
    expect(ProductsQuerySchema.safeParse({ ids: ' , , ' }).success).toBe(false)
    expect(ProductsQuerySchema.safeParse({ ids: '' }).success).toBe(false)
  })

  it('rejects more than 50 ids', () => {
    /* Reject: the array max(50) bound caps the batch size. */
    const tooMany = Array.from({ length: 51 }, (_, i) => `id${i}`).join(',')
    expect(ProductsQuerySchema.safeParse({ ids: tooMany }).success).toBe(false)
  })

  it('rejects a non-string ids value', () => {
    /* Reject: the base z.string() rejects a non-string before the transform runs. */
    expect(ProductsQuerySchema.safeParse({ ids: 5 }).success).toBe(false)
  })
})
