/**
 * Counters controller — view-count and stock-decrement routes.
 *
 * Layer: counters. Thin controller; delegates all logic to CountersService.
 * All counter routes return a plain `number` — the value after the operation.
 *
 * Route overview (all under /counters/:id):
 *   GET  /:id/views          — current view count (0 when absent)
 *   POST /:id/views/incr     — atomic increment; optional body { by }
 *   POST /:id/stock/decr     — atomic decrement; optional body { by }
 */
import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { z } from 'zod'
import { CountersService } from './counters.service.js'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import { CounterBySchema } from './dto/counter-by.dto.js'
import type { CounterBy } from './dto/counter-by.dto.js'

/** Validates the `:id` path param shared by every counters route. */
export const counterParamsSchema = z.object({ id: z.string().min(1) })

/**
 * Handles all /counters routes.
 *
 * Each route delegates immediately to CountersService; this class owns only
 * input binding and HTTP status semantics.
 */
@Controller('counters')
export class CountersController {
  constructor(private readonly service: CountersService) {}

  /**
   * GET /counters/:id/views — current view count.
   *
   * Returns `0` when the key is absent (no error — a missing counter is
   * indistinguishable from a counter that has never been incremented).
   *
   * @param params - Path params containing the product `id`.
   * @returns The current view count.
   */
  @Get(':id/views')
  async getViews(
    @Param(new ZodValidationPipe(counterParamsSchema)) params: { id: string },
  ): Promise<number> {
    return this.service.getViews(params.id)
  }

  /**
   * POST /counters/:id/views/incr — atomic view-count increment.
   *
   * Uses Redis `INCR` / `INCRBY` — server-atomic, no read-modify-write race.
   * Optional body `{ by }` sets the step size (positive integer; default 1).
   *
   * @param params - Path params containing the product `id`.
   * @param body - Optional `{ by }` step.
   * @returns The counter value after the increment.
   */
  @Post(':id/views/incr')
  async incrViews(
    @Param(new ZodValidationPipe(counterParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(CounterBySchema)) body: CounterBy,
  ): Promise<number> {
    return this.service.incrViews(params.id, body.by)
  }

  /**
   * POST /counters/:id/stock/decr — atomic stock decrement.
   *
   * Uses Redis `DECR` / `DECRBY` — server-atomic, no read-modify-write race.
   * Optional body `{ by }` sets the step size (positive integer; default 1).
   *
   * @param params - Path params containing the product `id`.
   * @param body - Optional `{ by }` step.
   * @returns The stock value after the decrement.
   */
  @Post(':id/stock/decr')
  async decrStock(
    @Param(new ZodValidationPipe(counterParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(CounterBySchema)) body: CounterBy,
  ): Promise<number> {
    return this.service.decrStock(params.id, body.by)
  }
}
