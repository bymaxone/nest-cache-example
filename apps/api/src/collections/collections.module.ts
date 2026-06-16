/**
 * Collections module.
 *
 * Layer: collections. Wires CollectionsController and CollectionsService for
 * the cart-as-hash and tags-as-set demos.
 */
import { Module } from '@nestjs/common'
import { CollectionsController } from './collections.controller.js'
import { CollectionsService } from './collections.service.js'

/** Registers the cart hash and tag set routes and their dependencies. */
@Module({
  controllers: [CollectionsController],
  providers: [CollectionsService],
})
export class CollectionsModule {}
