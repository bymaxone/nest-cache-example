/**
 * @fileoverview Unit tests for `LiveToggle` — the live-feeds URL flag toggle.
 * Drives both states (off by default → on after a click) by reading/writing the
 * `live` query state through the nuqs testing adapter, and asserts the write is
 * persisted to the URL.
 *
 * @module components/controls/LiveToggle.test
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from 'nuqs/adapters/testing'
import { LiveToggle } from './LiveToggle'

/**
 * Render `LiveToggle` inside the nuqs testing adapter.
 *
 * @param searchParams - The initial query string seeding the `live` flag.
 * @param onUrlUpdate - Spy invoked on each URL write.
 * @returns The render result.
 */
function renderToggle(searchParams: string, onUrlUpdate?: OnUrlUpdateFunction) {
  return render(<LiveToggle />, {
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

describe('LiveToggle', () => {
  it('renders off by default (not pressed) when the URL has no live flag', () => {
    /*
     * Scenario: a fresh page load with no `live` param.
     * Rule it protects: the feeds default off, so the toggle is `aria-pressed=false`.
     */
    renderToggle('')
    expect(screen.getByRole('button', { name: /Live/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('renders on (pressed) when the URL already enables live', () => {
    /*
     * Scenario: a shared deep-link with `live=true`.
     * Rule it protects: the toggle hydrates from the URL into its on state, so the
     * active styling/`aria-pressed=true` branch is reachable from a deep link.
     */
    renderToggle('?live=true')
    expect(screen.getByRole('button', { name: /Live/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('flips the live flag on click and persists it to the URL', async () => {
    /*
     * Scenario: the user opts into the live feeds.
     * Rule it protects: clicking calls `setLive(!live)`, writing `live=true` to the
     * URL so the socket-gating flag becomes a shareable, persisted part of the link.
     */
    const user = userEvent.setup()
    const onUrlUpdate = vi.fn()
    renderToggle('', onUrlUpdate)
    await user.click(screen.getByRole('button', { name: /Live/ }))
    expect(onUrlUpdate).toHaveBeenCalled()
    const last = onUrlUpdate.mock.calls.at(-1)?.[0]
    expect(last?.searchParams.get('live')).toBe('true')
  })
})
