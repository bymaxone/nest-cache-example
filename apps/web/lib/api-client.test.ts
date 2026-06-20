/**
 * @fileoverview Unit tests for the typed `fetch` transport (`lib/api-client`).
 *
 * Covers the app-controlled path guard (reject non-`/` and `..` paths), the
 * structured-error decoder `toApiError` (known code, unknown/missing code, missing
 * message fallback, details present vs absent), the 204 no-body path, the
 * json-parse-failure fallback, the default content-type header, and the
 * `api.get/post/del` verb helpers with and without a JSON body. `fetch` is stubbed
 * — the real network is never hit.
 *
 * @module lib/api-client.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiFetch, api, type ApiResult } from './api-client'

/** Build a minimal `Response`-like stub for the stubbed `fetch`. */
function res(opts: { ok: boolean; status: number; json?: () => Promise<unknown> }): Response {
  return {
    ok: opts.ok,
    status: opts.status,
    json: opts.json ?? (() => Promise.resolve(null)),
  } as Response
}

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiFetch path guard', () => {
  it('throws when the path does not start with a slash', async () => {
    /*
     * Scenario: a caller passes a relative or absolute-URL path.
     * Rule it protects: only app-controlled `/`-prefixed paths are allowed, so a
     * user-controlled value cannot escape the intended route.
     */
    await expect(apiFetch('health')).rejects.toThrow('apiFetch: invalid path "health"')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws when the path contains a parent-directory segment', async () => {
    /*
     * Scenario: a path tries to traverse upward with `..`.
     * Rule it protects: `..` segments are rejected before any fetch, blocking path
     * traversal.
     */
    await expect(apiFetch('/a/../b')).rejects.toThrow('apiFetch: invalid path "/a/../b"')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('apiFetch success decoding', () => {
  it('returns ok with the decoded body and sets a default JSON content-type', async () => {
    /*
     * Scenario: a 200 response with a JSON body and no caller-set content type.
     * Rule it protects: the result is `{ ok: true, data }` and the request carries
     * a default `content-type: application/json` header.
     */
    fetchMock.mockResolvedValue(
      res({ ok: true, status: 200, json: () => Promise.resolve({ a: 1 }) }),
    )
    const out = await apiFetch<{ a: number }>('/thing')
    expect(out).toEqual({ ok: true, data: { a: 1 } })
    // The request URL must be the base joined to the path — a blanked `${BASE}${path}`
    // template would fetch an empty string.
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/thing$/), expect.anything())
    const init = fetchMock.mock.calls[0]?.[1]
    const headers = init?.headers as Headers
    expect(headers.get('content-type')).toBe('application/json')
  })

  it('preserves a caller-supplied content-type instead of overriding it', async () => {
    /*
     * Scenario: a caller sends a non-JSON body with its own content type.
     * Rule it protects: the default header is only applied when absent, so an
     * explicit content type survives.
     */
    fetchMock.mockResolvedValue(res({ ok: true, status: 200, json: () => Promise.resolve(null) }))
    await apiFetch('/thing', { headers: { 'content-type': 'text/plain' } })
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers
    expect(headers.get('content-type')).toBe('text/plain')
  })

  it('treats a 204 as a null body without calling json()', async () => {
    /*
     * Scenario: a 204 No Content response.
     * Rule it protects: the body is taken as `null` (no `json()` parse) so an empty
     * response does not throw.
     */
    const jsonSpy = vi.fn(() => Promise.resolve({ shouldNotBeRead: true }))
    fetchMock.mockResolvedValue(res({ ok: true, status: 204, json: jsonSpy }))
    const out = await apiFetch('/del')
    expect(out).toEqual({ ok: true, data: null })
    expect(jsonSpy).not.toHaveBeenCalled()
  })

  it('falls back to a null body when json parsing rejects', async () => {
    /*
     * Scenario: a 200 with an unparseable body.
     * Rule it protects: the `.catch(() => null)` swallows the parse error so the
     * result is still `{ ok: true, data: null }`.
     */
    fetchMock.mockResolvedValue(
      res({ ok: true, status: 200, json: () => Promise.reject(new Error('bad json')) }),
    )
    const out = await apiFetch('/thing')
    expect(out).toEqual({ ok: true, data: null })
  })
})

