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

  it('renders the span tick text from maxEnd − minStart', () => {
    /*
     * Scenario: a winner (1000→1120) and a loser inside that window.
     * Rule it protects: the right-edge axis tick reads the exact span
     * (`maxEnd − minStart` = 120ms), pinning the `Math.min`/`Math.max` reducers
     * and the `maxEnd − minStart` subtraction (a `+` mutant would read 2120ms).
     */
    render(<StampedeTimeline timeline={[WINNER, LOSER]} />)
    expect(screen.getByText('120ms')).toBeInTheDocument()
  })

  it('sizes the viewBox from the gutter/track/text and lane geometry', () => {
    /*
     * Scenario: a two-lane burst with the known constant geometry.
     * Rule it protects: the viewBox width is `GUTTER + TRACK + TEXT_COLUMN` (746)
     * and the height is `TOP + n·(LANE_HEIGHT + LANE_GAP)` (18 + 2·28 = 74),
     * killing every arithmetic mutant in the width/height expressions.
     */
    render(<StampedeTimeline timeline={[WINNER, LOSER]} />)
    expect(screen.getByRole('img')).toHaveAttribute('viewBox', '0 0 746 74')
  })

  it('positions the start tick at the gutter and the end tick at gutter+track', () => {
    /*
     * Scenario: the time-axis ticks.
     * Rule it protects: the `0ms` tick sits at x = GUTTER (56) and the span tick at
     * x = GUTTER + TRACK (496), pinning the `GUTTER + TRACK` end-tick arithmetic.
     */
    render(<StampedeTimeline timeline={[WINNER, LOSER]} />)
    expect(screen.getByText('0ms')).toHaveAttribute('x', '56')
    expect(screen.getByText('120ms')).toHaveAttribute('x', '496')
  })

  it('maps epochs to x positions across the full track width', () => {
    /*
     * Scenario: the winner spans the entire window (1000→1120, full span).
     * Rule it protects: `xFor` maps minStart to the gutter (x0 = 56) and maxEnd to
     * the track end (x1 = 56 + TRACK = 496), and the bar width is `x1 − x0` = 440.
     * This pins every arithmetic operator in `xFor` and the bar-width subtraction.
     */
    render(<StampedeTimeline timeline={[WINNER, LOSER]} />)
    const winnerBar = screen
      .getByText('LOCK WON → origin 120ms → SET → release')
      .closest('g')
      ?.querySelector('rect')
    expect(winnerBar).not.toBeNull()
    expect(Number(winnerBar?.getAttribute('x'))).toBeCloseTo(56, 5)
    expect(Number(winnerBar?.getAttribute('width'))).toBeCloseTo(440, 5)
  })

  it('places the loser bar and hit marker at the interpolated epoch x', () => {
    /*
     * Scenario: the loser started at 1010 and resolved at 1080 within the 120ms span.
     * Rule it protects: `xFor` interpolates inside the track —
     * x0 = 56 + (10/120)·440 ≈ 92.667 and the hit marker cx = x1 = 56 + (80/120)·440
     * ≈ 349.333 — so any swapped operator (+/*, etc.) in `xFor` shifts the marker.
     */
    const { container } = render(<StampedeTimeline timeline={[WINNER, LOSER]} />)
    const circle = container.querySelector('circle')
    expect(circle).not.toBeNull()
    expect(Number(circle?.getAttribute('cx'))).toBeCloseTo(349.333, 2)
    const loserBar = screen.getByText('wait → cache HIT').closest('g')?.querySelector('rect')
    expect(Number(loserBar?.getAttribute('x'))).toBeCloseTo(92.667, 2)
  })

  it('stacks lanes vertically by index with centered glyphs', () => {
    /*
     * Scenario: the second lane (loser, index 1).
     * Rule it protects: y = TOP + index·(LANE_HEIGHT + LANE_GAP) = 18 + 1·28 = 46
     * for the rect, and center = y + LANE_HEIGHT/2 = 57 for the hit marker cy and
     * the track baseline — pinning the lane-offset and center arithmetic.
     */
    const { container } = render(<StampedeTimeline timeline={[WINNER, LOSER]} />)
    const loserBar = screen.getByText('wait → cache HIT').closest('g')?.querySelector('rect')
    expect(Number(loserBar?.getAttribute('y'))).toBe(46)
    const circle = container.querySelector('circle')
    expect(Number(circle?.getAttribute('cy'))).toBe(57)
  })

  it('draws the per-lane baseline from the gutter to gutter+track', () => {
    /*
     * Scenario: the track baseline line under each lane.
     * Rule it protects: the baseline runs x1 = GUTTER (56) to x2 = GUTTER + TRACK
     * (496), pinning the `GUTTER + TRACK` line endpoint arithmetic.
     */
    const { container } = render(<StampedeTimeline timeline={[WINNER]} />)
    const line = container.querySelector('line')
    expect(line).not.toBeNull()
    expect(line?.getAttribute('x1')).toBe('56')
    expect(line?.getAttribute('x2')).toBe('496')
  })

  it('dashes the loser baseline but leaves the winner baseline solid', () => {
    /*
     * Scenario: the winner vs loser track baselines.
     * Rule it protects: the loser lane gets the `'2 3'` dash array (empty time reads
     * as waiting) while the winner lane has no dash array — pinning the dash literal
     * and the winner-vs-loser branch on the baseline.
     */
    const winnerLine = render(<StampedeTimeline timeline={[WINNER]} />).container.querySelector(
      'line',
    )
    expect(winnerLine?.getAttribute('stroke-dasharray')).toBeNull()
    const loserLine = render(<StampedeTimeline timeline={[LOSER]} />).container.querySelector(
      'line',
    )
    expect(loserLine?.getAttribute('stroke-dasharray')).toBe('2 3')
  })

  it('counts origin fetches independently of cache hits in the axis summary', () => {
    /*
     * Scenario: two origin fetches and one cache hit (an asymmetric mix).
     * Rule it protects: `outcome === 'origin'` counts origins (2), so the summary
     * reads 2 origin / 1 hit — a `!==` mutant would invert the count to 1 origin.
     */
    const secondOrigin: StampedeTimelineEntry = {
      ...WINNER,
      index: 2,
      token: 'tok-win2',
      outcome: 'origin',
      role: 'won',
    }
    render(<StampedeTimeline timeline={[WINNER, secondOrigin, LOSER]} />)
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      'Stampede swimlane: 3 contenders, 2 origin fetch(es), 1 cache hit(s)',
    )
  })

  it('draws the hit marker on the loser lane, not the winner lane', () => {
    /*
     * Scenario: one winner and one loser.
     * Rule it protects: the `!isWon` guard draws the hit-marker circle on the loser
     * lane only — its cy must equal the loser lane center (57), so an `isWon` mutant
     * (marker on the winner) would place it at the winner center (29) instead.
     */
    const { container } = render(<StampedeTimeline timeline={[WINNER, LOSER]} />)
    const circles = container.querySelectorAll('circle')
    expect(circles).toHaveLength(1)
    expect(Number(circles[0]?.getAttribute('cy'))).toBe(57)
  })

  it('places the req#N label and phase text at the lane center baseline', () => {
    /*
     * Scenario: the first lane (winner, index 0, center = 29).
     * Rule it protects: the `req#1` gutter label and the phase text both sit at
     * y = center + 3 = 32, and the phase text starts at x = GUTTER + TRACK + 8 = 504,
     * pinning the `center + 3` and `GUTTER + TRACK + 8` arithmetic.
     */
    render(<StampedeTimeline timeline={[WINNER]} />)
    expect(screen.getByText('req#1')).toHaveAttribute('y', '32')
    const phase = screen.getByText('LOCK WON → origin 120ms → SET → release')
    expect(phase).toHaveAttribute('y', '32')
    expect(phase).toHaveAttribute('x', '504')
  })
})
