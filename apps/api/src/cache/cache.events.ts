/**
 * Cache lifecycle events bridge.
 *
 * Layer: cache. Bridges the library's connection-lifecycle events to the Nest
 * `Logger` (structured log per event) and to the dashboard via `EventsGateway`.
 * The returned `ICacheEvents` bag is passed into `BymaxCacheModule` options.
 * Event `data` is secret-free by library contract, so it is logged/broadcast verbatim.
 */
import { Injectable, Logger } from '@nestjs/common'
import type { ICacheEvents } from '@bymax-one/nest-cache'
import { CACHE_EVENT_NAMES, type CacheEventName } from '@bymax-one/nest-cache/shared'
import { EventsGateway } from '../events/events.gateway.js'

/**
 * Bridges `BymaxCacheModule` lifecycle events to the Nest Logger and the
 * dashboard. The `toCacheEvents()` bag is injected into `forRootAsync` options.
 */
@Injectable()
export class CacheEventsBridge {
  private readonly logger = new Logger('Cache')

  constructor(private readonly gateway: EventsGateway) {}

  /**
   * Returns the `ICacheEvents` bag passed into `BymaxCacheModule` options.
   * Each lifecycle event is logged (`error` → `logger.error`, others → `logger.log`)
   * and broadcast to all connected dashboard clients via `EventsGateway`.
   *
   * @returns A fully-wired `ICacheEvents` bag.
   */
  toCacheEvents(): ICacheEvents {
    return {
      onEvent: (event: CacheEventName, data: Record<string, unknown>) => {
        if (event === CACHE_EVENT_NAMES.ERROR) {
          this.logger.error(`[cache] ${event}`, data)
        } else {
          this.logger.log(`[cache] ${event}`)
        }
        this.gateway.emitConnectionEvent(event, data)
      },
    }
  }
}
