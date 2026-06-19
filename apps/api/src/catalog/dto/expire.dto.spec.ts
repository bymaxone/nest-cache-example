/**
 * Accept/reject specs for the catalog TTL-set body DTO.
 *
 * @module catalog/dto/expire.dto.spec
 */
import { ExpireSchema } from './expire.dto.js'

describe('ExpireSchema', () => {
  it('accepts a positive integer ttlSeconds', () => {
    /* Accept: a positive integer TTL. */
    expect(ExpireSchema.parse({ ttlSeconds: 60 })).toEqual({ ttlSeconds: 60 })
  })

  it('rejects zero, negative, and non-integer ttlSeconds', () => {
    /* Reject: ttlSeconds must be a positive integer. */
    expect(ExpireSchema.safeParse({ ttlSeconds: 0 }).success).toBe(false)
    expect(ExpireSchema.safeParse({ ttlSeconds: -5 }).success).toBe(false)
    expect(ExpireSchema.safeParse({ ttlSeconds: 2.5 }).success).toBe(false)
  })
})
