/**
 * Error-surface demo module.
 *
 * Layer: errors-demo. Wires the Error Explorer backend: `POST /errors/:code`
 * triggers each canonical `CacheException` so the global filter can be observed
 * mapping codes to HTTP statuses (spec §19). Depends only on the globally
 * registered `CacheService` (no providers beyond the controller + service).
 */
import { Module } from '@nestjs/common'
import { ErrorsDemoController } from './errors-demo.controller.js'
import { ErrorsDemoService } from './errors-demo.service.js'

/** Registers the Error Explorer backend controller + service. */
@Module({
  controllers: [ErrorsDemoController],
  providers: [ErrorsDemoService],
})
export class ErrorsDemoModule {}
