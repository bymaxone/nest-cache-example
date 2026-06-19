/**
 * @fileoverview Unit tests for `ChartFrame` — the shared glass-card shell. Drives
 * every render branch: the loading skeleton, the action-oriented empty state, the
 * default chart body, optional description / header-right / screen-reader summary
 * slots, and the default-vs-explicit `height` prop.
 *
 * @module components/charts/ChartFrame.test
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChartFrame } from './ChartFrame'

describe('ChartFrame', () => {
  it('renders the title plus its children when neither loading nor empty', () => {
    /*
     * Scenario: a populated panel in its resting state.
     * Rule it protects: with `isLoading` and `isEmpty` both false the frame renders
     * the chart body (children) and the title — the default happy path.
     */
    render(
      <ChartFrame title="Hit / miss">
        <div data-testid="chart-body">body</div>
      </ChartFrame>,
    )
    expect(screen.getByText('Hit / miss')).toBeInTheDocument()
    expect(screen.getByTestId('chart-body')).toBeInTheDocument()
  })

  it('renders the description when provided and omits it otherwise', () => {
    /*
     * Scenario: a panel with supporting copy vs one without.
     * Rule it protects: the `description ? … : null` branch — present copy renders,
     * an absent description leaves no paragraph behind.
     */
    const { rerender } = render(
      <ChartFrame title="Latency" description="Percentiles over time">
        <span>body</span>
      </ChartFrame>,
    )
    expect(screen.getByText('Percentiles over time')).toBeInTheDocument()

    rerender(
      <ChartFrame title="Latency">
        <span>body</span>
      </ChartFrame>,
    )
    expect(screen.queryByText('Percentiles over time')).not.toBeInTheDocument()
  })

  it('renders the header-right slot when provided', () => {
    /*
     * Scenario: a panel that exposes a header control (e.g. a pause toggle).
     * Rule it protects: the `headerRight` slot is rendered into the card header.
     */
    render(
      <ChartFrame title="Ops" headerRight={<button type="button">Pause</button>}>
        <span>body</span>
      </ChartFrame>,
    )
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })

  it('renders the skeleton (never the children) while loading', () => {
    /*
     * Scenario: the panel is fetching its first snapshot.
     * Rule it protects: DASHBOARD §2 principle 8 — a skeleton, not a spinner, and the
     * chart body is suppressed while `isLoading`.
     */
    render(
      <ChartFrame title="Loading" isLoading>
        <div data-testid="chart-body">body</div>
      </ChartFrame>,
    )
    expect(screen.queryByTestId('chart-body')).not.toBeInTheDocument()
  })

  it('renders the action-oriented empty state with a Playground link when empty', () => {
    /*
     * Scenario: the endpoint returned no data.
     * Rule it protects: principle 9 — the empty state is action-oriented, pointing the
     * user at the Playground to seed a key rather than showing a blank panel.
     */
    render(
      <ChartFrame title="Empty" isEmpty>
        <div data-testid="chart-body">body</div>
      </ChartFrame>,
    )
    expect(screen.queryByTestId('chart-body')).not.toBeInTheDocument()
    expect(screen.getByText('No data yet.')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /Seed a key from the Playground/ })
    expect(link).toHaveAttribute('href', '/playground')
  })

  it('renders the screen-reader summary when provided and omits it otherwise', () => {
    /*
     * Scenario: a panel ships a non-visual data summary vs one with none.
     * Rule it protects: the `srSummary ? … : null` branch — a provided summary renders
     * in an `sr-only` paragraph; an undefined summary renders nothing.
     */
    const { rerender } = render(
      <ChartFrame title="A11y" srSummary="Latest bucket: 10 hits.">
        <span>body</span>
      </ChartFrame>,
    )
    expect(screen.getByText('Latest bucket: 10 hits.')).toBeInTheDocument()

    rerender(
      <ChartFrame title="A11y">
        <span>body</span>
      </ChartFrame>,
    )
    expect(screen.queryByText('Latest bucket: 10 hits.')).not.toBeInTheDocument()
  })

  it('honors an explicit height and falls back to the default otherwise', () => {
    /*
     * Scenario: a panel sets a custom body height vs relying on the default.
     * Rule it protects: the `height` prop default (240) vs an explicit override both
     * reach the inline style on the body wrapper.
     */
    const { container, rerender } = render(
      <ChartFrame title="H" height={280}>
        <span>body</span>
      </ChartFrame>,
    )
    expect(container.querySelector('[style*="height: 280px"]')).not.toBeNull()

    rerender(
      <ChartFrame title="H">
        <span>body</span>
      </ChartFrame>,
    )
    expect(container.querySelector('[style*="height: 240px"]')).not.toBeNull()
  })
})
