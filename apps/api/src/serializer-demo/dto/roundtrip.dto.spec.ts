/**
 * Accept/reject specs for the serializer-demo query and body DTOs.
 *
 * @module serializer-demo/dto/roundtrip.dto.spec
 */
import { RoundtripQuerySchema, RoundtripBodySchema } from './roundtrip.dto.js'

describe('RoundtripQuerySchema', () => {
  it('defaults codec to json when absent', () => {
    /* Accept: absent codec → default 'json'. */
    expect(RoundtripQuerySchema.parse({})).toEqual({ codec: 'json' })
  })

  it('accepts the msgpack codec', () => {
    /* Accept: the explicit 'msgpack' enum value. */
    expect(RoundtripQuerySchema.parse({ codec: 'msgpack' })).toEqual({ codec: 'msgpack' })
  })

  it('rejects an unknown codec', () => {
    /* Reject: a codec outside json/msgpack. */
    expect(RoundtripQuerySchema.safeParse({ codec: 'cbor' }).success).toBe(false)
  })
})

describe('RoundtripBodySchema', () => {
  it('accepts a non-empty object payload', () => {
    /* Accept: a record with at least one field passes the refine. */
    expect(RoundtripBodySchema.parse({ a: 1, b: 'two' })).toEqual({ a: 1, b: 'two' })
  })

  it('rejects an empty object via the refine', () => {
    /* Reject: an empty object has zero keys → the "at least one field" refine fails. */
    expect(RoundtripBodySchema.safeParse({}).success).toBe(false)
  })

  it('rejects a non-object payload', () => {
    /* Reject: a non-record value is not a string-keyed record. */
    expect(RoundtripBodySchema.safeParse('nope').success).toBe(false)
  })
})
