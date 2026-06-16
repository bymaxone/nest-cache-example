/**
 * Zod schemas for tenant route path parameters.
 *
 * Layer: tenants. Validates `:t` (tenant id) and `:id` (product id) segments.
 * The tenant-id regex prevents injecting extra colon-delimited segments into
 * the cache prefix — a crafted tenant id could otherwise open keys that belong
 * to a different prefix family inside the namespace.
 */
import { z } from 'zod'

/** Safe tenant-id shape: lowercase alphanumerics and hyphens, 1–32 characters. */
const TENANT_ID_PATTERN = /^[a-z0-9-]{1,32}$/

/**
 * Validates the `{ t }` segment on routes that operate on a whole tenant
 * (e.g. `DELETE /tenants/:t/cache`).
 */
export const TenantIdParamsSchema = z.object({
  t: z.string().regex(TENANT_ID_PATTERN, 'tenant id must match [a-z0-9-]{1,32}'),
})

/** Inferred type from TenantIdParamsSchema. */
export type TenantIdParams = z.infer<typeof TenantIdParamsSchema>

/**
 * Validates both `{ t, id }` segments on routes that identify a specific
 * entity within a tenant (e.g. `GET /tenants/:t/products/:id`).
 */
export const TenantProductParamsSchema = z.object({
  t: z.string().regex(TENANT_ID_PATTERN, 'tenant id must match [a-z0-9-]{1,32}'),
  id: z.string().min(1),
})

/** Inferred type from TenantProductParamsSchema. */
export type TenantProductParams = z.infer<typeof TenantProductParamsSchema>
