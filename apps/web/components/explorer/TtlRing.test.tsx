/**
 * @fileoverview Unit tests for {@link TtlRing} — the bespoke SVG radial TTL
 * countdown. Drives every Redis TTL convention branch (`-1` persisted, `<0`
 * absent, `≥0` seconds), each arc-color band (green/amber/red), the optional
 * countdown ticker (which resyncs on prop change and never drops below zero),
 * and the optional label rendering. Behavior is asserted through the accessible
 * `aria-label`, the rendered label text, and the presence/absence of the arc
 * circle — not class names.
 *
 * @module components/explorer/TtlRing.test
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { TtlRing } from './TtlRing'

afterEach(() => {
  vi.useRealTimers()
})

/**
 * Return the two SVG circles the ring draws: the static background track (no
 * dash attributes) and the draining foreground arc (carries `stroke-dasharray`).
 * The foreground is identified by that dash attribute — the only structural,
 * non-className signal that distinguishes the two circles.
 *
 * @param svg - The ring's `role="img"` SVG element.
 * @returns The background and (optional) foreground circle elements.
 */
function ringCircles(svg: HTMLElement): {
  background: SVGCircleElement | undefined
  foreground: SVGCircleElement | undefined
} {
  const circles = Array.from(svg.querySelectorAll<SVGCircleElement>('circle'))
  const foreground = circles.find((c) => c.hasAttribute('stroke-dasharray'))
  const background = circles.find((c) => !c.hasAttribute('stroke-dasharray'))
  return { background, foreground }
}

