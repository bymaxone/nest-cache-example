/**
 * Accept/reject specs for the expire-key body DTO.
 *
 * @module admin/dto/expire-key.dto.spec
 */
import { expireKeySchema } from './expire-key.dto.js'

describe('expireKeySchema', () => {
  it('accepts a positive integer seconds value', () => {
    /* Accept: a JSON-parsed positive integer needs no coercion. */
    expect(expireKeySchema.parse({ seconds: 30 })).toEqual({ seconds: 30 })
  })

  it('rejects zero, negative, non-integer, and non-number seconds', () => {
    /* Reject: seconds must be a positive integer. */
    expect(expireKeySchema.safeParse({ seconds: 0 }).success).toBe(false)
    expect(expireKeySchema.safeParse({ seconds: -1 }).success).toBe(false)
    expect(expireKeySchema.safeParse({ seconds: 1.5 }).success).toBe(false)
    expect(expireKeySchema.safeParse({ seconds: '30' }).success).toBe(false)
  })
})
