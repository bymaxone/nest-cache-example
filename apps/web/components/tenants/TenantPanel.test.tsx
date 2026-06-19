/**
 * @fileoverview Unit tests for {@link TenantPanel} — one side of the tenant split.
 *
 * The key list (`useKeys`/`flattenKeyPages`), the clear mutation (`useClearTenant`),
 * the query client, the `tenantsApi.getProduct` read-through, and `sonner` are all
 * mocked so the panel's own logic is isolated: the loading/empty/data list branches,
 * the active-tenant highlight, the [Seed 10] flow (cache-hit counting across the
 * read-through loop, the in-flight label, and the network-failure toast), and the
 * [Clear this tenant] success/error/pending branches. `@/lib/format` stays real so
 * the rendered counts and session hit rate are asserted against the true formatter.
 *
 * @module components/tenants/TenantPanel.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { formatPercent } from '@/lib/format'
import { TenantPanel } from './TenantPanel'

/** The infinite-query surface the panel reads (only `data.pages` + `isLoading`). */
interface UseKeysMock {
  data: { pages: unknown[] } | undefined
  isLoading: boolean
}

/** The clear-tenant mutation surface the panel reads. */
interface ClearTenantMock {
  mutate: ReturnType<typeof vi.fn>
  isPending: boolean
}

// Mutable mock surfaces, referenced lazily by the `vi.mock` factories below.
let useKeysResult: UseKeysMock = { data: { pages: [] }, isLoading: false }
let flatKeys: string[] = []
const clearTenant: ClearTenantMock = { mutate: vi.fn(), isPending: false }
const getProduct = vi.fn<(tenant: string, id: string) => Promise<unknown>>()

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('@/hooks/use-keys', () => ({
  KEYS_QUERY_ROOT: 'keys',
  useKeys: () => useKeysResult,
  flattenKeyPages: () => flatKeys,
}))

vi.mock('@/hooks/use-cache-mutations', () => ({
  useClearTenant: () => clearTenant,
}))

