# Phase 7 — Serialization (default + custom) — Tasks

> **Source:** [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#phase-7--serialization-default--custom) §Phase 7
> **Total tasks:** 4
> **Progress:** 🟢 4 / 4 done (100%)
>
> **Status legend:** 🔴 Not Started · 🟡 In Progress · 🔵 In Review · 🟢 Done · ⚪ Blocked

## Task index

| ID   | Task                                                                           | Status | Priority | Size | Depends on |
| ---- | ------------------------------------------------------------------------------ | ------ | -------- | ---- | ---------- |
| P7-1 | `src/cache/msgpack.serializer.ts` — `MsgPackSerializer implements ISerializer` | 🟢     | Medium   | S    | Phase 3    |
| P7-2 | Wire `CACHE_SERIALIZER` selection into `src/cache/cache.config.ts`             | 🟢     | High     | S    | P7-1       |
| P7-3 | `src/serializer-demo/` — `POST /serializer/roundtrip` (raw vs decoded)         | 🟢     | High     | M    | P7-1, P7-2 |
| P7-4 | `SerializableValue` caveat payload (`Date`) + phase verification               | 🟢     | Medium   | S    | P7-1..P7-3 |

---

## P7-1 — `src/cache/msgpack.serializer.ts` — `MsgPackSerializer implements ISerializer`

- **Status:** 🟢 Done
- **Priority:** Medium
- **Size:** S (30–90 min)
- **Depends on:** `Phase 3`

### Description

Build the custom codec that the rest of the phase demonstrates against the library default. The library's default is `JsonSerializer` (round-trips through `JSON.stringify`/`JSON.parse`); this task adds a structure-preserving alternative — `MsgPackSerializer implements ISerializer` — that encodes with MessagePack and base64-wraps the bytes so they store safely in a Redis string (spec §16.2). `ISerializer` is the two-method contract `{ serialize<T>(value: T): string; deserialize<T>(raw: string): T }`; both directions must be **deterministic**, and `deserialize` MUST **fail closed** — throw on malformed input rather than return a partial/wrong value (spec §4.1, §16.1). MessagePack is binary-safe and compact, so the round-trip survives shapes JSON mangles (notably `Date`) and the encoded payload is typically smaller than the JSON string — both made visible in the lab (P7-3) and the caveat payload (P7-4). The `@msgpack/msgpack` dependency lands in `apps/api` here. Demonstrates matrix row #38 (`ISerializer` custom implementation).

### Acceptance Criteria

- [x] `apps/api/src/cache/msgpack.serializer.ts` exports `class MsgPackSerializer implements ISerializer`.
- [x] `serialize<T>(value: T): string` returns `Buffer.from(encode(value)).toString('base64')` (MessagePack → base64).
- [x] `deserialize<T>(raw: string): T` returns `decode(Buffer.from(raw, 'base64')) as T`, propagating the `@msgpack/msgpack` decode error on malformed input (fail closed — never returns a partial value).
- [x] `ISerializer` is imported as a **type-only** import from `@bymax-one/nest-cache` (`import type { ISerializer }`).
- [x] `@msgpack/msgpack` is added to `apps/api` `dependencies` (runtime, not dev).
- [x] The class carries a JSDoc summary (English) describing it as a compact, binary-safe, base64-wrapped codec.

### Files to create / modify

- `apps/api/src/cache/msgpack.serializer.ts` — the custom serializer.
- `apps/api/package.json` — add `@msgpack/msgpack` to `dependencies`.

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer implementing a custom cache serializer.
> Context: Repo `nest-cache-example` is the reference app for `@bymax-one/nest-cache` (see `docs/DEVELOPMENT_PLAN.md` §Phase 7 + §2 Global Conventions and `docs/TECHNICAL_SPECIFICATION.md` §4 [library API inventory] + §16 [Serialization]; cross-check `docs/DASHBOARD.md` §12 [Serializer Lab]). This is task P7-1. Phase 3 already wired `apps/api` with `BymaxCacheModule.forRootAsync` and the `cache/cache.config.ts` factory.
> Objective: Add a custom `ISerializer` (MessagePack, base64-wrapped) alongside the library's default `JsonSerializer`.
> Steps:
>
> 1. Add the dependency to the `apps/api` package (runtime, not dev): `pnpm --filter @nest-cache-example/api add @msgpack/msgpack` (use the workspace's actual `apps/api` package name).
> 2. Create `apps/api/src/cache/msgpack.serializer.ts`:
>
>    ```ts
>    import { decode, encode } from '@msgpack/msgpack'
>    import type { ISerializer } from '@bymax-one/nest-cache'
>
>    /** MessagePack codec — compact, binary-safe, base64-wrapped for Redis string storage. */
>    export class MsgPackSerializer implements ISerializer {
>      serialize<T>(value: T): string {
>        return Buffer.from(encode(value)).toString('base64')
>      }
>
>      deserialize<T>(raw: string): T {
>        return decode(Buffer.from(raw, 'base64')) as T
>      }
>    }
>    ```
>
> 3. Do NOT register the serializer anywhere yet — selection/wiring is P7-2. This task only ships the class + the dependency.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions (ESM-only, TS 5.9 strict, English-only comments, JSDoc on the exported class — NO Swagger).
> - `ISerializer` MUST be a **type-only** import (`verbatimModuleSyntax` is on; importing it as a value will fail typecheck).
> - `deserialize` MUST fail closed: let the `@msgpack/msgpack` decode throw on malformed/non-base64 input — do NOT wrap it in a try/catch that returns `null`/a partial value (spec §16.1; the library maps thrown deserialization errors to `cache.deserialization_failed`).
> - Both methods MUST be deterministic (same input → same output); no clocks, no randomness.
>   Verification:
> - `pnpm --filter @nest-cache-example/api typecheck` — expected: exit 0 (the class satisfies `ISerializer`).
> - `node -e "const {MsgPackSerializer}=await import('./apps/api/dist/cache/msgpack.serializer.js'); const s=new MsgPackSerializer(); const r=s.serialize({a:1}); console.log(r===s.serialize({a:1}), s.deserialize(r))"` — expected: `true { a: 1 }` (deterministic round-trip). _(Run after a build, or assert the round-trip from a `*.spec.ts` instead.)_
> - `node -e "const {MsgPackSerializer}=await import('./apps/api/dist/cache/msgpack.serializer.js'); try{ new MsgPackSerializer().deserialize('not-msgpack!!'); console.log('NO THROW — BAD') }catch{ console.log('threw — OK') }"` — expected: `threw — OK` (fails closed on malformed input).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P7-1 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

If phase reaches 100%, switch its row status in `DEVELOPMENT_PLAN.md` to 🟢.

⚠️ Never mark done with failing verification.

---

## P7-2 — Wire `CACHE_SERIALIZER` Selection into `src/cache/cache.config.ts`

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** S (30–90 min)
- **Depends on:** `P7-1`

### Description

Make the active codec env-selectable through the existing `buildCacheOptions(config, events)` factory created in Phase 3 (P3-3). A new `CACHE_SERIALIZER` env var chooses the serializer the module is registered with: `json` (the default) leaves the `serializer` module option **undefined** so the library's built-in `JsonSerializer` applies, and `msgpack` passes `new MsgPackSerializer()`. The "leave it undefined for the default" detail is deliberate and instructive — it shows the library's documented fallback (`serializer` default = `JsonSerializer`, spec §4.3) rather than re-passing the default by hand. The chosen serializer becomes injectable everywhere via the library's `BYMAX_CACHE_SERIALIZER` token, which P7-3 reads to display which codec is live. Demonstrates matrix rows #37 (default `JsonSerializer` path) and #38 (custom `ISerializer` swap).

### Acceptance Criteria

- [x] `apps/api/src/config/env.schema.ts` (from P3-2) includes `CACHE_SERIALIZER` as a Zod enum `['json', 'msgpack']` defaulting to `'json'` (matches spec §9.1).
- [x] `apps/api/src/cache/cache.config.ts` computes `const serializer = config.get('CACHE_SERIALIZER', { infer: true }) === 'msgpack' ? new MsgPackSerializer() : undefined`.
- [x] The returned `BymaxCacheModuleOptions` sets `serializer` to that value (so `json` → `undefined` → library default `JsonSerializer`; `msgpack` → `new MsgPackSerializer()`).
- [x] `MsgPackSerializer` is imported from `./msgpack.serializer` (the P7-1 class) — not re-implemented inline.
- [x] `apps/api/.env.example` documents `CACHE_SERIALIZER=json` with a comment noting the `json | msgpack` choices.
- [x] Booting with `CACHE_SERIALIZER` unset and with `=json` both resolve the library default; `=msgpack` resolves the custom codec (asserted in P7-3 / P7-4).

### Files to create / modify

- `apps/api/src/cache/cache.config.ts` — add the `serializer` selection branch.
- `apps/api/src/config/env.schema.ts` — add the `CACHE_SERIALIZER` enum (if not already present from P3-2).
- `apps/api/.env.example` — document `CACHE_SERIALIZER`.

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer wiring config-driven module options.
> Context: Task P7-2 of `docs/DEVELOPMENT_PLAN.md` §Phase 7. The `buildCacheOptions(config, events)` factory and the Zod `Env` schema already exist from Phase 3 (`docs/TECHNICAL_SPECIFICATION.md` §9.2 shows the canonical factory; §9.1 lists `CACHE_SERIALIZER` default `json`). `MsgPackSerializer` exists from P7-1.
> Objective: Select the library serializer from the `CACHE_SERIALIZER` env var, leaving `json` as the library default.
> Steps:
>
> 1. In `apps/api/src/config/env.schema.ts`, ensure the env schema has `CACHE_SERIALIZER: z.enum(['json', 'msgpack']).default('json')` (add it if P3-2 didn't). Confirm the inferred `Env` type picks it up.
> 2. In `apps/api/src/cache/cache.config.ts`, import the codec and compute the option exactly as the spec prescribes (§9.2):
>    ```ts
>    import { MsgPackSerializer } from './msgpack.serializer'
>    // …inside buildCacheOptions(config, events):
>    const serializer =
>      config.get('CACHE_SERIALIZER', { infer: true }) === 'msgpack'
>        ? new MsgPackSerializer()
>        : undefined // undefined → library default JsonSerializer
>    // …and in the returned BymaxCacheModuleOptions:
>    // serializer,
>    ```
> 3. Add `CACHE_SERIALIZER=json` to `apps/api/.env.example` with a one-line comment: `# json (default → library JsonSerializer) | msgpack (→ MsgPackSerializer)`.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions (English-only, JSDoc, no Swagger).
> - When `json`, the option MUST be `undefined` — do NOT construct or import `JsonSerializer` to pass it explicitly (the whole point is to exercise the library's documented default, spec §4.3).
> - Do NOT change any other field of the factory (mode/connection/namespace/events/scripts stay exactly as Phase 3 left them); add only the `serializer` branch.
> - Keep the inline comment `// undefined → library default JsonSerializer` verbatim — it is the teaching note.
>   Verification:
> - `pnpm --filter @nest-cache-example/api typecheck` — expected: exit 0.
> - `CACHE_SERIALIZER=msgpack pnpm --filter @nest-cache-example/api start` (or the e2e bootstrap) then hit `GET /serializer/active` (P7-3) — expected: reports `msgpack`. With the var unset → reports `json`. _(If P7-3 isn't built yet, assert `buildCacheOptions` returns `serializer instanceof MsgPackSerializer` for `msgpack` and `serializer === undefined` for `json` in a `*.spec.ts`.)_
> - `grep CACHE_SERIALIZER apps/api/.env.example` — expected: matches `CACHE_SERIALIZER=json`.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P7-2 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P7-3 — `src/serializer-demo/` — `POST /serializer/roundtrip` (raw vs decoded)

- **Status:** 🟢 Done
- **Priority:** High
- **Size:** M (90 min–½ day)
- **Depends on:** `P7-1`, `P7-2`

### Description

Build the backend for the Serializer Lab (DASHBOARD §12): a module that stores a payload and returns, side by side, the **raw stored string** (what bytes Redis actually holds) and the **decoded value** (what the consumer gets back). `POST /serializer/roundtrip?codec=json|msgpack` writes the body and reads it back two ways — `getRaw(prefix, id)` for the raw stored string and `get<T>(prefix, id)` for the deserialized value — so the encoding difference and the size delta are observable (JSON is human-readable text; MessagePack is a smaller base64 blob). The endpoint also reports **which serializer is active**, obtained by injecting the library's `BYMAX_CACHE_SERIALIZER` token and reading the instance's constructor name. Per the library's raw-string contract, `getRaw(prefix, id): Promise<string | null>` and `setRaw(prefix, id, value, ttlSeconds?)` bypass the serializer entirely (they read/write the stored string verbatim), while `get`/`set` apply the active codec — exactly the contrast the lab visualizes. Demonstrates matrix rows #11 (`BYMAX_CACHE_SERIALIZER` injected), #14 (`getRaw`/`setRaw`), #37 (`JsonSerializer` default path), and #38 (`MsgPackSerializer` swap).

### Acceptance Criteria

- [x] `apps/api/src/serializer-demo/serializer-demo.module.ts`, `.controller.ts`, `.service.ts` exist; `SerializerDemoModule` is imported by `app.module.ts`.
- [x] `POST /serializer/roundtrip?codec=json|msgpack` accepts a JSON body (the payload), validates `codec` via Zod (`z.enum(['json','msgpack'])`, default `json`), `set`s it under a demo prefix (e.g. `serializer:demo`), then returns `{ codec, raw, decoded, rawBytes, rawBypass }` where `raw` is `getRaw(...)`, `decoded` is `get(...)`, `rawBytes` is `Buffer.byteLength(raw)` (or `0` when `raw` is `null`), and `rawBypass` is the value read back after a `setRaw` write (matrix #14's write half).
- [x] `getRaw(prefix, id)` and `get<T>(prefix, id)` are both called against the **same** stored key so the response shows the raw string vs the decoded value for one write.
- [x] **`setRaw` is exercised** (matrix #14 write half): the lab `setRaw`s a pre-encoded string and reads it back with `getRaw`, proving the active codec is bypassed on **both** write and read (not just read).
- [x] `GET /serializer/active` returns `{ serializer: string }` — the active codec name read from the **injected** `BYMAX_CACHE_SERIALIZER` token (e.g. `'JsonSerializer'` or `'MsgPackSerializer'` via `serializer.constructor.name`).
- [x] The injected serializer is obtained with `@Inject(BYMAX_CACHE_SERIALIZER)` typed as `ISerializer` (token + type imported from `@bymax-one/nest-cache`).
- [x] Both controller methods carry JSDoc (English); no Swagger decorators anywhere.

### Files to create / modify

- `apps/api/src/serializer-demo/serializer-demo.module.ts` — feature module.
- `apps/api/src/serializer-demo/serializer-demo.controller.ts` — thin controller (`/serializer/roundtrip`, `/serializer/active`).
- `apps/api/src/serializer-demo/serializer-demo.service.ts` — store + dual read-back, inject `CacheService` + `BYMAX_CACHE_SERIALIZER`.
- `apps/api/src/serializer-demo/dto/roundtrip.dto.ts` — Zod schema for the `codec` query + payload body.
- `apps/api/src/app.module.ts` — register `SerializerDemoModule`.

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer building a thin demonstration module.
> Context: Task P7-3 of `docs/DEVELOPMENT_PLAN.md` §Phase 7. Backs the Serializer Lab — `docs/DASHBOARD.md` §12 and §16 (`POST /serializer/roundtrip`), and `docs/TECHNICAL_SPECIFICATION.md` §11 (REST table: `POST /serializer/roundtrip?codec=json|msgpack` → `setRaw`/`getRaw` + `get`/`set`), §16.3, §4.1 (`getRaw`/`setRaw` signatures + `BYMAX_CACHE_SERIALIZER` token). `CacheService`, the `ZodValidationPipe`, and the `CacheExceptionFilter` are wired from Phases 3–4. P7-2 made the codec env-selectable.
> Objective: Expose `POST /serializer/roundtrip` (raw vs decoded) and `GET /serializer/active` (which codec is injected).
> Steps:
>
> 1. Scaffold `apps/api/src/serializer-demo/` with `serializer-demo.module.ts` / `.controller.ts` / `.service.ts` and `dto/roundtrip.dto.ts`. Register `SerializerDemoModule` in `app.module.ts`.
> 2. DTO: `export const roundtripQuerySchema = z.object({ codec: z.enum(['json', 'msgpack']).default('json') })` and a body schema that accepts an arbitrary JSON object (the payload). Parse via the shared `ZodValidationPipe`.
> 3. Service — inject `CacheService` and the active serializer:
>
>    ```ts
>    import { Inject, Injectable } from '@nestjs/common'
>    import { BYMAX_CACHE_SERIALIZER, CacheService, type ISerializer } from '@bymax-one/nest-cache'
>
>    @Injectable()
>    export class SerializerDemoService {
>      constructor(
>        private readonly cache: CacheService,
>        @Inject(BYMAX_CACHE_SERIALIZER) private readonly serializer: ISerializer,
>      ) {}
>
>      /** Store `payload`, then read it back as the raw stored string AND the decoded value. */
>      async roundtrip(payload: unknown): Promise<{
>        raw: string | null
>        decoded: unknown
>        rawBytes: number
>        rawBypass: string | null
>      }> {
>        await this.cache.set('serializer:demo', 'last', payload)
>        const raw = await this.cache.getRaw('serializer:demo', 'last')
>        const decoded = await this.cache.get('serializer:demo', 'last')
>        // matrix #14 (write half): setRaw stores the string verbatim (codec bypassed IN),
>        // getRaw reads it back verbatim (codec bypassed OUT).
>        await this.cache.setRaw('serializer:demo', 'raw', raw ?? '')
>        const rawBypass = await this.cache.getRaw('serializer:demo', 'raw')
>        return { raw, decoded, rawBytes: raw === null ? 0 : Buffer.byteLength(raw), rawBypass }
>      }
>
>      /** The active codec name, read from the injected BYMAX_CACHE_SERIALIZER token. */
>      activeSerializer(): string {
>        return this.serializer.constructor.name
>      }
>    }
>    ```
>
> 4. Controller: `POST /serializer/roundtrip` (validates `codec`, calls `roundtrip`, returns `{ codec, raw, decoded, rawBytes, rawBypass }`) and `GET /serializer/active` (returns `{ serializer: this.service.activeSerializer() }`). JSDoc each method.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions (thin controllers, logic in the service, JSDoc on public methods, English-only, Zod DTOs — NO Swagger).
> - The codec reflected by the response is whatever the **module was registered with** (P7-2 / env); the `?codec=` query is the lab's label for the active run — do NOT construct a serializer per-request inside this module (it must read the real injected one via `BYMAX_CACHE_SERIALIZER`).
> - Use `getRaw` for the raw string and `get` for the decoded value against the **same** key — that contrast is the whole point. `getRaw`/`setRaw` bypass the serializer; `get`/`set` apply it (spec §4.1).
> - Let `CacheException` propagate (the global filter formats it) — do NOT try/catch-and-swallow in the controller.
>   Verification:
> - `pnpm --filter @nest-cache-example/api typecheck && pnpm --filter @nest-cache-example/api lint` — expected: exit 0.
> - With the API up on `json`: `curl -s -X POST 'http://localhost:3001/serializer/roundtrip?codec=json' -H 'content-type: application/json' -d '{"id":42,"tags":["a","b"]}'` — expected: `raw` is the JSON string `{"id":42,"tags":["a","b"]}`, `decoded` equals the object.
> - `curl -s http://localhost:3001/serializer/active` — expected: `{"serializer":"JsonSerializer"}` on default; `{"serializer":"MsgPackSerializer"}` when booted with `CACHE_SERIALIZER=msgpack` (then `raw` is a base64 blob and `rawBytes` is smaller than the JSON form).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P7-3 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P7-4 — `SerializableValue` Caveat Payload (`Date`) + Phase Verification

- **Status:** 🟢 Done
- **Priority:** Medium
- **Size:** S (30–90 min)
- **Depends on:** `P7-1`, `P7-2`, `P7-3`

### Description

Teach the `SerializableValue` caveat and close the phase. JSON does not preserve a `Date` — it round-trips **lossily**, becoming an ISO **string** — whereas MessagePack preserves it intact (spec §16.1 caveat box; DASHBOARD §12 "⚠ Date became an ISO string"). This task adds a dedicated, well-known caveat payload containing a `Date` and an endpoint that round-trips it so the lossy-vs-intact difference is demonstrable, and documents the honest typing: `SerializableValue` (exported from `@bymax-one/nest-cache/shared`) is the type the library's `get`/`set` are designed for, and it deliberately **excludes** `Date`, `Map`, `Set`, `BigInt`, and `undefined` — i.e. the caveat payload is intentionally _outside_ `SerializableValue`, which is exactly why it round-trips lossily under the default codec. Then run the Phase 7 "definition of done" gate: typecheck/lint/build green, both codecs exercised, and the matrix rows demonstrated. Demonstrates matrix row #39 (`SerializableValue` + the `Date`/`Map`/`Set` caveat).

### Acceptance Criteria

- [x] A caveat fixture exists (e.g. `apps/api/src/serializer-demo/serializer-demo.fixtures.ts`) exporting a payload that includes a `Date` (e.g. `{ id: 42, when: new Date('2026-06-01T00:00:00.000Z'), tags: ['a', 'b'] }`).
- [x] `POST /serializer/caveat?codec=json|msgpack` (or a `caveat` branch of the service) stores the fixture and returns the raw + decoded forms plus a `dateSurvived: boolean` flag (`decoded.when instanceof Date`).
- [x] Under `json`, the response shows `when` decoded as an ISO **string** and `dateSurvived: false`; the response body carries a human-readable note (e.g. `'JSON does not preserve Date — it became an ISO string'`).
- [x] Under `msgpack`, the response shows `when` decoded as a `Date` and `dateSurvived: true`.
- [x] `SerializableValue` is imported (type-only) from `@bymax-one/nest-cache/shared` somewhere in the module (e.g. typing the non-caveat payloads) and a JSDoc/comment records that it excludes `Date`/`Map`/`Set`/`BigInt`/`undefined`.
- [x] Phase gate green: `pnpm --filter @nest-cache-example/api typecheck`, `lint`, and `build` all exit 0; matrix rows #11, #14, #37, #38, #39 are demonstrated by the endpoints from P7-3 + P7-4.

### Files to create / modify

- `apps/api/src/serializer-demo/serializer-demo.fixtures.ts` — the caveat payload (with a `Date`).
- `apps/api/src/serializer-demo/serializer-demo.service.ts` — add the `caveat` round-trip + `dateSurvived` flag.
- `apps/api/src/serializer-demo/serializer-demo.controller.ts` — add the `POST /serializer/caveat` route.
- _(verification only for the phase gate — fix earlier P7 task files if a check fails.)_

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer + technical writer closing a phase.
> Context: Task P7-4 of `docs/DEVELOPMENT_PLAN.md` §Phase 7. The caveat is specified in `docs/TECHNICAL_SPECIFICATION.md` §16.1 (the `SerializableValue` caveats box — JSON drops `Date`/`Map`/`Set`/`BigInt`/`undefined`) and §4.2 (`SerializableValue` exported from the `./shared` subpath); shown in `docs/DASHBOARD.md` §12 ("⚠ Date became an ISO string"). The roundtrip module exists from P7-3; both codecs are selectable from P7-2.
> Objective: Add a `Date`-bearing caveat payload + endpoint, then run the Phase 7 DoD gate.
> Steps:
>
> 1. Create `apps/api/src/serializer-demo/serializer-demo.fixtures.ts` exporting the caveat payload, e.g.:
>    ```ts
>    /** A payload that round-trips LOSSILY under JSON (Date → ISO string) and intact under MessagePack. */
>    export const caveatPayload = {
>      id: 42,
>      when: new Date('2026-06-01T00:00:00.000Z'),
>      tags: ['a', 'b'],
>    }
>    ```
> 2. In the service, add a `caveat()` method that stores `caveatPayload`, reads it back via `getRaw` + `get`, and computes `dateSurvived: (decoded as { when?: unknown }).when instanceof Date`; include a note string keyed off the active codec.
> 3. In the controller, add `POST /serializer/caveat?codec=json|msgpack` (validate `codec` with the same Zod enum) returning `{ codec, raw, decoded, dateSurvived, note }`.
> 4. Add a type-only `import type { SerializableValue } from '@bymax-one/nest-cache/shared'` and a one-line comment recording that it excludes `Date`/`Map`/`Set`/`BigInt`/`undefined` (so the reader sees the caveat payload is intentionally outside `SerializableValue`).
> 5. Run the Phase 7 gate (below). If any check fails, fix it in the corresponding P7 task file (P7-1..P7-3), then return here. Confirm matrix rows #11, #14, #37, #38, #39 are each reachable through `GET /serializer/active`, `POST /serializer/roundtrip`, and `POST /serializer/caveat`.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions (English-only, JSDoc, Zod DTOs, no Swagger, no `@ts-ignore`/`eslint-disable`).
> - Do NOT "fix" the JSON `Date` behaviour — the lossy round-trip is the lesson; surface it honestly via `dateSurvived: false` + the note.
> - `SerializableValue` MUST come from the `@bymax-one/nest-cache/shared` subpath (the zero-dependency, browser-safe entry), NOT the server subpath (spec §4.2).
> - Do NOT lower any threshold or skip the gate to make it green.
>   Verification:
> - `pnpm --filter @nest-cache-example/api typecheck` — expected: exit 0.
> - `pnpm --filter @nest-cache-example/api lint` — expected: exit 0.
> - `pnpm --filter @nest-cache-example/api build` — expected: exit 0.
> - API on default (`json`): `curl -s -X POST 'http://localhost:3001/serializer/caveat?codec=json'` — expected: `decoded.when` is an ISO string, `dateSurvived:false`, note mentions Date→ISO string.
> - API booted with `CACHE_SERIALIZER=msgpack`: `curl -s -X POST 'http://localhost:3001/serializer/caveat?codec=msgpack'` — expected: `dateSurvived:true` (Date preserved).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P7-4 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

When this task is 🟢, Phase 7 is 4/4 — switch the Phase 7 row in `DEVELOPMENT_PLAN.md` Progress Summary to 🟢 Done.

⚠️ Never mark done with failing verification.

---

## Completion log

_(Agents append one line per finished task, newest at the bottom.)_

- P7-1 ✅ 2026-06-16 — MsgPackSerializer (base64-wrapped MessagePack codec) created; @msgpack/msgpack added to api deps
- P7-2 ✅ 2026-06-16 — CACHE_SERIALIZER env var wired into buildCacheOptions; json → undefined → library default; msgpack → MsgPackSerializer
- P7-3 ✅ 2026-06-16 — serializer-demo module built with POST /serializer/roundtrip and GET /serializer/active; getRaw/setRaw bypass demonstrated
- P7-4 ✅ 2026-06-16 — caveat fixture + POST /serializer/caveat added; dateSurvived flag shows JSON Date→ISO lossy vs MessagePack intact; phase gate green
