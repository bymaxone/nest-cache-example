# Phase 3 — `apps/api` Skeleton + Cache Module Wiring — Tasks

> **Source:** [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#phase-3--appsapi-skeleton--cache-module-wiring) §Phase 3
> **Total tasks:** 9
> **Progress:** 🟢 9 / 9 done (100%)
>
> **Status legend:** 🔴 Not Started · 🟡 In Progress · 🔵 In Review · 🟢 Done · ⚪ Blocked

## Task index

| ID   | Task                                                                        | Status | Priority | Size | Depends on       |
| ---- | --------------------------------------------------------------------------- | ------ | -------- | ---- | ---------------- |
| P3-1 | `apps/api` Nest app (Express): `nest-cli.json`, tsconfigs, `src/main.ts`    | 🟢     | High     | M    | Phase 1, Phase 2 |
| P3-2 | `src/config/env.schema.ts` (Zod + `validateEnv()` + `Env`) + `ConfigModule` | 🟢     | High     | S    | P3-1             |
| P3-3 | `src/cache/cache.config.ts` — `buildCacheOptions(config, events)` factory   | 🟢     | High     | M    | P3-2             |
| P3-4 | `src/cache/cache.events.ts` — `CacheEventsBridge` → Logger + gateway        | 🟢     | High     | S    | P3-1, P3-5       |
| P3-5 | `src/events/events.gateway.ts` — socket.io `EventsGateway` skeleton         | 🟢     | High     | M    | P3-1             |
| P3-6 | `src/cache/cache.module.ts` + `src/app.module.ts` — `forRootAsync` wiring   | 🟢     | High     | M    | P3-3, P3-4       |
| P3-7 | `src/common/cache-exception.filter.ts` — global `@Catch(CacheException)`    | 🟢     | High     | S    | P3-1             |
| P3-8 | `src/common/zod-validation.pipe.ts` + `src/common/cache-keys.ts`            | 🟢     | Medium   | S    | P3-1             |
| P3-9 | `src/health/health.controller.ts` (`/health` + `/metrics`) + boot verify    | 🟢     | High     | S    | P3-6, P3-7, P3-8 |

---

## P3-1 — `apps/api` Nest App (Express): `nest-cli.json`, tsconfigs, `src/main.ts`

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** M (90 min – half day)
- **Depends on:** `Phase 1`, `Phase 2`

### Description

Scaffold the NestJS 11 application package on the **Express** platform: `apps/api/package.json` (linked library + NestJS/ioredis peers from Phase 2), `nest-cli.json`, and the app-local TypeScript configs. The app `tsconfig.json` extends the strict root base **and adds `emitDecoratorMetadata` + `experimentalDecorators`** (NestJS DI needs them; the root base deliberately omits them so the Next.js app never inherits them — see §23.2). `src/main.ts` bootstraps via `NestFactory.create(AppModule, { bufferLogs: true })`, restricts CORS to `WEB_ORIGIN`, installs the socket.io `IoAdapter` (the default for `@nestjs/platform-socket.io`), calls `app.enableShutdownHooks()`, and documents the graceful-shutdown ordering. This is the bootstrap shell every later module hangs off; the cache wiring itself lands in P3-3/P3-6.

### Acceptance Criteria

- [x] `apps/api/package.json` exists with `"name": "api"`, `"type": "module"`, `dev`/`build`/`start`/`typecheck` scripts, and the linked `@bymax-one/nest-cache` + NestJS 11 (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/config`, `@nestjs/websockets`, `@nestjs/platform-socket.io`) + `ioredis` + `reflect-metadata` + `socket.io` + `zod` deps (versions per §5).
- [x] `apps/api/nest-cli.json` exists (`"collection": "@nestjs/schematics"`, `"sourceRoot": "src"`).
- [x] `apps/api/tsconfig.json` extends `../../tsconfig.base.json` and adds `"emitDecoratorMetadata": true`, `"experimentalDecorators": true`, an `outDir`, and `"types": ["node"]`; `tsconfig.build.json` excludes tests.
- [x] `src/main.ts` calls `NestFactory.create(AppModule, { bufferLogs: true })`, `app.enableCors({ origin: <WEB_ORIGIN> })`, `app.useWebSocketAdapter(new IoAdapter(app))`, `app.enableShutdownHooks()`, then `app.listen(PORT)` — `PORT`/`WEB_ORIGIN` read via `ConfigService<Env, true>`, never raw `process.env`.
- [x] `src/main.ts` carries a JSDoc/file-header block documenting the shutdown ordering (HTTP server stops → Nest fires `OnModuleDestroy` → library `ConnectionManager.quit()` within `shutdownTimeoutMs`, `PubSubService` closes its subscriber).
- [x] `pnpm --filter api typecheck` exits 0 (with the minimal `AppModule` stub from P3-6, or a temporary empty module until P3-6 lands).

### Files to create / modify

- `apps/api/package.json` — app manifest + deps.
- `apps/api/nest-cli.json` — Nest CLI config.
- `apps/api/tsconfig.json`, `apps/api/tsconfig.build.json` — app TS configs.
- `apps/api/src/main.ts` — bootstrap.

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer scaffolding a NestJS 11 service.
> PROJECT: `nest-cache-example` — the reference app for `@bymax-one/nest-cache` (a typed Redis cache for NestJS on ioredis 5). See `docs/TECHNICAL_SPECIFICATION.md` §6 (layout), §9 (env), §10 (backend design), §23.2 (TS), and `docs/DEVELOPMENT_PLAN.md` §Phase 3 + §2 Global Conventions. This is task P3-1.
> PRECONDITIONS: Phase 1 (Docker Redis up with `notify-keyspace-events Ex`) and Phase 2 (the library is linked as an external package — `@bymax-one/nest-cache` resolvable, peers `@nestjs/common`/`@nestjs/core`/`ioredis`/`reflect-metadata` present) are done.
> REQUIRED READING: spec §6, §9.1, §10.3, §23.2; plan §Phase 3, §2.
> TASK: Scaffold the `apps/api` NestJS 11 application shell on Express, with strict app-local tsconfigs and a documented `main.ts` bootstrap.
> DELIVERABLES / Steps:
>
> 1. Create `apps/api/package.json`:
>    ```jsonc
>    {
>      "name": "api",
>      "version": "0.0.0",
>      "private": true,
>      "type": "module",
>      "scripts": {
>        "dev": "nest start --watch",
>        "build": "nest build",
>        "start": "node dist/main.js",
>        "typecheck": "tsc --noEmit -p tsconfig.json",
>      },
>    }
>    ```
>    Add dependencies (use the §5 versions): `@bymax-one/nest-cache` (linked, per Phase 2), `@nestjs/common@^11`, `@nestjs/core@^11`, `@nestjs/platform-express@^11`, `@nestjs/config@^11`, `@nestjs/websockets@^11`, `@nestjs/platform-socket.io@^11`, `ioredis@^5`, `reflect-metadata@^0.2`, `socket.io@^4`, `zod@^4`; devDeps `@nestjs/cli@^11`, `@nestjs/schematics@^11`, `@types/node`, `typescript` (inherited). Install via `pnpm --filter api add …` so the linked peer copies stay single.
> 2. Create `apps/api/nest-cli.json`:
>    ```json
>    {
>      "$schema": "https://json.schemastore.org/nest-cli",
>      "collection": "@nestjs/schematics",
>      "sourceRoot": "src",
>      "compilerOptions": { "deleteOutDir": true }
>    }
>    ```
> 3. Create `apps/api/tsconfig.json` extending the strict root base and adding the decorator metadata NestJS DI requires:
>    ```json
>    {
>      "extends": "../../tsconfig.base.json",
>      "compilerOptions": {
>        "emitDecoratorMetadata": true,
>        "experimentalDecorators": true,
>        "outDir": "./dist",
>        "baseUrl": "./",
>        "types": ["node"]
>      },
>      "include": ["src/**/*.ts"],
>      "exclude": ["node_modules", "dist", "test"]
>    }
>    ```
>    Create `apps/api/tsconfig.build.json` (`extends ./tsconfig.json`, `exclude: ["test", "**/*.spec.ts", "**/*.e2e-spec.ts"]`).
> 4. Create `apps/api/src/main.ts`. Import `reflect-metadata` first. Bootstrap with `bufferLogs` so early logs queue until the logger is ready, scope CORS to `WEB_ORIGIN`, install the socket.io adapter, and enable shutdown hooks BEFORE `listen`. **Use `IoAdapter` from `@nestjs/platform-socket.io` — NOT `WsAdapter`** (`WsAdapter` is only for the native `ws` library via `@nestjs/platform-ws`, and would break the socket.io gateway). `IoAdapter` is in fact the default for `@nestjs/platform-socket.io`; wiring it explicitly via `app.useWebSocketAdapter(new IoAdapter(app))` is the clear, documented form used below:
>
>    ```ts
>    /**
>     * Application entry point for the nest-cache-example API.
>     *
>     * Graceful-shutdown ordering (driven by `app.enableShutdownHooks()`):
>     *   1. Process receives SIGTERM/SIGINT.
>     *   2. Nest stops accepting new HTTP/WS connections (the Express server closes).
>     *   3. Nest fires `OnModuleDestroy` across providers in reverse-dependency order.
>     *   4. The library's `ConnectionManager` runs `quit()` on the main client,
>     *      bounded by `shutdownTimeoutMs` (default 5000); `PubSubService` closes its
>     *      dedicated subscriber; the TTL raw subscriber quits last.
>     * Read `WEB_ORIGIN` / `PORT` through the typed ConfigService — never `process.env`.
>     */
>    import 'reflect-metadata'
>    import { NestFactory } from '@nestjs/core'
>    import { ConfigService } from '@nestjs/config'
>    import { IoAdapter } from '@nestjs/platform-socket.io'
>    import { AppModule } from './app.module'
>    import type { Env } from './config/env.schema'
>
>    async function bootstrap(): Promise<void> {
>      const app = await NestFactory.create(AppModule, { bufferLogs: true })
>      const config = app.get<ConfigService<Env, true>>(ConfigService)
>      app.enableCors({ origin: config.get('WEB_ORIGIN', { infer: true }), credentials: true })
>      app.useWebSocketAdapter(new IoAdapter(app))
>      app.enableShutdownHooks()
>      await app.listen(config.get('PORT', { infer: true }))
>    }
>
>    void bootstrap()
>    ```
>
>    (If P3-6's `AppModule` is not yet present, stub a temporary `@Module({})` so typecheck passes; P3-6 replaces it.)
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions. English-only comments; JSDoc file-header on `main.ts`.
> - NestJS on **Express** (`@nestjs/platform-express`), NOT Fastify.
> - The app tsconfig is the ONLY place `emitDecoratorMetadata`/`experimentalDecorators` are set — do NOT touch `tsconfig.base.json`.
> - NO Swagger. NO `console.*` (use Nest `Logger`). Read every env value through `ConfigService<Env, true>` with `{ infer: true }`.
> - No suppressions (`@ts-ignore`/`eslint-disable`/`as any`).
>   Verification:
> - `pnpm --filter api typecheck` — expected: exit 0.
> - `node -p "require('./apps/api/package.json').type"` — expected: `module`.
> - `node -e "const t=require('./apps/api/tsconfig.json');process.exit(t.compilerOptions.emitDecoratorMetadata?0:1)"` — expected: exit 0.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P3-1 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

If phase reaches 100%, switch its row status in `DEVELOPMENT_PLAN.md` to 🟢.

⚠️ Never mark done with failing verification.

---

## P3-2 — `src/config/env.schema.ts` (Zod) + `ConfigModule.forRoot`

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** S (30–90 min)
- **Depends on:** `P3-1`

### Description

Define the validated, typed environment. `src/config/env.schema.ts` exports a Zod schema covering every variable in §9.1, a `validateEnv(raw): Env` function (parses + throws a readable error on first boot misconfig), and the inferred `Env` type. `@nestjs/config`'s `ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })` runs the schema at startup, after which all feature code reads via `ConfigService<Env, true>` — no raw `process.env` anywhere (§9.1). This task only produces the schema + module registration; consumers (cache factory, gateway, health) arrive in later tasks.

### Acceptance Criteria

- [x] `src/config/env.schema.ts` exports a Zod `envSchema`, `validateEnv(config: Record<string, unknown>): Env`, and `export type Env = z.infer<typeof envSchema>`.
- [x] Schema covers (with §9.1 defaults via `.default(...)` and coercion where numeric): `NODE_ENV` (`'development' | 'test' | 'production'`), `PORT` (`3001`), `WEB_ORIGIN` (`http://localhost:3000`), `REDIS_URL` (`redis://localhost:6379`), `REDIS_HOST`/`REDIS_PORT`, `REDIS_PASSWORD` (optional), `REDIS_DB` (`0`), `CACHE_MODE` (`'standalone' | 'sentinel' | 'cluster'`), `CACHE_NAMESPACE` (`cache-example`), `CACHE_KEY_SEPARATOR` (`:`), `CACHE_DEFAULT_TTL` (`60`), `CACHE_SERIALIZER` (`'json' | 'msgpack'`), `ALLOW_FLUSH_IN_PRODUCTION` (`false`, coerced boolean), `SHUTDOWN_TIMEOUT_MS` (`5000`).
- [x] `validateEnv` throws with a clear, aggregated message (e.g. flattened `ZodError`) on invalid env.
- [x] `AppModule` (or the config module) registers `ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })`.
- [x] `apps/api/.env.example` lists every variable with its §9.1 default (no real secrets).
- [x] `pnpm --filter api typecheck` exits 0.

