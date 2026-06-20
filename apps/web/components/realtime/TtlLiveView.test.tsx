/**
 * @fileoverview Unit tests for {@link TtlLiveView} — the TTL Live page body.
 *
 * Drives the two seed mutations (`seedTtl` → addTile + toast; `seedPersisted` →
 * two-step seed+persist → `∞` tile; both error branches), the `addTile` de-dupe,
 * the event-driven expiry effect (fade the matching tile, toast, then remove after
 * the fade timeout), the foreign/already-handled skip branches, the `isSeeding`
 * disabled wiring, and `deNamespace`/`shortLabel`. The socket buffer is mocked via
 * its hook; `nuqs`, `sonner`, and the seed/persist transports are mocked; the
 * mutations run under a real `QueryClientProvider`. Fake timers drive the fade.
 *
 * @module components/realtime/TtlLiveView.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactElement, type ReactNode } from 'react'
import { type CacheEvent } from '@/lib/socket'
import { type CountdownTile } from './CountdownWall'
import { ApiRequestError } from '@/lib/cache-api'

// Recording spy so the `useQueryState('live', …)` query-key the page subscribes to
// is observable; it still returns the inert `[false, setter]` pair.
const useQueryStateSpy = vi.fn<(...args: unknown[]) => unknown>(() => [false, vi.fn()])
vi.mock('nuqs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('nuqs')>()),
  useQueryState: (...args: unknown[]) => useQueryStateSpy(...args),
}))

// `toast` is called both as a function (bare expiry toast) and via `.success` /
// `.error`. The factory builds the callable+methods object; the spies are read
// back through the imported module so the hoisted factory references nothing local.
vi.mock('sonner', () => {
  const fn = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() })
  return { toast: fn }
})

const socketEvents: CacheEvent[] = []
vi.mock('@/hooks/use-cache-socket', () => ({
  useCacheSocket: () => ({ toArray: () => socketEvents }),
}))

const seed = vi.fn<() => Promise<unknown>>()
vi.mock('@/lib/realtime-api', () => ({ ttlApi: { seed: () => seed() } }))

const persistKey = vi.fn<() => Promise<unknown>>()
vi.mock('@/lib/cache-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/cache-api')>('@/lib/cache-api')
  return {
    ...actual,
    cacheApi: { persistKey: () => persistKey() },
  }
})

// Expose CountdownWall's tiles + seed callbacks; render the tile labels so the
// added/faded tiles are observable.
let seedTtlCb: (() => void) | undefined
let seedPersistedCb: (() => void) | undefined
let lastTiles: readonly CountdownTile[] = []
let lastIsSeeding = false
vi.mock('./CountdownWall', () => ({
  CountdownWall: ({
    tiles,
    onSeedTtl,
    onSeedPersisted,
    isSeeding,
  }: {
    tiles: readonly CountdownTile[]
    onSeedTtl: () => void
    onSeedPersisted: () => void
    isSeeding?: boolean
  }) => {
    seedTtlCb = onSeedTtl
    seedPersistedCb = onSeedPersisted
    lastTiles = tiles
    lastIsSeeding = isSeeding ?? false
    return (
      <div data-testid="wall" data-seeding={String(isSeeding)}>
        {tiles.map((tile) => (
          <div key={tile.key} data-fading={String(tile.fading ?? false)}>
            {tile.label}:{tile.ttlSeconds}
          </div>
        ))}
      </div>
    )
  },
}))

vi.mock('./EventFeed', () => ({
  EventFeed: ({
    items,
    emptyState,
    renderRow,
    getKey,
  }: {
    items: readonly CacheEvent[]
    emptyState: ReactNode
    renderRow: (item: CacheEvent) => ReactNode
    getKey: (item: CacheEvent, index: number) => string
  }) => (
    <div data-testid="event-feed">
      {items.length === 0
        ? emptyState
        : items.map((item, i) => {
            // Surface the derived key as a data attribute so the `getKey` mapping is
            // observable (the real list key is not in the DOM).
            const rowKey = getKey(item, i)
            return (
              <div key={rowKey} data-key={String(rowKey)}>
                {renderRow(item)}
              </div>
            )
          })}
    </div>
  ),
}))

import { toast } from 'sonner'
import { TtlLiveView } from './TtlLiveView'

/** An `expired`-kind socket event fixture. */
function expiredEvent(key: string, seq = 1): CacheEvent {
  return { kind: 'expired', seq, key, at: 1_700_000_000_000 }
}

