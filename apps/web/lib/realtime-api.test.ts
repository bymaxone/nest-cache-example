/**
 * @fileoverview Unit tests for the Real-time endpoint surface (`lib/realtime-api`):
 * the REST Pub/Sub controls and the TTL-demo seed.
 *
 * The transport is mocked, so each endpoint is asserted by the verb + path/body it
 * builds. Covers `pubsubApi.publish/subscribe/unsubscribe` (the browser publishes
 * via REST, never over the receive-only socket) and `ttlApi.seed` across both
 * branches of the optional explicit-id guard (`id` present → body includes it,
 * absent → ttl-only body).
 *
 * @module lib/realtime-api.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const get = vi.fn()
const post = vi.fn()
const del = vi.fn()

vi.mock('./api-client', () => ({
  // Forward only the args actually passed (rest spread), so a bodyless verb call
  // records a single argument rather than a trailing `undefined`.
  api: {
    get: (...args: unknown[]): void => void get(...args),
    post: (...args: unknown[]): void => void post(...args),
    del: (...args: unknown[]): void => void del(...args),
  },
}))

const { pubsubApi, ttlApi } = await import('./realtime-api')

beforeEach(() => {
  get.mockReset()
  post.mockReset()
  del.mockReset()
})

describe('pubsubApi', () => {
  it('publish posts the channel and message body', () => {
    /*
     * Scenario: the browser publishes a message via REST.
     * Rule it protects: `publish` POSTs `{ channel, message }` to `/pubsub/publish`
     * (never emitting over the receive-only socket).
     */
    void pubsubApi.publish('orders', { id: 1 })
    expect(post).toHaveBeenCalledWith('/pubsub/publish', { channel: 'orders', message: { id: 1 } })
  })

  it('subscribe posts the channel/pattern flag', () => {
    /*
     * Scenario: adding a pattern subscription.
     * Rule it protects: `subscribe` POSTs `{ channel, pattern }` to
     * `/pubsub/subscribe`.
     */
    void pubsubApi.subscribe('product:*', true)
    expect(post).toHaveBeenCalledWith('/pubsub/subscribe', { channel: 'product:*', pattern: true })
  })

  it('unsubscribe deletes with the channel/pattern body', () => {
    /*
     * Scenario: releasing an exact-channel subscription.
     * Rule it protects: `unsubscribe` DELETEs `/pubsub/subscribe` with the
     * channel/pattern body (ref-counted release).
     */
    void pubsubApi.unsubscribe('orders', false)
    expect(del).toHaveBeenCalledWith('/pubsub/subscribe', { channel: 'orders', pattern: false })
  })
})

describe('ttlApi', () => {
  it('seed sends a ttl-only body when no explicit id is given', () => {
    /*
     * Scenario: seeding a TTL key with a server-generated id.
     * Rule it protects: without `id`, the body carries only `{ ttlSeconds }`.
     */
    void ttlApi.seed(30)
    expect(post.mock.calls[0]?.[0]).toBe('/ttl-events/seed')
    // toStrictEqual (not toHaveBeenCalledWith): loose equality ignores `undefined`
    // props, so an always-include-id mutant emitting `{ ttlSeconds, id: undefined }`
    // would slip past — strict equality rejects the extra key.
    expect(post.mock.calls[0]?.[1]).toStrictEqual({ ttlSeconds: 30 })
  })

  it('seed includes the explicit id in the body when provided', () => {
    /*
     * Scenario: seeding a TTL key with a caller-chosen id.
     * Rule it protects: a provided `id` is merged into the body alongside the TTL.
     */
    void ttlApi.seed(45, 'my-key')
    expect(post).toHaveBeenCalledWith('/ttl-events/seed', { ttlSeconds: 45, id: 'my-key' })
  })
})
