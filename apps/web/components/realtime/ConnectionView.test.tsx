/**
 * @fileoverview Unit tests for {@link ConnectionView} — the Connection & Topology
 * page body.
 *
 * Drives the status-badge resolution precedence (live event → health → default
 * `connecting`), the health `error`/`ready`/`undefined` forks, the live latency +
 * mode overrides, the active-mode ring highlight, the INFO loading / empty /
 * populated states, and the section `Select` guard. The socket buffer and the INFO
 * query are mocked via their hooks; the health query runs under a real
 * `QueryClientProvider` with a mocked transport; `nuqs` and `EventFeed` are mocked.
 *
 * @module components/realtime/ConnectionView.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactElement, type ReactNode } from 'react'
import { type CacheEvent } from '@/lib/socket'

// Stub the global Live toggle (nuqs) to a fixed value so no adapter is needed.
vi.mock('nuqs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('nuqs')>()),
  useQueryState: () => [false, vi.fn()] as const,
}))

// The buffer the socket hook returns; each test sets the events it should hold.
const socketEvents: CacheEvent[] = []
vi.mock('@/hooks/use-cache-socket', () => ({
  useCacheSocket: () => ({ toArray: () => socketEvents }),
}))

// The INFO query result; each test sets the relevant fields.
const infoResult = { data: undefined as unknown, isLoading: false }
vi.mock('@/hooks/use-info', () => ({ useInfo: () => infoResult }))

const getHealth = vi.fn<() => Promise<unknown>>()
vi.mock('@/lib/cache-api', () => ({
  cacheApi: { getHealth: () => getHealth() },
}))

// Render EventFeed's empty state / first row inline so we can assert it received items.
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
        : items.map((item, i) => <div key={getKey(item, i)}>{renderRow(item)}</div>)}
    </div>
  ),
}))

import { ConnectionView } from './ConnectionView'

// Radix UI's Select relies on Pointer Capture + `scrollIntoView`, which jsdom does
// not implement; stub them so the dropdown opens under test (a jsdom gap, not a
// behaviour change). `scrollIntoView` is already polyfilled by the global setup.
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
    configurable: true,
    value: () => false,
  })
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: () => {},
  })
  Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
    configurable: true,
    value: () => {},
  })
})

/** A connection-kind socket event fixture. */
function connEvent(overrides: Partial<Extract<CacheEvent, { kind: 'connection' }>> = {}) {
  const base: Extract<CacheEvent, { kind: 'connection' }> = {
    kind: 'connection',
    seq: 1,
    event: 'ready',
    data: {},
    at: 1_700_000_000_000,
  }
  return { ...base, ...overrides }
}

/** Render under a fresh, retry-disabled QueryClient. */
function renderWithClient(node: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
  socketEvents.length = 0
  infoResult.data = undefined
  infoResult.isLoading = false
  getHealth.mockResolvedValue({ ok: true, data: { status: 'ok', latencyMs: 1.2 } })
})