### Files to create / modify

- `apps/api/src/config/env.schema.ts` — Zod schema + `validateEnv` + `Env`.
- `apps/api/.env.example` — documented defaults.
- `apps/api/src/app.module.ts` — register `ConfigModule.forRoot` (or stub if P3-6 owns it; coordinate).

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer.
> PROJECT: `nest-cache-example`, the reference app for `@bymax-one/nest-cache`. See `docs/TECHNICAL_SPECIFICATION.md` §9.1 (the env-variable registry) and `docs/DEVELOPMENT_PLAN.md` §Phase 3 + §2 + Appendix A. This is task P3-2.
> PRECONDITIONS: P3-1 done (`apps/api` shell + `@nestjs/config` + `zod` installed).
> REQUIRED READING: spec §9.1, §5 (zod ^4, @nestjs/config ^11), plan §2, Appendix A.
> TASK: Produce the Zod env schema, `validateEnv()`, the `Env` type, the `.env.example`, and wire `ConfigModule.forRoot`.
> DELIVERABLES / Steps:
>
> 1. Create `src/config/env.schema.ts`:
>
>    ```ts
>    import { z } from 'zod'
>
>    /** Zod schema for all API environment variables (see spec §9.1). */
>    export const envSchema = z.object({
>      NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
>      PORT: z.coerce.number().int().positive().default(3001),
>      WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
>      REDIS_URL: z.string().default('redis://localhost:6379'),
>      REDIS_HOST: z.string().default('localhost'),
>      REDIS_PORT: z.coerce.number().int().positive().default(6379),
>      REDIS_PASSWORD: z.string().optional(),
>      REDIS_DB: z.coerce.number().int().min(0).default(0),
>      CACHE_MODE: z.enum(['standalone', 'sentinel', 'cluster']).default('standalone'),
>      CACHE_NAMESPACE: z.string().min(1).default('cache-example'),
>      CACHE_KEY_SEPARATOR: z.string().min(1).default(':'),
>      CACHE_DEFAULT_TTL: z.coerce.number().int().positive().default(60),
>      CACHE_SERIALIZER: z.enum(['json', 'msgpack']).default('json'),
>      ALLOW_FLUSH_IN_PRODUCTION: z.coerce.boolean().default(false),
>      SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
>    })
>
>    /** Fully-typed, validated environment shape. */
>    export type Env = z.infer<typeof envSchema>
>
>    /**
>     * Validates raw environment input at boot; throws a readable error on misconfig.
>     * Passed to `ConfigModule.forRoot({ validate })`.
>     * @param config - The raw `process.env`-shaped record Nest hands in.
>     * @returns The parsed, typed Env.
>     */
>    export function validateEnv(config: Record<string, unknown>): Env {
>      const parsed = envSchema.safeParse(config)
>      if (!parsed.success) {
>        throw new Error(
>          `Invalid environment:\n${JSON.stringify(parsed.error.flatten().fieldErrors, null, 2)}`,
>        )
>      }
>      return parsed.data
>    }
>    ```
>
> 2. Create `apps/api/.env.example` documenting every variable at its §9.1 default (`REDIS_PASSWORD` left blank; add a comment that it is never logged).
> 3. Register in `AppModule` (coordinate with P3-6 which owns the final `app.module.ts`):
>    ```ts
>    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })
>    ```
>    Constraints:
>
> - Follow §2 Global Conventions. JSDoc on `validateEnv`, `Env`, and the schema. English only.
> - `ConfigService` must be consumed as `ConfigService<Env, true>` with `{ infer: true }` everywhere downstream — do NOT read `process.env` directly in feature code.
> - Use **zod** for validation — NO class-validator, NO Swagger.
> - Booleans (`ALLOW_FLUSH_IN_PRODUCTION`) come from strings → use `z.coerce.boolean()` (note: any non-empty string is truthy; the `.env.example` documents `true`/`false` literally and the default keeps it `false`).
>   Verification:
> - `pnpm --filter api typecheck` — expected: exit 0.
> - `node --input-type=module -e "import('./apps/api/src/config/env.schema.ts')"` is NOT expected to run (TS); instead assert via a quick `tsc` build or unit-load in a later test. Minimal check: `grep -q "validate: validateEnv" apps/api/src/app.module.ts` — expected: match.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P3-2 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P3-3 — `src/cache/cache.config.ts` — `buildCacheOptions(config, events)` Factory

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** M (90 min – half day)
- **Depends on:** `P3-2`

