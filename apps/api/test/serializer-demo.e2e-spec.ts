/**
 * Serializer-demo HTTP E2E (real Redis via Testcontainers).
 *
 * Drives all three `/serializer` routes over `supertest` under the default JSON
 * codec: the round-trip (raw stored string vs decoded value vs the setRaw/getRaw
 * bypass), the Date-survival caveat (JSON degrades a `Date` to an ISO string),
 * and the active-serializer report — plus the Zod 400 envelope on a bad codec
 * and an empty body. The published library performs every encode/decode against
 * a genuine container.
 *
 * @module test/serializer-demo.e2e-spec
 */
import type { StartedRedisContainer } from '@testcontainers/redis'
import { startRedisContainer } from './helpers/redis-container.js'
import { createTestApp, type TestApiApp } from './helpers/test-app.js'
import { httpAgent } from './helpers/http.js'

describe('serializer-demo HTTP flows (real Redis)', () => {
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

  it('roundtrip under JSON returns the raw string, decoded value, bytes, and raw bypass', async () => {
    /*
     * Scenario: a JSON object is stored and read back two ways.
     * Rule it protects: `get` decodes to the original object while `getRaw` returns
     * the verbatim stored string, `rawBytes` measures that string, and the
     * setRaw/getRaw bypass reproduces it — the codec-applied vs codec-bypassed
     * contrast the Serializer Lab demonstrates.
     */
    const payload = { hello: 'world', n: 42 }
    const response = await httpAgent(api.app)
      .post('/serializer/roundtrip')
      .query({ codec: 'json' })
      .send(payload)

    expect(response.status).toBe(201)
    expect(response.body.codec).toBe('json')
    expect(response.body.decoded).toEqual(payload)
    expect(JSON.parse(String(response.body.raw))).toEqual(payload)
    expect(response.body.rawBytes).toBeGreaterThan(0)
    expect(response.body.rawBypass).toBe(response.body.raw)
  })

  it('caveat under JSON degrades a Date to an ISO string (dateSurvived false)', async () => {
    /*
     * Scenario: a payload carrying a `Date` crosses the JSON serializer boundary.
     * Rule it protects: JSON cannot preserve a `Date`, so `dateSurvived` is false,
     * the note explains the ISO-string degradation, and `decoded.when` is the exact
     * ISO timestamp — the documented JSON caveat (MessagePack would keep it intact).
     */
    const response = await httpAgent(api.app).post('/serializer/caveat').query({ codec: 'json' })

    expect(response.status).toBe(201)
    expect(response.body.codec).toBe('json')
    expect(response.body.dateSurvived).toBe(false)
    expect(response.body.note).toBe('JSON does not preserve Date — it became an ISO string')
    expect(response.body.decoded).toMatchObject({
      id: 42,
      when: '2026-06-01T00:00:00.000Z',
      tags: ['a', 'b'],
    })
  })

  it('reports the active serializer and rejects a bad codec and an empty body with 400', async () => {
    /*
     * Scenario: the active codec is reported, and two malformed roundtrip requests.
     * Rule it protects: `GET /active` names the registered serializer
     * (`JsonSerializer` by default), while a non-enum codec and an empty body each
     * reject via the Zod pipe with the stable 400 envelope.
     */
    const active = await httpAgent(api.app).get('/serializer/active')
    expect(active.status).toBe(200)
    expect(active.body).toEqual({ serializer: 'JsonSerializer' })

    const badCodec = await httpAgent(api.app)
      .post('/serializer/roundtrip')
      .query({ codec: 'bogus' })
      .send({ x: 1 })
    expect(badCodec.status).toBe(400)
    expect(badCodec.body.error.code).toBe('validation_failed')

    const emptyBody = await httpAgent(api.app)
      .post('/serializer/roundtrip')
      .query({ codec: 'json' })
      .send({})
    expect(emptyBody.status).toBe(400)
  })
})
