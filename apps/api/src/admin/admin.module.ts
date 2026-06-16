/**
 * Cache Admin module — Explorer backend feature module.
 *
 * Layer: admin. Provides the `AdminController` and `AdminService`. No cache
 * module import is required here — `BymaxCacheModule` is registered globally
 * (`isGlobal: true` via `CacheModule`), so `CacheService` and the
 * `BYMAX_CACHE_KEY_BUILDER` token are injectable app-wide without re-importing.
 */
import { Module } from '@nestjs/common'
import { AdminController } from './admin.controller.js'
import { AdminService } from './admin.service.js'

/** Feature module for the Cache Admin API (Explorer backend). */
@Module({
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
