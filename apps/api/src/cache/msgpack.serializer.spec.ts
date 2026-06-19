/**
 * Unit: MsgPackSerializer — base64-wrapped MessagePack codec (no Redis, no DI).
 *
 * Constructs the serializer directly and exercises the round-trip plus the
 * fail-closed base64 guard. This is also the smoke spec proving the unit Jest
 * toolchain (rootDir `src`, ESM, `emitDecoratorMetadata: false`) runs.
 *
 * @module cache/msgpack.serializer.spec
 */
import { MsgPackSerializer } from './msgpack.serializer.js'

describe('MsgPackSerializer (unit)', () => {
  const serializer = new MsgPackSerializer()

  it('round-trips a structured value through serialize → deserialize', () => {
    /*
     * Scenario: encode then decode a value carrying types JSON mangles (Date).
     * Rule it protects: the binary codec preserves the value exactly — the
     * decoded object deep-equals the input, including the Date instance.
     */
    const value = { id: 42, tags: ['a', 'b'], when: new Date('2026-01-01T00:00:00.000Z') }

    const wire = serializer.serialize(value)
    expect(typeof wire).toBe('string')
    expect(wire).toMatch(/^[A-Za-z0-9+/]*={0,2}$/)

    const decoded = serializer.deserialize<typeof value>(wire)
    expect(decoded).toEqual(value)
    expect(decoded.when).toBeInstanceOf(Date)
  })

  it('throws on malformed base64 input (fail-closed guard)', () => {
    /*
     * Scenario: a string that is not valid base64 is handed to deserialize.
     * Rule it protects: the explicit regex guard rejects the input with a throw
     * rather than letting Node's permissive Buffer.from silently corrupt it.
     */
    expect(() => serializer.deserialize('not valid base64!!!')).toThrow(/malformed base64/)
  })
})
