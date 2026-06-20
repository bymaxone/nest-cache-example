/**
 * Tenants journey (Playwright, running stack).
 *
 * Drives the Namespace & Tenants page against a live API + Redis and asserts the
 * two isolation stories the page exists to prove: the tenant split renders both
 * demo tenants' prefix-scoped panels, and the namespace-boundary proof — seed a
 * FOREIGN-namespace key, flush the app namespace, and the foreign key SURVIVES.
 *
 * The unit suites mock the transport and assert exact numbers; here the stack is
 * real, so the assertions are structural: the panels and proof controls render,
 * and running the flush produces an observable result line (a flushed count under
 * `cache-example` plus the surviving `other-app:demo` key). The flushed count is
 * data-dependent, so it is matched with a regex, never a fixed value.
 *
 * @module e2e/tenants.spec
 */
import { test, expect } from '@playwright/test'

test.describe('Tenants (running stack)', () => {
  test('renders the heading and the two-tenant split with its panels and proof', async ({
    page,
  }) => {
    /*
     * Scenario: a user opens the Namespace & Tenants page against a running stack.
     * Rule it protects: the route composes the tenant split (one prefix-scoped panel
     * per demo tenant, each with its [Seed 10] action) and the isolation-proof band —
     * a regression that drops a panel or the proof card fails here.
     */
    await page.goto('/tenants')

    // The page heading renders (the rendered `&` accessible name).
    await expect(page.getByRole('heading', { name: 'Namespace & Tenants' })).toBeVisible()

    // The split shows both demo tenants, each as its own prefix-scoped panel.
    await expect(page.getByText('tenant:acme:product')).toBeVisible()
    await expect(page.getByText('tenant:globex:product')).toBeVisible()
    // One [Seed 10] read-through control per panel — the count pins the split's arity.
    await expect(page.getByRole('button', { name: 'Seed 10' })).toHaveCount(2)

    // The namespace-isolation proof band renders with its two drive controls. The
    // band title is a shadcn CardTitle (a styled div, not a heading role), so match
    // its text exactly.
    await expect(page.getByText('Isolation proof', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /Seed FOREIGN namespace/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Flush namespace & verify' })).toBeVisible()
  })

  test('flushing the namespace clears app keys while the foreign key survives', async ({
    page,
  }) => {
    /*
     * Scenario: the operator seeds a key in a FOREIGN namespace, then flushes the app
     * namespace and verifies. Rule it protects: `flushNamespace()` is scoped to the
     * bound `cache-example` namespace, so the foreign `other-app:demo` key written via
     * the raw client SURVIVES the flush — proving the namespace boundary is real, not
     * a global FLUSHDB. The flushed count is data-dependent, so it is matched loosely.
     */
    await page.goto('/tenants')

    // 1) Write the foreign-namespace key via the raw-client anti-pattern control, and
    //    wait for the write to land (its success toast) before flushing, so the verify
    //    step sees the key in place.
    await page.getByRole('button', { name: /Seed FOREIGN namespace/ }).click()
    await expect(page.getByText(/Wrote foreign key other-app:demo/)).toBeVisible()

    // 2) Flush the app namespace and verify — the success panel reports the cleared
    //    count under `cache-example` and confirms the foreign key survived.
    await page.getByRole('button', { name: 'Flush namespace & verify' }).click()
    await expect(page.getByText(/Cleared \d+ keys under cache-example/)).toBeVisible()
    await expect(page.getByText(/other-app:demo SURVIVED/)).toBeVisible()
  })
})