describe('apiFetch error decoding (toApiError)', () => {
  it('decodes a known cache error code with its message and details', async () => {
    /*
     * Scenario: the API filter returns a recognized code with details.
     * Rule it protects: a known `CacheErrorCode` is preserved, the message passes
     * through, and the details payload is attached.
     */
    fetchMock.mockResolvedValue(
      res({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            error: { code: 'cache.invalid_key', message: 'bad key', details: { key: 'x' } },
          }),
      }),
    )
    const out = (await apiFetch('/x')) as Extract<ApiResult<unknown>, { ok: false }>
    expect(out.ok).toBe(false)
    expect(out.error).toEqual({
      code: 'cache.invalid_key',
      message: 'bad key',
      status: 400,
      details: { key: 'x' },
    })
  })

  it('falls back to "unknown" code and a synthesized message when the body is empty', async () => {
    /*
     * Scenario: a non-2xx with no structured error body (null after parse).
     * Rule it protects: an unrecognized/absent code becomes `'unknown'`, the
     * message is synthesized from the status, and no `details` key is added.
     */
    fetchMock.mockResolvedValue(res({ ok: false, status: 500, json: () => Promise.resolve(null) }))
    const out = (await apiFetch('/x')) as Extract<ApiResult<unknown>, { ok: false }>
    expect(out.error).toEqual({ code: 'unknown', message: 'Request failed (500)', status: 500 })
    expect('details' in out.error).toBe(false)
  })

  it('maps an unrecognized code to "unknown" while keeping the provided message', async () => {
    /*
     * Scenario: the body carries a code that is not in CACHE_ERROR_CODES.
     * Rule it protects: an off-list code narrows to `'unknown'` but the supplied
     * message is still surfaced.
     */
    fetchMock.mockResolvedValue(
      res({
        ok: false,
        status: 418,
        json: () => Promise.resolve({ error: { code: 'not.a.real.code', message: 'teapot' } }),
      }),
    )
    const out = (await apiFetch('/x')) as Extract<ApiResult<unknown>, { ok: false }>
    expect(out.error.code).toBe('unknown')
    expect(out.error.message).toBe('teapot')
  })
})

describe('api verb helpers', () => {
  it('get issues a plain request', async () => {
    /*
     * Scenario: a typed GET.
     * Rule it protects: `api.get` delegates to `apiFetch` with no method override
     * (default GET) and returns the typed result.
     */
    fetchMock.mockResolvedValue(res({ ok: true, status: 200, json: () => Promise.resolve('g') }))
    const out = await api.get<string>('/g')
    expect(out).toEqual({ ok: true, data: 'g' })
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBeUndefined()
  })

  it('post serializes a JSON body when one is provided', async () => {
    /*
     * Scenario: a POST with a JSON payload.
     * Rule it protects: `api.post` sets method POST and JSON-stringifies the body.
     */
    fetchMock.mockResolvedValue(res({ ok: true, status: 200, json: () => Promise.resolve(1) }))
    await api.post<number>('/p', { n: 5 })
    const init = fetchMock.mock.calls[0]?.[1]
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe(JSON.stringify({ n: 5 }))
  })

  it('post omits the body entirely for a bodyless POST', async () => {
    /*
     * Scenario: a bodyless POST (e.g. `/persist`).
     * Rule it protects: when `json` is undefined the `body` key is omitted (not set
     * to undefined), satisfying exactOptionalPropertyTypes.
     */
    fetchMock.mockResolvedValue(res({ ok: true, status: 200, json: () => Promise.resolve(1) }))
    await api.post<number>('/p')
    const init = fetchMock.mock.calls[0]?.[1]
    expect(init?.method).toBe('POST')
    expect(init && 'body' in init).toBe(false)
  })

  it('del serializes a JSON body when provided and omits it otherwise', async () => {
    /*
     * Scenario: a DELETE with a ref-counted unsubscribe body, then a bodyless one.
     * Rule it protects: `api.del` sets method DELETE, stringifies a provided body,
     * and omits the body key when none is passed.
     */
    fetchMock.mockResolvedValue(res({ ok: true, status: 200, json: () => Promise.resolve(0) }))
    await api.del<number>('/d', { channel: 'c' })
    const withBody = fetchMock.mock.calls[0]?.[1]
    expect(withBody?.method).toBe('DELETE')
    expect(withBody?.body).toBe(JSON.stringify({ channel: 'c' }))

    fetchMock.mockResolvedValue(res({ ok: true, status: 200, json: () => Promise.resolve(0) }))
    await api.del<number>('/d')
    const noBody = fetchMock.mock.calls[1]?.[1]
    expect(noBody?.method).toBe('DELETE')
    expect(noBody && 'body' in noBody).toBe(false)
  })
})
