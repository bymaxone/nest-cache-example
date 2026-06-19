/**
 * Unit specs for the cache options factory.
 *
 * Exercises every branch of `buildCacheOptions`, `buildSentinelBlock`,
 * `buildClusterBlock`, and their private `parseAddressList` / `parseNatMap`
 * helpers by feeding a real `ConfigService` whose internal config supplies the
 * per-mode env. No Nest DI container is booted — the factory is called directly.
 *
 * @module cache/cache.config.spec
 */
import { ConfigService } from '@nestjs/config'
import type { ICacheEvents } from '@bymax-one/nest-cache'
import type { Env } from '../config/env.schema.js'
import { buildCacheOptions, buildSentinelBlock, buildClusterBlock } from './cache.config.js'
import { MsgPackSerializer } from './msgpack.serializer.js'
import { CACHE_SCRIPTS } from './scripts/index.js'

/** A fully-populated, valid Env used as the baseline for every test. */
const baseEnv: Env = {
  NODE_ENV: 'test',
  PORT: 3001,
  WEB_ORIGIN: 'http://localhost:3000',
  REDIS_URL: 'redis://localhost:6379',
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  REDIS_DB: 0,
  CACHE_MODE: 'standalone',
  REDIS_SENTINELS: '127.0.0.1:26379',
  REDIS_SENTINEL_MASTER: 'mymaster',
  REDIS_SENTINEL_ROLE: 'master',
  REDIS_CLUSTER_NODES: '127.0.0.1:7000',
  REDIS_SENTINEL_NAT_MAP: '',
  REDIS_CLUSTER_NAT_MAP: '',
  CACHE_NAMESPACE: 'cache-example',
  CACHE_KEY_SEPARATOR: ':',
  CACHE_DEFAULT_TTL: 60,
  CACHE_SERIALIZER: 'json',
  ALLOW_FLUSH_IN_PRODUCTION: false,
  SHUTDOWN_TIMEOUT_MS: 5000,
}

/** A marker events bridge so the factory's pass-through can be asserted by identity. */
const events: ICacheEvents = { onEvent: () => undefined }

/**
 * Builds a real `ConfigService` whose internal config (checked before
 * `process.env`) returns the merged base+override env, so each test controls the
 * exact values the factory reads without booting Nest.
 *
 * @param overrides - Per-test env values layered over {@link baseEnv}.
 * @returns A typed `ConfigService` over the merged Env.
 */
function makeConfig(overrides: Partial<Env> = {}): ConfigService<Env, true> {
  return new ConfigService<Env, true>({ ...baseEnv, ...overrides })
}

/** Snapshot of the ambient REDIS_PASSWORD so the no-password branch is deterministic. */
const savedPassword = process.env.REDIS_PASSWORD

beforeAll(() => {
  // The "no password" branch reads through ConfigService → process.env fallback;
  // remove any ambient value so an absent override truly resolves to undefined.
  delete process.env.REDIS_PASSWORD
})

afterAll(() => {
  if (savedPassword !== undefined) process.env.REDIS_PASSWORD = savedPassword
})

describe('buildCacheOptions', () => {
  it('builds the standalone block with the default JSON serializer omitted', () => {
    /*
     * Scenario: CACHE_MODE=standalone with CACHE_SERIALIZER=json (the default).
     * Rule it protects: standalone populates ONLY the `connection` block, omits
     * `sentinel`/`cluster`, and — because json selects the library default — omits
     * the `serializer` key entirely (the `serializer !== undefined` false arm),
     * while passing namespace/separator/events/scripts/timeout/flush through.
     */
    const result = buildCacheOptions(makeConfig({ CACHE_MODE: 'standalone' }), events)

    expect(result.mode).toBe('standalone')
    expect(result.connection).toEqual({ url: 'redis://localhost:6379' })
    expect(result.sentinel).toBeUndefined()
    expect(result.cluster).toBeUndefined()
    expect('serializer' in result).toBe(false)
    expect(result.namespace).toBe('cache-example')
    expect(result.keySeparator).toBe(':')
    expect(result.events).toBe(events)
    expect(result.scripts).toBe(CACHE_SCRIPTS)
    expect(result.shutdownTimeoutMs).toBe(5000)
    expect(result.allowFlushInProduction).toBe(false)
  })

  it('selects the MsgPack serializer when CACHE_SERIALIZER=msgpack', () => {
    /*
     * Scenario: CACHE_SERIALIZER=msgpack.
     * Rule it protects: the serializer ternary's true arm constructs a
     * MsgPackSerializer and the conditional spread INCLUDES the `serializer` key
     * (the `serializer !== undefined` true arm) — the opt-in binary codec path.
     */
    const result = buildCacheOptions(makeConfig({ CACHE_SERIALIZER: 'msgpack' }), events)

    expect('serializer' in result).toBe(true)
    expect(result.serializer).toBeInstanceOf(MsgPackSerializer)
  })

  it('builds the sentinel block and omits connection/cluster', () => {
    /*
     * Scenario: CACHE_MODE=sentinel with password + a populated natMap, plus a
     * sentinel list containing a blank entry and a host-less `:port` pair.
     * Rule it protects: sentinel mode populates ONLY `sentinel`; parseAddressList
     * drops blank entries (filter false arm) and falls back to localhost for an
     * empty host; the password and natMap conditional spreads are both INCLUDED.
     */
    const result = buildCacheOptions(
      makeConfig({
        CACHE_MODE: 'sentinel',
        REDIS_SENTINELS: 'host1:1000,,:2000',
        REDIS_PASSWORD: 'secret',
        REDIS_SENTINEL_NAT_MAP: '172.31.0.11:7000=127.0.0.1:7000',
      }),
      events,
    )

    expect('connection' in result).toBe(false)
    expect('cluster' in result).toBe(false)
    expect(result.sentinel).toEqual({
      sentinels: [
        { host: 'host1', port: 1000 },
        { host: 'localhost', port: 2000 },
      ],
      name: 'mymaster',
      role: 'master',
      password: 'secret',
      natMap: { '172.31.0.11:7000': { host: '127.0.0.1', port: 7000 } },
    })
    expect(Object.keys(result.sentinel ?? {})).toEqual([
      'sentinels',
      'name',
      'role',
      'password',
      'natMap',
    ])
  })

  it('builds the cluster block with a natMap-bearing options object', () => {
    /*
     * Scenario: CACHE_MODE=cluster with a populated natMap.
     * Rule it protects: cluster mode populates ONLY `cluster`; the natMap
     * conditional spread INCLUDES `options.natMap` (buildClusterBlock true arm).
     */
    const result = buildCacheOptions(
      makeConfig({
        CACHE_MODE: 'cluster',
        REDIS_CLUSTER_NODES: '127.0.0.1:7000,127.0.0.1:7001',
        REDIS_CLUSTER_NAT_MAP: '172.31.0.11:7000=127.0.0.1:7000',
      }),
      events,
    )

    expect('connection' in result).toBe(false)
    expect('sentinel' in result).toBe(false)
    expect(result.cluster).toEqual({
      nodes: [
        { host: '127.0.0.1', port: 7000 },
        { host: '127.0.0.1', port: 7001 },
      ],
      options: { natMap: { '172.31.0.11:7000': { host: '127.0.0.1', port: 7000 } } },
    })
  })
})

