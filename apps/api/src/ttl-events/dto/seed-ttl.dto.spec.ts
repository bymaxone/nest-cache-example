/**
 * Accept/reject specs for the TTL-demo seed body DTO.
 *
 * Covers the optional id charset regex and the bounded ttlSeconds (1–120,
 * default 5).
 *
 * @module ttl-events/dto/seed-ttl.dto.spec
 */
import { SeedTtlSchema } from './seed-ttl.dto.js'

describe('SeedTtlSchema', () => {
  it('defaults ttlSeconds to 5 and allows an absent id', () => {
    /* Accept: empty body → ttlSeconds default 5; id stays absent (service generates one). */
    expect(SeedTtlSchema.parse({})).toEqual({ ttlSeconds: 5 })
  })

  it('accepts a charset-safe id with an in-range ttl', () => {
    /* Accept: id within [A-Za-z0-9_-]{1,64}; ttlSeconds within [1,120]. */
    expect(SeedTtlSchema.parse({ id: 'demo_key-1', ttlSeconds: 120 })).toEqual({
      id: 'demo_key-1',
      ttlSeconds: 120,
    })
  })

  it('rejects an id with a forbidden character or excessive length', () => {
    /* Reject: the regex excludes `:` (key-separator defence) and caps length at 64. */
    expect(SeedTtlSchema.safeParse({ id: 'a:b' }).success).toBe(false)
    expect(SeedTtlSchema.safeParse({ id: 'x'.repeat(65) }).success).toBe(false)
  })

  it('rejects a ttlSeconds outside the 1–120 range or non-integer', () => {
    /* Reject: ttlSeconds must be an integer within [1,120]. */
    expect(SeedTtlSchema.safeParse({ ttlSeconds: 0 }).success).toBe(false)
    expect(SeedTtlSchema.safeParse({ ttlSeconds: 121 }).success).toBe(false)
    expect(SeedTtlSchema.safeParse({ ttlSeconds: 5.5 }).success).toBe(false)
  })
})
