/**
 * Counters module.
 *
 * Layer: counters. Wires CountersController and CountersService for the atomic
 * incr/decr demo (view counter + stock decrement).
 */
import { Module } from '@nestjs/common'
import { CountersController } from './counters.controller.js'
import { CountersService } from './counters.service.js'

/** Registers the atomic counter routes and their dependencies. */
@Module({
  controllers: [CountersController],
  providers: [CountersService],
})
export class CountersModule {}
