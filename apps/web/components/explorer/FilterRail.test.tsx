/**
 * @fileoverview Unit tests for {@link FilterRail} — the Explorer's left facet
 * rail. Drives the free-text prefix input, the quick-pick prefix chips (set vs
 * toggle-off), the single-select data-type facet (each of string/hash/set,
 * select vs clear), and the has-TTL toggle (both directions). Every assertion is
 * on rendered output or the controlled callback payload.
 *
 * @module components/explorer/FilterRail.test
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilterRail, type FilterRailProps } from './FilterRail'

/**
 * Render {@link FilterRail} with sensible defaults, overridable per test.
 *
 * @param overrides - Partial props to override the controlled defaults.
 * @returns The render result plus the spy callbacks for assertions.
 */
function setup(overrides: Partial<FilterRailProps> = {}) {
  const onPrefixChange = vi.fn()
  const onTypeChange = vi.fn()
  const onHasTtlChange = vi.fn()
  const props: FilterRailProps = {
    prefix: '',
    onPrefixChange,
    type: null,
    onTypeChange,
    hasTtl: false,
    onHasTtlChange,
    ...overrides,
  }
  render(<FilterRail {...props} />)
  return { onPrefixChange, onTypeChange, onHasTtlChange }
}

describe('FilterRail', () => {
  it('emits each typed character of the prefix input', async () => {
    /*
     * Scenario: the user types into the free-text prefix field.
     * Rule it protects: every keystroke flows to `onPrefixChange` with the value.
     */
    const user = userEvent.setup()
    const { onPrefixChange } = setup()
    await user.type(screen.getByLabelText('Prefix'), 'x')
    expect(onPrefixChange).toHaveBeenCalledWith('x')
  })

  it('sets the prefix when a quick-pick chip is clicked while inactive', async () => {
    /*
     * Scenario: clicking the `product` chip with no prefix active.
     * Rule it protects: an inactive chip sets the prefix to its option value.
     */
    const user = userEvent.setup()
    const { onPrefixChange } = setup({ prefix: '' })
    await user.click(screen.getByRole('button', { name: 'product' }))
    expect(onPrefixChange).toHaveBeenCalledWith('product')
  })

  it('clears the prefix when the already-active chip is clicked', async () => {
    /*
     * Scenario: clicking the `cart` chip while `cart` is the active prefix.
     * Rule it protects: re-clicking the active chip toggles the prefix back to empty.
     */
    const user = userEvent.setup()
    const { onPrefixChange } = setup({ prefix: 'cart' })
    await user.click(screen.getByRole('button', { name: 'cart' }))
    expect(onPrefixChange).toHaveBeenCalledWith('')
  })

  it('selects a data type when its facet is inactive', async () => {
    /*
     * Scenario: clicking the `String` type facet with no type active.
     * Rule it protects: an inactive facet selects that type.
     */
    const user = userEvent.setup()
    const { onTypeChange } = setup({ type: null })
    await user.click(screen.getByRole('button', { name: 'String' }))
    expect(onTypeChange).toHaveBeenCalledWith('string')
  })

  it('clears the data type when its active facet is clicked again', async () => {
    /*
     * Scenario: clicking the `Hash` facet while `hash` is already active.
     * Rule it protects: the active facet toggles back to `null` (all types).
     */
    const user = userEvent.setup()
    const { onTypeChange } = setup({ type: 'hash' })
    await user.click(screen.getByRole('button', { name: 'Hash' }))
    expect(onTypeChange).toHaveBeenCalledWith(null)
  })

  it('renders all three type facets with their labels', () => {
    /*
     * Scenario: the rail renders the full data-type facet set.
     * Rule it protects: each of string/hash/set renders its accessible label.
     */
    setup()
    expect(screen.getByRole('button', { name: 'String' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hash' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Set' })).toBeInTheDocument()
  })

  it('turns the has-TTL facet on from off', async () => {
    /*
     * Scenario: clicking the Has TTL toggle while it is off.
     * Rule it protects: an off toggle flips to `true`, reflected via aria-pressed.
     */
    const user = userEvent.setup()
    const { onHasTtlChange } = setup({ hasTtl: false })
    const toggle = screen.getByRole('button', { name: 'Has TTL' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    // Off renders the `outline` variant (its `text-foreground`) with the mono label —
    // pinning the `outline` and `font-mono` literals against being emptied.
    expect(toggle).toHaveClass('text-foreground')
    expect(toggle).toHaveClass('font-mono')
    await user.click(toggle)
    expect(onHasTtlChange).toHaveBeenCalledWith(true)
  })

  it('turns the has-TTL facet off from on', async () => {
    /*
     * Scenario: clicking the Has TTL toggle while it is on.
     * Rule it protects: an on toggle flips to `false`, reflected via aria-pressed.
     */
    const user = userEvent.setup()
    const { onHasTtlChange } = setup({ hasTtl: true })
    const toggle = screen.getByRole('button', { name: 'Has TTL' })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    // On renders the `default` variant — the brand gradient `from-brand-500` —
    // pinning the `default` literal against being emptied.
    expect(toggle).toHaveClass('from-brand-500')
    await user.click(toggle)
    expect(onHasTtlChange).toHaveBeenCalledWith(false)
  })

  it('styles the active prefix chip as a brand default and inactive chips as outline', () => {
    /*
     * Scenario: the `product` prefix is active; `cart` is an inactive chip.
     * Rule it protects: the active quick-pick chip renders the Button `default`
     * variant (`from-brand-500`) while inactive chips render the `outline` variant
     * (`text-foreground`) — pinning the `prefix === option` variant ternary and the
     * `default`/`outline` literals against inversion / string-emptying mutants.
     */
    setup({ prefix: 'product' })
    const active = screen.getByRole('button', { name: 'product' })
    const inactive = screen.getByRole('button', { name: 'cart' })
    expect(active).toHaveClass('from-brand-500')
    expect(inactive).not.toHaveClass('from-brand-500')
    expect(inactive).toHaveClass('text-foreground')
  })

  it('styles the active type facet as a brand default and tints inactive facet icons', () => {
    /*
     * Scenario: the `string` type facet is active; `hash` is inactive.
     * Rule it protects: the active facet renders the `default` variant
     * (`from-brand-500`) with an un-tinted icon (its inline `style` is `undefined`),
     * while an inactive facet renders the `outline` variant (`text-foreground`) and
     * tints its leading icon with the data-type meta color (`hash` → #a855f7 →
     * rgb(168, 85, 247)). Pins the `default`/`outline` literals and the
     * `{ color: meta.color }` inactive-icon style object against being emptied.
     */
    setup({ type: 'string' })
    const active = screen.getByRole('button', { name: 'String' })
    const inactive = screen.getByRole('button', { name: 'Hash' })
    expect(active).toHaveClass('from-brand-500')
    expect(inactive).toHaveClass('text-foreground')
    expect(active.querySelector('svg')?.style.color).toBe('')
    expect(inactive.querySelector('svg')?.style.color).toBe('rgb(168, 85, 247)')
  })
})
