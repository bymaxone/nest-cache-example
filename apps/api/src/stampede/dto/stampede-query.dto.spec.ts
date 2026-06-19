/**
 * Accept/reject specs for the stampede-lab query DTO.
 *
 * Covers the productId charset regex, the coerced/bounded concurrency and lockMs
 * fields, and their defaults.
 *
 * @module stampede/dto/stampede-query.dto.spec
 */
import { StampedeQuerySchema } from './stampede-query.dto.js'

describe('StampedeQuerySchema', () => {
  it('accepts a safe productId and applies concurrency/lockMs defaults', () => {
    /* Accept: a charset-safe productId with concurrency=10 and lockMs=2000 defaults. */
    expect(StampedeQuerySchema.parse({ productId: 'sku-1_A' })).toEqual({
      productId: 'sku-1_A',
      concurrency: 10,
      lockMs: 2000,
    })
  })

  it('coerces numeric strings within bounds', () => {
    /* Accept: query-string concurrency/lockMs coerce to numbers inside their ranges. */
    expect(
      StampedeQuerySchema.parse({ productId: 'p', concurrency: '50', lockMs: '1000' }),
    ).toEqual({ productId: 'p', concurrency: 50, lockMs: 1000 })
  })

  it('rejects a productId that violates the charset (colon) or is empty/too long', () => {
    /* Reject: the regex excludes `:` (key-separator defence), empties, and >64 chars. */
    expect(StampedeQuerySchema.safeParse({ productId: 'a:b' }).success).toBe(false)
    expect(StampedeQuerySchema.safeParse({ productId: '' }).success).toBe(false)
    expect(StampedeQuerySchema.safeParse({ productId: 'x'.repeat(65) }).success).toBe(false)
  })

  it('rejects out-of-range concurrency and lockMs', () => {
    /* Reject: concurrency ∈ [1,100], lockMs ∈ [50,60000], integers only. */
    expect(StampedeQuerySchema.safeParse({ productId: 'p', concurrency: '0' }).success).toBe(false)
    expect(StampedeQuerySchema.safeParse({ productId: 'p', concurrency: '101' }).success).toBe(
      false,
    )
    expect(StampedeQuerySchema.safeParse({ productId: 'p', lockMs: '10' }).success).toBe(false)
    expect(StampedeQuerySchema.safeParse({ productId: 'p', lockMs: '60001' }).success).toBe(false)
  })
})
