/**
 * Accept/reject specs for the catalog product path-params DTO.
 *
 * @module catalog/dto/product-params.dto.spec
 */
import { ProductParamsSchema } from './product-params.dto.js'

describe('ProductParamsSchema', () => {
  it('accepts a non-empty id', () => {
    /* Accept: a non-empty `:id` segment. */
    expect(ProductParamsSchema.parse({ id: '42' })).toEqual({ id: '42' })
  })

  it('rejects an empty id', () => {
    /* Reject: the min(1) bound forbids an empty id. */
    expect(ProductParamsSchema.safeParse({ id: '' }).success).toBe(false)
  })
})
