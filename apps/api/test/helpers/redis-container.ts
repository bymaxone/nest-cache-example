/**
 * Testcontainers helper — boots a real `redis:7-alpine` for the E2E suite.
 *
 * Every real-Redis spec starts its own container in `beforeAll` and stops it in
 * `afterAll`, so suites never share mutable Redis state. The container is launched
 * with `--notify-keyspace-events Ex`, WITHOUT which Redis never publishes
 * `__keyevent@<db>__:expired` — the channel the read-through TTL spec asserts on.
 *
 * Testcontainers requires a reachable Docker daemon. When Docker is unreachable
 * `start()` rejects, so the run fails loudly rather than silently skipping the
 * real-Redis coverage.
 *
 * @module test/helpers/redis-container
 */
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis'

/** Image pinned for reproducible E2E runs; matches the dev-infra Redis major. */
const REDIS_IMAGE = 'redis:7-alpine'

/** Generous boot window — first run also pulls the image on a cold machine. */
const STARTUP_TIMEOUT_MS = 120_000

/**
 * Starts a `redis:7-alpine` container with keyspace-expiry notifications enabled.
 *
 * `--notify-keyspace-events Ex` makes Redis emit `__keyevent@<db>__:expired` when
 * a key's TTL elapses — required by the read-through TTL E2E. The default image
 * does not enable it, so it must be passed as a server start argument.
 *
 * @returns The started container; call `.getConnectionUrl()` for the client URL.
 * @throws When the Docker daemon is unreachable or the image cannot start.
 */
export async function startRedisContainer(): Promise<StartedRedisContainer> {
  return new RedisContainer(REDIS_IMAGE)
    .withCommand(['redis-server', '--notify-keyspace-events', 'Ex'])
    .withStartupTimeout(STARTUP_TIMEOUT_MS)
    .start()
}
