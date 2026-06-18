/**
 * @fileoverview Typed endpoints for the Labs pages (Stampede, Serializer, Errors)
 * over the thin {@link api} transport. Mirrors the NestJS `stampede`,
 * `serializer-demo`, and `errors-demo` controllers — one typed function per route —
 * returning the same non-throwing `ApiResult` the rest of the dashboard uses.
 *
 * The Error Explorer's `triggerError` is deliberately the one place a non-2xx is
 * the *expected* outcome: every `POST /errors/:code` resolves to a structured
 * `{ ok: false, error }` carrying the canonical code, status, message, and details.
 *
 * @module lib/labs-api
 */

import { CACHE_ERROR_CODES, type CacheErrorCode } from '@bymax-one/nest-cache/shared'
import { api, type ApiResult } from './api-client'

/** Whether a stampede contender won the single-flight lock or had to wait. */
export type StampedeRole = 'won' | 'waited'

/** Where a contender obtained its value: the slow `origin`, or a cache `hit`. */
export type StampedeOutcome = 'origin' | 'hit'

/** One contender's lifecycle within a burst — one swimlane row. Mirrors the API contract. */
export interface StampedeTimelineEntry {
  /** Zero-based position in the fired burst. */
  index: number
  /** This contender's unique lock token. */
  token: string
  /** Whether it won the lock or waited. */
  role: StampedeRole
  /** Where its value came from. */
  outcome: StampedeOutcome
  /** Epoch (ms) when the contender started. */
  startedAt: number
  /** Epoch (ms) when the contender resolved. */
  finishedAt: number
  /** Span (`finishedAt - startedAt`) in milliseconds. */
  durationMs: number
}

/** Burst roll-up — the result strip under the timeline. */
export interface StampedeSummary {
  /** Number of contenders fired. */
  concurrency: number
  /** Contenders that hit the origin — exactly 1 on a clean single-flight collapse. */
  originFetches: number
  /** Contenders served from the winner-populated cache. */
  cacheHits: number
  /** `cacheHits / concurrency`, in `[0, 1]`. */
  hitRate: number
}

/** The resolved registered script the burst exercised. */
export interface StampedeScriptInfo {
  /** Registered script name (e.g. `acquireLock`). */
  name: string
  /** Its resolved SHA1 from `ScriptManagerService.load`. */
  sha: string
}

/** Full `POST /stampede` response body. */
export interface StampedeResult {
  /** The product id the burst contended for. */
  productId: string
  /** One entry per contender (bounded by `concurrency`). */
  timeline: readonly StampedeTimelineEntry[]
  /** Burst roll-up. */
  summary: StampedeSummary
  /** The single-flight lock script's resolved identity. */
  script: StampedeScriptInfo
}

/** Parameters for a stampede burst (mirrors the API query DTO bounds). */
export interface StampedeParams {
  /** The (uncached) product id every contender races for (`[A-Za-z0-9_-]{1,64}`). */
  productId: string
  /** How many concurrent contenders to fire (1–100). */
  concurrency: number
  /** The single-flight lock TTL in milliseconds (50–60000). */
  lockMs: number
}

/** The serializer codecs the lab can label a round-trip with. */
export type SerializerCodec = 'json' | 'msgpack'

/** Response of `POST /serializer/roundtrip` — raw stored bytes vs decoded value. */
export interface RoundtripResult {
  /** The codec label the request was tagged with. */
  codec: string
  /** The raw stored string (`getRaw`); `null` when the key was evicted. */
  raw: string | null
  /** The decoded value (`get`). */
  decoded: unknown
  /** Byte length of the raw stored string. */
  rawBytes: number
  /** The raw value read back through the `setRaw`/`getRaw` bypass. */
  rawBypass: string | null
}

/** Response of `POST /serializer/caveat` — the `Date` round-trip outcome. */
export interface CaveatResult {
  /** The codec label the request was tagged with. */
  codec: string
  /** The raw stored string. */
  raw: string | null
  /** The decoded value (a `Date` survives only under a structure-preserving codec). */
  decoded: unknown
  /** Whether the `Date` survived the round-trip intact. */
  dateSurvived: boolean
  /** Human-readable explanation of the outcome. */
  note: string
}

/** Response of `GET /serializer/active` — the injected codec's class name. */
export interface ActiveSerializerResponse {
  /** Constructor name of the active `ISerializer` (e.g. `JsonSerializer`). */
  serializer: string
}

/** Typed Stampede Lab endpoint (`/stampede`). */
export const stampedeApi = {
  /**
   * Fire a single-flight burst for an (uncached) product and return its timeline.
   *
   * @param params - The product id, concurrency, and lock TTL.
   * @returns The per-contender timeline, the summary, and the script SHA.
   */
  run: (params: StampedeParams): Promise<ApiResult<StampedeResult>> => {
    const search = new URLSearchParams({
      productId: params.productId,
      concurrency: String(params.concurrency),
      lockMs: String(params.lockMs),
    })
    return api.post<StampedeResult>(`/stampede?${search.toString()}`)
  },
}

/** Typed Serializer Lab endpoints (`/serializer/*`). */
export const serializerApi = {
  /**
   * Round-trip a payload through the active serializer, returning raw + decoded.
   *
   * @param codec - The codec label for the UI (the active codec is fixed per instance).
   * @param payload - Any non-empty JSON object to store and read back.
   * @returns `{ codec, raw, decoded, rawBytes, rawBypass }`.
   */
  roundtrip: (
    codec: SerializerCodec,
    payload: Record<string, unknown>,
  ): Promise<ApiResult<RoundtripResult>> =>
    api.post<RoundtripResult>(`/serializer/roundtrip?codec=${encodeURIComponent(codec)}`, payload),

  /**
   * Store the built-in `Date` caveat fixture and report whether the `Date` survived.
   *
   * @param codec - The codec label for the UI.
   * @returns `{ codec, raw, decoded, dateSurvived, note }`.
   */
  caveat: (codec: SerializerCodec): Promise<ApiResult<CaveatResult>> =>
    api.post<CaveatResult>(`/serializer/caveat?codec=${encodeURIComponent(codec)}`),

  /**
   * Read the active serializer's class name (from the injected `BYMAX_CACHE_SERIALIZER`).
   *
   * @returns `{ serializer }`.
   */
  active: (): Promise<ApiResult<ActiveSerializerResponse>> =>
    api.get<ActiveSerializerResponse>('/serializer/active'),
}

/** The full set of canonical cache error codes (the Error Explorer's trigger list). */
export const ERROR_CODES: readonly CacheErrorCode[] = Object.values(CACHE_ERROR_CODES)

/** Typed Error Explorer endpoint (`/errors/:code`). */
export const errorsApi = {
  /**
   * Trigger the `CacheException` for a canonical code. The response is *always* a
   * structured error, so this resolves `{ ok: false, error }` on the happy path.
   *
   * @param code - A canonical `CacheErrorCode` (e.g. `cache.invalid_key`).
   * @returns The decoded `ApiResult` — `ok: false` carrying the canonical status + body.
   */
  trigger: (code: CacheErrorCode): Promise<ApiResult<never>> =>
    api.post<never>(`/errors/${encodeURIComponent(code)}`),
}
