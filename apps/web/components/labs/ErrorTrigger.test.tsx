/**
 * @fileoverview Unit tests for {@link ErrorTrigger} — one error-code trigger row.
 * Covers the de-prefix display rule (a `cache.`-prefixed code is shown without the
 * prefix, while a code without it is shown verbatim via the title attribute), the
 * pending/disabled state of the Trigger button, and the `onTrigger` callback.
 *
 * @module components/labs/ErrorTrigger.test
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { type CacheErrorCode } from '@bymax-one/nest-cache/shared'
import { ErrorTrigger, type ErrorTriggerProps } from './ErrorTrigger'

/**
 * Render {@link ErrorTrigger} with defaults, overridable per test.
 *
 * @param overrides - Partial props to override the defaults.
 * @returns The render result plus the trigger spy.
 */
function setup(overrides: Partial<ErrorTriggerProps> = {}) {
  const onTrigger = vi.fn()
  const props: ErrorTriggerProps = {
    code: 'cache.invalid_key',
    httpStatus: 400,
    isPending: false,
    isSelected: false,
    onTrigger,
    ...overrides,
  }
  render(<ErrorTrigger {...props} />)
  return { onTrigger }
}

describe('ErrorTrigger', () => {
  it('de-prefixes a cache.* code for display while keeping the full code in the title', () => {
    /*
     * Scenario: a canonical `cache.invalid_key` code row.
     * Rule it protects: the visible label drops the `cache.` prefix, but the full
     * code remains available via the title attribute and the HTTP status renders.
     */
    setup({ code: 'cache.invalid_key' as CacheErrorCode, httpStatus: 400 })
    const label = screen.getByText('invalid_key')
    expect(label).toHaveAttribute('title', 'cache.invalid_key')
    expect(screen.getByText('400')).toBeInTheDocument()
  })

  it('shows a non-prefixed code verbatim', () => {
    /*
     * Scenario: a code that does not start with `cache.`.
     * Rule it protects: the de-prefix branch leaves a non-matching code unchanged.
     */
    setup({ code: 'unknown' as CacheErrorCode })
    expect(screen.getByText('unknown')).toBeInTheDocument()
  })

  it('fires onTrigger when the Trigger button is clicked', async () => {
    /*
     * Scenario: the user clicks Trigger on an idle row.
     * Rule it protects: the click invokes the `onTrigger` callback.
     */
    const user = userEvent.setup()
    const { onTrigger } = setup()
    await user.click(screen.getByRole('button', { name: 'Trigger' }))
    expect(onTrigger).toHaveBeenCalledTimes(1)
  })

  it('disables the Trigger button while a request is pending', () => {
    /*
     * Scenario: a trigger request is in flight for this row.
     * Rule it protects: `isPending` disables the button so it cannot re-fire.
     */
    setup({ isPending: true })
    expect(screen.getByRole('button', { name: 'Trigger' })).toBeDisabled()
  })

  it('renders the selected row (accent branch) without breaking the trigger', async () => {
    /*
     * Scenario: this row is the currently-selected one.
     * Rule it protects: the `isSelected` accent branch renders and the row still
     * triggers — exercising the conditional class path.
     */
    const user = userEvent.setup()
    const { onTrigger } = setup({ isSelected: true })
    await user.click(screen.getByRole('button', { name: 'Trigger' }))
    expect(onTrigger).toHaveBeenCalledTimes(1)
  })
})
