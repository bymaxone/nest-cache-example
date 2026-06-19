/**
 * @fileoverview Unit tests for `Topbar` — the fixed brand + controls top bar.
 * Drives the brand mark/wordmark render, the `right ? … : null` controls slot
 * (present vs absent), and the hamburger's `onMenuOpen` callback (including the
 * optional-handler no-op when none is supplied).
 *
 * @module components/layout/Topbar.test
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Topbar } from './Topbar'

describe('Topbar', () => {
  it('renders the wordmark and the menu button', () => {
    /*
     * Scenario: the bar mounts on any page.
     * Rule it protects: the brand wordmark and the always-present hamburger render,
     * anchoring the chrome's identity and mobile-nav affordance.
     */
    render(<Topbar />)
    expect(screen.getByText('nest-cache-example')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open navigation menu' })).toBeInTheDocument()
  })

  it('renders the right controls slot when provided', () => {
    /*
     * Scenario: the app shell passes the global controls into the right slot.
     * Rule it protects: the `right ? … : null` branch renders the supplied cluster.
     */
    render(<Topbar right={<span>controls-slot</span>} />)
    expect(screen.getByText('controls-slot')).toBeInTheDocument()
  })

  it('omits the right cluster wrapper when no slot is supplied', () => {
    /*
     * Scenario: a bare topbar with no controls.
     * Rule it protects: the falsy `right` branch renders nothing in the slot — only the
     * hamburger remains on the right.
     */
    render(<Topbar />)
    expect(screen.queryByText('controls-slot')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open navigation menu' })).toBeInTheDocument()
  })

  it('calls onMenuOpen when the hamburger is pressed', async () => {
    /*
     * Scenario: a mobile user taps the hamburger.
     * Rule it protects: the click invokes the supplied `onMenuOpen` so the shell can
     * open the sidebar overlay.
     */
    const user = userEvent.setup()
    const onMenuOpen = vi.fn()
    render(<Topbar onMenuOpen={onMenuOpen} />)
    await user.click(screen.getByRole('button', { name: 'Open navigation menu' }))
    expect(onMenuOpen).toHaveBeenCalledTimes(1)
  })

  it('does not throw when the hamburger is pressed without a handler', async () => {
    /*
     * Scenario: a topbar rendered without `onMenuOpen`.
     * Rule it protects: the optional `onClick={onMenuOpen}` is a safe no-op when
     * undefined — pressing the button neither throws nor errors.
     */
    const user = userEvent.setup()
    render(<Topbar />)
    await user.click(screen.getByRole('button', { name: 'Open navigation menu' }))
    expect(screen.getByText('nest-cache-example')).toBeInTheDocument()
  })
})
