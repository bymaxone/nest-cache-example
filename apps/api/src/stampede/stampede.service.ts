/**
 * Stampede service — the single-flight collapse that the lab demonstrates.
 *
 * Layer: stampede. Fires N concurrent contenders for one uncached product. Each
 * races the `acquireLock` single-flight Lua lock through `CacheService.eval`:
 *
 * - the **winner** (`eval` → 1) fetches the slow origin, populates the product
 *   cache, then releases the lock token-safely;
 * - the **losers** (`eval` → 0) poll the cache at a fixed interval until the
 *   winner's value lands — a hit — rather than each hammering the origin.
 *
 * A loser whose poll outlives the current holder re-acquires the lock itself, so
 * even a failed/slow holder is replaced by exactly one new fetcher — the collapse
 * never degrades into every loser fetching at once. The net effect for a burst of
 * N is **1 origin fetch + (N−1) cache hits**.
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
import type {
  StampedeOutcome,
  StampedeResult,
  StampedeRole,
  StampedeTimelineEntry,
} from './stampede.types.js'

/** The single-flight lock script registered in the cache module's `scripts`. */
const ACQUIRE_LOCK = 'acquireLock'
/** The token-safe release script (compare-and-delete). */
const RELEASE_LOCK = 'releaseLock'
/** Redis integer reply that means "lock won". */
const LOCK_WON = 1
/** Fixed interval (ms) a waiting contender sleeps between lock/cache checks. */
const POLL_INTERVAL_MS = 20

/** A contender's resolved role + how it obtained the value. */
interface ContenderResult {
  role: StampedeRole
  outcome: StampedeOutcome
}

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
   * Runs one contender end-to-end and records its timeline entry.
   *
   * @param index - Zero-based position in the burst.
   * @param productId - The contended product id.
   * @param lockMs - Lock TTL (ms) and the cap on how long this contender waits.
   * @returns This contender's timeline entry.
   */
  private async contend(
    index: number,
    productId: string,
    lockMs: number,
  ): Promise<StampedeTimelineEntry> {
    const token = randomUUID()
    const startedAt = Date.now()
    const { role, outcome } = await this.acquireOrWait(productId, token, lockMs)
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
   * Single-flight resolution for one contender.
   *
   * Repeatedly tries to win the lock: the winner fetches the origin once and
   * populates the cache; a contender that loses reads the value the holder is
   * populating. Because a contender re-attempts the lock each cycle, a holder that
   * dies or whose lock TTL lapses is taken over by exactly one new fetcher — the
   * degraded path stays single-flight instead of every loser fetching at once.
   *
   * Termination is bounded by `lockMs`: once that window elapses without the value
   * landing, the contender does one final read and, only if the cache is still
   * empty, a direct origin fetch so it never returns empty-handed.
   *
   * @param productId - The contended product id.
   * @param token - This contender's lock token (reused across re-attempts).
   * @param lockMs - Lock TTL (ms) and the upper bound on the wait.
   * @returns The resolved role (`won` if it fetched the origin, else `waited`) and outcome.
   */
  private async acquireOrWait(
    productId: string,
    token: string,
    lockMs: number,
  ): Promise<ContenderResult> {
    const deadline = Date.now() + lockMs
    for (;;) {
      // KEYS auto-namespaced by eval → cache-example:stampede:{productId}; ARGV untouched.
      const reply = await this.cache.eval(ACQUIRE_LOCK, [this.lockKey(productId)], [token, lockMs])
      if (reply === LOCK_WON) {
        // Won the lock — but a prior holder may have populated then released, so
        // re-check before paying for a redundant origin fetch.
        const existing = await this.cache.get<StampedeProduct>(this.productPrefix, productId)
        if (existing !== null) {
          await this.releaseLock(productId, token)
          return { role: 'waited', outcome: 'hit' }
        }
        await this.populateAndRelease(productId, token)
        return { role: 'won', outcome: 'origin' }
      }

      // Another contender holds the lock — read the value it is populating.
      const cached = await this.cache.get<StampedeProduct>(this.productPrefix, productId)
      if (cached !== null) return { role: 'waited', outcome: 'hit' }
      if (Date.now() >= deadline) break
      await delay(POLL_INTERVAL_MS)
    }

    // Bounded out: the lock stayed held the whole window without the value landing.
    // Final read; if still empty, fetch directly so the request never hangs or 404s.
    const last = await this.cache.get<StampedeProduct>(this.productPrefix, productId)
    if (last !== null) return { role: 'waited', outcome: 'hit' }
    await fetchProductFromOrigin(productId)
    return { role: 'waited', outcome: 'origin' }
  }

  /**
   * Fetches the slow origin, populates the product cache, and releases the lock.
   *
   * The release runs in `finally` so a fetch/set error still frees the lock instead
   * of leaving waiters to time out. The release is itself best-effort: a failure
   * there must not mask the fetch/set outcome (a throw in `finally` would replace
   * it), and the lock expires on its own via the PX TTL regardless.
   *
   * @param productId - The contended product id.
   * @param token - This holder's lock token.
   * @returns Resolves once the cache is populated and the release attempt completes.
   */
  private async populateAndRelease(productId: string, token: string): Promise<void> {
    try {
      const product = await fetchProductFromOrigin(productId)
      await this.cache.set<StampedeProduct>(this.productPrefix, productId, product, this.ttlSeconds)
    } finally {
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
