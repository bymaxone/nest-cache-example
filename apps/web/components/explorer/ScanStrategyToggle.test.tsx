/**
 * @fileoverview Unit tests for {@link ScanStrategyToggle} — the Explorer's
 * `scan`/`keys` segmented control. Covers the three mutually-exclusive states:
 * the safe default (no callout), the `keys` O(N) blocking-command warning, and
 * the cluster-mode disabled state with its `UNSUPPORTED_IN_CLUSTER` callout,
 * plus the change callback firing on a click.
 *
 * @module components/explorer/ScanStrategyToggle.test
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScanStrategyToggle } from './ScanStrategyToggle'

describe('ScanStrategyToggle', () => {
  it('renders both strategy buttons with no callout when on the safe scan default', () => {
    /*
     * Scenario: the default `scan` strategy is active.
     * Rule it protects: both `scan` and `keys` buttons render, are enabled, and
     * neither the O(N) warning nor the cluster callout appears.
     */
    render(<ScanStrategyToggle value="scan" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'scan' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'keys' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'scan' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText(/blocks the server/)).not.toBeInTheDocument()
    expect(screen.queryByText(/UNSUPPORTED_IN_CLUSTER/)).not.toBeInTheDocument()
  })

  it('shows the O(N) blocking-command warning when keys is selected', () => {
    /*
     * Scenario: the dangerous `keys` strategy is active.
     * Rule it protects: selecting `keys` surfaces the persistent O(N) warning with
     * its status role, and marks the keys button pressed.
     */
    render(<ScanStrategyToggle value="keys" onChange={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('O(N) — blocks the server, dev only.')
    expect(screen.getByRole('button', { name: 'keys' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('disables both buttons and shows the cluster callout in cluster mode', () => {
    /*
     * Scenario: the API reports a cluster deployment (no scan/keys support).
     * Rule it protects: both buttons disable and the cluster callout takes priority
     * over the keys O(N) warning (even when `value` is `keys`).
     */
    render(<ScanStrategyToggle value="keys" onChange={vi.fn()} isClusterMode />)
    expect(screen.getByRole('button', { name: 'scan' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'keys' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent(
      'UNSUPPORTED_IN_CLUSTER — scan/keys are standalone/sentinel only.',
    )
    expect(screen.queryByText(/blocks the server/)).not.toBeInTheDocument()
  })

  it('fires onChange with the clicked strategy', async () => {
    /*
     * Scenario: the user clicks the `keys` button while on `scan`.
     * Rule it protects: the click invokes `onChange` with the chosen strategy.
     */
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ScanStrategyToggle value="scan" onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'keys' }))
    expect(onChange).toHaveBeenCalledWith('keys')
  })
})
