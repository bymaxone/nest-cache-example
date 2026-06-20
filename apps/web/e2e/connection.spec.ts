/**
 * Connection & Topology page journey (Playwright, running stack).
 *
 * Drives the connection lifecycle page (`/connection`) against a live API + Redis and
 * proves two seams: the page resolves a Ready status from the live `/health` poll and
 * reports the active `standalone` mode (the throwaway test stack runs standalone), and
 * the topology/mode card lists every supported mode while the Status card surfaces the
 * health ping latency.
 *
 * Only structural, real-data-safe facts are asserted (the heading, the Ready badge, the
 * active-mode subtitle, the static topology rows, and a latency value matching the
 * `<n>ms` shape). The live latency value differs every run, so it is matched by regex,
 * never pinned to a number.
 *
 * @module e2e/connection.spec
 */
import { test, expect } from '@playwright/test'

test.describe('Connection & Topology (running stack)', () => {
  test('renders the heading, reads Ready, and reports the standalone mode', async ({ page }) => {
    /*
     * Scenario: a user opens the Connection & Topology page against a running API + Redis.
     * Rule it protects: the page resolves its status from the live `/health` poll (Ready when
     * the backend is healthy) and reports the active topology. The test stack runs a single
     * standalone Redis, so `activeMode` is `standalone` — a broken health transport or a
     * drifted mode fallback fails here.
     */
    await page.goto('/connection')

    // The page header identifies the route.
    await expect(page.getByRole('heading', { name: 'Connection & Topology' })).toBeVisible()

    // The Status badge resolves to Ready once the health poll lands on a healthy backend.
    await expect(page.getByText('Ready').first()).toBeVisible()

    // The active mode is the standalone test topology, named in the Mode card subtitle.
    await expect(page.getByText(/active:\s*standalone/)).toBeVisible()
  })

  test('shows the topology mode card and the health ping latency', async ({ page }) => {
    /*
     * Scenario: the same page, focused on the Redis-server view.
     * Rule it protects: the Mode card enumerates every supported topology (standalone /
     * sentinel / cluster) as static documentation, and the Status card surfaces the live
     * `/health` ping latency — proving the latency read round-trips to Redis. The value is
     * timing-dependent, so it is matched by its `<n>ms` shape rather than an exact number.
     */
    await page.goto('/connection')

    // The Status and Mode cards both render.
    await expect(page.getByText('Status', { exact: true })).toBeVisible()
    await expect(page.getByText('Mode', { exact: true })).toBeVisible()

    // The mode card documents the three supported topologies (static copy).
    await expect(page.getByText('sentinel', { exact: true })).toBeVisible()
    await expect(page.getByText('cluster', { exact: true })).toBeVisible()

    // The Status card surfaces the live ping latency: a labelled value in `<n>ms` form.
    await expect(page.getByText('ping latency')).toBeVisible()
    await expect(page.getByText(/\d+(?:\.\d+)?ms/).first()).toBeVisible()
  })
})
