/**
 * Serializer demo module.
 *
 * Layer: serializer-demo. Wires the Serializer Lab routes: POST /serializer/roundtrip
 * and GET /serializer/active. Demonstrates ISerializer injection via
 * BYMAX_CACHE_SERIALIZER, getRaw/setRaw bypass (matrix #14), and the default
 * JsonSerializer vs custom MsgPackSerializer contrast.
 */
import { Module } from '@nestjs/common'
import { SerializerDemoController } from './serializer-demo.controller.js'
import { SerializerDemoService } from './serializer-demo.service.js'

/** Registers the serializer demo routes and service. */
@Module({
  controllers: [SerializerDemoController],
  providers: [SerializerDemoService],
})
export class SerializerDemoModule {}
