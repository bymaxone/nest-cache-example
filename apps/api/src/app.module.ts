/**
 * Root module — assembles config validation, cache wiring, WebSocket hub,
 * global exception filter, and all feature modules.
 *
 * Layer: root. `ConfigModule.forRoot` runs `validateEnv` at bootstrap; an
 * invalid env throws before Nest initializes any provider. `CacheModule`
 * registers `BymaxCacheModule` globally (`isGlobal: true`) so `CacheService`
 * is injectable app-wide without additional imports.
 */
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER } from '@nestjs/core'
import { validateEnv } from './config/env.schema.js'
import { EventsModule } from './events/events.module.js'
import { CacheModule } from './cache/cache.module.js'
import { CacheExceptionFilter } from './common/cache-exception.filter.js'
import { HealthController } from './health/health.controller.js'
import { CatalogModule } from './catalog/catalog.module.js'
import { CountersModule } from './counters/counters.module.js'
import { CollectionsModule } from './collections/collections.module.js'
import { MetricsModule } from './metrics/metrics.module.js'
import { AdminModule } from './admin/admin.module.js'
import { TenantsModule } from './tenants/tenants.module.js'

/** Root application module. */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    EventsModule,
    CacheModule,
    CatalogModule,
    CountersModule,
    CollectionsModule,
    MetricsModule,
    AdminModule,
    TenantsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: CacheExceptionFilter }],
})
export class AppModule {}
