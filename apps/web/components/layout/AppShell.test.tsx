/**
 * @fileoverview Unit tests for `AppShell` — the topbar + sidebar + content-well
 * chrome. Drives the mobile open/close state (open via the topbar menu, close via
 * the scrim and via a sidebar nav click), the `right ?? <GlobalControls />` default
 * vs override, and the `wide` content-well width branch. The heavy controls cluster
 * and `next/navigation` are mocked so the shell's own state machine is the unit
 * under test.
 *
 * @module components/layout/AppShell.test
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

vi.mock('@/components/controls/GlobalControls', () => ({
  GlobalControls: () => <div data-testid="global-controls" />,
}))

// Imported after the mocks so the shell binds to the lightweight controls stub.
const { AppShell } = await import('./AppShell')

describe('AppShell', () => {
  it('renders the page content and the default global controls', () => {
    /*
     * Scenario: a page mounts inside the shell without a custom right slot.
     * Rule it protects: the children render in the content well and the
     * `right ?? <GlobalControls />` default supplies the controls cluster.
     */
    render(
      <AppShell>
        <p>page-body</p>
      </AppShell>,
    )
    expect(screen.getByText('page-body')).toBeInTheDocument()
    expect(screen.getByTestId('global-controls')).toBeInTheDocument()
  })

  it('uses a custom right slot when one is supplied', () => {
    /*
     * Scenario: a page overrides the topbar's right cluster.
     * Rule it protects: the `right ?? …` branch prefers the explicit slot, so the
     * default controls are not rendered.
     */
    render(
      <AppShell right={<span>custom-right</span>}>
        <p>page-body</p>
      </AppShell>,
    )
    expect(screen.getByText('custom-right')).toBeInTheDocument()
    expect(screen.queryByTestId('global-controls')).not.toBeInTheDocument()
  })

  it('widens the content well when wide is set', () => {
    /*
     * Scenario: a chart-heavy page asks for the wide layout.
     * Rule it protects: the `wide ? 'max-w-7xl' : 'max-w-5xl'` branch applies the
     * wide width class.
     */
    const { container } = render(
      <AppShell wide>
        <p>page-body</p>
      </AppShell>,
    )
    expect(container.querySelector('.max-w-7xl')).not.toBeNull()
    expect(container.querySelector('.max-w-5xl')).toBeNull()
  })

  it('defaults to the narrow content well', () => {
    /*
     * Scenario: a standard page (no `wide`).
     * Rule it protects: the default `wide=false` path applies the narrow width class.
     */
    const { container } = render(
      <AppShell>
        <p>page-body</p>
      </AppShell>,
    )
    expect(container.querySelector('.max-w-5xl')).not.toBeNull()
    expect(container.querySelector('.max-w-7xl')).toBeNull()
  })

  it('opens the mobile overlay from the topbar menu and closes it via the scrim', async () => {
    /*
     * Scenario: a mobile user opens then dismisses the sidebar.
     * Rule it protects: the menu button calls `setIsOpen(true)` (the scrim appears),
     * and clicking the scrim calls `setIsOpen(false)` (it disappears) — both halves of
     * the `isOpen` state machine.
     */
    const user = userEvent.setup()
    render(
      <AppShell>
        <p>page-body</p>
      </AppShell>,
    )
    expect(screen.queryByRole('button', { name: 'Close navigation menu' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open navigation menu' }))
    const scrim = screen.getByRole('button', { name: 'Close navigation menu' })
    expect(scrim).toBeInTheDocument()

    await user.click(scrim)
    expect(screen.queryByRole('button', { name: 'Close navigation menu' })).not.toBeInTheDocument()
  })

  it('closes the mobile overlay when a sidebar link is followed', async () => {
    /*
     * Scenario: a mobile user opens the rail and taps a nav link.
     * Rule it protects: the `onNavClick` wired into the Sidebar calls `setIsOpen(false)`
     * so the overlay closes after navigation.
     */
    const user = userEvent.setup()
    render(
      <AppShell>
        <p>page-body</p>
      </AppShell>,
    )
    await user.click(screen.getByRole('button', { name: 'Open navigation menu' }))
    expect(screen.getByRole('button', { name: 'Close navigation menu' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: /Explorer/ }))
    expect(screen.queryByRole('button', { name: 'Close navigation menu' })).not.toBeInTheDocument()
  })
})
