/**
 * @fileoverview Unit tests for `Sidebar` — the grouped nav rail. Drives the
 * `isActiveRoute` matcher (root exact-only, exact non-root, nested-child prefix,
 * and the non-matching/root-on-subpage cases), the `onNavClick` close handler
 * (provided vs omitted), and the namespace footer. `next/navigation` is mocked so
 * `usePathname` is deterministic per test.
 *
 * @module components/layout/Sidebar.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { APP_NAMESPACE } from '@/lib/constants'

/** The pathname the mocked `usePathname` returns; set per test. */
let currentPath = '/'

vi.mock('next/navigation', () => ({
  usePathname: () => currentPath,
}))

// Imported after the mock so it binds to the mocked `usePathname`.
const { Sidebar } = await import('./Sidebar')

beforeEach(() => {
  currentPath = '/'
})

describe('Sidebar', () => {
  it('marks the root route active only on an exact match', () => {
    /*
     * Scenario: the user is on `/`.
     * Rule it protects: `isActiveRoute('/', '/')` is true (exact), so Overview is the
     * single active item via `aria-current="page"`.
     */
    currentPath = '/'
    render(<Sidebar isOpen={false} />)
    expect(screen.getByRole('link', { name: /Overview/ })).toHaveAttribute('aria-current', 'page')
  })

  it('does not mark the root active on a sub-page', () => {
    /*
     * Scenario: the user is on `/explorer`.
     * Rule it protects: the root's exact-only rule means `/` is NOT active on a deeper
     * page — only the matching item is.
     */
    currentPath = '/explorer'
    render(<Sidebar isOpen={false} />)
    expect(screen.getByRole('link', { name: /Overview/ })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: /Explorer/ })).toHaveAttribute('aria-current', 'page')
  })

  it('marks a non-root route active on a nested child path', () => {
    /*
     * Scenario: the user is on `/explorer/product`.
     * Rule it protects: the `pathname.startsWith(`${href}/`)` arm activates the parent
     * route for its nested children.
     */
    currentPath = '/explorer/product'
    render(<Sidebar isOpen={false} />)
    expect(screen.getByRole('link', { name: /Explorer/ })).toHaveAttribute('aria-current', 'page')
  })

  it('marks no item active on an unknown route', () => {
    /*
     * Scenario: the user is on a path that matches no nav item.
     * Rule it protects: every `isActiveRoute` check returns false, so no link carries
     * `aria-current` — the non-matching branch of both arms.
     */
    currentPath = '/nowhere'
    render(<Sidebar isOpen={false} />)
    for (const link of screen.getAllByRole('link')) {
      expect(link).not.toHaveAttribute('aria-current')
    }
  })

  it('calls onNavClick when a link is followed (closing the mobile overlay)', async () => {
    /*
     * Scenario: a mobile user taps a nav link.
     * Rule it protects: the `onNavClick ? { onClick } : {}` branch wires the handler so
     * the overlay closes after navigation.
     */
    const user = userEvent.setup()
    const onNavClick = vi.fn()
    render(<Sidebar isOpen onNavClick={onNavClick} />)
    await user.click(screen.getByRole('link', { name: /Explorer/ }))
    expect(onNavClick).toHaveBeenCalledTimes(1)
  })

  it('omits the click handler when onNavClick is not supplied', async () => {
    /*
     * Scenario: a desktop rail rendered without `onNavClick`.
     * Rule it protects: the empty-spread branch leaves no `onClick`, so following a
     * link does not throw.
     */
    const user = userEvent.setup()
    render(<Sidebar isOpen={false} />)
    await user.click(screen.getByRole('link', { name: /Playground/ }))
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })

  it('renders the read-only namespace footer', () => {
    /*
     * Scenario: the rail footer.
     * Rule it protects: the bound namespace is shown read-only in the footer, echoing
     * the one-namespace-per-instance rule.
     */
    render(<Sidebar isOpen={false} />)
    expect(screen.getByText(`ns: ${APP_NAMESPACE}`)).toBeInTheDocument()
  })

  it('shows the rail (flex) when open as the mobile overlay', () => {
    /*
     * Scenario: the mobile overlay is open (`isOpen`).
     * Rule it protects: the `isOpen ? 'flex' : 'hidden lg:flex'` true arm applies the
     * `flex` display class so the overlay is visible — blanking the literal would leave
     * the open rail without its display class.
     */
    render(<Sidebar isOpen />)
    const nav = screen.getByRole('navigation')
    expect(nav).toHaveClass('flex')
    expect(nav).not.toHaveClass('hidden')
  })

  it('hides the rail on mobile (hidden, desktop-only flex) when closed', () => {
    /*
     * Scenario: the closed rail on a mobile viewport.
     * Rule it protects: the `isOpen ? 'flex' : 'hidden lg:flex'` false arm hides the rail
     * on mobile while keeping it shown on desktop (`lg:flex`) — blanking the literal would
     * leave the closed rail visible on mobile.
     */
    render(<Sidebar isOpen={false} />)
    const nav = screen.getByRole('navigation')
    expect(nav).toHaveClass('hidden')
    expect(nav).toHaveClass('lg:flex')
  })
})
