/**
 * Cache admin service — Explorer backend for the Cache Admin API.
 *
 * Layer: admin. Provides key-listing, single-key ops, bulk seed, namespace
 * flush, and Redis INFO/keyspace-breakdown endpoints. All reads go through
 * the `CacheService` facade where possible; raw-client (`getClient()`) is
 * used only for commands without a facade equivalent (`TYPE`, `MEMORY USAGE`)
 * or when the full namespaced key must be passed verbatim.
 *
 * Namespace handling contract (prevents double-prefixing):
 *   - The Explorer holds fully-namespaced keys, e.g. `cache-example:product:42`.
 *   - Literal-key operations (`TYPE`, `MEMORY USAGE`, `client.get`) use
 *     `getClient()` with the full key unchanged.
 *   - Facade calls (`get`, `hgetall`, `smembers`, `del`, `persist`, `expire`)
 *     require `(prefix, id)` pairs — the full key is split via
 *     `splitNamespacedKey()` which strips `KeyBuilder.getNamespacePrefix()`.
 *
 * `pipeline()` keys are NOT auto-namespaced — `KeyBuilder.build()` is
 * therefore mandatory whenever keys are written through the pipeline.
 */
import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { CacheService, KeyBuilder, BYMAX_CACHE_KEY_BUILDER } from '@bymax-one/nest-cache'
import { parseInfo } from './info.parser.js'
import type { KeyQuery } from './dto/key-query.dto.js'

/** Surfaced in the response when `strategy=keys` to warn callers. */
const KEYS_BLOCKING_WARNING = 'O(N) command — blocks the Redis server, dev only'

/** Maximum keys sampled by getKeyspaceBreakdown (RedisInsight-style analyzer). */
const KEYSPACE_SAMPLE_CAP = 1_000

/** Keys-per-batch hint passed to the Redis SCAN COUNT option. */
const SCAN_BATCH_HINT = 200

/** Result shape of the key-browser listing endpoint. */
interface KeyListResult {
  keys: string[]
  cursor: string | null
  strategy: 'scan' | 'keys'
  warning?: string
}

/** Full inspection result for a single namespaced key. */
interface KeyInspectResult {
  key: string
  type: string
  value: unknown
  raw: string | null
  ttl: number
  memoryBytes: number
}

/** Sampled keyspace breakdown; all fields computed from a bounded SCAN window. */
interface KeyspaceBreakdown {
  /** Key counts by Redis data type (sampled, not exhaustive). */
  byType: { string: number; hash: number; set: number }
  /** Estimated memory usage per entity prefix (sampled). */
  byPrefix: Array<{ prefix: string; bytes: number }>
  /** Expiry split from the sampled window. */
  expiry: { withTtl: number; noTtl: number }
}

