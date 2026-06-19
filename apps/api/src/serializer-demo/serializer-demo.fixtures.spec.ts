/**
 * Unit specs for the serializer-demo fixtures.
 *
 * The fixtures are pure data, so the assertions simply pin their exported shapes:
 * the JSON-safe `safePayload` and the deliberately-lossy `caveatPayload` (which
 * carries a real `Date`). Locking the shapes guards the caveat endpoint's
 * contract against an accidental edit to either constant.
 *
 * @module serializer-demo/serializer-demo.fixtures.spec
 */
import { safePayload, caveatPayload } from './serializer-demo.fixtures.js'

describe('serializer-demo fixtures', () => {
  it('exposes a JSON-safe baseline payload that survives a round-trip intact', () => {
    /*
     * Scenario: inspect the SerializableValue-conforming baseline fixture.
     * Rule it protects: `safePayload` is exactly `{ id: 42, tags: ['a', 'b'] }`,
     * containing only JSON-native types, so it deep-equals itself after a
     * JSON.stringify/parse round-trip (the control case for the caveat demo).
     */
    expect(safePayload).toEqual({ id: 42, tags: ['a', 'b'] })
    expect(JSON.parse(JSON.stringify(safePayload))).toEqual(safePayload)
  })

  it('exposes a caveat payload carrying a real Date at the fixed demo instant', () => {
    /*
     * Scenario: inspect the deliberately-lossy fixture.
     * Rule it protects: `caveatPayload.when` is a `Date` at the documented instant
     * (outside SerializableValue) while `id`/`tags` mirror the safe payload — the
     * exact value the caveat endpoint stores to contrast JSON vs MessagePack.
     */
    expect(caveatPayload.id).toBe(42)
    expect(caveatPayload.tags).toEqual(['a', 'b'])
    expect(caveatPayload.when).toBeInstanceOf(Date)
    expect(caveatPayload.when.toISOString()).toBe('2026-06-01T00:00:00.000Z')
  })

  it('downgrades the caveat Date to an ISO string under a JSON round-trip', () => {
    /*
     * Scenario: round-trip the caveat fixture through JSON.
     * Rule it protects: the `Date` does NOT survive JSON — it returns as an ISO
     * string, the documented lossy behaviour the caveat endpoint demonstrates.
     */
    const roundTripped = JSON.parse(JSON.stringify(caveatPayload))
    expect(typeof roundTripped.when).toBe('string')
    expect(roundTripped.when).toBe('2026-06-01T00:00:00.000Z')
  })
})
