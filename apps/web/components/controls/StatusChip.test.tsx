/**
 * @fileoverview Unit tests for `StatusChip` — the live connection status chip.
 * Drives every state-resolution branch: the live-feed override (with/without a
 * numeric latency, valid vs invalid topology mode), the polled `/health` baseline
 * (ready / degraded / unreachable), and the neutral "Connecting" default before
 * any signal. `@/hooks/use-cache-socket` is mocked to return a controllable
 * `RingBuffer`, and `@/lib/api-client`'s `api.get` is mocked so the health query
 * resolves deterministically; the component is wrapped in `QueryClientProvider` +
 * the nuqs testing adapter.
 *
 * @module components/controls/StatusChip.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { type CacheEventName } from '@bymax-one/nest-cache/shared'
import { RingBuffer, type CacheEvent } from '@/lib/socket'
import { type ApiResult } from '@/lib/api-client'

/** Mutable socket buffer the mocked hook returns; reset per test. */
let socketBuffer = new RingBuffer<CacheEvent>(100)
/** Mutable health result the mocked transport resolves. */
let healthResult: ApiResult<{ status: 'ok' | 'degraded'; latencyMs: number }> | undefined

vi.mock('@/hooks/use-cache-socket', () => ({
  useCacheSocket: () => socketBuffer,
}))

vi.mock('@/lib/api-client', () => ({
  api: {
    // Returns the controllable result as a resolved promise (mirrors the real
    // async transport without an unnecessary `await`).
    get: vi.fn(() => Promise.resolve(healthResult)),
  },
}))

// Imported after the mocks so the component binds to the mocked modules.
const { StatusChip } = await import('./StatusChip')

/** Push a `cache:connection` event onto the mocked socket buffer. */
function pushConnection(event: CacheEventName, data: Record<string, unknown>): void {
  socketBuffer.push({ kind: 'connection', seq: 0, event, data, at: Date.now() })
}

/** Render `StatusChip` with a fresh Query client and the nuqs adapter. */
function renderChip(searchParams = '') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<StatusChip />, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>
        <NuqsTestingAdapter searchParams={searchParams}>{children}</NuqsTestingAdapter>
      </QueryClientProvider>
    ),
  })
}

beforeEach(() => {
  socketBuffer = new RingBuffer<CacheEvent>(100)
  healthResult = undefined
})

describe('StatusChip', () => {
  it('defaults to Connecting before any health or live signal arrives', () => {
    /*
     * Scenario: the chip mounts before `/health` resolves and with Live off.
     * Rule it protects: with `health === undefined` and no live event, the state falls
     * through to the neutral `connecting` default.
     */
    renderChip()
    expect(screen.getByText('Connecting')).toBeInTheDocument()
  })

  it('reads Ready with latency from a healthy /health body', async () => {
    /*
     * Scenario: `/health` returns ok with a latency.
     * Rule it protects: a healthy body resolves `healthState` to `ready` and the
     * latency renders, since no live feed overrides it.
     */
    healthResult = { ok: true, data: { status: 'ok', latencyMs: 3 } }
    renderChip()
    expect(await screen.findByText('Ready')).toBeInTheDocument()
    expect(screen.getByText('3ms')).toBeInTheDocument()
  })

  it('reads Error from a degraded /health body', async () => {
    /*
     * Scenario: `/health` returns a degraded status.
     * Rule it protects: `data.status === 'degraded'` resolves `healthState` to `error`.
     */
    healthResult = { ok: true, data: { status: 'degraded', latencyMs: 9 } }
    renderChip()
    expect(await screen.findByText('Error')).toBeInTheDocument()
  })

  it('reads Error when /health is unreachable (not ok)', async () => {
    /*
     * Scenario: the transport returns a structured failure.
     * Rule it protects: the `!health.ok` arm resolves `healthState` to `error`, and
     * with no live latency the latency segment is omitted.
     */
    healthResult = {
      ok: false,
      error: { code: 'unknown', message: 'down', status: 503 },
    }
    renderChip()
    expect(await screen.findByText('Error')).toBeInTheDocument()
    expect(screen.queryByText(/ms$/)).not.toBeInTheDocument()
  })

  it('lets a live connection event override the health baseline, showing latency and a valid mode', async () => {
    /*
     * Scenario: Live is on and a `ready` connection event carries latency + a valid
     * topology mode, while /health reports degraded.
     * Rule it protects: `liveState ?? healthState` prefers the live feed; the numeric
     * `latencyMs` and the allow-listed `mode` both render.
     */
    healthResult = { ok: true, data: { status: 'degraded', latencyMs: 99 } }
    pushConnection('ready', { latencyMs: 7, mode: 'cluster' })
    renderChip('?live=true')
    expect(await screen.findByText('Ready')).toBeInTheDocument()
    expect(screen.getByText('7ms')).toBeInTheDocument()
    expect(screen.getByText('· cluster')).toBeInTheDocument()
  })

  it('ignores a non-numeric live latency and an unknown topology mode', async () => {
    /*
     * Scenario: a live `reconnecting` event with a string latency and an unrecognized
     * mode.
     * Rule it protects: the `typeof rawLatency === 'number'` and
     * `TOPOLOGY_MODES.has(rawMode)` guards drop both, so neither the latency nor the
     * mode segment renders; the spinning `reconnecting` state still resolves.
     */
    pushConnection('reconnecting', { latencyMs: 'n/a', mode: 'galaxy' })
    renderChip('?live=true')
    expect(await screen.findByText('Reconnecting')).toBeInTheDocument()
    expect(screen.queryByText(/ms$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^· /)).not.toBeInTheDocument()
  })

  it('falls back to the health latency when the live event omits it', async () => {
    /*
     * Scenario: a live `connect` event carries no latency but /health does.
     * Rule it protects: `liveLatency ?? healthData?.latencyMs` uses the health latency
     * when the live feed lacks one, and the `connecting` state spins.
     */
    healthResult = { ok: true, data: { status: 'ok', latencyMs: 4 } }
    pushConnection('connect', {})
    renderChip('?live=true')
    expect(screen.getByText('Connecting')).toBeInTheDocument()
    expect(await screen.findByText('4ms')).toBeInTheDocument()
  })
})
