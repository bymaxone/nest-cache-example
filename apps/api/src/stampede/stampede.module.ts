/**
 * Stampede module — the cache-stampede / single-flight lab.
 *
 * Layer: stampede. Wires the `POST /stampede` controller and its service. No
 * imports are needed: `CacheService` and the `ScriptManagerService` token
 * (`BYMAX_CACHE_SCRIPT_REGISTRY`) are provided globally by BymaxCacheModule.
 */
import { Module } from '@nestjs/common'
import { StampedeController } from './stampede.controller.js'
import { StampedeService } from './stampede.service.js'

/** Declares the stampede lab controller + service. */
@Module({
  controllers: [StampedeController],
  providers: [StampedeService],
})
export class StampedeModule {}
