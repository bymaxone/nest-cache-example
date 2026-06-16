/**
 * Global exception filter for `CacheException`.
 *
 * Layer: common. Serializes any `CacheException` to a stable structured body:
 *   `{ error: { code, message, details } }`
 * `message` prefers the library's canonical `CACHE_ERROR_MESSAGES` entry;
 * `details` is secret-free by library contract and passes through verbatim.
 * Registered globally via `APP_FILTER` in `app.module.ts` so it participates in DI.
 */
import { Catch, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common'
import type { Response } from 'express'
import { CacheException, CACHE_ERROR_MESSAGES } from '@bymax-one/nest-cache'

/**
 * Maps every `CacheException` to a stable HTTP response.
 * HTTP status is derived from `exception.getStatus()` (set by the library per code).
 * `details` is relayed verbatim — the library guarantees it carries no secret values.
 */
@Catch(CacheException)
export class CacheExceptionFilter implements ExceptionFilter {
  catch(exception: CacheException, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>()
    res.status(exception.getStatus()).json({
      error: {
        code: exception.code,
        message: CACHE_ERROR_MESSAGES.get(exception.code) ?? exception.message,
        details: exception.details ?? null,
      },
    })
  }
}
