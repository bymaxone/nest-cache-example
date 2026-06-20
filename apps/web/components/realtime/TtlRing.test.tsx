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
    // A freshly-seeded key is not expiring: the terminal caption stays absent.
    expect(screen.queryByText('expiring…')).not.toBeInTheDocument()
    // The wrapper centres the ring via its base layout classes (the `cn(...)` literal),
    // so a blanked class string would collapse the layout.
    expect(screen.getByRole('img')).toHaveClass(
      'relative',
      'inline-flex',
      'items-center',
      'justify-center',
    )
  })

  it('draws the SVG geometry, full green arc, and zero drain offset for a fresh key', () => {
    /*
     * Scenario: a freshly-seeded 90s key (fraction = 1) with the default 88px size.
     * Rule it protects: the ring's pure geometry surfaces as exact SVG attributes —
     * radius `(size - strokeWidth) / 2` = 40, circumference `2·π·r` on the arc's
     * stroke-dasharray, centered `cx`/`cy` at `size / 2` = 44, the `0 0 88 88`
     * viewBox, the `rotate(-90 44 44)` transform — and a full-health key drains by
     * `circumference · (1 - 1)` = 0 with the green `#22c55e` arc stroke. Each constant
     * pins one arithmetic / string operator in the geometry block.
     */
    const { container } = render(<TtlRing ttlSeconds={90} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('viewBox')).toBe('0 0 88 88')

    const circles = container.querySelectorAll('circle')
    const [track, arc] = circles
    expect(track?.getAttribute('r')).toBe('40')
    expect(track?.getAttribute('cx')).toBe('44')
    expect(track?.getAttribute('cy')).toBe('44')

    expect(arc?.getAttribute('cx')).toBe('44')
    expect(arc?.getAttribute('cy')).toBe('44')
    expect(arc?.getAttribute('stroke')).toBe('#22c55e')
    expect(arc?.getAttribute('stroke-dasharray')).toBe('251.32741228718345')
    expect(arc?.getAttribute('stroke-dashoffset')).toBe('0')
    expect(arc?.getAttribute('transform')).toBe('rotate(-90 44 44)')

    // The center label carries the arc color via an inline style (not a class).
    expect(screen.getByText('01:30').getAttribute('style')).toContain('color: rgb(34, 197, 94)')
  })

  it('sizes the wrapper to the ring diameter via an inline style', () => {
    /*
     * Scenario: a default 88px ring is mounted.
     * Rule it protects: the wrapper `role="img"` span carries `width`/`height` equal to
     * `size`, so the ring reserves its box — the wrapper style object is not dropped.
     */
    render(<TtlRing ttlSeconds={90} />)
    const style = screen.getByRole('img').getAttribute('style') ?? ''
    expect(style).toContain('width: 88px')
    expect(style).toContain('height: 88px')
  })

  it('renders the persisted ∞ label and the no-expiry aria label for ttl -1', () => {
    /*
     * Scenario: a persisted key (Redis TTL `-1`).
     * Rule it protects: persisted keys render `∞`, never tick, and announce
     * "persisted, no expiry" — the persisted branch of the color/label logic.
     */
    const { container } = render(<TtlRing ttlSeconds={-1} />)
    expect(screen.getByText('∞')).toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'TTL: persisted, no expiry')
    // Persisted is never "absent", so the foreground arc IS rendered (two circles)
    // and it uses the persisted brand color with a fully-drawn (zero-offset) arc.
    const circles = container.querySelectorAll('circle')
    expect(circles).toHaveLength(2)
    expect(circles[1]?.getAttribute('stroke')).toBe('#ff6224')
    expect(circles[1]?.getAttribute('stroke-dashoffset')).toBe('0')
    // Persisted is never "expiring": the terminal caption must stay absent.
    expect(screen.queryByText('expiring…')).not.toBeInTheDocument()
  })

  it('renders 00:00 + the expiring caption for a zero ttl (not the absent — label)', () => {
    /*
     * Scenario: a key reported with exactly ttl 0.
     * Rule it protects: zero is NOT absent (`ttlSeconds < 0` is strict) — it renders
     * the `00:00` label, the "expiring…" caption, and the "expiring" aria, pinning the
     * strict `< 0` absent boundary against a `<= 0` mutation that would blank the tile.
     */
    render(<TtlRing ttlSeconds={0} />)
    expect(screen.getByText('00:00')).toBeInTheDocument()
    expect(screen.getByText('expiring…')).toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'TTL: expiring')
    expect(screen.queryByText('—')).not.toBeInTheDocument()
  })

  it('renders the absent — label (and omits the arc) for a non-(-1) negative ttl', () => {
    /*
     * Scenario: an absent key (Redis TTL `-2`).
     * Rule it protects: any negative other than `-1` is "absent" — shows `—`, the
     * accessible "absent" label, and renders only the background circle (no arc).
     */
    const { container } = render(<TtlRing ttlSeconds={-2} />)
    const dash = screen.getByText('—')
    expect(dash).toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'TTL: absent')
    // Absent → the second (foreground arc) circle is not rendered.
    expect(container.querySelectorAll('circle')).toHaveLength(1)
    // The muted absent color is carried on the label via an inline style.
    expect(dash.getAttribute('style')).toContain('color: rgba(255, 255, 255, 0.25)')
    expect(screen.queryByText('expiring…')).not.toBeInTheDocument()
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

  it('drains the arc color and offset across the health thresholds as it ticks', () => {
    /*
     * Scenario: a 10s key drains so its remaining fraction crosses 0.6 → 0.5 → 0.3
     * → 0.2 (full / boundary / amber / boundary).
     * Rule it protects: `arcColor` is green above 0.5, amber down to 0.2, red below —
     * with the comparisons STRICT (`>`), so exactly 0.5 is amber and exactly 0.2 is
     * red. The drain offset is `circumference · (1 - fraction)` computed against the
     * captured initial TTL (10), so each tick yields an exact stroke-dashoffset. This
     * pins the threshold equalities, both arc-color branches, the fraction division,
     * and the drain arithmetic.
     */
    vi.useFakeTimers()
    const { container } = render(<TtlRing ttlSeconds={10} />)
    const arc = () => container.querySelectorAll('circle')[1]

    // remaining 10, fraction 1.0 → green, fully drawn.
    expect(arc()?.getAttribute('stroke')).toBe('#22c55e')
    expect(arc()?.getAttribute('stroke-dashoffset')).toBe('0')

    // remaining 6, fraction 0.6 → still green.
    act(() => {
      vi.advanceTimersByTime(4_000)
    })
    expect(arc()?.getAttribute('stroke')).toBe('#22c55e')
    expect(arc()?.getAttribute('stroke-dashoffset')).toBe('100.53096491487338')

    // remaining 5, fraction exactly 0.5 → amber (strictly NOT green at the boundary).
    act(() => {
      vi.advanceTimersByTime(1_000)
    })
    expect(arc()?.getAttribute('stroke')).toBe('#f59e0b')
    expect(arc()?.getAttribute('stroke-dashoffset')).toBe('125.66370614359172')

    // remaining 3, fraction 0.3 → amber.
    act(() => {
      vi.advanceTimersByTime(2_000)
    })
    expect(arc()?.getAttribute('stroke')).toBe('#f59e0b')
    expect(arc()?.getAttribute('stroke-dashoffset')).toBe('175.92918860102841')

    // remaining 2, fraction exactly 0.2 → red (strictly NOT amber at the boundary).
    act(() => {
      vi.advanceTimersByTime(1_000)
    })
    expect(arc()?.getAttribute('stroke')).toBe('#ef4444')
    expect(arc()?.getAttribute('stroke-dashoffset')).toBe('201.06192982974676')
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

  it('never arms the drain interval for persisted or absent keys', () => {
    /*
     * Scenario: a persisted (`-1`) then an absent (`-2`) ring mounts.
     * Rule it protects: the tick effect's `isPersisted || isAbsent` guard early-returns
     * for non-draining keys, so no `setInterval` is ever armed — pinning the guard
     * against a forced-`false` condition or an `&&` swap that would start a timer.
     * (The label alone cannot detect this: a persisted/absent `remaining` is pinned at
     * 0, so a stray interval changes nothing visible — the spy is the only witness.)
     */
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    const { rerender } = render(<TtlRing ttlSeconds={-1} />)
    expect(setIntervalSpy).not.toHaveBeenCalled()
    rerender(<TtlRing ttlSeconds={-2} />)
    expect(setIntervalSpy).not.toHaveBeenCalled()
  })

  it('arms the drain interval for a live key and clears it on unmount', () => {
    /*
     * Scenario: a live (draining) ring mounts then unmounts.
     * Rule it protects: a live key arms exactly one tick interval, and the effect's
     * cleanup `clearInterval`s that timer on unmount — pinning the cleanup arrow against
     * a `() => undefined` mutation that would leak the interval.
     */
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
    const { unmount } = render(<TtlRing ttlSeconds={5} />)
    expect(setIntervalSpy).toHaveBeenCalled()
    unmount()
    expect(clearIntervalSpy).toHaveBeenCalled()
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

  it('queries the reduced-motion media feature by its exact name to drop the transition', () => {
    /*
     * Scenario: the environment matches reduced motion only for the exact
     * `(prefers-reduced-motion: reduce)` media query.
     * Rule it protects: the component probes that precise media feature string — a
     * blanked or altered query would no longer match, so the transition would wrongly
     * remain. The matcher returns `matches: true` ONLY for the canonical query.
     */
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    }))
    const { container } = render(<TtlRing ttlSeconds={60} />)
    const arc = container.querySelectorAll('circle')[1]
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
