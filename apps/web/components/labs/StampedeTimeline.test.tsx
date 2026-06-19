/**
 * @fileoverview Unit tests for {@link StampedeTimeline} — the bespoke SVG
 * swimlane. Covers the empty guard (renders nothing), the winner lane phase text
 * (`LOCK WON → origin … → SET → release`), the loser lane phase text
 * (`wait → cache HIT`) and its hit marker, the accessible axis summary derived
 * from the `origin` outcome count, and the minimum bar width clamp for a
 * zero-duration entry.
 *
 * @module components/labs/StampedeTimeline.test
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StampedeTimeline } from './StampedeTimeline'
import { type StampedeTimelineEntry } from '@/lib/labs-api'

/** The single lock winner that fetched from origin. */
const WINNER: StampedeTimelineEntry = {
  index: 0,
  token: 'tok-win',
  role: 'won',
  outcome: 'origin',
  startedAt: 1_000,
  finishedAt: 1_120,
  durationMs: 120,
}

/** A loser that waited then read from cache. */
const LOSER: StampedeTimelineEntry = {
  index: 1,
  token: 'tok-wait',
  role: 'waited',
  outcome: 'hit',
  startedAt: 1_010,
  finishedAt: 1_080,
  durationMs: 70,
}

describe('StampedeTimeline', () => {
  it('renders nothing for an empty timeline', () => {
    /*
     * Scenario: no burst has run yet (empty timeline).
     * Rule it protects: the early-return guard renders no SVG at all.
     */
    const { container } = render(<StampedeTimeline timeline={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the winner lane phase and the accessible axis summary', () => {
    /*
     * Scenario: a clean single-flight collapse — one winner, one waiter.
     * Rule it protects: the winner lane reads the LOCK-WON phase (with its origin
     * duration), and the SVG aria-label reports 2 contenders / 1 origin / 1 hit.
     */
    render(<StampedeTimeline timeline={[WINNER, LOSER]} />)
    expect(screen.getByText('LOCK WON → origin 120ms → SET → release')).toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      'Stampede swimlane: 2 contenders, 1 origin fetch(es), 1 cache hit(s)',
    )
  })

  it('renders the loser lane phase and its cache-hit marker', () => {
    /*
     * Scenario: the loser lane.
     * Rule it protects: a `waited` entry renders the `wait → cache HIT` phase and
     * draws the hit-marker circle the winner lane omits.
     */
    const { container } = render(<StampedeTimeline timeline={[WINNER, LOSER]} />)
    expect(screen.getByText('wait → cache HIT')).toBeInTheDocument()
    // Exactly one circle — the single loser's hit marker.
    expect(container.querySelectorAll('circle')).toHaveLength(1)
  })

  it('clamps the bar to the minimum width for a zero-duration entry', () => {
    /*
     * Scenario: a winner whose start and finish epochs are identical (0ms span).
     * Rule it protects: `Math.max(3, x1 - x0)` floors the bar width at 3 so a
     * zero-duration lane is still visible.
     */
    const instant: StampedeTimelineEntry = {
      ...WINNER,
      startedAt: 2_000,
      finishedAt: 2_000,
      durationMs: 0,
    }
    const { container } = render(<StampedeTimeline timeline={[instant]} />)
    const rect = container.querySelector('rect')
    expect(rect).not.toBeNull()
    expect(Number(rect?.getAttribute('width'))).toBeGreaterThanOrEqual(3)
  })

  it('renders req#N labels for every contender', () => {
    /*
     * Scenario: a multi-lane burst.
     * Rule it protects: each lane gets a 1-based `req#N` gutter label.
     */
    render(<StampedeTimeline timeline={[WINNER, LOSER]} />)
    expect(screen.getByText('req#1')).toBeInTheDocument()
    expect(screen.getByText('req#2')).toBeInTheDocument()
  })
})
