/**
 * Unit: AdminService — Explorer backend (key listing, inspect, bulk ops, breakdown).
 *
 * Constructs the service directly with a hand-mocked `CacheService` facade and a
 * mocked `KeyBuilder`. Two collaborators that have no facade equivalent — the raw
 * ioredis client (`getClient()`) and the pipeline (`pipeline()`) — are modelled
 * by narrow `FakeClient` / `FakePipeline` interfaces that the real `Redis` /
 * `ChainableCommander` types are assignable to, so the bridge is a plain
 * supertype→subtype assertion (no `unknown`/`any`).
 *
 * Drives every documented branch: scan-vs-keys listing strategy, the SCAN
 * cursor/limit edges, the TYPE-dispatch of inspectKey (string/hash/set/other +
 * not-found), splitNamespacedKey's prefix/colon edges, delete/persist/expire,
 * pipeline seed (success tuples vs null exec), getInfo with/without a section,
 * and the sampled keyspace breakdown aggregation across types, prefixes, TTL,
 * error/ghost rows, empty batches, and the 1000-key sample cap.
 *
 * @module admin/admin.service.spec
 */
import { jest } from '@jest/globals'
import { NotFoundException } from '@nestjs/common'
import type { Redis, ChainableCommander } from 'ioredis'
import type { CacheService, KeyBuilder } from '@bymax-one/nest-cache'
import type { KeyQuery } from './dto/key-query.dto.js'
import { AdminService } from './admin.service.js'

/** Warning the service attaches when the blocking `keys` strategy is used. */
const KEYS_WARNING = 'O(N) command — blocks the Redis server, dev only'

/** The namespace prefix the mocked KeyBuilder reports throughout. */
const NS = 'cache-example:'

/** Result shape of a pipeline `exec()` — one `[err, value]` tuple per command. */
type PipeExecResult = Array<[Error | null, unknown]> | null

/** Narrow pipeline surface; the real `ChainableCommander` is assignable to it. */
interface FakePipeline {
  type(key: string): FakePipeline
  ttl(key: string): FakePipeline
  memory(op: 'USAGE', key: string): FakePipeline
  set(key: string, value: string): FakePipeline
  exec(): Promise<PipeExecResult>
}

/** Narrow raw-client surface; the real `Redis` is assignable to it. */
interface FakeClient {
  type(key: string): Promise<string>
  get(key: string): Promise<string | null>
  ttl(key: string): Promise<number>
  memory(op: 'USAGE', key: string): Promise<number | null>
  scan(cursor: string, m: 'MATCH', pat: string, c: 'COUNT', n: number): Promise<[string, string[]]>
  keys(pattern: string): Promise<string[]>
  pipeline(): ChainableCommander
}

/**
 * Wraps an array as a one-shot async iterable so the facade `scan()` can be
 * driven without a real Redis cursor.
 *
 * @param items - The keys the scan should yield in order.
 * @returns An async iterable over `items`.
 */
function asyncIterableOf(items: readonly string[]): AsyncIterable<string> {
  return {
    async *[Symbol.asyncIterator]() {
      // A trivial await keeps this a genuine async generator (matching the real
      // Redis cursor's async nature) and satisfies `require-await`.
      await Promise.resolve()
      for (const item of items) yield item
    },
  }
}

/**
 * Builds the AdminService with fully controllable facade, raw-client, pipeline,
 * and KeyBuilder mocks.
 *
 * @returns The service plus every inner mock for stubbing and assertions.
 */
