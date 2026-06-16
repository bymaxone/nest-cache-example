/**
 * App-local cache module — wires `BymaxCacheModule` for the whole application.
 *
 * Layer: cache. Re-exports `BymaxCacheModule` so feature modules receive
 * `CacheService` and other library providers without additional imports.
 *
 * IMPORTANT: `isGlobal: true` is set at the `forRootAsync({ … })` call site.
 * The module builder resolves the global flag synchronously — before the async
 * `useFactory` completes — so returning `isGlobal` from inside `useFactory`
 * has NO effect (spec §9.2). Always pass it here, never inside the factory.
 */
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { BymaxCacheModule } from '@bymax-one/nest-cache'
import { EventsGateway } from '../events/events.gateway.js'
import { EventsModule } from '../events/events.module.js'
import { CacheEventsBridge } from './cache.events.js'
import { buildCacheOptions } from './cache.config.js'
import type { Env } from '../config/env.schema.js'

/** Registers BymaxCacheModule globally and re-exports it for feature modules. */
@Module({
  imports: [
    EventsModule,
    BymaxCacheModule.forRootAsync({
      isGlobal: true, // synchronous decision — must be here, not inside useFactory
      imports: [ConfigModule, EventsModule],
      inject: [ConfigService, EventsGateway],
      // CacheEventsBridge is stateless (closes over EventsGateway); a factory instance
      // is equivalent to the DI-managed one provided below for feature modules.
      useFactory: (config: ConfigService<Env, true>, gateway: EventsGateway) =>
        buildCacheOptions(config, new CacheEventsBridge(gateway).toCacheEvents()),
    }),
  ],
  providers: [CacheEventsBridge],
  exports: [BymaxCacheModule, CacheEventsBridge],
})
export class CacheModule {}
