/**
 * Accept/reject specs for the tenant path-param DTOs.
 *
 * Covers the tenant-id charset regex (lowercase alphanumerics + hyphen, 1–32)
 * on both the single-segment and the tenant+product two-segment schemas.
 *
 * @module tenants/dto/tenant-params.dto.spec
 */
import { TenantIdParamsSchema, TenantProductParamsSchema } from './tenant-params.dto.js'

describe('TenantIdParamsSchema', () => {
  it('accepts a safe tenant id', () => {
    /* Accept: lowercase alphanumerics and hyphens within 1–32 chars. */
    expect(TenantIdParamsSchema.parse({ t: 'tenant-42' })).toEqual({ t: 'tenant-42' })
  })

  it('rejects uppercase, underscore, empty, and over-length tenant ids', () => {
    /* Reject: the regex forbids anything outside [a-z0-9-]{1,32}. */
    expect(TenantIdParamsSchema.safeParse({ t: 'Tenant' }).success).toBe(false)
    expect(TenantIdParamsSchema.safeParse({ t: 'a_b' }).success).toBe(false)
    expect(TenantIdParamsSchema.safeParse({ t: '' }).success).toBe(false)
    expect(TenantIdParamsSchema.safeParse({ t: 'a'.repeat(33) }).success).toBe(false)
  })
})

describe('TenantProductParamsSchema', () => {
  it('accepts a safe tenant id with a non-empty product id', () => {
    /* Accept: valid tenant id plus a non-empty product id. */
    expect(TenantProductParamsSchema.parse({ t: 'acme', id: 'p1' })).toEqual({
      t: 'acme',
      id: 'p1',
    })
  })

  it('rejects an invalid tenant id or an empty product id', () => {
    /* Reject: tenant regex and product id min(1). */
    expect(TenantProductParamsSchema.safeParse({ t: 'BAD', id: 'p1' }).success).toBe(false)
    expect(TenantProductParamsSchema.safeParse({ t: 'acme', id: '' }).success).toBe(false)
  })
})
