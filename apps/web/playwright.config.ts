/**
 * Playwright configuration for the web smoke.
 *
 * A single chromium project pointed at a running stack (`baseURL`): the smoke is
 * a happy-path integration check against the real dashboard, API, and Redis, so it
 * assumes the stack is **already up** — run it locally (`pnpm infra:up` + both
 * `pnpm dev` servers) or in a future stack job. The current CI workflow does NOT
 * run this smoke or bootstrap the stack; override the target with `PLAYWRIGHT_BASE_URL`.
 *
 * This is the example-app web smoke bar (docs/DEVELOPMENT_PLAN.md Appendix C): a
 * focused happy-path check, not an exhaustive UI suite.
 *
 * @module playwright.config
 */
import { defineConfig, devices } from '@playwright/test'

/** The running dashboard to drive; defaults to the local `next` dev/start port. */
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['line']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
