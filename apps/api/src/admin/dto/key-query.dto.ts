/**
 * Validated query shape for the key-browser endpoint (GET /admin/keys).
 *
 * Layer: admin/dto. Defines the shared contract between the Explorer UI and
 * the admin key-listing API: prefix/pattern/tenant filters, Redis-type filter,
 * strategy toggle (scan = safe, keys = blocking dev-only), and cursor/limit
 * pagination hints.
 *
 * Query-string values arrive as strings, so `z.coerce` is appropriate for
 * `limit` (positive integer) and `hasTtl` (boolean flag).
 */
import { z } from 'zod'

/**
 * Zod schema for the key-browser query.
 *
 * `strategy` defaults to `'scan'` (non-blocking cursor, standalone/sentinel
 * only). `'keys'` is opt-in and always surfaces a blocking warning in the
 * response body so the UI can render the persistent ⚠ badge.
 */
export const keyQuerySchema = z.object({
  prefix: z.string().optional(),
  pattern: z.string().optional(),
  tenant: z.string().optional(),
  type: z.enum(['string', 'hash', 'set']).optional(),
  hasTtl: z.coerce.boolean().optional(),
  strategy: z.enum(['scan', 'keys']).default('scan'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(1_000).default(200),
})

/** Inferred key-browser query type. */
export type KeyQuery = z.infer<typeof keyQuerySchema>
