/**
 * Accept/reject specs for the increment/decrement step DTO.
 *
 * @module counters/dto/counter-by.dto.spec
 */
import { CounterBySchema } from './counter-by.dto.js'

describe('CounterBySchema', () => {
  it('defaults to {} when the body is absent', () => {
    /* Accept: a bare POST with no body → {} (service treats absent `by` as 1). */
    expect(CounterBySchema.parse(undefined)).toEqual({})
  })

  it('accepts a positive integer step', () => {
    /* Accept: an explicit positive integer `by`. */
    expect(CounterBySchema.parse({ by: 5 })).toEqual({ by: 5 })
  })

  it('rejects zero, negative, and fractional steps', () => {
    /* Reject: `by` must be a positive integer when provided. */
    expect(CounterBySchema.safeParse({ by: 0 }).success).toBe(false)
    expect(CounterBySchema.safeParse({ by: -1 }).success).toBe(false)
    expect(CounterBySchema.safeParse({ by: 1.5 }).success).toBe(false)
  })
})
