/**
 * Error Explorer end-to-end journey (Playwright, running stack).
 *
 * Drives the real Error Explorer against a live API: each row triggers
 * `POST /errors/:code`, an endpoint whose contract is to *always* fail with the
 * canonical `CacheException` — so a structured `{ error: { code, message, details } }`
 * body and its HTTP status are the expected outcome. The journey proves the catalog
 * of the 15 canonical codes renders and that triggering one surfaces its severity
 * label plus the structured body, with the code read back from the live response.
 *
 * Assertions are structural and real-data-safe: the heading, the trigger catalog
 * (15 rows), and — after a trigger — the severity label ('Client Error') and the
 * canonical code echoed in the response tree. No exact message text is pinned; the
 * code I trigger is the deterministic anchor.
 *
 * @module e2e/errors.spec
 */
import { test, expect } from '@playwright/test'

test.describe('Error Explorer (running stack)', () => {
  test('renders the heading and the error-code catalog', async ({ page }) => {
    /*
     * Scenario: a user opens the Error Explorer before triggering anything.
     * Rule it protects: the page lists the full canonical catalog — the `POST
     * /errors/:code` card reports the live code count and renders one Trigger row per
     * code (15), with the empty response prompt shown until a code is fired. A drift
     * in the catalog count means a library error code was added/removed silently.
     */
    await page.goto('/errors')
    await expect(page.getByRole('heading', { name: 'Error Explorer' })).toBeVisible()
    await expect(page.getByText(/POST \/errors\/:code · 15 codes/)).toBeVisible()

    // The catalog renders exactly the 15 canonical-code trigger rows, and a known row.
    await expect(page.getByRole('button', { name: 'Trigger' })).toHaveCount(15)
    await expect(page.getByText('invalid_key')).toBeVisible()

    // No code triggered yet → the response panel shows its action prompt.
    await expect(page.getByText(/Trigger a code on the left/)).toBeVisible()
  })

  test('triggering a code renders its severity label and structured body', async ({ page }) => {
    /*
     * Scenario: a user triggers the `cache.invalid_key` code (a 400).
     * Rule it protects: the always-error endpoint round-trips end to end — the response
     * panel renders the HTTP status, the accessible severity label ('Client Error' for
     * a 4xx), and the structured `{ error: { code, message, details } }` body with the
     * canonical code read back from the live response, not a server-only import.
     */
    await page.goto('/errors')

    // Drive the real Trigger button on the invalid_key row.
    const row = page.locator('li').filter({ hasText: 'invalid_key' })
    await row.getByRole('button', { name: 'Trigger' }).click()

    // The severity panel renders the live 400 status and its color-independent label.
    await expect(page.getByText('HTTP 400')).toBeVisible()
    await expect(page.getByText('Client Error')).toBeVisible()

    // The structured body echoes the canonical code from the response (the deterministic
    // anchor — the message/details are live data and are intentionally not pinned).
    await expect(page.getByText(/cache\.invalid_key/).first()).toBeVisible()
  })
})
