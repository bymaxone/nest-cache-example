/**
 * Unit: EventsGateway — the socket.io fan-out hub.
 *
 * Constructs the gateway directly (no DI, no socket.io adapter) and substitutes
 * the `@WebSocketServer()`-injected `server` with a fake `{ emit }` via
 * `Object.defineProperty` (the adapter would normally assign it at runtime). Each
 * of the three emit helpers must forward to `server.emit` with its fixed event
 * name and the documented envelope shape.
 *
 * @module events/events.gateway.spec
 */
import { jest } from '@jest/globals'
import type { CacheEventName } from '@bymax-one/nest-cache/shared'
import { EventsGateway } from './events.gateway.js'

/**
 * Builds the gateway with a fake socket.io server installed on the private
 * `@WebSocketServer()` field, returning the `emit` spy for assertions.
 *
 * @returns The gateway plus the `emit` mock the adapter would otherwise wire.
 */
function setup() {
  const emit = jest.fn()
  const server = { emit }
  const gateway = new EventsGateway()
  // The adapter assigns `server` at runtime; replicate that here. `readonly` is a
  // compile-time-only marker, so defineProperty is the runtime-honest equivalent.
  Object.defineProperty(gateway, 'server', { value: server, writable: true, configurable: true })
  return { gateway, emit }
}

describe('EventsGateway (unit)', () => {
  it('emits a connection-lifecycle envelope on cache:connection', () => {
    /*
     * Scenario: forward a library connection event.
     * Rule it protects: emitConnectionEvent broadcasts on the fixed `cache:connection`
     * channel wrapping `{ event, data }` so every tab sees the lifecycle transition.
     */
    const { gateway, emit } = setup()
    const event: CacheEventName = 'ready'
    const data = { host: 'localhost', attempt: 1 }

    gateway.emitConnectionEvent(event, data)

    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith('cache:connection', { event: 'ready', data })
  })

  it('emits a pub/sub message envelope on cache:event', () => {
    /*
     * Scenario: fan a Pub/Sub message out to all clients.
     * Rule it protects: emitMessage broadcasts on the fixed `cache:event` channel
     * wrapping `{ channel, payload }`, preserving the namespaced channel verbatim.
     */
    const { gateway, emit } = setup()
    const payload = { id: 42 }

    gateway.emitMessage('cache-example:product-events', payload)

    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith('cache:event', {
      channel: 'cache-example:product-events',
      payload,
    })
  })

  it('emits a key-expiry envelope on cache:expired', () => {
    /*
     * Scenario: relay a TTL expiry notification.
     * Rule it protects: emitExpired broadcasts on the fixed `cache:expired` channel
     * wrapping `{ key }` with the full Redis key that expired.
     */
    const { gateway, emit } = setup()

    gateway.emitExpired('cache-example:ttl:abc')

    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith('cache:expired', { key: 'cache-example:ttl:abc' })
  })
})
