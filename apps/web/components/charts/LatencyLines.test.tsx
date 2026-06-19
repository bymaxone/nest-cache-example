/**
 * @fileoverview Unit tests for `LatencyLines` — the p50/p95/p99 latency lines.
 * Drives the empty branch (no data → empty state, no summary), the populated
 * summary with µs precision, and the loading flag.
 *
 * @module components/charts/LatencyLines.test
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LatencyLines } from './LatencyLines'
import { type LatencyPoint } from './types'

/** Build a latency series of `n` buckets with the given last-bucket percentiles. */
function series(points: LatencyPoint[]): LatencyPoint[] {
  return points
}

describe('LatencyLines', () => {
  it('renders the empty state and no summary when the series is empty', () => {
    /*
     * Scenario: no ping samples accumulated yet.
     * Rule it protects: `data.length === 0` flips the frame empty and the
     * `latest ? … : undefined` summary branch yields nothing.
     */
    render(<LatencyLines data={[]} />)
    expect(screen.getByText('No data yet.')).toBeInTheDocument()
    expect(screen.queryByText(/Latest latency/)).not.toBeInTheDocument()
  })

  it('summarizes the latest bucket with µs precision when populated', () => {
    /*
     * Scenario: a populated series whose newest bucket is sub-millisecond.
     * Rule it protects: the `latest` branch formats each percentile via
     * `formatLatencyMs`, keeping µs precision (never rounding to 0ms).
     */
    render(
      <LatencyLines
        data={series([
          { t: 0, p50: 0.1, p95: 0.5, p99: 1 },
          { t: 1_000, p50: 0.412, p95: 1.2, p99: 3.45 },
        ])}
      />,
    )
    expect(
      screen.getByText('Latest latency — p50 0.412ms, p95 1.20ms, p99 3.45ms.'),
    ).toBeInTheDocument()
  })

  it('renders the loading skeleton when loading', () => {
    /*
     * Scenario: the first percentile window is still loading.
     * Rule it protects: `isLoading` forwards to the frame's skeleton branch, so the
     * empty-state copy never shows even though the non-visual summary still ships.
     */
    render(<LatencyLines data={series([{ t: 0, p50: 1, p95: 2, p99: 3 }])} isLoading />)
    expect(screen.queryByText('No data yet.')).not.toBeInTheDocument()
    expect(
      screen.getByText('Latest latency — p50 1.00ms, p95 2.00ms, p99 3.00ms.'),
    ).toBeInTheDocument()
  })
})
