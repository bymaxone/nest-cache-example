/**
 * @fileoverview Unit tests for `NamespaceChip` — the read-only namespace chip.
 * Asserts it renders the bound namespace prefix and exposes the explanatory
 * tooltip content (the chip itself takes no props and has no branches).
 *
 * @module components/controls/NamespaceChip.test
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NamespaceChip } from './NamespaceChip'
import { APP_NAMESPACE } from '@/lib/constants'

describe('NamespaceChip', () => {
  it('renders the bound namespace prefix read-only', () => {
    /*
     * Scenario: the topbar shows which namespace the dashboard is bound to.
     * Rule it protects: the chip displays `ns: <APP_NAMESPACE>` — one namespace per
     * module instance, never switched here.
     */
    render(<NamespaceChip />)
    expect(screen.getByText(`ns: ${APP_NAMESPACE}`)).toBeInTheDocument()
  })

  it('reveals the prefix-vs-namespace explanation when the chip is focused', async () => {
    /*
     * Scenario: a user tabs to the chip to learn why the namespace cannot be changed.
     * Rule it protects: the Radix tooltip mounts its explanation on focus, so the
     * prefix-vs-namespace distinction is reachable (the chip is focusable via tabIndex).
     */
    const user = userEvent.setup()
    render(<NamespaceChip />)
    await user.tab()
    // Radix renders the open tooltip content plus an accessibility mirror, so the
    // text appears more than once — assert at least one instance is present.
    await screen.findAllByText('One namespace per module instance; tenants are prefixes.')
    expect(
      screen.getAllByText('One namespace per module instance; tenants are prefixes.').length,
    ).toBeGreaterThan(0)
  })
})
