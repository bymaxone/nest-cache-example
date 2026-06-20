/**
 * @fileoverview Playwright global teardown — optionally stops the test Redis stack.
 *
 * The test Redis (`docker-compose.test.yml`) is LEFT RUNNING by default so repeated
 * `pnpm test:e2e:web` runs reuse it (fast — the `webServer` entries reattach via
 * `reuseExistingServer`). Set `E2E_TEARDOWN=1` to bring it down after the run (e.g.
 * a one-shot invocation that should leave nothing behind). The dev stack on :6379
 * is never touched — only the dedicated :56379 test stack.
 *
 * @module e2e/global-teardown
 */
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

/** Repo root — where `docker compose` resolves the compose file. */
const ROOT = fileURLToPath(new URL('../../../', import.meta.url))

/**
 * Stop the dedicated test Redis stack only when `E2E_TEARDOWN=1` is set; otherwise
 * leave it up for the next run to reuse.
 *
 * @returns Nothing.
 */
export default function globalTeardown(): void {
  if (process.env.E2E_TEARDOWN !== '1') return
  execSync('docker compose -f docker-compose.test.yml down -v', { cwd: ROOT, stdio: 'inherit' })
}
