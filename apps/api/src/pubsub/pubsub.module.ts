/**
 * Pub/Sub module — wires the controller and bridge service for the /pubsub routes.
 *
 * Layer: pubsub. Does NOT re-provide PubSubService — it is global from
 * BymaxCacheModule (isGlobal: true). EventsModule is imported so PubSubBridgeService
 * can inject EventsGateway for WebSocket fan-out.
 */
import { Module } from '@nestjs/common'
import { EventsModule } from '../events/events.module.js'
import { PubSubBridgeService } from './pubsub.bridge.service.js'
import { PubSubController } from './pubsub.controller.js'

/** Exposes the Pub/Sub bridge and controller; exports PubSubBridgeService for cross-module use. */
@Module({
  imports: [EventsModule],
  controllers: [PubSubController],
  providers: [PubSubBridgeService],
  exports: [PubSubBridgeService],
})
export class PubSubModule {}
