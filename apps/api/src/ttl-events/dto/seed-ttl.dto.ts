/**
 * Zod schema for the TTL-demo seed body.
 *
 * Layer: ttl-events. Both fields are optional with safe defaults: an absent `id`
 * is generated server-side, and `ttlSeconds` defaults to a short value and is
 * bounded to a small range so the demo round-trips quickly and a key can never be
 * pinned for an unreasonable duration.
 */
import { z } from 'zod'

/** Lower bound (seconds) for a demo TTL — long enough to observe the countdown. */
const MIN_TTL_SECONDS = 1
/** Upper bound (seconds) for a demo TTL — keeps this a demo seed, not a write API. */
const MAX_TTL_SECONDS = 120
/** Default TTL (seconds) — short, so the expiry event arrives within the demo window. */
const DEFAULT_TTL_SECONDS = 5
/**
 * Allowed id charset — alphanumerics, dash, underscore (1–64 chars). Excludes the
 * cache key separator (`:`), so a caller cannot craft a key outside the demo prefix.
 */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

/**
 * Body for `POST /ttl-events/seed`.
 *
 * `id` is an optional explicit key id constrained to {@link ID_PATTERN}; when
 * omitted the service generates a UUID. `ttlSeconds` defaults to
 * `DEFAULT_TTL_SECONDS` (5s) and is clamped to `[MIN_TTL_SECONDS, MAX_TTL_SECONDS]`
 * (1–120s).
 */
export const SeedTtlSchema = z.object({
  id: z.string().regex(ID_PATTERN).optional(),
  ttlSeconds: z
    .number()
    .int()
    .min(MIN_TTL_SECONDS)
    .max(MAX_TTL_SECONDS)
    .default(DEFAULT_TTL_SECONDS),
})

/** Inferred type from {@link SeedTtlSchema}. */
export type SeedTtlDto = z.infer<typeof SeedTtlSchema>
