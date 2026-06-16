/**
 * Cache options factory — maps validated env to `BymaxCacheModuleOptions`.
 *
 * Layer: cache. This is the project's headline copy-paste artifact: it separates
 * _what the options are_ from _how the module is wired_ (the latter is app.module.ts).
 * Standalone is the default path; sentinel/cluster are stubbed and throw until
 * their respective topology phases wire them. The serializer selection and the
 * Lua script registry are placeholders filled in later phases.
 */
import type { ConfigService } from '@nestjs/config'
import type {
  BymaxCacheModuleOptions,
  ICacheEvents,
  IScriptDefinition,
  ISerializer,
} from '@bymax-one/nest-cache'
import type { Env } from '../config/env.schema.js'

/**
 * Pre-registered Lua scripts passed to the module at boot.
 * Populated with the single-flight `acquireLock` script in a later phase.
 */
const CACHE_SCRIPTS: readonly IScriptDefinition[] = [] // TODO(phase-10): acquireLock

/**
 * Builds the resolved options for `BymaxCacheModule` from the validated env.
 *
 * IMPORTANT: `isGlobal` is NOT set here. It is a synchronous decision made by
 * the module builder at the `forRootAsync({ isGlobal, … })` call site —
 * returning it from inside `useFactory` has no effect (spec §9.2).
 *
 * @param config - Typed config service over the Zod-validated Env.
 * @param events - The lifecycle bridge (Logger + WebSocket broadcaster).
 * @returns Fully-formed BymaxCacheModuleOptions for the standalone path.
 */
export function buildCacheOptions(
  config: ConfigService<Env, true>,
  events: ICacheEvents,
): BymaxCacheModuleOptions {
  const mode = config.get('CACHE_MODE', { infer: true })

  // TODO(phase-7): replace with `new MsgPackSerializer()` when CACHE_SERIALIZER === 'msgpack'.
  // `undefined` → omitted → the library's default JsonSerializer is used.
  const serializer: ISerializer | undefined = undefined

  return {
    mode,
    ...(mode === 'standalone'
      ? { connection: { url: config.get('REDIS_URL', { infer: true }) } }
      : {}),
    ...(mode === 'sentinel' ? { sentinel: buildSentinelBlock() } : {}),
    ...(mode === 'cluster' ? { cluster: buildClusterBlock() } : {}),
    namespace: config.get('CACHE_NAMESPACE', { infer: true }),
    keySeparator: config.get('CACHE_KEY_SEPARATOR', { infer: true }),
    ...(serializer !== undefined ? { serializer } : {}),
    events,
    scripts: CACHE_SCRIPTS,
    shutdownTimeoutMs: config.get('SHUTDOWN_TIMEOUT_MS', { infer: true }),
    allowFlushInProduction: config.get('ALLOW_FLUSH_IN_PRODUCTION', { infer: true }),
  }
}

/**
 * Sentinel connection block. Implemented in a later topology phase (§15.2).
 *
 * @throws Always — sentinel mode is not yet configured.
 */
function buildSentinelBlock(): never {
  throw new Error('Sentinel mode not yet wired')
}

/**
 * Cluster connection block. Implemented in a later topology phase (§15.3).
 *
 * @throws Always — cluster mode is not yet configured.
 */
function buildClusterBlock(): never {
  throw new Error('Cluster mode not yet wired')
}
