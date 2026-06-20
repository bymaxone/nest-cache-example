/**
 * Playwright configuration for the web smoke.
 *
 * Self-contained and isolated from the dev environment (mirrors the
 * nest-logger-example pattern): the `webServer` entries bring the whole stack up
 * before the smoke runs and gate each one on its readiness URL, so the journey
 * only starts once every service is live —
 *   1. the API entry brings up the DEDICATED test Redis (`docker-compose.test.yml`,
 *      project `nest-cache-example-test`: redis on :56379, ephemeral/tmpfs, keyspace
 *      notifications enabled), then starts the API pointed at it — gated on
 *      `/health`, which itself pings Redis, so the API is only "ready" once the
 *      service link is verified;
 *   2. the web entry starts the dashboard (`:3000`), gated on its root URL.
 * `reuseExistingServer` reattaches to anything already up, so a running dev stack
 * (or the CI workflow's pre-booted servers) is reused instead of double-started.
 *
 * The dev stack (`docker-compose.yml`, redis :6379) is never touched — only the
 * throwaway test Redis on :56379. Set `E2E_TEARDOWN=1` to stop it afterwards (see
 * `e2e/global-teardown.ts`). Override the target with `PLAYWRIGHT_BASE_URL` /
 * `PLAYWRIGHT_API_URL` to point the smoke at an already-running stack.
 *
 * @module playwright.config
 */
import { fileURLToPath } from 'node:url'

import { defineConfig, devices } from '@playwright/test'

/** Local stack origins. */
const WEB_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
const API_URL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3001'

/** Repo root — `docker compose` and workspace filters resolve from here. */
const ROOT = fileURLToPath(new URL('../../', import.meta.url))

/** Dedicated test Redis (matches docker-compose.test.yml's published port). */
const TEST_REDIS_URL = 'redis://127.0.0.1:56379'

/**
 * API bring-up chain: test Redis up (blocks until healthy) → start the API pointed
 * at it. Kept on the API entry (rather than a `globalSetup`, which Playwright runs
 * AFTER the web server starts) so Redis is guaranteed ready before the API connects.
 * Skipped entirely when the API is already healthy, via `reuseExistingServer`.
 */
const API_COMMAND = [
  'pnpm infra:test:up',
  `REDIS_URL=${TEST_REDIS_URL} pnpm --filter api dev`,
].join(' && ')

export default defineConfig({
  testDir: './e2e',
  globalTeardown: './e2e/global-teardown.ts',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['line']],
  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
  },
  // Every service the smoke depends on, each gated on its readiness URL. The first
  // entry also brings up Docker + the test Redis (see API_COMMAND); the bring-up is
  // generous on time because a cold Docker pull + Nest boot is slow. `cwd: ROOT`
  // runs the `pnpm` workspace/compose commands from the repo root.
  webServer: [
    {
      command: API_COMMAND,
      url: `${API_URL}/health`,
      cwd: ROOT,
      reuseExistingServer: true,
      timeout: 240_000,
    },
    {
      command: 'pnpm --filter web dev',
      url: WEB_URL,
      cwd: ROOT,
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
