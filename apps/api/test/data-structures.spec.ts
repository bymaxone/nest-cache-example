/**
 * Fast data-structure round-trips backed by `ioredis-mock` (no Docker).
 *
 * The fast tier (spec §22 "API E2E (fast)"): `ioredis-mock` is a drop-in,
 * in-process `ioredis` replacement, so these specs exercise the library's data
 * shaping — strings, numerics, hashes, sets, batch — without a real server. The
 * `ioredis` module is substituted for `ioredis-mock` BEFORE the library loads, so
 * the `ConnectionManager`'s `new Redis(...)` is in-memory. Anything that depends on
 * real server semantics (keyspace events, Lua reload, true TTL expiry) lives in the
 * Testcontainers tier instead.
 *
 * @module test/data-structures.spec
 */
import { jest } from '@jest/globals'
import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import type { CacheService } from '@bymax-one/nest-cache'

// Substitute ioredis-mock for ioredis before the library is imported below, so the
// ConnectionManager builds an in-memory client and no Docker/real Redis is needed.
jest.unstable_mockModule('ioredis', async () => {
  const mock = await import('ioredis-mock')
  return { Redis: mock.default, Cluster: mock.Cluster, default: mock.default }
})

const { BymaxCacheModule, CacheService: CacheServiceClass } = await import('@bymax-one/nest-cache')

describe('CacheService data-structure round-trips (ioredis-mock, no Docker)', () => {
  let app: INestApplication
  let cache: CacheService

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        BymaxCacheModule.forRoot({
          connection: { url: 'redis://localhost:6379' },
          namespace: 'cache-example',
        }),
      ],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
    cache = app.get(CacheServiceClass)
  })

  afterAll(async () => {
    await app?.close()
  })

  it('round-trips strings via set/get/setNx/exists', async () => {
    /*
     * Scenario: the simplest cached value — a string.
     * Rule it protects: set then get returns the value, exists reports presence,
     * and setNx is create-only (false when the key already exists, true when new).
     */
    await cache.set('str', 'a', 'hello')
    expect(await cache.get('str', 'a')).toBe('hello')
    expect(await cache.exists('str', 'a')).toBe(true)
    expect(await cache.setNx('str', 'a', 'other')).toBe(false)
    expect(await cache.setNx('str', 'b', 'new')).toBe(true)
    expect(await cache.get('str', 'b')).toBe('new')
  })

  it('round-trips numerics via incr/incrBy/decr', async () => {
    /*
     * Scenario: an atomic counter.
     * Rule it protects: incr starts at 1, an explicit `by` adds that amount, and
     * decr subtracts — the typed numeric API maps to Redis INCR/INCRBY/DECR.
     */
    expect(await cache.incr('num', 'n')).toBe(1)
    expect(await cache.incr('num', 'n', 5)).toBe(6)
    expect(await cache.decr('num', 'n')).toBe(5)
    expect(await cache.decr('num', 'n', 2)).toBe(3)
  })

  it('round-trips hashes via hset/hgetall/hdel', async () => {
    /*
     * Scenario: a structured record stored field-by-field.
     * Rule it protects: each field value is serialized/deserialized independently,
     * hgetall reconstructs the whole record, and hdel removes a single field.
     */
    expect(await cache.hset('hash', 'h', 'field1', { v: 1 })).toBe(1)
    await cache.hset('hash', 'h', 'field2', { v: 2 })
    expect(await cache.hgetall('hash', 'h')).toEqual({ field1: { v: 1 }, field2: { v: 2 } })
    expect(await cache.hdel('hash', 'h', 'field1')).toBe(1)
    expect(await cache.hget('hash', 'h', 'field1')).toBeNull()
  })

  it('round-trips sets via sadd/smembers/scard/sismember', async () => {
    /*
     * Scenario: a membership set.
     * Rule it protects: members are stored as raw strings (the serializer is
     * intentionally not applied to set members), and add/list/count/membership
     * agree on the same three elements.
     */
    expect(await cache.sadd('set', 's', 'a', 'b', 'c')).toBe(3)
    expect((await cache.smembers('set', 's')).sort()).toEqual(['a', 'b', 'c'])
    expect(await cache.scard('set', 's')).toBe(3)
    expect(await cache.sismember('set', 's', 'a')).toBe(true)
    expect(await cache.sismember('set', 's', 'z')).toBe(false)
  })

  it('round-trips batches via mset/mget with positional nulls', async () => {
    /*
     * Scenario: a multi-key read where some ids are absent.
     * Rule it protects: mset writes every entry, and mget returns values aligned
     * to the requested ids with null in the slot of a missing key.
     */
    await cache.mset('batch', [
      ['k1', { id: 1 }],
      ['k2', { id: 2 }],
    ])
    expect(await cache.mget('batch', ['k1', 'missing', 'k2'])).toEqual([{ id: 1 }, null, { id: 2 }])
  })
})
