/**
 * Serializer Lab end-to-end journey (Playwright, running stack).
 *
 * Drives the real round-trip lab against a live API + Redis and asserts the two
 * signals that prove the serializer path is wired end to end: the page reports the
 * codec the instance is actually running (`GET /serializer/active`), and a
 * round-trip (`POST /serializer/roundtrip`) renders the raw stored bytes beside the
 * decoded value. The raw string and the decoded tree depend on the configured codec
 * and live storage, so the assertions stay STRUCTURAL — that the raw and decoded
 * sections render with content — never an exact serialized value.
 *
 * @module e2e/serializer.spec
 */
import { test, expect } from '@playwright/test'

test.describe('Serializer Lab → round-trip (running stack)', () => {
  test('renders the heading and the active codec the instance runs', async ({ page }) => {
    /*
     * Scenario: a user opens the Serializer Lab against a running API + Redis.
     * Rule it protects: the page mounts its heading (heading role disambiguates it
     * from the sidebar's "Serializer" nav link), exposes the input card with both
     * codec toggles, and the route label resolves the live active serializer via
     * `GET /serializer/active`. The active name (JsonSerializer / MsgPackSerializer)
     * is asserted by the ` · active: <name>` suffix carrying a capital-S `Serializer`
     * token, so whichever codec the instance is configured with satisfies it.
     */
    await page.goto('/serializer')
    await expect(page.getByRole('heading', { name: 'Serializer Lab' })).toBeVisible()
    await expect(page.getByText('Input').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'json' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'msgpack' })).toBeVisible()
    const routeLabel = page.getByText(/POST \/serializer\/roundtrip/)
    await expect(routeLabel).toBeVisible()
    // The active codec name (e.g. JsonSerializer) is the only capital-S `Serializer`
    // token in this label — the route segment itself is lowercase `serializer`.
    await expect(routeLabel).toContainText(/active:/)
    await expect(routeLabel).toContainText(/Serializer/)
  })

  test('a round-trip renders the raw bytes beside the decoded value', async ({ page }) => {
    /*
     * Scenario: the operator round-trips the default object payload through the live
     * serializer. Rule it protects: the write stores the value and reads it back two
     * ways — the comparison card renders the raw stored string (`getRaw`) next to the
     * decoded value (`get`). Both columns are asserted with content: the raw pre (the
     * only `<pre>` on the page) is non-empty, and the decoded JSON tree following its
     * header renders the decoded object. The serialized bytes vary by codec, so the
     * content is matched structurally rather than against an exact string.
     */
    await page.goto('/serializer')
    await page.getByRole('button', { name: 'Round-trip' }).click()
    // The result card only appears once the round-trip resolves from the live API.
    await expect(page.getByText(/Round-trip .*raw bytes vs decoded/)).toBeVisible()
    // Raw column: the lone <pre> holds the stored bytes — present and non-empty.
    await expect(page.getByText(/raw \(getRaw\)/)).toBeVisible()
    await expect(page.locator('pre')).toContainText(/\w/)
    // Decoded column: the JSON tree is the sibling that follows the "decoded (get)"
    // header; assert it rendered the decoded object (content beyond the header).
    const decoded = page.getByText('decoded (get)').locator('xpath=following-sibling::*[1]')
    await expect(decoded).toBeVisible()
    await expect(decoded).toContainText(/\w/)
  })
})
