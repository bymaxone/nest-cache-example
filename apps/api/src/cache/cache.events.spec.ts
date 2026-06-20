/**
 * Unit: CacheEventsBridge — library lifecycle events → Logger + gateway.
 *
 * Constructs the bridge with a hand-mocked `EventsGateway` and spies on the Nest
 * `Logger.prototype` to assert the severity split: an `error`-typed event logs via
 * `logger.error` (with the data bag), every other event logs via `logger.log`.
 * Either way the event is broadcast to the dashboard via `emitConnectionEvent`.
 *
 * @module cache/cache.events.spec
 */
import { jest } from '@jest/globals'
import { Logger } from '@nestjs/common'
import { CACHE_EVENT_NAMES } from '@bymax-one/nest-cache/shared'
import type { EventsGateway } from '../events/events.gateway.js'
import { CacheEventsBridge } from './cache.events.js'

/**
 * Builds the bridge with a mocked gateway and silenced Logger spies.
 *
 * @returns The bridge's `onEvent` handler plus the gateway/logger spies.
 */
function setup() {
  const emitConnectionEvent = jest.fn<EventsGateway['emitConnectionEvent']>()
  const gatewayMock: Partial<EventsGateway> = { emitConnectionEvent }
  const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
  const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)

  const bridge = new CacheEventsBridge(gatewayMock as EventsGateway)
  // `onEvent` is optional on the library handler interface; narrow it once here so
  // every test invokes a defined handler.
  const { onEvent } = bridge.toCacheEvents()
  if (!onEvent) throw new Error('expected toCacheEvents() to expose an onEvent handler')
  return { onEvent, emitConnectionEvent, errorSpy, logSpy }
}

describe('CacheEventsBridge (unit)', () => {
  it('logs an error event via logger.error and broadcasts it', () => {
    /*
     * Scenario: the library reports a connection `error`.
     * Rule it protects: the `event === ERROR` arm logs at error level WITH the data
     * bag (operators must see the context), then still broadcasts to the dashboard.
     */
    const { onEvent, emitConnectionEvent, errorSpy, logSpy } = setup()
    const data = { code: 'ECONNREFUSED' }

    onEvent(CACHE_EVENT_NAMES.ERROR, data)

    expect(errorSpy).toHaveBeenCalledWith('[cache] error', data)
    expect(logSpy).not.toHaveBeenCalled()
    expect(emitConnectionEvent).toHaveBeenCalledWith('error', data)
    // The bridge tags its logger with the 'Cache' context; read it off the logged
    // instance so blanking that literal (which would mislabel every cache log line)
    // is caught.
    const loggerInstance = errorSpy.mock.instances[0]
    if (!loggerInstance) throw new Error('expected the error to be logged on a Logger instance')
    expect(Reflect.get(loggerInstance, 'context')).toBe('Cache')
  })

  it('logs a non-error event via logger.log and broadcasts it', () => {
    /*
     * Scenario: the library reports a benign lifecycle event (`ready`).
     * Rule it protects: the `else` arm logs at info level WITHOUT the data bag
     * (no error context needed), then broadcasts the event to the dashboard.
     */
    const { onEvent, emitConnectionEvent, errorSpy, logSpy } = setup()
    const data = { uptimeMs: 10 }

    onEvent(CACHE_EVENT_NAMES.READY, data)

    expect(logSpy).toHaveBeenCalledWith('[cache] ready')
    expect(errorSpy).not.toHaveBeenCalled()
    expect(emitConnectionEvent).toHaveBeenCalledWith('ready', data)
  })
})
