/**
 * @fileoverview Unit tests for `MemoryByPrefix` — the click-to-filter horizontal
 * memory bar. Drives the empty branch (no data → empty state, no summary), the
 * descending sort + summary, the click-to-filter `onSelect` callback, and the
 * no-callback variant (the `cursor-pointer` class is dropped and the click is a
 * no-op via `onSelect?.`).
 *
 * The recharts `Cell` is stubbed to a real `<button>` carrying the `onClick` so the
 * click handler is reachable under jsdom — recharts renders `Cell` as an SVG
 * `<path>` whose synthetic click does not fire reliably in jsdom. The rest of
 * recharts is untouched.
 *
 * @module components/charts/MemoryByPrefix.test
 */
import { type ReactNode } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryByPrefix } from './MemoryByPrefix'
import { type PrefixDatum } from './types'

interface CellStubProps {
  onClick?: () => void
  className?: string
  children?: ReactNode
}

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>()
  return {
    ...actual,
    // Render each bar Cell as a real button so its `onClick` fires under jsdom.
    Cell: ({ onClick, className }: CellStubProps) => (
      <button type="button" data-testid="bar-cell" data-classname={className} onClick={onClick} />
    ),
  }
})

/** A two-prefix memory sample (intentionally out of descending order). */
const SAMPLE: PrefixDatum[] = [
  { prefix: 'session', bytes: 100 },
  { prefix: 'product', bytes: 2_048 },
]

describe('MemoryByPrefix', () => {
  it('renders the empty state and no summary when there is no data', () => {
    /*
     * Scenario: no sampled prefixes.
     * Rule it protects: `sorted.length === 0` flips the frame empty and the
     * `sorted.length > 0 ? … : undefined` summary branch yields nothing.
     */
    render(<MemoryByPrefix data={[]} />)
    expect(screen.getByText('No data yet.')).toBeInTheDocument()
    // The summary sentence (distinct from the panel title) is suppressed when empty.
    expect(screen.queryByText(/Memory by prefix — /)).not.toBeInTheDocument()
  })

  it('summarizes prefixes sorted by descending bytes when populated', () => {
    /*
     * Scenario: a two-prefix sample given smallest-first.
     * Rule it protects: the `[...data].sort((a, b) => b.bytes - a.bytes)` orders the
     * summary largest-first and formats each via `formatBytes`.
     */
    render(<MemoryByPrefix data={SAMPLE} />)
    expect(
      screen.getByText('Memory by prefix — product: 2.0 KB, session: 100 B.'),
    ).toBeInTheDocument()
  })

  it('renders the loading skeleton when loading', () => {
    /*
     * Scenario: the keyspace sample is still loading.
     * Rule it protects: `isLoading` forwards to the frame's skeleton branch, so the
     * empty-state copy never shows even though the non-visual summary still ships.
     */
    render(<MemoryByPrefix data={SAMPLE} isLoading />)
    expect(screen.queryByText('No data yet.')).not.toBeInTheDocument()
    expect(
      screen.getByText('Memory by prefix — product: 2.0 KB, session: 100 B.'),
    ).toBeInTheDocument()
  })

  it('calls onSelect with the prefix when a bar is clicked', async () => {
    /*
     * Scenario: the user clicks a memory bar to pivot to the Explorer.
     * Rule it protects: each Cell's `onClick` calls `onSelect(entry.prefix)` with the
     * largest-first sorted prefix; the bars are marked clickable.
     */
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<MemoryByPrefix data={SAMPLE} onSelect={onSelect} />)
    const cells = screen.getAllByTestId('bar-cell')
    expect(cells[0]).toHaveAttribute('data-classname', 'cursor-pointer')
    await user.click(cells[0]!)
    expect(onSelect).toHaveBeenCalledWith('product')
  })

  it('drops the pointer affordance and no-ops the click without onSelect', async () => {
    /*
     * Scenario: a read-only chart with no `onSelect`.
     * Rule it protects: the `onSelect ? 'cursor-pointer' : undefined` branch leaves no
     * affordance and the `onSelect?.(…)` optional-call is a safe no-op.
     */
    const user = userEvent.setup()
    render(<MemoryByPrefix data={SAMPLE} />)
    const cells = screen.getAllByTestId('bar-cell')
    expect(cells[0]).not.toHaveAttribute('data-classname', 'cursor-pointer')
    await user.click(cells[0]!)
    expect(cells[0]).toBeInTheDocument()
  })
})
