/**
 * @fileoverview Unit tests for `OpsStream` — the pausable, streaming ops/sec area.
 * Drives the empty branch (no data → empty state, no summary), the populated
 * summary, the loading flag, and the pause/resume toggle including the frozen
 * snapshot behaviour: pausing freezes the rendered series so later prop updates do
 * not change the summary until resumed.
 *
 * @module components/charts/OpsStream.test
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OpsStream } from './OpsStream'
import { type OpsPoint } from './types'

/** A single-bucket ops series with the given per-command counts. */
function bucket(get: number, set: number, del: number): OpsPoint[] {
  return [{ t: 1_000, get, set, del }]
}

describe('OpsStream', () => {
  it('renders the empty state and no summary when there is no data', () => {
    /*
     * Scenario: no ops buckets accumulated yet.
     * Rule it protects: `rendered.length === 0` flips the frame empty and the
     * `latest ? … : undefined` summary branch yields nothing.
     */
    render(<OpsStream data={[]} />)
    expect(screen.getByText('No data yet.')).toBeInTheDocument()
    expect(screen.queryByText(/Latest ops\/sec/)).not.toBeInTheDocument()
  })

  it('summarizes the latest bucket per command when populated', () => {
    /*
     * Scenario: a populated single-bucket series.
     * Rule it protects: the `latest` branch reports GET/SET/DEL ops/sec in the
     * accessible summary.
     */
    render(<OpsStream data={bucket(12, 5, 1)} />)
    expect(screen.getByText('Latest ops/sec — GET 12, SET 5, DEL 1.')).toBeInTheDocument()
  })

  it('renders the loading skeleton when loading', () => {
    /*
     * Scenario: the first ops snapshot is still loading.
     * Rule it protects: `isLoading` forwards to the frame's skeleton branch, so the
     * empty-state copy never shows even though the non-visual summary still ships.
     */
    render(<OpsStream data={bucket(1, 1, 1)} isLoading />)
    expect(screen.queryByText('No data yet.')).not.toBeInTheDocument()
    expect(screen.getByText('Latest ops/sec — GET 1, SET 1, DEL 1.')).toBeInTheDocument()
  })

  it('defaults to running, showing a Pause control', () => {
    /*
     * Scenario: the stream is live on mount.
     * Rule it protects: `isPaused` starts false, so the control reads "Pause" and is
     * not pressed.
     */
    render(<OpsStream data={bucket(1, 1, 1)} />)
    const toggle = screen.getByRole('button', { name: 'Pause' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })

  it('freezes the rendered snapshot on pause and thaws on resume', async () => {
    /*
     * Scenario: the user pauses, the underlying series then updates, then resumes.
     * Rule it protects: pausing snapshots `[...data]` into `frozen` and renders it, so
     * a subsequent prop change does not move the summary until resume swaps back to
     * the live `data`.
     */
    const user = userEvent.setup()
    const { rerender } = render(<OpsStream data={bucket(12, 5, 1)} />)

    await user.click(screen.getByRole('button', { name: 'Pause' }))
    const resume = screen.getByRole('button', { name: 'Resume' })
    expect(resume).toHaveAttribute('aria-pressed', 'true')

    // The live data advances while paused — the frozen snapshot must not follow it.
    rerender(<OpsStream data={bucket(99, 88, 77)} />)
    expect(screen.getByText('Latest ops/sec — GET 12, SET 5, DEL 1.')).toBeInTheDocument()

    // Resuming swaps back to the live series.
    await user.click(screen.getByRole('button', { name: 'Resume' }))
    expect(screen.getByText('Latest ops/sec — GET 99, SET 88, DEL 77.')).toBeInTheDocument()
  })
})
