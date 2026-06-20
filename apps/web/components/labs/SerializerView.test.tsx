/**
 * @fileoverview Unit tests for {@link SerializerView} — the Serializer Lab body.
 * Mocks the `serializerApi` transport (`active`/`roundtrip`/`caveat`) and the
 * `sonner` toaster, wraps the view in a retry-disabled TanStack Query client,
 * and drives: the active-serializer banner (present vs absent), the codec
 * selector, payload validation (invalid JSON, non-object, valid → round-trip),
 * the round-trip result panel, the Date-caveat panel (survived vs lost, plus the
 * null-raw byte branch), and both mutation error paths (API vs plain error).
 *
 * @module components/labs/SerializerView.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode } from 'react'
import { type ApiResult } from '@/lib/api-client'
import {
  type ActiveSerializerResponse,
  type CaveatResult,
  type RoundtripResult,
} from '@/lib/labs-api'
import { SerializerView } from './SerializerView'

const activeMock = vi.fn<() => Promise<ApiResult<ActiveSerializerResponse>>>()
const roundtripMock = vi.fn<() => Promise<ApiResult<RoundtripResult>>>()
const caveatMock = vi.fn<() => Promise<ApiResult<CaveatResult>>>()
vi.mock('@/lib/labs-api', () => ({
  serializerApi: {
    active: (...args: unknown[]) => activeMock(...(args as [])),
    roundtrip: (...args: unknown[]) => roundtripMock(...(args as [])),
    caveat: (...args: unknown[]) => caveatMock(...(args as [])),
  },
}))

const toastError = vi.fn()
vi.mock('sonner', () => ({
  toast: { error: (...args: unknown[]) => void toastError(...args) },
}))

/** A successful round-trip result. */
function okRoundtrip(): ApiResult<RoundtripResult> {
  return {
    ok: true,
    data: { codec: 'json', raw: '{"id":42}', decoded: { id: 42 }, rawBytes: 9, rawBypass: null },
  }
}

/** Wrap children in a retry-disabled query client. */
function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  activeMock.mockReset()
  roundtripMock.mockReset()
  caveatMock.mockReset()
  toastError.mockClear()
  // Default: the active-serializer query never resolves, so the banner is absent
  // unless a test opts in.
  activeMock.mockReturnValue(new Promise(() => {}))
})

