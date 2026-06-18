/**
 * Async test helpers — polling utilities for real-Redis E2E specs.
 *
 * Pub/Sub delivery and keyspace events are inherently asynchronous: a `publish`
 * returns before its subscribers run. `waitUntil` lets a spec await a condition
 * (a handler fired, a counter reached N) instead of guessing with a fixed sleep,
 * keeping the real-time specs deterministic rather than flaky.
 *
 * @module test/helpers/async
 */

/** Default upper bound (ms) before {@link waitUntil} gives up. */
const DEFAULT_TIMEOUT_MS = 5_000
/** Default gap (ms) between predicate evaluations. */
const DEFAULT_INTERVAL_MS = 20

/**
 * Resolves once `predicate` is truthy, polling until then or rejecting on timeout.
 *
 * @param predicate - Condition to await; may be sync or async.
 * @param timeoutMs - Maximum time to wait before rejecting.
 * @param intervalMs - Delay between successive evaluations.
 * @returns Resolves when the predicate first becomes truthy.
 * @throws When the predicate never becomes truthy within `timeoutMs`.
 */
export async function waitUntil(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  intervalMs: number = DEFAULT_INTERVAL_MS,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (await predicate()) return
    if (Date.now() >= deadline) {
      throw new Error(`waitUntil: condition not met within ${timeoutMs}ms`)
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}
