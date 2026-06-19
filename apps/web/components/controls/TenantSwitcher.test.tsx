/**
 * @fileoverview Unit tests for `TenantSwitcher` — the tenant-prefix `Select`.
 * Drives the placeholder (no tenant) vs hydrated-value states and the
 * `onValueChange` → URL-write path when a tenant is chosen, through the nuqs
 * testing adapter.
 *
 * @module components/controls/TenantSwitcher.test
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from 'nuqs/adapters/testing'
import { TenantSwitcher } from './TenantSwitcher'

// Radix Select's pointer interactions call PointerEvent capture APIs that jsdom
// does not implement; stub them so opening the menu and picking an option works.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {}
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {}
  }
})

/**
 * Render `TenantSwitcher` inside the nuqs testing adapter.
 *
 * @param searchParams - The initial query string seeding the `tenant` value.
 * @param onUrlUpdate - Spy invoked on each URL write.
 * @returns The render result.
 */
function renderSwitcher(searchParams: string, onUrlUpdate?: OnUrlUpdateFunction) {
  return render(<TenantSwitcher />, {
    wrapper: ({ children }) => (
      <NuqsTestingAdapter
        searchParams={searchParams}
        hasMemory
        {...(onUrlUpdate ? { onUrlUpdate } : {})}
      >
        {children}
      </NuqsTestingAdapter>
    ),
  })
}

describe('TenantSwitcher', () => {
  it('shows the placeholder when no tenant is selected', () => {
    /*
     * Scenario: a fresh load with no `tenant` param.
     * Rule it protects: the empty default value leaves the trigger showing its
     * "Tenant" placeholder rather than a stale prefix.
     */
    renderSwitcher('')
    expect(screen.getByText('Tenant')).toBeInTheDocument()
  })

  it('shows the selected tenant when the URL hydrates one', () => {
    /*
     * Scenario: a deep-link scoping to `acme`.
     * Rule it protects: the trigger reflects the URL-selected value, so the chosen
     * tenant is visible without opening the menu.
     */
    renderSwitcher('?tenant=acme')
    expect(screen.getByText('acme')).toBeInTheDocument()
  })

  it('writes the chosen tenant to the URL when an option is picked', async () => {
    /*
     * Scenario: the user opens the menu and selects `globex`.
     * Rule it protects: `onValueChange` calls `setTenant(value)`, persisting the
     * prefix scope to the URL as part of the shareable deep-link.
     */
    const user = userEvent.setup()
    const onUrlUpdate = vi.fn()
    renderSwitcher('', onUrlUpdate)
    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: 'globex' }))
    const last = onUrlUpdate.mock.calls.at(-1)?.[0]
    expect(last?.searchParams.get('tenant')).toBe('globex')
  })
})
