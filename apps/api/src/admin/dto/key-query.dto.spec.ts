/**
 * Accept/reject specs for the key-browser query DTO.
 *
 * Guards each branch: optional filters, the `type` enum, the explicit boolean
 * parse of `hasTtl`, the `strategy` default/enum, and the coerced/bounded `limit`.
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

  it('accepts every filter, parsing hasTtl and coercing limit', () => {
    /* Accept: all filters set; hasTtl parses 'true' → true and limit coerces to a number. */
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

  it('parses hasTtl as an explicit boolean flag (true/false/1/0)', () => {
    /*
     * Accept: the boolean-string parser honors the literal value, so 'false'/'0'
     * disable the flag and 'true'/'1'/true enable it. This avoids the
     * Boolean('false') === true coercion footgun, keeping `?hasTtl=false` honest.
     */
    expect(keyQuerySchema.parse({ hasTtl: 'false' }).hasTtl).toBe(false)
    expect(keyQuerySchema.parse({ hasTtl: '0' }).hasTtl).toBe(false)
    expect(keyQuerySchema.parse({ hasTtl: '1' }).hasTtl).toBe(true)
    expect(keyQuerySchema.parse({ hasTtl: true }).hasTtl).toBe(true)
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
