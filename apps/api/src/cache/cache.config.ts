/**
 * Cache options factory — maps validated env to `BymaxCacheModuleOptions`.
 *
 * Layer: cache. This is the project's headline copy-paste artifact: it separates
 * _what the options are_ from _how the module is wired_ (the latter is app.module.ts).
 * `CACHE_MODE` switches the populated connection sub-block: `connection` for
 * standalone (the default), `sentinel` for sentinel, `cluster` for cluster — the
 * other two are always omitted (see TECHNICAL_SPECIFICATION.md §15.1–§15.3).
 */
import type { ConfigService } from '@nestjs/config'
import type {
  BymaxCacheModuleOptions,
  BymaxCacheSentinelConnection,
  BymaxCacheClusterConnection,
  SentinelAddress,
  ClusterNode,
  ICacheEvents,
} from '@bymax-one/nest-cache'
import type { Env } from '../config/env.schema.js'
import { MsgPackSerializer } from './msgpack.serializer.js'
import { CACHE_SCRIPTS } from './scripts/index.js'

/**
 * Builds the resolved options for `BymaxCacheModule` from the validated env.
 *
 * IMPORTANT: `isGlobal` is NOT set here. It is a synchronous decision made by
 * the module builder at the `forRootAsync({ isGlobal, … })` call site —
 * returning it from inside `useFactory` has no effect (spec §9.2).
 *
 * @param config - Typed config service over the Zod-validated Env.
 * @param events - The lifecycle bridge (Logger + WebSocket broadcaster).
 * @returns Fully-formed BymaxCacheModuleOptions for the active `CACHE_MODE`.
 */
