/**
 * Liveness endpoint.
 *
 * Layer: health. `GET /health` is probe-safe (never throws HTTP 500) and
 * returns a structured `{ status, latencyMs }` body. The metrics surface
 * lives in MetricsController at GET /metrics.
 */
import { Controller, Get } from '@nestjs/common'
import { CacheService } from '@bymax-one/nest-cache'

/** Probe-safe health surface. No Swagger — JSDoc documents the route. */
@Controller()
export class HealthController {
  constructor(private readonly cache: CacheService) {}

  /**
   * GET /health — Redis connectivity check and round-trip latency probe.
   *
   * Always returns 200 with a JSON body; `status` is `'degraded'` when Redis
   * is unreachable so load-balancer health checks can drain the instance.
   *
   * @returns `{ status: 'ok' | 'degraded', latencyMs: number }`
   */
  @Get('health')
  async health(): Promise<{ status: 'ok' | 'degraded'; latencyMs: number }> {
    const start = Date.now()
    try {
      const isHealthy = await this.cache.isHealthy()
      await this.cache.ping()
      return { status: isHealthy ? 'ok' : 'degraded', latencyMs: Date.now() - start }
    } catch {
      return { status: 'degraded', latencyMs: Date.now() - start }
    }
  }
}
