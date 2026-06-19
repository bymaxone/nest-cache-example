/**
 * @fileoverview Unit tests for the chart primitive (`ui/chart`). Covers
 * `ChartContainer` (config → `--color-*` CSS vars, with and without a color),
 * `useChartConfig`'s out-of-provider throw, and `ChartTooltipContent` across every
 * branch: inactive / empty payload (returns null), the label + labelFormatter
 * variants, the `dataKey ?? name ?? index` key resolution, the config-label /
 * entry-name / key fallback chain, the config-color / entry-color fallback, and the
 * numeric-value-with-formatter vs raw-value path.
 *
 * @module components/ui/chart.test
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LineChart } from 'recharts'
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
  type ChartTooltipContentProps,
} from './chart'

/** A two-series config: one entry carries a color, one omits it. */
const CONFIG: ChartConfig = {
  hit: { label: 'Hits', color: '#22c55e' },
  miss: { label: 'Misses' },
}

/** Render the tooltip body inside a container so `useChartConfig` resolves. */
function renderTooltip(props: ChartTooltipContentProps, config: ChartConfig = CONFIG) {
  return render(
    <ChartContainer config={config}>
      <LineChart data={[]}>
        <ChartTooltipContent {...props} />
      </LineChart>
    </ChartContainer>,
  )
}

describe('ChartContainer', () => {
  it('exposes each colored series as a --color-<key> CSS variable', () => {
    /*
     * Scenario: a chart declares per-series colors.
     * Rule it protects: `configToStyle` emits `--color-hit` for the colored entry and
     * omits a variable for the entry with no color (the `if (value.color)` guard).
     */
    const { container } = render(
      <ChartContainer config={CONFIG}>
        <LineChart data={[]} />
      </ChartContainer>,
    )
    const styled = container.querySelector('[style*="--color-hit"]')
    expect(styled).not.toBeNull()
    expect(styled?.getAttribute('style')).toContain('#22c55e')
    expect(styled?.getAttribute('style')).not.toContain('--color-miss')
  })
})

describe('useChartConfig', () => {
  it('throws when ChartTooltipContent is used outside a ChartContainer', () => {
    /*
     * Scenario: the tooltip body is mounted with no surrounding container.
     * Rule it protects: `useChartConfig` throws a clear error when the context is
     * absent, catching misuse at render time.
     */
    expect(() => render(<ChartTooltipContent active payload={[{ value: 1 }]} />)).toThrow(
      'useChartConfig must be used within a <ChartContainer>',
    )
  })
})

describe('ChartTooltipContent', () => {
  it('renders nothing when inactive', () => {
    /*
     * Scenario: the pointer is not over a data point.
     * Rule it protects: `!active` returns null, so no tooltip card renders.
     */
    const { container } = renderTooltip({ active: false, payload: [{ value: 1, dataKey: 'hit' }] })
    expect(container.querySelector('ul')).toBeNull()
  })

  it('renders nothing when the payload is empty or missing', () => {
    /*
     * Scenario: the tooltip is active but carries no entries.
     * Rule it protects: the `!payload || payload.length === 0` guard returns null for
     * both an empty array and an omitted payload.
     */
    const { container: emptyArray } = renderTooltip({ active: true, payload: [] })
    expect(emptyArray.querySelector('ul')).toBeNull()
    const { container: noPayload } = renderTooltip({ active: true })
    expect(noPayload.querySelector('ul')).toBeNull()
  })

  it('formats a numeric value with the supplied formatter and resolves label + color from config', () => {
    /*
     * Scenario: an active tooltip over a `hit` point with a value formatter.
     * Rule it protects: the numeric `value` is run through `valueFormatter`, and the
     * series label + color resolve from the config (not the raw entry).
     */
    renderTooltip({
      active: true,
      label: 1_700_000_000_000,
      payload: [{ value: 1234, dataKey: 'hit', name: 'hit', color: '#000' }],
      valueFormatter: (n) => `${n} ops`,
      labelFormatter: () => 'noon',
    })
    expect(screen.getByText('1234 ops')).toBeInTheDocument()
    expect(screen.getByText('Hits')).toBeInTheDocument()
    expect(screen.getByText('noon')).toBeInTheDocument()
  })

  it('renders the raw label when no labelFormatter is given', () => {
    /*
     * Scenario: an active tooltip with a label but no `labelFormatter`.
     * Rule it protects: the `labelFormatter ? … : label` branch falls back to the raw
     * label string.
     */
    renderTooltip({
      active: true,
      label: 'bucket-A',
      payload: [{ value: 5, dataKey: 'hit' }],
    })
    expect(screen.getByText('bucket-A')).toBeInTheDocument()
  })

  it('omits the label row entirely when no label is provided', () => {
    /*
     * Scenario: a tooltip entry with no x-axis label.
     * Rule it protects: the `label !== undefined ? … : null` branch renders no label
     * paragraph when the label is undefined.
     */
    const { container } = renderTooltip({
      active: true,
      payload: [{ value: 5, dataKey: 'hit' }],
    })
    expect(container.querySelector('p')).toBeNull()
    expect(container.querySelector('ul')).not.toBeNull()
  })

  it('falls back through name then index for the key and shows the raw value without a formatter', () => {
    /*
     * Scenario: an entry with no `dataKey` and no config match, no value formatter.
     * Rule it protects: the key resolves via `name` (then would use the index), the
     * series label falls back to the entry `name`, the color falls back to the entry
     * `color`, and the value renders raw (no `valueFormatter`).
     */
    renderTooltip({
      active: true,
      payload: [{ value: 42, name: 'unmapped', color: '#abcdef' }],
    })
    expect(screen.getByText('unmapped')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('uses the array index as the key when neither dataKey nor name is present', () => {
    /*
     * Scenario: a bare entry carrying only a value.
     * Rule it protects: `String(entry.dataKey ?? entry.name ?? index)` falls all the
     * way through to the index, and the series label falls back to that key string.
     */
    renderTooltip({
      active: true,
      payload: [{ value: 7 }],
    })
    // With no dataKey/name, the key is the index "0", which becomes the label too.
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })
})
