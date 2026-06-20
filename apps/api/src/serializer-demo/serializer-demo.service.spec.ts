/**
 * Unit: SerializerDemoService — raw-vs-decoded round-trips and codec introspection.
 *
 * Constructs the service directly with a hand-mocked `CacheService` and a
 * stand-in `ISerializer`. Covers the roundtrip bypass guard (raw present vs raw
 * evicted), every `hasWhen` narrowing arm plus the `instanceof Date` flag and
 * both note branches of `caveat`, and `activeSerializer` reading the injected
 * codec's constructor name.
 *
 * @module serializer-demo/serializer-demo.service.spec
 */
import { jest } from '@jest/globals'
import type { CacheService, ISerializer } from '@bymax-one/nest-cache'
import { SerializerDemoService } from './serializer-demo.service.js'

/** The single prefix all serializer-demo keys are written under. */
const DEMO_PREFIX = 'serializer:demo'

/** A named serializer stand-in so `constructor.name` is deterministic. */
class JsonSerializer implements ISerializer {
  serialize<T>(value: T): string {
    return JSON.stringify(value)
  }

  deserialize<T>(raw: string): T {
    return JSON.parse(raw) as T
  }
}

/** A differently-named serializer to prove the codec name is read dynamically. */
class MsgPackSerializer implements ISerializer {
  serialize<T>(value: T): string {
    return JSON.stringify(value)
  }

  deserialize<T>(raw: string): T {
    return JSON.parse(raw) as T
  }
}

/**
 * Builds the service with controllable cache mocks and a chosen serializer.
 *
 * @param serializer - The injected codec; defaults to a `JsonSerializer` instance.
 * @returns The service plus every inner cache mock for stubbing and assertions.
 */
function setup(serializer: ISerializer = new JsonSerializer()) {
  const setInner =
    jest.fn<(prefix: string, id: string, value: unknown, ttl?: number) => Promise<void>>()
  const getInner = jest.fn<(prefix: string, id: string) => Promise<unknown>>()
  const getRaw = jest.fn<CacheService['getRaw']>()
  const setRaw = jest.fn<CacheService['setRaw']>()

  const cacheMock: Partial<CacheService> = {
    set: <T>(prefix: string, id: string, value: T, ttl?: number): Promise<void> =>
      setInner(prefix, id, value, ttl),
    get: <T>(prefix: string, id: string): Promise<T | null> =>
      getInner(prefix, id) as Promise<T | null>,
    getRaw,
    setRaw,
  }

  const service = new SerializerDemoService(cacheMock as CacheService, serializer)
  return { service, setInner, getInner, getRaw, setRaw }
}