/**
 * Business logic for the Cache Admin API (Explorer backend).
 *
 * Demonstrates `scan`, `keys`, `pipeline`, `flushNamespace`, `info`, and
 * `KeyBuilder.build` from `@bymax-one/nest-cache`, plus raw `getClient()`
 * usage for commands without a facade equivalent.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly cache: CacheService,
    // Explicit @Inject — the published bundle is built without
    // emitDecoratorMetadata, so type-only DI cannot resolve a class provider.
    @Inject(BYMAX_CACHE_KEY_BUILDER) private readonly keyBuilder: KeyBuilder,
  ) {}

  /**
   * Lists namespaced keys, paged via SCAN (non-blocking) or KEYS (O(N), dev only).
   *
   * `scan` (default) drives `CacheService.scan()` — a non-blocking cursor
   * exposed as `AsyncIterable<string>`, safe in production but only available
   * on standalone/sentinel deployments; throws `cache.unsupported_in_cluster`.
   * `keys` drives `CacheService.keys()` — an O(N) blocking command that BLOCKS
   * the Redis server; the response carries an explicit warning field.
   *
   * `query.type` and `query.hasTtl` are accepted by the DTO for UI compatibility
   * but are not currently applied to filter results — filtering by type or TTL
   * would require an additional per-key `TYPE`/`TTL` probe for every key in the
   * page, which conflicts with the non-blocking goal of the scan strategy. The
   * `query.cursor` input is not used as a SCAN resumption token because
   * `CacheService.scan()` manages its internal SCAN cursor through the
   * `AsyncIterable` and does not accept a starting offset. Every call delivers
   * the first `limit` matching keys from the beginning of a fresh scan; the
   * cursor in the response signals whether more keys may exist (`non-null`) or
   * the scan reached completion (`null`) within the requested limit.
   *
   * @param query - Validated key-browser query (prefix/pattern/tenant/strategy/limit).
   * @returns Fully-namespaced keys, the next cursor (scan) or null, and the strategy used.
   */
  async listKeys(query: KeyQuery): Promise<KeyListResult> {
    const matchPrefix = query.tenant
      ? `tenant:${query.tenant}:${query.prefix ?? ''}`
      : (query.prefix ?? '')
    const pattern = query.pattern ?? '*'
    const limit = query.limit

    // Whole-namespace browse (Explorer landing, or a tenant-only view that was
    // cleared): with neither a tenant nor an entity prefix, the facade
    // `scan`/`keys` cannot be used — they reject an empty prefix with
    // `cache.invalid_key`. Enumerate the whole namespace through the raw client
    // instead, honouring the Explorer's "empty prefix = all keys" intent. This
    // mirrors the raw-scan approach in getKeyspaceBreakdown().
    if (matchPrefix === '') {
      return this.listNamespaceKeys(pattern, limit, query.strategy)
    }

    if (query.strategy === 'keys') {
      // O(N) — blocks the Redis server. Dev-only; surfaced as a warning to callers.
      const keys = await this.cache.keys(matchPrefix, pattern)
      return { keys, cursor: null, strategy: 'keys', warning: KEYS_BLOCKING_WARNING }
    }

    // Non-blocking cursor (AsyncIterable<string>), standalone/sentinel only.
    const keys: string[] = []
    for await (const key of this.cache.scan(matchPrefix, pattern, limit)) {
      keys.push(key)
      if (keys.length >= limit) break
    }
    return {
      keys,
      cursor: keys.length >= limit ? (keys.at(-1) ?? null) : null,
      strategy: 'scan',
    }
  }

  /**
   * Enumerates keys across the whole namespace via the raw client, used when the
   * Explorer browses with neither a tenant nor an entity prefix set.
   *
   * The facade `scan`/`keys` require a non-empty prefix (an empty one raises
   * `cache.invalid_key`), so "browse everything" goes through `getClient()` with
   * the `KeyBuilder` namespace prefix — the same raw-scan approach the keyspace
   * breakdown uses. Keys returned by the raw client are already fully namespaced.
   *
   * @param pattern - The id glob applied after the namespace prefix (e.g. `*`).
   * @param limit - Maximum keys to return in this page.
   * @param strategy - `scan` (non-blocking cursor) or `keys` (O(N), dev-only).
   * @returns Fully-namespaced keys and the strategy used; `keys` carries the blocking warning.
   */
  private async listNamespaceKeys(
    pattern: string,
    limit: number,
    strategy: 'scan' | 'keys',
  ): Promise<KeyListResult> {
    const client = this.cache.getClient()
    const match = `${this.keyBuilder.getNamespacePrefix()}${pattern}`

    if (strategy === 'keys') {
      // O(N) — blocks the Redis server. Dev-only; surfaced as a warning to callers.
      const keys = await client.keys(match)
      return { keys, cursor: null, strategy: 'keys', warning: KEYS_BLOCKING_WARNING }
    }

    // Non-blocking cursor SCAN across the namespace, collecting whole batches
    // until the page limit is reached or the keyspace is fully walked.
    const collected: string[] = []
    let cursor = '0'
    do {
      const [nextCursor, batch] = await client.scan(
        cursor,
        'MATCH',
        match,
        'COUNT',
        SCAN_BATCH_HINT,
      )
      cursor = nextCursor
      collected.push(...batch)
    } while (cursor !== '0' && collected.length < limit)

    // Completion is decided by the raw SCAN cursor ('0' = keyspace fully walked),
    // not by page size alone: a page that exactly fills the limit as the cursor
    // reaches '0' is still complete, whereas an over-collected batch (cursor '0'
    // but more matches than the limit) still leaves a further page. This is more
    // precise than inferring completion from `length >= limit`.
    const keys = collected.slice(0, limit)
    const hasMore = cursor !== '0' || collected.length > limit
    return {
      keys,
      cursor: hasMore ? (keys.at(-1) ?? null) : null,
      strategy: 'scan',
    }
  }

  /**
   * Inspects a single fully-namespaced key end to end.
   *
   * Resolves the Redis data type via a raw `TYPE` probe, then decodes the
   * value through the appropriate facade (`get` / `hgetall` / `smembers`).
   * Raw string, TTL, and per-key memory are fetched via `getClient()` with
   * the verbatim full key to avoid double-namespacing.
   *
   * @param fullKey - Fully-namespaced key, e.g. `cache-example:product:42`.
   * @returns Key metadata including decoded value, raw string, TTL, and byte size.
   * @throws `NotFoundException` when the key does not exist (`TYPE` returns `none`).
   */
  async inspectKey(fullKey: string): Promise<KeyInspectResult> {
    const client = this.cache.getClient()
    const type = await client.type(fullKey)

    if (type === 'none') throw new NotFoundException(`Key '${fullKey}' does not exist`)

    const { prefix, id } = this.splitNamespacedKey(fullKey)

    // Determine the decoded value by Redis type via the namespaced facade.
    let valuePromise: Promise<unknown>
    if (type === 'string') valuePromise = this.cache.get<unknown>(prefix, id)
    else if (type === 'hash') valuePromise = this.cache.hgetall<unknown>(prefix, id)
    else if (type === 'set') valuePromise = this.cache.smembers(prefix, id)
    else valuePromise = Promise.resolve(null)

    // Literal-key reads use getClient() so the namespace is not re-applied.
    // Raw GET is only valid for string keys; issuing it against a hash or set
    // raises WRONGTYPE in Redis which would reject the whole Promise.all.
    const rawPromise = type === 'string' ? client.get(fullKey) : Promise.resolve(null)
    const [raw, ttl, memoryBytes, value] = await Promise.all([
      rawPromise,
      client.ttl(fullKey),
      client.memory('USAGE', fullKey),
      valuePromise,
    ])

    return { key: fullKey, type, value, raw, ttl, memoryBytes: memoryBytes ?? 0 }
  }

  /**
   * Deletes a fully-namespaced key.
   *
   * @param fullKey - Fully-namespaced key to delete.
   * @returns The number of keys removed (0 when the key did not exist).
   */
  async deleteKey(fullKey: string): Promise<{ deleted: number }> {
    const { prefix, id } = this.splitNamespacedKey(fullKey)
    const deleted = await this.cache.del(prefix, id)
    return { deleted }
  }

  /**
   * Removes the TTL from a fully-namespaced key, making it persistent.
   *
   * @param fullKey - Fully-namespaced key to persist.
   * @returns `{ ttl: -1 }` — the resulting TTL of a now-persistent key.
   */
  async persistKey(fullKey: string): Promise<{ ttl: number }> {
    const { prefix, id } = this.splitNamespacedKey(fullKey)
    await this.cache.persist(prefix, id)
    return { ttl: -1 }
  }

  /**
   * Sets a new TTL on a fully-namespaced key.
   *
   * @param fullKey - Fully-namespaced key to expire.
   * @param seconds - TTL in seconds (positive integer).
   * @returns The TTL just set.
   */
  async expireKey(fullKey: string, seconds: number): Promise<{ ttl: number }> {
    const { prefix, id } = this.splitNamespacedKey(fullKey)
    await this.cache.expire(prefix, id, seconds)
    return { ttl: seconds }
  }

  /**
   * Bulk-seeds demo product keys in a single round-trip using `pipeline()`.
   *
   * NOTE: `pipeline()` keys are NOT auto-namespaced — unlike the typed facade,
   * the raw pipeline writes literal keys. `KeyBuilder.build()` is therefore
   * mandatory here to keep all writes inside the `cache-example:` namespace.
   *
   * @param count - Number of demo product keys to write (validated upstream).
   * @returns The number of keys seeded.
   */
  async seed(count: number): Promise<{ seeded: number }> {
    const pipeline = this.cache.pipeline()
    for (let i = 1; i <= count; i++) {
      // KeyBuilder.build() ensures keys land in cache-example:product:i
      const key = this.keyBuilder.build('product', String(i))
      pipeline.set(
        key,
        JSON.stringify({
          id: String(i),
          name: `Seeded #${i}`,
          priceCents: i * 100,
          tags: ['seed'],
          stock: i,
        }),
      )
    }
    // Inspect exec results — individual pipeline commands do not throw on failure;
    // errors are captured as [Error, null] tuples. Count only successful commands.
    const results = await pipeline.exec()
    // Stryker disable next-line ArrayDeclaration -- the `?? []` fallback is reached only when exec() returns null; any non-empty replacement is filtered out by the `[err] === null` destructuring, yielding the same count of 0.
    const seeded = (results ?? []).filter(([err]) => err === null).length
    return { seeded }
  }

  /**
   * Flushes all keys scoped to the `cache-example:` namespace.
   *
   * Delegates to `CacheService.flushNamespace()` without wrapping in
   * try/catch so the library's guards surface through the global filter:
   * - `cache.flush_disabled_in_production` (HTTP 403) unless the module was
   *   configured with `allowFlushInProduction: true`.
   * - `cache.unsupported_in_cluster` in cluster mode.
   *
   * @returns The number of keys removed from the namespace.
   */
  async flushNamespace(): Promise<{ flushed: number }> {
    return { flushed: await this.cache.flushNamespace() }
  }

  /**
   * Returns parsed Redis INFO grouped by section.
   *
   * Calls `CacheService.info(section?)` and parses the raw text via
   * `parseInfo()`. Pass `section` to restrict the result (e.g. `'memory'`,
   * `'stats'`). When omitted, Redis returns the default set of sections.
   *
   * @param section - Optional Redis INFO section name (e.g. `'server'`, `'memory'`).
   * @returns Nested record of `sectionName → { field: value }`.
   */
  async getInfo(section?: string): Promise<Record<string, Record<string, string>>> {
    const raw = section !== undefined ? await this.cache.info(section) : await this.cache.info()
    return parseInfo(raw)
  }

  /**
   * Returns sampled keyspace breakdowns for the Overview charts.
   *
   * Samples at most `KEYSPACE_SAMPLE_CAP` keys from a bounded SCAN window
   * (RedisInsight-style analyzer — not an exhaustive scan). Per SCAN batch,
   * `TYPE` / `TTL` / `MEMORY USAGE` for all keys are fetched in a single
   * pipeline round-trip, then aggregated into three bounded dimensions:
   * - `byType`: key counts by Redis data type.
   * - `byPrefix`: total memory bytes per entity prefix.
   * - `expiry`: split of keys with vs without an active TTL.
   *
   * @returns Sampled keyspace breakdown across type, prefix, and expiry dimensions.
   */
  async getKeyspaceBreakdown(): Promise<KeyspaceBreakdown> {
    const client = this.cache.getClient()
    const nsPrefix = this.keyBuilder.getNamespacePrefix()

    const byType = { string: 0, hash: 0, set: 0 }
    const byPrefixBytes = new Map<string, number>()
    let withTtl = 0
    let noTtl = 0
    let sampled = 0
    let cursor = '0'

    do {
      const [nextCursor, batch] = await client.scan(
        cursor,
        'MATCH',
        `${nsPrefix}*`,
        'COUNT',
        SCAN_BATCH_HINT,
      )
      cursor = nextCursor

      // Collect at most (KEYSPACE_SAMPLE_CAP − sampled) keys from this SCAN batch.
      const batchSlice: string[] = []
      for (const key of batch) {
        if (sampled >= KEYSPACE_SAMPLE_CAP) break
        batchSlice.push(key)
        sampled++
      }

      if (batchSlice.length === 0) continue

      // One pipeline round-trip for the entire batch.
      // Results layout: index i*3 = TYPE, i*3+1 = TTL, i*3+2 = MEMORY USAGE.
      const batchPipeline = client.pipeline()
      for (const key of batchSlice) {
        batchPipeline.type(key)
        batchPipeline.ttl(key)
        batchPipeline.memory('USAGE', key)
      }
      const metaResults = await batchPipeline.exec()

      for (const [i, key] of batchSlice.entries()) {
        const typeEntry = metaResults?.[i * 3]
        const ttlEntry = metaResults?.[i * 3 + 1]
        const memEntry = metaResults?.[i * 3 + 2]

        // Skip keys that errored or disappeared between SCAN and the pipeline probe.
        if (!typeEntry || typeEntry[0] !== null) continue
        if (!ttlEntry || ttlEntry[0] !== null) continue

        const type = String(typeEntry[1])
        const ttlVal = Number(ttlEntry[1])

        // TTL of -2 means the key expired between the SCAN response and this probe.
        // Skip it to avoid inflating the noTtl counter with ghost entries.
        if (ttlVal === -2) {
          sampled--
          continue
        }

        const memVal = memEntry?.[0] === null ? Number(memEntry[1]) : 0

        if (type === 'string') byType.string++
        else if (type === 'hash') byType.hash++
        else if (type === 'set') byType.set++

        // TTL >= 0 means the key has an active expiry; -1 = persistent.
        if (ttlVal >= 0) withTtl++
        else noTtl++

        // Strip the namespace prefix and take the first colon-delimited segment
        // as the entity prefix (e.g. `cache-example:product:42` → `product`).
        const stripped = key.startsWith(nsPrefix) ? key.slice(nsPrefix.length) : key
        const colonIdx = stripped.indexOf(':')
        const entityPrefix = colonIdx === -1 ? stripped : stripped.slice(0, colonIdx)
        byPrefixBytes.set(entityPrefix, (byPrefixBytes.get(entityPrefix) ?? 0) + memVal)
      }
    } while (cursor !== '0' && sampled < KEYSPACE_SAMPLE_CAP)

    return {
      byType,
      byPrefix: [...byPrefixBytes.entries()].map(([prefix, bytes]) => ({ prefix, bytes })),
      expiry: { withTtl, noTtl },
    }
  }

  /**
   * Strips the namespace prefix and splits a fully-namespaced key into
   * `(prefix, id)` for use with the namespaced facade.
   *
   * Example: `cache-example:product:42` → `{ prefix: 'product', id: '42' }`.
   * The facade re-applies the namespace, so passing `(prefix, id)` produces
   * the original full key with no double-prefixing.
   *
   * @param fullKey - Fully-namespaced key, e.g. `cache-example:product:42`.
   * @returns The entity-group prefix and the id segment.
   */
  private splitNamespacedKey(fullKey: string): { prefix: string; id: string } {
    const nsPrefix = this.keyBuilder.getNamespacePrefix()
    const stripped = fullKey.startsWith(nsPrefix) ? fullKey.slice(nsPrefix.length) : fullKey
    const sep = stripped.indexOf(':')
    if (sep === -1) return { prefix: stripped, id: '' }
    return { prefix: stripped.slice(0, sep), id: stripped.slice(sep + 1) }
  }
}
