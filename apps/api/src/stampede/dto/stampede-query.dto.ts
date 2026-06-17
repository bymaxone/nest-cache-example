/**
 * Zod schema for the stampede-lab query (`POST /stampede?productId=&concurrency=&lockMs=`).
 *
 * Layer: stampede/dto. All three values arrive as query strings, so `z.coerce`
 * narrows them to their target types. `productId` is constrained to a safe charset
 * (excludes the cache key separator `:`) so a caller cannot craft a key outside the
 * `stampede`/`product` prefixes — the same defence the TTL-seed DTO applies.
 */
import { z } from 'zod'

/** Allowed `productId` charset — alphanumerics, dash, underscore (1–64 chars); excludes `:`. */
const PRODUCT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/
/** Fewest contenders a burst may fire. */
const MIN_CONCURRENCY = 1
/** Most contenders a single burst may fire — bounds the in-process fan-out. */
const MAX_CONCURRENCY = 100
/** Default burst size — matches the dashboard's "Fire 10 requests" control. */
const DEFAULT_CONCURRENCY = 10
/** Shortest lock TTL (ms) — long enough for the winner to populate the cache. */
const MIN_LOCK_MS = 50
/** Longest lock TTL (ms) — caps how long a contender can ever wait. */
const MAX_LOCK_MS = 60_000
/** Default lock TTL (ms) — comfortably longer than the simulated origin latency. */
const DEFAULT_LOCK_MS = 2000

/**
 * Validates the query for `POST /stampede`.
 *
 * - `productId` — the (uncached) product every contender races for.
 * - `concurrency` — how many concurrent contenders to fire (default 10).
 * - `lockMs` — the single-flight lock TTL in milliseconds (default 2000); also
 *   the upper bound on how long a losing contender waits for the cache to fill.
 */
export const StampedeQuerySchema = z.object({
  productId: z.coerce.string().regex(PRODUCT_ID_PATTERN),
  concurrency: z.coerce
    .number()
    .int()
    .min(MIN_CONCURRENCY)
    .max(MAX_CONCURRENCY)
    .default(DEFAULT_CONCURRENCY),
  lockMs: z.coerce.number().int().min(MIN_LOCK_MS).max(MAX_LOCK_MS).default(DEFAULT_LOCK_MS),
})

/** Inferred type from {@link StampedeQuerySchema}. */
export type StampedeQuery = z.infer<typeof StampedeQuerySchema>
