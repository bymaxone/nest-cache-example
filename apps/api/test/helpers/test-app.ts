/**
 * Test app factory — boots the real `AppModule` against a container Redis.
 *
 * Compiles the production `AppModule` (so the suite exercises the actual wiring,
 * including `BymaxCacheModule.forRootAsync`) with the validated env pointed at a
 * Testcontainers Redis URL. `app.init()` runs every lifecycle hook — the
 * connection opens, the Lua scripts eager-load, the Pub/Sub bridge subscribes,
 * and the TTL keyspace subscriber attaches — so specs observe end-to-end behavior
 * against a genuine server, not a mock.
 *
 * `AppModule` is imported **dynamically, after** the env is set: `ConfigModule.forRoot`
 * validates `process.env` synchronously the moment its module metadata is evaluated,
 * so a static top-level import would freeze the default (localhost) connection before
 * the container URL is known. Jest gives each test file a fresh module registry, so
 * the deferred import re-validates with the right env once per spec file.
 *
 * A deterministic baseline (test mode, standalone, JSON serializer, default
 * namespace) is applied on every call and then merged with per-spec overrides, so
 * one spec's overrides never leak into the next under the `--runInBand` runner.
 *
 * @module test/helpers/test-app
 */
import { Test, type TestingModule } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { CacheService } from '@bymax-one/nest-cache'

/** The booted application plus the handles specs reach for most often. */
export interface TestApiApp {
  /** The initialized Nest application (all lifecycle hooks have run). */
  app: INestApplication
  /** The compiled testing module, for resolving any other provider. */
  moduleRef: TestingModule
  /** The library cache service, resolved from the real DI container. */
  cache: CacheService
}

/**
 * Builds and initializes the production `AppModule` against a container Redis.
 *
 * @param redisUrl - The container connection URL (`StartedRedisContainer.getConnectionUrl()`).
 * @param env - Optional per-spec env overrides merged over the test baseline.
 * @returns The initialized app, its module ref, and the resolved `CacheService`.
 * @throws When the module fails to compile or the connection cannot be opened.
 */
export async function createTestApp(
  redisUrl: string,
  env: Readonly<Record<string, string>> = {},
): Promise<TestApiApp> {
  // Deterministic baseline applied first, then overrides — guarantees a clean
  // config regardless of what a previous spec left on process.env.
  const baseline: Record<string, string> = {
    NODE_ENV: 'test',
    CACHE_MODE: 'standalone',
    CACHE_SERIALIZER: 'json',
    CACHE_NAMESPACE: 'cache-example',
    // Reset the demo TTL on every call so a TTL-sensitive spec (e.g. read-through,
    // which overrides this to a short value) never leaks its value into later specs.
    CACHE_DEFAULT_TTL: '60',
    REDIS_URL: redisUrl,
  }
  for (const [key, value] of Object.entries({ ...baseline, ...env })) {
    process.env[key] = value
  }

  // Deferred import: ConfigModule.forRoot validates process.env at metadata-eval
  // time, so AppModule must load only after the env above is in place.
  const { AppModule } = await import('../../src/app.module.js')

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
  const app = moduleRef.createNestApplication()
  await app.init()

  return { app, moduleRef, cache: app.get(CacheService) }
}
