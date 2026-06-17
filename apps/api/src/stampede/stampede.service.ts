/**
 * Stampede service — the single-flight collapse that the lab demonstrates.
 *
 * Layer: stampede. Fires N concurrent contenders for one uncached product. Each
 * races the `acquireLock` single-flight Lua lock through `CacheService.eval`:
 *
 * - the **winner** (`eval` → 1) fetches the slow origin, populates the product
 *   cache, then releases the lock token-safely;
 * - the **losers** (`eval` → 0) poll the cache with a bounded backoff until the
 *   winner's value lands — a hit — rather than each hammering the origin.
 *
 * The net effect for a burst of N is exactly **1 origin fetch + (N−1) cache hits**.
 *
 * Keys are auto-namespaced by `eval` (`stampede:{id}` → `cache-example:stampede:{id}`)
 * and `ARGV` is passed verbatim; the Lua bodies are declared in code, never built
 * from request input (TECHNICAL_SPECIFICATION.md §18, §24).
 */
import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'node:crypto'
import {
  BYMAX_CACHE_SCRIPT_REGISTRY,
  CacheService,
  type ScriptManagerService,
} from '@bymax-one/nest-cache'
import { CACHE_PREFIX } from '../common/cache-keys.js'
import type { Env } from '../config/env.schema.js'
import type { StampedeQuery } from './dto/stampede-query.dto.js'
import { delay, fetchProductFromOrigin, type StampedeProduct } from './origin.js'
import type { StampedeOutcome, StampedeResult, StampedeTimelineEntry } from './stampede.types.js'

/** The single-flight lock script registered in the cache module's `scripts`. */
const ACQUIRE_LOCK = 'acquireLock'
/** The token-safe release script (compare-and-delete). */
const RELEASE_LOCK = 'releaseLock'
/** Redis integer reply that means "lock won". */
const LOCK_WON = 1
/** Poll interval (ms) a losing contender waits between cache reads. */
const LOSER_POLL_MS = 20

/**
 * Orchestrates a single-flight stampede burst and shapes the UI-ready result.
 *
 * `CacheService` is injected directly (the cache module is global). The
 * `ScriptManagerService` is injected via its public DI token,
 * {@link BYMAX_CACHE_SCRIPT_REGISTRY}, and used read-only to resolve the script
 * SHA1 the dashboard displays.
 */
@Injectable()
export class StampedeService {
  private readonly logger = new Logger(StampedeService.name)
  /** Lock-key prefix — distinct from the product (value) key. */
  private readonly lockPrefix = CACHE_PREFIX.stampede
  /** Product (value) key prefix — the read-through cache the winner populates. */
  private readonly productPrefix = CACHE_PREFIX.product
  /** TTL (seconds) applied to the populated product value. */
  private readonly ttlSeconds: number

  constructor(
    private readonly cache: CacheService,
    @Inject(BYMAX_CACHE_SCRIPT_REGISTRY)
    private readonly scripts: ScriptManagerService,
    private readonly config: ConfigService<Env, true>,
  ) {
    this.ttlSeconds = this.config.get('CACHE_DEFAULT_TTL', { infer: true })
  }

  /**
   * Fires `concurrency` concurrent contenders for `productId` and collapses them
   * into a single origin fetch.
   *
   * @param query - Validated burst parameters (`productId`, `concurrency`, `lockMs`).
   * @returns The per-contender timeline, the burst summary, and the resolved script SHA1.
   */
  async run(query: StampedeQuery): Promise<StampedeResult> {
    const { productId, concurrency, lockMs } = query

    const timeline = await Promise.all(
      Array.from({ length: concurrency }, (_unused, index) =>
        this.contend(index, productId, lockMs),
      ),
    )

    const originFetches = timeline.filter((entry) => entry.outcome === 'origin').length
    const cacheHits = timeline.filter((entry) => entry.outcome === 'hit').length

    // Read-only: the script is already registered declaratively via `options.scripts`,
    // so `load` just returns its stable SHA1 (no re-register, no inlined Lua).
    const sha = await this.scripts.load(ACQUIRE_LOCK)

    return {
      productId,
      timeline,
      summary: { concurrency, originFetches, cacheHits, hitRate: cacheHits / concurrency },
      script: { name: ACQUIRE_LOCK, sha },
    }
  }