describe('SerializerView', () => {
  it('renders the input without the active banner before the active query resolves', () => {
    /*
     * Scenario: the active-serializer query has not resolved yet.
     * Rule it protects: the `activeName` is undefined so the ` · active:` suffix is
     * not rendered, while the base route label still shows.
     */
    render(<SerializerView />, { wrapper: Wrapper })
    expect(screen.getByText(/POST \/serializer\/roundtrip/)).toBeInTheDocument()
    expect(screen.queryByText(/active:/)).not.toBeInTheDocument()
  })

  it('shows the active serializer name once the active query resolves ok', async () => {
    /*
     * Scenario: the active-serializer query resolves with the injected codec name.
     * Rule it protects: an `ok` active query renders the ` · active: <name>` suffix —
     * both the literal ` · active: ` prefix and the injected name must be present.
     */
    activeMock.mockResolvedValue({ ok: true, data: { serializer: 'JsonSerializer' } })
    render(<SerializerView />, { wrapper: Wrapper })
    await waitFor(() => expect(screen.getByText('JsonSerializer')).toBeInTheDocument())
    expect(screen.getByText(/· active:/)).toBeInTheDocument()
  })

  it('does not show the active name when the active query resolves with an error', async () => {
    /*
     * Scenario: the active-serializer query resolves a typed error.
     * Rule it protects: a non-ok active result leaves `activeName` undefined (no suffix).
     */
    activeMock.mockResolvedValue({
      ok: false,
      error: { code: 'unknown', message: 'no serializer', status: 500 },
    })
    render(<SerializerView />, { wrapper: Wrapper })
    // Give the query a tick to settle, then confirm the suffix never appears.
    await waitFor(() => expect(activeMock).toHaveBeenCalled())
    expect(screen.queryByText(/active:/)).not.toBeInTheDocument()
  })

  it('shows a JSON error when the payload is not valid JSON', async () => {
    /*
     * Scenario: the payload textarea contains invalid JSON.
     * Rule it protects: the parse `catch` sets the inline error, toasts, and does
     * not call the round-trip endpoint.
     */
    const user = userEvent.setup()
    render(<SerializerView />, { wrapper: Wrapper })
    const textarea = screen.getByLabelText('payload (JSON object)')
    await user.clear(textarea)
    await user.type(textarea, 'not json')
    await user.click(screen.getByRole('button', { name: 'Round-trip' }))
    expect(screen.getByText('Payload is not valid JSON')).toBeInTheDocument()
    expect(toastError).toHaveBeenCalledWith('Payload is not valid JSON')
    expect(roundtripMock).not.toHaveBeenCalled()
  })

  it('rejects a payload that parses to a non-object (array)', async () => {
    /*
     * Scenario: the payload is valid JSON but an array, not an object.
     * Rule it protects: the object-shape guard sets the must-be-object error and
     * skips the round-trip call.
     */
    const user = userEvent.setup()
    render(<SerializerView />, { wrapper: Wrapper })
    const textarea = screen.getByLabelText('payload (JSON object)')
    // `fireEvent.change` sets the raw value directly so JSON punctuation like `[`
    // is not interpreted as user-event keyboard syntax.
    fireEvent.change(textarea, { target: { value: '[1,2]' } })
    await user.click(screen.getByRole('button', { name: 'Round-trip' }))
    expect(screen.getByText('Payload must be a JSON object')).toBeInTheDocument()
    expect(roundtripMock).not.toHaveBeenCalled()
  })

  it('rejects a payload that parses to a primitive (number)', async () => {
    /*
     * Scenario: the payload is valid JSON but a bare number, not an object.
     * Rule it protects: `typeof parsed !== 'object'` is the active OR clause, so a
     * primitive is rejected — distinguishing the `||` from an `&&` mutant (which
     * would let the number reach the round-trip) and the always-false guard mutant.
     */
    const user = userEvent.setup()
    render(<SerializerView />, { wrapper: Wrapper })
    const textarea = screen.getByLabelText('payload (JSON object)')
    fireEvent.change(textarea, { target: { value: '42' } })
    await user.click(screen.getByRole('button', { name: 'Round-trip' }))
    expect(screen.getByText('Payload must be a JSON object')).toBeInTheDocument()
    expect(roundtripMock).not.toHaveBeenCalled()
  })

  it('rejects a payload that parses to JSON null', async () => {
    /*
     * Scenario: the payload is the literal `null` (valid JSON, `typeof` object).
     * Rule it protects: the `parsed === null` clause rejects null — a `!== null`
     * mutant would treat null as a valid object and call the round-trip endpoint.
     */
    const user = userEvent.setup()
    render(<SerializerView />, { wrapper: Wrapper })
    const textarea = screen.getByLabelText('payload (JSON object)')
    fireEvent.change(textarea, { target: { value: 'null' } })
    await user.click(screen.getByRole('button', { name: 'Round-trip' }))
    expect(screen.getByText('Payload must be a JSON object')).toBeInTheDocument()
    expect(roundtripMock).not.toHaveBeenCalled()
  })

  it('round-trips a valid object payload and renders the comparison', async () => {
    /*
     * Scenario: a valid object payload (the default) is round-tripped.
     * Rule it protects: a valid payload calls the endpoint and renders the
     * raw-vs-decoded comparison card.
     */
    roundtripMock.mockResolvedValue(okRoundtrip())
    const user = userEvent.setup()
    render(<SerializerView />, { wrapper: Wrapper })
    await user.click(screen.getByRole('button', { name: 'Round-trip' }))
    await waitFor(() =>
      expect(screen.getByText('Round-trip — raw bytes vs decoded')).toBeInTheDocument(),
    )
    expect(roundtripMock).toHaveBeenCalledTimes(1)
  })

  it('shows the Storing label and skeleton while a round-trip is in flight', async () => {
    /*
     * Scenario: a round-trip is fired but has not resolved yet.
     * Rule it protects: the in-flight state reads "Storing…" on the button and
     * shows the round-trip skeleton.
     */
    let resolve: (value: ApiResult<RoundtripResult>) => void = () => {}
    roundtripMock.mockReturnValue(
      new Promise<ApiResult<RoundtripResult>>((r) => {
        resolve = r
      }),
    )
    const user = userEvent.setup()
    render(<SerializerView />, { wrapper: Wrapper })
    await user.click(screen.getByRole('button', { name: 'Round-trip' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Storing…' })).toBeInTheDocument(),
    )
    // Settle the mutation before teardown.
    resolve(okRoundtrip())
    await waitFor(() =>
      expect(screen.getByText('Round-trip — raw bytes vs decoded')).toBeInTheDocument(),
    )
  })

  it('switches the active codec via the selector', async () => {
    /*
     * Scenario: the user selects the `msgpack` codec.
     * Rule it protects: `json` is the initial codec (pressed) per the default state,
     * and clicking a codec toggles its pressed state (and labels the subsequent
     * request) — `codec === option` drives `aria-pressed`.
     */
    const user = userEvent.setup()
    render(<SerializerView />, { wrapper: Wrapper })
    const msgpack = screen.getByRole('button', { name: 'msgpack' })
    // The default codec is `json`, so json starts pressed and msgpack does not.
    expect(screen.getByRole('button', { name: 'json' })).toHaveAttribute('aria-pressed', 'true')
    expect(msgpack).toHaveAttribute('aria-pressed', 'false')
    await user.click(msgpack)
    expect(msgpack).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'json' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('applies the pressed vs unpressed codec classNames to the selected button', async () => {
    /*
     * Scenario: json is the default (pressed) codec; the user switches to msgpack.
     * Rule it protects: `codec === option` selects between the two className string
     * literals, so the selected button carries the pressed pill (`bg-brand-500`,
     * `text-white`) while the unselected one carries the muted pill
     * (`text-muted-foreground`, no `bg-brand-500`). A forced-true/false condition,
     * an inverted equality, or an emptied className string lands the wrong classes.
     */
    const user = userEvent.setup()
    render(<SerializerView />, { wrapper: Wrapper })
    const json = screen.getByRole('button', { name: 'json' })
    const msgpack = screen.getByRole('button', { name: 'msgpack' })
    // Default: json is pressed (brand pill), msgpack is muted.
    expect(json).toHaveClass('bg-brand-500', 'text-white')
    expect(msgpack).toHaveClass('text-muted-foreground')
    expect(msgpack).not.toHaveClass('bg-brand-500')
    // After switching, the pressed/unpressed classes swap to msgpack.
    await user.click(msgpack)
    expect(msgpack).toHaveClass('bg-brand-500', 'text-white')
    expect(json).toHaveClass('text-muted-foreground')
    expect(json).not.toHaveClass('bg-brand-500')
  })

  it('labels the request with the selected codec when round-tripping', async () => {
    /*
     * Scenario: the user picks `msgpack`, then round-trips the default payload.
     * Rule it protects: the initial codec is `json` (not an empty string), and the
     * selected codec is passed as the first argument to the round-trip request.
     */
    roundtripMock.mockResolvedValue(okRoundtrip())
    const user = userEvent.setup()
    render(<SerializerView />, { wrapper: Wrapper })
    await user.click(screen.getByRole('button', { name: 'msgpack' }))
    await user.click(screen.getByRole('button', { name: 'Round-trip' }))
    await waitFor(() => expect(roundtripMock).toHaveBeenCalledTimes(1))
    expect(roundtripMock).toHaveBeenCalledWith('msgpack', expect.any(Object))
  })

  it('renders the BYMAX_CACHE_SERIALIZER explainer with both env-var examples', () => {
    /*
     * Scenario: the static input-card explainer copy.
     * Rule it protects: the explainer names `BYMAX_CACHE_SERIALIZER` and shows the
     * `CACHE_SERIALIZER=json` vs `=msgpack` comparison hints — pinning those string
     * literals against empty-string mutants. The paragraph textContent also pins the
     * `{' '}` spacer literals that separate the prose from each mono span, so blanking
     * a spacer (which would fuse two words) is caught.
     */
    render(<SerializerView />, { wrapper: Wrapper })
    expect(screen.getByText('BYMAX_CACHE_SERIALIZER')).toBeInTheDocument()
    expect(screen.getByText('CACHE_SERIALIZER=json')).toBeInTheDocument()
    expect(screen.getByText('=msgpack')).toBeInTheDocument()
    const explainer = screen.getByText('BYMAX_CACHE_SERIALIZER').closest('p')
    expect(explainer).not.toBeNull()
    expect(explainer?.textContent).toContain('fixed per instance via BYMAX_CACHE_SERIALIZER')
    expect(explainer?.textContent).toContain('Run the API with CACHE_SERIALIZER=json')
    expect(explainer?.textContent).toContain('json vs =msgpack')
  })

  it('renders the SerializableValue footer caveat naming each unsupported type', () => {
    /*
     * Scenario: the static footer caveat copy.
     * Rule it protects: the footer enumerates the JSON-lossy types — `Date`, `Map`,
     * `Set`, `BigInt`, `undefined`, and the `ISerializer` escape hatch — pinning
     * those string literals against empty-string mutants. The paragraph textContent
     * also pins the `{' '}` spacer literals between the enumerated mono spans, so a
     * blanked spacer (which would fuse two type names) is caught.
     */
    render(<SerializerView />, { wrapper: Wrapper })
    expect(screen.getByText('Map')).toBeInTheDocument()
    expect(screen.getByText('Set')).toBeInTheDocument()
    expect(screen.getByText('BigInt')).toBeInTheDocument()
    expect(screen.getByText('undefined')).toBeInTheDocument()
    expect(screen.getByText('ISerializer')).toBeInTheDocument()
    const footer = screen.getByText('ISerializer').closest('p')
    expect(footer).not.toBeNull()
    expect(footer?.textContent).toContain('Map, Set')
    expect(footer?.textContent).toContain('Set, BigInt')
    expect(footer?.textContent).toContain('BigInt, or undefined')
    expect(footer?.textContent).toContain('custom ISerializer')
  })

  it('runs the Date caveat and shows the survived badge with a non-null raw byte count', async () => {
    /*
     * Scenario: a caveat run where the Date survived (structure-preserving codec).
     * Rule it protects: the caveat card renders the survived badge, the note, and a
     * non-null raw drives the byte-count branch (not the zero fallback).
     */
    caveatMock.mockResolvedValue({
      ok: true,
      data: {
        codec: 'msgpack',
        raw: 'BINARY',
        decoded: { when: '2026' },
        dateSurvived: true,
        note: 'Date survived the round-trip',
      },
    })
    const user = userEvent.setup()
    render(<SerializerView />, { wrapper: Wrapper })
    await user.click(screen.getByRole('button', { name: 'Run Date caveat' }))
    await waitFor(() => expect(screen.getByText('Date survived')).toBeInTheDocument())
    expect(screen.getByText('Date survived the round-trip')).toBeInTheDocument()
    // The survived state drives the Badge `secondary` variant string literal, whose
    // class tokens differ from the destructive lost state (pins the variant literal).
    expect(screen.getByText('Date survived')).toHaveClass(
      'bg-secondary',
      'text-secondary-foreground',
    )
    // raw is non-null ('BINARY' → 6 bytes), so the `raw === null` branch is NOT
    // taken: the byte count is the encoded length, not the zero fallback.
    expect(screen.getByText('6 B')).toBeInTheDocument()
  })

  it('shows the Date-lost badge and the zero-byte fallback when raw is null', async () => {
    /*
     * Scenario: a caveat run where the Date was lost and the key was evicted (null raw).
     * Rule it protects: the lost-badge label renders and the `raw === null` branch
     * reports a zero byte count (the evicted fallback).
     */
    caveatMock.mockResolvedValue({
      ok: true,
      data: {
        codec: 'json',
        raw: null,
        decoded: { when: '2026-06-01T12:00:00.000Z' },
        dateSurvived: false,
        note: 'Date became an ISO string',
      },
    })
    const user = userEvent.setup()
    render(<SerializerView />, { wrapper: Wrapper })
    await user.click(screen.getByRole('button', { name: 'Run Date caveat' }))
    await waitFor(() => expect(screen.getByText('Date lost (→ ISO string)')).toBeInTheDocument())
    // The lost state drives the Badge `destructive` variant string literal (pins it).
    expect(screen.getByText('Date lost (→ ISO string)')).toHaveClass(
      'bg-destructive',
      'text-destructive-foreground',
    )
    // The evicted (null) raw renders the SerializerCompare eviction placeholder.
    expect(screen.getByText('— (key evicted)')).toBeInTheDocument()
    // raw === null takes the zero-byte branch (no encode of a null string).
    expect(screen.getByText('0 B')).toBeInTheDocument()
  })

  it('toasts the API error message when a round-trip fails with a structured error', async () => {
    /*
     * Scenario: the round-trip endpoint returns a structured cache error.
     * Rule it protects: an `ApiRequestError` surfaces its API message via the toast.
     */
    roundtripMock.mockResolvedValue({
      ok: false,
      error: { code: 'cache.serialization_failed', message: 'cannot serialize', status: 500 },
    })
    const user = userEvent.setup()
    render(<SerializerView />, { wrapper: Wrapper })
    await user.click(screen.getByRole('button', { name: 'Round-trip' }))
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Round-trip failed', {
        description: 'cannot serialize',
      }),
    )
  })

  it('toasts a plain error message when the caveat run rejects with a non-API error', async () => {
    /*
     * Scenario: the caveat run rejects with a generic Error.
     * Rule it protects: the non-`ApiRequestError` branch uses the error's own message.
     */
    caveatMock.mockRejectedValue(new Error('boom'))
    const user = userEvent.setup()
    render(<SerializerView />, { wrapper: Wrapper })
    await user.click(screen.getByRole('button', { name: 'Run Date caveat' }))
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Caveat run failed', { description: 'boom' }),
    )
  })

  it('toasts a plain error message when a round-trip rejects with a non-API error', async () => {
    /*
     * Scenario: the round-trip rejects with a generic Error (network/CORS).
     * Rule it protects: the round-trip non-`ApiRequestError` branch uses the
     * error's own message.
     */
    roundtripMock.mockRejectedValue(new Error('socket hang up'))
    const user = userEvent.setup()
    render(<SerializerView />, { wrapper: Wrapper })
    await user.click(screen.getByRole('button', { name: 'Round-trip' }))
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Round-trip failed', {
        description: 'socket hang up',
      }),
    )
  })

  it('toasts the API error message when a caveat fails with a structured error', async () => {
    /*
     * Scenario: the caveat endpoint returns a structured cache error.
     * Rule it protects: the caveat `ApiRequestError` branch surfaces its API message.
     */
    caveatMock.mockResolvedValue({
      ok: false,
      error: { code: 'cache.deserialization_failed', message: 'bad bytes', status: 500 },
    })
    const user = userEvent.setup()
    render(<SerializerView />, { wrapper: Wrapper })
    await user.click(screen.getByRole('button', { name: 'Run Date caveat' }))
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Caveat run failed', { description: 'bad bytes' }),
    )
  })

  it('shows the Running label while a caveat run is in flight', async () => {
    /*
     * Scenario: a caveat run is fired but has not resolved yet.
     * Rule it protects: the in-flight caveat button reads "Running…".
     */
    let resolve: (value: ApiResult<CaveatResult>) => void = () => {}
    caveatMock.mockReturnValue(
      new Promise<ApiResult<CaveatResult>>((r) => {
        resolve = r
      }),
    )
    const user = userEvent.setup()
    render(<SerializerView />, { wrapper: Wrapper })
    await user.click(screen.getByRole('button', { name: 'Run Date caveat' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Running…' })).toBeInTheDocument(),
    )
    resolve({
      ok: true,
      data: { codec: 'json', raw: 'x', decoded: {}, dateSurvived: true, note: 'ok' },
    })
    await waitFor(() => expect(screen.getByText('Date survived')).toBeInTheDocument())
  })
})
