/**
 * Unit: TenantsService — prefix-scoped multi-tenancy within one namespace.
 *
 * Constructs the service directly with a hand-mocked `CacheService` facade and a
 * mocked `KeyBuilder`. The raw ioredis client (`getClient()`) is modelled by a
 * narrow `FakeClient` the real `Redis` is assignable to, so no `unknown`/`any`
 * bridge is needed. Drives every branch: read-through hit vs miss (with the
 * placeholder write path), the SCAN → delMany clear with the prefix-strip
 * true/false arms and the empty-scan no-op, the raw-client foreign seed, and the
 * namespace-flush isolation proof (seed-vs-skip and survived-vs-gone arms).
 *
 * @module tenants/tenants.service.spec
 */
import { jest } from '@jest/globals'
import type { Redis } from 'ioredis'
import type { CacheService, KeyBuilder } from '@bymax-one/nest-cache'
import type { Product } from '../catalog/product.types.js'
import { TenantsService } from './tenants.service.js'

/** The namespace prefix the mocked KeyBuilder applies (matches CACHE_NAMESPACE default). */
const NS = 'cache-example'

/** Narrow raw-client surface the tenants service uses; the real `Redis` is assignable to it. */
interface FakeClient {
  set(key: string, value: string): Promise<'OK'>
  exists(key: string): Promise<number>
}

/**
 * Wraps an array as a one-shot async iterable so the facade `scan()` can be
 * driven without a real Redis cursor.
 *
 * @param items - The keys the scan should yield, in order.
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
 * Builds the service with fully controllable cache, raw-client, and KeyBuilder mocks.
 *
 * @returns The service plus every inner mock for stubbing and assertions.
 */
function setup() {
  const getInner = jest.fn<(prefix: string, id: string) => Promise<Product | null>>()
  const setInner =
    jest.fn<(prefix: string, id: string, value: unknown, ttl?: number) => Promise<void>>()
  const scan = jest.fn<CacheService['scan']>()
  const delMany = jest.fn<CacheService['delMany']>()
  const flushNamespace = jest.fn<CacheService['flushNamespace']>()

  const clientSet = jest.fn<(key: string, value: string) => Promise<'OK'>>()
  const clientExists = jest.fn<(key: string) => Promise<number>>()
  const fakeClient: FakeClient = { set: clientSet, exists: clientExists }
  const getClient = jest.fn<() => Redis>(() => fakeClient as Redis)

  const cacheMock: Partial<CacheService> = {
    get: <T>(prefix: string, id: string): Promise<T | null> =>
      getInner(prefix, id) as Promise<T | null>,
    set: <T>(prefix: string, id: string, value: T, ttl?: number): Promise<void> =>
      setInner(prefix, id, value, ttl),
    scan,
    delMany,
    flushNamespace,
    getClient,
  }

  const build = jest.fn<(prefix: string, id: string) => string>(
    (prefix, id) => `${NS}:${prefix}:${id}`,
  )
  const keyBuilderMock: Partial<KeyBuilder> = { build }

  const service = new TenantsService(cacheMock as CacheService, keyBuilderMock as KeyBuilder)
  return {
    service,
    getInner,
    setInner,
    scan,
    delMany,
    flushNamespace,
    clientSet,
    clientExists,
    build,
  }
}

