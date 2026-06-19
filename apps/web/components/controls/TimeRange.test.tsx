/**
 * @fileoverview Unit tests for `TimeRange` — the segmented relative-range selector.
 * Drives the `isActive` branch (the URL-selected preset reads `aria-checked=true`,
 * the rest false) and the click → URL-write path, through the nuqs testing adapter.
 *
 * @module components/controls/TimeRange.test
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from 'nuqs/adapters/testing'
import { TimeRange } from './TimeRange'
import { RANGE_PRESETS } from '@/lib/filters'

/**
 * Render `TimeRange` inside the nuqs testing adapter.
 *
 * @param searchParams - The initial query string seeding the `range` preset.
 * @param onUrlUpdate - Spy invoked on each URL write.
 * @returns The render result.
 */
function renderRange(searchParams: string, onUrlUpdate?: OnUrlUpdateFunction) {
  return render(<TimeRange />, {
    wrapper: ({ children }) => (
      <NuqsTestingAdapter
        searchParams={searchParams}
        hasMemory
        {...(onUrlUpdate ? { onUrlUpdate } : {})}
      >
        {children}
      </NuqsTestingAdapter>
    ),
  })
}

describe('TimeRange', () => {
  it('renders one radio per preset and marks the default (15m) active', () => {
    /*
     * Scenario: a fresh load with no `range` param.
     * Rule it protects: the parser default `15m` is the checked radio while the other
     * presets are unchecked — the `isActive` ternary on each button.
     */
    renderRange('')
    for (const preset of RANGE_PRESETS) {
      const radio = screen.getByRole('radio', { name: preset })
      expect(radio).toHaveAttribute('aria-checked', preset === '15m' ? 'true' : 'false')
    }
  })

  it('marks the URL-selected preset active on hydration', () => {
    /*
     * Scenario: a deep-link with `range=5m`.
     * Rule it protects: the active branch follows the URL, so `5m` checks and `15m`
     * unchecks — proving the active state is URL-driven, not hard-coded.
     */
    renderRange('?range=5m')
    expect(screen.getByRole('radio', { name: '5m' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: '15m' })).toHaveAttribute('aria-checked', 'false')
  })

  it('writes the chosen preset to the URL on click', async () => {
    /*
     * Scenario: the user picks the 1h window.
     * Rule it protects: clicking a preset calls `setRange(preset)`, persisting the
     * selected window to the URL as part of the shareable deep-link.
     */
    const user = userEvent.setup()
    const onUrlUpdate = vi.fn()
    renderRange('', onUrlUpdate)
    await user.click(screen.getByRole('radio', { name: '1h' }))
    const last = onUrlUpdate.mock.calls.at(-1)?.[0]
    expect(last?.searchParams.get('range')).toBe('1h')
  })
})
