/**
 * @fileoverview Unit tests for `TypeDonut` — the keys-by-type click-to-filter donut.
 * Drives the empty branch (all counts zero → empty state, no summary), the
 * non-empty filter + summary, the click-to-filter `onSelect` callback, and the
 * no-callback variant.
 *
 * The recharts `Cell` is stubbed to a real `<button>` carrying the `onClick` so the
 * slice click is reachable under jsdom; the rest of recharts is left intact.
 *
 * @module components/charts/TypeDonut.test
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TypeDonut } from './TypeDonut'
import { type TypeDatum } from './types'

interface CellStubProps {
  onClick?: () => void
  className?: string
  fill?: string
}

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>()
  return {
    ...actual,
    // Render each slice Cell as a real button so its `onClick` fires under jsdom.
    Cell: ({ onClick, className, fill }: CellStubProps) => (
      <button
        type="button"
        data-testid="slice"
        data-classname={className}
        data-fill={fill}
        onClick={onClick}
      />
    ),
  }
})

/** A keyspace breakdown with a zero `set` slice so the filter has work to do. */
const SAMPLE: TypeDatum[] = [
  { type: 'string', count: 8 },
  { type: 'hash', count: 2 },
  { type: 'set', count: 0 },
]

describe('TypeDonut', () => {
  it('renders the empty state and no summary when every count is zero', () => {
    /*
     * Scenario: no keys of any type.
     * Rule it protects: total of the non-empty slices is zero → frame empty and the
     * `total > 0 ? … : undefined` summary branch yields nothing.
     */
    render(
      <TypeDonut
        data={[
          { type: 'string', count: 0 },
          { type: 'hash', count: 0 },
          { type: 'set', count: 0 },
        ]}
      />,
    )
    expect(screen.getByText('No data yet.')).toBeInTheDocument()
    // The summary sentence (distinct from the panel title) is suppressed when empty.
    expect(screen.queryByText(/Keys by type — /)).not.toBeInTheDocument()
  })

  it('filters out zero slices and summarizes the rest when populated', () => {
    /*
     * Scenario: string + hash present, set empty.
     * Rule it protects: `data.filter((d) => d.count > 0)` drops the empty slice; only
     * the two non-empty types appear in the accessible summary.
     */
    render(<TypeDonut data={SAMPLE} />)
    expect(screen.getByText('Keys by type — string: 8, hash: 2.')).toBeInTheDocument()
    // Only two slices render (the zero `set` was filtered out).
    expect(screen.getAllByTestId('slice')).toHaveLength(2)
  })

  it('renders the loading skeleton when loading', () => {
    /*
     * Scenario: the keyspace sample is still loading.
     * Rule it protects: `isLoading` forwards to the frame's skeleton branch, so the
     * empty-state copy never shows even though the non-visual summary still ships.
     */
    render(<TypeDonut data={SAMPLE} isLoading />)
    expect(screen.queryByText('No data yet.')).not.toBeInTheDocument()
    expect(screen.getByText('Keys by type — string: 8, hash: 2.')).toBeInTheDocument()
  })

  it('calls onSelect with the type when a slice is clicked', async () => {
    /*
     * Scenario: the user clicks a slice to pivot to the Explorer pre-filtered.
     * Rule it protects: each Cell's `onClick` calls `onSelect(entry.type)`; clickable
     * slices carry the pointer affordance.
     */
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<TypeDonut data={SAMPLE} onSelect={onSelect} />)
    const slices = screen.getAllByTestId('slice')
    expect(slices[0]).toHaveAttribute('data-classname', 'cursor-pointer')
    await user.click(slices[0]!)
    expect(onSelect).toHaveBeenCalledWith('string')
  })

  it('drops the pointer affordance and no-ops the click without onSelect', async () => {
    /*
     * Scenario: a read-only donut with no `onSelect`.
     * Rule it protects: the `onSelect ? 'cursor-pointer' : undefined` branch leaves no
     * affordance and the `onSelect?.(…)` optional-call is a safe no-op.
     */
    const user = userEvent.setup()
    render(<TypeDonut data={SAMPLE} />)
    const slices = screen.getAllByTestId('slice')
    expect(slices[0]).not.toHaveAttribute('data-classname', 'cursor-pointer')
    await user.click(slices[0]!)
    expect(slices[0]).toBeInTheDocument()
  })
})
