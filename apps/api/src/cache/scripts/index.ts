/**
 * Lua script registry pre-registered on the cache module via `options.scripts`.
 *
 * Layer: cache. `ScriptManagerService` eager-loads every entry on bootstrap
 * (`SCRIPT LOAD` → `EVALSHA`, with transparent `NOSCRIPT` reload-retry on
 * standalone/sentinel), then consumers run them by name through
 * `CacheService.eval(name, keys, args)`.
 *
 * SECURITY INVARIANT (TECHNICAL_SPECIFICATION.md §24): every `lua` body is a
 * string literal declared here in code. A Lua script MUST NEVER be assembled
 * from request input — doing so is a script-injection vector. Only `KEYS`/`ARGV`
 * are parameterised at call time (and `CacheService.eval` auto-namespaces `KEYS`).
 */
import type { IScriptDefinition } from '@bymax-one/nest-cache'

/**
 * Scripts loaded into Redis at boot and invoked by name via `CacheService.eval`.
 *
 * - `acquireLock` — the canonical `SET NX PX` single-flight primitive. Returns
 *   `1` when the caller won the lock, `0` when another caller already holds it.
 *   `KEYS[1]` is the (auto-namespaced) lock key; `ARGV[1]` the owner token;
 *   `ARGV[2]` the lock TTL in milliseconds.
 * - `releaseLock` — the token-safe counterpart. Deletes the lock only if the
 *   caller still owns it (compare-and-delete), so a slow contender can never
 *   delete a lock a later winner re-acquired. Returns `1` when it released the
 *   lock, `0` when the token no longer matches. `KEYS[1]` is the (auto-namespaced)
 *   lock key; `ARGV[1]` the owner token.
 *
 * Every `lua` is a literal in source, never built from runtime input (§24).
 */
export const CACHE_SCRIPTS: readonly IScriptDefinition[] = [
  {
    name: 'acquireLock',
    // SET NX PX — single-flight lock. Returns 1 if the caller won the lock, else 0.
    // KEYS[1] = lock key (auto-namespaced by CacheService.eval); ARGV[1] = owner token; ARGV[2] = ttl(ms).
    lua: `if redis.call('SET', KEYS[1], ARGV[1], 'NX', 'PX', ARGV[2]) then return 1 else return 0 end`,
  },
  {
    name: 'releaseLock',
    // Token-safe compare-and-delete. Releases the lock only when the caller still
    // owns it, atomically (GET + DEL in one script — no check-then-act race).
    // KEYS[1] = lock key (auto-namespaced by CacheService.eval); ARGV[1] = owner token.
    lua: `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end`,
  },
]
