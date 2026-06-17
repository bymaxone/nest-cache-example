/**
 * TTL events module — keyspace-notification subscriber + demo seed endpoint.
 *
 * Layer: ttl-events. Imports EventsModule for the EventsGateway (the WS hub the
 * expiry feed targets). CacheService and the KeyBuilder / ConnectionManager tokens
 * are provided globally by BymaxCacheModule, so no further imports are required.
 */
import { Module } from '@nestjs/common'
import { EventsModule } from '../events/events.module.js'
import { TtlEventsService } from './ttl-events.service.js'
import { TtlEventsController } from './ttl-events.controller.js'

/** Wires the raw keyspace subscriber and the short-TTL seed route. */
@Module({
  imports: [EventsModule],
  controllers: [TtlEventsController],
  providers: [TtlEventsService],
})
export class TtlEventsModule {}
