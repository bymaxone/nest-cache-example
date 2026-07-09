/**
 * Compile-time resolution probe for @bymax-one/nest-cache dual-subpath exports.
 *
 * Proves both published subpaths type-resolve from the NestJS app: the server
 * subpath `.` (module + services) AND the zero-dependency shared subpath
 * `./shared`. Inert at runtime — exists so `pnpm typecheck` catches regressions
 * in the published exports map or dual ESM+CJS build.
 *
 * It also pins the published **type-only** exports that have no runtime call
 * site in the demo (the async-registration options interface and the
 * re-exported ioredis key/options types). Referencing them in type positions is
 * the honest demonstration for the export-usage audit — proving they resolve
 * from the server subpath and stay usable by a consumer (spec §7 matrix rows
 * #48 dual subpath and #49 re-exported ioredis types).
 */
import {
  BymaxCacheModule,
  CacheService,
  type BymaxCacheModuleAsyncOptions,
  type RedisKey,
  type RedisOptions,
} from '@bymax-one/nest-cache'
import { CACHE_ERROR_CODES, type CacheErrorCode } from '@bymax-one/nest-cache/shared'

// Reference each value import so noUnusedLocals is satisfied.
const probedServerExports = [BymaxCacheModule, CacheService] as const
const probedSharedCodes: readonly CacheErrorCode[] = Object.values(CACHE_ERROR_CODES)

/**
 * Type-resolution witness for the published type-only exports.
 *
 * A consumer wiring `BymaxCacheModule.forRootAsync` uses
 * `BymaxCacheModuleAsyncOptions`; one touching raw keys/connection settings uses
 * the re-exported ioredis `RedisKey` / `RedisOptions`. This tuple proves all
 * three resolve from the server subpath without pulling `ioredis` in directly.
 */
export type ProbedResolvableTypes = [BymaxCacheModuleAsyncOptions, RedisKey, RedisOptions]

export const LIBRARY_PROBE = {
  serverExportCount: probedServerExports.length,
  sharedCodeCount: probedSharedCodes.length,
} as const
