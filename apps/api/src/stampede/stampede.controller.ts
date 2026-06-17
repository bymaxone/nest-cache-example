/**
 * Stampede controller — the cache-stampede lab endpoint.
 *
 * Layer: stampede. Thin controller: validates the query via Zod and delegates to
 * StampedeService. Keys are auto-namespaced by `CacheService.eval`
 * (`cache-example:stampede:{id}`); the single-flight Lua body is declared in code,
 * never built from request input (TECHNICAL_SPECIFICATION.md §18, §24).
 */
import { Controller, Post, Query } from '@nestjs/common'
import { StampedeService } from './stampede.service.js'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import { StampedeQuerySchema, type StampedeQuery } from './dto/stampede-query.dto.js'
import type { StampedeResult } from './stampede.types.js'

/** Handles `/stampede` — fires a single-flight burst and returns its timeline. */
@Controller('stampede')
export class StampedeController {
  constructor(private readonly service: StampedeService) {}

  /**
   * POST /stampede?productId=&concurrency=&lockMs= — fire a single-flight burst.
   *
   * Fires `concurrency` concurrent contenders for one (uncached) product. Exactly
   * one wins the `acquireLock` lock and fetches the slow origin; the rest wait and
   * read the value it caches — collapsing N misses into 1 origin fetch + (N−1) hits.
   *
   * @param query - Validated burst parameters: `productId`, `concurrency`, `lockMs`.
   * @returns The per-contender timeline, the burst summary, and the resolved script SHA1.
   */
  @Post()
  async fire(
    @Query(new ZodValidationPipe(StampedeQuerySchema)) query: StampedeQuery,
  ): Promise<StampedeResult> {
    return this.service.run(query)
  }
}
