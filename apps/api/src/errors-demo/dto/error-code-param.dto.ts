/**
 * Zod schema for the `POST /errors/:code` path parameter.
 *
 * Layer: errors-demo. Validates the requested error code against the library's
 * canonical `CACHE_ERROR_CODES` set. Accepts either the snake suffix
 * (e.g. `invalid_key`) or the full namespaced value (`cache.invalid_key`),
 * normalizing to the full `CacheErrorCode`. An unknown/typo code fails the
 * refine and the `ZodValidationPipe` maps it to HTTP 400 — never a 500.
 *
 * Codes/types are imported from the zero-dependency `@bymax-one/nest-cache/shared`
 * subpath: the same import `apps/web` reuses to type its `CacheErrorCode` error
 * union in the browser bundle, with zero NestJS/ioredis leakage.
 */
import { z } from 'zod'
import { CACHE_ERROR_CODES, type CacheErrorCode } from '@bymax-one/nest-cache/shared'

/** Lookup set of every canonical `cache.<snake>` value, for membership checks. */
const CODE_SET: ReadonlySet<string> = new Set(Object.values(CACHE_ERROR_CODES))

/**
 * Validates `:code`, normalizing a bare snake suffix to the full `cache.<snake>`
 * value before checking membership against {@link CACHE_ERROR_CODES}.
 */
export const errorCodeParamSchema = z.object({
  code: z
    .string()
    .transform((value) => (value.startsWith('cache.') ? value : `cache.${value}`))
    .refine((value): value is CacheErrorCode => CODE_SET.has(value), {
      message: 'Unknown cache error code',
    }),
})

/** Validated path param: a guaranteed-canonical `CacheErrorCode`. */
export type ErrorCodeParam = z.infer<typeof errorCodeParamSchema>
