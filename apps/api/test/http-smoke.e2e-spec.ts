/**
 * E2E harness smoke — proves the HTTP (`supertest`) and WebSocket
 * (`socket.io-client`) toolchain drives the real booted app before any flow spec
 * relies on it. One real HTTP request and one real socket handshake against the
 * production `AppModule` (Testcontainers Redis) confirm the harness end to end.
 *
 * @module test/http-smoke.e2e-spec
 */
import type { StartedRedisContainer } from '@testcontainers/redis'
import { startRedisContainer } from './helpers/redis-container.js'
import { createTestApp, type TestApiApp } from './helpers/test-app.js'
import { httpAgent } from './helpers/http.js'
import { connectSocketClient } from './helpers/socket-client.js'

describe('E2E harness smoke (HTTP + WebSocket over real Redis)', () => {
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

  it('answers GET /health with 200 and an ok status over supertest', async () => {
    /*
     * Scenario: a real HTTP request reaches the booted app through its Express server.
     * Rule it protects: the supertest agent binds to the production server (global
     * filter + per-route Zod pipe active), so a 200 `{ status: 'ok' }` proves the
     * HTTP half of the harness drives the genuine app, not a mock.
     */
    const response = await httpAgent(api.app).get('/health')

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ status: 'ok' })
    expect(response.body.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('connects and disconnects a socket.io client cleanly', async () => {
    /*
     * Scenario: a real socket.io client completes the handshake against the booted
     * gateway and then tears down.
     * Rule it protects: the socket.io adapter is initialized on a listening port,
     * so the dashboard's WebSocket transport accepts connections — the prerequisite
     * for every `cache:*` channel assertion in the flow specs.
     */
    const ws = await connectSocketClient(api.baseUrl)
    try {
      expect(ws.socket.connected).toBe(true)
    } finally {
      await ws.close()
    }
    expect(ws.socket.connected).toBe(false)
  })
})