function setup() {
  const keys = jest.fn<CacheService['keys']>()
  const scanFacade = jest.fn<CacheService['scan']>()
  const del = jest.fn<CacheService['del']>()
  const persist = jest.fn<CacheService['persist']>()
  const expire = jest.fn<CacheService['expire']>()
  const smembers = jest.fn<CacheService['smembers']>()
  const flushNamespace = jest.fn<CacheService['flushNamespace']>()
  const info = jest.fn<CacheService['info']>()
  const getInner = jest.fn<(prefix: string, id: string) => Promise<unknown>>()
  const hgetallInner = jest.fn<(prefix: string, id: string) => Promise<Record<string, unknown>>>()

  const pipeType = jest.fn<(key: string) => FakePipeline>()
  const pipeTtl = jest.fn<(key: string) => FakePipeline>()
  const pipeMemory = jest.fn<(op: 'USAGE', key: string) => FakePipeline>()
  const pipeSet = jest.fn<(key: string, value: string) => FakePipeline>()
  const pipeExec = jest.fn<() => Promise<PipeExecResult>>()
  const fakePipeline: FakePipeline = {
    type: pipeType,
    ttl: pipeTtl,
    memory: pipeMemory,
    set: pipeSet,
    exec: pipeExec,
  }

  const clientType = jest.fn<(key: string) => Promise<string>>()
  const clientGet = jest.fn<(key: string) => Promise<string | null>>()
  const clientTtl = jest.fn<(key: string) => Promise<number>>()
  const clientMemory = jest.fn<(op: 'USAGE', key: string) => Promise<number | null>>()
  const clientScan =
    jest.fn<
      (
        cursor: string,
        m: 'MATCH',
        pat: string,
        c: 'COUNT',
        n: number,
      ) => Promise<[string, string[]]>
    >()
  const clientKeys = jest.fn<(pattern: string) => Promise<string[]>>()
  const clientPipeline = jest.fn<() => ChainableCommander>(() => fakePipeline as ChainableCommander)
  const fakeClient: FakeClient = {
    type: clientType,
    get: clientGet,
    ttl: clientTtl,
    memory: clientMemory,
    scan: clientScan,
    keys: clientKeys,
    pipeline: clientPipeline,
  }

  const getClient = jest.fn<() => Redis>(() => fakeClient as Redis)
  const pipelineFacade = jest.fn<() => ChainableCommander>(() => fakePipeline as ChainableCommander)

  const cacheMock: Partial<CacheService> = {
    keys,
    scan: scanFacade,
    del,
    persist,
    expire,
    smembers,
    flushNamespace,
    info,
    get: <T>(prefix: string, id: string): Promise<T | null> =>
      getInner(prefix, id) as Promise<T | null>,
    hgetall: <T>(prefix: string, id: string): Promise<Record<string, T>> =>
      hgetallInner(prefix, id) as Promise<Record<string, T>>,
    pipeline: pipelineFacade,
    getClient,
  }

  const build = jest.fn<(prefix: string, id: string) => string>(
    (prefix, id) => `${NS}${prefix}:${id}`,
  )
  const getNamespacePrefix = jest.fn<() => string>(() => NS)
  const keyBuilderMock: Partial<KeyBuilder> = { build, getNamespacePrefix }

  const service = new AdminService(cacheMock as CacheService, keyBuilderMock as KeyBuilder)

  return {
    service,
    keys,
    scanFacade,
    del,
    persist,
    expire,
    smembers,
    flushNamespace,
    info,
    getInner,
    hgetallInner,
    pipeType,
    pipeTtl,
    pipeMemory,
    pipeSet,
    pipeExec,
    clientType,
    clientGet,
    clientTtl,
    clientMemory,
    clientScan,
    clientKeys,
    clientPipeline,
    getClient,
    pipelineFacade,
    build,
    getNamespacePrefix,
  }
}