describe('TenantsService (unit)', () => {
  describe('getProduct', () => {
    it('returns a cache hit immediately without touching the origin or writing', async () => {
      /*
       * Scenario: the tenant-scoped key is already cached.
       * Rule it protects: a non-null `get` short-circuits with `source: 'cache'`
       * — no placeholder is synthesized and `set` is never called.
       */
      const { service, getInner, setInner } = setup()
      const cached: Product = { id: 'p1', name: 'Cached', priceCents: 500, tags: [], stock: 2 }
      getInner.mockResolvedValue(cached)

      await expect(service.getProduct('t1', 'p1')).resolves.toEqual({
        data: cached,
        source: 'cache',
      })
      expect(getInner).toHaveBeenCalledWith('tenant:t1:product', 'p1')
      expect(setInner).not.toHaveBeenCalled()
    })

    it('synthesizes a placeholder and writes it under the tenant prefix on a miss', async () => {
      /*
       * Scenario: the key is absent, so the read-through fills it.
       * Rule it protects: on a null `get`, a deterministic placeholder tagged with
       * the tenant is written under `tenant:{t}:product` with the 120s TTL and
       * returned with `source: 'origin'`.
       */
      jest.useFakeTimers()
      try {
        const { service, getInner, setInner } = setup()
        getInner.mockResolvedValue(null)
        setInner.mockResolvedValue()

        const pending = service.getProduct('t1', 'p1')
        await jest.advanceTimersByTimeAsync(120)
        const expected: Product = {
          id: 'p1',
          name: 'Product p1',
          priceCents: 999,
          tags: ['tenant:t1'],
          stock: 1,
        }

        await expect(pending).resolves.toEqual({ data: expected, source: 'origin' })
        expect(setInner).toHaveBeenCalledWith('tenant:t1:product', 'p1', expected, 120)
      } finally {
        jest.useRealTimers()
      }
    })
  })

  describe('clearTenant', () => {
    it('scans the tenant root, strips the namespaced prefix, and bulk-deletes', async () => {
      /*
       * Scenario: several keys exist under the tenant root, plus one stray key that
       * does not share the derived prefix boundary.
       * Rule it protects: the composite id is recovered by stripping the
       * KeyBuilder-derived boundary (true arm) while a non-matching key falls back
       * to itself (false arm); all ids are then handed to a single `delMany`.
       */
      const { service, scan, delMany, build } = setup()
      scan.mockReturnValue(
        asyncIterableOf([
          'cache-example:tenant:t1:product:p1',
          'cache-example:tenant:t1:product:p2',
          'unprefixed:stray',
        ]),
      )
      delMany.mockResolvedValue(3)

      await expect(service.clearTenant('t1')).resolves.toEqual({
        tenant: 't1',
        scannedKeys: 3,
        deleted: 3,
      })
      expect(build).toHaveBeenCalledWith('tenant:t1', '~')
      expect(scan).toHaveBeenCalledWith('tenant:t1', '*')
      expect(delMany).toHaveBeenCalledWith('tenant:t1', [
        'product:p1',
        'product:p2',
        'unprefixed:stray',
      ])
    })

    it('returns a zero result and skips delMany when the scan is empty', async () => {
      /*
       * Scenario: the tenant has no cached keys.
       * Rule it protects: with no scanned ids the `ids.length ? … : 0` guard takes
       * the false arm — `delMany` is never called and `deleted` is 0.
       */
      const { service, scan, delMany } = setup()
      scan.mockReturnValue(asyncIterableOf([]))

      await expect(service.clearTenant('t1')).resolves.toEqual({
        tenant: 't1',
        scannedKeys: 0,
        deleted: 0,
      })
      expect(delMany).not.toHaveBeenCalled()
    })
  })

  describe('seedForeignNamespace', () => {
    it('writes the foreign key directly through the raw ioredis client', async () => {
      /*
       * Scenario: the sanctioned anti-pattern seed.
       * Rule it protects: it writes the hand-built `other-app:demo` key (NOT
       * auto-namespaced) via `getClient().set` and confirms `written: true`.
       */
      const { service, clientSet } = setup()
      clientSet.mockResolvedValue('OK')

      await expect(service.seedForeignNamespace()).resolves.toEqual({
        key: 'other-app:demo',
        written: true,
      })
      expect(clientSet).toHaveBeenCalledWith(
        'other-app:demo',
        JSON.stringify({ seededBy: 'tenants/seed-foreign' }),
      )
    })
  })

  describe('proveIsolation', () => {
    it('seeds the missing foreign key, flushes the namespace, and proves it survived', async () => {
      /*
       * Scenario: the foreign key is absent at first, then survives the flush.
       * Rule it protects: a falsy `exists` triggers a seed (the `!exists` true arm),
       * `flushNamespace` reports the cleared count, and the post-flush `exists === 1`
       * resolves `foreignKeySurvived: true`.
       */
      const { service, clientSet, clientExists, flushNamespace } = setup()
      clientExists.mockResolvedValueOnce(0).mockResolvedValueOnce(1)
      clientSet.mockResolvedValue('OK')
      flushNamespace.mockResolvedValue(5)

      await expect(service.proveIsolation()).resolves.toEqual({
        flushedNamespaceKeys: 5,
        foreignKeySurvived: true,
      })
      expect(clientSet).toHaveBeenCalledTimes(1)
    })

    it('skips the seed when the foreign key already exists and reports it gone', async () => {
      /*
       * Scenario: the foreign key is already present, and after the flush it is gone.
       * Rule it protects: a truthy `exists` skips the seed (the `!exists` false arm),
       * and a post-flush `exists` that is not `1` resolves `foreignKeySurvived: false`.
       */
      const { service, clientSet, clientExists, flushNamespace } = setup()
      clientExists.mockResolvedValueOnce(1).mockResolvedValueOnce(0)
      flushNamespace.mockResolvedValue(0)

      await expect(service.proveIsolation()).resolves.toEqual({
        flushedNamespaceKeys: 0,
        foreignKeySurvived: false,
      })
      expect(clientSet).not.toHaveBeenCalled()
    })
  })
})
