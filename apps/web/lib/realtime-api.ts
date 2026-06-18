/**
 * @fileoverview Typed endpoints for the Real-time pages (Pub/Sub + TTL Live) over
 * the thin {@link api} transport. Mirrors the NestJS `pubsub` and `ttl-events`
 * controllers — one typed function per route — and returns the same non-throwing
 * `ApiResult` discriminated union the rest of the dashboard uses.
 *
 * The browser **publishes via REST** here (`POST /pubsub/publish`); the live
 * `cache:event` / `cache:expired` fan-out arrives over the receive-only socket
 * (`hooks/use-cache-socket.ts`), never by emitting on it (DASHBOARD §18).
 *
 * @module lib/realtime-api
 */

import { api, type ApiResult } from './api-client'

/** Response of `POST /pubsub/publish` — the channel and how many subscribers received it. */
export interface PublishResponse {
  /** The app channel the message was published to (pre-namespace). */
  channel: string
  /** Number of subscribers (including the server-side gateway bridge) that received it. */
  subscribers: number
}

/** Response of `POST`/`DELETE /pubsub/subscribe` — the channel, ref-count, and kind. */
export interface SubscriptionResponse {
  /** The app channel (pre-namespace). */
  channel: string
  /** Current ref-count for this channel's shared subscription. */
  refs: number
  /** Whether this is a pattern (`psubscribe`) subscription. */
  pattern: boolean
}

/** Response of `POST /ttl-events/seed` — the seeded key and its applied TTL. */
export interface SeedTtlResponse {
  /** The fully-namespaced key that was seeded. */
  key: string
  /** The TTL applied, in seconds. */
  ttlSeconds: number
}

/** Typed Pub/Sub endpoints (`/pubsub/*`). */
export const pubsubApi = {
  /**
   * Publish a JSON message to an app channel (the library namespaces it).
   *
   * @param channel - The app channel (e.g. `product-events`).
   * @param message - Any JSON-serializable payload.
   * @returns `{ channel, subscribers }` — the subscriber count the library returns.
   */
  publish: (channel: string, message: unknown): Promise<ApiResult<PublishResponse>> =>
    api.post<PublishResponse>('/pubsub/publish', { channel, message }),

  /**
   * Add a subscription for an exact channel or a glob pattern (ref-counted).
   *
   * @param channel - The exact channel or pattern (e.g. `product:*`).
   * @param pattern - True for a `psubscribe` pattern subscription.
   * @returns `{ channel, refs, pattern }` with the incremented ref-count.
   */
  subscribe: (channel: string, pattern: boolean): Promise<ApiResult<SubscriptionResponse>> =>
    api.post<SubscriptionResponse>('/pubsub/subscribe', { channel, pattern }),

  /**
   * Remove a subscription (ref-counted; a no-op when none remains).
   *
   * @param channel - The exact channel or pattern to release.
   * @param pattern - True when releasing a pattern subscription.
   * @returns `{ channel, refs, pattern }` with the decremented ref-count.
   */
  unsubscribe: (channel: string, pattern: boolean): Promise<ApiResult<SubscriptionResponse>> =>
    api.del<SubscriptionResponse>('/pubsub/subscribe', { channel, pattern }),
}

/** Typed TTL-demo seed endpoint (`/ttl-events/*`). */
export const ttlApi = {
  /**
   * Seed a namespaced key with a short TTL so the TTL Live wall can watch it drain
   * and then observe the server `cache:expired` event when it expires.
   *
   * @param ttlSeconds - The TTL to apply, in seconds (1–120; the demo bounds it).
   * @param id - Optional explicit key id; a UUID is generated server-side when omitted.
   * @returns `{ key, ttlSeconds }` — the resolved namespaced key and applied TTL.
   */
  seed: (ttlSeconds: number, id?: string): Promise<ApiResult<SeedTtlResponse>> =>
    api.post<SeedTtlResponse>(
      '/ttl-events/seed',
      id !== undefined ? { ttlSeconds, id } : { ttlSeconds },
    ),
}
