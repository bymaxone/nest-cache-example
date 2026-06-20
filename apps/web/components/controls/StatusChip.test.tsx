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
    // The unknown mode string itself must never reach the DOM: pins the
    // `TOPOLOGY_MODES.has(rawMode)` allow-list guard so a mutant forcing the mode
    // condition always-true (which would render `· galaxy`) is caught.
    expect(screen.queryByText(/galaxy/)).not.toBeInTheDocument()
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

  it('only treats connection-kind events as the live state, ignoring later non-connection events', () => {
    /*
     * Scenario: a `ready` connection event is followed by a non-connection (`expired`)
     * event in the same buffer, with no /health baseline.
     * Rule it protects: `findLast(event.kind === 'connection')` skips the trailing
     * non-connection entry, so the live state still resolves to `ready` (not the
     * neutral `connecting` default a kind-agnostic mutant would fall through to).
     */
    pushConnection('ready', { latencyMs: 5 })
    socketBuffer.push({ kind: 'expired', seq: 1, key: 'cache-example:product:1', at: Date.now() })
    renderChip('?live=true')
    expect(screen.getByText('Ready')).toBeInTheDocument()
    expect(screen.queryByText('Connecting')).not.toBeInTheDocument()
    expect(screen.getByText('5ms')).toBeInTheDocument()
  })

  it('drops a non-numeric live latency and falls back to the numeric health latency', async () => {
    /*
     * Scenario: a live `ready` event carries a string latency while /health reports a
     * numeric one.
     * Rule it protects: the `typeof rawLatency === 'number'` guard rejects the string
     * so `liveLatency` is undefined and the chip renders the health latency — a mutant
     * forcing that guard always-true would surface the string and show no `…ms`.
     */
    healthResult = { ok: true, data: { status: 'ok', latencyMs: 6 } }
    pushConnection('ready', { latencyMs: 'n/a' })
    renderChip('?live=true')
    expect(await screen.findByText('6ms')).toBeInTheDocument()
    expect(screen.queryByText(/n\/a/)).not.toBeInTheDocument()
  })

  it('spins and colors the status icon while connecting (the default state)', () => {
    /*
     * Scenario: the chip sits in its neutral `connecting` default (no health, no live).
     * Rule it protects: `isSpinning` is true for `connecting`, so the icon carries the
     * `animate-spin` class — pinning the `state === 'connecting' || state === 'reconnecting'`
     * predicate (including its `'connecting'` literal and the `isSpinning && 'animate-spin'`
     * branch) and the `'animate-spin'` literal itself. The icon and label both take the
     * connecting blue from `meta.color` (jsdom normalizes `#60a5fa` to `rgb(96, 165, 250)`),
     * so the empty `style` object mutants drop the color.
     */
    const { container } = renderChip()
    expect(screen.getByText('Connecting')).toBeInTheDocument()
    const icon = container.querySelector<SVGElement>('svg')
    if (!icon) throw new Error('expected the status icon svg')
    expect(icon).toHaveClass('animate-spin')
    expect(icon.style.color).toBe('rgb(96, 165, 250)')
    expect(screen.getByText('Connecting').style.color).toBe('rgb(96, 165, 250)')
  })

  it('keeps the status icon spinning while reconnecting', () => {
    /*
     * Scenario: a live `reconnecting` event drives the chip into the spinning amber state.
     * Rule it protects: the `state === 'reconnecting'` arm of `isSpinning` (its
     * `'reconnecting'` literal and equality) keeps the icon spinning even though the state
     * is not `connecting`; the icon + label take the reconnecting amber (`#f59e0b` →
     * `rgb(245, 158, 11)`).
     */
    pushConnection('reconnecting', {})
    const { container } = renderChip('?live=true')
    expect(screen.getByText('Reconnecting')).toBeInTheDocument()
    const icon = container.querySelector<SVGElement>('svg')
    if (!icon) throw new Error('expected the status icon svg')
    expect(icon).toHaveClass('animate-spin')
    expect(icon.style.color).toBe('rgb(245, 158, 11)')
    expect(screen.getByText('Reconnecting').style.color).toBe('rgb(245, 158, 11)')
  })

  it('stops the icon spin and colors it green once ready', () => {
    /*
     * Scenario: a live `ready` event resolves the chip to the steady `ready` state.
     * Rule it protects: `isSpinning` is false for `ready`, so the icon must NOT carry
     * `animate-spin` — catching a mutant that forces `isSpinning` always-true or swaps the
     * `&&` to `||` (which would spin a steady icon). The icon + label take the ready green
     * (`#22c55e` → `rgb(34, 197, 94)`).
     */
    pushConnection('ready', {})
    const { container } = renderChip('?live=true')
    expect(screen.getByText('Ready')).toBeInTheDocument()
    const icon = container.querySelector<SVGElement>('svg')
    if (!icon) throw new Error('expected the status icon svg')
    expect(icon).not.toHaveClass('animate-spin')
    expect(icon.style.color).toBe('rgb(34, 197, 94)')
    expect(screen.getByText('Ready').style.color).toBe('rgb(34, 197, 94)')
  })
})
