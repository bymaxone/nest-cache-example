/**
 * @fileoverview Unit tests for `HitRateGauge` — the radial hit-rate gauge with a
 * threshold verdict. Drives every `verdictFor` band (healthy > 90%, degraded
 * 50–90%, poor < 50%), the input clamp (out-of-range and non-finite values), the
 * loading skeleton (which also hides the verdict), and the rendered percentage.
 *
 * @module components/charts/HitRateGauge.test
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HitRateGauge } from './HitRateGauge'

describe('HitRateGauge', () => {
  it('reads Healthy above the 90% threshold with the green band color', () => {
    /*
     * Scenario: a hit rate of 95%.
     * Rule it protects: `verdictFor` returns the Healthy verdict (> 0.9), the gauge
     * shows the exact percentage, and both the percentage and the verdict label carry
     * the green band color. jsdom normalizes `#22c55e` to `rgb(34, 197, 94)`. The color
     * assertions pin the Healthy color literal (L47), the percentage span's style object
     * (L95) and the verdict span's style object (L104).
     */
    render(<HitRateGauge value={0.95} />)
    expect(screen.getByText('Healthy')).toBeInTheDocument()
    expect(screen.getByText('95.0%')).toBeInTheDocument()
    expect(screen.getByText('95.0%').style.color).toBe('rgb(34, 197, 94)')
    expect(screen.getByText('Healthy').style.color).toBe('rgb(34, 197, 94)')
  })

  it('switches to Degraded exactly at the 90% upper bound', () => {
    /*
     * Scenario: a hit rate of exactly 90% — the upper boundary of the amber band.
     * Rule it protects: the verdict uses a strict `ratio > HEALTHY_THRESHOLD`, so 0.9
     * is Degraded (amber), not Healthy. Relaxing `>` to `>=` (L47 EqualityOperator)
     * would flip this case to Healthy/green; asserting Degraded and the amber color
     * (`#f59e0b` → `rgb(245, 158, 11)`) at the boundary kills that mutant.
     */
    render(<HitRateGauge value={0.9} />)
    expect(screen.getByText('Degraded')).toBeInTheDocument()
    expect(screen.queryByText('Healthy')).not.toBeInTheDocument()
    expect(screen.getByText('90.0%').style.color).toBe('rgb(245, 158, 11)')
  })

  it('reads Degraded between the 50% and 90% thresholds with the amber band color', () => {
    /*
     * Scenario: a hit rate of exactly 50%.
     * Rule it protects: the `>= DEGRADED_THRESHOLD` boundary lands on Degraded (not
     * Poor) — the amber middle band. The amber color (`#f59e0b` → `rgb(245, 158, 11)`)
     * on the percentage and verdict spans pins the Degraded color literal (L49) and the
     * two style objects (L95, L104).
     */
    render(<HitRateGauge value={0.5} />)
    expect(screen.getByText('Degraded')).toBeInTheDocument()
    expect(screen.getByText('50.0%')).toBeInTheDocument()
    expect(screen.getByText('50.0%').style.color).toBe('rgb(245, 158, 11)')
    expect(screen.getByText('Degraded').style.color).toBe('rgb(245, 158, 11)')
  })

  it('reads Poor below the 50% threshold with the red band color', () => {
    /*
     * Scenario: a hit rate of 20%.
     * Rule it protects: the fall-through Poor branch (< 0.5) renders the red verdict.
     * The red color (`#ef4444` → `rgb(239, 68, 68)`) on the percentage and verdict spans
     * pins the Poor color literal (L50) and the two style objects (L95, L104).
     */
    render(<HitRateGauge value={0.2} />)
    expect(screen.getByText('Poor')).toBeInTheDocument()
    expect(screen.getByText('20.0%')).toBeInTheDocument()
    expect(screen.getByText('20.0%').style.color).toBe('rgb(239, 68, 68)')
    expect(screen.getByText('Poor').style.color).toBe('rgb(239, 68, 68)')
  })

  it('clamps an over-range ratio to 100%', () => {
    /*
     * Scenario: an upstream bug feeds a ratio above 1.
     * Rule it protects: `Math.min(1, value)` clamps the gauge to 100% and Healthy.
     */
    render(<HitRateGauge value={1.5} />)
    expect(screen.getByText('100.0%')).toBeInTheDocument()
    expect(screen.getByText('Healthy')).toBeInTheDocument()
  })

  it('coerces a non-finite ratio to 0% and a Poor verdict', () => {
    /*
     * Scenario: a NaN ratio (e.g. 0/0 with no requests).
     * Rule it protects: the `Number.isFinite(value) ? … : 0` guard renders 0% rather
     * than `NaN%`, landing on the Poor band.
     */
    render(<HitRateGauge value={Number.NaN} />)
    expect(screen.getByText('0.0%')).toBeInTheDocument()
    expect(screen.getByText('Poor')).toBeInTheDocument()
  })

  it('renders a skeleton and hides the verdict while loading', () => {
    /*
     * Scenario: the metrics snapshot is loading.
     * Rule it protects: `isLoading` swaps the gauge for a skeleton and the
     * `!isLoading ? verdict : null` branch hides the verdict label and percentage.
     */
    render(<HitRateGauge value={0.95} isLoading />)
    expect(screen.queryByText('Healthy')).not.toBeInTheDocument()
    expect(screen.queryByText('95.0%')).not.toBeInTheDocument()
    expect(screen.getByText('Hit rate')).toBeInTheDocument()
  })
})
