/**
 * @fileoverview Unit tests for {@link TtlRing} — the bespoke SVG radial countdown.
 *
 * Drives every TTL branch (persisted `∞`, absent `—`, draining, expiring) plus the
 * `prefers-reduced-motion` arc-transition fork. Uses fake timers to advance the
 * 1s interval and assert the center label ticks down and holds an "expiring…"
 * terminal state at zero without removing itself; real timers are restored after.
 *
 * @module components/realtime/TtlRing.test
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import { TtlRing } from './TtlRing'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('TtlRing', () => {
  it('renders a draining ring with an mm:ss label and a remaining-time aria label', () => {
    /*
     * Scenario: a freshly-seeded 90s key is rendered.
     * Rule it protects: a positive TTL shows the formatted `mm:ss` center label and
     * an accessible "N seconds remaining" description (not persisted/absent/expiring).
     */
    render(<TtlRing ttlSeconds={90} />)
    expect(screen.getByText('01:30')).toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'TTL: 90 seconds remaining')
  })

  it('renders the persisted ∞ label and the no-expiry aria label for ttl -1', () => {
    /*
     * Scenario: a persisted key (Redis TTL `-1`).
     * Rule it protects: persisted keys render `∞`, never tick, and announce
     * "persisted, no expiry" — the persisted branch of the color/label logic.
     */
    render(<TtlRing ttlSeconds={-1} />)
    expect(screen.getByText('∞')).toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'TTL: persisted, no expiry')
  })

  it('renders the absent — label (and omits the arc) for a non-(-1) negative ttl', () => {
    /*
     * Scenario: an absent key (Redis TTL `-2`).
     * Rule it protects: any negative other than `-1` is "absent" — shows `—`, the
     * accessible "absent" label, and renders only the background circle (no arc).
     */
    const { container } = render(<TtlRing ttlSeconds={-2} />)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'TTL: absent')
    // Absent → the second (foreground arc) circle is not rendered.
    expect(container.querySelectorAll('circle')).toHaveLength(1)
  })

  it('ticks the countdown down each second and holds an expiring terminal state at zero', () => {
    /*
     * Scenario: a 2s key drains under the live timer.
     * Rule it protects: the interval decrements the label once per second, then at
     * zero shows `00:00` + the "expiring…" caption and announces "expiring" — and it
     * never goes below zero on subsequent ticks (the event, not the timer, removes it).
     */
    vi.useFakeTimers()
    render(<TtlRing ttlSeconds={2} />)
    expect(screen.getByText('00:02')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1_000)
    })
    expect(screen.getByText('00:01')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1_000)
    })
    expect(screen.getByText('00:00')).toBeInTheDocument()
    expect(screen.getByText('expiring…')).toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'TTL: expiring')

    // A further tick must not push remaining below zero.
    act(() => {
      vi.advanceTimersByTime(1_000)
    })
    expect(screen.getByText('00:00')).toBeInTheDocument()
  })

  it('does not run an interval for persisted or absent keys', () => {
    /*
     * Scenario: persisted/absent rings under fake timers.
     * Rule it protects: the tick effect early-returns for persisted/absent keys, so
     * advancing time never mutates their `∞` / `—` labels.
     */
    vi.useFakeTimers()
    const { rerender } = render(<TtlRing ttlSeconds={-1} />)
    act(() => {
      vi.advanceTimersByTime(5_000)
    })
    expect(screen.getByText('∞')).toBeInTheDocument()

    rerender(<TtlRing ttlSeconds={-2} />)
    act(() => {
      vi.advanceTimersByTime(5_000)
    })
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('resyncs the countdown when the ttlSeconds prop changes', () => {
    /*
     * Scenario: the live TTL prop is refreshed to a new value.
     * Rule it protects: the resync effect re-captures the denominator and resets
     * `remaining` to the new prop, so the label reflects the latest seeded TTL.
     */
    const { rerender } = render(<TtlRing ttlSeconds={30} />)
    expect(screen.getByText('00:30')).toBeInTheDocument()
    rerender(<TtlRing ttlSeconds={120} />)
    expect(screen.getByText('02:00')).toBeInTheDocument()
  })

  it('omits the arc transition style when the user prefers reduced motion', () => {
    /*
     * Scenario: a reader with `prefers-reduced-motion: reduce`.
     * Rule it protects: the reduced-motion branch sets the arc `style` to undefined
     * (no `transition`), honouring DASHBOARD §15 — no unstoppable motion.
     */
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    })
    const { container } = render(<TtlRing ttlSeconds={60} />)
    const arc = container.querySelectorAll('circle')[1]
    expect(arc).toBeDefined()
    expect(arc?.getAttribute('style')).toBeNull()
  })

  it('applies the arc transition style when reduced motion is not requested', () => {
    /*
     * Scenario: a reader without the reduced-motion preference.
     * Rule it protects: the default branch attaches the `stroke-dashoffset`/`stroke`
     * transition so the arc animates smoothly as it drains.
     */
    const { container } = render(<TtlRing ttlSeconds={60} />)
    const arc = container.querySelectorAll('circle')[1]
    expect(arc?.getAttribute('style')).toContain('stroke-dashoffset')
  })
})
