/**
 * WebSocket test helper — a `socket.io-client` bound to the booted server.
 *
 * The dashboard multiplexes three channels over one socket.io connection
 * (`cache:connection`, `cache:event`, `cache:expired`). This helper connects a
 * real client to the listening test server, captures every frame into a typed
 * per-channel buffer, and exposes `waitForEvent` so specs await a specific frame
 * (Pub/Sub fan-out, a key expiry, a connection-lifecycle event) instead of
 * blind-sleeping. Real-time delivery is asynchronous, so polling a buffer the
 * socket fills keeps the assertions deterministic rather than flaky.
 *
 * @module test/helpers/socket-client
 */
import { io, type Socket } from 'socket.io-client'
import { waitUntil } from './async.js'

/** A `cache:connection` frame — a connection-lifecycle event from the library bridge. */
export interface CacheConnectionFrame {
  /** Lifecycle event name (e.g. `'ready'`, `'error'`). */
  event: string
  /** Secret-free structured context provided by the library. */
  data: Record<string, unknown>
}

/** A `cache:event` frame — one Pub/Sub message forwarded to the dashboard. */
export interface CacheEventFrame {
  /** The namespaced channel the message arrived on (e.g. `cache-example:product-events`). */
  channel: string
  /** The deserialized message payload. */
  payload: unknown
}

/** A `cache:expired` frame — one Redis key-expiry keyspace notification. */
export interface CacheExpiredFrame {
  /** The full namespaced Redis key that expired. */
  key: string
}

/** Maps each captured channel name to the shape of the frames it carries. */
interface ChannelFrameMap {
  'cache:connection': CacheConnectionFrame
  'cache:event': CacheEventFrame
  'cache:expired': CacheExpiredFrame
}

/** Server→client event signatures, so the typed socket hands back typed frames. */
interface ServerToClientEvents {
  'cache:connection': (frame: CacheConnectionFrame) => void
  'cache:event': (frame: CacheEventFrame) => void
  'cache:expired': (frame: CacheExpiredFrame) => void
}

/** The connected client plus its capture buffers and await/teardown helpers. */
export interface SocketCapture {
  /** The underlying connected socket.io client. */
  socket: Socket<ServerToClientEvents>
  /** Every `cache:connection` frame received, in arrival order. */
  connection: CacheConnectionFrame[]
  /** Every `cache:event` frame received, in arrival order. */
  events: CacheEventFrame[]
  /** Every `cache:expired` frame received, in arrival order. */
  expired: CacheExpiredFrame[]
  /**
   * Resolves with the first buffered frame on `channel` that satisfies `predicate`,
   * polling until one arrives or rejecting on timeout.
   *
   * @param channel - The captured channel to scan.
   * @param predicate - Match condition for the awaited frame.
   * @param timeoutMs - Maximum time to wait before rejecting.
   * @returns The matching frame.
   * @throws When no matching frame arrives within `timeoutMs`.
   */
  waitForEvent: <C extends keyof ChannelFrameMap>(
    channel: C,
    predicate: (frame: ChannelFrameMap[C]) => boolean,
    timeoutMs?: number,
  ) => Promise<ChannelFrameMap[C]>
  /** Disconnects the client and removes its listeners. */
  close: () => Promise<void>
}

/** Upper bound (ms) for the initial socket handshake. */
const CONNECT_TIMEOUT_MS = 5_000
/** Default upper bound (ms) for {@link SocketCapture.waitForEvent}. */
const WAIT_FOR_EVENT_TIMEOUT_MS = 5_000

/**
 * Connects a `socket.io-client` to the listening test server and starts capturing.
 *
 * Resolves only after the handshake completes, so a returned capture is ready to
 * receive frames. `reconnection: false` + `forceNew: true` keep each connection
 * independent and prevent a reconnect storm from leaking handles across specs.
 *
 * @param baseUrl - The server's loopback base URL (`TestApiApp.baseUrl`).
 * @returns A {@link SocketCapture} once the socket has connected.
 * @throws When the handshake fails or does not complete within the connect timeout.
 */
export async function connectSocketClient(baseUrl: string): Promise<SocketCapture> {
  const socket: Socket<ServerToClientEvents> = io(baseUrl, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  })

  const connection: CacheConnectionFrame[] = []
  const events: CacheEventFrame[] = []
  const expired: CacheExpiredFrame[] = []
  // Append-only capture buffers: the socket pushes each frame as it arrives and
  // `waitForEvent` polls them; the same arrays are returned for direct inspection.
  const buffers: { [C in keyof ChannelFrameMap]: ChannelFrameMap[C][] } = {
    'cache:connection': connection,
    'cache:event': events,
    'cache:expired': expired,
  }

  socket.on('cache:connection', (frame) => connection.push(frame))
  socket.on('cache:event', (frame) => events.push(frame))
  socket.on('cache:expired', (frame) => expired.push(frame))

  await awaitHandshake(socket)

  const waitForEvent = async <C extends keyof ChannelFrameMap>(
    channel: C,
    predicate: (frame: ChannelFrameMap[C]) => boolean,
    timeoutMs: number = WAIT_FOR_EVENT_TIMEOUT_MS,
  ): Promise<ChannelFrameMap[C]> => {
    await waitUntil(() => buffers[channel].some(predicate), timeoutMs)
    const match = buffers[channel].find(predicate)
    if (match === undefined) {
      // Invariant: the buffer is append-only and waitUntil only resolves once
      // some(predicate) is true, so find re-locates the same frame in practice.
      throw new Error(`waitForEvent: no ${channel} frame matched after the wait resolved`)
    }
    return match
  }

  return { socket, connection, events, expired, waitForEvent, close: () => closeSocket(socket) }
}

/**
 * Resolves once the socket completes its handshake; on a connection error or a
 * timeout it disconnects the half-open client (so no handle leaks) and rejects.
 *
 * @param socket - A freshly-created, not-yet-connected socket.io client.
 * @returns Resolves when the `connect` event fires.
 * @throws When the handshake errors or does not complete within {@link CONNECT_TIMEOUT_MS}.
 */
async function awaitHandshake(socket: Socket<ServerToClientEvents>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const onConnect = (): void => {
      clearTimeout(timer)
      socket.off('connect_error', onError)
      resolve()
    }
    const onError = (err: Error): void => {
      clearTimeout(timer)
      socket.off('connect', onConnect)
      socket.disconnect()
      reject(err)
    }
    const timer = setTimeout(() => {
      socket.off('connect', onConnect)
      socket.off('connect_error', onError)
      socket.disconnect()
      reject(new Error(`socket did not connect within ${CONNECT_TIMEOUT_MS}ms`))
    }, CONNECT_TIMEOUT_MS)
    socket.once('connect', onConnect)
    socket.once('connect_error', onError)
  })
}

/**
 * Disconnects a socket and removes its listeners, awaiting the `disconnect` event
 * when the client is still connected so teardown leaves no open handle.
 *
 * @param socket - The client to close.
 * @returns Resolves once the client has disconnected.
 */
async function closeSocket(socket: Socket<ServerToClientEvents>): Promise<void> {
  socket.removeAllListeners()
  if (!socket.connected) {
    socket.disconnect()
    return
  }
  await new Promise<void>((resolve) => {
    socket.once('disconnect', () => resolve())
    socket.disconnect()
  })
}
