/**
 * TTL events controller — the short-TTL seed endpoint for the dashboard demo.
 *
 * Layer: ttl-events. Thin controller: validates the body via Zod and delegates to
 * TtlEventsService. The seeded key uses the catalog write path, so it expires like
 * any cached value and triggers the `cache:expired` keyspace-notification feed.
 */
import { Body, Controller, Post } from '@nestjs/common'
import { TtlEventsService } from './ttl-events.service.js'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import { SeedTtlSchema, type SeedTtlDto } from './dto/seed-ttl.dto.js'

/** Handles `/ttl-events` routes — currently the demo seed endpoint. */
@Controller('ttl-events')
export class TtlEventsController {
  constructor(private readonly service: TtlEventsService) {}

  /**
   * POST /ttl-events/seed — writes a namespaced key with a short TTL.
   *
   * Seeds a demo key (via the catalog `set(ttl)` path) so the TTL Live page can
   * register a countdown ring and then observe the `cache:expired` event when
   * Redis fires the keyspace notification ~`ttlSeconds` later.
   *
   * @param body - Validated seed body: optional `id`, bounded `ttlSeconds` (default 5).
   * @returns The resolved namespaced key and the applied `ttlSeconds`.
   */
  @Post('seed')
  async seed(
    @Body(new ZodValidationPipe(SeedTtlSchema)) body: SeedTtlDto,
  ): Promise<{ key: string; ttlSeconds: number }> {
    return this.service.seed(body.ttlSeconds, body.id)
  }
}
