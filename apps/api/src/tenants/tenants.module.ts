/**
 * Tenants module — prefix-scoped multi-tenancy demo.
 *
 * Layer: tenants. Provides TenantsController and TenantsService.
 * No additional cache module import is needed — BymaxCacheModule is globally
 * registered (`isGlobal: true` via CacheModule), so CacheService and the
 * BYMAX_CACHE_KEY_BUILDER token are injectable without re-importing.
 */
import { Module } from '@nestjs/common'
import { TenantsController } from './tenants.controller.js'
import { TenantsService } from './tenants.service.js'

/** Feature module for namespace isolation and prefix-scoped multi-tenancy. */
@Module({
  controllers: [TenantsController],
  providers: [TenantsService],
})
export class TenantsModule {}
