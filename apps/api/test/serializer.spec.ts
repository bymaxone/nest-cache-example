/**
 * Serializer comparison: JSON vs MessagePack (ioredis-mock, no Docker).
 *
 * Stores the same structured value through the default `JsonSerializer` and the
 * example's custom `MsgPackSerializer`, then contrasts the raw wire bytes against
 * the decoded value. The headline lesson (spec §16): JSON is lossy for richer
 * types — a `Date` round-trips as an ISO **string**, and `Map`/`Set`/`BigInt` do
 * not survive at all — while a binary codec like MessagePack preserves a `Date`.
 *
 * Backed by `ioredis-mock`: serialization is pure data shaping, so no real server
 * is involved.
 *
 * @module test/serializer.spec
 */
import { jest } from '@jest/globals'
import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import type { CacheService } from '@bymax-one/nest-cache'
import { MsgPackSerializer } from '../src/cache/msgpack.serializer.js'

// Substitute ioredis-mock for ioredis before the library loads (see data-structures.spec).
jest.unstable_mockModule('ioredis', async () => {
  const mock = await import('ioredis-mock')
  return { Redis: mock.default, Cluster: mock.Cluster, default: mock.default }
})

const { BymaxCacheModule, CacheService: CacheServiceClass } = await import('@bymax-one/nest-cache')

/** Base64 character set — what the MsgPackSerializer wraps its bytes in. */
const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/
/** A fixed instant so the Date assertions are deterministic. */
const WHEN = new Date('2026-01-01T00:00:00.000Z')

/**
 * Builds an initialized app exposing a CacheService configured with `serializer`.
 *
 * @param namespace - A distinct namespace so the two codecs never share a key.
 * @param serializer - Optional custom serializer; omit for the default JsonSerializer.
 * @returns The app and its resolved CacheService.
 */
async function buildCache(
  namespace: string,
  serializer?: MsgPackSerializer,
): Promise<{ app: INestApplication; cache: CacheService }> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      BymaxCacheModule.forRoot({
        connection: { url: 'redis://localhost:6379' },
        namespace,
        ...(serializer ? { serializer } : {}),
      }),
    ],
  }).compile()
  const app = moduleRef.createNestApplication()
  await app.init()
  return { app, cache: app.get(CacheServiceClass) }
}

describe('serializer comparison: JSON vs MessagePack (ioredis-mock, no Docker)', () => {
  let json: { app: INestApplication; cache: CacheService }
  let msgpack: { app: INestApplication; cache: CacheService }

  beforeAll(async () => {
    json = await buildCache('json-demo')
    msgpack = await buildCache('msgpack-demo', new MsgPackSerializer())
  })

  afterAll(async () => {
    await json?.app.close()
    await msgpack?.app.close()
  })

  it('JSON stores a human-readable string and downgrades Date to an ISO string', async () => {
    /*
     * Scenario: the default serializer handles a value containing a Date.
     * Rule it protects: JsonSerializer writes a JSON string on the wire, and a
     * Date does NOT survive the round-trip — it comes back as an ISO string, the
     * documented SerializableValue caveat consumers must design around.
     */
    await json.cache.set('demo', 'obj', { id: 42, tags: ['a', 'b'], when: WHEN })

    const raw = await json.cache.getRaw('demo', 'obj')
    expect(raw).not.toBeNull()
    expect(typeof raw).toBe('string')
    expect(raw).toContain('2026-01-01T00:00:00.000Z')

    const decoded = await json.cache.get('demo', 'obj')
    expect(decoded).toEqual({ id: 42, tags: ['a', 'b'], when: '2026-01-01T00:00:00.000Z' })
    expect(typeof (decoded as { when: unknown }).when).toBe('string')
  })

  it('MessagePack stores distinct binary bytes and preserves Date', async () => {
    /*
     * Scenario: the same value through the custom binary codec.
     * Rule it protects: MsgPackSerializer's wire form (base64-wrapped bytes)
     * differs from the JSON string, yet the decoded value deep-equals the input —
     * including the Date, which the binary timestamp extension round-trips intact.
     */
    await msgpack.cache.set('demo', 'obj', { id: 42, tags: ['a', 'b'], when: WHEN })

    const raw = await msgpack.cache.getRaw('demo', 'obj')
    const jsonRaw = await json.cache.getRaw('demo', 'obj')
    expect(raw).not.toBeNull()
    expect(raw).toMatch(BASE64_PATTERN)
    expect(raw).not.toBe(jsonRaw)

    const decoded = await msgpack.cache.get('demo', 'obj')
    expect((decoded as { when: unknown }).when).toBeInstanceOf(Date)
    expect(decoded).toEqual({ id: 42, tags: ['a', 'b'], when: WHEN })
  })

  it('documents the SerializableValue caveat: Set collapses to {} under JSON', async () => {
    /*
     * Scenario: a value carrying a non-JSON-native container.
     * Rule it protects: Date/Map/Set/BigInt are NOT serializable by JSON — a Set
     * silently collapses to an empty object on the round-trip, so a consumer that
     * needs these types must supply a custom serializer (as MessagePack does here).
     */
    await json.cache.set('caveat', 'set', { tags: new Set(['x', 'y']) })
    expect(await json.cache.get('caveat', 'set')).toEqual({ tags: {} })
  })
})
