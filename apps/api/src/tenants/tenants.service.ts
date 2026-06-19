/**
 * Tenants service — prefix-scoped multi-tenancy within the `cache-example` namespace.
 *
 * DESIGN NOTE — namespace vs. tenant prefix:
 *   The library binds ONE `namespace` per module instance (`cache-example`). It is
 *   NOT a per-call parameter, so "a namespace per tenant" is not possible within a
 *   single instance. Multi-tenancy is instead modeled as PREFIX SCOPING inside that
 *   one namespace: keys are `cache-example:tenant:{tenantId}:product:{id}`, where
 *   `tenant:{tenantId}:product` is the entity prefix handed to the library.
 *
 *   Clearing one tenant is a targeted `scan` + `delMany` that only touches keys
 *   under that tenant's prefix, leaving every other tenant's keys intact.
 *   `flushNamespace()` removes ALL keys in `cache-example:*` and must NOT be used
 *   for per-tenant clearing.
 *
 *   The production "namespace per tenant" pattern is one module instance per
 *   deployed tenant with a distinct `namespace` read from env
 *   (TECHNICAL_SPECIFICATION.md §12.4).
 */
import { Inject, Injectable } from '@nestjs/common'
import {
  CacheService,
  KeyBuilder,
  BYMAX_CACHE_KEY_BUILDER,
  type CacheKeyPrefix,
} from '@bymax-one/nest-cache'
import type { Product } from '../catalog/product.types.js'

/** Default TTL applied to per-tenant cached products (2 minutes). */
const TENANT_PRODUCT_TTL_SECONDS = 120

/** Artificial latency that makes a cache hit visibly faster than an origin fetch. */
const ORIGIN_LATENCY_MS = 120

/**
 * Simulates a slow origin fetch with an artificial round-trip delay.
 * Always returns `null`; the caller synthesises a placeholder product so any
 * id can be used in the demo without depending on a shared catalogue.
 *
 * @returns Always `null` — the tenants module has no local origin store.
 */
async function fetchFromOrigin(): Promise<Product | null> {
  await new Promise<void>((resolve) => setTimeout(resolve, ORIGIN_LATENCY_MS))
  return null
}

/**
 * Business logic for the Tenants API — prefix-scoped cache isolation.
 *
 * Demonstrates in-namespace multi-tenancy: read-through per tenant prefix,
 * prefix-scoped scan + delMany (per-tenant clear without touching other tenants),
 * raw getClient() for foreign-namespace writes, flushNamespace() for namespace-boundary
 * proof, and KeyBuilder for namespace-prefix introspection.
 */
@Injectable()
export class TenantsService {
  constructor(
    private readonly cache: CacheService,
    // Explicit @Inject — the published bundle is built without emitDecoratorMetadata,
    // so type-only DI cannot resolve a class provider.
    @Inject(BYMAX_CACHE_KEY_BUILDER) private readonly keyBuilder: KeyBuilder,
  ) {}

  /**
   * Builds the per-tenant entity prefix: `tenant:{tenantId}:product`.
   *
   * The tenant is the leading segment of the entity prefix, not a separate
   * namespace. The library applies `cache-example:` automatically, making the
   * full Redis key `cache-example:tenant:{tenantId}:product:{id}`.
   *
   * @param tenantId - A validated tenant identifier.
   * @returns The prefix string passed to CacheService / KeyBuilder.
   */
  private tenantPrefix(tenantId: string): CacheKeyPrefix {
    return `tenant:${tenantId}:product`
  }

  /**
   * Tenant-scoped read-through for a product.
   *
   * Cache hit: returns the product immediately from Redis.
   * Cache miss: loads from the in-memory origin (or synthesizes a placeholder
   * for unknown ids), writes the result under the tenant's prefix with a TTL,
   * then returns it.
   *
   * @param tenantId - Validated tenant identifier.
   * @param id - Product id.
   * @returns The product and the cache source (`'cache'` | `'origin'`).
   */
  async getProduct(
    tenantId: string,
    id: string,
  ): Promise<{ data: Product; source: 'cache' | 'origin' }> {
    const prefix = this.tenantPrefix(tenantId)
    const cached = await this.cache.get<Product>(prefix, id)
    if (cached !== null) return { data: cached, source: 'cache' }

    // The tenants module has no local origin store — `fetchFromOrigin` always
    // misses (see its JSDoc), so a deterministic placeholder is synthesized and
    // written through the cache on every miss.
    await fetchFromOrigin()
    const data: Product = {
      id,
      name: `Product ${id}`,
      priceCents: 999,
      tags: [`tenant:${tenantId}`],
      stock: 1,
    }
    await this.cache.set<Product>(prefix, id, data, TENANT_PRODUCT_TTL_SECONDS)
    return { data, source: 'origin' }
  }

