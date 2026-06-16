/**
 * Serializer demo service — stores payloads and reads them back both raw and decoded.
 *
 * Layer: serializer-demo. Demonstrates the contrast between getRaw/setRaw (codec
 * bypassed) and get/set (codec applied), and exposes the active serializer name
 * via the injected BYMAX_CACHE_SERIALIZER token.
 *
 * SerializableValue (from @bymax-one/nest-cache/shared) deliberately excludes
 * Date, Map, Set, BigInt, and undefined — the caveat payload crosses this boundary
 * intentionally to show the lossy-vs-intact contrast between JSON and MessagePack.
 */
import { Inject, Injectable } from '@nestjs/common'
import { BYMAX_CACHE_SERIALIZER, CacheService } from '@bymax-one/nest-cache'
import type { ISerializer } from '@bymax-one/nest-cache'
import { caveatPayload } from './serializer-demo.fixtures.js'

/** Response shape for the roundtrip endpoint. */
export interface RoundtripResult {
  codec: string
  raw: string | null
  decoded: unknown
  rawBytes: number
  rawBypass: string | null
}

/** Response shape for the caveat endpoint. */
export interface CaveatResult {
  codec: string
  raw: string | null
  decoded: unknown
  dateSurvived: boolean
  note: string
}

/** Demo cache prefix for all serializer-demo keys. */
const DEMO_PREFIX = 'serializer:demo'

/**
 * Narrows an unknown value to an object that has a `when` property.
 *
 * @param v - The value to test.
 * @returns `true` when `v` is a non-null object with a `when` key.
 */
function hasWhen(v: unknown): v is { when: unknown } {
  return typeof v === 'object' && v !== null && 'when' in v
}

/**
 * Performs serializer round-trips and exposes the injected codec name.
 *
 * Injects CacheService (all get/set/getRaw/setRaw calls) and the
 * BYMAX_CACHE_SERIALIZER token (the active ISerializer instance).
 */
@Injectable()
export class SerializerDemoService {
  constructor(
    private readonly cache: CacheService,
    @Inject(BYMAX_CACHE_SERIALIZER) private readonly serializer: ISerializer,
  ) {}

  /**
   * Stores `payload`, then reads it back both as the raw stored string (getRaw)
   * and the decoded value (get). Also exercises setRaw/getRaw to show the bypass
   * (see TECHNICAL_SPECIFICATION.md §4.1 — getRaw/setRaw bypass the serializer entirely).
   *
   * @param payload - Any JSON-compatible object to round-trip.
   * @returns Raw string, decoded value, byte size, and the raw-bypass result.
   */
  async roundtrip(payload: unknown): Promise<Omit<RoundtripResult, 'codec'>> {
    await this.cache.set(DEMO_PREFIX, 'last', payload)
    const raw = await this.cache.getRaw(DEMO_PREFIX, 'last')
    const decoded = await this.cache.get(DEMO_PREFIX, 'last')
    // setRaw stores the string verbatim (codec bypassed on write);
    // getRaw reads it back verbatim (codec bypassed on read) — see TECHNICAL_SPECIFICATION.md §4.1.
    // When raw is null the key was evicted between set and getRaw; store null sentinel to surface the miss.
    await this.cache.setRaw(DEMO_PREFIX, 'raw', raw ?? 'null')
    const rawBypass = await this.cache.getRaw(DEMO_PREFIX, 'raw')
    return { raw, decoded, rawBytes: raw === null ? 0 : Buffer.byteLength(raw), rawBypass }
  }

  /**
   * Stores the caveat payload (which contains a Date) and reads it back.
   * Under JSON the Date becomes an ISO string (dateSurvived: false);
   * under MessagePack it survives intact (dateSurvived: true).
   *
   * @returns Raw, decoded, dateSurvived flag, and a human-readable note.
   */
  async caveat(): Promise<Omit<CaveatResult, 'codec'>> {
    await this.cache.set(DEMO_PREFIX, 'caveat', caveatPayload)
    const raw = await this.cache.getRaw(DEMO_PREFIX, 'caveat')
    const decoded = await this.cache.get<typeof caveatPayload>(DEMO_PREFIX, 'caveat')
    const dateSurvived = hasWhen(decoded) && decoded.when instanceof Date
    const note = dateSurvived
      ? 'MessagePack preserves Date intact'
      : 'JSON does not preserve Date — it became an ISO string'
    return { raw, decoded, dateSurvived, note }
  }

  /**
   * Returns the active codec name from the injected BYMAX_CACHE_SERIALIZER token.
   *
   * Uses `constructor.name`, which is reliable in Node.js / NestJS — the `nest build`
   * toolchain does not mangle class names. Avoid copying this pattern to code that
   * runs in a browser bundle where minifiers erase constructor names.
   *
   * @returns The constructor name of the active ISerializer (e.g. 'JsonSerializer').
   */
  activeSerializer(): string {
    return this.serializer.constructor.name
  }
}
