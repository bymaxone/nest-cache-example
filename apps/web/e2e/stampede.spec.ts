/**
 * Stampede Lab end-to-end journey (Playwright, running stack).
 *
 * Drives the real Stampede Lab against a live API + Redis: the burst controls fire
 * `POST /stampede`, which fans N concurrent requests at one uncached key and lets a
 * single-flight Lua lock collapse them into one origin fetch. The journey proves the
 * page renders its controls and that firing a burst produces an observable result —
 * the summary strip (origin fetches / cache hits / hit rate) and the per-contender
 * swimlane both render from the live response, never from a fixture.
 *
 * Assertions are structural and real-data-safe: control presence, summary labels, a
 * rendered percentage (regex, not an exact value), and the swimlane. The one numeric
 * claim is the single-flight invariant — exactly one origin fetch — which is the
 * lock's whole point and a deterministic property of a clean collapse.
 *
 * A burst runs a slow origin (~400ms+) under the lock TTL, so the summary/timeline
 * get a generous timeout to appear.
 *
 * @module e2e/stampede.spec
 */
import { test, expect } from '@playwright/test'

/** Margin for a burst to resolve: a deliberately slow origin under the lock TTL. */
const BURST_TIMEOUT = 20_000

test.describe('Stampede Lab (running stack)', () => {
  test('renders the heading and the burst controls', async ({ page }) => {
    /*
     * Scenario: a user opens the Stampede Lab before firing anything.
     * Rule it protects: the page mounts its controls — the `POST /stampede` card,
     * the productId / concurrency / lockMs inputs, the Fire button, and the
     * action-oriented empty state. A break in the controls wiring fails here before
     * any burst is even attempted.
     */
    await page.goto('/stampede')
    await expect(page.getByRole('heading', { name: 'Stampede Lab' })).toBeVisible()
    await expect(page.getByText('POST /stampede')).toBeVisible()

    // The three burst parameters are real, labelled inputs the user can drive.
    await expect(page.getByLabel('productId')).toBeVisible()
    await expect(page.getByLabel('concurrency')).toBeVisible()
    await expect(page.getByLabel('lockMs')).toBeVisible()

    // The Fire control and the pre-burst empty-state prompt both render.
    await expect(page.getByRole('button', { name: /Fire \d+ requests/ })).toBeVisible()
    await expect(page.getByText(/Fire a burst above/)).toBeVisible()
  })

  test('firing a burst renders the summary strip and the swimlane', async ({ page }) => {
    /*
     * Scenario: a user fires a concurrency burst at one uncached key.
     * Rule it protects: the live single-flight collapse round-trips end to end — the
     * result strip renders the summary (origin fetches / cache hits / hit rate) and
     * the bespoke swimlane renders one lane per contender. The single-flight invariant
     * is asserted directly: exactly one origin fetch served the whole burst, the rest
     * were cache hits the winner populated.
     */
    await page.goto('/stampede')
    await page.getByRole('button', { name: /Fire \d+ requests/ }).click()

    // The summary strip renders its three roll-up labels once the burst resolves.
    // `exact` so the metric labels never match the page subtitle, which mentions
    // "cache hits" in prose.
    await expect(page.getByText('origin fetches', { exact: true })).toBeVisible({
      timeout: BURST_TIMEOUT,
    })
    await expect(page.getByText('cache hits', { exact: true })).toBeVisible()
    await expect(page.getByText('hit rate', { exact: true })).toBeVisible()

    // The single-flight invariant: the origin-fetch metric reads `1 / N` — one origin
    // fetch collapsed the whole burst. This is deterministic, not a mocked number.
    await expect(page.getByText(/^1 \/ \d+$/)).toBeVisible()

    // The hit rate renders as a real percentage (value is dynamic — assert the shape).
    await expect(page.getByText(/\d+(\.\d+)?%/).first()).toBeVisible()

    // The swimlane renders from the live timeline. Its accessible label reports one
    // lane per contender (the lane geometry/labels are presentational SVG inside the
    // role="img", so they are asserted through the label rather than queried as text).
    await expect(page.getByRole('img', { name: /Stampede swimlane: \d+ contenders/ })).toBeVisible()
  })
})