  /**
   * Clears all cached keys under one tenant's root prefix via SCAN + delMany.
   *
   * Scans `tenant:{tenantId}:*` so ALL entity types belonging to that tenant
   * are removed in a single operation (products, and any future entity types).
   * Other tenants' keys are not touched. This is NOT `flushNamespace()` — the
   * namespace flush would remove keys for every tenant.
   *
   * The full-key prefix boundary is derived via `KeyBuilder.build()` so the
   * configured key separator is respected — no separator is hard-coded here.
   *
   * In cluster mode the underlying SCAN raises
   * `CacheException('cache.unsupported_in_cluster')` — the CacheExceptionFilter
   * maps it to a structured HTTP 503 body; this method does not catch it.
   *
   * @param tenantId - Validated tenant identifier.
   * @returns The tenant cleared, keys scanned, and keys deleted.
   */
  async clearTenant(
    tenantId: string,
  ): Promise<{ tenant: string; scannedKeys: number; deleted: number }> {
    // Root tenant prefix — broader than any single entity type so future prefixes
    // (e.g. tenant:{t}:cart) are also cleared in the same operation.
    const rootPrefix: CacheKeyPrefix = `tenant:${tenantId}`

    // Use KeyBuilder.build() with a known sentinel to derive the full namespaced
    // prefix boundary without hard-coding the key separator character.
    const SENTINEL = '~'
    const sentinelKey = this.keyBuilder.build(rootPrefix, SENTINEL)
    const fullKeyPrefix = sentinelKey.slice(0, -SENTINEL.length)

    const ids: string[] = []
    for await (const key of this.cache.scan(rootPrefix, '*')) {
      // key is fully namespaced: cache-example:tenant:{tenantId}:{entityType}:{id}
      // Strip the namespace+prefix boundary to recover the composite id delMany expects.
      const id = key.startsWith(fullKeyPrefix) ? key.slice(fullKeyPrefix.length) : key
      ids.push(id)
    }

    const deleted = ids.length ? await this.cache.delMany(rootPrefix, ids) : 0
    return { tenant: tenantId, scannedKeys: ids.length, deleted }
  }

  /**
   * DOCUMENTED ANTI-PATTERN — seeds a FOREIGN namespace via the raw ioredis client.
   *
   * Keys written through `getClient()` are NOT auto-namespaced; this bypasses
   * `KeyBuilder` ON PURPOSE, solely to prove (in `proveIsolation`) that
   * `flushNamespace()` removes only `cache-example:*` and leaves keys belonging
   * to other namespaces intact.
   *
   * Do NOT copy this pattern into real application code — always go through
   * `CacheService` / `KeyBuilder` so the namespace is applied consistently.
   *
   * @returns The foreign key written and a `written: true` confirmation.
   */
  async seedForeignNamespace(): Promise<{ key: string; written: true }> {
    const raw = this.cache.getClient() // raw ioredis — keys are NOT auto-namespaced
    const key = 'other-app:demo' // hand-built foreign key; intentionally un-namespaced
    await raw.set(key, JSON.stringify({ seededBy: 'tenants/seed-foreign' }))
    return { key, written: true }
  }

  /**
   * Proves the namespace boundary: `flushNamespace()` removes only `cache-example:*`
   * while a key in a foreign namespace (`other-app:demo`) survives intact.
   *
   * When `NODE_ENV=production` and `allowFlushInProduction` is `false`,
   * `flushNamespace()` surfaces `CacheException('cache.flush_disabled_in_production')`
   * (HTTP 403) — this method does not catch it; the CacheExceptionFilter handles it.
   *
   * @returns The number of namespace keys flushed and whether the foreign key survived.
   */
  async proveIsolation(): Promise<{
    flushedNamespaceKeys: number
    foreignKeySurvived: boolean
  }> {
    const raw = this.cache.getClient()
    if (!(await raw.exists('other-app:demo'))) await this.seedForeignNamespace()
    const flushedNamespaceKeys = await this.cache.flushNamespace()
    const foreignKeySurvived = (await raw.exists('other-app:demo')) === 1
    return { flushedNamespaceKeys, foreignKeySurvived }
  }
}
