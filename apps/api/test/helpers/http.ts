/**
 * HTTP test helper — a `supertest` agent bound to the booted Nest server.
 *
 * Every flow spec drives the real app over HTTP by issuing requests against
 * `app.getHttpServer()` — the genuine Express server with the production global
 * `CacheExceptionFilter` and the per-route `ZodValidationPipe` active — so status
 * codes and error envelopes are production-accurate, never mocked.
 *
 * @module test/helpers/http
 */
import request from 'supertest'
import type { INestApplication } from '@nestjs/common'
import type { Server } from 'node:http'

/**
 * Returns a `supertest` agent bound to the application's HTTP server.
 *
 * @param app - The booted Nest application (already `listen`-ing).
 * @returns A `supertest` test agent; chain `.get('/health')`, `.post(...)`, etc.
 */
export function httpAgent(app: INestApplication) {
  const server: Server = app.getHttpServer()
  return request(server)
}

/**
 * Parses a bare JSON scalar (number, boolean, or null) from a supertest response.
 *
 * Nest sends primitive handler return values via `res.send` rather than
 * `res.json`, so supertest leaves `response.body` as an empty object `{}` and
 * keeps the raw value in `response.text`. A `null`/`undefined` return is sent as
 * an empty body, which this helper reports as `null`. Use it for routes whose
 * contract is a bare number/boolean (or a nullable scalar).
 *
 * @param response - A supertest response whose body is a bare scalar.
 * @returns The parsed scalar value; `null` when the body is empty.
 */
export function scalarBody(response: { text: string }): unknown {
  if (response.text === '') return null
  try {
    return JSON.parse(response.text)
  } catch (cause) {
    // Surface a clear assertion-style error instead of an opaque SyntaxError when
    // a route unexpectedly returns a non-JSON body (e.g. an error page).
    throw new Error(
      `scalarBody: response body is not a JSON scalar: ${JSON.stringify(response.text)}`,
      { cause },
    )
  }
}
