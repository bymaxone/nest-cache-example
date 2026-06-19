/**
 * @fileoverview Unit tests for `GlobalControls` — the composed topbar controls
 * cluster. Each child is mocked to a marker so the test asserts the composition
 * (all five controls present) and their fixed display order, without dragging the
 * children's Query/socket/nuqs dependencies into this unit.
 *
 * @module components/controls/GlobalControls.test
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('./NamespaceChip', () => ({ NamespaceChip: () => <div data-testid="namespace" /> }))
vi.mock('./TenantSwitcher', () => ({ TenantSwitcher: () => <div data-testid="tenant" /> }))
vi.mock('./TimeRange', () => ({ TimeRange: () => <div data-testid="range" /> }))
vi.mock('./LiveToggle', () => ({ LiveToggle: () => <div data-testid="live" /> }))
vi.mock('./StatusChip', () => ({ StatusChip: () => <div data-testid="status" /> }))

// Imported after the mocks so it binds to the marker children.
const { GlobalControls } = await import('./GlobalControls')

describe('GlobalControls', () => {
  it('renders all five controls in display order', () => {
    /*
     * Scenario: the topbar mounts its shared right-cluster.
     * Rule it protects: the cluster composes namespace → tenant → range → live →
     * status in that exact order, so every page shares the same controls layout.
     */
    const { container } = render(<GlobalControls />)
    expect(screen.getByTestId('namespace')).toBeInTheDocument()
    expect(screen.getByTestId('tenant')).toBeInTheDocument()
    expect(screen.getByTestId('range')).toBeInTheDocument()
    expect(screen.getByTestId('live')).toBeInTheDocument()
    expect(screen.getByTestId('status')).toBeInTheDocument()

    const order = Array.from(container.querySelectorAll('[data-testid]')).map((el) =>
      el.getAttribute('data-testid'),
    )
    expect(order).toEqual(['namespace', 'tenant', 'range', 'live', 'status'])
  })
})