export function buildCacheOptions(
  config: ConfigService<Env, true>,
  events: ICacheEvents,
): BymaxCacheModuleOptions {
  const mode = config.get('CACHE_MODE', { infer: true })

  const serializer =
    config.get('CACHE_SERIALIZER', { infer: true }) === 'msgpack'
      ? new MsgPackSerializer()
      : undefined // undefined → library default JsonSerializer

  return {
    mode,
    ...(mode === 'standalone'
      ? { connection: { url: config.get('REDIS_URL', { infer: true }) } }
      : {}),
    ...(mode === 'sentinel' ? { sentinel: buildSentinelBlock(config) } : {}),
    ...(mode === 'cluster' ? { cluster: buildClusterBlock(config) } : {}),
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
 * Parses a comma-separated `host:port` list into `{ host, port }` address
 * objects. The shape is assignable to both ioredis `SentinelAddress` and
 * `ClusterNode`, so the same parser feeds the sentinel and cluster builders.
 * Blank entries are dropped; a missing host falls back to `localhost`.
 *
 * @param raw - Comma-separated `host:port` pairs (e.g. `127.0.0.1:7000,127.0.0.1:7001`).
 * @returns One `{ host, port }` per non-empty pair, in input order.
 * @throws When a pair is missing or has a non-numeric port (fail fast at boot).
 */
function parseAddressList(raw: string): { host: string; port: number }[] {
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((pair) => {
      // Split host:port; an absent OR empty host (e.g. ":6379") falls back to localhost.
      // `split(':')` always yields index 0, so `rawHost` needs no default — only an
      // absent port (a colon-less entry) falls back to '' and then fails the NaN check.
      const [rawHost, portText = ''] = pair.split(':')
      const port = Number.parseInt(portText, 10)
      if (Number.isNaN(port)) {
        throw new Error(`Invalid Redis address "${pair}" — expected host:port`)
      }
      return { host: rawHost || 'localhost', port }
    })
}

/**
 * Parses an `announced=reachable` natMap list into an ioredis NAT map (spec §15.2).
 *
 * Each entry maps the `host:port` a NAT'd topology announces (the cluster slot
 * map / the sentinel master reply) to the `host:port` actually reachable from
 * this process — e.g. `172.31.0.11:7000=127.0.0.1:7000`. Returns `undefined`
 * when the input is empty, so the connection block omits `natMap` entirely
 * (the standalone/production default).
 *
 * @param raw - Comma-separated `announced=reachable` pairs (each side `host:port`).
 * @returns A `{ announced: { host, port } }` map, or `undefined` when empty.
 * @throws When the reachable side of a pair has a non-numeric port.
 */
function parseNatMap(raw: string): Record<string, { host: string; port: number }> | undefined {
  const map: Record<string, { host: string; port: number }> = {}
  for (const entry of raw.split(',').map((value) => value.trim())) {
    if (entry.length === 0) continue
    const [announced, reachable] = entry.split('=').map((value) => value.trim())
    if (!announced || !reachable) continue
    // Skip prototype-polluting keys: an env-supplied `__proto__` etc. must never
    // mutate Object.prototype via the dynamic assignment below.
    if (announced === '__proto__' || announced === 'constructor' || announced === 'prototype') {
      continue
    }
    // An absent OR empty host on the reachable side falls back to localhost.
    // `split(':')` always yields index 0, so `rawHost` needs no default — only an
    // absent port (a colon-less side) falls back to '' and then fails the NaN check.
    const [rawHost, portText = ''] = reachable.split(':')
    const port = Number.parseInt(portText, 10)
    if (Number.isNaN(port)) {
      throw new Error(`Invalid natMap target "${reachable}" — expected host:port`)
    }
    map[announced] = { host: rawHost || 'localhost', port }
  }
  return Object.keys(map).length > 0 ? map : undefined
}

/**
 * Builds the sentinel connection block from validated env (spec §15.2).
 *
 * Typed with the library's re-exported ioredis `SentinelAddress`, proving the
 * connection types compose cleanly. `password` and `natMap` are only set when
 * present — `exactOptionalPropertyTypes` forbids an explicit `undefined` on the
 * optional fields, so they are folded in via conditional spreads. `natMap`
 * rewrites the master address the sentinels announce to a host-reachable one
 * (spec §15.2), enabling a host client to reach a NAT'd Docker topology.
 *
 * @param config - Typed config service over the Zod-validated Env.
 * @returns The sentinel block: `{ sentinels, name, role, password?, natMap? }`.
 */
export function buildSentinelBlock(config: ConfigService<Env, true>): BymaxCacheSentinelConnection {
  const sentinels: SentinelAddress[] = parseAddressList(
    config.get('REDIS_SENTINELS', { infer: true }),
  )
  const password = config.get('REDIS_PASSWORD', { infer: true })
  const natMap = parseNatMap(config.get('REDIS_SENTINEL_NAT_MAP', { infer: true }))
  return {
    sentinels,
    name: config.get('REDIS_SENTINEL_MASTER', { infer: true }),
    role: config.get('REDIS_SENTINEL_ROLE', { infer: true }),
    ...(password !== undefined ? { password } : {}),
    ...(natMap !== undefined ? { natMap } : {}),
  }
}

/**
 * Builds the cluster connection block from validated env (spec §15.3).
 *
 * Typed with the library's re-exported ioredis `ClusterNode`. Only the seed
 * `nodes` are supplied; ioredis discovers the rest of the topology at connect
 * time. `options` is set only when a natMap is configured — it rewrites the
 * internal node addresses the cluster announces in its slot map to
 * host-reachable ones (spec §15.2); otherwise the library defaults apply.
 *
 * @param config - Typed config service over the Zod-validated Env.
 * @returns The cluster block: `{ nodes, options? }`.
 */
export function buildClusterBlock(config: ConfigService<Env, true>): BymaxCacheClusterConnection {
  const nodes: ClusterNode[] = parseAddressList(config.get('REDIS_CLUSTER_NODES', { infer: true }))
  const natMap = parseNatMap(config.get('REDIS_CLUSTER_NAT_MAP', { infer: true }))
  return {
    nodes,
    ...(natMap !== undefined ? { options: { natMap } } : {}),
  }
}
