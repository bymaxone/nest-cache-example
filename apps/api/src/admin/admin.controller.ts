/**
 * Cache Admin controller — Explorer backend routes.
 *
 * Layer: admin. Thin controller: validates inputs via Zod, delegates to
 * AdminService, and returns the typed result. No business logic here.
 *
 * Route overview (all under /admin):
 *   GET    /info                     — parsed Redis INFO, grouped by section
 *   GET    /keyspace                 — sampled type/prefix/expiry breakdowns
 *   GET    /keys                     — cursor-paged key listing (scan|keys strategy)
 *   GET    /keys/:key                — single-key inspect (type, value, TTL, bytes)
 *   DELETE /keys/:key                — delete one key
 *   POST   /keys/:key/persist        — remove TTL (make persistent)
 *   POST   /keys/:key/expire         — set a new TTL
 *   POST   /seed                     — bulk seed via pipeline()
 *   DELETE /namespace                — flush all keys in the namespace
 */
import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common'
import { z } from 'zod'
import { AdminService } from './admin.service.js'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import { keyQuerySchema } from './dto/key-query.dto.js'
import { expireKeySchema } from './dto/expire-key.dto.js'
import { seedCountSchema } from './dto/seed-count.dto.js'
import type { KeyQuery } from './dto/key-query.dto.js'
import type { ExpireKey } from './dto/expire-key.dto.js'
import type { SeedCount } from './dto/seed-count.dto.js'

/** Application namespace prefix used to scope and validate Redis key path params. */
const ADMIN_NAMESPACE_PREFIX = 'cache-example:'

/** Validates a path param that must be a fully-qualified key in the app namespace. */
const keyParamSchema = z.object({
  key: z
    .string()
    .min(1)
    .refine((k) => k.startsWith(ADMIN_NAMESPACE_PREFIX) && k.split(':').length >= 3, {
      message: `Key must be in the form '${ADMIN_NAMESPACE_PREFIX}prefix:id'`,
    }),
})

/** Known Redis INFO section names accepted by GET /admin/info. */
const infoSectionSchema = z.object({
  section: z
    .enum([
      'server',
      'clients',
      'memory',
      'persistence',
      'stats',
      'replication',
      'cpu',
      'commandstats',
      'latencystats',
      'cluster',
      'keyspace',
      'modules',
      'errorstats',
      'all',
      'default',
      'everything',
    ])
    .optional(),
})

/**
 * Handles all /admin routes (Cache Admin API / Explorer backend).
 *
 * Every route delegates immediately to AdminService; this class owns only
 * input binding and HTTP status semantics. No Swagger — documented via JSDoc.
 *
 * These routes are intentionally unauthenticated — this is a local-dev
 * reference application and authentication is out of scope for the demo. Do
 * not expose these routes in a network-accessible deployment without adding a
 * guard (e.g. an IP-allowlist middleware or a `@UseGuards` annotation).
 */
