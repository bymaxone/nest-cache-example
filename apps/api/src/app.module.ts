/**
 * Root module — assembles config validation, cache wiring, WebSocket hub,
 * global exception filter, and health endpoint.
 *
 * Layer: root. `ConfigModule.forRoot` runs `validateEnv` at bootstrap; an invalid
 * env throws before Nest initializes any provider. `CacheModule` registers
 * `BymaxCacheModule` globally (`isGlobal: true`) so `CacheService` and peers are
 * injectable app-wide without additional imports.
 */
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER } from '@nestjs/core'
import { validateEnv } from './config/env.schema.js'
import { EventsModule } from './events/events.module.js'
import { CacheModule } from './cache/cache.module.js'
import { CacheExceptionFilter } from './common/cache-exception.filter.js'
import { HealthController } from './health/health.controller.js'

/** Root application module. */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    EventsModule,
    CacheModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: CacheExceptionFilter }],
})
export class AppModule {}
