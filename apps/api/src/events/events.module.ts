/**
 * Events module — provides and exports the socket.io gateway.
 *
 * Layer: events. Imported by CacheModule (so CacheEventsBridge can inject
 * EventsGateway) and by AppModule (to boot the gateway with the app).
 */
import { Module } from '@nestjs/common'
import { EventsGateway } from './events.gateway.js'

@Module({ providers: [EventsGateway], exports: [EventsGateway] })
export class EventsModule {}
