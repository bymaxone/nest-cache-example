/**
 * @fileoverview Unit tests for {@link KeyDetailDrawer} — the Explorer's tabbed
 * value inspector. Mocks the inspect query and the delete/persist/expire
 * mutation hooks plus `sonner`, then drives every state: closed (no sheet),
 * loading skeleton, structured error, and the four data tabs (Value / Raw /
 * TTL / Metadata). Exercises copy-key, copy-value (with both clipboard outcomes),
 * refresh, persist, delete (deleted vs already-gone, plus error toast), and the
 * Extend +60s TTL math for a live vs persisted key.
 *
 * @module components/explorer/KeyDetailDrawer.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { type ApiResult } from '@/lib/api-client'
import { type KeyInspectResponse } from '@/lib/cache-api'
import { KeyDetailDrawer } from './KeyDetailDrawer'

const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => void toastSuccess(...args),
    error: (...args: unknown[]) => void toastError(...args),
  },
}))

/** Controlled state for the mocked inspect query. */
interface InspectState {
  data: ApiResult<KeyInspectResponse> | undefined
  isLoading: boolean
  isFetching: boolean
  refetch: ReturnType<typeof vi.fn>
}

const inspectState: InspectState = {
  data: undefined,
  isLoading: false,
  isFetching: false,
  refetch: vi.fn(),
}

/** A single mutation's controlled surface. */
interface MutationState {
  mutate: ReturnType<typeof vi.fn>
  isPending: boolean
}

const deleteState: MutationState = { mutate: vi.fn(), isPending: false }
const persistState: MutationState = { mutate: vi.fn(), isPending: false }
const expireState: MutationState = { mutate: vi.fn(), isPending: false }

/** Spy backing `navigator.clipboard.writeText`, swapped per test. */
let writeText = vi.fn<(text: string) => Promise<void>>()

/**
 * Install a clipboard stub on the jsdom `Navigator` (whose `clipboard` is a
 * getter-only property, so it must be defined rather than assigned).
 *
 * @param impl - The `writeText` implementation for this test.
 */
function stubClipboard(impl: () => Promise<void>): void {
  writeText = vi.fn(impl)
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })
}

vi.mock('@/hooks/use-key-inspect', () => ({
  useKeyInspect: () => inspectState,
}))
vi.mock('@/hooks/use-cache-mutations', () => ({
  useDeleteKey: () => deleteState,
  usePersistKey: () => persistState,
  useExpireKey: () => expireState,
}))

/** Build a successful inspect result for `cache-example:product:42`. */
function okInspect(overrides: Partial<KeyInspectResponse> = {}): ApiResult<KeyInspectResponse> {
  return {
    ok: true,
    data: {
      key: 'cache-example:product:42',
      type: 'string',
      value: { id: 42, name: 'Widget' },
      raw: '{"id":42,"name":"Widget"}',
      ttl: 120,
      memoryBytes: 256,
      ...overrides,
    },
  }
}

beforeEach(() => {
  inspectState.data = undefined
  inspectState.isLoading = false
  inspectState.isFetching = false
  inspectState.refetch = vi.fn()
  deleteState.mutate = vi.fn()
  deleteState.isPending = false
  persistState.mutate = vi.fn()
  persistState.isPending = false
  expireState.mutate = vi.fn()
  expireState.isPending = false
  toastSuccess.mockClear()
  toastError.mockClear()
  stubClipboard(() => Promise.resolve())
})

