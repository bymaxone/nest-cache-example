/**
 * Unit specs for the Zod-backed validation pipe.
 *
 * Constructs the pipe directly with a schema and exercises both arms of
 * `transform`: a valid value passes through typed, and an invalid value throws a
 * `BadRequestException` carrying the `{ error: { code, issues } }` 400 envelope.
 *
 * @module common/zod-validation.pipe.spec
 */
import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { ZodValidationPipe } from './zod-validation.pipe.js'

/** A small schema with a required field and a typed number to drive both arms. */
const schema = z.object({ name: z.string().min(1), age: z.number().int() })

describe('ZodValidationPipe', () => {
  it('returns the validated value when the input satisfies the schema', () => {
    /*
     * Scenario: a value that matches the schema.
     * Rule it protects: the success arm returns `parsed.data` — the typed, parsed
     * value the route handler receives.
     */
    const pipe = new ZodValidationPipe(schema)

    expect(pipe.transform({ name: 'cart', age: 3 })).toEqual({ name: 'cart', age: 3 })
  })

  it('throws BadRequestException with the validation_failed envelope on invalid input', () => {
    /*
     * Scenario: a value missing the required field and using the wrong type.
     * Rule it protects: the failure arm throws HTTP 400 with the flattened ZodError
     * under `{ error: { code: 'validation_failed', issues } }`, matching the app's
     * global error shape.
     */
    const pipe = new ZodValidationPipe(schema)
    let thrown: unknown

    try {
      pipe.transform({ name: '', age: 'old' })
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(BadRequestException)
    if (!(thrown instanceof BadRequestException)) throw new Error('expected BadRequestException')

    const response = thrown.getResponse()
    expect(response).toMatchObject({ error: { code: 'validation_failed' } })
    expect(response).toHaveProperty('error.issues')
  })
})
