/**
 * Metrics module.
 *
 * Layer: metrics. Provides and exports MetricsService so catalog, counters, and
 * any other cache consumer can inject it. Declares MetricsController so
 * GET /metrics is registered in the NestJS router.
 */
import { Module } from '@nestjs/common'
import { MetricsService } from './metrics.service.js'
import { MetricsController } from './metrics.controller.js'

/** Registers the in-process metrics service and the /metrics endpoint. */
@Module({
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
