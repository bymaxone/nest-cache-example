/**
 * Serializer demo controller — exposes round-trip and active-codec routes.
 *
 * Layer: serializer-demo. Thin controller: validates inputs via Zod, delegates
 * to SerializerDemoService, and returns typed results. No business logic here.
 *
 * Route overview (all under /serializer):
 *   POST /roundtrip?codec=json|msgpack — store payload, return raw + decoded
 *   GET  /active                       — report the active codec name
 */
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { SerializerDemoService } from './serializer-demo.service.js'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import { RoundtripBodySchema, RoundtripQuerySchema } from './dto/roundtrip.dto.js'
import type { CaveatResult, RoundtripResult } from './serializer-demo.service.js'

/**
 * Handles all /serializer routes for the Serializer Lab.
 *
 * Every route delegates immediately to SerializerDemoService; this class owns
 * only input binding and HTTP status semantics.
 */
@Controller('serializer')
export class SerializerDemoController {
  constructor(private readonly service: SerializerDemoService) {}

  /**
   * POST /serializer/roundtrip?codec=json|msgpack
   *
   * Accepts any JSON object body, writes it to cache with the active serializer,
   * then reads it back in two ways: raw stored string (getRaw) and decoded value
   * (get). Also exercises the setRaw/getRaw bypass (see TECHNICAL_SPECIFICATION.md §4.1).
   * Returns all four values together with the active codec label and the raw byte size.
   *
   * @param query - Validated `codec` query (label for the UI; the actual active
   *   codec is whatever the module was registered with via CACHE_SERIALIZER env).
   * @param body - Any JSON object to round-trip.
   * @returns `{ codec, raw, decoded, rawBytes, rawBypass }`.
   */
  @Post('roundtrip')
  async roundtrip(
    @Query(new ZodValidationPipe(RoundtripQuerySchema)) query: { codec: string },
    @Body(new ZodValidationPipe(RoundtripBodySchema)) body: Record<string, unknown>,
  ): Promise<RoundtripResult> {
    const result = await this.service.roundtrip(body)
    return { codec: query.codec, ...result }
  }

  /**
   * POST /serializer/caveat?codec=json|msgpack
   *
   * Stores the built-in caveat fixture (which contains a Date) and reads it back.
   * Under the default JSON codec, Date round-trips as an ISO string (dateSurvived: false).
   * Under MessagePack, it survives intact (dateSurvived: true). Demonstrates the
   * SerializableValue boundary documented in TECHNICAL_SPECIFICATION.md §16.1.
   *
   * @param query - Validated `codec` query (label for the UI).
   * @returns `{ codec, raw, decoded, dateSurvived, note }`.
   */
  @Post('caveat')
  async caveat(
    @Query(new ZodValidationPipe(RoundtripQuerySchema)) query: { codec: string },
  ): Promise<CaveatResult> {
    const result = await this.service.caveat()
    return { codec: query.codec, ...result }
  }

  /**
   * GET /serializer/active
   *
   * Returns the constructor name of the active ISerializer injected via the
   * BYMAX_CACHE_SERIALIZER token (e.g. 'JsonSerializer' or 'MsgPackSerializer').
   *
   * @returns `{ serializer: string }`.
   */
  @Get('active')
  active(): { serializer: string } {
    return { serializer: this.service.activeSerializer() }
  }
}