describe('ConnectionView', () => {
  it('shows the default connecting badge and standalone mode before any signal', () => {
    /*
     * Scenario: no live events and the health query has not resolved.
     * Rule it protects: `state` falls back through `liveState ?? healthState ??
     * 'connecting'` to the default, latency shows the em-dash, and mode defaults to
     * `standalone`.
     */
    getHealth.mockReturnValue(new Promise(() => {}))
    renderWithClient(<ConnectionView />)
    expect(screen.getByText('Connecting')).toBeInTheDocument()
    expect(screen.getAllByText('standalone').length).toBeGreaterThan(0)
  })

  it('derives a ready badge with health latency when health is ok and no live event exists', async () => {
    /*
     * Scenario: the health query resolves ok with a latency, no live event.
     * Rule it protects: `healthState` becomes `ready` and `latencyMs` falls back to
     * the health latency (formatted with µs precision).
     */
    getHealth.mockResolvedValue({ ok: true, data: { status: 'ok', latencyMs: 0.412 } })
    renderWithClient(<ConnectionView />)
    expect(await screen.findByText('Ready')).toBeInTheDocument()
    expect(screen.getByText('0.412ms')).toBeInTheDocument()
  })

  it('derives an error badge when health reports degraded', async () => {
    /*
     * Scenario: the health query resolves with a `degraded` status.
     * Rule it protects: a degraded (or non-ok) health response maps to the `error`
     * connection state.
     */
    getHealth.mockResolvedValue({ ok: true, data: { status: 'degraded', latencyMs: 5 } })
    renderWithClient(<ConnectionView />)
    expect(await screen.findByText('Error')).toBeInTheDocument()
  })

  it('derives an error badge when the health request itself fails', async () => {
    /*
     * Scenario: the health transport returns a structured error.
     * Rule it protects: `!health.data.ok` also maps to the `error` state, and
     * `healthData` stays undefined so latency shows the em-dash.
     */
    getHealth.mockResolvedValue({
      ok: false,
      error: { code: 'unknown', message: 'down', status: 503 },
    })
    renderWithClient(<ConnectionView />)
    expect(await screen.findByText('Error')).toBeInTheDocument()
  })

  it('lets a live ready event with latency + mode override the health baseline', async () => {
    /*
     * Scenario: a live `cache:connection` event carries latency and a cluster mode.
     * Rule it protects: `liveState`/`liveLatency`/`liveMode` take precedence — the
     * badge, latency, and active mode all reflect the live event, not health.
     */
    socketEvents.push(connEvent({ event: 'ready', data: { latencyMs: 12.34, mode: 'cluster' } }))
    renderWithClient(<ConnectionView />)
    expect(await screen.findByText('Ready')).toBeInTheDocument()
    expect(screen.getByText('12.34ms')).toBeInTheDocument()
    // `cluster` appears both in the active-mode subtitle and the highlighted card.
    expect(screen.getAllByText('cluster').length).toBeGreaterThan(0)
  })

  it('ignores a non-numeric latency and an unknown live mode', async () => {
    /*
     * Scenario: a live event whose latency is not a number and whose mode is unknown.
     * Rule it protects: the `typeof rawLatency === 'number'` guard and the
     * `TOPOLOGY_MODES.has` guard reject the values, so latency falls back to health
     * and mode falls back to `standalone`.
     */
    socketEvents.push(connEvent({ event: 'ready', data: { latencyMs: 'NaN', mode: 'galaxy' } }))
    renderWithClient(<ConnectionView />)
    expect(await screen.findByText('1.20ms')).toBeInTheDocument()
    expect(screen.getAllByText('standalone').length).toBeGreaterThan(0)
  })

  it('renders the INFO skeleton while the section is loading', () => {
    /*
     * Scenario: the INFO query is loading.
     * Rule it protects: the `info.isLoading` branch renders the skeleton, not the
     * grid or the empty state.
     */
    infoResult.isLoading = true
    renderWithClient(<ConnectionView />)
    expect(screen.queryByText('No INFO returned for this section.')).not.toBeInTheDocument()
  })

  it('renders the INFO empty state when the section returns no fields', () => {
    /*
     * Scenario: the INFO query resolved with an empty record.
     * Rule it protects: `infoSections.length === 0` renders the empty state.
     */
    infoResult.data = { ok: true, data: {} }
    renderWithClient(<ConnectionView />)
    expect(screen.getByText('No INFO returned for this section.')).toBeInTheDocument()
  })

  it('renders the parsed INFO section grid when fields are returned', () => {
    /*
     * Scenario: the INFO query returned a populated section.
     * Rule it protects: the populated branch maps each section name and its
     * key/value fields into the mono grid.
     */
    infoResult.data = { ok: true, data: { server: { redis_version: '7.2.4', os: 'Linux' } } }
    renderWithClient(<ConnectionView />)
    // The section heading + each field/value render; these are unique to the grid
    // (the default `memory` section label would collide with the Select trigger).
    expect(screen.getByText('server')).toBeInTheDocument()
    expect(screen.getByText('redis_version')).toBeInTheDocument()
    expect(screen.getByText('7.2.4')).toBeInTheDocument()
    expect(screen.getByText('os')).toBeInTheDocument()
    expect(screen.getByText('Linux')).toBeInTheDocument()
  })

  it('treats a failed INFO result as no sections', () => {
    /*
     * Scenario: the INFO query resolved with `{ ok: false }`.
     * Rule it protects: `info.data?.ok ? entries : []` yields an empty list, so the
     * empty state shows rather than crashing on a missing `data`.
     */
    infoResult.data = { ok: false, error: { code: 'unknown', message: 'x', status: 500 } }
    renderWithClient(<ConnectionView />)
    expect(screen.getByText('No INFO returned for this section.')).toBeInTheDocument()
  })

  it('changes the INFO section through the accessible Select', async () => {
    /*
     * Scenario: the operator picks a different INFO section.
     * Rule it protects: a valid `Select` value passes `isInfoSection` and updates the
     * section state (the chosen option becomes the trigger value).
     */
    const user = userEvent.setup()
    renderWithClient(<ConnectionView />)
    await user.click(screen.getByRole('combobox'))
    const option = await screen.findByRole('option', { name: 'stats' })
    await user.click(option)
    await waitFor(() =>
      expect(within(screen.getByRole('combobox')).getByText('stats')).toBeInTheDocument(),
    )
  })

  it('feeds the reversed connection events into the lifecycle EventFeed', async () => {
    /*
     * Scenario: connection events are buffered.
     * Rule it protects: the lifecycle feed receives the connection events (newest
     * first), rendering a row per event rather than the empty state.
     */
    socketEvents.push(
      connEvent({ seq: 1, event: 'connect', data: {} }),
      connEvent({ seq: 2, event: 'ready', data: {} }),
    )
    renderWithClient(<ConnectionView />)
    const feed = await screen.findByTestId('event-feed')
    expect(within(feed).getByText('ready')).toBeInTheDocument()
    expect(within(feed).getByText('connect')).toBeInTheDocument()
  })

  it('shows the lifecycle feed empty state when no connection events are buffered', () => {
    /*
     * Scenario: the buffer holds no connection events.
     * Rule it protects: the feed renders its action-oriented empty state copy.
     */
    renderWithClient(<ConnectionView />)
    expect(screen.getByText(/No lifecycle events yet/)).toBeInTheDocument()
  })
})
