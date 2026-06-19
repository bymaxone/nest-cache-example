/**
 * @fileoverview Unit tests for {@link CountdownWall} — the presentation-only grid of
 * TTL countdown tiles plus the seed controls.
 *
 * Drives the empty/populated fork, the default vs overridden empty state, the
 * `fading` opacity branch, the seed-button click handlers, and the `isSeeding`
 * disabled state. The child `TtlRing` is rendered for real (it carries its own
 * timer-driven label), so fake timers are used and real timers restored after.
 *
 * @module components/realtime/CountdownWall.test
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CountdownWall, type CountdownTile } from './CountdownWall'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** A minimal valid tile fixture. */
function tile(overrides: Partial<CountdownTile> = {}): CountdownTile {
  return { key: 'cache-example:ttl:abc', label: 'abc', prefix: 'ttl', ttlSeconds: 30, ...overrides }
}

describe('CountdownWall', () => {
  it('renders the default action-oriented empty state when there are no tiles', () => {
    /*
     * Scenario: the wall is mounted before any key has been seeded.
     * Rule it protects: with zero tiles and no override, the default "seed one above"
     * empty state is shown (the empty branch of the tiles fork).
     */
    render(<CountdownWall tiles={[]} onSeedTtl={vi.fn()} onSeedPersisted={vi.fn()} />)
    expect(
      screen.getByText('No TTL keys yet — seed one above to watch it drain and expire.'),
    ).toBeInTheDocument()
  })

  it('renders a provided emptyState override instead of the default copy', () => {
    /*
     * Scenario: the page passes a bespoke empty state.
     * Rule it protects: the `emptyState ?? default` nullish branch prefers the
     * caller-supplied node over the built-in copy.
     */
    render(
      <CountdownWall
        tiles={[]}
        onSeedTtl={vi.fn()}
        onSeedPersisted={vi.fn()}
        emptyState={<span>Custom empty</span>}
      />,
    )
    expect(screen.getByText('Custom empty')).toBeInTheDocument()
  })

  it('renders one tile per entry with its prefix chip, label, and TTL ring', () => {
    /*
     * Scenario: two seeded keys are handed to the wall.
     * Rule it protects: the populated branch maps each tile to its prefix badge,
     * short label, and a `TtlRing` (the SVG role="img") — one rendered group per tile.
     */
    render(
      <CountdownWall
        tiles={[
          tile({ key: 'k1', label: 'one', prefix: 'ttl' }),
          tile({ key: 'k2', label: 'two' }),
        ]}
        onSeedTtl={vi.fn()}
        onSeedPersisted={vi.fn()}
      />,
    )
    expect(screen.getByText('one')).toBeInTheDocument()
    expect(screen.getByText('two')).toBeInTheDocument()
    expect(screen.getAllByText('ttl')).toHaveLength(2)
    expect(screen.getAllByRole('img')).toHaveLength(2)
  })

  it('applies the fade-out opacity class only to a tile flagged fading', () => {
    /*
     * Scenario: one tile has received its confirmed `cache:expired` event.
     * Rule it protects: the `tile.fading && 'opacity-0'` branch dims only the fading
     * tile, leaving its non-fading sibling fully opaque.
     */
    const { container } = render(
      <CountdownWall
        tiles={[
          tile({ key: 'k1', label: 'gone', fading: true }),
          tile({ key: 'k2', label: 'stay' }),
        ]}
        onSeedTtl={vi.fn()}
        onSeedPersisted={vi.fn()}
      />,
    )
    const fading = container.querySelector('.opacity-0')
    expect(fading).not.toBeNull()
    expect(fading).toHaveTextContent('gone')
    expect(container.querySelectorAll('.opacity-0')).toHaveLength(1)
  })

  it('invokes onSeedTtl and onSeedPersisted when their buttons are clicked', async () => {
    /*
     * Scenario: the operator clicks each seed control.
     * Rule it protects: the two buttons are wired to their respective callbacks —
     * the only event handlers the presentational wall owns.
     */
    const onSeedTtl = vi.fn()
    const onSeedPersisted = vi.fn()
    const user = userEvent.setup()
    render(<CountdownWall tiles={[]} onSeedTtl={onSeedTtl} onSeedPersisted={onSeedPersisted} />)

    await user.click(screen.getByRole('button', { name: 'Seed key w/ TTL: 30s' }))
    await user.click(screen.getByRole('button', { name: 'Seed persisted (∞)' }))
    expect(onSeedTtl).toHaveBeenCalledTimes(1)
    expect(onSeedPersisted).toHaveBeenCalledTimes(1)
  })

  it('disables both seed buttons while a seed mutation is in flight', () => {
    /*
     * Scenario: a seed request is pending (`isSeeding`).
     * Rule it protects: both seed buttons are disabled so a double-submit cannot fire
     * a second mutation mid-flight.
     */
    render(<CountdownWall tiles={[]} onSeedTtl={vi.fn()} onSeedPersisted={vi.fn()} isSeeding />)
    expect(screen.getByRole('button', { name: 'Seed key w/ TTL: 30s' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Seed persisted (∞)' })).toBeDisabled()
  })
})
