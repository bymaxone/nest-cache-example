/**
 * Test app factory — boots the real `AppModule` against a container Redis.
 *
 * Compiles the production `AppModule` (so the suite exercises the actual wiring,
 * including `BymaxCacheModule.forRootAsync`) with the validated env pointed at a
 * Testcontainers Redis URL. The app is bound to an ephemeral loopback port with
 * `app.listen(0)`, which runs every lifecycle hook — the connection opens, the Lua
 * scripts eager-load, the Pub/Sub bridge subscribes, and the TTL keyspace
 * subscriber attaches — so specs observe end-to-end behavior against a genuine
 * server, not a mock. The socket.io adapter is initialized exactly as `main.ts`
 * (minus CORS, which is irrelevant to same-origin loopback clients) so a real
 * `socket.io-client` can connect and assert the `cache:*` WebSocket channels.
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
import { IoAdapter } from '@nestjs/platform-socket.io'
import type { INestApplication } from '@nestjs/common'
import type { Server } from 'node:http'
import { CacheService } from '@bymax-one/nest-cache'

/** The booted application plus the handles specs reach for most often. */
export interface TestApiApp {
  /** The initialized, listening Nest application (all lifecycle hooks have run). */
  app: INestApplication
  /** The compiled testing module, for resolving any other provider. */
  moduleRef: TestingModule
  /** The library cache service, resolved from the real DI container. */
  cache: CacheService
  /** Ephemeral loopback port the HTTP + socket.io server is listening on. */
  port: number
  /** Loopback base URL for HTTP and socket.io clients (`http://127.0.0.1:<port>`). */
  baseUrl: string
}

/**
 * Builds and initializes the production `AppModule` against a container Redis.
 *
 * @param redisUrl - The container connection URL (`StartedRedisContainer.getConnectionUrl()`).
 * @param env - Optional per-spec env overrides merged over the test baseline.
 * @returns The listening app, its module ref, the resolved `CacheService`, and the bound port/baseUrl.
 * @throws When the module fails to compile, the connection cannot be opened, or the server fails to bind a TCP port.
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
  // Same socket.io adapter as production (CORS omitted — loopback clients are
  // same-origin), so the gateway accepts real socket.io-client connections.
  app.useWebSocketAdapter(new IoAdapter(app))
  // listen(0) binds a free loopback port and runs init() + every lifecycle hook;
  // a stable listening port is what the socket.io client connects to.
  await app.listen(0, '127.0.0.1')

  const server: Server = app.getHttpServer()
  const address = server.address()
  if (address === null || typeof address === 'string') {
    throw new Error('Test server did not bind a TCP port')
  }
  const port = address.port

  return {
    app,
    moduleRef,
    cache: app.get(CacheService),
    port,
    baseUrl: `http://127.0.0.1:${port}`,
  }
}