@Controller('admin')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  /**
   * GET /admin/info?section= — parsed Redis INFO.
   *
   * Calls `CacheService.info(section?)` and parses the raw text into a
   * nested `{ sectionName: { field: value } }` record. Pass `section` to
   * restrict the result to a single INFO section (e.g. `memory`, `stats`).
   *
   * @param query - Validated query with optional section enum.
   * @returns Nested record of section → field/value pairs.
   */
  @Get('info')
  async getInfo(
    @Query(new ZodValidationPipe(infoSectionSchema)) query: { section?: string },
  ): Promise<Record<string, Record<string, string>>> {
    return this.service.getInfo(query.section)
  }

  /**
   * GET /admin/keyspace — sampled keyspace breakdowns.
   *
   * Returns three bounded-dimension aggregates computed from a capped SCAN
   * window (at most ~1000 keys sampled — never an exhaustive full-keyspace
   * scan). Suitable for the Overview type/prefix/expiry charts.
   *
   * @returns `{ byType, byPrefix, expiry }` breakdown objects.
   */
  @Get('keyspace')
  async getKeyspaceBreakdown(): Promise<{
    byType: { string: number; hash: number; set: number }
    byPrefix: Array<{ prefix: string; bytes: number }>
    expiry: { withTtl: number; noTtl: number }
  }> {
    return this.service.getKeyspaceBreakdown()
  }

  /**
   * GET /admin/keys — cursor-paged key listing.
   *
   * Filters by prefix/pattern/tenant and paginates through a SCAN cursor
   * (`strategy=scan`, default, non-blocking) or returns all matching keys
   * via KEYS (`strategy=keys`, O(N), dev-only). The response always contains
   * fully-namespaced keys (e.g. `cache-example:product:42`).
   *
   * A `warning` field is present in the response when `strategy=keys` to
   * signal that the command blocked the Redis server.
   *
   * @param query - Validated key-browser query.
   * @returns `{ keys, cursor, strategy, warning? }`.
   */
  @Get('keys')
  async listKeys(@Query(new ZodValidationPipe(keyQuerySchema)) query: KeyQuery): Promise<{
    keys: string[]
    cursor: string | null
    strategy: 'scan' | 'keys'
    warning?: string
  }> {
    return this.service.listKeys(query)
  }

  /**
   * GET /admin/keys/:key — single-key inspection.
   *
   * Returns the decoded value (dispatched by Redis type), the raw stored
   * string via `getClient()`, the TTL in seconds, and the per-key byte size
   * via `MEMORY USAGE`. Throws 404 when the key does not exist.
   *
   * @param params - Validated path params containing the fully-namespaced key.
   * @returns `{ key, type, value, raw, ttl, memoryBytes }`.
   */
  @Get('keys/:key')
  async inspectKey(@Param(new ZodValidationPipe(keyParamSchema)) params: { key: string }): Promise<{
    key: string
    type: string
    value: unknown
    raw: string | null
    ttl: number
    memoryBytes: number
  }> {
    return this.service.inspectKey(params.key)
  }

  /**
   * DELETE /admin/keys/:key — delete a single key.
   *
   * @param params - Validated path params containing the fully-namespaced key.
   * @returns `{ deleted: number }` — 0 when the key did not exist.
   */
  @Delete('keys/:key')
  async deleteKey(
    @Param(new ZodValidationPipe(keyParamSchema)) params: { key: string },
  ): Promise<{ deleted: number }> {
    return this.service.deleteKey(params.key)
  }

  /**
   * POST /admin/keys/:key/persist — remove the TTL from a key.
   *
   * Calls `CacheService.persist()` to make the key permanent. Returns
   * `{ ttl: -1 }` which is the TTL value for a key with no expiry.
   *
   * @param params - Validated path params containing the fully-namespaced key.
   * @returns `{ ttl: -1 }`.
   */
  @Post('keys/:key/persist')
  async persistKey(
    @Param(new ZodValidationPipe(keyParamSchema)) params: { key: string },
  ): Promise<{ ttl: number }> {
    return this.service.persistKey(params.key)
  }

  /**
   * POST /admin/keys/:key/expire — set a new TTL on a key.
   *
   * Accepts `{ seconds }` in the request body (positive integer). Returns
   * the TTL just set so the Explorer can update the ring immediately.
   *
   * @param params - Validated path params containing the fully-namespaced key.
   * @param body - Validated body with the desired TTL in seconds.
   * @returns `{ ttl: number }` — the TTL that was set.
   */
  @Post('keys/:key/expire')
  async expireKey(
    @Param(new ZodValidationPipe(keyParamSchema)) params: { key: string },
    @Body(new ZodValidationPipe(expireKeySchema)) body: ExpireKey,
  ): Promise<{ ttl: number }> {
    return this.service.expireKey(params.key, body.seconds)
  }

  /**
   * POST /admin/seed?count=N — bulk seed demo product keys.
   *
   * Writes `count` demo products in a single round-trip via `pipeline()`.
   * Keys are composed via `KeyBuilder.build()` (pipeline keys are NOT
   * auto-namespaced — `KeyBuilder` is mandatory here). Seeded keys appear
   * under `cache-example:product:*` and are immediately visible via
   * `GET /admin/keys?prefix=product`.
   *
   * @param query - Validated query with `count` (default 50, max 10_000).
   * @returns `{ seeded: number }`.
   */
  @Post('seed')
  async seed(
    @Query(new ZodValidationPipe(seedCountSchema)) query: SeedCount,
  ): Promise<{ seeded: number }> {
    return this.service.seed(query.count)
  }

  /**
   * DELETE /admin/namespace — flush all keys in the `cache-example:` namespace.
   *
   * Delegates to `CacheService.flushNamespace()`. Throws and lets the global
   * `CacheExceptionFilter` map the error to a structured response in two cases:
   * - `cache.flush_disabled_in_production` (HTTP 403) unless the module was
   *   configured with `allowFlushInProduction: true`.
   * - `cache.unsupported_in_cluster` in cluster deployments.
   *
   * @returns `{ flushed: number }` — the count of keys removed from the namespace.
   */
  @Delete('namespace')
  async flushNamespace(): Promise<{ flushed: number }> {
    return this.service.flushNamespace()
  }
}
