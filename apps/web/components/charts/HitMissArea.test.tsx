/**
 * @fileoverview Unit tests for `HitMissArea` — the brushable stacked hit/miss area.
 * Drives the empty branch (no data → empty state, no summary), the populated
 * summary, and the brush callback's `fractionToPreset` mapping across all three
 * preset bands plus its early-return guards (no callback, defaulted brush indices).
 *
 * The recharts `Brush` is replaced with a tiny stub that surfaces buttons wired to
 * the real `onChange` handler `HitMissArea` passes it. This lets the test invoke
 * `handleBrush` with exact `{ startIndex, endIndex }` payloads — a deterministic
 * substitute for a pointer-drag that jsdom cannot reliably simulate. The rest of
 * recharts is left intact (the chart still mounts via the stubbed ResponsiveContainer
 * the global setup sizes).
 *
 * @module components/charts/HitMissArea.test
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HitMissArea } from './HitMissArea'
import { type HitMissPoint } from './types'
import { RANGE_PRESETS } from '@/lib/filters'

interface BrushStubProps {
  onChange?: (range: { startIndex?: number; endIndex?: number }) => void
}

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>()
  return {
    ...actual,
    // Expose the real `onChange` through buttons so the test drives `handleBrush`
    // with exact span indices instead of an unreliable jsdom pointer-drag.
    Brush: ({ onChange }: BrushStubProps) => (
      <>
        <button
          type="button"
          data-testid="brush-narrow"
          onClick={() => onChange?.({ startIndex: 0, endIndex: 3 })}
        />
        <button
          type="button"
          data-testid="brush-medium"
          onClick={() => onChange?.({ startIndex: 0, endIndex: 5 })}
        />
        <button type="button" data-testid="brush-default" onClick={() => onChange?.({})} />
        <button
          type="button"
          data-testid="brush-offset"
          onClick={() => onChange?.({ startIndex: 6 })}
        />
      </>
    ),
  }
})

/** Build a hit/miss series of `n` evenly-spaced buckets. */
function series(n: number): HitMissPoint[] {
  return Array.from({ length: n }, (_, i) => ({ t: i * 1_000, hit: i + 1, miss: i }))
}

