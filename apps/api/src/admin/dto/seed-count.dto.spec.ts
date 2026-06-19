/**
 * Accept/reject specs for the bulk-seed count DTO.
 *
 * @module admin/dto/seed-count.dto.spec
 */
import { seedCountSchema } from './seed-count.dto.js'

describe('seedCountSchema', () => {
  it('defaults count to 50 when the query param is absent', () => {
    /* Accept: absent count → default 50. */
    expect(seedCountSchema.parse({})).toEqual({ count: 50 })
  })

  it('coerces a numeric string within bounds', () => {
    /* Accept: a query-string count coerces to a number. */
    expect(seedCountSchema.parse({ count: '123' })).toEqual({ count: 123 })
  })

  it('rejects zero, non-numeric, and over-cap counts', () => {
    /* Reject: count must be a positive integer ≤ 10000. */
    expect(seedCountSchema.safeParse({ count: '0' }).success).toBe(false)
    expect(seedCountSchema.safeParse({ count: 'x' }).success).toBe(false)
    expect(seedCountSchema.safeParse({ count: '10001' }).success).toBe(false)
  })
})
