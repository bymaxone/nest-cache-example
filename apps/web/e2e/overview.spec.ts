/**
 * Overview page journey (Playwright, running stack).
 *
 * Drives the cache-health landing page (`/`) against a live API + Redis and proves
 * two seams: the golden-signal layout renders its full structure (the hit-rate gauge,
 * the throughput / latency / memory / keys tiles, and the INFO-sourced connection &
 * pipeline band), and the band's status badge reads Ready once the live `/health`
 * poll resolves — confirming the page is wired to a healthy backend, not stubbed data.
 *
 * Only structural, real-data-safe facts are asserted (static labels, headings, the
 * Ready badge); the live metric VALUES differ every run, so none are pinned.
 *
 * `?live=true` enables the socket feed (the `live` URL filter defaults to off), matching
 * the smoke so the page mounts in the same mode a user lands on from a shared deep-link.
 *
 * @module e2e/overview.spec
 */
import { test, expect } from '@playwright/test'

/** Enables the live socket feed, which the `live` URL filter leaves off by default. */
const LIVE = '?live=true'

test.describe('Overview (running stack)', () => {
  test('renders the heading, the golden-signal tiles, and the connection band', async ({
    page,
  }) => {
    /*
     * Scenario: a user opens the Overview landing page against a running API + Redis.
     * Rule it protects: the golden-signal information architecture renders end to end —
     * the page heading, the six health tiles fed by `/metrics` + `/admin/info` +
     * `/admin/keyspace`, and the INFO-sourced connection & pipeline band. A dropped panel
     * or a broken data hook collapses one of these static labels and fails here.
     */
    await page.goto(`/${LIVE}`)

    // The page header identifies the route.
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()

    // The golden-signal health strip: the hit-rate gauge plus the KPI tiles. These are
    // static labels that hold regardless of the live metric values behind them.
    await expect(page.getByText('Hit rate', { exact: true })).toBeVisible()
    await expect(page.getByText('Throughput', { exact: true })).toBeVisible()
    await expect(page.getByText('Latency p95', { exact: true })).toBeVisible()
    await expect(page.getByText('Memory', { exact: true })).toBeVisible()
    await expect(page.getByText('Keys (ns)')).toBeVisible()

    // The INFO-sourced connection & pipeline band and one of its always-present stats.
    await expect(page.getByText('Connection & pipeline health')).toBeVisible()
    await expect(page.getByText('Uptime', { exact: true })).toBeVisible()
  })

  test('reads Ready in the connection band from the live health poll', async ({ page }) => {
    /*
     * Scenario: the Overview band polls the live `/health` endpoint, which itself pings Redis.
     * Rule it protects: a healthy backend resolves the band status to Ready — proving the
     * dashboard talks to a live, connected API rather than rendering placeholder state. The
     * exact latency/uptime numbers vary per run, so only the structural Ready badge is pinned.
     */
    await page.goto(`/${LIVE}`)

    // The band status badge reads Ready (green) once the health poll lands.
    await expect(page.getByText('Ready').first()).toBeVisible()

    // The `Mode` band stat renders from the live INFO read alongside the status.
    await expect(page.getByText('Mode', { exact: true })).toBeVisible()
  })
})
