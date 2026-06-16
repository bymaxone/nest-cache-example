/**
 * Browser-path resolution probe for the zero-dependency @bymax-one/nest-cache/shared subpath.
 *
 * Imports EXCLUSIVELY from @bymax-one/nest-cache/shared — never from the server
 * subpath `.` — proving the dashboard's cache types pull in NO NestJS and NO
 * ioredis. Inert at runtime; exists so `pnpm typecheck` proves the zero-dependency
 * layering holds and `./shared` resolves correctly in the web app. Superseded by
 * real api-client and status-badge typing once the dashboard is wired.
 */
import {
  CACHE_ERROR_CODES,
  type CacheErrorCode,
  type CacheConnectionStatus,
  type SerializableValue,
} from '@bymax-one/nest-cache/shared'

// Reference every import so it is not flagged as unused.
const probedCodes: readonly CacheErrorCode[] = Object.values(CACHE_ERROR_CODES)
const probedStatus: CacheConnectionStatus = 'ready'
const probedValue: SerializableValue = { ok: true }

export const CACHE_SHARED_PROBE = {
  codeCount: probedCodes.length,
  status: probedStatus,
  sample: probedValue,
} as const
