/**
 * @fileoverview Unit tests for `ExpiryAnalysis` — the with-vs-without-TTL donut.
 * Drives the empty branch (both counts zero → no `srSummary`, empty state), the
 * populated branch (a screen-reader summary with counts + percentages), the
 * per-slice `value > 0` filter, and the loading flag.
 *
 * @module components/charts/ExpiryAnalysis.test
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ExpiryAnalysis } from './ExpiryAnalysis'

describe('ExpiryAnalysis', () => {
  it('renders the action-oriented empty state when both counts are zero', () => {
    /*
     * Scenario: no sampled keys at all (with + without TTL == 0).
     * Rule it protects: `total === 0` flips the frame to the empty state and the
     * screen-reader summary is suppressed (the `total > 0 ? … : undefined` branch).
     */
    render(<ExpiryAnalysis withTtl={0} noTtl={0} />)
    expect(screen.getByText('No data yet.')).toBeInTheDocument()
    expect(screen.queryByText(/Expiry —/)).not.toBeInTheDocument()
  })

  it('emits a screen-reader summary with counts and percentages when populated', () => {
    /*
     * Scenario: a populated keyspace split 30 with TTL / 10 without.
     * Rule it protects: the `total > 0` branch builds an accessible summary carrying
     * both counts and their share of the keyspace.
     */
    render(<ExpiryAnalysis withTtl={30} noTtl={10} />)
    expect(
      screen.getByText('Expiry — with TTL: 30 (75.0%), no TTL: 10 (25.0%).'),
    ).toBeInTheDocument()
  })

  it('keeps the panel populated when only one slice is non-zero', () => {
    /*
     * Scenario: every sampled key has a TTL (noTtl == 0).
     * Rule it protects: the `.filter((d) => d.value > 0)` drops the empty slice yet the
     * panel is not empty because the total is positive — the summary still renders.
     */
    render(<ExpiryAnalysis withTtl={40} noTtl={0} />)
    expect(screen.queryByText('No data yet.')).not.toBeInTheDocument()
    expect(
      screen.getByText('Expiry — with TTL: 40 (100.0%), no TTL: 0 (0.0%).'),
    ).toBeInTheDocument()
  })

  it('renders the loading skeleton instead of the donut when loading', () => {
    /*
     * Scenario: the keyspace sample is still loading.
     * Rule it protects: `isLoading` forwards to the frame's skeleton branch, so the
     * empty-state copy is suppressed (the chart body is replaced by the skeleton).
     */
    render(<ExpiryAnalysis withTtl={5} noTtl={5} isLoading />)
    expect(screen.queryByText('No data yet.')).not.toBeInTheDocument()
    // The summary still ships (it is the non-visual fallback, independent of loading).
    expect(screen.getByText('Expiry — with TTL: 5 (50.0%), no TTL: 5 (50.0%).')).toBeInTheDocument()
  })
})
