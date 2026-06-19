/**
 * @fileoverview Unit tests for {@link TenantSplit} — the two-panel tenant layout.
 * The globally-selected `tenant` (read from the `nuqs` query state, mocked here)
 * decides which of the two demo panels is highlighted as active; {@link TenantPanel}
 * is stubbed so the test isolates the split's mapping + active-selection logic from
 * the panel's data/mutation wiring.
 *
 * @module components/tenants/TenantSplit.test
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TenantSplit } from './TenantSplit'

/** Drives the active-tenant selection; reset per test via `state.activeTenant`. */
const state = vi.hoisted(() => ({ activeTenant: null as string | null }))

// Partial mock: keep nuqs' real parsers (used transitively by `@/lib/filters`) and
// override only the query-state read the split depends on.
vi.mock('nuqs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('nuqs')>()
  return { ...actual, useQueryState: () => [state.activeTenant, vi.fn()] }
})

// Stub the child so the split's only observable output is which tenant is active.
vi.mock('./TenantPanel', () => ({
  TenantPanel: ({ tenant, isActive }: { tenant: string; isActive?: boolean }) => (
    <div data-testid={`panel-${tenant}`}>{isActive ? 'active' : 'inactive'}</div>
  ),
}))

describe('TenantSplit', () => {
  it('renders one panel per demo tenant, highlighting the globally-selected one', () => {
    /*
     * Scenario: the `tenant` query state selects `acme`.
     * Rule it protects: every demo tenant gets a panel and `isActive` is true only for
     * the tenant matching the selection — the `tenant === activeTenant` true branch.
     */
    state.activeTenant = 'acme'
    render(<TenantSplit />)
    expect(screen.getByTestId('panel-acme')).toHaveTextContent('active')
    expect(screen.getByTestId('panel-globex')).toHaveTextContent('inactive')
  })

  it('marks no panel active when the tenant selection is empty', () => {
    /*
     * Scenario: no tenant is selected (the `nuqs` param is null).
     * Rule it protects: the `tenant === activeTenant` false branch — with no match every
     * panel renders inactive.
     */
    state.activeTenant = null
    render(<TenantSplit />)
    expect(screen.getByTestId('panel-acme')).toHaveTextContent('inactive')
    expect(screen.getByTestId('panel-globex')).toHaveTextContent('inactive')
  })
})
