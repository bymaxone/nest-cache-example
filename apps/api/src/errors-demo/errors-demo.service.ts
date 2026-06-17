/**
 * Error-surface demo service — provokes every canonical `CacheException`.
 *
 * Layer: errors-demo. Backs the Error Explorer: maps each of the 15
 * `CACHE_ERROR_CODES` to the smallest action that raises that exact
 * `CacheException`, so the global `CacheExceptionFilter` can be observed mapping
 * every code to its canonical HTTP status + structured body (spec §19).
 *
 * Honest semantics (spec §G2): request-reachable codes are provoked through the
 * REAL library API (an empty key, a corrupt payload, an unknown script, a Lua
 * runtime error, and — in cluster mode — the cluster guard). Codes that only
 * arise from a boot/topology/shutdown/env condition (`connection_failed`,
 * `command_timeout`, `connection_lost`, `invalid_namespace`,
 * `script_registry_missing`, `flush_disabled_in_production`,
 * `cluster_misconfigured`, `sentinel_misconfigured`, `shutdown_timeout`) are
 * thrown directly and tagged `details.simulated: true`, with a comment naming
 * the real-world trigger — the demo never pretends a simulated code is live. The
 * authentic `flush_disabled_in_production` guard is demonstrated by running the
 * API with `NODE_ENV=production` and calling the admin flush path (spec §19.3),
 * not by mutating `process.env` per request.
 */
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CacheService, CacheException } from '@bymax-one/nest-cache'
// Codes/types come from the zero-dependency '/shared' subpath — the same import
// apps/web reuses to type its CacheErrorCode error union in the browser bundle.
import { CACHE_ERROR_CODES, type CacheErrorCode } from '@bymax-one/nest-cache/shared'
import type { Env } from '../config/env.schema.js'

/**
 * A single trigger: performs an action expected to raise a `CacheException`,
 * either synchronously (a tagged simulation) or via a rejected promise (a real
 * library call). `trigger()` awaits the result, so both paths surface uniformly.
 */
type ErrorTrigger = () => unknown

/** TTL (seconds) for the deliberately corrupt key the deserialization trigger writes,
 *  so the demo never leaves an undecodable key lingering in the namespace. */
const CORRUPT_KEY_TTL_SECONDS = 60

/**
 * Provokes each canonical cache error on demand for the Error Explorer.
 *
 * Demonstrates `CacheException`, `CACHE_ERROR_CODES`, and the canonical
 * code→status mapping (matrix #41–#44) without hand-rolling any HTTP status —
 * the status always comes from `CacheException.getStatus()` via the filter.
 */
