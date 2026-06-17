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
  // Sentinel-mode wiring (used only when CACHE_MODE=sentinel). Comma-separated
  // `host:port` list of sentinel nodes; the master group name; and which node
  // role to connect to. Optional with demo-friendly defaults so the standalone
  // path never requires them (matches docker compose --profile sentinel).
  // `127.0.0.1` (not `localhost`) avoids macOS resolving to IPv6 ::1, which the
  // IPv4-only published Docker ports do not answer.
  REDIS_SENTINELS: z.string().default('127.0.0.1:26379,127.0.0.1:26380,127.0.0.1:26381'),
  REDIS_SENTINEL_MASTER: z.string().min(1).default('mymaster'),
  REDIS_SENTINEL_ROLE: z.enum(['master', 'replica']).default('master'),
  // Cluster-mode wiring (used only when CACHE_MODE=cluster). Comma-separated
  // `host:port` seed-node list for cluster discovery (matches
  // docker compose --profile cluster). `127.0.0.1` for the same IPv4 reason as above.
  REDIS_CLUSTER_NODES: z.string().default('127.0.0.1:7000,127.0.0.1:7001,127.0.0.1:7002'),
  // Optional ioredis natMap for NAT'd Docker/K8s networks (spec §15.2): a
  // comma-separated `announced=reachable` list (each side `host:port`) that
  // rewrites the internal address the topology announces to a host-reachable one.
  // Empty by default — standalone and production wiring never need it; it is only
  // set for the local sentinel/cluster Docker demos so a host process can connect.
  REDIS_SENTINEL_NAT_MAP: z.string().default(''),
  REDIS_CLUSTER_NAT_MAP: z.string().default(''),
  CACHE_NAMESPACE: z.string().min(1).default('cache-example'),
  CACHE_KEY_SEPARATOR: z.string().min(1).default(':'),
  CACHE_DEFAULT_TTL: z.coerce.number().int().positive().default(60),
  CACHE_SERIALIZER: z.enum(['json', 'msgpack']).default('json'),
  // Boolean flag parsed WITHOUT z.coerce.boolean(): `Boolean('false') === true`,
  // so coercion would silently DISABLE this production safety guard whenever the
  // var is explicitly set to the string 'false'. Only a real `true`, 'true', or
  // '1' enables flushing in production; everything else (including 'false') is false.
  ALLOW_FLUSH_IN_PRODUCTION: z
    .union([z.boolean(), z.string()])
    .default(false)
    .transform((value) => value === true || value === 'true' || value === '1'),
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
