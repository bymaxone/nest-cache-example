/**
 * Playwright configuration for the web smoke.
 *
 * A single chromium project pointed at a running stack (`baseURL`): the smoke is
 * a happy-path integration check against the real dashboard, API, and Redis, so it
 * assumes the stack is already up (locally via `pnpm dev` + `pnpm infra:up`; in CI
 * the `e2e`/`web` jobs bring it up). Override the target with `PLAYWRIGHT_BASE_URL`.
 *
 * This is the example-app web bar (docs/DEVELOPMENT_PLAN.md Appendix C): a focused
 * happy-path smoke, not an exhaustive UI suite — and no coverage gate.
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
