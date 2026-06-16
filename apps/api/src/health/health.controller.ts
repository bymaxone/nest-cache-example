/**
 * Liveness and metrics endpoints.
 *
 * Layer: health. `GET /health` is probe-safe (never throws HTTP 500) and returns
 * a structured `{ status, latencyMs }` body. `GET /metrics` is a placeholder;
 * real app-level hit/miss counters land via MetricsService when it is wired.
 */
import { Controller, Get } from '@nestjs/common'
import { CacheService } from '@bymax-one/nest-cache'

/** Probe-safe health and metrics surface. No Swagger — JSDoc documents each route. */
@Controller()
export class HealthController {
  constructor(private readonly cache: CacheService) {}

  /**
   * GET /health — Redis connectivity check and round-trip latency probe.
   * Always returns 200 with a JSON body; status is `'degraded'` when unhealthy.
   *
   * @returns `{ status: 'ok' | 'degraded', latencyMs: number }`
   */
  @Get('health')
  async health(): Promise<{ status: 'ok' | 'degraded'; latencyMs: number }> {
    const isHealthy = await this.cache.isHealthy() // never throws
    const start = Date.now()
    try {
      await this.cache.ping() // throws on failure
      return { status: isHealthy ? 'ok' : 'degraded', latencyMs: Date.now() - start }
    } catch {
      return { status: 'degraded', latencyMs: Date.now() - start }
    }
  }

  /**
   * GET /metrics — placeholder for app-level hit/miss counters.
   * Real per-prefix metrics land via MetricsService when it is wired.
   *
   * @returns A placeholder marker object.
   */
  @Get('metrics')
  metrics(): { note: string } {
    return { note: 'metrics not yet available' } // TODO(phase-4): wire MetricsService
  }
}
