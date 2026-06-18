/**
 * Web happy-path smoke (Playwright, running stack).
 *
 * Drives the real dashboard against a live API + Redis and asserts the four signals
 * that prove the app is wired end to end: the shell renders, the connection status
 * reads Ready, the Explorer auto-scans and lists a namespaced key, and a Pub/Sub
 * publish round-trips — the REST publish fans out to the live `cache:event` feed.
 *
 * `?live=true` enables the socket feed (the `live` filter defaults to off), so the
 * published message reaches the feed within the test.
 *
 * @module e2e/smoke.spec
 */
import { test, expect } from '@playwright/test'

/** Enables the live socket feed, which the `live` URL filter leaves off by default. */
const LIVE = '?live=true'

/** The API the dashboard talks to; the smoke seeds keys through it so the run is self-contained. */
const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3001'

test.describe('dashboard smoke (running stack)', () => {
  test('renders the shell, reads Ready, lists keys, and round-trips a publish', async ({
    page,
  }) => {
    /*
     * Scenario: a user opens the live dashboard against a running API + Redis.
     * Rule it protects: the app is wired end to end — the shell renders, the
     * connection reads Ready, the Explorer scans real keys, and a REST publish fans
     * out to the live socket feed. A regression in any of those four seams fails here.
     */
    // 1) Shell: the brand wordmark and the grouped sidebar navigation render.
    await page.goto(`/${LIVE}`)
    await expect(page.getByText('nest-cache-example')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Explorer' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Pub/Sub' })).toBeVisible()

    // 2) The connection status badge reads Ready (green) from the health poll / live feed.
    await expect(page.getByText('Ready').first()).toBeVisible()

    // 3) Seed a few keys through the API (read-through populates the namespace), then
    //    the Explorer auto-scans and lists at least one namespaced key row.
    for (const id of ['p1', 'p2', 'p3']) {
      await page.request.get(`${API_BASE}/catalog/products/${id}`)
    }
    await page.goto(`/explorer${LIVE}`)
    await expect(page.getByRole('heading', { name: 'Key Explorer' })).toBeVisible()
    await expect(page.getByText(/cache-example:/).first()).toBeVisible()

    // 4) A publish round-trips: the REST publish fans out to the live cache:event feed.
    await page.goto(`/pubsub${LIVE}`)
    const payload = page.locator('#publish-payload')
    await expect(payload).toBeVisible()
    const marker = `e2e-marker-${Date.now()}`
    await payload.fill(JSON.stringify({ marker }))
    await page.getByRole('button', { name: 'Publish' }).click()
    await expect(page.getByText(marker).first()).toBeVisible()
  })
})
