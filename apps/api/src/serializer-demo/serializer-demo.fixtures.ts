/**
 * Serializer demo fixtures — well-known payloads for the caveat demonstration.
 *
 * Layer: serializer-demo. The caveat payload deliberately contains a Date, which
 * is outside SerializableValue (from @bymax-one/nest-cache/shared). SerializableValue
 * excludes Date, Map, Set, BigInt, and undefined — these types either throw, silently
 * drop, or change type under JSON.stringify, which is exactly what the caveat
 * endpoint demonstrates.
 */
// SerializableValue excludes Date/Map/Set/BigInt/undefined — caveatPayload is intentionally outside it.
import type { SerializableValue } from '@bymax-one/nest-cache/shared'

/** A safe baseline payload that fully conforms to SerializableValue (survives JSON round-trip intact). */
export const safePayload = { id: 42, tags: ['a', 'b'] } satisfies SerializableValue

/** A payload that round-trips LOSSILY under JSON (Date → ISO string) and intact under MessagePack. */
export const caveatPayload = {
  id: 42,
  when: new Date('2026-06-01T00:00:00.000Z'),
  tags: ['a', 'b'],
}
