/**
 * Toolchain smoke — proves Docker + Testcontainers + Nest DI + the real library
 * wire together end to end before any feature spec relies on them.
 *
 * @module test/smoke.e2e-spec
 */
import type { StartedRedisContainer } from '@testcontainers/redis'
import { startRedisContainer } from './helpers/redis-container.js'
import { createTestApp, type TestApiApp } from './helpers/test-app.js'

describe('E2E toolchain smoke (real Redis via Testcontainers)', () => {
  let container: StartedRedisContainer
  let api: TestApiApp

  beforeAll(async () => {
    container = await startRedisContainer()
    api = await createTestApp(container.getConnectionUrl())
  })

  afterAll(async () => {
    await api?.app.close()
    await container?.stop()
  })

  it('boots the app against a real container and answers PING + health', async () => {
    /*
     * Scenario: the compiled AppModule talks to a genuine redis:7-alpine started
     * by Testcontainers. A raw PONG plus a healthy connection prove the cache
     * service reached the container — not a mock — so the whole E2E toolchain
     * (Docker, container boot, Nest bootstrap, the real @bymax-one/nest-cache
     * package) is operational. If Docker is unreachable, beforeAll throws and the
     * suite fails loudly rather than silently skipping real-Redis coverage.
     */
    await expect(api.cache.ping()).resolves.toBe('PONG')
    await expect(api.cache.isHealthy()).resolves.toBe(true)
  })
})