describe('TtlRing', () => {
  it('renders a persisted key (-1) as ∞ with a drawn arc', () => {
    /*
     * Scenario: a key with no expiry (Redis `-1`).
     * Rule it protects: persisted reads `∞` in both the label and the accessible
     * aria-label, and the arc circle is still drawn (full ring).
     */
    render(<TtlRing ttlSeconds={-1} showLabel />)
    expect(screen.getByText('∞')).toBeInTheDocument()
    const svg = screen.getByRole('img')
    expect(svg).toHaveAttribute('aria-label', 'TTL ∞')
    // The persisted ring still draws the foreground arc (two circles total).
    expect(svg.querySelectorAll('circle')).toHaveLength(2)
  })

  it('renders an absent TTL (-2) as — and omits the arc circle', () => {
    /*
     * Scenario: a key Redis reports as missing/absent (`-2`, any negative ≠ -1).
     * Rule it protects: absent reads `—` and the foreground arc is NOT drawn, so
     * only the background track circle remains.
     */
    render(<TtlRing ttlSeconds={-2} showLabel />)
    expect(screen.getByText('—')).toBeInTheDocument()
    const svg = screen.getByRole('img')
    expect(svg).toHaveAttribute('aria-label', 'TTL —')
    expect(svg.querySelectorAll('circle')).toHaveLength(1)
  })

  it('formats a positive TTL as mm:ss', () => {
    /*
     * Scenario: a key with 90 seconds remaining.
     * Rule it protects: positive seconds render the `mm:ss` label (`01:30`).
     */
    render(<TtlRing ttlSeconds={90} showLabel />)
    expect(screen.getByText('01:30')).toBeInTheDocument()
  })

  it('treats a zero TTL as expired-but-present (00:00 with a drawn arc), not absent', () => {
    /*
     * Scenario: a key whose TTL has just hit `0` (expired this tick, still listed).
     * Rule it protects: the absent guard is a strict `< 0` — `0` is NOT absent, so the
     * foreground arc is still drawn (two circles). Pinning against `<= 0`, which would
     * mis-classify `0` as absent and drop the arc to a single background circle. The
     * label reads `00:00` either way, so the drawn arc is the discriminating signal.
     */
    render(<TtlRing ttlSeconds={0} showLabel />)
    expect(screen.getByText('00:00')).toBeInTheDocument()
    const svg = screen.getByRole('img')
    expect(svg.querySelectorAll('circle')).toHaveLength(2)
  })

  it('does not render a label when showLabel is omitted', () => {
    /*
     * Scenario: the ring used as a bare glyph (table cell variant).
     * Rule it protects: with `showLabel` falsy, only the SVG renders — no label text.
     */
    render(<TtlRing ttlSeconds={120} />)
    expect(screen.getByRole('img')).toBeInTheDocument()
    expect(screen.queryByText('02:00')).not.toBeInTheDocument()
  })

  describe('arc color bands (via the label text color style)', () => {
    /**
     * Reads the inline color the label span renders with, which mirrors the arc
     * color resolved by `arcColor`/the persisted/absent branch.
     *
     * @param ttl - The TTL prop.
     * @param max - The maxSeconds prop.
     * @returns The resolved CSS color string of the label span.
     */
    function colorFor(ttl: number, max: number): string | undefined {
      render(<TtlRing ttlSeconds={ttl} maxSeconds={max} showLabel />)
      const label = screen.getByText(
        (_, node) =>
          node instanceof HTMLElement && node.tagName === 'SPAN' && node.style.color !== '',
      )
      return label.style.color
    }

    it('uses green above the healthy fraction (fraction > 0.5)', () => {
      /*
       * Scenario: plenty of TTL left (80% of max).
       * Rule it protects: a remaining fraction above 0.5 resolves to the green band.
       */
      expect(colorFor(80, 100)).toBe('rgb(34, 197, 94)')
    })

    it('uses amber in the warn band (0.2 < fraction ≤ 0.5)', () => {
      /*
       * Scenario: TTL draining (30% of max).
       * Rule it protects: a fraction in (0.2, 0.5] resolves to the amber band.
       */
      expect(colorFor(30, 100)).toBe('rgb(245, 158, 11)')
    })

    it('uses amber exactly at the healthy boundary (fraction === 0.5)', () => {
      /*
       * Scenario: TTL sits exactly on the healthy/warn boundary (50% of max).
       * Rule it protects: the healthy test is a strict `>` — at fraction 0.5 the arc
       * is amber, not green (pins the boundary against `>=`).
       */
      expect(colorFor(50, 100)).toBe('rgb(245, 158, 11)')
    })

    it('uses red at or below the critical band (fraction ≤ 0.2)', () => {
      /*
       * Scenario: TTL nearly gone (10% of max).
       * Rule it protects: a fraction at/below 0.2 resolves to the red band.
       */
      expect(colorFor(10, 100)).toBe('rgb(239, 68, 68)')
    })

    it('uses red exactly at the warn boundary (fraction === 0.2)', () => {
      /*
       * Scenario: TTL sits exactly on the warn/critical boundary (20% of max).
       * Rule it protects: the warn test is a strict `>` — at fraction 0.2 the arc is
       * red, not amber (pins the boundary against `>=`).
       */
      expect(colorFor(20, 100)).toBe('rgb(239, 68, 68)')
    })

    it('uses the brand color for a persisted ring', () => {
      /*
       * Scenario: a persisted key's label.
       * Rule it protects: the persisted branch colors the label brand orange.
       */
      expect(colorFor(-1, 100)).toBe('rgb(255, 98, 36)')
    })

    it('uses the faint absent color for an absent TTL', () => {
      /*
       * Scenario: an absent key's label.
       * Rule it protects: the absent branch colors the label the faint white wash.
       */
      expect(colorFor(-2, 100)).toBe('rgba(255, 255, 255, 0.25)')
    })
  })

  describe('countdown ticker', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    it('decrements the displayed TTL once per second when countdown is on', () => {
      /*
       * Scenario: a live countdown ring at 5s.
       * Rule it protects: with `countdown`, the label ticks down once per second.
       */
      render(<TtlRing ttlSeconds={5} countdown showLabel />)
      expect(screen.getByText('00:05')).toBeInTheDocument()
      act(() => {
        vi.advanceTimersByTime(2_000)
      })
      expect(screen.getByText('00:03')).toBeInTheDocument()
    })

    it('never decrements below zero', () => {
      /*
       * Scenario: the ticker runs past the remaining seconds.
       * Rule it protects: the countdown floors at `00:00`, never going negative.
       */
      render(<TtlRing ttlSeconds={1} countdown showLabel />)
      act(() => {
        vi.advanceTimersByTime(5_000)
      })
      expect(screen.getByText('00:00')).toBeInTheDocument()
    })

    it('does not start a ticker for an absent TTL even when countdown is on', () => {
      /*
       * Scenario: countdown requested but the key has no TTL (`ttlSeconds < 0`).
       * Rule it protects: the guard skips the interval for negative TTLs — the label
       * stays `—` after time advances.
       */
      render(<TtlRing ttlSeconds={-2} countdown showLabel />)
      act(() => {
        vi.advanceTimersByTime(3_000)
      })
      expect(screen.getByText('—')).toBeInTheDocument()
    })

    it('does not tick when countdown is off, even for a positive TTL', () => {
      /*
       * Scenario: a positive TTL rendered without `countdown` (the static table-cell
       * variant).
       * Rule it protects: the `!countdown` guard suppresses the interval entirely — the
       * label holds at its initial value as time advances (pins the guard against being
       * dropped or flipped to AND).
       */
      render(<TtlRing ttlSeconds={20} showLabel />)
      expect(screen.getByText('00:20')).toBeInTheDocument()
      act(() => {
        vi.advanceTimersByTime(5_000)
      })
      expect(screen.getByText('00:20')).toBeInTheDocument()
    })

    it('clears the prior interval when the source TTL prop changes mid-countdown', () => {
      /*
       * Scenario: a live countdown whose source TTL is extended (prop change) while
       * ticking.
       * Rule it protects: the effect cleanup clears the previous interval before the
       * resynced effect starts a fresh one. Without cleanup, two overlapping intervals
       * would decrement twice per second; here a single 1s advance after the prop reset
       * to 30 must yield exactly `00:29`, not `00:28`.
       */
      const { rerender } = render(<TtlRing ttlSeconds={10} countdown showLabel />)
      act(() => {
        vi.advanceTimersByTime(2_000)
      })
      expect(screen.getByText('00:08')).toBeInTheDocument()
      rerender(<TtlRing ttlSeconds={30} countdown showLabel />)
      act(() => {
        vi.advanceTimersByTime(1_000)
      })
      expect(screen.getByText('00:29')).toBeInTheDocument()
    })

    it('re-subscribes the ticker when the TTL prop crosses from absent to positive', () => {
      /*
       * Scenario: the ring first mounts with an absent TTL (no ticker), then the key
       * gains a positive TTL via a prop change.
       * Rule it protects: the effect's dependency array re-runs the subscription on the
       * new `ttlSeconds`, so a ticker now starts. With an empty deps array the effect
       * would never re-run and the label would stay frozen — here the label must tick
       * from `00:09` down to `00:07` after two seconds.
       */
      const { rerender } = render(<TtlRing ttlSeconds={-2} countdown showLabel />)
      expect(screen.getByText('—')).toBeInTheDocument()
      rerender(<TtlRing ttlSeconds={9} countdown showLabel />)
      expect(screen.getByText('00:09')).toBeInTheDocument()
      act(() => {
        vi.advanceTimersByTime(2_000)
      })
      expect(screen.getByText('00:07')).toBeInTheDocument()
    })

    it('resyncs the displayed TTL when the source prop changes', () => {
      /*
       * Scenario: a refetch/persist/extend changes the source TTL prop.
       * Rule it protects: the resync effect resets `remaining` to the new prop value.
       */
      const { rerender } = render(<TtlRing ttlSeconds={10} showLabel />)
      expect(screen.getByText('00:10')).toBeInTheDocument()
      rerender(<TtlRing ttlSeconds={42} showLabel />)
      expect(screen.getByText('00:42')).toBeInTheDocument()
    })
  })

  describe('SVG geometry', () => {
    // Fixed dimensions chosen so the derived geometry is exact and non-degenerate:
    // radius = (40 - 4) / 2 = 18; circumference = 2π·18; center = 40 / 2 = 20.
    const SIZE = 40
    const STROKE = 4
    const RADIUS = (SIZE - STROKE) / 2
    const CIRCUMFERENCE = 2 * Math.PI * RADIUS
    const CENTER = SIZE / 2

    it('sizes the viewBox to the requested diameter', () => {
      /*
       * Scenario: an explicitly sized ring.
       * Rule it protects: the viewBox spans `0 0 size size` so the coordinate space
       * matches the diameter (guards the viewBox template against being blanked).
       */
      render(<TtlRing ttlSeconds={-1} size={SIZE} strokeWidth={STROKE} />)
      expect(screen.getByRole('img')).toHaveAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`)
    })

    it('centers both circles at size/2 and sets the radius from (size - strokeWidth)/2', () => {
      /*
       * Scenario: a persisted ring (both the track and the foreground arc are drawn).
       * Rule it protects: every circle is centered at `size/2` and uses the
       * `(size - strokeWidth)/2` radius — pins the center/radius arithmetic (a `*`
       * for `/`, or `+` for `-`, would move the center or balloon the radius).
       */
      render(<TtlRing ttlSeconds={-1} size={SIZE} strokeWidth={STROKE} />)
      const { background, foreground } = ringCircles(screen.getByRole('img'))
      for (const circle of [background, foreground]) {
        expect(circle).toBeDefined()
        expect(Number(circle!.getAttribute('cx'))).toBeCloseTo(CENTER, 6)
        expect(Number(circle!.getAttribute('cy'))).toBeCloseTo(CENTER, 6)
        expect(Number(circle!.getAttribute('r'))).toBeCloseTo(RADIUS, 6)
      }
    })

    it('sets the arc dash array to the full circumference', () => {
      /*
       * Scenario: a persisted ring's foreground arc.
       * Rule it protects: `strokeDasharray` equals `2π·radius` so the dash spans the
       * whole circle (pins the circumference arithmetic against `/` swaps).
       */
      render(<TtlRing ttlSeconds={-1} size={SIZE} strokeWidth={STROKE} />)
      const { foreground } = ringCircles(screen.getByRole('img'))
      expect(Number(foreground!.getAttribute('stroke-dasharray'))).toBeCloseTo(CIRCUMFERENCE, 4)
    })

    it('rotates the foreground arc -90° about the circle center', () => {
      /*
       * Scenario: a persisted ring's foreground arc.
       * Rule it protects: the arc is rotated `-90 cx cy` so it starts at twelve
       * o'clock about `size/2` (pins the transform template and its center math).
       */
      render(<TtlRing ttlSeconds={-1} size={SIZE} strokeWidth={STROKE} />)
      const { foreground } = ringCircles(screen.getByRole('img'))
      expect(foreground!.getAttribute('transform')).toBe(`rotate(-90 ${CENTER} ${CENTER})`)
    })

    it('offsets the dash by circumference·(1 - fraction) for a half-drained ring', () => {
      /*
       * Scenario: a positive TTL sitting at exactly half of its max (fraction 0.5).
       * Rule it protects: `strokeDashoffset` is `circumference * (1 - fraction)` — at
       * half it is half the circumference (pins both the `*` and the `1 - fraction`
       * subtraction; a `/` or `1 + fraction` would offset by a different amount).
       */
      render(<TtlRing ttlSeconds={150} maxSeconds={300} size={SIZE} strokeWidth={STROKE} />)
      const { foreground } = ringCircles(screen.getByRole('img'))
      expect(Number(foreground!.getAttribute('stroke-dashoffset'))).toBeCloseTo(
        CIRCUMFERENCE * (1 - 0.5),
        4,
      )
    })
  })
})
