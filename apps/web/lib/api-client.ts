/**
 * @fileoverview Typed transport layer between the dashboard and the NestJS API.
 *
 * A thin `fetch` wrapper (no axios, no `useEffect`+fetch) that returns a typed
 * `ApiResult<T>` discriminated union — it never throws on a structured API
 * error, so it composes cleanly with TanStack Query's `select`/error handling.
 * The API's `CacheExceptionFilter` serializes failures as
 * `{ error: { code, message, details } }`; this client decodes exactly that and
 * narrows `code` against `CACHE_ERROR_CODES` (falling back to `'unknown'`).
 *
 * `CacheErrorCode` is imported from the library's zero-dependency
 * `@bymax-one/nest-cache/shared` subpath — never the server subpath — so the
 * browser bundle types its error handling with the same codes the server throws
 * without pulling NestJS or ioredis into the client.
 *
 * @module lib/api-client
 */

import { CACHE_ERROR_CODES, type CacheErrorCode } from '@bymax-one/nest-cache/shared'

/** A decoded API error. `code` is narrowed to a known `CacheErrorCode` or `'unknown'`. */
export interface ApiError {
  /** The cache error code, or `'unknown'` when the body carried an unrecognized code. */
  code: CacheErrorCode | 'unknown'
  /** Human-readable message from the API (or a synthesized fallback). */
  message: string
  /** The HTTP status code of the failing response. */
  status: number
  /** Optional structured detail payload from the API filter. */
  details?: unknown
}

/** Result of an API call: either typed data or a decoded error. Never throws on a structured error. */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError }

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const KNOWN_CODES = new Set<string>(Object.values(CACHE_ERROR_CODES))

/**
 * Decode a non-2xx response body into a typed {@link ApiError}.
 *
 * @param status - The HTTP status code of the response.
 * @param body - The parsed JSON body (or `null` when absent/unparseable).
 * @returns A typed error with `code` narrowed against `CACHE_ERROR_CODES`.
 */
function toApiError(status: number, body: unknown): ApiError {
  const err = (body as { error?: { code?: string; message?: string; details?: unknown } } | null)
    ?.error
  const rawCode = err?.code
  const code: CacheErrorCode | 'unknown' =
    rawCode && KNOWN_CODES.has(rawCode) ? (rawCode as CacheErrorCode) : 'unknown'
  const result: ApiError = {
    code,
    message: err?.message ?? `Request failed (${status})`,
    status,
  }
  if (err?.details !== undefined) result.details = err.details
  return result
}

/**
 * Core typed fetch. Sends/accepts JSON against `NEXT_PUBLIC_API_URL` and decodes
 * the structured error body on failure. Resolves an {@link ApiResult}; it does
 * not throw on a structured API error.
 *
 * `path` must be an app-controlled absolute path (starting with `/`); any
 * dynamic segment must be encoded by the caller. The guard rejects malformed
 * paths early so a user-controlled value cannot escape the intended route.
 *
 * @typeParam T - The expected success payload shape.
 * @param path - API path appended to the configured base URL (e.g. `/health`).
 * @param init - Optional `fetch` init (method, body, headers).
 * @returns A discriminated result: `{ ok: true, data }` or `{ ok: false, error }`.
 * @throws {Error} If `path` does not start with `/` or contains a `..` segment.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  if (!path.startsWith('/') || path.includes('..')) {
    throw new Error(`apiFetch: invalid path "${path}"`)
  }
  // Build headers via the Headers API so every `HeadersInit` form (a `Headers`
  // instance, a `[name, value][]` array, or a record) merges correctly — an
  // object spread would silently drop non-record forms. JSON is the default
  // content type unless the caller already set one.
  const headers = new Headers(init?.headers)
  if (!headers.has('content-type')) headers.set('content-type', 'application/json')
  const res = await fetch(`${BASE}${path}`, { ...init, headers })
  const body: unknown = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) return { ok: false, error: toApiError(res.status, body) }
  return { ok: true, data: body as T }
}

/**
 * Verb helpers over {@link apiFetch} for the HTTP methods the dashboard pages use.
 *
 * `post` JSON-encodes its `json` argument when provided; pass `undefined` for a
 * bodyless POST.
 */
export const api = {
  /** Typed GET. */
  get: <T>(path: string): Promise<ApiResult<T>> => apiFetch<T>(path),
  /** Typed POST with an optional JSON body. */
  post: <T>(path: string, json?: unknown): Promise<ApiResult<T>> => {
    const init: RequestInit = { method: 'POST' }
    // Omit `body` entirely (rather than set it `undefined`) to satisfy
    // `exactOptionalPropertyTypes` against `RequestInit`.
    if (json !== undefined) init.body = JSON.stringify(json)
    return apiFetch<T>(path, init)
  },
  /** Typed DELETE with an optional JSON body (some routes, e.g. ref-counted unsubscribe, take one). */
  del: <T>(path: string, json?: unknown): Promise<ApiResult<T>> => {
    const init: RequestInit = { method: 'DELETE' }
    if (json !== undefined) init.body = JSON.stringify(json)
    return apiFetch<T>(path, init)
  },
}
