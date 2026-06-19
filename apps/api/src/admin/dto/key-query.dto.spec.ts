/**
 * Accept/reject specs for the key-browser query DTO.
 *
 * Guards each branch: optional filters, the `type` enum, the coercion of
 * `hasTtl`, the `strategy` default/enum, and the coerced/bounded `limit`.
 *
 * @module admin/dto/key-query.dto.spec
 */
import { keyQuerySchema } from './key-query.dto.js'

describe('keyQuerySchema', () => {
  it('applies defaults and leaves optional filters absent on an empty query', () => {
    /* Accept: empty query → strategy defaults to 'scan', limit to 200, optionals stay absent. */
    const parsed = keyQuerySchema.parse({})
    expect(parsed).toEqual({ strategy: 'scan', limit: 200 })
  })

  it('accepts every filter and coerces hasTtl/limit', () => {
    /* Accept: all filters set; hasTtl/limit coerce from query strings to their target types. */
    const parsed = keyQuerySchema.parse({
      prefix: 'product',
      pattern: '*',
      tenant: 't1',
      type: 'hash',
      hasTtl: 'true',
      strategy: 'keys',
      cursor: '0',
      limit: '500',
    })
    expect(parsed).toMatchObject({ type: 'hash', hasTtl: true, strategy: 'keys', limit: 500 })
  })

  it("coerces the string 'false' for hasTtl to true (Boolean coercion quirk)", () => {
    /* Accept: z.coerce.boolean() runs Boolean(x), so a non-empty 'false' string becomes true. */
    expect(keyQuerySchema.parse({ hasTtl: 'false' }).hasTtl).toBe(true)
  })

  it('rejects an unknown type enum value', () => {
    /* Reject: `type` outside the string/hash/set enum. */
    expect(keyQuerySchema.safeParse({ type: 'list' }).success).toBe(false)
  })

  it('rejects an unknown strategy enum value', () => {
    /* Reject: `strategy` outside scan/keys. */
    expect(keyQuerySchema.safeParse({ strategy: 'glob' }).success).toBe(false)
  })

  it('rejects a non-positive, non-numeric, or over-cap limit', () => {
    /* Reject: limit must be a positive integer ≤ 1000. */
    expect(keyQuerySchema.safeParse({ limit: '0' }).success).toBe(false)
    expect(keyQuerySchema.safeParse({ limit: 'abc' }).success).toBe(false)
    expect(keyQuerySchema.safeParse({ limit: '1001' }).success).toBe(false)
  })
})