describe('SerializerDemoService (unit)', () => {
  describe('roundtrip', () => {
    it('stores the payload then returns raw, decoded, byte size, and the raw bypass', async () => {
      /*
       * Scenario: the stored key reads back a non-null raw string.
       * Rule it protects: with `raw !== null` the bypass path runs — `setRaw`
       * re-stores the verbatim string and `getRaw` reads it back — and `rawBytes`
       * is the byte length of the raw string.
       */
      const { service, setInner, getInner, getRaw, setRaw } = setup()
      const payload = { x: 1 }
      getInner.mockResolvedValue({ x: 1 })
      getRaw.mockResolvedValue('{"x":1}')
      setRaw.mockResolvedValue()

      await expect(service.roundtrip(payload)).resolves.toEqual({
        raw: '{"x":1}',
        decoded: { x: 1 },
        rawBytes: 7,
        rawBypass: '{"x":1}',
      })
      expect(setInner).toHaveBeenCalledWith(DEMO_PREFIX, 'last', payload, undefined)
      expect(setRaw).toHaveBeenCalledWith(DEMO_PREFIX, 'raw', '{"x":1}')
      // Pin every key id: the read-back and bypass reads must target the same
      // `last`/`raw` ids that were written — blanking any id would still round-trip
      // internally (write "" then read "") and go undetected without these.
      expect(getRaw).toHaveBeenCalledWith(DEMO_PREFIX, 'last')
      expect(getInner).toHaveBeenCalledWith(DEMO_PREFIX, 'last')
      expect(getRaw).toHaveBeenCalledWith(DEMO_PREFIX, 'raw')
    })

    it('skips the bypass and reports zero bytes when the key was evicted', async () => {
      /*
       * Scenario: the stored key has been evicted, so `getRaw` returns null.
       * Rule it protects: with `raw === null` the bypass write/read is skipped
       * (`setRaw` is never called), `rawBypass` is null, and `rawBytes` is 0.
       */
      const { service, getInner, getRaw, setRaw } = setup()
      getInner.mockResolvedValue(null)
      getRaw.mockResolvedValue(null)

      await expect(service.roundtrip({ x: 1 })).resolves.toEqual({
        raw: null,
        decoded: null,
        rawBytes: 0,
        rawBypass: null,
      })
      expect(setRaw).not.toHaveBeenCalled()
    })
  })

  describe('caveat', () => {
    it('reports dateSurvived true with the MessagePack note when when is a Date', async () => {
      /*
       * Scenario: the decoded value is an object whose `when` is a real Date.
       * Rule it protects: `hasWhen` passes all three arms and `when instanceof Date`
       * is true, so `dateSurvived` is true and the MessagePack note is chosen.
       */
      const { service, setInner, getInner, getRaw } = setup()
      getRaw.mockResolvedValue('<bytes>')
      getInner.mockResolvedValue({ when: new Date('2026-06-01T00:00:00.000Z') })

      await expect(service.caveat()).resolves.toEqual({
        raw: '<bytes>',
        decoded: { when: new Date('2026-06-01T00:00:00.000Z') },
        dateSurvived: true,
        note: 'MessagePack preserves Date intact',
      })
      // Pin the `caveat` key id on the write and both read-backs.
      expect(setInner).toHaveBeenCalledWith(DEMO_PREFIX, 'caveat', expect.anything(), undefined)
      expect(getRaw).toHaveBeenCalledWith(DEMO_PREFIX, 'caveat')
      expect(getInner).toHaveBeenCalledWith(DEMO_PREFIX, 'caveat')
    })

    it('reports dateSurvived false with the JSON note when when is an ISO string', async () => {
      /*
       * Scenario: the decoded `when` is a string (JSON downgraded the Date).
       * Rule it protects: `hasWhen` passes but `instanceof Date` is false, so the
       * `&&` short-circuits to false and the JSON note is chosen.
       */
      const { service, getInner, getRaw } = setup()
      getRaw.mockResolvedValue('{"when":"2026-06-01T00:00:00.000Z"}')
      getInner.mockResolvedValue({ when: '2026-06-01T00:00:00.000Z' })

      await expect(service.caveat()).resolves.toMatchObject({
        dateSurvived: false,
        note: 'JSON does not preserve Date — it became an ISO string',
      })
    })

    it('reports dateSurvived false when the decoded object has no when field', async () => {
      /*
       * Scenario: an object that lacks `when`.
       * Rule it protects: the `'when' in v` arm of `hasWhen` is false, so
       * `dateSurvived` is false without ever evaluating `instanceof Date`.
       */
      const { service, getInner, getRaw } = setup()
      getRaw.mockResolvedValue('{"id":1}')
      getInner.mockResolvedValue({ id: 1 })

      await expect(service.caveat()).resolves.toMatchObject({ dateSurvived: false })
    })

    it('reports dateSurvived false when the decoded value is null', async () => {
      /*
       * Scenario: a null decoded value.
       * Rule it protects: `typeof null === 'object'` passes but the `v !== null`
       * arm of `hasWhen` is false, so the narrowing fails closed.
       */
      const { service, getInner, getRaw } = setup()
      getRaw.mockResolvedValue(null)
      getInner.mockResolvedValue(null)

      await expect(service.caveat()).resolves.toMatchObject({ dateSurvived: false })
    })

    it('reports dateSurvived false when the decoded value is not an object', async () => {
      /*
       * Scenario: a primitive decoded value.
       * Rule it protects: the `typeof v === 'object'` arm of `hasWhen` is false, so
       * the narrowing rejects the primitive before any property access.
       */
      const { service, getInner, getRaw } = setup()
      getRaw.mockResolvedValue('"a string"')
      getInner.mockResolvedValue('a string')

      await expect(service.caveat()).resolves.toMatchObject({ dateSurvived: false })
    })
  })

  describe('activeSerializer', () => {
    it('returns the constructor name of the injected JSON codec', () => {
      /*
       * Scenario: the default JSON serializer is injected.
       * Rule it protects: `activeSerializer` reports the live codec's
       * `constructor.name` rather than a hard-coded string.
       */
      const { service } = setup(new JsonSerializer())
      expect(service.activeSerializer()).toBe('JsonSerializer')
    })

    it('reflects a different injected serializer implementation', () => {
      /*
       * Scenario: a MessagePack-style codec is injected instead.
       * Rule it protects: the reported name tracks the injected instance, proving
       * the value is read dynamically and not pinned to one literal.
       */
      const { service } = setup(new MsgPackSerializer())
      expect(service.activeSerializer()).toBe('MsgPackSerializer')
    })
  })
})
