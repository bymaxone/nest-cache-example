# Phase 8 — Pub/Sub + WebSocket Bridge — Tasks

> **Source:** [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#phase-8--pubsub--websocket-bridge) §Phase 8
> **Total tasks:** 6
> **Progress:** 🔴 0 / 6 done (0%)
>
> **Status legend:** 🔴 Not Started · 🟡 In Progress · 🔵 In Review · 🟢 Done · ⚪ Blocked

## Task index

| ID   | Task                                                                  | Status | Priority | Size | Depends on       |
| ---- | --------------------------------------------------------------------- | ------ | -------- | ---- | ---------------- |
| P8-1 | `src/pubsub/` module + `POST /pubsub/publish` (`publish`, sub count)  | 🔴     | High     | M    | Phase 3          |
| P8-2 | `EventsGateway` server-side `subscribe` → re-emit `cache:event`       | 🔴     | High     | M    | P8-1             |
| P8-3 | Pattern subscription via `psubscribe` (`product:*`) wired to gateway  | 🔴     | Medium   | S    | P8-2             |
| P8-4 | Subscription management endpoints (ref-counted `Unsubscribe`)         | 🔴     | Medium   | M    | P8-2             |
| P8-5 | Handler-error isolation (swallowed + `reason: 'handler_error'`)       | 🔴     | Medium   | S    | P8-2             |
| P8-6 | Phase verification (two-tab fan-out · pattern match · namespacing)    | 🔴     | Medium   | S    | P8-1..P8-5       |

---

## P8-1 — `src/pubsub/` module + `POST /pubsub/publish` (`PubSubService.publish`, returns subscriber count)

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** M (90 min–½ day)
- **Depends on:** `Phase 3`

### Description

The publish entry point for the `/pubsub` page (DASHBOARD §9). Scaffold a `src/pubsub/` feature module (`PubSubModule` + `PubSubController` + a thin `PubSubBridgeService`) and expose `POST /pubsub/publish`, which calls the library's `PubSubService.publish<T>(channel, message)` and returns the **subscriber count** the library reports. `PubSubService` is provided by the global `BymaxCacheModule` wired in Phase 3 (P3-6), so it is injected directly — no re-provisioning. The headline teaching point baked into a route-level comment: **the library namespaces the channel** — `publish('product-events', …)` actually hits `cache-example:product-events` — so both publisher and subscriber match transparently without the caller ever spelling the namespace (spec §17.1). The request body is Zod-validated (no Swagger): a `channel` string and an arbitrary JSON `message`. This task only ships the publish half; the server-side subscribe + gateway re-emit lands in P8-2.

### Acceptance Criteria

- [ ] `src/pubsub/pubsub.module.ts` exports a `PubSubModule` imported by `app.module.ts`; it does **not** re-provide the library `PubSubService` (it is global from P3-6).
- [ ] `src/pubsub/pubsub.controller.ts` exposes `@Controller('pubsub')` with `@Post('publish')`.
- [ ] The body is validated through a `publishSchema` Zod DTO (`{ channel: string (non-empty), message: unknown }`) via `ZodValidationPipe`; co-located under `src/pubsub/dto/`.
- [ ] The handler calls `PubSubService.publish(channel, message)` and returns `{ channel, subscribers: <number> }` (the library's returned subscriber count, unmodified).
- [ ] An inline comment states the channel is **namespaced by the library** (`product-events` → `cache-example:product-events`, spec §17.1) — the route never prepends the namespace by hand.
- [ ] JSDoc on the controller class + method and the exported schema; **no Swagger** anywhere in the module.
- [ ] `apps/api` `typecheck` + `lint` are clean.

### Files to create / modify

- `apps/api/src/pubsub/pubsub.module.ts` — `PubSubModule`.
- `apps/api/src/pubsub/pubsub.controller.ts` — `@Controller('pubsub')`, `@Post('publish')`.
- `apps/api/src/pubsub/pubsub.bridge.service.ts` — thin service holding the server-side subscriptions (skeleton here; populated in P8-2..P8-5).
- `apps/api/src/pubsub/dto/publish.dto.ts` — `publishSchema` + `PublishDto` type.
- `apps/api/src/app.module.ts` — register `PubSubModule`.

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer.
> PROJECT: `nest-cache-example`, the reference app for `@bymax-one/nest-cache` (a typed Redis cache for NestJS). This is task **P8-1** of Phase 8. See `docs/TECHNICAL_SPECIFICATION.md` §17.1 (`PubSubService.publish` → serialized, namespaced, returns subscriber count), §4 (library API inventory: `PubSubService.publish<T>` · `subscribe<T>` · `psubscribe<T>`), `docs/DASHBOARD.md` §9 (the Publish card → `POST /pubsub/publish` shows the returned subscriber count), and `docs/DEVELOPMENT_PLAN.md` §Phase 8 + §2 Global Conventions.
> PRECONDITIONS: Phase 3 done — the app boots, `BymaxCacheModule.forRootAsync({ isGlobal: true, … })` is wired (P3-6) so `PubSubService` is injectable app-wide, and the global `CacheExceptionFilter` + `ZodValidationPipe` exist (P3-3/P3-7).
> REQUIRED READING (read before coding): spec §17.1–§17.2; DASHBOARD §9; the `PubSubService` row of spec §4.
> TASK: Build the `src/pubsub/` module and the `POST /pubsub/publish` endpoint backed by the library's `PubSubService.publish`, returning the subscriber count.
> DELIVERABLES (exact API facts to bake in):
>
> 1. `src/pubsub/dto/publish.dto.ts`:
>
>    ```ts
>    import { z } from 'zod'
>
>    /** Body for POST /pubsub/publish — an app channel + an arbitrary JSON message. */
>    export const publishSchema = z.object({
>      channel: z.string().min(1),
>      message: z.unknown(),
>    })
>
>    /** Inferred publish-request type. */
>    export type PublishDto = z.infer<typeof publishSchema>
>    ```
>
> 2. `src/pubsub/pubsub.bridge.service.ts` — an `@Injectable()` `PubSubBridgeService` that injects the library `PubSubService` (`import { PubSubService } from '@bymax-one/nest-cache'`). For P8-1 it only forwards publishes; the subscription state (a `Map<string, { unsubscribe: Unsubscribe; refs: number }>`) and the gateway wiring are added in P8-2..P8-5 — leave a clearly-marked TODO referencing those tasks.
>
>    ```ts
>    /** Publish a message to a (library-namespaced) channel; returns the subscriber count. */
>    async publish<T>(channel: string, message: T): Promise<number> {
>      // The library namespaces the channel: 'product-events' → 'cache-example:product-events'
>      // (spec §17.1). We pass the bare channel; the namespace is applied transparently.
>      return this.pubsub.publish<T>(channel, message)
>    }
>    ```
>
>    The exact library signature (spec §4 / §17.1): `publish<T>(channel: string, message: T): Promise<number>` — the returned number is the subscriber count.
> 3. `src/pubsub/pubsub.controller.ts` — `@Controller('pubsub')`, thin: `@Post('publish')` `publish(@Body(new ZodValidationPipe(publishSchema)) body: PublishDto)` → `const subscribers = await this.bridge.publish(body.channel, body.message); return { channel: body.channel, subscribers }`. JSDoc the class + method (note the channel is namespaced by the library).
> 4. `src/pubsub/pubsub.module.ts` — `@Module({ controllers: [PubSubController], providers: [PubSubBridgeService], exports: [PubSubBridgeService] })`. Do NOT add `PubSubService` to `providers` — it is global from `BymaxCacheModule` (P3-6). Import `EventsModule` here too (it exports `EventsGateway`) so P8-2 can inject the gateway with no further edits.
> 5. Register `PubSubModule` in `src/app.module.ts` `imports`.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions (ESM, strict TS, English-only).
> - **No Swagger** (validation is Zod, docs are JSDoc — spec §23.4).
> - Do NOT prepend the namespace by hand — let the library namespace the channel (spec §17.1).
> - Do NOT re-provide `PubSubService`; inject the global instance.
> - Controllers stay thin; the `PubSubService` call lives in `PubSubBridgeService`.
>   Verification:
> - `pnpm --filter @nest-cache-example/api typecheck` — expected: exit 0.
> - `pnpm --filter @nest-cache-example/api lint` — expected: exit 0.
> - With Redis up + `pnpm --filter @nest-cache-example/api dev`: `curl -X POST http://localhost:3001/pubsub/publish -H 'content-type: application/json' -d '{"channel":"product-events","message":{"type":"price","id":"42"}}'` — expected: `200` with `{ "channel": "product-events", "subscribers": <number> }` (0 until P8-2 subscribes server-side).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P8-1 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P8-2 — `EventsGateway` subscribes server-side via `PubSubService.subscribe` and re-emits `cache:event`

- **Status:** 🔴 Not Started
- **Priority:** High
- **Size:** M (90 min–½ day)
- **Depends on:** `P8-1`

### Description

The fan-out core (spec §17.2, DASHBOARD §18). The server subscribes **once** to a demo channel via `PubSubService.subscribe<T>(channel, handler)` and, inside the handler, calls `EventsGateway.emitMessage(channel, payload)` — which re-emits `cache:event` to every connected browser (the `emitMessage` skeleton already exists from P3-5). The result: a `POST /pubsub/publish` from one tab arrives as a `cache:event` socket message in *all* open tabs. The handler is typed as the library's `IPubSubHandler<T> = (message: T, channel: string) => void | Promise<void>` (matrix #33). Bootstrap the default `product-events` subscription on module init so the demo works out of the box; the returned `Unsubscribe` is stored for P8-4's lifecycle management and torn down on `onModuleDestroy`.

### Acceptance Criteria

- [ ] `PubSubBridgeService` injects `EventsGateway` (exported by `EventsModule`, imported in P8-1) and the library `PubSubService`.
- [ ] On `OnModuleInit`, it calls `PubSubService.subscribe<unknown>('product-events', handler)` where `handler: IPubSubHandler<unknown>` re-emits via `this.gateway.emitMessage(channel, message)`.
- [ ] The handler signature is exactly `(message, channel) => void | Promise<void>` (the library's `IPubSubHandler<T>`), imported from `@bymax-one/nest-cache`.
- [ ] The returned `Unsubscribe` is stored (keyed by channel) for P8-4 and invoked on `OnModuleDestroy`.
- [ ] After this task, `POST /pubsub/publish` to `product-events` reports `subscribers: 1` (the server is now a subscriber) and emits one `cache:event` per publish.
- [ ] JSDoc on the new members; no Swagger; `typecheck` + `lint` clean.

### Files to create / modify

- `apps/api/src/pubsub/pubsub.bridge.service.ts` — add the `OnModuleInit`/`OnModuleDestroy` subscribe lifecycle + gateway re-emit.

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer.
> PROJECT: `nest-cache-example`, the reference app for `@bymax-one/nest-cache`. This is task **P8-2** of Phase 8. See `docs/TECHNICAL_SPECIFICATION.md` §17.2 (`EventsGateway` subscribes once server-side via `PubSubService` and re-emits `cache:event` to all browsers), §4 (`IPubSubHandler<T>`, `Unsubscribe`), `docs/DASHBOARD.md` §18 (the WS bridge — `emitMessage(channel, payload)` → `server.emit('cache:event', …)`), §9 (the live feed), and `docs/DEVELOPMENT_PLAN.md` §Phase 8.
> PRECONDITIONS: P8-1 done (`PubSubModule` + `POST /pubsub/publish`); P3-5 done (`EventsGateway.emitMessage(channel, payload)` → `cache:event`, exported by `EventsModule`).
> REQUIRED READING: spec §17.1–§17.2; DASHBOARD §18 (the `emitMessage` snippet) + §9; the `IPubSubHandler<T>` / `Unsubscribe` rows of spec §4.
> TASK: Make `PubSubBridgeService` subscribe once to `product-events` via the library and re-emit each message as `cache:event` through `EventsGateway`.
> DELIVERABLES (exact API facts to bake in):
>
> 1. Imports: `import { PubSubService, type IPubSubHandler, type Unsubscribe } from '@bymax-one/nest-cache'` and `import { EventsGateway } from '../events/events.gateway'`.
> 2. Hold subscription state: `private readonly subs = new Map<string, { unsubscribe: Unsubscribe; refs: number }>()` (refs are used by P8-4; for the bootstrap subscription start `refs: 1`).
> 3. Add a private helper that subscribes and wires the gateway re-emit:
>
>    ```ts
>    // The library's IPubSubHandler<T> = (message: T, channel: string) => void | Promise<void>.
>    private readonly forward: IPubSubHandler<unknown> = (message, channel) => {
>      // De-namespaced channel is provided by the library; re-broadcast to every tab.
>      this.gateway.emitMessage(channel, message)
>    }
>    ```
>
>    The exact library signatures (spec §4 / §17.1): `subscribe<T>(channel: string, handler: IPubSubHandler<T>): Promise<Unsubscribe>`; `Unsubscribe = () => Promise<void>`.
> 4. `async onModuleInit()`: subscribe to the default demo channel — `const unsubscribe = await this.pubsub.subscribe<unknown>('product-events', this.forward); this.subs.set('product-events', { unsubscribe, refs: 1 })`. JSDoc that the gateway then fans every message out to all tabs (spec §17.2).
> 5. `async onModuleDestroy()`: iterate `this.subs.values()` and `await s.unsubscribe()`; clear the map. (Idempotent — see P8-5/§17.1.)
> 6. Implement `OnModuleInit, OnModuleDestroy` on the class.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - The handler MUST be typed `IPubSubHandler<unknown>` (matrix #33) — NO `any`, NO custom inline signature.
> - Re-emit ONLY through `EventsGateway.emitMessage` (channel `cache:event`); do NOT add a new socket channel.
> - Do NOT block the handler — `emitMessage` is fire-and-forget (the feed is server→client; the browser publishes via REST, spec §18).
> - Keep the subscription single (subscribe once on init) — the ref-counted lifecycle for *user* subscriptions lands in P8-4.
>   Verification:
> - `pnpm --filter @nest-cache-example/api typecheck` — expected: exit 0.
> - `pnpm --filter @nest-cache-example/api lint` — expected: exit 0.
> - With Redis up + the API running: `curl -X POST http://localhost:3001/pubsub/publish -H 'content-type: application/json' -d '{"channel":"product-events","message":{"hi":1}}'` — expected: `{ "subscribers": 1 }` (server is now subscribed). With a `socket.io-client` listener attached, exactly one `cache:event` `{ channel, payload, … }` is received per publish.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P8-2 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P8-3 — Pattern subscription via `psubscribe` (`product:*`, `IPubSubPatternHandler`) wired to the gateway

- **Status:** 🔴 Not Started
- **Priority:** Medium
- **Size:** S (30–90 min)
- **Depends on:** `P8-2`

### Description

The pattern half of the demo (DASHBOARD §9, matrix #31). In addition to the exact-channel `subscribe`, the server registers a **pattern** subscription via `PubSubService.psubscribe<T>(pattern, handler)` with a glob like `product:*`. The handler is typed as the library's `IPubSubPatternHandler<T> = (message: T, channel: string, pattern: string) => void | Promise<void>` — note the **third `pattern` argument** that distinguishes it from `IPubSubHandler`. Each matched message is re-emitted through `EventsGateway.emitMessage`, so publishing to e.g. `product:42` shows up in the live feed tagged as a pattern match. Patterns are **namespaced by the library** exactly like exact channels (`product:*` → `cache-example:product:*`, spec §17.1).

### Acceptance Criteria

- [ ] `PubSubBridgeService` registers a default `psubscribe<unknown>('product:*', patternHandler)` on `OnModuleInit` (alongside the P8-2 exact subscription).
- [ ] The handler is typed exactly `IPubSubPatternHandler<unknown>` — `(message, channel, pattern) => void | Promise<void>` — imported from `@bymax-one/nest-cache`; it re-emits via `this.gateway.emitMessage(channel, message)`.
- [ ] The returned `Unsubscribe` is stored (keyed by the pattern) and torn down on `OnModuleDestroy` (same lifecycle path as P8-2).
- [ ] An inline comment notes the pattern is namespaced by the library (`product:*` → `cache-example:product:*`, spec §17.1).
- [ ] Publishing to `product:42` (e.g. via `POST /pubsub/publish`) emits a `cache:event` for the matched channel.
- [ ] JSDoc on the new member; no Swagger; `typecheck` + `lint` clean.

### Files to create / modify

- `apps/api/src/pubsub/pubsub.bridge.service.ts` — add the `psubscribe` pattern subscription + handler.

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer.
> PROJECT: `nest-cache-example`, the reference app for `@bymax-one/nest-cache`. This is task **P8-3** of Phase 8. See `docs/TECHNICAL_SPECIFICATION.md` §17.1 (`psubscribe<T>(pattern, handler)` → pattern subscription, `IPubSubPatternHandler`), §4 (`IPubSubPatternHandler<T>`), `docs/DASHBOARD.md` §9 (the `product:*` pattern toggle; pattern-matched messages show the matching pattern in the feed), and `docs/DEVELOPMENT_PLAN.md` §Phase 8 (matrix #31).
> PRECONDITIONS: P8-2 done (`PubSubBridgeService` already subscribes to `product-events` and re-emits via `EventsGateway`; the `subs` map + `onModuleDestroy` teardown exist).
> REQUIRED READING: spec §17.1; the `IPubSubPatternHandler<T>` row of spec §4; DASHBOARD §9 (pattern match in the feed).
> TASK: Add a `psubscribe('product:*', …)` pattern subscription that re-emits matched messages through the gateway.
> DELIVERABLES (exact API facts to bake in):
>
> 1. Import the pattern-handler type: `import { type IPubSubPatternHandler } from '@bymax-one/nest-cache'` (alongside the P8-2 imports).
> 2. Define the pattern handler — note the **third `pattern` arg**:
>
>    ```ts
>    // IPubSubPatternHandler<T> = (message: T, channel: string, pattern: string) => void | Promise<void>.
>    // The matched concrete channel (e.g. 'product:42') is forwarded; `pattern` (e.g. 'product:*') is
>    // available for UI tagging. The pattern is namespaced by the library (spec §17.1).
>    private readonly forwardPattern: IPubSubPatternHandler<unknown> = (message, channel) => {
>      this.gateway.emitMessage(channel, message)
>    }
>    ```
>
>    The exact library signature (spec §4 / §17.1): `psubscribe<T>(pattern: string, handler: IPubSubPatternHandler<T>): Promise<Unsubscribe>`.
> 3. In `onModuleInit`, after the exact subscription: `const punsub = await this.pubsub.psubscribe<unknown>('product:*', this.forwardPattern); this.subs.set('product:*', { unsubscribe: punsub, refs: 1 })`. The existing `onModuleDestroy` loop already tears it down.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - The handler MUST be `IPubSubPatternHandler<unknown>` (matrix #31) — the **three-arg** form; do NOT reuse `IPubSubHandler`.
> - Do NOT prepend the namespace to the pattern — the library does it (`product:*` → `cache-example:product:*`).
> - Re-emit through `EventsGateway.emitMessage` only (channel `cache:event`).
>   Verification:
> - `pnpm --filter @nest-cache-example/api typecheck` — expected: exit 0.
> - `pnpm --filter @nest-cache-example/api lint` — expected: exit 0.
> - With Redis up + a `socket.io-client` listener: `curl -X POST http://localhost:3001/pubsub/publish -H 'content-type: application/json' -d '{"channel":"product:42","message":{"type":"view","id":"42"}}'` — expected: a `cache:event` with `channel` `"product:42"` is received (the `product:*` pattern matched).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P8-3 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P8-4 — Subscription management endpoints (`POST`/`DELETE /pubsub/subscribe`) demonstrating ref-counted `Unsubscribe`

- **Status:** 🔴 Not Started
- **Priority:** Medium
- **Size:** M (90 min–½ day)
- **Depends on:** `P8-2`

### Description

The lifecycle demo (spec §17.2, DASHBOARD §9; matrix #32). Expose `POST /pubsub/subscribe` and `DELETE /pubsub/subscribe` so the `/pubsub` page can add/remove subscriptions at runtime and watch the library's **ref-counted `Unsubscribe`** in action. `Unsubscribe = () => Promise<void>` is idempotent and ref-counted: subscribing to the same channel twice and unsubscribing once **keeps delivery alive**; the underlying Redis `UNSUBSCRIBE` only fires on the **last** listener; calling an `Unsubscribe` twice is safe. The `subs` map (from P8-2) tracks a per-channel ref count and the stored `Unsubscribe`; `POST` either creates a new library subscription (`subscribe` or `psubscribe` depending on a `pattern` flag) or increments the ref count if one exists; `DELETE` decrements and invokes `Unsubscribe` only when the count reaches zero — surfacing the same ref-counting the library performs internally. The endpoint returns the current ref count so the UI can render `refs: product-events ×2`.

### Acceptance Criteria

- [ ] `POST /pubsub/subscribe` accepts `{ channel: string, pattern?: boolean }` (Zod-validated); if a subscription for that key exists it **increments** the ref count, else it creates one via `subscribe` (exact) or `psubscribe` (when `pattern` is true) and stores `{ unsubscribe, refs: 1 }`.
- [ ] `DELETE /pubsub/subscribe` accepts the same body; it **decrements** the ref count and calls the stored `Unsubscribe` **only when the count hits 0**, then removes the map entry.
- [ ] Both endpoints return `{ channel, refs: <number>, pattern: boolean }`.
- [ ] Double-unsubscribe is safe: a `DELETE` on an already-removed (or never-created) channel is a no-op `200`/`204` (returns `refs: 0`) — never throws.
- [ ] Behaviour proven: subscribe ×2 then unsubscribe ×1 leaves `refs: 1` and delivery still works; the second unsubscribe drops to `refs: 0` and stops delivery.
- [ ] Re-uses the `subs` map + handlers from P8-2/P8-3 (no second source of truth); JSDoc; no Swagger; `typecheck` + `lint` clean.

### Files to create / modify

- `apps/api/src/pubsub/pubsub.controller.ts` — add `@Post('subscribe')` + `@Delete('subscribe')`.
- `apps/api/src/pubsub/pubsub.bridge.service.ts` — add `addSubscription` / `removeSubscription` ref-count logic.
- `apps/api/src/pubsub/dto/subscribe.dto.ts` — `subscribeSchema` + `SubscribeDto` type.

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer.
> PROJECT: `nest-cache-example`, the reference app for `@bymax-one/nest-cache`. This is task **P8-4** of Phase 8. See `docs/TECHNICAL_SPECIFICATION.md` §17.1–§17.2 (the ref-counted `Unsubscribe`: subscribe×2 + unsubscribe×1 keeps delivery alive; double-unsubscribe safe; `UNSUBSCRIBE` only on the last listener), §4 (`Unsubscribe = () => Promise<void>`), `docs/DASHBOARD.md` §9 (the Subscriptions card shows the per-channel ref count: `refs: product-events ×2 → unsub×1`), and `docs/DEVELOPMENT_PLAN.md` §Phase 8 (matrix #32).
> PRECONDITIONS: P8-2 done (the `subs: Map<string, { unsubscribe; refs }>` + `forward` handler exist); P8-3 done (the `forwardPattern` handler exists). Reuse both — do NOT recreate handlers.
> REQUIRED READING: spec §17.1–§17.2; the `Unsubscribe` row of spec §4; DASHBOARD §9 (ref-count display).
> TASK: Add `POST`/`DELETE /pubsub/subscribe` that drive a per-channel ref count over the shared `subs` map, demonstrating the library's ref-counted, idempotent `Unsubscribe`.
> DELIVERABLES (exact API facts to bake in):
>
> 1. `src/pubsub/dto/subscribe.dto.ts`:
>
>    ```ts
>    import { z } from 'zod'
>
>    /** Body for POST/DELETE /pubsub/subscribe. */
>    export const subscribeSchema = z.object({
>      channel: z.string().min(1),
>      pattern: z.boolean().default(false), // true → psubscribe (e.g. 'product:*')
>    })
>
>    /** Inferred subscribe-request type. */
>    export type SubscribeDto = z.infer<typeof subscribeSchema>
>    ```
>
> 2. `PubSubBridgeService.addSubscription(channel, pattern)`:
>
>    ```ts
>    const existing = this.subs.get(channel)
>    if (existing) {
>      existing.refs += 1 // ref-counted: a 2nd subscribe does NOT open a 2nd Redis subscription
>      return existing.refs
>    }
>    const unsubscribe = pattern
>      ? await this.pubsub.psubscribe<unknown>(channel, this.forwardPattern)
>      : await this.pubsub.subscribe<unknown>(channel, this.forward)
>    this.subs.set(channel, { unsubscribe, refs: 1 })
>    return 1
>    ```
>
> 3. `PubSubBridgeService.removeSubscription(channel)`:
>
>    ```ts
>    const existing = this.subs.get(channel)
>    if (!existing) return 0 // double-unsubscribe / unknown channel is safe (idempotent)
>    existing.refs -= 1
>    if (existing.refs > 0) return existing.refs // still other listeners → keep delivery alive
>    await existing.unsubscribe() // last listener → library fires Redis UNSUBSCRIBE
>    this.subs.delete(channel)
>    return 0
>    ```
>
>    The exact library contract (spec §17.1–§17.2): `Unsubscribe` is **idempotent + ref-counted** — `UNSUBSCRIBE` only fires on the last listener; calling it twice is safe.
> 4. `pubsub.controller.ts`: `@Post('subscribe')` `subscribe(@Body(new ZodValidationPipe(subscribeSchema)) body)` → `const refs = await this.bridge.addSubscription(body.channel, body.pattern); return { channel: body.channel, refs, pattern: body.pattern }`. `@Delete('subscribe')` mirrors it via `removeSubscription`. JSDoc both, restating the ref-count rule.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - The ref count is the *app's* mirror of the library's internal ref-counting — the point of the demo is that the two agree. Do NOT call the library `Unsubscribe` while `refs > 0`.
> - `DELETE` on an unknown channel MUST NOT throw (idempotent — return `refs: 0`).
> - Reuse the `forward` / `forwardPattern` handlers from P8-2/P8-3; **no Swagger**; thin controller.
>   Verification:
> - `pnpm --filter @nest-cache-example/api typecheck` — expected: exit 0.
> - `pnpm --filter @nest-cache-example/api lint` — expected: exit 0.
> - With Redis up + a `socket.io-client` listener on `cache:event`:
>   `curl -X POST …/pubsub/subscribe -d '{"channel":"orders"}'` (→ `refs:1`), again (→ `refs:2`); publish to `orders` → still delivered. `curl -X DELETE …/pubsub/subscribe -d '{"channel":"orders"}'` (→ `refs:1`); publish → STILL delivered (subscribe×2 − unsub×1). `DELETE` again (→ `refs:0`); publish → NOT delivered. A third `DELETE` → `refs:0`, no error (double-unsubscribe safe).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P8-4 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P8-5 — Handler-error isolation: a throwing handler is swallowed and surfaced via `events.onEvent` (`reason: 'handler_error'`)

- **Status:** 🔴 Not Started
- **Priority:** Medium
- **Size:** S (30–90 min)
- **Depends on:** `P8-2`

### Description

The resilience demo (spec §17.1; matrix #33). A throw **inside** a Pub/Sub handler is swallowed by the library — it **cannot tear down the shared subscriber** — and is instead forwarded to `events.onEvent` as an `error` event carrying `reason: 'handler_error'`. This is what keeps one buggy listener from killing delivery for every other listener on the same connection. This task proves it end to end: register a deliberately-throwing handler on a dedicated demo channel (e.g. `pubsub-error-demo`), publish to it, and confirm (a) other channels' delivery is unaffected and (b) the `CacheEventsBridge` logged/broadcast an `error` event with `reason: 'handler_error'` on `cache:connection` (the bridge from P3-4 already maps `events.onEvent` → logger + gateway). A `POST /pubsub/throw` (or a guarded flag on the demo subscription) triggers it on demand for the Error/Pub-Sub page.

### Acceptance Criteria

- [ ] A demo channel (e.g. `pubsub-error-demo`) is subscribed with a handler that **throws** on receipt.
- [ ] A `POST /pubsub/throw` endpoint publishes to that channel to trigger the throw on demand (Zod-validated body if any).
- [ ] After the throw: delivery on **other** channels (e.g. `product-events`) still works — the shared subscriber survives (the throw is swallowed).
- [ ] The thrown error surfaces via `events.onEvent` as an `error` with `reason: 'handler_error'` — observable through the `CacheEventsBridge` (logged + emitted on `cache:connection`).
- [ ] An inline comment states the library swallows handler throws to protect the shared subscriber and forwards them to `events.onEvent` with `reason: 'handler_error'` (spec §17.1).
- [ ] JSDoc; no Swagger; `typecheck` + `lint` clean.

### Files to create / modify

- `apps/api/src/pubsub/pubsub.bridge.service.ts` — register the throwing demo handler.
- `apps/api/src/pubsub/pubsub.controller.ts` — add `@Post('throw')` trigger.

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer.
> PROJECT: `nest-cache-example`, the reference app for `@bymax-one/nest-cache`. This is task **P8-5** of Phase 8. See `docs/TECHNICAL_SPECIFICATION.md` §17.1 ("A throw inside a handler is swallowed (cannot tear down the shared subscriber) and forwarded to `events.onEvent` as an `error` with `reason: 'handler_error'`"), §20.1 / matrix #45–#47 (the `events.onEvent` → logger/gateway bridge, `CacheEventsBridge` from P3-4), and `docs/DEVELOPMENT_PLAN.md` §Phase 8.
> PRECONDITIONS: P8-2 done (the subscribe lifecycle + `subs` map exist); P3-4 done (`CacheEventsBridge.onEvent` logs the `error` event and calls `EventsGateway.emitConnectionEvent` on `cache:connection`).
> REQUIRED READING: spec §17.1 (handler-error isolation) + §20.1 (the events bridge); the P3-4 task (`CacheEventsBridge`).
> TASK: Prove that a throwing Pub/Sub handler is swallowed (does not break the shared subscriber) and is surfaced via `events.onEvent` with `reason: 'handler_error'`.
> DELIVERABLES:
>
> 1. In `onModuleInit`, register a demo subscription whose handler throws:
>
>    ```ts
>    // The library SWALLOWS a handler throw — it must NOT tear down the shared subscriber —
>    // and forwards it to events.onEvent as an `error` with reason: 'handler_error' (spec §17.1).
>    const errUnsub = await this.pubsub.subscribe<unknown>('pubsub-error-demo', () => {
>      throw new Error('intentional handler failure (P8-5 demo)')
>    })
>    this.subs.set('pubsub-error-demo', { unsubscribe: errUnsub, refs: 1 })
>    ```
>
> 2. `pubsub.controller.ts`: `@Post('throw')` `triggerHandlerError()` → `await this.bridge.publish('pubsub-error-demo', { at: Date.now() }); return { triggered: true }`. JSDoc it (note delivery to other channels is unaffected).
> 3. Do NOT add a `try/catch` around the throw in the handler — the **library** is responsible for swallowing it. The test is that the app does not crash and the bridge sees the `error` event. (The `CacheEventsBridge` from P3-4 already routes `events.onEvent` `error` → `logger.error` + `emitConnectionEvent`; no change needed there.)
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - Do NOT catch the throw yourself — demonstrate the library's swallow + `events.onEvent` path (spec §17.1). Catching it would defeat the demo.
> - Keep the throwing handler on a DEDICATED channel so it never interferes with the real `product-events` / `product:*` demos.
> - **No Swagger**; thin controller.
>   Verification:
> - `pnpm --filter @nest-cache-example/api typecheck` — expected: exit 0.
> - `pnpm --filter @nest-cache-example/api lint` — expected: exit 0.
> - With Redis up + a `socket.io-client` listener on `cache:connection`: `curl -X POST http://localhost:3001/pubsub/throw` — expected: the API does **not** crash; a `cache:connection` `error` event with `data.reason === 'handler_error'` is observed (and `[cache] error` is logged by `CacheEventsBridge`); a subsequent publish to `product-events` still emits a `cache:event` (shared subscriber survived).

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P8-5 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

⚠️ Never mark done with failing verification.

---

## P8-6 — Phase verification (publish arrives in two open tabs · pattern matches · channels namespaced `cache-example:…`)

- **Status:** 🔴 Not Started
- **Priority:** Medium
- **Size:** S (30–90 min)
- **Depends on:** `P8-1`, `P8-2`, `P8-3`, `P8-4`, `P8-5`

### Description

The Phase 8 "Definition of done" gate per `DEVELOPMENT_PLAN.md`: prove the whole Pub/Sub + WebSocket bridge behaves as documented and that the four matrix rows it owns (#30 `publish`/`subscribe`, #31 `psubscribe`/`IPubSubPatternHandler`, #32 `Unsubscribe`, #33 `IPubSubHandler`) are demonstrated. Confirm that a `POST /pubsub/publish` arrives as a `cache:event` in **two** open browser tabs (fan-out), that a `product:*` pattern subscription receives a matching-channel message, that the ref-counted subscribe/unsubscribe lifecycle behaves (subscribe×2 + unsubscribe×1 keeps delivery; double-unsubscribe safe), that a throwing handler is isolated, and — the namespace proof — that channels are **namespaced** by the library (`product-events` resolves to `cache-example:product-events`; verifiable with a raw `redis-cli` subscriber). Closes the phase. No new feature code — only verification + fixes routed back into P8-1..P8-5.

### Acceptance Criteria

- [ ] `apps/api` `typecheck` + `lint` are clean.
- [ ] **Fan-out:** with two `socket.io-client` listeners connected, one `POST /pubsub/publish` to `product-events` delivers exactly one `cache:event` to **each** listener (proxy for "two browser tabs").
- [ ] **Pattern:** publishing to `product:42` yields a `cache:event` for that channel (the `product:*` `psubscribe` matched — matrix #31).
- [ ] **Ref-count:** `POST` subscribe ×2 then `DELETE` ×1 keeps delivery; a 2nd `DELETE` stops it; a 3rd `DELETE` is a safe no-op (matrix #32).
- [ ] **Handler isolation:** `POST /pubsub/throw` does not crash the API and surfaces an `error` with `reason: 'handler_error'` on `cache:connection`; other channels keep delivering (matrix #33).
- [ ] **Namespacing:** a raw `redis-cli SUBSCRIBE cache-example:product-events` receives the message published via `POST /pubsub/publish` with body `channel: "product-events"` — proving the library namespaced the channel (spec §17.1).
- [ ] The four matrix rows #30–#33 are demonstrably exercised by the above.

### Files to create / modify

- _(none — verification only; fix the corresponding P8-1..P8-5 task file if a check fails)_

### Agent Execution Prompt

> Role: Senior NestJS / TypeScript engineer.
> PROJECT: `nest-cache-example`, the reference app for `@bymax-one/nest-cache`. This is task **P8-6** of Phase 8 — the Definition-of-Done gate. See `docs/DEVELOPMENT_PLAN.md` §Phase 8 ("publishing on the API arrives as `cache:event` in two open browser tabs; a pattern subscription receives matching-channel messages; channels are namespaced (`cache-example:…`)") + §2 Global Conventions, `docs/TECHNICAL_SPECIFICATION.md` §17.1–§17.2, and `docs/DASHBOARD.md` §9 + §18. Matrix rows owned by Phase 8: #30 (`publish`/`subscribe`), #31 (`psubscribe`/`IPubSubPatternHandler`), #32 (`Unsubscribe`), #33 (`IPubSubHandler`).
> PRECONDITIONS: P8-1..P8-5 done. Docker Redis up (Phase 1). `apps/web` may not exist yet — substitute `socket.io-client` listeners for "browser tabs".
> REQUIRED READING: spec §17.1–§17.2; DASHBOARD §9 + §18; the §Phase 8 Definition-of-done in the plan.
> TASK: Run the Phase 8 verification gate, prove the five behaviours + namespacing, and close the phase. Add no feature code — if a check fails, fix it in the owning P8-1..P8-5 task file and re-run.
> DELIVERABLES:
>
> 1. Boot the API against Docker Redis (`pnpm --filter @nest-cache-example/api dev`).
> 2. Attach **two** `socket.io-client` listeners to `NEXT_PUBLIC_WS_URL` (or the API's socket origin) on `cache:event`; publish once to `product-events`; assert both receive exactly one message (fan-out / two tabs).
> 3. Publish to `product:42`; assert a `cache:event` for that channel arrives (pattern match).
> 4. Exercise `POST`/`DELETE /pubsub/subscribe` per the ref-count matrix (×2 subscribe, ×1 unsubscribe keeps delivery; 2nd stops; 3rd is a safe no-op).
> 5. `POST /pubsub/throw`; assert no crash + `error` event `reason: 'handler_error'` on `cache:connection` + other channels still deliver.
> 6. **Namespace proof:** in a shell, `redis-cli SUBSCRIBE cache-example:product-events` (matching `CACHE_NAMESPACE`/`CACHE_KEY_SEPARATOR`), then `POST /pubsub/publish` `{ "channel": "product-events", … }`; assert the raw subscriber receives it on the **namespaced** channel.
> 7. If anything fails, diagnose and fix in the corresponding P8-1..P8-5 file, then return here. Do NOT weaken any assertion to make it pass.
>    Constraints:
>
> - Follow `docs/DEVELOPMENT_PLAN.md` §2 Global Conventions.
> - Verification only — introduce no new feature code here; fixes go into the owning task file.
> - Do NOT skip the namespace proof — it is the phase's signature guarantee (spec §17.1).
>   Verification:
> - `pnpm --filter @nest-cache-example/api typecheck` — expected: exit 0.
> - `pnpm --filter @nest-cache-example/api lint` — expected: exit 0.
> - Two `socket.io-client` listeners both receive a `cache:event` for a single `product-events` publish.
> - `redis-cli SUBSCRIBE cache-example:product-events` receives a message published with body `channel: "product-events"` (namespacing proven).
> - The ref-count, pattern-match, and handler-isolation sequences behave exactly as in steps 3–5.

### Completion Protocol

1. ✅ Edit this task's `Status` line → `🟢 Done`.
2. ✅ Tick every box in **Acceptance Criteria**.
3. ✅ Update this task's row in the **Task index**.
4. ✅ Increment the **Progress** counter in the file header.
5. ✅ Update the matching row in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md#progress-summary) (Done / Total, %, Status).
6. ✅ Recompute "Overall progress" in `DEVELOPMENT_PLAN.md` (sum across all phases).
7. ✅ Append `- P8-6 ✅ YYYY-MM-DD — <one-line summary>` to **Completion log**.

When this task is 🟢, Phase 8 is 6/6 — switch the Phase 8 row in `DEVELOPMENT_PLAN.md` Progress Summary to 🟢 Done.

⚠️ Never mark done with failing verification.

---

## Completion log

_(Agents append one line per finished task, newest at the bottom.)_
