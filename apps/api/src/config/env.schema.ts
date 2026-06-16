/**
 * Zod environment schema, validated env type, and bootstrap validator.
 *
 * Layer: config. All API environment variables are declared here with their
 * defaults (see spec §9.1). Every consumer reads values through
 * `ConfigService<Env, true>` with `{ infer: true }` — no raw `process.env`.
 */
import { z } from 'zod'

/** Zod schema for all API environment variables (see spec §9.1). */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().int().min(0).default(0),
  CACHE_MODE: z.enum(['standalone', 'sentinel', 'cluster']).default('standalone'),
  CACHE_NAMESPACE: z.string().min(1).default('cache-example'),
  CACHE_KEY_SEPARATOR: z.string().min(1).default(':'),
  CACHE_DEFAULT_TTL: z.coerce.number().int().positive().default(60),
  CACHE_SERIALIZER: z.enum(['json', 'msgpack']).default('json'),
  ALLOW_FLUSH_IN_PRODUCTION: z.coerce.boolean().default(false),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
})

/** Fully-typed, validated environment shape. */
export type Env = z.infer<typeof envSchema>

/**
 * Validates raw environment input at boot; throws a readable error on misconfig.
 * Passed to `ConfigModule.forRoot({ validate })`.
 *
 * @param config - The raw `process.env`-shaped record Nest hands in.
 * @returns The parsed, typed Env.
 * @throws When any variable fails validation — message includes all field errors.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config)
  if (!parsed.success) {
    throw new Error(
      `Invalid environment:\n${JSON.stringify(parsed.error.flatten().fieldErrors, null, 2)}`,
    )
  }
  return parsed.data
}
