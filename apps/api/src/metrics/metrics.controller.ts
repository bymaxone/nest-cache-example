/**
 * Metrics endpoint.
 *
 * Layer: metrics. Exposes GET /metrics, which returns the app-level, in-process
 * hit/miss snapshot produced by MetricsService. The response `note` field makes
 * it unambiguous that these are NOT library-level or persistent metrics — they
 * reset whenever the process restarts.
 */
import { Controller, Get } from '@nestjs/common'
import { MetricsService } from './metrics.service.js'
import type { MetricsSnapshot } from './metrics.types.js'

/**
 * Controller for the /metrics surface.
 *
 * No Swagger — JSDoc documents each route. No request body or query params —
 * the snapshot is a read-only view of the in-process counters.
 */
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  /**
   * GET /metrics — app-level, in-process hit/miss counters.
   *
   * Returns per-prefix stats, aggregated totals, and a sampled
   * `instantaneous_ops_per_sec`. ALL values are in-process and reset on
   * restart — this endpoint is NOT backed by a library feature or Redis.
   *
   * @returns A MetricsSnapshot with a `note` field restating the app-level scope.
   */
  @Get()
  getMetrics(): MetricsSnapshot {
    return this.metrics.snapshot()
  }
}