@Injectable()
export class ErrorsDemoService {
  constructor(
    private readonly cache: CacheService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Per-code trigger table. Each entry either drives the real library API (so
   * the library itself throws the `CacheException`) or throws a tagged,
   * simulated exception for a boot/topology-only code. The `Record` is keyed by
   * `CacheErrorCode`, so the compiler rejects this file if the library ever adds
   * a new code without a trigger here.
   */
  private readonly triggers: Record<CacheErrorCode, ErrorTrigger> = {
    // ── Request-reachable: the real library API raises the exception ──
    // Empty prefix → KeyBuilder rejects the key (HTTP 400).
    [CACHE_ERROR_CODES.INVALID_KEY]: () => this.cache.get('', 'demo'),
    // BigInt is not JSON-encodable → the default JsonSerializer throws (HTTP 500).
    [CACHE_ERROR_CODES.SERIALIZATION_FAILED]: () =>
      this.cache.set('errors-demo', 'serialization', { amount: 10n }),
    // Write a deliberately corrupt payload (short TTL), then read it back →
    // JSON.parse fails (HTTP 500).
    [CACHE_ERROR_CODES.DESERIALIZATION_FAILED]: async () => {
      await this.cache.setRaw(
        'errors-demo',
        'deserialization',
        '%%not-valid-json%%',
        CORRUPT_KEY_TTL_SECONDS,
      )
      return this.cache.get('errors-demo', 'deserialization')
    },
    // eval of a name that was never registered (HTTP 500).
    [CACHE_ERROR_CODES.SCRIPT_NOT_REGISTERED]: () =>
      this.cache.eval('__unregistered_script__', ['errors-demo'], []),
    // A registered script handed an invalid PX argument → Redis raises a Lua
    // runtime error, surfaced as SCRIPT_EXECUTION_FAILED (HTTP 500).
    [CACHE_ERROR_CODES.SCRIPT_EXECUTION_FAILED]: () =>
      this.cache.eval('acquireLock', ['errors-demo:lock'], ['token', 'not-a-number']),
    // The real cluster guard when running in cluster mode; a tagged simulation
    // otherwise (the authentic surface is the admin endpoints under cluster) (HTTP 500).
    [CACHE_ERROR_CODES.UNSUPPORTED_IN_CLUSTER]: () => this.triggerUnsupportedInCluster(),

    // ── Boot / topology / shutdown / env only: thrown directly, tagged simulated ──
    // Real trigger: the connection never reaches `ready` (Redis unreachable at boot).
    [CACHE_ERROR_CODES.CONNECTION_FAILED]: () => this.simulate(CACHE_ERROR_CODES.CONNECTION_FAILED),
    // Real trigger: a tiny `connection.commandTimeout` elapses before a slow command returns.
    [CACHE_ERROR_CODES.COMMAND_TIMEOUT]: () => this.simulate(CACHE_ERROR_CODES.COMMAND_TIMEOUT),
    // Real trigger: the connection drops mid-command.
    [CACHE_ERROR_CODES.CONNECTION_LOST]: () => this.simulate(CACHE_ERROR_CODES.CONNECTION_LOST),
    // Real trigger: `namespace` is empty or contains the key separator (module config).
    [CACHE_ERROR_CODES.INVALID_NAMESPACE]: () => this.simulate(CACHE_ERROR_CODES.INVALID_NAMESPACE),
    // Real trigger: `eval` on a CacheService instantiated without a ScriptManagerService
    // (the module always wires one, so this is unreachable from a request).
    [CACHE_ERROR_CODES.SCRIPT_REGISTRY_MISSING]: () =>
      this.simulate(CACHE_ERROR_CODES.SCRIPT_REGISTRY_MISSING),
    // Real trigger: CACHE_MODE=cluster with an empty `cluster.nodes` at boot.
    [CACHE_ERROR_CODES.CLUSTER_MISCONFIGURED]: () =>
      this.simulate(CACHE_ERROR_CODES.CLUSTER_MISCONFIGURED),
    // Real trigger: CACHE_MODE=sentinel with no sentinels/name at boot.
    [CACHE_ERROR_CODES.SENTINEL_MISCONFIGURED]: () =>
      this.simulate(CACHE_ERROR_CODES.SENTINEL_MISCONFIGURED),
    // Real trigger: graceful shutdown `quit()` exceeds `shutdownTimeoutMs`.
    [CACHE_ERROR_CODES.SHUTDOWN_TIMEOUT]: () => this.simulate(CACHE_ERROR_CODES.SHUTDOWN_TIMEOUT),
    // Real trigger: flushNamespace() under NODE_ENV=production with the guard on.
    // The live guard is demonstrated by running the API in production and calling
    // the admin flush path (spec §19.3); surfaced here as a tagged simulation so
    // the demo never mutates process.env per request (HTTP 403).
    [CACHE_ERROR_CODES.FLUSH_DISABLED_IN_PRODUCTION]: () =>
      this.simulate(CACHE_ERROR_CODES.FLUSH_DISABLED_IN_PRODUCTION),
  }

  /**
   * Triggers the cache error identified by `code`.
   *
   * Runs the matching trigger and lets the resulting `CacheException` bubble to
   * the global filter. Never returns normally: a trigger is expected to throw,
   * and if a real-library call unexpectedly succeeds the method fails closed by
   * throwing the requested code so the endpoint contract (always an error) holds.
   *
   * @param code - A validated canonical `CacheErrorCode` (from the route param).
   * @returns Never — always rejects with a `CacheException`.
   * @throws {CacheException} The exception mapped to `code`.
   */
  async trigger(code: CacheErrorCode): Promise<never> {
    await this.triggers[code]()
    throw new CacheException(code, { simulated: true, note: 'trigger did not raise; forced' })
  }

  /**
   * Provokes `UNSUPPORTED_IN_CLUSTER` through the real library when possible.
   *
   * In cluster mode `getClient()` throws synchronously because the underlying
   * client is a `Cluster` (it has no top-level `scanStream`). In standalone /
   * sentinel mode the restricted methods do not throw, so this falls back to a
   * tagged simulation — the authentic surface is the admin `scan`/`flushNamespace`/
   * `getClient` endpoints under `CACHE_MODE=cluster` (verified in the cluster run).
   *
   * Adjacent cluster facts (spec §15.4): `scan`, `flushNamespace`, and
   * `getClient` are rejected; `eval` instead requires ≥1 key and all keys of one
   * call must hash to a single slot (use a hash tag); Pub/Sub is an experimental
   * passthrough that is NOT rejected.
   *
   * @returns Never — throws synchronously with `UNSUPPORTED_IN_CLUSTER`.
   * @throws {CacheException} `UNSUPPORTED_IN_CLUSTER` (HTTP 500).
   */
  private triggerUnsupportedInCluster(): never {
    if (this.config.get('CACHE_MODE', { infer: true }) === 'cluster') {
      // Real cluster guard: rejects the raw-client escape hatch (throws synchronously).
      this.cache.getClient()
    }
    throw new CacheException(CACHE_ERROR_CODES.UNSUPPORTED_IN_CLUSTER, { simulated: true })
  }

  /**
   * Throws a boot/topology/shutdown-only code directly, tagged `simulated: true`.
   *
   * These codes cannot be raised from a request against a healthy standalone
   * deployment; the per-entry comment in {@link ErrorsDemoService.triggers}
   * names the real-world condition that produces each.
   *
   * @param code - The canonical code to raise.
   * @returns Never.
   * @throws {CacheException} The exception mapped to `code`, with the canonical status.
   */
  private simulate(code: CacheErrorCode): never {
    throw new CacheException(code, { simulated: true })
  }
}
