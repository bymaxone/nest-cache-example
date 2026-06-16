/**
 * socket.io hub for the cache-example dashboard.
 *
 * Layer: events. Exposes three multiplexed channels to connected clients:
 *   - `cache:connection` — connection lifecycle events (driven by CacheEventsBridge)
 *   - `cache:event`       — Pub/Sub fan-out (wired when PubSubService is enabled)
 *   - `cache:expired`     — TTL keyspace-notification expiry (wired when keyspace events are configured)
 *
 * CORS is applied at the adapter level (SocketIoAdapter in main.ts), so this
 * decorator stays a static literal — no `process.env` read at class-definition time.
 */
import { Injectable } from '@nestjs/common'
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets'
import { Server } from 'socket.io'
import type { CacheEventName } from '@bymax-one/nest-cache'

@Injectable()
@WebSocketGateway()
export class EventsGateway {
  /**
   * The socket.io server instance, injected by the WebSocket adapter after the
   * gateway is initialized by NestJS.
   */
  @WebSocketServer() private readonly server!: Server

  /**
   * Broadcasts a connection-lifecycle event to all connected clients.
   *
   * @param event - The lifecycle event name (e.g. `'ready'`, `'error'`).
   * @param data - Secret-free structured context provided by the library.
   */
  emitConnectionEvent(event: CacheEventName, data: Record<string, unknown>): void {
    this.server.emit('cache:connection', { event, data })
  }

  /**
   * Broadcasts a Pub/Sub message to all connected clients.
   *
   * @param channel - The namespaced channel the message arrived on.
   * @param payload - The deserialized message payload.
   */
  emitMessage(channel: string, payload: unknown): void {
    this.server.emit('cache:event', { channel, payload })
  }

  /**
   * Broadcasts a key-expiry (TTL) notification to all connected clients.
   *
   * @param key - The full Redis key that expired.
   */
  emitExpired(key: string): void {
    this.server.emit('cache:expired', { key })
  }
}