describe('AdminService (unit)', () => {
  describe('listKeys', () => {
    it('uses the blocking KEYS command with a warning, building a tenant+prefix match', async () => {
      /*
       * Scenario: strategy=keys with tenant, prefix and pattern all set.
       * Rule it protects: the O(N) `keys` path composes `tenant:<t>:<prefix>`, passes
       * the pattern, and surfaces the dev-only blocking warning with a null cursor.
       */
      const { service, keys } = setup()
      keys.mockResolvedValue(['cache-example:product:1', 'cache-example:product:2'])
      const query: KeyQuery = {
        strategy: 'keys',
        tenant: 't1',
        prefix: 'product',
        pattern: 'p*',
        limit: 200,
      }

      const result = await service.listKeys(query)

      expect(result).toEqual({
        keys: ['cache-example:product:1', 'cache-example:product:2'],
        cursor: null,
        strategy: 'keys',
        warning: KEYS_WARNING,
      })
      expect(keys).toHaveBeenCalledWith('tenant:t1:product', 'p*')
    })

    it('scans with a tenant but no prefix/pattern, breaking at the limit and returning the last key as cursor', async () => {
      /*
       * Scenario: strategy=scan, tenant set, prefix and pattern omitted, limit 3 with
       * more keys available than the limit.
       * Rule it protects: the match collapses to `tenant:<t>:` and `*`; the loop breaks
       * once `limit` keys are collected and the cursor is the LAST collected key
       * (`keys.at(-1)`). The limit (3) and key count (≥4) are chosen so the last index
       * differs from index 1 — distinguishing `at(-1)` from any other fixed index.
       */
      const { service, scanFacade } = setup()
      scanFacade.mockReturnValue(asyncIterableOf(['k1', 'k2', 'k3', 'k4']))
      const query: KeyQuery = { strategy: 'scan', tenant: 't2', limit: 3 }

      const result = await service.listKeys(query)

      expect(result).toEqual({ keys: ['k1', 'k2', 'k3'], cursor: 'k3', strategy: 'scan' })
      expect(scanFacade).toHaveBeenCalledWith('tenant:t2:', '*', 3)
    })

    it('scans without a tenant using the bare prefix and reports a null cursor below the limit', async () => {
      /*
       * Scenario: strategy=scan, no tenant, prefix set, fewer keys than the limit.
       * Rule it protects: the non-tenant branch uses `prefix` directly, and a result
       * shorter than `limit` yields a null cursor (scan completed).
       */
      const { service, scanFacade } = setup()
      scanFacade.mockReturnValue(asyncIterableOf(['k1', 'k2']))
      const query: KeyQuery = { strategy: 'scan', prefix: 'product', limit: 5 }

      const result = await service.listKeys(query)

      expect(result).toEqual({ keys: ['k1', 'k2'], cursor: null, strategy: 'scan' })
      expect(scanFacade).toHaveBeenCalledWith('product', '*', 5)
    })

    it('scans the whole namespace via the raw client when no tenant/prefix is set', async () => {
      /*
       * Scenario: strategy=scan with neither tenant nor prefix (the Explorer landing).
       * Rule it protects: an empty match prefix must NOT reach the facade `scan` (which
       * rejects an empty prefix with cache.invalid_key); it enumerates the whole
       * namespace through the raw client using `${namespacePrefix}${pattern}`, returning
       * fully-namespaced keys with a null cursor once the scan completes below the limit.
       */
      const { service, scanFacade, clientScan } = setup()
      clientScan.mockResolvedValue(['0', ['cache-example:product:1', 'cache-example:cart:u_7']])
      const query: KeyQuery = { strategy: 'scan', limit: 200 }

      const result = await service.listKeys(query)

      expect(result).toEqual({
        keys: ['cache-example:product:1', 'cache-example:cart:u_7'],
        cursor: null,
        strategy: 'scan',
      })
      expect(clientScan).toHaveBeenCalledWith('0', 'MATCH', 'cache-example:*', 'COUNT', 200)
      // The facade scan must never be invoked with an empty prefix.
      expect(scanFacade).not.toHaveBeenCalled()
    })

    it('pages the raw namespace scan across cursors and returns the last key as cursor at the limit', async () => {
      /*
       * Scenario: strategy=scan, no tenant/prefix, limit 3, spread across two SCAN pages.
       * Rule it protects: the do/while advances the cursor across pages and breaks once
       * `limit` keys are collected, surfacing the LAST collected key as the next cursor.
       */
      const { service, clientScan } = setup()
      clientScan
        .mockResolvedValueOnce(['42', ['cache-example:product:1', 'cache-example:product:2']])
        .mockResolvedValueOnce(['0', ['cache-example:product:3', 'cache-example:product:4']])
      const query: KeyQuery = { strategy: 'scan', limit: 3 }

      const result = await service.listKeys(query)

      expect(result).toEqual({
        keys: ['cache-example:product:1', 'cache-example:product:2', 'cache-example:product:3'],
        cursor: 'cache-example:product:3',
        strategy: 'scan',
      })
      expect(clientScan).toHaveBeenNthCalledWith(1, '0', 'MATCH', 'cache-example:*', 'COUNT', 200)
      expect(clientScan).toHaveBeenNthCalledWith(2, '42', 'MATCH', 'cache-example:*', 'COUNT', 200)
    })

    it('uses the raw blocking KEYS command across the namespace when no tenant/prefix is set', async () => {
      /*
       * Scenario: strategy=keys with neither tenant nor prefix.
       * Rule it protects: the O(N) whole-namespace path runs raw `client.keys` against
       * `${namespacePrefix}${pattern}` (never the facade `keys` with an empty prefix) and
       * surfaces the dev-only blocking warning with a null cursor.
       */
      const { service, keys, clientKeys } = setup()
      clientKeys.mockResolvedValue(['cache-example:product:1', 'cache-example:tags:1'])
      const query: KeyQuery = { strategy: 'keys', limit: 200 }

      const result = await service.listKeys(query)

      expect(result).toEqual({
        keys: ['cache-example:product:1', 'cache-example:tags:1'],
        cursor: null,
        strategy: 'keys',
        warning: KEYS_WARNING,
      })
      expect(clientKeys).toHaveBeenCalledWith('cache-example:*')
      // The facade keys must never be invoked with an empty prefix.
      expect(keys).not.toHaveBeenCalled()
    })

    it('resolves a prefixed scan with no results to a null cursor via the at(-1) fallback', async () => {
      /*
       * Scenario: strategy=scan, prefix set, limit 0, the facade scan yields nothing.
       * Rule it protects: when `keys.length >= limit` holds on an EMPTY page (limit 0),
       * `keys.at(-1)` is undefined and the `?? null` fallback resolves the cursor to
       * null — the boundary the ternary's nullish branch guards.
       */
      const { service, scanFacade } = setup()
      scanFacade.mockReturnValue(asyncIterableOf([]))
      const query: KeyQuery = { strategy: 'scan', prefix: 'product', limit: 0 }

      const result = await service.listKeys(query)

      expect(result).toEqual({ keys: [], cursor: null, strategy: 'scan' })
      expect(scanFacade).toHaveBeenCalledWith('product', '*', 0)
    })

    it('resolves a whole-namespace scan with no results to a null cursor via the at(-1) fallback', async () => {
      /*
       * Scenario: strategy=scan, no tenant/prefix, limit 0, the raw scan batch is empty.
       * Rule it protects: the raw-client namespace path shares the same empty-page
       * boundary — `keys.at(-1)` undefined resolves the cursor to null through `?? null`.
       */
      const { service, clientScan } = setup()
      clientScan.mockResolvedValue(['0', []])
      const query: KeyQuery = { strategy: 'scan', limit: 0 }

      const result = await service.listKeys(query)

      expect(result).toEqual({ keys: [], cursor: null, strategy: 'scan' })
      expect(clientScan).toHaveBeenCalledWith('0', 'MATCH', 'cache-example:*', 'COUNT', 200)
    })
  })

  describe('inspectKey', () => {
    it('decodes a string key via get and reads the raw value through the client', async () => {
      /*
       * Scenario: TYPE is `string`.
       * Rule it protects: the value is decoded with the namespaced `get(prefix, id)`,
       * the raw string comes from the literal-key `client.get`, and TTL/memory pass
       * through; splitNamespacedKey strips the namespace into (product, 1).
       */
      const { service, clientType, clientGet, clientTtl, clientMemory, getInner } = setup()
      clientType.mockResolvedValue('string')
      clientGet.mockResolvedValue('{"id":"1"}')
      clientTtl.mockResolvedValue(100)
      clientMemory.mockResolvedValue(64)
      getInner.mockResolvedValue({ id: '1' })

      const result = await service.inspectKey('cache-example:product:1')

      expect(result).toEqual({
        key: 'cache-example:product:1',
        type: 'string',
        value: { id: '1' },
        raw: '{"id":"1"}',
        ttl: 100,
        memoryBytes: 64,
      })
      expect(getInner).toHaveBeenCalledWith('product', '1')
      expect(clientType).toHaveBeenCalledWith('cache-example:product:1')
      expect(clientGet).toHaveBeenCalledWith('cache-example:product:1')
      expect(clientMemory).toHaveBeenCalledWith('USAGE', 'cache-example:product:1')
    })

    it('decodes a hash key via hgetall and skips the raw GET', async () => {
      /*
       * Scenario: TYPE is `hash`.
       * Rule it protects: the value is decoded with `hgetall`, and `raw` is null because
       * a literal GET against a hash would raise WRONGTYPE (client.get not called).
       */
      const { service, clientType, clientGet, clientTtl, clientMemory, hgetallInner } = setup()
      clientType.mockResolvedValue('hash')
      clientTtl.mockResolvedValue(50)
      clientMemory.mockResolvedValue(32)
      hgetallInner.mockResolvedValue({ p1: { quantity: 2 } })

      const result = await service.inspectKey('cache-example:cart:9')

      expect(result).toEqual({
        key: 'cache-example:cart:9',
        type: 'hash',
        value: { p1: { quantity: 2 } },
        raw: null,
        ttl: 50,
        memoryBytes: 32,
      })
      expect(hgetallInner).toHaveBeenCalledWith('cart', '9')
      expect(clientGet).not.toHaveBeenCalled()
    })

    it('decodes a set key via smembers', async () => {
      /*
       * Scenario: TYPE is `set`.
       * Rule it protects: the value is the raw member list from `smembers`, and raw is null.
       */
      const { service, clientType, clientTtl, clientMemory, smembers } = setup()
      clientType.mockResolvedValue('set')
      clientTtl.mockResolvedValue(-1)
      clientMemory.mockResolvedValue(16)
      smembers.mockResolvedValue(['a', 'b'])

      const result = await service.inspectKey('cache-example:tags:p1')

      expect(result).toEqual({
        key: 'cache-example:tags:p1',
        type: 'set',
        value: ['a', 'b'],
        raw: null,
        ttl: -1,
        memoryBytes: 16,
      })
      expect(smembers).toHaveBeenCalledWith('tags', 'p1')
    })

    it('returns a null value for an unsupported type and defaults memory to 0 when MEMORY USAGE is null', async () => {
      /*
       * Scenario: TYPE is some other structure (e.g. `list`) and MEMORY USAGE is null.
       * Rule it protects: the decode falls to the `Promise.resolve(null)` arm and the
       * memory `?? 0` fallback yields 0 bytes.
       */
      const { service, clientType, clientTtl, clientMemory } = setup()
      clientType.mockResolvedValue('list')
      clientTtl.mockResolvedValue(-1)
      clientMemory.mockResolvedValue(null)

      const result = await service.inspectKey('cache-example:misc:1')

      expect(result).toEqual({
        key: 'cache-example:misc:1',
        type: 'list',
        value: null,
        raw: null,
        ttl: -1,
        memoryBytes: 0,
      })
    })

    it('throws NotFoundException when the key does not exist (TYPE = none)', async () => {
      /*
       * Scenario: TYPE returns `none`.
       * Rule it protects: a missing key short-circuits to a 404 before any value read.
       */
      const { service, clientType, clientTtl } = setup()
      clientType.mockResolvedValue('none')

      await expect(service.inspectKey('cache-example:gone:1')).rejects.toBeInstanceOf(
        NotFoundException,
      )
      await expect(service.inspectKey('cache-example:gone:1')).rejects.toThrow(
        "Key 'cache-example:gone:1' does not exist",
      )
      expect(clientTtl).not.toHaveBeenCalled()
    })
  })

  describe('deleteKey', () => {
    it('splits a fully-namespaced key and deletes via the facade', async () => {
      /*
       * Scenario: a normal `cache-example:product:5` key.
       * Rule it protects: splitNamespacedKey strips the namespace (startsWith true, colon
       * found) into (product, 5) and del returns the removed count.
       */
      const { service, del } = setup()
      del.mockResolvedValue(1)

      await expect(service.deleteKey('cache-example:product:5')).resolves.toEqual({ deleted: 1 })
      expect(del).toHaveBeenCalledWith('product', '5')
    })

    it('keeps a non-namespaced key intact when stripping (startsWith false)', async () => {
      /*
       * Scenario: a key that does not start with the namespace prefix.
       * Rule it protects: the `startsWith` guard leaves the key un-sliced, so the first
       * colon still splits it into (foreign, thing:1).
       */
      const { service, del } = setup()
      del.mockResolvedValue(0)

      await expect(service.deleteKey('foreign:thing:1')).resolves.toEqual({ deleted: 0 })
      expect(del).toHaveBeenCalledWith('foreign', 'thing:1')
    })

    it('treats a colon-less remainder as a bare prefix with an empty id', async () => {
      /*
       * Scenario: `cache-example:solo` strips to `solo` with no further colon.
       * Rule it protects: the `sep === -1` branch returns `{ prefix: 'solo', id: '' }`.
       */
      const { service, del } = setup()
      del.mockResolvedValue(0)

      await expect(service.deleteKey('cache-example:solo')).resolves.toEqual({ deleted: 0 })
      expect(del).toHaveBeenCalledWith('solo', '')
    })
  })

  describe('persistKey / expireKey', () => {
    it('persistKey strips the TTL and reports the persistent sentinel', async () => {
      /*
       * Scenario: remove a key's TTL.
       * Rule it protects: persist is called with the split (prefix, id) and the response
       * is the `{ ttl: -1 }` persistent sentinel.
       */
      const { service, persist } = setup()
      persist.mockResolvedValue(true)

      await expect(service.persistKey('cache-example:product:1')).resolves.toEqual({ ttl: -1 })
      expect(persist).toHaveBeenCalledWith('product', '1')
    })

    it('expireKey sets a new TTL and echoes the seconds back', async () => {
      /*
       * Scenario: set a 120s TTL on a key.
       * Rule it protects: expire is called with the split (prefix, id) and the seconds,
       * and the response echoes the TTL just set.
       */
      const { service, expire } = setup()
      expire.mockResolvedValue(true)

      await expect(service.expireKey('cache-example:product:1', 120)).resolves.toEqual({ ttl: 120 })
      expect(expire).toHaveBeenCalledWith('product', '1', 120)
    })
  })

  describe('seed', () => {
    it('builds namespaced keys, writes them through the pipeline, and counts only successful commands', async () => {
      /*
       * Scenario: seed 2 products where the second pipeline command errored.
       * Rule it protects: KeyBuilder.build composes each key, pipeline.set carries the
       * JSON payload, and only `[null, …]` (error-free) tuples are counted as seeded.
       */
      const { service, build, pipeSet, pipeExec, pipelineFacade } = setup()
      // Two successful tuples and one errored: the success count (2) differs from the
      // error count (1), so counting `err === null` cannot be confused with its inverse.
      pipeExec.mockResolvedValue([
        [null, 'OK'],
        [null, 'OK'],
        [new Error('boom'), null],
      ])

      const result = await service.seed(3)

      expect(result).toEqual({ seeded: 2 })
      expect(pipelineFacade).toHaveBeenCalledTimes(1)
      expect(build).toHaveBeenNthCalledWith(1, 'product', '1')
      expect(build).toHaveBeenNthCalledWith(2, 'product', '2')
      expect(build).toHaveBeenNthCalledWith(3, 'product', '3')
      expect(pipeSet).toHaveBeenNthCalledWith(
        1,
        'cache-example:product:1',
        JSON.stringify({ id: '1', name: 'Seeded #1', priceCents: 100, tags: ['seed'], stock: 1 }),
      )
      expect(pipeSet).toHaveBeenNthCalledWith(
        2,
        'cache-example:product:2',
        JSON.stringify({ id: '2', name: 'Seeded #2', priceCents: 200, tags: ['seed'], stock: 2 }),
      )
    })

    it('treats a null exec result as zero seeded keys', async () => {
      /*
       * Scenario: the pipeline exec resolves null (no results array).
       * Rule it protects: the `results ?? []` guard prevents a crash and yields 0 seeded.
       */
      const { service, pipeExec, pipeSet } = setup()
      pipeExec.mockResolvedValue(null)

      await expect(service.seed(1)).resolves.toEqual({ seeded: 0 })
      expect(pipeSet).toHaveBeenCalledTimes(1)
    })
  })

  describe('flushNamespace', () => {
    it('delegates to the facade and reports the flushed count', async () => {
      /*
       * Scenario: flush the namespace.
       * Rule it protects: the service returns `{ flushed }` from `flushNamespace()`
       * unguarded so the library's production/cluster errors surface upstream.
       */
      const { service, flushNamespace } = setup()
      flushNamespace.mockResolvedValue(42)

      await expect(service.flushNamespace()).resolves.toEqual({ flushed: 42 })
    })
  })

  describe('getInfo', () => {
    it('requests a specific section and parses the raw INFO text', async () => {
      /*
       * Scenario: getInfo('memory').
       * Rule it protects: the section is forwarded to `info(section)` and the raw text is
       * parsed into a nested section/field record.
       */
      const { service, info } = setup()
      info.mockResolvedValue('# Memory\r\nused_memory:1024\r\n')

      await expect(service.getInfo('memory')).resolves.toEqual({ memory: { used_memory: '1024' } })
      expect(info).toHaveBeenCalledWith('memory')
    })

    it('requests the default INFO when no section is given', async () => {
      /*
       * Scenario: getInfo() with no argument.
       * Rule it protects: the `section === undefined` branch calls `info()` with no
       * argument (Redis default sections).
       */
      const { service, info } = setup()
      info.mockResolvedValue('# Server\r\nredis_version:7.0.0\r\n')

      await expect(service.getInfo()).resolves.toEqual({ server: { redis_version: '7.0.0' } })
      expect(info).toHaveBeenCalledWith()
    })
  })

  describe('getKeyspaceBreakdown', () => {
    it('aggregates type/prefix/TTL across a sampled batch, skipping ghost and errored rows', async () => {
      /*
       * Scenario: one SCAN batch mixing string/hash/set/list keys, a TTL=-2 ghost, a
       * TYPE-errored row, a TTL-errored row, an errored MEMORY probe, and a colon-less
       * non-namespaced key.
       * Rule it protects: every aggregation arm — type counts, withTtl/noTtl split,
       * per-prefix byte sums (new vs existing prefix), errored/ghost skips, the
       * memory `?? 0` fallback, and the startsWith/colon stripping — lands correctly.
       */
      const { service, clientScan, pipeExec, getNamespacePrefix } = setup()
      clientScan.mockResolvedValue([
        '0',
        [
          'cache-example:product:1',
          'cache-example:cart:9',
          'cache-example:product:2',
          'cache-example:tags:x',
          'cache-example:ghost:1',
          'cache-example:e1:1',
          'cache-example:e2:1',
          'plainkey',
        ],
      ])
      const boom = new Error('probe failed')
      pipeExec.mockResolvedValue([
        [null, 'string'],
        [null, '10'],
        [null, '50'],
        [null, 'hash'],
        [null, '-1'],
        [null, '30'],
        [null, 'set'],
        [null, '5'],
        [null, '20'],
        [null, 'list'],
        [null, '3'],
        [boom, null],
        [null, 'string'],
        [null, '-2'],
        [null, '5'],
        [boom, null],
        [null, '1'],
        [null, '1'],
        [null, 'string'],
        [boom, null],
        [null, '1'],
        [null, 'string'],
        [null, '-1'],
        [null, '10'],
      ])

      const result = await service.getKeyspaceBreakdown()

      expect(result.byType).toEqual({ string: 2, hash: 1, set: 1 })
      expect(result.expiry).toEqual({ withTtl: 3, noTtl: 2 })
      expect(result.byPrefix).toEqual([
        { prefix: 'product', bytes: 70 },
        { prefix: 'cart', bytes: 30 },
        { prefix: 'tags', bytes: 0 },
        { prefix: 'plainkey', bytes: 10 },
      ])
      expect(clientScan).toHaveBeenCalledWith('0', 'MATCH', 'cache-example:*', 'COUNT', 200)
      expect(getNamespacePrefix).toHaveBeenCalled()
    })

    it('skips a batch entirely when the pipeline exec returns null (no meta)', async () => {
      /*
       * Scenario: a non-empty batch whose pipeline exec resolves null.
       * Rule it protects: the `!typeEntry` guard skips every key so nothing aggregates.
       */
      const { service, clientScan, pipeExec } = setup()
      clientScan.mockResolvedValue(['0', ['cache-example:product:1']])
      pipeExec.mockResolvedValue(null)

      const result = await service.getKeyspaceBreakdown()

      expect(result).toEqual({
        byType: { string: 0, hash: 0, set: 0 },
        byPrefix: [],
        expiry: { withTtl: 0, noTtl: 0 },
      })
    })

    it('skips a key whose TTL probe is missing from the meta results', async () => {
      /*
       * Scenario: the meta array carries the TYPE entry but not the TTL entry.
       * Rule it protects: the `!ttlEntry` guard skips the key after the TYPE guard passes.
       */
      const { service, clientScan, pipeExec } = setup()
      clientScan.mockResolvedValue(['0', ['cache-example:product:1']])
      pipeExec.mockResolvedValue([[null, 'string']])

      const result = await service.getKeyspaceBreakdown()

      expect(result.byType).toEqual({ string: 0, hash: 0, set: 0 })
    })

    it('continues past an empty batch and processes the next cursor page', async () => {
      /*
       * Scenario: the first SCAN page is empty with a non-zero cursor; the second has a key.
       * Rule it protects: an empty batchSlice `continue`s, and the do/while loops again
       * because the cursor is not '0' and the sample cap is not reached.
       */
      const { service, clientScan, pipeExec } = setup()
      clientScan
        .mockResolvedValueOnce(['7', []])
        .mockResolvedValueOnce(['0', ['cache-example:product:1']])
      pipeExec.mockResolvedValue([
        [null, 'string'],
        [null, '10'],
        [null, '50'],
      ])

      const result = await service.getKeyspaceBreakdown()

      expect(result.byType).toEqual({ string: 1, hash: 0, set: 0 })
      expect(result.expiry).toEqual({ withTtl: 1, noTtl: 0 })
      expect(result.byPrefix).toEqual([{ prefix: 'product', bytes: 50 }])
      expect(clientScan).toHaveBeenCalledTimes(2)
      expect(clientScan).toHaveBeenNthCalledWith(1, '0', 'MATCH', 'cache-example:*', 'COUNT', 200)
      expect(clientScan).toHaveBeenNthCalledWith(2, '7', 'MATCH', 'cache-example:*', 'COUNT', 200)
      // The empty first page must `continue` WITHOUT opening a pipeline — only the
      // single key on the second page is probed, so exec runs exactly once.
      expect(pipeExec).toHaveBeenCalledTimes(1)
    })

    it('stops sampling at exactly the 1000-key cap even when the cursor is still open', async () => {
      /*
       * Scenario: a single page of 1001 keys with a non-zero cursor, and meta supplied
       * for all 1001 so the 1001st key WOULD aggregate if it were sampled.
       * Rule it protects: the inner loop breaks at `sampled >= KEYSPACE_SAMPLE_CAP`
       * (exactly 1000, not 1001) and the do/while exits because `sampled < cap` is false
       * despite the open cursor. Providing full 1001-key meta makes the off-by-one
       * boundary (`>=` vs `>`, or a never-break mutant) observable as a 1001 count.
       */
      const { service, clientScan, pipeExec } = setup()
      const batch = Array.from({ length: 1001 }, (_unused, i) => `cache-example:product:${i}`)
      const meta: Array<[Error | null, unknown]> = []
      for (let i = 0; i < 1001; i++) {
        meta.push([null, 'string'], [null, '-1'], [null, '1'])
      }
      clientScan.mockResolvedValue(['5', batch])
      pipeExec.mockResolvedValue(meta)

      const result = await service.getKeyspaceBreakdown()

      expect(result.byType).toEqual({ string: 1000, hash: 0, set: 0 })
      expect(result.expiry).toEqual({ withTtl: 0, noTtl: 1000 })
      expect(result.byPrefix).toEqual([{ prefix: 'product', bytes: 1000 }])
      expect(clientScan).toHaveBeenCalledTimes(1)
    })

    it('counts a TTL=0 key as active, a set key in its bucket, and queues TYPE/TTL/MEMORY per key', async () => {
      /*
       * Scenario: a batch of one string key with TTL exactly 0 and one set key.
       * Rule it protects: the `ttlVal >= 0` boundary counts TTL=0 as withTtl (not the
       * `> 0` off-by-one); the `type === 'set'` arm increments the set bucket; and the
       * per-key loop body actually queues TYPE/TTL/MEMORY for every key (an empty body
       * would still aggregate from the mocked meta, so the queue calls are asserted).
       */
      const { service, clientScan, pipeExec, pipeType, pipeTtl, pipeMemory } = setup()
      clientScan.mockResolvedValue(['0', ['cache-example:product:1', 'cache-example:tags:1']])
      pipeExec.mockResolvedValue([
        [null, 'string'],
        [null, '0'],
        [null, '10'],
        [null, 'set'],
        [null, '-1'],
        [null, '5'],
      ])

      const result = await service.getKeyspaceBreakdown()

      expect(result.byType).toEqual({ string: 1, hash: 0, set: 1 })
      expect(result.expiry).toEqual({ withTtl: 1, noTtl: 1 })
      expect(result.byPrefix).toEqual([
        { prefix: 'product', bytes: 10 },
        { prefix: 'tags', bytes: 5 },
      ])
      for (const key of ['cache-example:product:1', 'cache-example:tags:1']) {
        expect(pipeType).toHaveBeenCalledWith(key)
        expect(pipeTtl).toHaveBeenCalledWith(key)
        expect(pipeMemory).toHaveBeenCalledWith('USAGE', key)
      }
    })

    it('decrements the sample budget for a ghost key so a later page is still scanned', async () => {
      /*
       * Scenario: page one returns the full 1000-key budget with its last key a TTL=-2
       * ghost; page two (cursor still open) carries one more real key.
       * Rule it protects: the ghost path does `sampled--` so the consumed budget drops
       * back below the cap, letting the do/while fetch page two. An `sampled++` mutant
       * would overshoot the cap and stop after page one, losing the page-two key.
       */
      const { service, clientScan, pipeExec } = setup()
      const page1 = Array.from({ length: 1000 }, (_unused, i) => `cache-example:product:${i}`)
      const page1Meta: Array<[Error | null, unknown]> = []
      for (let i = 0; i < 999; i++) {
        page1Meta.push([null, 'string'], [null, '-1'], [null, '10'])
      }
      // Last key on page one is a TTL=-2 ghost — processed, then un-counted via sampled--.
      page1Meta.push([null, 'string'], [null, '-2'], [null, '10'])

      clientScan
        .mockResolvedValueOnce(['9', page1])
        .mockResolvedValueOnce(['0', ['cache-example:product:extra']])
      pipeExec.mockResolvedValueOnce(page1Meta).mockResolvedValueOnce([
        [null, 'string'],
        [null, '-1'],
        [null, '10'],
      ])

      const result = await service.getKeyspaceBreakdown()

      // 999 strings on page one (the 1000th was a ghost) + 1 on page two = 1000.
      expect(result.byType.string).toBe(1000)
      expect(clientScan).toHaveBeenCalledTimes(2)
    })
  })
})
