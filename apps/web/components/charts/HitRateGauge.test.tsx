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
  it('reads Healthy above the 90% threshold', () => {
    /*
     * Scenario: a hit rate of 95%.
     * Rule it protects: `verdictFor` returns the Healthy verdict (> 0.9) and the gauge
     * shows the exact percentage beside it.
     */
    render(<HitRateGauge value={0.95} />)
    expect(screen.getByText('Healthy')).toBeInTheDocument()
    expect(screen.getByText('95.0%')).toBeInTheDocument()
  })

  it('reads Degraded between the 50% and 90% thresholds (inclusive lower bound)', () => {
    /*
     * Scenario: a hit rate of exactly 50%.
     * Rule it protects: the `>= DEGRADED_THRESHOLD` boundary lands on Degraded (not
     * Poor) — the amber middle band.
     */
    render(<HitRateGauge value={0.5} />)
    expect(screen.getByText('Degraded')).toBeInTheDocument()
    expect(screen.getByText('50.0%')).toBeInTheDocument()
  })

  it('reads Poor below the 50% threshold', () => {
    /*
     * Scenario: a hit rate of 20%.
     * Rule it protects: the fall-through Poor branch (< 0.5) renders the red verdict.
     */
    render(<HitRateGauge value={0.2} />)
    expect(screen.getByText('Poor')).toBeInTheDocument()
    expect(screen.getByText('20.0%')).toBeInTheDocument()
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
