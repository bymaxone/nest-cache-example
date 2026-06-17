#!/usr/bin/env node
/**
 * Verification harness for the cache-stampede / single-flight lab.
 *
 * Boots the API in-process against a live Redis (`pnpm infra:up`), fires a burst
 * of 10 concurrent contenders for a FRESH (therefore uncached) product, and proves
 * the single-flight collapse:
 *
 *   - exactly 1 origin fetch + 9 cache hits;
 *   - the timeline shows one `won`/`origin` contender and nine `waited`/`hit`;
 *   - `ScriptManagerService.load('acquireLock')` returns a stable 40-char hex SHA1
 *     (two consecutive calls return the identical value).
 *
 * Run: `pnpm --filter api verify:stampede` (builds, then runs this script).
 * Requires Redis reachable at REDIS_URL (default redis://localhost:6379).
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { NestFactory } from '@nestjs/core'
import { BYMAX_CACHE_SCRIPT_REGISTRY } from '@bymax-one/nest-cache'
import { AppModule } from '../dist/app.module.js'

/** Burst size the dashboard's "Fire 10 requests" control uses. */
const CONCURRENCY = 10
/** Lock TTL (ms) — comfortably longer than the simulated origin latency. */
const LOCK_MS = 2000
/** A registered-script SHA1 is 40 lowercase hex chars. */
const SHA1_HEX = /^[0-9a-f]{40}$/

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false })
  await app.listen(0)

  try {
    const baseUrl = await app.getUrl()
    // A fresh id guarantees the product key is uncached before the burst.
    const productId = `verify-${randomUUID()}`

    const res = await fetch(
      `${baseUrl}/stampede?productId=${productId}&concurrency=${CONCURRENCY}&lockMs=${LOCK_MS}`,
      { method: 'POST' },
    )
    assert.ok(res.ok, `POST /stampede failed with HTTP ${res.status}`)
    const body = await res.json()

    // Single-flight collapse: exactly one origin fetch, the rest are cache hits.
    assert.equal(body.summary.concurrency, CONCURRENCY, 'summary.concurrency')
    assert.equal(body.summary.originFetches, 1, 'summary.originFetches must be exactly 1')
    assert.equal(
      body.summary.cacheHits,
      CONCURRENCY - 1,
      `summary.cacheHits must be exactly ${CONCURRENCY - 1}`,
    )

    // Timeline: one lock winner that fetched the origin, the rest waited then hit.
    assert.equal(body.timeline.length, CONCURRENCY, 'timeline length')
    const winners = body.timeline.filter((e) => e.role === 'won' && e.outcome === 'origin')
    const waiters = body.timeline.filter((e) => e.role === 'waited' && e.outcome === 'hit')
    assert.equal(winners.length, 1, 'exactly one won/origin contender')
    assert.equal(
      waiters.length,
      CONCURRENCY - 1,
      `exactly ${CONCURRENCY - 1} waited/hit contenders`,
    )

    // The endpoint surfaces the resolved script SHA1.
    assert.equal(body.script.name, 'acquireLock', 'script.name')
    assert.match(body.script.sha, SHA1_HEX, 'script.sha is a 40-char lowercase hex SHA1')

    // SHA1 stability: ScriptManagerService.load is read-only and idempotent.
    const scripts = app.get(BYMAX_CACHE_SCRIPT_REGISTRY)
    const shaA = await scripts.load('acquireLock')
    const shaB = await scripts.load('acquireLock')
    assert.match(shaA, SHA1_HEX, 'load() returns a 40-char lowercase hex SHA1')
    assert.equal(shaA, shaB, 'two consecutive load() calls return the identical SHA1')
    assert.equal(shaA, body.script.sha, 'load() SHA1 matches the SHA1 the endpoint returned')

    console.log('PASS — stampede verification passed')
    console.log(
      `   productId=${productId} · originFetches=${body.summary.originFetches} · ` +
        `cacheHits=${body.summary.cacheHits} · hitRate=${body.summary.hitRate} · sha=${shaA}`,
    )
  } finally {
    await app.close()
  }
}

main().catch((err) => {
  console.error('FAIL — stampede verification failed')
  console.error(err)
  process.exitCode = 1
})