  /**
   * Runs one contender: attempt the lock, then branch into the winner or loser path.
   *
   * @param index - Zero-based position in the burst.
   * @param productId - The contended product id.
   * @param lockMs - Lock TTL (ms) and the cap on a loser's wait.
   * @returns This contender's timeline entry.
   */
  private async contend(
    index: number,
    productId: string,
    lockMs: number,
  ): Promise<StampedeTimelineEntry> {
    const token = randomUUID()
    const startedAt = Date.now()

    // KEYS auto-namespaced by eval → cache-example:stampede:{productId}; ARGV passed untouched.
    const reply = await this.cache.eval(ACQUIRE_LOCK, [this.lockKey(productId)], [token, lockMs])
    const isWinner = reply === LOCK_WON

    const { role, outcome } = isWinner
      ? { role: 'won' as const, outcome: await this.runWinner(productId, token) }
      : { role: 'waited' as const, outcome: await this.runLoser(productId, lockMs) }

    const finishedAt = Date.now()
    return {
      index,
      token,
      role,
      outcome,
      startedAt,
      finishedAt,
      durationMs: finishedAt - startedAt,
    }
  }

  /**
   * Winner path: fetch the slow origin, populate the product cache, release the lock.
   *
   * The release runs in `finally` so a winner that throws mid-fetch still frees the
   * lock token-safely instead of leaving losers to wait out the full TTL.
   *
   * @param productId - The contended product id.
   * @param token - This winner's lock token.
   * @returns Always `'origin'` — the winner is the one contender that hits the origin.
   */
  private async runWinner(productId: string, token: string): Promise<StampedeOutcome> {
    try {
      const product = await fetchProductFromOrigin(productId)
      await this.cache.set<StampedeProduct>(this.productPrefix, productId, product, this.ttlSeconds)
      return 'origin'
    } finally {
      // Release is best-effort: a failure here must not mask the fetch/set outcome
      // above (a throw in `finally` would replace it), and the lock expires on its
      // own via the PX TTL anyway.
      try {
        await this.releaseLock(productId, token)
      } catch (err) {
        this.logger.warn(
          `Lock release failed for ${this.lockKey(productId)} (expires via TTL): ${
            err instanceof Error ? err.message : String(err)
          }`,
        )
      }
    }
  }

  /**
   * Loser path: wait for the winner to populate the cache, then read the hit.
   *
   * The wait is bounded by `lockMs` (the longest the lock can be held) so the
   * request always terminates. If the cache is still empty when the bound elapses
   * — e.g. the winner errored, or `lockMs` was set below the origin latency — the
   * loser fetches the origin itself and populates the cache so any remaining losers
   * (and the next burst) collapse onto its result rather than each re-fetching.
   *
   * @param productId - The contended product id.
   * @param lockMs - Upper bound (ms) on the wait, derived from the lock TTL.
   * @returns `'hit'` when the winner-populated value was read, else `'origin'`.
   */
  private async runLoser(productId: string, lockMs: number): Promise<StampedeOutcome> {
    const deadline = Date.now() + lockMs
    while (Date.now() < deadline) {
      const cached = await this.cache.get<StampedeProduct>(this.productPrefix, productId)
      if (cached !== null) return 'hit'
      await delay(LOSER_POLL_MS)
    }
    // Degraded fallback: the holder never populated the cache within the lock window.
    // Fetch and populate so this loser is not empty-handed and stragglers can hit.
    const product = await fetchProductFromOrigin(productId)
    await this.cache.set<StampedeProduct>(this.productPrefix, productId, product, this.ttlSeconds)
    return 'origin'
  }

  /**
   * Releases the lock token-safely (compare-and-delete via the `releaseLock` script).
   *
   * A blind `DEL` could delete a lock a later winner already re-acquired; the Lua
   * compare-and-delete deletes only when this contender's token still owns the key.
   *
   * @param productId - The contended product id.
   * @param token - The token to match before deleting.
   * @returns Resolves once the release attempt completes.
   */
  private async releaseLock(productId: string, token: string): Promise<void> {
    // KEYS auto-namespaced by eval; ARGV (the owner token) passed untouched.
    await this.cache.eval(RELEASE_LOCK, [this.lockKey(productId)], [token])
  }

  /** Builds the bare (pre-namespace) lock key `eval` will namespace for us. */
  private lockKey(productId: string): string {
    return `${this.lockPrefix}:${productId}`
  }
}