// Only `getProduct` is touched by the panel; a stable wrapper forwards to the
// typed spy so `mockReset` between tests keeps the binding live.
vi.mock('@/lib/cache-api', () => ({
  tenantsApi: { getProduct: (tenant: string, id: string) => getProduct(tenant, id) },
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

import { toast } from 'sonner'

/** A minimal product payload for the read-through responses. */
const product = { id: '1', name: 'Widget', priceCents: 100, tags: [], stock: 5 }

beforeEach(() => {
  vi.clearAllMocks()
  useKeysResult = { data: { pages: [] }, isLoading: false }
  flatKeys = []
  clearTenant.mutate = vi.fn()
  clearTenant.isPending = false
  getProduct.mockReset()
  getProduct.mockResolvedValue({ ok: true, data: { data: product, source: 'origin' } })
})

describe('TenantPanel', () => {
  it('renders a loading skeleton while the key list is loading', () => {
    /*
     * Scenario: the tenant's key query has not resolved.
     * Rule it protects: the `query.isLoading` branch renders a skeleton placeholder
     * instead of the empty prompt or any key rows.
     */
    useKeysResult = { data: undefined, isLoading: true }
    const { container } = render(<TenantPanel tenant="acme" />)
    expect(container.querySelector('.animate-pulse')).not.toBeNull()
    expect(screen.queryByText(/No keys/)).not.toBeInTheDocument()
  })

  it('renders the empty prompt and a dash hit rate when the tenant has no keys', () => {
    /*
     * Scenario: the key list resolved empty and no session reads have happened.
     * Rule it protects: the `keys.length === 0` branch shows the seed prompt and the
     * `session.total > 0 ? … : '—'` false arm renders the dash hit rate.
     */
    render(<TenantPanel tenant="acme" />)
    expect(screen.getByText(/No keys/)).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('highlights the active tenant and lists each loaded key', () => {
    /*
     * Scenario: this panel is the globally-selected tenant with two loaded keys.
     * Rule it protects: the `isActive` branch renders the "active" marker and the
     * data branch renders one row per key.
     */
    flatKeys = ['tenant:acme:product:1', 'tenant:acme:product:2']
    render(<TenantPanel tenant="acme" isActive />)
    expect(screen.getByText('active')).toBeInTheDocument()
    expect(screen.getByText('tenant:acme:product:1')).toBeInTheDocument()
    expect(screen.getByText('tenant:acme:product:2')).toBeInTheDocument()
  })

  it('omits the active marker when the panel is not the selected tenant', () => {
    /*
     * Scenario: the panel is rendered for an inactive tenant.
     * Rule it protects: the `isActive ? … : null` false arm leaves no "active" marker.
     */
    render(<TenantPanel tenant="globex" />)
    expect(screen.queryByText('active')).not.toBeInTheDocument()
  })

  it('seeds products, counting only cache hits across the read-through loop', async () => {
    /*
     * Scenario: a [Seed 10] burst where one read is a cache hit, one an origin miss,
     * and the rest fail outright.
     * Rule it protects: the `result.ok && source === 'cache'` predicate increments the
     * hit count only on a cached hit (covering its ok/origin/!ok arms), then the
     * session hit rate renders via the real formatter and a success toast is raised.
     */
    getProduct
      .mockResolvedValueOnce({ ok: true, data: { data: product, source: 'cache' } })
      .mockResolvedValueOnce({ ok: true, data: { data: product, source: 'origin' } })
      .mockResolvedValue({ ok: false, error: { code: 'x', message: 'down', status: 500 } })
    const user = userEvent.setup()
    render(<TenantPanel tenant="acme" />)
    await user.click(screen.getByRole('button', { name: 'Seed 10' }))

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Seeded 10 products for acme'))
    expect(getProduct).toHaveBeenCalledTimes(10)
    // 1 hit / 10 reads → the session hit rate renders via the real formatter.
    expect(screen.getByText(formatPercent(0.1))).toBeInTheDocument()
  })

  it('shows the Seeding… label and disables the button while a seed is in flight', async () => {
    /*
     * Scenario: a seed burst whose first read has not resolved yet.
     * Rule it protects: the `isSeeding` branch swaps the label to "Seeding…" and
     * disables the button so a duplicate burst cannot fire.
     */
    let resolveSeed: (value: unknown) => void = () => {}
    getProduct.mockReturnValue(
      new Promise((resolve) => {
        resolveSeed = resolve
      }),
    )
    const user = userEvent.setup()
    render(<TenantPanel tenant="acme" />)
    await user.click(screen.getByRole('button', { name: 'Seed 10' }))

    const seeding = await screen.findByRole('button', { name: 'Seeding…' })
    expect(seeding).toBeDisabled()
    resolveSeed({ ok: true, data: { data: product, source: 'cache' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Seed 10' })).toBeInTheDocument())
  })

  it('toasts a failure and re-enables seeding when a read-through rejects', async () => {
    /*
     * Scenario: the read-through transport rejects at the network layer.
     * Rule it protects: the `catch` toasts the seed failure and the `finally` always
     * clears the seeding flag so the button never gets stuck.
     */
    getProduct.mockRejectedValue(new Error('network'))
    const user = userEvent.setup()
    render(<TenantPanel tenant="acme" />)
    await user.click(screen.getByRole('button', { name: 'Seed 10' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not seed acme'))
    expect(screen.getByRole('button', { name: 'Seed 10' })).not.toBeDisabled()
  })

  it('clears the tenant and toasts the deleted count on success', async () => {
    /*
     * Scenario: the operator clears the tenant and the server reports the deletions.
     * Rule it protects: the clear `onSuccess` toasts the deleted-key count for the
     * tenant.
     */
    clearTenant.mutate = vi.fn(
      (tenant: string, opts: { onSuccess: (r: { deleted: number }) => void }) =>
        opts.onSuccess({ deleted: 3 }),
    )
    const user = userEvent.setup()
    render(<TenantPanel tenant="acme" />)
    await user.click(screen.getByRole('button', { name: 'Clear this tenant' }))

    expect(clearTenant.mutate).toHaveBeenCalledWith('acme', expect.anything())
    expect(toast.success).toHaveBeenCalledWith('Cleared 3 keys for acme')
  })

  it('toasts the error message when clearing the tenant fails', async () => {
    /*
     * Scenario: the clear mutation rejects with a typed error.
     * Rule it protects: the clear `onError` surfaces the error message as a toast.
     */
    clearTenant.mutate = vi.fn((tenant: string, opts: { onError: (e: Error) => void }) =>
      opts.onError(new Error('scan failed')),
    )
    const user = userEvent.setup()
    render(<TenantPanel tenant="acme" />)
    await user.click(screen.getByRole('button', { name: 'Clear this tenant' }))

    expect(toast.error).toHaveBeenCalledWith('scan failed')
  })

  it('disables the clear button while a clear is pending', () => {
    /*
     * Scenario: a clear request is already in flight.
     * Rule it protects: `clearTenant.isPending` disables the button so the destructive
     * action cannot be double-fired.
     */
    clearTenant.isPending = true
    render(<TenantPanel tenant="acme" />)
    expect(screen.getByRole('button', { name: 'Clear this tenant' })).toBeDisabled()
  })
})
