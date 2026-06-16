/**
 * Zod-backed validation pipe for route inputs.
 *
 * Layer: common. Parses a `@Body()` or `@Query()` value through the provided
 * Zod schema; a validation failure throws `BadRequestException` (HTTP 400) with
 * the flattened `ZodError` in an `{ error }` envelope consistent with the app's
 * global error shape.
 */
import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common'
import type { ZodType } from 'zod'

/**
 * Validates a route input against a Zod schema. A `ZodError` becomes HTTP 400.
 *
 * Usage: `@Body(new ZodValidationPipe(createXDto)) body: CreateXDto`
 *
 * @template T - The parsed output type inferred from the schema.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  /**
   * Parses `value` through the schema and returns the typed result.
   *
   * @param value - The raw input from the route parameter.
   * @returns The validated, typed value.
   * @throws `BadRequestException` when validation fails.
   */
  transform(value: unknown): T {
    const parsed = this.schema.safeParse(value)
    if (!parsed.success) {
      throw new BadRequestException({
        error: { code: 'validation_failed', issues: parsed.error.flatten() },
      })
    }
    return parsed.data
  }
}
