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

    it('uses red at or below the critical band (fraction ≤ 0.2)', () => {
      /*
       * Scenario: TTL nearly gone (10% of max).
       * Rule it protects: a fraction at/below 0.2 resolves to the red band.
       */
      expect(colorFor(10, 100)).toBe('rgb(239, 68, 68)')
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
})
