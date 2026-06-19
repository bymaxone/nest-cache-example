/**
 * Accept/reject specs for the error-code path-param DTO.
 *
 * Covers the `startsWith('cache.')` normalization transform (both arms) and the
 * membership refine against the canonical CACHE_ERROR_CODES set.
 *
 * @module errors-demo/dto/error-code-param.dto.spec
 */
import { errorCodeParamSchema } from './error-code-param.dto.js'

describe('errorCodeParamSchema', () => {
  it('normalizes a bare snake suffix to the full cache.<snake> value', () => {
    /* Accept: the transform's false arm prefixes `cache.` then the refine passes. */
    expect(errorCodeParamSchema.parse({ code: 'invalid_key' })).toEqual({
      code: 'cache.invalid_key',
    })
  })

  it('accepts an already-namespaced value unchanged', () => {
    /* Accept: the transform's true arm (already starts with `cache.`) passes through. */
    expect(errorCodeParamSchema.parse({ code: 'cache.connection_failed' })).toEqual({
      code: 'cache.connection_failed',
    })
  })

  it('rejects an unknown code in both bare and namespaced forms', () => {
    /* Reject: the refine fails for a value not in CACHE_ERROR_CODES — a 400, never a 500. */
    expect(errorCodeParamSchema.safeParse({ code: 'totally_bogus' }).success).toBe(false)
    expect(errorCodeParamSchema.safeParse({ code: 'cache.totally_bogus' }).success).toBe(false)
  })
})