describe('HitMissArea', () => {
  it('renders the empty state and no summary when the series is empty', () => {
    /*
     * Scenario: no buckets accumulated yet.
     * Rule it protects: `data.length === 0` flips the frame empty and `data.at(-1)`
     * is undefined, so the `latest ? … : undefined` summary branch yields nothing.
     */
    render(<HitMissArea data={[]} />)
    expect(screen.getByText('No data yet.')).toBeInTheDocument()
    expect(screen.queryByText(/Latest bucket/)).not.toBeInTheDocument()
  })

  it('summarizes the latest bucket across all buckets when populated', () => {
    /*
     * Scenario: a populated three-bucket series.
     * Rule it protects: the `latest` branch reports the newest bucket's hits/misses
     * and the bucket count in the accessible summary.
     */
    render(<HitMissArea data={series(3)} />)
    expect(
      screen.getByText('Latest bucket: 3 hits, 2 misses across 3 buckets.'),
    ).toBeInTheDocument()
  })

  it('renders the loading skeleton when loading', () => {
    /*
     * Scenario: the first metrics snapshot is loading.
     * Rule it protects: `isLoading` forwards to the frame's skeleton branch, so the
     * empty-state copy never shows even though the non-visual summary still ships.
     */
    render(<HitMissArea data={series(3)} isLoading />)
    expect(screen.queryByText('No data yet.')).not.toBeInTheDocument()
    expect(
      screen.getByText('Latest bucket: 3 hits, 2 misses across 3 buckets.'),
    ).toBeInTheDocument()
  })

  it('maps a narrow brush span to the shortest preset', async () => {
    /*
     * Scenario: the user drags a brush covering ≤ 40% of the window.
     * Rule it protects: `fractionToPreset` snaps a narrow span to RANGE_PRESETS[0].
     * Buckets 0..3 of 10 → fraction 0.4 → narrow band.
     */
    const user = userEvent.setup()
    const onBrushRange = vi.fn()
    render(<HitMissArea data={series(10)} onBrushRange={onBrushRange} />)
    await user.click(screen.getByTestId('brush-narrow'))
    expect(onBrushRange).toHaveBeenCalledWith(RANGE_PRESETS[0])
  })

  it('maps a medium brush span to the middle preset', async () => {
    /*
     * Scenario: the user drags a brush covering > 40% and ≤ 75% of the window.
     * Rule it protects: `fractionToPreset` snaps a medium span to RANGE_PRESETS[1].
     * Buckets 0..5 of 10 → fraction 0.6 → medium band.
     */
    const user = userEvent.setup()
    const onBrushRange = vi.fn()
    render(<HitMissArea data={series(10)} onBrushRange={onBrushRange} />)
    await user.click(screen.getByTestId('brush-medium'))
    expect(onBrushRange).toHaveBeenCalledWith(RANGE_PRESETS[1])
  })

  it('keeps a span at exactly the medium fraction on the middle preset', async () => {
    /*
     * Scenario: the brushed span lands exactly on the medium upper bound (0.75).
     * Rule it protects: `fractionToPreset` uses an inclusive `fraction <= MEDIUM…`,
     * so 0.75 stays on RANGE_PRESETS[1]. Buckets 0..5 of 8 → 6/8 = 0.75. Tightening
     * `<=` to `<` (L52 EqualityOperator) would push this boundary case to the longest
     * preset; asserting the middle preset at the boundary kills that mutant.
     */
    const user = userEvent.setup()
    const onBrushRange = vi.fn()
    render(<HitMissArea data={series(8)} onBrushRange={onBrushRange} />)
    await user.click(screen.getByTestId('brush-medium'))
    expect(onBrushRange).toHaveBeenCalledWith(RANGE_PRESETS[1])
  })

  it('honors a non-zero brush start and the defaulted end together', async () => {
    /*
     * Scenario: the brush emits only a start index (6) on a 10-bucket series, leaving
     * the end index to default to the last bucket.
     * Rule it protects: the span math `(end - start + 1) / data.length`. Buckets 6..9
     * of 10 → (9 - 6 + 1)/10 = 0.4 → narrowest preset. This exact arithmetic pins three
     * mutants at once: the start fallback (`startIndex ?? 0`, L70 — `&& 0` would zero the
     * start to a full-window span), the end fallback (`data.length - 1`, L71 — `+ 1`
     * would overshoot the window), and the span subtraction (`end - start`, L72 — `end +
     * start` would balloon the fraction). Each mutation maps 6..9 to a different preset.
     */
    const user = userEvent.setup()
    const onBrushRange = vi.fn()
    render(<HitMissArea data={series(10)} onBrushRange={onBrushRange} />)
    await user.click(screen.getByTestId('brush-offset'))
    expect(onBrushRange).toHaveBeenCalledWith(RANGE_PRESETS[0])
  })

  it('maps a wide/default brush span to the longest preset and defaults missing indices', async () => {
    /*
     * Scenario: the brush emits a change with no explicit indices (full window).
     * Rule it protects: the `?? 0` / `?? data.length - 1` defaults span the whole
     * series → fraction 1.0 → RANGE_PRESETS[2].
     */
    const user = userEvent.setup()
    const onBrushRange = vi.fn()
    render(<HitMissArea data={series(10)} onBrushRange={onBrushRange} />)
    await user.click(screen.getByTestId('brush-default'))
    expect(onBrushRange).toHaveBeenCalledWith(RANGE_PRESETS[2])
  })

  it('ignores the brush when no callback is supplied', async () => {
    /*
     * Scenario: a read-only chart without an `onBrushRange` binding.
     * Rule it protects: `handleBrush` returns early when `onBrushRange` is undefined —
     * the guard runs without throwing and writes nothing back.
     */
    const user = userEvent.setup()
    render(<HitMissArea data={series(10)} />)
    await user.click(screen.getByTestId('brush-narrow'))
    expect(screen.getByText(/Latest bucket/)).toBeInTheDocument()
  })
})
