/**
 * MessagePack serializer — compact, binary-safe, base64-wrapped ISerializer for Redis.
 *
 * Layer: cache. Encodes values with MessagePack and wraps the bytes in base64 so they
 * store safely in a Redis string. More compact than JsonSerializer and preserves types
 * JSON mangles (Date, Buffer, typed arrays). Both methods are deterministic; deserialize
 * fails closed per the security contract (see TECHNICAL_SPECIFICATION.md §4.1, §16.1).
 */
import { decode, encode } from '@msgpack/msgpack'
import type { ISerializer } from '@bymax-one/nest-cache'

/**
 * Custom ISerializer backed by MessagePack + base64.
 *
 * Swap in via `CACHE_SERIALIZER=msgpack` (see cache.config.ts). `deserialize` propagates
 * the @msgpack/msgpack decode error on malformed input — never returns a partial value.
 */
export class MsgPackSerializer implements ISerializer {
  /**
   * Encodes a value as a base64-wrapped MessagePack byte sequence.
   *
   * @param value - The value to encode.
   * @returns Base64 string of the MessagePack-encoded bytes.
   */
  serialize<T>(value: T): string {
    return Buffer.from(encode(value)).toString('base64')
  }

  /**
   * Decodes a base64-wrapped MessagePack string back into a value.
   *
   * Fails closed: validates the base64 format before decoding, then propagates any
   * @msgpack/msgpack decode error. Node's `Buffer.from(raw, 'base64')` is permissive
   * and silently ignores invalid characters — the explicit regex guard enforces the
   * contract so callers receive a throw, not a silently-corrupted value.
   *
   * @param raw - The base64-encoded MessagePack string.
   * @returns The decoded value, typed as T.
   * @throws {Error} When `raw` is not valid base64 (format guard).
   * @throws When `raw` decodes to malformed MessagePack (decode error propagated).
   */
  deserialize<T>(raw: string): T {
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(raw)) {
      throw new Error(`MsgPackSerializer: malformed base64 input`)
    }
    return decode(Buffer.from(raw, 'base64')) as T
  }
}
