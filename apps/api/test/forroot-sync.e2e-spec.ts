/**
 * Synchronous `BymaxCacheModule.forRoot` registration E2E (real Redis).
 *
 * The application itself wires the cache with `forRootAsync`; this spec stands up
 * a dedicated testing module using the **synchronous** `forRoot` overload pointed
 * at the container, then round-trips a value through the namespace. It is the
 * explicit coverage for Feature-Coverage-Matrix row #2 (sync registration path),
 * which the async app wiring never exercises.
 *
 * @module test/forroot-sync.e2e-spec
 */
import { Test } from '@nestjs/testing'
import { BymaxCacheModule, CacheService } from '@bymax-one/nest-cache'
import type { StartedRedisContainer } from '@testcontainers/redis'
import { startRedisContainer } from './helpers/redis-container.js'

/** A structured value to prove typed set/get survives the JSON round-trip. */
const SYNC_PRODUCT = { id: 'sync', name: 'Sync Product', priceCents: 1999 }

describe('sync forRoot registration (real Redis)', () => {
  let container: StartedRedisContainer

  beforeAll(async () => {
    container = await startRedisContainer()
  })

  afterAll(async () => {
    await container?.stop()
  })

  it('registers via the sync forRoot overload and round-trips through the namespace', async () => {
    /*
     * Scenario: a consumer that prefers static configuration over an async factory.
     * Rule it protects: BymaxCacheModule.forRoot({ ... }) (Feature-Coverage-Matrix
     * row #2) wires a working CacheService — a value set under a prefix is readable
     * back deep-equal and lands at the namespaced wire key — so the sync overload is
     * a first-class registration path, not just the async one.
     */
    // Feature-Coverage-Matrix row #2 — sync forRoot registration path.
    const moduleRef = await Test.createTestingModule({
      imports: [
        BymaxCacheModule.forRoot({
          mode: 'standalone',
          connection: { url: container.getConnectionUrl() },
          namespace: 'cache-example',
        }),
      ],
    }).compile()
    const app = moduleRef.createNestApplication()
    await app.init()

    try {
      const cache = app.get(CacheService)
      await cache.set('product', 'sync', SYNC_PRODUCT)

      // Decoded value deep-equals the input…
      expect(await cache.get('product', 'sync')).toEqual(SYNC_PRODUCT)
      // …and the raw key is namespaced exactly as configured.
      expect(await cache.getClient().get('cache-example:product:sync')).not.toBeNull()
    } finally {
      await app.close()
    }
  })
})
