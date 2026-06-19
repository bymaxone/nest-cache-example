/**
 * Unit specs for the global `CacheException` filter.
 *
 * Calls `catch()` directly with a real `CacheException` and a hand-built
 * `ArgumentsHost` whose HTTP response is a `{ status, json }` spy. Covers both
 * arms of the message lookup (`CACHE_ERROR_MESSAGES.get(code) ?? message`) and of
 * the details fallback (`details ?? null`), plus the status from `getStatus()`.
 *
 * @module common/cache-exception.filter.spec
 */
import { jest } from '@jest/globals'
import type { ArgumentsHost } from '@nestjs/common'
import { CacheException, CACHE_ERROR_MESSAGES, CACHE_ERROR_CODES } from '@bymax-one/nest-cache'
import { CacheExceptionFilter } from './cache-exception.filter.js'

/**
 * Builds an ArgumentsHost whose `switchToHttp().getResponse()` returns a chainable
 * `{ status, json }` spy, so the filter's writes can be asserted.
 *
 * @returns The host plus the `status`/`json` spies the filter calls.
 */
function makeHost() {
  const json = jest.fn()
  const status = jest.fn().mockReturnThis()
  const response = { status, json }
  // The filter only ever calls `switchToHttp().getResponse()`. The HTTP arm's
  // getters are generic (`<T>(): T`), so the response double is returned through a
  // generic arrow; every method the filter never touches throws — a `never` return
  // is assignable to each generic parameter, so the object satisfies ArgumentsHost
  // without an unsound cast.
  const unused = (): never => {
    throw new Error('not used by CacheExceptionFilter')
  }
  const host: ArgumentsHost = {
    switchToHttp: () => ({
      getResponse: <T>(): T => response as T,
      getRequest: unused,
      getNext: unused,
    }),
    switchToRpc: unused,
    switchToWs: unused,
    getArgs: unused,
    getArgByIndex: unused,
    getType: unused,
  }

  return { host, status, json }
}

describe('CacheExceptionFilter', () => {
  it('writes the canonical message and structured details at the mapped status', () => {
    /*
     * Scenario: a CacheException with a known code and structured details.
     * Rule it protects: HTTP status comes from getStatus() (INVALID_KEY → 400); the
     * message prefers the canonical CACHE_ERROR_MESSAGES entry (left arm of `??`);
     * and details pass through verbatim (left arm of `details ?? null`).
     */
    const { host, status, json } = makeHost()
    const exception = new CacheException(CACHE_ERROR_CODES.INVALID_KEY, { reason: 'empty_prefix' })

    new CacheExceptionFilter().catch(exception, host)

    expect(status).toHaveBeenCalledWith(400)
    expect(json).toHaveBeenCalledWith({
      error: {
        code: CACHE_ERROR_CODES.INVALID_KEY,
        message: CACHE_ERROR_MESSAGES.get(CACHE_ERROR_CODES.INVALID_KEY),
        details: { reason: 'empty_prefix' },
      },
    })
  })

  it('falls back details to null when the exception carries none', () => {
    /*
     * Scenario: a CacheException constructed without details.
     * Rule it protects: the `details ?? null` right arm emits `null` (never
     * `undefined`), so the response body always has an explicit details field.
     */
    const { host, json } = makeHost()
    const exception = new CacheException(CACHE_ERROR_CODES.CONNECTION_FAILED)

    new CacheExceptionFilter().catch(exception, host)

    expect(json).toHaveBeenCalledWith({
      error: {
        code: CACHE_ERROR_CODES.CONNECTION_FAILED,
        message: CACHE_ERROR_MESSAGES.get(CACHE_ERROR_CODES.CONNECTION_FAILED),
        details: null,
      },
    })
  })

  it('falls back to the exception message when no canonical message exists', () => {
    /*
     * Scenario: the message catalog has no entry for the exception's code (simulated
     * by stubbing the lookup to miss).
     * Rule it protects: the `?? exception.message` right arm supplies the message,
     * so an unmapped/future code still produces a populated body.
     */
    const { host, json } = makeHost()
    const exception = new CacheException(CACHE_ERROR_CODES.INVALID_KEY)
    jest.spyOn(CACHE_ERROR_MESSAGES, 'get').mockReturnValueOnce(undefined)

    new CacheExceptionFilter().catch(exception, host)

    expect(json).toHaveBeenCalledWith({
      error: {
        code: CACHE_ERROR_CODES.INVALID_KEY,
        message: exception.message,
        details: null,
      },
    })
  })
})
