/**
 * Playground end-to-end journey (Playwright, running stack).
 *
 * Drives the real per-data-structure cards against a live API + Redis and asserts
 * the three signals that prove the page is wired end to end: the grid renders one
 * card per Redis data structure, a string write (`setNx`) surfaces its result panel
 * with the produced `KeyBuilder` key, and a numeric `incr` surfaces the new atomic
 * counter value. The unit suites mock the transport, so here — against real Redis —
 * the assertions stay STRUCTURAL: that an op produces an observable result line and
 * a namespaced resulting key, never an exact (mocked) value.
 *
 * @module e2e/playground.spec
 */
import { test, expect } from '@playwright/test'

test.describe('Playground → Redis ops (running stack)', () => {
  test('renders the heading and one card per data structure', async ({ page }) => {
    /*
     * Scenario: a user opens the Playground against a running API + Redis.
     * Rule it protects: the page mounts its heading and exposes exactly the five
     * data-structure cards (Strings / Numerics / Hashes / Sets / Batch). A dropped
     * or renamed card — the surface every op below drives — fails here first. The
     * page title uses the heading role so it is not confused with the sidebar's
     * "Playground" nav link.
     */
    await page.goto('/playground')
    await expect(page.getByRole('heading', { name: 'Playground' })).toBeVisible()
    await expect(page.getByText('Strings', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Numerics', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Hashes (cart)').first()).toBeVisible()
    await expect(page.getByText('Sets (tags)').first()).toBeVisible()
    await expect(page.getByText('Batch', { exact: true }).first()).toBeVisible()
  })

  test('a string setNx write surfaces its result panel and resulting key', async ({ page }) => {
    /*
     * Scenario: the operator fires the Strings card's `setNx` against the live API.
     * Rule it protects: a successful write echoes back through the shared op runner —
     * the result panel names the op ("setNx result") and the panel prints the exact
     * namespaced `KeyBuilder` key it wrote (`cache-example:product:99`). That key text
     * proves the dashboard → REST → cache write path round-tripped, not a mocked stub.
     * The key also echoes in the success toast, so the assertion takes the first match.
     */
    await page.goto('/playground')
    await page.getByRole('button', { name: 'setNx' }).click()
    await expect(page.getByText(/setNx result/)).toBeVisible()
    await expect(page.getByText(/cache-example:product:99/).first()).toBeVisible()
  })

  test('a numeric incr surfaces the new atomic counter value', async ({ page }) => {
    /*
     * Scenario: the operator fires the Numerics card's atomic `incr` against the live
     * API. Rule it protects: the op returns the new counter and the result panel
     * renders it as a numeric badge alongside the views key (`cache-example:views:p1`).
     * The exact count depends on prior Redis state, so the value is asserted
     * structurally (a pure-digit badge inside the result panel), never as a fixed
     * number. The `exact` name match excludes the sibling `incr +5` button.
     */
    await page.goto('/playground')
    await page.getByRole('button', { name: 'incr', exact: true }).click()
    await expect(page.getByText(/incr result/)).toBeVisible()
    await expect(page.getByText(/cache-example:views:p1/).first()).toBeVisible()
    // The result panel is the parent of its "incr result" label; the decoded counter
    // is the only pure-digit text inside it (the key line is not all digits).
    const panel = page.getByText(/incr result/).locator('xpath=..')
    await expect(panel.getByText(/^-?\d+$/)).toBeVisible()
  })
})
