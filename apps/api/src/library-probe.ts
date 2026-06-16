/**
 * Compile-time resolution probe for @bymax-one/nest-cache dual-subpath exports.
 *
 * Proves both published subpaths type-resolve from the NestJS app: the server
 * subpath `.` (module + services) AND the zero-dependency shared subpath
 * `./shared`. Inert at runtime — exists so `pnpm typecheck` catches regressions
 * in the published exports map or dual ESM+CJS build. Superseded by real module
 * wiring once AppModule registers BymaxCacheModule.
 */
import { BymaxCacheModule, CacheService } from '@bymax-one/nest-cache'
import { CACHE_ERROR_CODES, type CacheErrorCode } from '@bymax-one/nest-cache/shared'

// Reference each import so noUnusedLocals is satisfied.
const probedServerExports = [BymaxCacheModule, CacheService] as const
const probedSharedCodes: readonly CacheErrorCode[] = Object.values(CACHE_ERROR_CODES)

export const LIBRARY_PROBE = {
  serverExportCount: probedServerExports.length,
  sharedCodeCount: probedSharedCodes.length,
} as const
