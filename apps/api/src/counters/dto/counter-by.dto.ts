/**
 * Zod schema for the optional increment/decrement step.
 *
 * Layer: counters. Defaults to `{}` so POST routes work with no request body —
 * the service treats an absent `by` as `1` (single-step incr/decr).
 */
import { z } from 'zod'

/**
 * Validates the optional `by` field for counter increment/decrement routes.
 *
 * `by` must be a positive integer when provided; defaults to `{}` (absent)
 * so a bare POST with no body is valid.
 */
export const CounterBySchema = z
  .object({
    by: z.number().int().positive().optional(),
  })
  .default({})

/** Inferred type from CounterBySchema. */
export type CounterBy = z.infer<typeof CounterBySchema>