### Description

The headline copy-paste artifact (§9.2): a pure function that maps validated env → `BymaxCacheModuleOptions`, separating _what the options are_ from _how the module is wired_ (the latter is P3-6). For Phase 3 the factory wires the **standalone** connection from `REDIS_URL`, `namespace`, `keySeparator`, `shutdownTimeoutMs`, `allowFlushInProduction`, threads in the injected `ICacheEvents` bridge, and leaves **placeholders** for the serializer selection (`CACHE_SERIALIZER` branch → custom serializer arrives in Phase 7) and `scripts` (`IScriptDefinition[]` arrives in Phase 10). Sentinel/cluster blocks are stubbed (filled in Phase 11). The return type is annotated `BymaxCacheModuleOptions` (matrix #3); the standalone block uses `BymaxCacheStandaloneConnection` (matrix #4).

### Acceptance Criteria

- [x] `src/cache/cache.config.ts` exports `buildCacheOptions(config: ConfigService<Env, true>, events: ICacheEvents): BymaxCacheModuleOptions`.
- [x] Standalone connection derived from `REDIS_URL` (e.g. `{ url: config.get('REDIS_URL', { infer: true }) }`); `mode` from `CACHE_MODE`.
- [x] `namespace` ← `CACHE_NAMESPACE`, `keySeparator` ← `CACHE_KEY_SEPARATOR`, `shutdownTimeoutMs` ← `SHUTDOWN_TIMEOUT_MS`, `allowFlushInProduction` ← `ALLOW_FLUSH_IN_PRODUCTION`.
- [x] `events` passed straight through (the `ICacheEvents` bag from the bridge).
- [x] Serializer selection is a documented placeholder: `CACHE_SERIALIZER === 'msgpack' ? /* Phase 7 */ undefined : undefined` with a JSDoc/`TODO(phase-7)` note that `undefined` → the library's default `JsonSerializer`.
- [x] `scripts` is a documented placeholder constant (e.g. `const CACHE_SCRIPTS: readonly IScriptDefinition[] = []` with a `TODO(phase-10)` note) passed as `scripts: CACHE_SCRIPTS`.
- [x] Sentinel/cluster builders are stubbed (`buildSentinelBlock`/`buildClusterBlock` returning `undefined` or throwing a `TODO(phase-11)` not-yet-implemented marker) and only invoked when `mode !== 'standalone'`.
- [x] `isGlobal` is **NOT** set inside this factory (it is a synchronous decision made at the `forRootAsync` call site in P3-6).
- [x] `pnpm --filter api typecheck` exits 0.

### Files to create / modify

- `apps/api/src/cache/cache.config.ts` — the options factory + placeholders.

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer wiring a third-party cache module.
> PROJECT: `nest-cache-example`, the reference app for `@bymax-one/nest-cache`. See `docs/TECHNICAL_SPECIFICATION.md` §9.2 (the canonical `cache.config.ts`), §4.3 (default option values), §15 (topologies), §16 (serialization), and `docs/DEVELOPMENT_PLAN.md` §Phase 3. This is task P3-3.
> PRECONDITIONS: P3-2 done (the typed `Env` + `ConfigService<Env, true>` exist).
> REQUIRED READING: spec §9.2, §4.1–§4.3 (API inventory + option defaults), §15.1; plan §Phase 3, §2.
> TASK: Write `buildCacheOptions` — a pure env→options mapper for the standalone path, with explicit, well-labelled placeholders for the serializer (Phase 7) and `scripts` (Phase 10), and stubbed sentinel/cluster builders (Phase 11).
> DELIVERABLES / Steps:
>
> 1. Import from the **server** subpath and the typed env:
>    ```ts
>    import type { ConfigService } from '@nestjs/config'
>    import type {
>      BymaxCacheModuleOptions,
>      ICacheEvents,
>      IScriptDefinition,
>      ISerializer,
>    } from '@bymax-one/nest-cache'
>    import type { Env } from '../config/env.schema'
>    ```
> 2. Declare the placeholder script registry (Phase 10 fills it):
>    ```ts
>    /** Pre-registered Lua scripts. Populated in Phase 10 (single-flight lock). */
>    const CACHE_SCRIPTS: readonly IScriptDefinition[] = [] // TODO(phase-10): acquireLock
>    ```
> 3. Implement the factory exactly per §9.2 (standalone only for now):
>
>    ```ts
>    /**
>     * Builds the resolved options for BymaxCacheModule from validated env.
>     * @param config - Typed config service over the Zod-validated Env.
>     * @param events - The lifecycle bridge (Logger + WebSocket broadcaster).
>     * @returns Fully-formed BymaxCacheModuleOptions.
>     */
>    export function buildCacheOptions(
>      config: ConfigService<Env, true>,
>      events: ICacheEvents,
>    ): BymaxCacheModuleOptions {
>      const mode = config.get('CACHE_MODE', { infer: true })
>
>      // TODO(phase-7): return `new MsgPackSerializer()` when CACHE_SERIALIZER === 'msgpack'.
>      // `undefined` → the library's default JsonSerializer.
>      const serializer: ISerializer | undefined =
>        config.get('CACHE_SERIALIZER', { infer: true }) === 'msgpack' ? undefined : undefined
>
>      return {
>        mode,
>        connection:
>          mode === 'standalone' ? { url: config.get('REDIS_URL', { infer: true }) } : undefined,
>        sentinel: mode === 'sentinel' ? buildSentinelBlock(config) : undefined,
>        cluster: mode === 'cluster' ? buildClusterBlock(config) : undefined,
>        namespace: config.get('CACHE_NAMESPACE', { infer: true }),
>        keySeparator: config.get('CACHE_KEY_SEPARATOR', { infer: true }),
>        serializer,
>        events,
>        scripts: CACHE_SCRIPTS,
>        shutdownTimeoutMs: config.get('SHUTDOWN_TIMEOUT_MS', { infer: true }),
>        allowFlushInProduction: config.get('ALLOW_FLUSH_IN_PRODUCTION', { infer: true }),
>      }
>    }
>    ```
>
> 4. Stub the topology builders so `mode !== 'standalone'` typechecks but fails loudly until Phase 11:
>    ```ts
>    /** Sentinel connection block. Implemented in Phase 11 (§15.2). */
>    function buildSentinelBlock(_config: ConfigService<Env, true>): never {
>      throw new Error('Sentinel mode not yet wired (Phase 11)')
>    }
>    /** Cluster connection block. Implemented in Phase 11 (§15.3). */
>    function buildClusterBlock(_config: ConfigService<Env, true>): never {
>      throw new Error('Cluster mode not yet wired (Phase 11)')
>    }
>    ```
>    (Adjust the return type if the library's `sentinel`/`cluster` option fields are required-when-present — match `BymaxCacheModuleOptions` from the shipped `.d.ts`. The `never`-returning stub keeps standalone-mode typechecking clean.)
>    Constraints:
>
> - Follow §2 Global Conventions. JSDoc on `buildCacheOptions` + each helper. English only.
> - **CRITICAL — `isGlobal` is synchronous.** Do NOT set/return `isGlobal` from this factory. Per the library types, `forRootAsync` decides the module's `global` flag _before_ the async factory resolves, so `isGlobal` is passed at the `forRootAsync({ isGlobal, … })` call site (P3-6). An `isGlobal` returned here has no effect — document this with an inline comment.
> - Import library types from `@bymax-one/nest-cache` (server subpath), NOT from `/shared`.
> - Read every value through `ConfigService<Env, true>` with `{ infer: true }`. No raw `process.env`.
> - Serializer and `scripts` are placeholders ONLY — do NOT implement `MsgPackSerializer` or any Lua here (those are Phase 7 / Phase 10). Mark with `TODO(phase-N)`.
> - No suppressions; do NOT pass `connection.maxRetriesPerRequest: null` (that is BullMQ-specific — §4.3).
>   Verification:
> - `pnpm --filter api typecheck` — expected: exit 0.
> - `grep -n "BymaxCacheModuleOptions" apps/api/src/cache/cache.config.ts` — expected: return-type annotation present.
> - `grep -n "isGlobal" apps/api/src/cache/cache.config.ts` — expected: NO `isGlobal` key set (only a comment, if any).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P3-3 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P3-4 — `src/cache/cache.events.ts` — `CacheEventsBridge` → Logger + Gateway

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** S (30–90 min)
- **Depends on:** `P3-1`, `P3-5`

### Description

The observability bridge (§20.1, matrix #10, #45, #47): an injectable `CacheEventsBridge` that exposes `toCacheEvents(): ICacheEvents`. The returned bag's `onEvent(event: CacheEventName, data: Record<string, unknown>)` logs each lifecycle event through a Nest `Logger` — `logger.error` for the `error` event (branching on `CACHE_EVENT_NAMES.ERROR`), `logger.log` otherwise — **and** forwards it to the `EventsGateway` so the dashboard's connection badge updates live. Event `data` is secret-free by library contract (§20.1), so it is logged/broadcast verbatim. This bag is what P3-6 injects into the `forRootAsync` factory via `bridge.toCacheEvents()`.

### Acceptance Criteria

- [x] `src/cache/cache.events.ts` exports an `@Injectable()` `CacheEventsBridge` whose constructor injects `EventsGateway`.
- [x] `toCacheEvents(): ICacheEvents` returns `{ onEvent: (event: CacheEventName, data) => { … } }`.
- [x] `onEvent` branches on `CACHE_EVENT_NAMES.ERROR`: `error` → `logger.error(...)`, else → `logger.log(...)`.
- [x] `onEvent` calls `this.gateway.emitConnectionEvent(event, data)` on every event.
- [x] Uses a named `Logger` instance (e.g. `new Logger('Cache')`); NO `console.*`.
- [x] `CacheEventName` + `CACHE_EVENT_NAMES` imported from `@bymax-one/nest-cache` (or `/shared`); `ICacheEvents` from the server subpath.
- [x] `pnpm --filter api typecheck` exits 0.

### Files to create / modify

- `apps/api/src/cache/cache.events.ts` — the events bridge.

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer.
> PROJECT: `nest-cache-example`, the reference app for `@bymax-one/nest-cache`. See `docs/TECHNICAL_SPECIFICATION.md` §20.1 (the canonical bridge), §3 (observability plane), §4.1 (`ICacheEvents`, `CacheEventName`, `CACHE_EVENT_NAMES` tokens/types), and `docs/DEVELOPMENT_PLAN.md` §Phase 3. This is task P3-4.
> PRECONDITIONS: P3-1 (app shell) and P3-5 (`EventsGateway` with `emitConnectionEvent`) done.
> REQUIRED READING: spec §20.1, §4.1, §4.2 (shared subpath has `CACHE_EVENT_NAMES`/`CacheEventName`); plan §Phase 3, §2.
> TASK: Implement `CacheEventsBridge.toCacheEvents()` exactly per §20.1 — log to a Nest `Logger` (error vs log) AND broadcast to the gateway.
> DELIVERABLES / Steps:
>
> 1. Create `src/cache/cache.events.ts`:
>
>    ```ts
>    import { Injectable, Logger } from '@nestjs/common'
>    import type { ICacheEvents } from '@bymax-one/nest-cache'
>    import { CACHE_EVENT_NAMES, type CacheEventName } from '@bymax-one/nest-cache'
>    import { EventsGateway } from '../events/events.gateway'
>
>    /**
>     * Bridges the library's connection-lifecycle events to the Nest Logger and the
>     * dashboard (via EventsGateway). The returned ICacheEvents bag is passed into
>     * BymaxCacheModule options (see cache.config.ts / app.module.ts).
>     */
>    @Injectable()
>    export class CacheEventsBridge {
>      private readonly logger = new Logger('Cache')
>
>      constructor(private readonly gateway: EventsGateway) {}
>
>      /** Returns the ICacheEvents bag passed into BymaxCacheModule options. */
>      toCacheEvents(): ICacheEvents {
>        return {
>          onEvent: (event: CacheEventName, data: Record<string, unknown>) => {
>            if (event === CACHE_EVENT_NAMES.ERROR) this.logger.error(`[cache] ${event}`, data)
>            else this.logger.log(`[cache] ${event}`)
>            this.gateway.emitConnectionEvent(event, data)
>          },
>        }
>      }
>    }
>    ```
>
>    (If `CACHE_EVENT_NAMES` is exported only from `/shared`, import it from `@bymax-one/nest-cache/shared`; the type `ICacheEvents` is server-only — keep it from `@bymax-one/nest-cache`. Confirm against the shipped `.d.ts`.)
>    Constraints:
>
> - Follow §2 Global Conventions. JSDoc on the class + `toCacheEvents`. English only.
> - **Branch on the symbolic constant** `CACHE_EVENT_NAMES.ERROR` (matrix #47) — do NOT compare against a raw `'error'` string literal.
> - `error` event → `logger.error`; every other lifecycle event (`connect`/`ready`/`close`/`reconnecting`/`end`) → `logger.log`. `CacheEventName = 'connect' | 'ready' | 'error' | 'close' | 'reconnecting' | 'end'`.
> - `ICacheEvents` shape is `{ onEvent?(event: CacheEventName, data: Record<string, unknown>): void }` — match the signature exactly.
> - Event `data` is secret-free by library contract — safe to log/broadcast verbatim; do NOT add scrubbing logic.
> - NO `console.*`; use the named `Logger`. No suppressions.
>   Verification:
> - `pnpm --filter api typecheck` — expected: exit 0.
> - `grep -n "CACHE_EVENT_NAMES.ERROR" apps/api/src/cache/cache.events.ts` — expected: match (symbolic branch, not a string literal).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P3-4 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P3-5 — `src/events/events.gateway.ts` — socket.io `EventsGateway` Skeleton

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** M (90 min – half day)
- **Depends on:** `P3-1`

### Description

The WebSocket hub (§17.2, §13.1): a socket.io `@WebSocketGateway` that the rest of the system broadcasts through. Phase 3 ships the **skeleton** with three typed emit methods consumed by later phases — `emitConnectionEvent(event, data)` → channel `cache:connection` (driven by the events bridge, P3-4), `emitMessage(channel, payload)` → channel `cache:event` (Pub/Sub fan-out, Phase 8), and `emitExpired(key)` → channel `cache:expired` (TTL keyspace notifications, Phase 9). CORS is scoped to `WEB_ORIGIN`. The `@WebSocketServer()` `Server` is held for broadcasting; no inbound message handlers are required yet.

### Acceptance Criteria

- [x] `src/events/events.gateway.ts` exports an `@WebSocketGateway(...)`-decorated `EventsGateway` with CORS applied at the adapter level in `main.ts` (option b — static decorator, CORS resolved from `ConfigService` after boot).
- [x] Holds a `@WebSocketServer()` `Server` (from `socket.io`).
- [x] `emitConnectionEvent(event: CacheEventName, data: Record<string, unknown>): void` → `server.emit('cache:connection', { event, data })`.
- [x] `emitMessage(channel: string, payload: unknown): void` → `server.emit('cache:event', { channel, payload })`.
- [x] `emitExpired(key: string): void` → `server.emit('cache:expired', { key })`.
- [x] A matching `EventsModule` exports `EventsGateway` (so `CacheEventsBridge` and later modules can inject it).
- [x] Channel names are exactly `cache:connection` / `cache:event` / `cache:expired` (matches §13.1).
- [x] `pnpm --filter api typecheck` exits 0.

### Files to create / modify

- `apps/api/src/events/events.gateway.ts` — the gateway skeleton.
- `apps/api/src/events/events.module.ts` — provides + exports `EventsGateway` (and `CacheEventsBridge` if co-located).

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer (WebSockets).
> PROJECT: `nest-cache-example`, the reference app for `@bymax-one/nest-cache`. See `docs/TECHNICAL_SPECIFICATION.md` §17.2 (the WS bridge), §13.1 (the three multiplexed channels `cache:connection` / `cache:event` / `cache:expired`), §3 (control + observability planes), and `docs/DEVELOPMENT_PLAN.md` §Phase 3. This is task P3-5.
> PRECONDITIONS: P3-1 done (`@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io` installed; `IoAdapter` wired in `main.ts`).
> REQUIRED READING: spec §17.2, §13.1, §20.1; plan §Phase 3, §2.
> TASK: Build the `EventsGateway` skeleton with three typed emit methods and its `EventsModule`. No inbound handlers needed yet — later phases (8 Pub/Sub, 9 TTL) drive the emitters.
> DELIVERABLES / Steps:
>
> 1. Create `src/events/events.gateway.ts`:
>
>    ```ts
>    import { Injectable } from '@nestjs/common'
>    import { ConfigService } from '@nestjs/config'
>    import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets'
>    import { Server } from 'socket.io'
>    import type { CacheEventName } from '@bymax-one/nest-cache'
>    import type { Env } from '../config/env.schema'
>
>    /**
>     * socket.io hub that streams cache signals to the dashboard over three channels:
>     *   - `cache:connection` — lifecycle/status (driven by CacheEventsBridge)
>     *   - `cache:event`       — Pub/Sub fan-out (Phase 8)
>     *   - `cache:expired`     — TTL keyspace notifications (Phase 9)
>     */
>    @Injectable()
>    @WebSocketGateway({ cors: { origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000' } })
>    export class EventsGateway {
>      @WebSocketServer() private readonly server!: Server
>
>      constructor(private readonly config: ConfigService<Env, true>) {}
>
>      /** Broadcasts a connection-lifecycle event to all clients. */
>      emitConnectionEvent(event: CacheEventName, data: Record<string, unknown>): void {
>        this.server.emit('cache:connection', { event, data })
>      }
>
>      /** Broadcasts a Pub/Sub message to all clients. */
>      emitMessage(channel: string, payload: unknown): void {
>        this.server.emit('cache:event', { channel, payload })
>      }
>
>      /** Broadcasts a key-expiry (TTL) notification to all clients. */
>      emitExpired(key: string): void {
>        this.server.emit('cache:expired', { key })
>      }
>    }
>    ```
>
>    NOTE on the CORS origin: the `@WebSocketGateway` decorator is evaluated at class-definition time, before DI, so it cannot read `ConfigService` inline. Two acceptable patterns — (a) keep the decorator's `cors.origin` reading the validated `WEB_ORIGIN` via a small synchronous helper that re-parses env with the same Zod schema, or (b) set the adapter-level CORS in `main.ts` (`new IoAdapter` with a custom `createIOServer` applying `WEB_ORIGIN`). Prefer (b) so the gateway decorator stays static and the single source of truth for CORS is `main.ts`; document the choice. Avoid a bare `process.env` read in the final code if (b) is used — drop the decorator `cors` entirely and rely on the adapter.
>
> 2. Create `src/events/events.module.ts` providing and exporting `EventsGateway` (co-locate `CacheEventsBridge` here, or keep it in `cache/` and have `EventsModule` export only the gateway — coordinate with P3-4/P3-6):
>
>    ```ts
>    import { Module } from '@nestjs/common'
>    import { EventsGateway } from './events.gateway'
>
>    @Module({ providers: [EventsGateway], exports: [EventsGateway] })
>    export class EventsModule {}
>    ```
>
>    Constraints:
>
> - Follow §2 Global Conventions. JSDoc file-header + JSDoc on each emit method. English only.
> - Channel names are EXACTLY `cache:connection`, `cache:event`, `cache:expired` (the dashboard's `lib/socket.ts` multiplexes these — §13.1). Do NOT rename.
> - Use `socket.io` `Server` typing for `@WebSocketServer()`. NO `any`.
> - CORS must resolve to `WEB_ORIGIN` — do NOT leave it wide open (`*`). Prefer adapter-level CORS in `main.ts` over a `process.env` read in the decorator (§24 — CORS restricted to `WEB_ORIGIN`).
> - This is a SKELETON: implement the three emitters only; do NOT add Pub/Sub subscription or keyspace logic (Phases 8/9 own those).
> - No suppressions.
>   Verification:
> - `pnpm --filter api typecheck` — expected: exit 0.
> - `grep -nE "cache:(connection|event|expired)" apps/api/src/events/events.gateway.ts` — expected: all three channel literals present.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P3-5 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P3-6 — `src/cache/cache.module.ts` + `src/app.module.ts` — `forRootAsync` Wiring

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** M (90 min – half day)
- **Depends on:** `P3-3`, `P3-4`

### Description

The primary library wiring (§9.2, matrix #1): a local `CacheModule` (the app's re-export wrapper, per §6 layout) that registers `BymaxCacheModule.forRootAsync({ isGlobal: true, imports: [ConfigModule, EventsModule], inject: [ConfigService, CacheEventsBridge], useFactory })`, where `useFactory` calls `buildCacheOptions(config, bridge.toCacheEvents())`. The root `app.module.ts` assembles the application: `ConfigModule.forRoot` (P3-2), `EventsModule` (P3-5), `CacheModule`, and the global `CacheExceptionFilter` (P3-7) via `APP_FILTER`. The defining lesson here is that **`isGlobal` is decided synchronously by the module builder — it MUST be passed at the `forRootAsync({ isGlobal, … })` call site, never returned from inside `useFactory`** (§9.2 warning).

### Acceptance Criteria

- [x] `src/cache/cache.module.ts` registers `BymaxCacheModule.forRootAsync({ isGlobal: true, imports: [ConfigModule, EventsModule], inject: [ConfigService, EventsGateway], useFactory })`.
- [x] `useFactory: (config, gateway) => buildCacheOptions(config, new CacheEventsBridge(gateway).toCacheEvents())` — bridge is stateless and constructed in-factory; DI-managed `CacheEventsBridge` is provided for feature modules.
- [x] `isGlobal: true` is set at the `forRootAsync({ … })` call site (NOT inside `useFactory`); an inline comment explains the synchronous-decision rule.
- [x] The local `CacheModule` imports `EventsModule` (so `EventsGateway` is injectable) and re-exports `BymaxCacheModule` so feature modules get `CacheService` & co.
- [x] `src/app.module.ts` imports `ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })`, `EventsModule`, `CacheModule`, registers `CacheExceptionFilter` via `{ provide: APP_FILTER, useClass: CacheExceptionFilter }`, and declares the `HealthController` (from P3-9).
- [x] DI uses NestJS conventions; tokens are Symbols injected via the library's providers (no manual `@Inject(TOKEN)` needed at this layer — the library wires them; explicit `@Inject(TOKEN)` is only for direct token consumers like P3-9/Phase 4+).
- [x] `pnpm --filter api typecheck` exits 0 and `pnpm --filter api build` succeeds.

### Files to create / modify

- `apps/api/src/cache/cache.module.ts` — `forRootAsync` registration + re-export.
- `apps/api/src/app.module.ts` — root module assembly + `APP_FILTER`.

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer wiring a dynamic module.
> PROJECT: `nest-cache-example`, the reference app for `@bymax-one/nest-cache`. See `docs/TECHNICAL_SPECIFICATION.md` §9.2 (the canonical async registration + the `isGlobal` warning), §6 (`cache/cache.module.ts` re-exports the library), §10.1 (module map), §10.3 (cross-cutting providers / `APP_FILTER`), and `docs/DEVELOPMENT_PLAN.md` §Phase 3. This is task P3-6.
> PRECONDITIONS: P3-3 (`buildCacheOptions`), P3-4 (`CacheEventsBridge`), P3-5 (`EventsModule`), P3-2 (`validateEnv`/`Env`) done; P3-7 (`CacheExceptionFilter`) and P3-9 (`HealthController`) wired here (stub-import if landing in the same batch).
> REQUIRED READING: spec §9.2, §6, §10.1, §10.3; §4.1 (DI tokens are Symbols; the library provides `CacheService`, `PubSubService`, `ConnectionManager`, `KeyBuilder`, etc.); plan §Phase 3, §2.
> TASK: Wire `BymaxCacheModule.forRootAsync` in a local `CacheModule` and assemble the root `AppModule` with the global exception filter.
> DELIVERABLES / Steps:
>
> 1. Create `src/cache/cache.module.ts`:
>
>    ```ts
>    import { Module } from '@nestjs/common'
>    import { ConfigModule, ConfigService } from '@nestjs/config'
>    import { BymaxCacheModule } from '@bymax-one/nest-cache'
>    import { EventsModule } from '../events/events.module'
>    import { CacheEventsBridge } from './cache.events'
>    import { buildCacheOptions } from './cache.config'
>    import type { Env } from '../config/env.schema'
>
>    /**
>     * Registers BymaxCacheModule for the whole app.
>     *
>     * IMPORTANT: `isGlobal` is decided SYNCHRONOUSLY by the library's module builder,
>     * before the async `useFactory` resolves — so it MUST be passed here, at the
>     * `forRootAsync({ isGlobal, … })` call site. Returning `isGlobal` from inside
>     * `useFactory` has NO effect (see spec §9.2).
>     */
>    @Module({
>      imports: [
>        EventsModule,
>        BymaxCacheModule.forRootAsync({
>          isGlobal: true, // synchronous decision — must live here, not in useFactory
>          imports: [ConfigModule, EventsModule],
>          inject: [ConfigService, CacheEventsBridge],
>          useFactory: (config: ConfigService<Env, true>, bridge: CacheEventsBridge) =>
>            buildCacheOptions(config, bridge.toCacheEvents()),
>        }),
>      ],
>      exports: [BymaxCacheModule],
>    })
>    export class CacheModule {}
>    ```
>
> 2. Create/replace `src/app.module.ts`:
>
>    ```ts
>    import { Module } from '@nestjs/common'
>    import { ConfigModule } from '@nestjs/config'
>    import { APP_FILTER } from '@nestjs/core'
>    import { validateEnv } from './config/env.schema'
>    import { EventsModule } from './events/events.module'
>    import { CacheModule } from './cache/cache.module'
>    import { CacheExceptionFilter } from './common/cache-exception.filter'
>    import { HealthController } from './health/health.controller'
>
>    /** Root module — config validation, cache wiring, WS hub, global cache-error filter. */
>    @Module({
>      imports: [
>        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
>        EventsModule,
>        CacheModule,
>      ],
>      controllers: [HealthController],
>      providers: [{ provide: APP_FILTER, useClass: CacheExceptionFilter }],
>    })
>    export class AppModule {}
>    ```
>
>    Constraints:
>
> - Follow §2 Global Conventions. JSDoc on both module classes. English only.
> - **CRITICAL:** `isGlobal: true` goes at the `forRootAsync({ … })` call site — NEVER inside `useFactory`. Keep the explanatory comment (this is matrix #1's headline lesson and the single most important review point of the phase).
> - `BymaxCacheModule.forRootAsync(options)` takes the options object directly; `inject`/`imports`/`useFactory` are standard NestJS async-options fields. DI tokens (`BYMAX_CACHE_*`) are Symbols the library registers itself — you do NOT declare them here; explicit `@Inject(TOKEN)` is for direct token consumers (health/admin/ttl in later phases).
> - The library's published DI uses explicit `@Inject(TOKEN)` internally — your job is only to provide the options; `CacheService` etc. become injectable app-wide because `isGlobal: true`.
> - Import `BymaxCacheModule` from `@bymax-one/nest-cache` (server subpath).
> - Register the exception filter globally via `APP_FILTER` (not `app.useGlobalFilters` in `main.ts`) so it participates in DI. No suppressions.
>   Verification:
> - `pnpm --filter api typecheck` — expected: exit 0.
> - `pnpm --filter api build` — expected: exit 0.
> - `grep -nA1 "forRootAsync" apps/api/src/cache/cache.module.ts | grep -q isGlobal` — expected: `isGlobal` appears at the call site.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P3-6 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P3-7 — `src/common/cache-exception.filter.ts` — Global `@Catch(CacheException)`

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** S (30–90 min)
- **Depends on:** `P3-1`

### Description

The global error surface (§19.1, matrix #41–#44 partial): a `@Catch(CacheException)` `ExceptionFilter` that serializes every `CacheException` to a stable `{ error: { code, message, details } }` body. `CacheException extends HttpException`, so the HTTP status comes from `exception.getStatus()`; the readonly `.code` (a `CacheErrorCode`) selects the canonical message from `CACHE_ERROR_MESSAGES` (a `ReadonlyMap` — use `.get(code)`), falling back to `exception.message`; `.details` (already secret-free by library contract) passes through as `details ?? null`. Registered globally via `APP_FILTER` in P3-6.

### Acceptance Criteria

- [x] `src/common/cache-exception.filter.ts` exports `@Catch(CacheException)`-decorated `CacheExceptionFilter implements ExceptionFilter`.
- [x] `catch(exception, host)` uses `host.switchToHttp().getResponse()` (Express) and `res.status(exception.getStatus()).json({ error: { code, message, details } })`.
- [x] `code` ← `exception.code`; `message` ← `CACHE_ERROR_MESSAGES.get(exception.code) ?? exception.message`; `details` ← `exception.details ?? null`.
- [x] `CacheException` + `CACHE_ERROR_MESSAGES` imported from `@bymax-one/nest-cache` (server subpath).
- [x] No secret scrubbing added (library contract guarantees `details` is secret-free); JSDoc notes this.
- [x] `pnpm --filter api typecheck` exits 0.

### Files to create / modify

- `apps/api/src/common/cache-exception.filter.ts` — the global filter.

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer.
> PROJECT: `nest-cache-example`, the reference app for `@bymax-one/nest-cache`. See `docs/TECHNICAL_SPECIFICATION.md` §19.1 (the canonical filter), §19.2 (code→HTTP table), §4.1 (`CacheException` carries `.code` + `.details`; `CACHE_ERROR_MESSAGES` is a `ReadonlyMap`), §10.3, and `docs/DEVELOPMENT_PLAN.md` §Phase 3. This is task P3-7.
> PRECONDITIONS: P3-1 done. Registered globally in P3-6 via `APP_FILTER`.
> REQUIRED READING: spec §19.1–§19.2, §4.1; plan §Phase 3, §2.
> TASK: Implement the global `CacheExceptionFilter` exactly per §19.1.
> DELIVERABLES / Steps:
>
> 1. Create `src/common/cache-exception.filter.ts`:
>
>    ```ts
>    import { Catch, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common'
>    import type { Response } from 'express'
>    import { CacheException, CACHE_ERROR_MESSAGES } from '@bymax-one/nest-cache'
>
>    /**
>     * Serializes any CacheException to a stable structured body:
>     *   { error: { code, message, details } }
>     * `message` prefers the library's canonical CACHE_ERROR_MESSAGES entry.
>     * `details` is secret-free by library contract, so it passes through verbatim.
>     */
>    @Catch(CacheException)
>    export class CacheExceptionFilter implements ExceptionFilter {
>      catch(exception: CacheException, host: ArgumentsHost): void {
>        const res = host.switchToHttp().getResponse<Response>()
>        res.status(exception.getStatus()).json({
>          error: {
>            code: exception.code,
>            message: CACHE_ERROR_MESSAGES.get(exception.code) ?? exception.message,
>            details: exception.details ?? null,
>          },
>        })
>      }
>    }
>    ```
>
>    Constraints:
>
> - Follow §2 Global Conventions. JSDoc on the class. English only.
> - `CacheException extends HttpException` — derive status from `exception.getStatus()`, do NOT hardcode.
> - `CACHE_ERROR_MESSAGES` is a `ReadonlyMap<CacheErrorCode, string>` — use `.get(code)`, NOT bracket/index access.
> - `.code` is a readonly `CacheErrorCode`; `.details` is library-provided and secret-free — do NOT add scrubbing.
> - This filter is registered via `APP_FILTER` (P3-6) so it is DI-aware — do NOT also register it in `main.ts`.
> - Express response typing (`import type { Response } from 'express'`). No `any`, no suppressions.
>   Verification:
> - `pnpm --filter api typecheck` — expected: exit 0.
> - `grep -n "CACHE_ERROR_MESSAGES.get" apps/api/src/common/cache-exception.filter.ts` — expected: match (Map `.get`, not index).
> - `grep -n "exception.getStatus()" apps/api/src/common/cache-exception.filter.ts` — expected: match.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P3-7 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P3-8 — `src/common/zod-validation.pipe.ts` + `src/common/cache-keys.ts`

- **Status:** 🟢 Done
- **Priority:** Medium
- **Size:** S (30–90 min)
- **Depends on:** `P3-1`

### Description

Two shared building blocks the feature phases depend on. **`ZodValidationPipe`** (§10.3, §23.4) — a Nest `PipeTransform` constructed with a route's Zod schema; it `safeParse`s the incoming `@Body()`/`@Query()` value and throws a `BadRequestException` (HTTP 400) carrying the flattened `ZodError` on failure, returning the parsed value on success (this is the Bymax "Zod instead of class-validator" convention). **`cache-keys.ts`** (§10.2, matrix #40) — the app's typed key-prefix constants (`product`, `cart`, `tags`, `stampede`, …) declared against the library's `CacheKeyPrefix` type so every feature module references a single source of truth rather than string literals.

### Acceptance Criteria

- [x] `src/common/zod-validation.pipe.ts` exports `@Injectable()` `ZodValidationPipe implements PipeTransform`, constructed with a `ZodSchema` (or `ZodType`).
- [x] `transform(value, _metadata)` runs `schema.safeParse(value)`; on `!success` throws `BadRequestException` with the flattened error; on success returns `parsed.data`.
- [x] `src/common/cache-keys.ts` exports a frozen `CACHE_PREFIX` object whose values are typed as `CacheKeyPrefix`, covering at minimum `product`, `cart`, `tags`, `stampede` (extendable in later phases).
- [x] `CacheKeyPrefix` imported from `@bymax-one/nest-cache` or `@bymax-one/nest-cache/shared` (confirm against `.d.ts`); `ZodError`/`ZodSchema` from `zod`.
- [x] `pnpm --filter api typecheck` exits 0.

### Files to create / modify

- `apps/api/src/common/zod-validation.pipe.ts` — the Zod pipe.
- `apps/api/src/common/cache-keys.ts` — typed prefix constants.

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer.
> PROJECT: `nest-cache-example`, the reference app for `@bymax-one/nest-cache`. See `docs/TECHNICAL_SPECIFICATION.md` §10.3 (`ZodValidationPipe`), §23.4 (Zod-not-class-validator, no Swagger), §10.2 (typed `CACHE_PREFIX`), §4.1/§4.2 (`CacheKeyPrefix`, `CacheNamespace`), and `docs/DEVELOPMENT_PLAN.md` §Phase 3. This is task P3-8.
> PRECONDITIONS: P3-1 done (`zod` installed; `@bymax-one/nest-cache` linked).
> REQUIRED READING: spec §10.2–§10.3, §23.4, §4.1–§4.2; plan §Phase 3, §2.
> TASK: Implement the reusable `ZodValidationPipe` and the typed `cache-keys.ts` prefix constants.
> DELIVERABLES / Steps:
>
> 1. Create `src/common/zod-validation.pipe.ts`:
>
>    ```ts
>    import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common'
>    import type { ZodType } from 'zod'
>
>    /**
>     * Validates a route input against a Zod schema. A ZodError becomes HTTP 400.
>     * Usage: `@Body(new ZodValidationPipe(createXDto)) body: CreateXDto`.
>     */
>    @Injectable()
>    export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
>      constructor(private readonly schema: ZodType<T>) {}
>
>      transform(value: unknown): T {
>        const parsed = this.schema.safeParse(value)
>        if (!parsed.success) {
>          throw new BadRequestException({
>            error: { code: 'validation_failed', issues: parsed.error.flatten() },
>          })
>        }
>        return parsed.data
>      }
>    }
>    ```
>
> 2. Create `src/common/cache-keys.ts`:
>
>    ```ts
>    import type { CacheKeyPrefix } from '@bymax-one/nest-cache/shared'
>
>    /**
>     * Typed key-prefix constants — the single source of truth for every cache key
>     * prefix used by the app's feature modules (composed by the library's KeyBuilder
>     * as `{namespace}:{prefix}:{id}`). Extended in later phases (counters, tenants, …).
>     */
>    export const CACHE_PREFIX = {
>      product: 'product',
>      cart: 'cart',
>      tags: 'tags',
>      stampede: 'stampede',
>    } as const satisfies Record<string, CacheKeyPrefix>
>    ```
>
>    (If `CacheKeyPrefix` is a branded/opaque type rather than a plain `string`, follow its `.d.ts` shape — adjust the `satisfies` constraint accordingly, or import a constructor/const the library exposes. Verify against the shipped types.)
>    Constraints:
>
> - Follow §2 Global Conventions. JSDoc on the pipe class + the constants block. English only.
> - Use **Zod** (`ZodType`/`safeParse`) — NO class-validator, NO Swagger DTO decorators.
> - The pipe maps a failed parse to **HTTP 400** (`BadRequestException`); shape the body consistently with the app's `{ error: … }` envelope (P3-7) where reasonable.
> - `cache-keys.ts` values must be typed as `CacheKeyPrefix` (matrix #40) — do NOT scatter raw prefix string literals across feature modules.
> - `as const satisfies …` to keep both literal types and the `CacheKeyPrefix` constraint. No suppressions, no `as any`.
>   Verification:
> - `pnpm --filter api typecheck` — expected: exit 0.
> - `grep -n "satisfies" apps/api/src/common/cache-keys.ts` — expected: `satisfies Record<…, CacheKeyPrefix>` present.
> - `grep -n "BadRequestException" apps/api/src/common/zod-validation.pipe.ts` — expected: match.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P3-8 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P3-9 — `src/health/health.controller.ts` (`/health` + `/metrics`) + Boot Verification

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** S (30–90 min)
- **Depends on:** `P3-6`, `P3-7`, `P3-8`

### Description

The phase's closing deliverable + the Definition-of-Done gate (§20.2, matrix #29). `GET /health` calls the library's `CacheService.isHealthy()` (never throws → probe-safe) and `ping()` (round-trip latency, throws on failure → wrapped), returning `{ status, latencyMs }`. `GET /metrics` is a documented placeholder (real app-level hit/miss counters land in Phase 4's `MetricsService`). Then the boot verification: with Docker Redis up (Phase 1), `pnpm --filter api dev` must boot, `GET /health` must return 200, and the library's `ready` lifecycle event must be logged (via the bridge) and broadcast on `cache:connection`.

### Acceptance Criteria

- [x] `src/health/health.controller.ts` exports a `@Controller()`-decorated `HealthController` with `GET /health` returning `{ status: 'ok' | 'degraded', latencyMs: number }` (JSDoc with the literal route line — no Swagger).
- [x] `/health` uses `CacheService.isHealthy()` for `status` and measures `ping()` latency (e.g. `Date.now()` around `await cache.ping()`), guarding `ping`'s possible throw so the probe still returns a JSON body.
- [x] `GET /metrics` returns a placeholder object (`{ note: 'app-level metrics arrive in a later phase (MetricsService)' }`) with a JSDoc/TODO(phase-4) marker.
- [x] `CacheService` injected via standard NestJS DI (constructor param) — available app-wide because `CacheModule` registered it `isGlobal: true` (P3-6).
- [x] `HealthController` declared in `AppModule` (P3-6).
- [x] Boot verification passes: `pnpm --filter api start` boots against Docker Redis; `GET /health` → 200 `{"status":"ok","latencyMs":2}`; the `ready` event logged by `CacheEventsBridge` and emitted on `cache:connection`.
- [x] `pnpm --filter api typecheck` + `pnpm --filter api build` exit 0; `pnpm lint` clean for `apps/api`.

### Files to create / modify

- `apps/api/src/health/health.controller.ts` — the health/metrics controller.

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer.
> PROJECT: `nest-cache-example`, the reference app for `@bymax-one/nest-cache`. See `docs/TECHNICAL_SPECIFICATION.md` §20.2 (health), §11.1 (`GET /health`, `GET /metrics`), §20.3 (app-level metrics deferred), §4.1 (`isHealthy`/`ping`/`info` semantics), and `docs/DEVELOPMENT_PLAN.md` §Phase 3 (Definition of done). This is task P3-9 — it CLOSES Phase 3.
> PRECONDITIONS: P3-6 (`CacheModule` registered `isGlobal: true`, `AppModule` assembled), P3-7 (filter), P3-8 (common) done; Phase 1 Docker Redis is up (`docker compose up -d` / `pnpm infra:up`).
> REQUIRED READING: spec §20.2, §11.1, §20.3, §4.1; plan §Phase 3 (esp. Definition of done), §2.
> TASK: Implement `HealthController` (`/health` + `/metrics` placeholder), then perform the live boot verification that closes the phase.
> DELIVERABLES / Steps:
>
> 1. Create `src/health/health.controller.ts`:
>
>    ```ts
>    import { Controller, Get } from '@nestjs/common'
>    import { CacheService } from '@bymax-one/nest-cache'
>
>    /** Liveness/health surface. No Swagger — JSDoc documents the routes. */
>    @Controller()
>    export class HealthController {
>      constructor(private readonly cache: CacheService) {}
>
>      /**
>       * GET /health — probe-safe health + Redis round-trip latency.
>       * @returns `{ status, latencyMs }` (200 even when degraded).
>       */
>      @Get('health')
>      async health(): Promise<{ status: 'ok' | 'degraded'; latencyMs: number }> {
>        const healthy = await this.cache.isHealthy() // never throws
>        const start = Date.now()
>        try {
>          await this.cache.ping() // throws on failure
>          return { status: healthy ? 'ok' : 'degraded', latencyMs: Date.now() - start }
>        } catch {
>          return { status: 'degraded', latencyMs: Date.now() - start }
>        }
>      }
>
>      /**
>       * GET /metrics — placeholder. Real app-level hit/miss counters land in Phase 4.
>       * @returns A placeholder marker object.
>       */
>      @Get('metrics')
>      metrics(): { note: string } {
>        return { note: 'app-level metrics arrive in Phase 4 (MetricsService)' } // TODO(phase-4)
>      }
>    }
>    ```
>
>    (`CacheService` is injected directly — it is app-wide via the `isGlobal: true` registration in P3-6. If a route prefix is desired, keep `@Controller()` and the `@Get('health')`/`@Get('metrics')` paths as above so the URLs are exactly `/health` and `/metrics`.)
>
> 2. Boot verification (the phase DoD — run, observe, fix upstream if red):
>    - Ensure Redis is up: `docker compose up -d` (or `pnpm infra:up`) — Phase 1 stack.
>    - `pnpm --filter api dev` — the app must boot with no unhandled errors.
>    - `curl -s http://localhost:3001/health` — expected: HTTP 200 with `{"status":"ok","latencyMs":<number>}`.
>    - Confirm the library's `ready` lifecycle event is logged by `CacheEventsBridge` (look for `[cache] ready` in the Nest log) AND broadcast on the `cache:connection` socket.io channel (e.g. a quick `socket.io-client` snippet or browser console once Phase 6 web exists — for now, assert the server-side `emitConnectionEvent` fires by logging/observing).
>    - If anything is red, fix the responsible upstream task file (P3-1..P3-8) and re-verify here. Do NOT paper over with stubs.
>      Constraints:
>
> - Follow §2 Global Conventions. JSDoc with the literal route line on each handler. English only. NO Swagger.
> - `isHealthy()` NEVER throws (probe-safe) — use it for `status`; `ping()` MAY throw — wrap it and still return a JSON body so the probe never 500s.
> - `info(section?)` is available but NOT required here (Phase 11's connection page / admin uses it). Do NOT add it now beyond the placeholder scope.
> - `CacheService` via constructor DI; do NOT `@Inject` a token for it (the facade is a normal provider). NO `console.*`; NO `--no-verify`; no suppressions.
>   Verification:
> - `pnpm --filter api typecheck` — expected: exit 0.
> - `pnpm --filter api build` — expected: exit 0.
> - `pnpm --filter api dev` + `curl -s http://localhost:3001/health` — expected: 200 `{ status: 'ok', latencyMs: <n> }`.
> - API log shows `[cache] ready` (bridge logged the lifecycle event) and `emitConnectionEvent` fired on `cache:connection`.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P3-9 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

When this task is 🟢, Phase 3 is 9/9 — switch the Phase 3 row in `DEVELOPMENT_PLAN.md` Progress Summary to 🟢 Done.

⚠️ Never mark done with failing verification.

---

## Completion log

_(Agents append one line per finished task, newest at the bottom.)_

- P3-1 ✅ 2026-06-16 — Scaffolded `apps/api` with NestJS 11/Express: `package.json` (ESM, full dep set), `nest-cli.json`, `tsconfig.json`/`tsconfig.build.json` (NodeNext + decorator metadata), `src/main.ts` with `SocketIoAdapter` CORS pattern and graceful-shutdown JSDoc.
- P3-2 ✅ 2026-06-16 — Created Zod env schema (`envSchema`), `validateEnv()`, `Env` type, `.env.example`; wired `ConfigModule.forRoot({ validate: validateEnv })` in `AppModule`.
- P3-3 ✅ 2026-06-16 — Implemented `buildCacheOptions(config, events)` factory; standalone path wired from `REDIS_URL`; serializer and scripts placeholder; sentinel/cluster stubs throw with clear messages.
- P3-4 ✅ 2026-06-16 — Implemented `CacheEventsBridge.toCacheEvents()`: branches on `CACHE_EVENT_NAMES.ERROR`, logs via Nest Logger, broadcasts via `EventsGateway.emitConnectionEvent`.
- P3-5 ✅ 2026-06-16 — Created `EventsGateway` skeleton with three typed emit methods (`cache:connection`, `cache:event`, `cache:expired`); CORS applied adapter-level in `main.ts` via `SocketIoAdapter`.
- P3-6 ✅ 2026-06-16 — Wired `BymaxCacheModule.forRootAsync({ isGlobal: true })` in `CacheModule`; `EventsGateway` injected to avoid DI circular dep; `CacheEventsBridge` also provided as DI provider; `AppModule` assembled with `APP_FILTER`.
- P3-7 ✅ 2026-06-16 — Implemented global `CacheExceptionFilter`: serializes `CacheException` to `{ error: { code, message, details } }` using `CACHE_ERROR_MESSAGES.get()`.
- P3-8 ✅ 2026-06-16 — Created `ZodValidationPipe<T>` (HTTP 400 on schema failure) and `CACHE_PREFIX` constants typed as `CacheKeyPrefix`.
- P3-9 ✅ 2026-06-16 — Implemented `HealthController` (`/health` + `/metrics`); boot verification passed: `{"status":"ok","latencyMs":2}`, `[cache] connect`/`ready` logged, all gates green (typecheck, build, lint, format).
