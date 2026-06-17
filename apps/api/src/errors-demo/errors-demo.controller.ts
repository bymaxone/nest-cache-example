/**
 * Error-surface demo controller — `POST /errors/:code`.
 *
 * Layer: errors-demo. Thin controller: validates `:code` against the library's
 * canonical code set (Zod), delegates to `ErrorsDemoService`, and lets the
 * thrown `CacheException` bubble to the global `CacheExceptionFilter`. The HTTP
 * status is NEVER hand-rolled here — it comes from `CacheException.getStatus()`
 * via the filter (spec §19). No Swagger — documented via JSDoc + the Zod param.
 */
import { Controller, Param, Post } from '@nestjs/common'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import { errorCodeParamSchema, type ErrorCodeParam } from './dto/error-code-param.dto.js'
import { ErrorsDemoService } from './errors-demo.service.js'

/**
 * Routes for the Error Explorer backend (all under `/errors`).
 *
 * `POST /errors/:code` triggers the `CacheException` for `:code` so the
 * response surfaces the canonical status + `{ error: { code, message, details } }`
 * body. An unknown/typo code is rejected with HTTP 400 by the Zod pipe — it
 * never falls through to a 500.
 */
@Controller('errors')
export class ErrorsDemoController {
  constructor(private readonly service: ErrorsDemoService) {}

  /**
   * POST /errors/:code — provoke the cache error identified by `:code`.
   *
   * `:code` accepts the snake suffix (`invalid_key`) or the full value
   * (`cache.invalid_key`); both normalize to the canonical `CacheErrorCode`.
   * Delegates to the service, which throws the mapped `CacheException`; the
   * global filter serializes it. This handler therefore never returns normally.
   *
   * @param params - Validated path params containing the canonical `code`.
   * @returns Never — the request always resolves to a `CacheException` response.
   * @throws {CacheException} The exception mapped to the requested `code`.
   */
  @Post(':code')
  async trigger(
    @Param(new ZodValidationPipe(errorCodeParamSchema)) params: ErrorCodeParam,
  ): Promise<never> {
    // params.code is a guaranteed-canonical CacheErrorCode after Zod validation.
    return this.service.trigger(params.code)
  }
}
