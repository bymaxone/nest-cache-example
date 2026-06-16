/**
 * Tenants controller — prefix-scoped tenant isolation and namespace boundary proof.
 *
 * Layer: tenants. Thin controller: validates inputs via Zod, delegates to
 * TenantsService, and returns the typed result. No business logic here.
 *
 * Route overview (all under /tenants):
 *   GET    /:t/products/:id   — tenant-scoped read-through (prefix-scoped get/set)
 *   DELETE /:t/cache          — clear one tenant's keys (scan → delMany)
 *   POST   /seed-foreign      — seed a foreign-namespace key via raw getClient()
 *   POST   /prove-isolation   — namespace flush + assert foreign key survives
 */
import { Controller, Delete, Get, Param, Post } from '@nestjs/common'
import { TenantsService } from './tenants.service.js'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import {
  TenantProductParamsSchema,
  TenantIdParamsSchema,
  type TenantProductParams,
  type TenantIdParams,
} from './dto/tenant-params.dto.js'
import type { Product } from '../catalog/product.types.js'

/**
 * Handles all /tenants routes.
 *
 * Every route delegates immediately to TenantsService; this class owns only
 * input binding and HTTP status semantics.
 */
@Controller('tenants')
export class TenantsController {
  constructor(private readonly service: TenantsService) {}

  /**
   * GET /tenants/:t/products/:id — tenant-scoped product read-through.
   *
   * The product is keyed under `cache-example:tenant:{t}:product:{id}`.
   * Cache hit: returns `source: 'cache'`. Cache miss: loads from the in-memory
   * origin (or synthesizes a placeholder), caches the result with a TTL, and
   * returns `source: 'origin'`. A second identical request returns `source: 'cache'`.
   *
   * @param params - Validated path params `{ t: tenantId, id: productId }`.
   * @returns `{ data: Product, source: 'cache' | 'origin' }`.
   */
  @Get(':t/products/:id')
  async getProduct(
    @Param(new ZodValidationPipe(TenantProductParamsSchema)) params: TenantProductParams,
  ): Promise<{ data: Product; source: 'cache' | 'origin' }> {
    return this.service.getProduct(params.t, params.id)
  }

  /**
   * DELETE /tenants/:t/cache — clear all cached keys for one tenant.
   *
   * Scans all keys under the tenant's root prefix `tenant:{t}:*` via
   * `CacheService.scan`, then deletes them in one `delMany` call. Covers all
   * entity types cached under this tenant — not limited to products. Other
   * tenants' keys are not touched.
   *
   * In cluster mode surfaces `CacheException('cache.unsupported_in_cluster')` (HTTP 503)
   * via the global CacheExceptionFilter.
   *
   * @param params - Validated path params `{ t: tenantId }`.
   * @returns `{ tenant, scannedKeys, deleted }`.
   */
  @Delete(':t/cache')
  async clearTenant(
    @Param(new ZodValidationPipe(TenantIdParamsSchema)) params: TenantIdParams,
  ): Promise<{ tenant: string; scannedKeys: number; deleted: number }> {
    return this.service.clearTenant(params.t)
  }

  /**
   * POST /tenants/seed-foreign — seed a key under a foreign namespace via the raw client.
   *
   * Anti-pattern demo: writes `other-app:demo` directly through `getClient()`,
   * bypassing the library's namespace. This is the ONLY sanctioned raw-client
   * write in the example — it exists solely to prove that `flushNamespace()`
   * leaves keys outside `cache-example:*` intact. Do NOT replicate in real code.
   *
   * @returns `{ key: 'other-app:demo', written: true }`.
   */
  @Post('seed-foreign')
  async seedForeignNamespace(): Promise<{ key: string; written: true }> {
    return this.service.seedForeignNamespace()
  }

  /**
   * POST /tenants/prove-isolation — namespace flush + foreign-key survival proof.
   *
   * Ensures `other-app:demo` exists, flushes all `cache-example:*` keys via
   * `CacheService.flushNamespace()`, then confirms the foreign key survived.
   *
   * In `NODE_ENV=production` with `allowFlushInProduction: false`, the flush
   * surfaces `CacheException('cache.flush_disabled_in_production')` (HTTP 403)
   * via the global CacheExceptionFilter — not caught here.
   *
   * @returns `{ flushedNamespaceKeys, foreignKeySurvived }`.
   */
  @Post('prove-isolation')
  async proveIsolation(): Promise<{
    flushedNamespaceKeys: number
    foreignKeySurvived: boolean
  }> {
    return this.service.proveIsolation()
  }
}
