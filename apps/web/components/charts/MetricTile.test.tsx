/**
 * @fileoverview Unit tests for `MetricTile` — the golden-signal KPI tile, including
 * its `DeltaBadge` sub-component. Drives every optional slot (icon, sparkline,
 * delta, status, footnote), the loading skeleton (which hides the value, delta, and
 * sparkline), the sparkline length guard (>1 point), and all three `DeltaBadge`
 * directions (up / down / flat).
 *
 * @module components/charts/MetricTile.test
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Activity } from 'lucide-react'
import { MetricTile } from './MetricTile'
import { hitMissMeta } from '@/lib/cache-status'

describe('MetricTile', () => {
  it('renders the bare label + value when no optional slots are given', () => {
    /*
     * Scenario: a minimal tile (label + value only).
     * Rule it protects: with icon/sparkline/delta/status/footnote all absent, only the
     * mono value renders and every optional `?` branch resolves to null.
     */
    render(<MetricTile label="Throughput" value="120 op/s" />)
    expect(screen.getByText('Throughput')).toBeInTheDocument()
    expect(screen.getByText('120 op/s')).toBeInTheDocument()
  })

  it('renders the footnote, status, and leading icon when provided', () => {
    /*
     * Scenario: a fully-decorated tile.
     * Rule it protects: the icon, status (color + icon + text), and footnote `?`
     * branches all render their content.
     */
    render(
      <MetricTile
        label="Latency"
        value="0.4ms"
        icon={Activity}
        status={hitMissMeta('hit')}
        footnote="ping-sampled"
      />,
    )
    expect(screen.getByText('Hit')).toBeInTheDocument()
    expect(screen.getByText('ping-sampled')).toBeInTheDocument()
  })

  it('renders the sparkline only when it has more than one point', () => {
    /*
     * Scenario: a multi-point sparkline vs a single-point one.
     * Rule it protects: the `sparkData.length > 1` guard — a 2-point series renders the
     * mini area; a 1-point series does not (a chart needs at least two points).
     */
    const { container, rerender } = render(
      <MetricTile label="Keys" value="5" sparkline={[1, 2, 3]} />,
    )
    expect(container.querySelector('.recharts-responsive-container')).not.toBeNull()

    rerender(<MetricTile label="Keys" value="5" sparkline={[1]} />)
    expect(container.querySelector('.recharts-responsive-container')).toBeNull()
  })

  it('defaults the sparkline to an empty array when omitted', () => {
    /*
     * Scenario: a tile with no sparkline prop.
     * Rule it protects: the `sparkline?.map(…) ?? []` nullish fallback yields an empty
     * series, so the length guard never tries to chart undefined.
     */
    const { container } = render(<MetricTile label="Keys" value="5" />)
    expect(container.querySelector('.recharts-responsive-container')).toBeNull()
  })

  it('renders an upward delta badge with a positive sign', () => {
    /*
     * Scenario: the metric rose versus the previous window.
     * Rule it protects: `DeltaBadge` with `delta > 0` shows the up arrow and a
     * `+`-signed value (success color).
     */
    render(<MetricTile label="Keys" value="5" delta={18} />)
    expect(screen.getByText('+18')).toBeInTheDocument()
  })

  it('renders a downward delta badge with a negative value', () => {
    /*
     * Scenario: the metric fell versus the previous window.
     * Rule it protects: `DeltaBadge` with `delta < 0` shows the down arrow and the
     * signed value (danger color).
     */
    render(<MetricTile label="Keys" value="5" delta={-3} />)
    expect(screen.getByText('-3')).toBeInTheDocument()
  })

  it('renders a flat delta badge for a zero change', () => {
    /*
     * Scenario: the metric is unchanged.
     * Rule it protects: `DeltaBadge` with `delta === 0` takes the flat (muted) branch
     * and renders `0`.
     */
    render(<MetricTile label="Keys" value="5" delta={0} />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('hides the value, delta, and sparkline behind a skeleton while loading', () => {
    /*
     * Scenario: the first snapshot is still loading.
     * Rule it protects: `isLoading` swaps the value for a skeleton and suppresses both
     * the delta badge (`!isLoading`) and the sparkline (`!isLoading`).
     */
    const { container } = render(
      <MetricTile label="Keys" value="5" delta={18} sparkline={[1, 2, 3]} isLoading />,
    )
    expect(screen.queryByText('5')).not.toBeInTheDocument()
    expect(screen.queryByText('+18')).not.toBeInTheDocument()
    expect(container.querySelector('.recharts-responsive-container')).toBeNull()
  })
})