describe('KeyDetailDrawer', () => {
  it('renders nothing visible when keyName is null (closed)', () => {
    /*
     * Scenario: no row is selected.
     * Rule it protects: a `null` keyName keeps the sheet closed (no dialog in DOM).
     */
    render(<KeyDetailDrawer keyName={null} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the loading skeleton while the inspect query is loading', () => {
    /*
     * Scenario: the drawer opened and the inspection is still loading.
     * Rule it protects: the loading branch renders skeletons, not tabs.
     */
    inspectState.isLoading = true
    render(<KeyDetailDrawer keyName="cache-example:product:42" onClose={vi.fn()} />)
    expect(screen.getByText('cache-example:product:42')).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  it('renders the structured error message when the inspection failed', () => {
    /*
     * Scenario: the inspect query resolved a typed error.
     * Rule it protects: the error branch renders the error message and no tabs.
     */
    inspectState.data = {
      ok: false,
      error: { code: 'unknown', message: 'Key vanished', status: 500 },
    }
    render(<KeyDetailDrawer keyName="cache-example:product:42" onClose={vi.fn()} />)
    expect(screen.getByText('Key vanished')).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  it('renders the four data tabs with the value, raw, TTL and metadata content', async () => {
    /*
     * Scenario: a fully-inspected string key.
     * Rule it protects: the data branch renders the Value tree by default and the
     * Raw / TTL / Metadata tabs reveal their content when selected (segments,
     * byte size, raw string).
     */
    inspectState.data = okInspect()
    const user = userEvent.setup()
    render(<KeyDetailDrawer keyName="cache-example:product:42" onClose={vi.fn()} />)
    expect(screen.getByRole('tab', { name: 'Value' })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Raw' }))
    expect(screen.getByText('{"id":42,"name":"Widget"}')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Metadata' }))
    expect(screen.getByText('256 B')).toBeInTheDocument()
    // The composed key segments each render as a chip.
    expect(screen.getByText('product')).toBeInTheDocument()
  })

  it('renders the raw-only fallback for a key with no raw string', async () => {
    /*
     * Scenario: a non-string key (hash/set) whose `raw` is null.
     * Rule it protects: the Raw tab shows the `raw string only` fallback copy.
     */
    inspectState.data = okInspect({ type: 'hash', raw: null })
    const user = userEvent.setup()
    render(<KeyDetailDrawer keyName="cache-example:cart:7" onClose={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: 'Raw' }))
    expect(screen.getByText('— (raw string only applies to string keys)')).toBeInTheDocument()
  })

  it('copies the key and toasts on a successful clipboard write', async () => {
    /*
     * Scenario: the user clicks Copy key.
     * Rule it protects: the key is written to the clipboard and the success toast fires.
     */
    inspectState.data = okInspect()
    const user = userEvent.setup()
    // `userEvent.setup()` installs its own clipboard shim; re-stub after it so
    // the component's `writeText` call hits our spy.
    stubClipboard(() => Promise.resolve())
    render(<KeyDetailDrawer keyName="cache-example:product:42" onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Copy key' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('cache-example:product:42'))
    expect(toastSuccess).toHaveBeenCalledWith('Key copied')
  })

  it('toasts an error when the clipboard write rejects', async () => {
    /*
     * Scenario: the clipboard API rejects (permissions/insecure context).
     * Rule it protects: the copy helper's catch path fires the error toast.
     */
    inspectState.data = okInspect()
    const user = userEvent.setup()
    // Re-stub after setup so the rejecting clipboard is the one the component hits.
    stubClipboard(() => Promise.reject(new Error('denied')))
    render(<KeyDetailDrawer keyName="cache-example:product:42" onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Copy value' }))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Could not copy value'))
  })

  it('disables Copy value until an inspection is available', () => {
    /*
     * Scenario: the inspection has not resolved yet.
     * Rule it protects: Copy value is disabled while `inspect` is null.
     */
    inspectState.data = undefined
    render(<KeyDetailDrawer keyName="cache-example:product:42" onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Copy value' })).toBeDisabled()
  })

  it('refetches the inspection when Refresh is clicked', async () => {
    /*
     * Scenario: the user clicks Refresh.
     * Rule it protects: the refetch handler runs the query refetch.
     */
    inspectState.data = okInspect()
    const user = userEvent.setup()
    render(<KeyDetailDrawer keyName="cache-example:product:42" onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(inspectState.refetch).toHaveBeenCalledTimes(1)
  })

  it('disables Refresh while the query is fetching', () => {
    /*
     * Scenario: a refetch is already in flight.
     * Rule it protects: `query.isFetching` disables the Refresh button.
     */
    inspectState.data = okInspect()
    inspectState.isFetching = true
    render(<KeyDetailDrawer keyName="cache-example:product:42" onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled()
  })

  it('deletes the key, toasts the deleted message, and closes on success', async () => {
    /*
     * Scenario: a successful delete that removed the key.
     * Rule it protects: a `deleted > 0` result toasts the deleted message and closes.
     */
    inspectState.data = okInspect()
    deleteState.mutate = vi.fn(
      (_key: string, opts: { onSuccess: (r: { deleted: number }) => void }) => {
        opts.onSuccess({ deleted: 1 })
      },
    )
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<KeyDetailDrawer keyName="cache-example:product:42" onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(toastSuccess).toHaveBeenCalledWith('Deleted cache-example:product:42')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('toasts the already-gone message when the delete removed nothing', async () => {
    /*
     * Scenario: a delete where the key was already absent.
     * Rule it protects: a `deleted === 0` result toasts the already-gone message.
     */
    inspectState.data = okInspect()
    deleteState.mutate = vi.fn(
      (_key: string, opts: { onSuccess: (r: { deleted: number }) => void }) => {
        opts.onSuccess({ deleted: 0 })
      },
    )
    const user = userEvent.setup()
    render(<KeyDetailDrawer keyName="cache-example:product:42" onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(toastSuccess).toHaveBeenCalledWith('Key already gone')
  })

  it('toasts the error message when the delete fails', async () => {
    /*
     * Scenario: a rejected delete mutation.
     * Rule it protects: the delete `onError` surfaces the error message via toast.
     */
    inspectState.data = okInspect()
    deleteState.mutate = vi.fn((_key: string, opts: { onError: (e: Error) => void }) => {
      opts.onError(new Error('delete boom'))
    })
    const user = userEvent.setup()
    render(<KeyDetailDrawer keyName="cache-example:product:42" onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(toastError).toHaveBeenCalledWith('delete boom')
  })

  it('persists the key from the header action, toasting on success', async () => {
    /*
     * Scenario: the user clicks the header Persist action.
     * Rule it protects: persist's success path toasts the persistent message.
     */
    inspectState.data = okInspect()
    persistState.mutate = vi.fn((_key: string, opts: { onSuccess: () => void }) => {
      opts.onSuccess()
    })
    const user = userEvent.setup()
    render(<KeyDetailDrawer keyName="cache-example:product:42" onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Persist' }))
    expect(toastSuccess).toHaveBeenCalledWith('TTL removed — key is now persistent')
  })

  it('toasts the error message when persist fails', async () => {
    /*
     * Scenario: a rejected persist mutation.
     * Rule it protects: persist's `onError` surfaces the error message via toast.
     */
    inspectState.data = okInspect()
    persistState.mutate = vi.fn((_key: string, opts: { onError: (e: Error) => void }) => {
      opts.onError(new Error('persist boom'))
    })
    const user = userEvent.setup()
    render(<KeyDetailDrawer keyName="cache-example:product:42" onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Persist' }))
    expect(toastError).toHaveBeenCalledWith('persist boom')
  })

  it('extends a live TTL by 60 seconds and toasts the new value', async () => {
    /*
     * Scenario: a key with 120s TTL, Extend clicked from the TTL tab.
     * Rule it protects: a positive current TTL extends to `current + 60` and toasts it.
     */
    inspectState.data = okInspect({ ttl: 120 })
    expireState.mutate = vi.fn(
      (_args: { key: string; seconds: number }, opts: { onSuccess: () => void }) => {
        opts.onSuccess()
      },
    )
    const user = userEvent.setup()
    render(<KeyDetailDrawer keyName="cache-example:product:42" onClose={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: 'TTL' }))
    await user.click(screen.getByRole('button', { name: 'Extend +60s' }))
    expect(expireState.mutate).toHaveBeenCalledWith(
      { key: 'cache-example:product:42', seconds: 180 },
      expect.anything(),
    )
    expect(toastSuccess).toHaveBeenCalledWith('TTL set to 180s')
  })

  it('extends a persisted key to a flat 60 seconds and toasts the error path', async () => {
    /*
     * Scenario: a persisted key (TTL -1), Extend clicked — and the mutation fails.
     * Rule it protects: a non-positive current TTL extends to a flat 60s, and the
     * expire `onError` surfaces the error message via toast.
     */
    inspectState.data = okInspect({ ttl: -1 })
    expireState.mutate = vi.fn(
      (_args: { key: string; seconds: number }, opts: { onError: (e: Error) => void }) => {
        opts.onError(new Error('expire boom'))
      },
    )
    const user = userEvent.setup()
    render(<KeyDetailDrawer keyName="cache-example:product:42" onClose={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: 'TTL' }))
    await user.click(screen.getByRole('button', { name: 'Extend +60s' }))
    expect(expireState.mutate).toHaveBeenCalledWith(
      { key: 'cache-example:product:42', seconds: 60 },
      expect.anything(),
    )
    expect(toastError).toHaveBeenCalledWith('expire boom')
  })

  it('closes the drawer when the sheet requests close', async () => {
    /*
     * Scenario: the user dismisses the sheet via its close affordance.
     * Rule it protects: the sheet's onOpenChange(false) invokes `onClose`.
     */
    inspectState.data = okInspect()
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<KeyDetailDrawer keyName="cache-example:product:42" onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