/** Render under a fresh, retry-disabled QueryClient. */
function renderWithClient(node: ReactElement) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
  socketEvents.length = 0
  seedTtlCb = undefined
  seedPersistedCb = undefined
  lastTiles = []
  lastIsSeeding = false
  seed.mockResolvedValue({ ok: true, data: { key: 'cache-example:ttl:abc123', ttlSeconds: 30 } })
  persistKey.mockResolvedValue({ ok: true, data: { ttl: -1 } })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('TtlLiveView', () => {
  it('seeds a TTL key, adding a tile and toasting the de-namespaced key', async () => {
    /*
     * Scenario: the operator seeds a 30s key.
     * Rule it protects: the seedTtl success handler adds a tile (short label from the
     * trailing id segment) and toasts the de-namespaced key.
     */
    const user = userEvent.setup()
    renderWithClient(<TtlLiveView />)
    await act(async () => {
      seedTtlCb?.()
      await Promise.resolve()
    })
    await waitFor(() => expect(seed).toHaveBeenCalled())
    expect(await screen.findByText('abc123:30')).toBeInTheDocument()
    expect(toast.success).toHaveBeenCalledWith('Seeded 30s key', { description: 'ttl:abc123' })
    void user
  })

  it('truncates a long id segment to eight chars with an ellipsis in the label', async () => {
    /*
     * Scenario: the seeded key's trailing id is longer than eight characters.
     * Rule it protects: `shortLabel` slices to `12345678…` for a long id.
     */
    seed.mockResolvedValue({
      ok: true,
      data: { key: 'cache-example:ttl:1234567890', ttlSeconds: 30 },
    })
    renderWithClient(<TtlLiveView />)
    await act(async () => {
      seedTtlCb?.()
      await Promise.resolve()
    })
    expect(await screen.findByText('12345678…:30')).toBeInTheDocument()
  })

  it('keeps an exactly-eight-char id verbatim, without an ellipsis', async () => {
    /*
     * Scenario: the seeded key's trailing id is exactly eight characters.
     * Rule it protects: `shortLabel` truncates only when the id is STRICTLY longer than
     * eight chars (`> 8`), so an eight-char id is shown whole — pinning the boundary
     * against a `>= 8` mutation that would wrongly append the ellipsis.
     */
    seed.mockResolvedValue({
      ok: true,
      data: { key: 'cache-example:ttl:abcd1234', ttlSeconds: 30 },
    })
    renderWithClient(<TtlLiveView />)
    await act(async () => {
      seedTtlCb?.()
      await Promise.resolve()
    })
    expect(await screen.findByText('abcd1234:30')).toBeInTheDocument()
    expect(screen.queryByText('abcd1234…:30')).not.toBeInTheDocument()
  })

  it('tags a seeded tile with the ttl entity-prefix chip', async () => {
    /*
     * Scenario: the operator seeds a 30s key.
     * Rule it protects: `addTile` stamps the tile's `prefix` as `'ttl'` so the wall can
     * render its entity chip — a blanked prefix literal would leave the chip empty.
     */
    renderWithClient(<TtlLiveView />)
    await act(async () => {
      seedTtlCb?.()
      await Promise.resolve()
    })
    await waitFor(() =>
      expect(lastTiles.find((t) => t.key === 'cache-example:ttl:abc123')?.prefix).toBe('ttl'),
    )
  })

  it('does not add a duplicate tile when the same key is seeded twice', async () => {
    /*
     * Scenario: the same key resolves from two seed clicks.
     * Rule it protects: `addTile`'s `prev.some(key)` de-dupe keeps a single tile.
     */
    renderWithClient(<TtlLiveView />)
    await act(async () => {
      seedTtlCb?.()
      await Promise.resolve()
    })
    await screen.findByText('abc123:30')
    await act(async () => {
      seedTtlCb?.()
      await Promise.resolve()
    })
    await waitFor(() => expect(seed).toHaveBeenCalledTimes(2))
    expect(screen.getAllByText('abc123:30')).toHaveLength(1)
  })

  it('seeds a persisted key via the two-step seed+persist, rendering a -1 tile', async () => {
    /*
     * Scenario: the operator seeds a persisted (∞) key.
     * Rule it protects: seedPersisted seeds then persists, adds a `ttlSeconds: -1`
     * tile, and toasts the persisted success message.
     */
    renderWithClient(<TtlLiveView />)
    await act(async () => {
      seedPersistedCb?.()
      await Promise.resolve()
    })
    await waitFor(() => expect(persistKey).toHaveBeenCalled())
    expect(await screen.findByText('abc123:-1')).toBeInTheDocument()
    expect(toast.success).toHaveBeenCalledWith('Seeded persisted key (∞)', {
      description: 'ttl:abc123',
    })
  })

  it('toasts the structured message when seedTtl fails with an ApiRequestError', async () => {
    /*
     * Scenario: the seed transport throws an `ApiRequestError`.
     * Rule it protects: the seedTtl error branch surfaces `error.apiError.message`.
     */
    seed.mockRejectedValue(new ApiRequestError({ code: 'unknown', message: 'quota', status: 429 }))
    renderWithClient(<TtlLiveView />)
    await act(async () => {
      seedTtlCb?.()
      await Promise.resolve()
    })
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Seed failed', { description: 'quota' }),
    )
  })

  it('falls back to error.message when seedPersisted fails with a plain Error', async () => {
    /*
     * Scenario: the persisted seed rejects with a plain Error.
     * Rule it protects: the seedPersisted error branch falls back to `error.message`.
     */
    seed.mockRejectedValue(new Error('boom'))
    renderWithClient(<TtlLiveView />)
    await act(async () => {
      seedPersistedCb?.()
      await Promise.resolve()
    })
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Seed failed', { description: 'boom' }),
    )
  })

  it('falls back to error.message when seedTtl fails with a plain Error', async () => {
    /*
     * Scenario: the seedTtl mutation rejects with a plain Error (not an ApiRequestError).
     * Rule it protects: the seedTtl error branch's false arm uses `error.message`.
     */
    seed.mockRejectedValue(new Error('plain ttl failure'))
    renderWithClient(<TtlLiveView />)
    await act(async () => {
      seedTtlCb?.()
      await Promise.resolve()
    })
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Seed failed', { description: 'plain ttl failure' }),
    )
  })

  it('surfaces the structured message when seedPersisted fails with an ApiRequestError', async () => {
    /*
     * Scenario: the persisted seed throws an `ApiRequestError`.
     * Rule it protects: the seedPersisted error branch's true arm uses
     * `error.apiError.message`.
     */
    seed.mockRejectedValue(
      new ApiRequestError({ code: 'unknown', message: 'persist denied', status: 403 }),
    )
    renderWithClient(<TtlLiveView />)
    await act(async () => {
      seedPersistedCb?.()
      await Promise.resolve()
    })
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Seed failed', { description: 'persist denied' }),
    )
  })

  it('disables seeding while either mutation is pending (isSeeding wiring)', async () => {
    /*
     * Scenario: a seed mutation is in flight.
     * Rule it protects: `isSeeding` is true while a mutation pends, wired into the
     * CountdownWall.
     */
    let resolveSeed: (value: unknown) => void = () => {}
    seed.mockReturnValue(new Promise((resolve) => (resolveSeed = resolve)))
    renderWithClient(<TtlLiveView />)
    act(() => {
      seedTtlCb?.()
    })
    await waitFor(() => expect(lastIsSeeding).toBe(true))
    await act(async () => {
      resolveSeed({ ok: true, data: { key: 'cache-example:ttl:abc123', ttlSeconds: 30 } })
      await Promise.resolve()
    })
    await waitFor(() => expect(lastIsSeeding).toBe(false))
  })

  it('fades the matching tile, toasts, and removes it after the fade timeout on expiry', async () => {
    /*
     * Scenario: an expiry event arrives for a rendered tile.
     * Rule it protects: the expiry effect marks the tile `fading`, raises the
     * re-fetch toast, then removes the tile after the fade timeout (event-driven,
     * not the local countdown).
     */
    renderWithClient(<TtlLiveView />)
    await act(async () => {
      seedTtlCb?.()
      await Promise.resolve()
    })
    await waitFor(() => expect(lastTiles.map((t) => t.key)).toContain('cache-example:ttl:abc123'))

    // The server confirms expiry for the seeded key; re-seeding forces a re-render
    // so the expiry effect re-runs on the bumped event count.
    socketEvents.push(expiredEvent('cache-example:ttl:abc123'))
    await act(async () => {
      seedTtlCb?.()
      await Promise.resolve()
    })

    await waitFor(() => expect(lastTiles.some((t) => t.fading === true)).toBe(true))
    expect(toast).toHaveBeenCalledWith('Key expired — re-fetching…', { description: 'ttl:abc123' })

    // The fade timeout (700ms, real) then removes the tile entirely.
    await waitFor(
      () => expect(lastTiles.some((t) => t.key === 'cache-example:ttl:abc123')).toBe(false),
      { timeout: 2_000 },
    )
  })

  it('removes ONLY the expired tile after its fade, leaving siblings in place', async () => {
    /*
     * Scenario: two tiles exist; only one (k1) receives a confirmed expiry.
     * Rule it protects: the fade-removal `setTiles` filters by `tile.key !== event.key`,
     * so it drops just the expired key and keeps k2 — pinning the filter predicate
     * against a mutation that would discard every tile.
     */
    let calls = 0
    seed.mockImplementation(() => {
      calls += 1
      const key = calls === 1 ? 'cache-example:ttl:k1' : 'cache-example:ttl:k2'
      return Promise.resolve({ ok: true, data: { key, ttlSeconds: 30 } })
    })
    renderWithClient(<TtlLiveView />)
    await act(async () => {
      seedTtlCb?.()
      await Promise.resolve()
    })
    await act(async () => {
      seedTtlCb?.()
      await Promise.resolve()
    })
    await waitFor(() =>
      expect(lastTiles.map((t) => t.key).sort()).toEqual([
        'cache-example:ttl:k1',
        'cache-example:ttl:k2',
      ]),
    )

    socketEvents.push(expiredEvent('cache-example:ttl:k1', 20))
    await act(async () => {
      seedTtlCb?.()
      await Promise.resolve()
    })

    // After the fade timeout, k1 is gone but k2 (never expired) remains rendered.
    await waitFor(
      () => {
        expect(lastTiles.some((t) => t.key === 'cache-example:ttl:k1')).toBe(false)
        expect(lastTiles.some((t) => t.key === 'cache-example:ttl:k2')).toBe(true)
      },
      { timeout: 2_000 },
    )
  })

  it('ignores an expiry for a key that is not a rendered tile', async () => {
    /*
     * Scenario: an expiry arrives for a foreign key with no tile.
     * Rule it protects: the `!tileKeysRef.has(key)` guard skips it WITHOUT marking it
     * handled and without toasting an expiry.
     */
    renderWithClient(<TtlLiveView />)
    await act(async () => {
      seedTtlCb?.()
      await Promise.resolve()
    })
    socketEvents.push(expiredEvent('cache-example:ttl:foreign'))
    await act(async () => {
      seedTtlCb?.()
      await Promise.resolve()
    })
    expect(toast).not.toHaveBeenCalledWith(
      'Key expired — re-fetching…',
      expect.objectContaining({ description: 'ttl:foreign' }),
    )
    expect(lastTiles.some((t) => t.fading === true)).toBe(false)
  })

  it('fades only the expired tile and skips an already-handled key on a later pass', async () => {
    /*
     * Scenario: two tiles exist; the first expires, then the second expires on a
     * later effect pass while the first is already handled.
     * Rule it protects: the `tile.key === event.key` map only fades the matching tile
     * (the false arm leaves siblings untouched), and the `handledRef.has` guard skips
     * an expiry that was already processed instead of re-toasting it.
     */
    let calls = 0
    seed.mockImplementation(() => {
      calls += 1
      const key = calls === 1 ? 'cache-example:ttl:k1' : 'cache-example:ttl:k2'
      return Promise.resolve({ ok: true, data: { key, ttlSeconds: 30 } })
    })
    renderWithClient(<TtlLiveView />)
    await act(async () => {
      seedTtlCb?.()
      await Promise.resolve()
    })
    await act(async () => {
      seedTtlCb?.()
      await Promise.resolve()
    })
    await waitFor(() =>
      expect(lastTiles.map((t) => t.key).sort()).toEqual([
        'cache-example:ttl:k1',
        'cache-example:ttl:k2',
      ]),
    )

    // First expiry (k1): only k1 fades; k2 takes the non-matching map arm.
    socketEvents.push(expiredEvent('cache-example:ttl:k1', 10))
    await act(async () => {
      seedTtlCb?.()
      await Promise.resolve()
    })
    await waitFor(() =>
      expect(lastTiles.find((t) => t.key === 'cache-example:ttl:k1')?.fading).toBe(true),
    )
    expect(lastTiles.find((t) => t.key === 'cache-example:ttl:k2')?.fading ?? false).toBe(false)

    // Second expiry (k2) bumps the count so the effect re-runs over BOTH events; k1
    // is already handled (skipped), k2 now fades.
    socketEvents.push(expiredEvent('cache-example:ttl:k2', 11))
    await act(async () => {
      seedTtlCb?.()
      await Promise.resolve()
    })
    await waitFor(() =>
      expect(lastTiles.find((t) => t.key === 'cache-example:ttl:k2')?.fading).toBe(true),
    )
    // k1 was toasted exactly once despite the second effect pass seeing its event.
    expect(vi.mocked(toast).mock.calls.filter((c) => c[1]?.description === 'ttl:k1')).toHaveLength(
      1,
    )
  })

  it('renders the expiry feed rows (de-namespaced) and the empty state', () => {
    /*
     * Scenario: with and without expiry events in the buffer.
     * Rule it protects: the feed shows the de-namespaced expired key when present and
     * the action-oriented empty state when absent.
     */
    const { rerender } = renderWithClient(<TtlLiveView />)
    expect(screen.getByText(/No expiries yet/)).toBeInTheDocument()

    socketEvents.push(expiredEvent('cache-example:ttl:zzz'))
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <TtlLiveView />
      </QueryClientProvider>,
    )
    expect(screen.getByText('ttl:zzz')).toBeInTheDocument()
  })

  it('explains the raw-subscriber expiry mechanism in the callout copy', () => {
    /*
     * Scenario: the static explanatory callout is rendered.
     * Rule it protects: the prose that documents WHY expiry uses the raw subscriber —
     * "raw subscriber, not", "The API filters them by the", "prefix. Requires" — is
     * present verbatim, so each blanked copy fragment is detected.
     */
    const { container } = renderWithClient(<TtlLiveView />)
    // The page binds the global Live toggle to the `live` query-key (a blanked key
    // string would subscribe to the wrong param and never gate the socket buffer).
    expect(useQueryStateSpy).toHaveBeenCalledWith('live', expect.anything())
    const text = container.textContent ?? ''
    expect(text).toContain('raw subscriber, not')
    expect(text).toContain('The API filters them by the')
    expect(text).toContain('prefix. Requires')
    // The `{' '}` separators between the prose and the inline `<span>` terms must
    // render real spaces; a blanked space literal would weld the words together.
    expect(text).toContain('not PubSubService')
    expect(text).toContain('the cache-example:')
    expect(text).toContain('Requires notify-keyspace-events')
  })

  it('feeds only expired-kind events, ignoring other socket channels', () => {
    /*
     * Scenario: the buffer holds a non-expiry `event`-kind message alongside one
     * `expired` event.
     * Rule it protects: `expiredEvents` filters strictly on `kind === 'expired'`, so a
     * `connection`/`event` message never reaches the expiry feed — pinning the predicate
     * against an always-true mutation that would leak foreign channels into the feed.
     */
    socketEvents.push({ kind: 'event', seq: 5, channel: 'orders', payload: { id: 1 }, at: 1 })
    socketEvents.push(expiredEvent('cache-example:ttl:only', 6))
    renderWithClient(<TtlLiveView />)
    const feed = screen.getByTestId('event-feed')
    expect(feed).toHaveTextContent('ttl:only')
    // Exactly one row — the non-expiry channel is filtered out.
    expect(feed.children).toHaveLength(1)
    expect(screen.queryByText('orders')).not.toBeInTheDocument()
  })

  it('orders the expiry feed newest-first', () => {
    /*
     * Scenario: two expiries arrive in order (older `aaa`, then newer `bbb`).
     * Rule it protects: the feed is `expiredEvents.slice().reverse()`, so the most
     * recent expiry renders first — pinning the defensive-copy `.reverse()` against a
     * mutation that drops it (leaving the oldest-first source order). The per-row key is
     * derived from `event.seq`, so each row exposes its stable identity.
     */
    socketEvents.push(expiredEvent('cache-example:ttl:aaa', 1))
    socketEvents.push(expiredEvent('cache-example:ttl:bbb', 2))
    renderWithClient(<TtlLiveView />)
    const feed = screen.getByTestId('event-feed')
    const rows = feed.textContent ?? ''
    expect(rows.indexOf('ttl:bbb')).toBeLessThan(rows.indexOf('ttl:aaa'))
    // Newest-first row carries the seq-derived key (`getKey(event) => String(seq)`).
    expect(feed.children[0]).toHaveAttribute('data-key', '2')
    expect(feed.children[1]).toHaveAttribute('data-key', '1')
  })

  it('shows a non-namespaced expired key verbatim in the feed', () => {
    /*
     * Scenario: an expiry event whose key lacks the app namespace prefix.
     * Rule it protects: `deNamespace`'s `startsWith` false branch returns the key
     * unchanged.
     */
    socketEvents.push(expiredEvent('foreign:key:1'))
    renderWithClient(<TtlLiveView />)
    expect(screen.getByText('foreign:key:1')).toBeInTheDocument()
  })

  it('clears pending fade timers on unmount', async () => {
    /*
     * Scenario: a fade timer is scheduled, then the view unmounts before it fires.
     * Rule it protects: the unmount cleanup clears outstanding timeouts so no
     * setState fires on an unmounted tree.
     */
    // The fade-removal delay (mirrors the source `FADE_DURATION_MS`) tags the specific
    // timeout the cleanup must clear, so we can assert the EXACT timer id is cleared
    // rather than that clearTimeout merely ran (other machinery clears timers too).
    const FADE_DURATION_MS = 700
    const setSpy = vi.spyOn(globalThis, 'setTimeout')
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout')
    const { unmount } = renderWithClient(<TtlLiveView />)
    await act(async () => {
      seedTtlCb?.()
      await Promise.resolve()
    })
    await waitFor(() => expect(lastTiles.map((t) => t.key)).toContain('cache-example:ttl:abc123'))
    socketEvents.push(expiredEvent('cache-example:ttl:abc123'))
    await act(async () => {
      seedTtlCb?.()
      await Promise.resolve()
    })
    await waitFor(() => expect(lastTiles.some((t) => t.fading === true)).toBe(true))

    // The expiry effect scheduled the 700ms fade-removal timer; capture its id.
    const fadeIndex = setSpy.mock.calls.findIndex((args) => args[1] === FADE_DURATION_MS)
    expect(fadeIndex).toBeGreaterThanOrEqual(0)
    const fadeTimerId = setSpy.mock.results[fadeIndex]?.value

    unmount()
    // The unmount cleanup must clear THAT pending fade timer (an emptied effect or
    // cleanup body would leave it dangling).
    expect(clearSpy).toHaveBeenCalledWith(fadeTimerId)
  })
})