describe('buildSentinelBlock', () => {
  it('omits password and natMap when neither is configured', () => {
    /*
     * Scenario: sentinel block with no REDIS_PASSWORD and an empty natMap string.
     * Rule it protects: the password (absent → undefined) and natMap (empty →
     * undefined) conditional spreads are both OMITTED — exactOptionalPropertyTypes
     * forbids an explicit `undefined`, so the keys must not appear at all.
     */
    const block = buildSentinelBlock(makeConfig({ CACHE_MODE: 'sentinel' }))

    expect(Object.keys(block)).toEqual(['sentinels', 'name', 'role'])
    expect('password' in block).toBe(false)
    expect('natMap' in block).toBe(false)
  })

  it('parses every parseNatMap branch: blank/empty-side/proto-skip/host-fallback', () => {
    /*
     * Scenario: a natMap string mixing a blank segment, a no-`=` entry, an
     * empty-announced entry, the three prototype-polluting keys, a normal pair,
     * and a host-less reachable side.
     * Rule it protects: parseNatMap skips blank entries, skips entries missing
     * either side, NEVER writes `__proto__`/`constructor`/`prototype` keys
     * (prototype-pollution guard), and falls back to localhost for an empty host —
     * keeping only the two legitimate pairs.
     */
    const natMap =
      ',noeq,=9.9.9.9:9,__proto__=1.1.1.1:1,constructor=2.2.2.2:2,' +
      'prototype=3.3.3.3:3,good:7000=4.4.4.4:7000,loc:8000=:8080'
    const block = buildSentinelBlock(
      makeConfig({ CACHE_MODE: 'sentinel', REDIS_SENTINEL_NAT_MAP: natMap }),
    )

    expect(block.natMap).toEqual({
      'good:7000': { host: '4.4.4.4', port: 7000 },
      'loc:8000': { host: 'localhost', port: 8080 },
    })
    // Prototype-pollution guard: the dangerous announced keys are never written.
    expect(Object.prototype.hasOwnProperty.call(block.natMap, '__proto__')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(block.natMap, 'constructor')).toBe(false)
  })

  it('throws on a colon-less sentinel address (absent port)', () => {
    /*
     * Scenario: a sentinel entry with no `:port` segment at all.
     * Rule it protects: a colon-less entry takes the `portText = ''` default, which
     * parses to NaN, so parseAddressList fails fast with a readable error (the
     * Number.isNaN throw arm) rather than silently producing a NaN port.
     */
    expect(() =>
      buildSentinelBlock(makeConfig({ CACHE_MODE: 'sentinel', REDIS_SENTINELS: 'hostonly' })),
    ).toThrow(/Invalid Redis address "hostonly"/)
  })

  it('throws on a colon-less natMap target (absent port)', () => {
    /*
     * Scenario: a natMap whose reachable side has no `:port` segment.
     * Rule it protects: the colon-less reachable side takes the `portText = ''`
     * default, parses to NaN, and parseNatMap fails fast with a readable error (the
     * Number.isNaN throw arm) rather than emitting a NaN-port target.
     */
    expect(() =>
      buildSentinelBlock(
        makeConfig({ CACHE_MODE: 'sentinel', REDIS_SENTINEL_NAT_MAP: 'a:1=reachhost' }),
      ),
    ).toThrow(/Invalid natMap target "reachhost"/)
  })
})

describe('buildClusterBlock', () => {
  it('omits options when no natMap is configured', () => {
    /*
     * Scenario: cluster block with an empty natMap string.
     * Rule it protects: an empty natMap yields undefined, so the `options`
     * conditional spread is OMITTED (buildClusterBlock false arm) and ioredis
     * defaults apply — only the seed `nodes` are supplied.
     */
    const block = buildClusterBlock(
      makeConfig({ CACHE_MODE: 'cluster', REDIS_CLUSTER_NODES: '127.0.0.1:7000' }),
    )

    expect(block.nodes).toEqual([{ host: '127.0.0.1', port: 7000 }])
    expect(Object.keys(block)).toEqual(['nodes'])
    expect('options' in block).toBe(false)
  })
})
