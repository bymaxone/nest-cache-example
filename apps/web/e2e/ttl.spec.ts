/**
 * TTL Live journey (Playwright, running stack).
 *
 * Drives the TTL Live page against a live API + Redis and asserts the "watch it
 * expire" wiring: the seed control renders, and seeding a short-TTL key adds a
 * countdown tile — a bespoke draining ring (an accessible "TTL: … remaining"
 * description) with its `ttl` entity-prefix chip and an `mm:ss` center label —
 * for the freshly-seeded `cache-example:ttl:*` key.
 *
 * `?live=true` enables the receive-only socket feed (the `live` URL filter
 * defaults off) so the expiry channel is subscribed. The journey deliberately does
 * NOT wait for the key to actually expire: real expiry is timing-dependent and
 * flaky, so the test only asserts the tile/countdown APPEARS after seeding, which
 * is event-independent (the seed mutation adds the tile directly).
 *
 * @module e2e/ttl.spec
 */
import { test, expect } from '@playwright/test'

/** Enables the live socket feed, which the `live` URL filter leaves off by default. */
const LIVE = '?live=true'

test.describe('TTL Live (running stack)', () => {
  test('renders the heading and the seed controls', async ({ page }) => {
    /*
     * Scenario: a user opens the TTL Live page against a running stack with the live
     * feed enabled. Rule it protects: the route renders its heading and the two seed
     * controls (short-TTL and persisted) that drive the countdown wall — a regression
     * that drops the seed controls leaves the page with no way to produce a tile.
     */
    await page.goto(`/ttl${LIVE}`)

    await expect(page.getByRole('heading', { name: 'TTL Live' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Seed key w/ TTL: 30s' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Seed persisted (∞)' })).toBeVisible()
  })

  test('seeding a short-TTL key renders a draining countdown ring for the new key', async ({
    page,
  }) => {
    /*
     * Scenario: the operator seeds a 30s key. Rule it protects: the seed round-trips to
     * the API (`POST /ttl-events/seed` → a namespaced `cache-example:ttl:*` key) and the
     * success handler adds a countdown tile — the bespoke SVG ring (with its accessible
     * remaining-time description and `mm:ss` label) and the `ttl` entity chip. Tile
     * appearance is driven by the seed result, NOT by waiting on the key to expire
     * (which is timing-dependent and flaky), so no expiry is awaited here.
     */
    await page.goto(`/ttl${LIVE}`)

    // No tiles before seeding — the action-oriented empty state holds the wall.
    await expect(page.getByText(/No TTL keys yet/)).toBeVisible()

    // Drive the real seed control.
    await page.getByRole('button', { name: 'Seed key w/ TTL: 30s' }).click()

    // A countdown ring appears for the freshly-seeded key: the SVG ring exposes its
    // accessible remaining-time description, the tile carries the `ttl` entity-prefix
    // chip, and the ring's center shows a live `mm:ss` countdown (regex — the exact
    // value drains each second, so it is matched loosely and `.first()` is used).
    await expect(page.getByRole('img', { name: /TTL:.*remaining/ }).first()).toBeVisible()
    await expect(page.getByText('ttl', { exact: true }).first()).toBeVisible()
    await expect(page.getByText(/^\d{2}:\d{2}$/).first()).toBeVisible()
  })
})
