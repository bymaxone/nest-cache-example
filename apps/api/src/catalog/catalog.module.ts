/**
 * Catalog module.
 *
 * Layer: catalog. Wires the read-through product cache: CatalogController,
 * CatalogService, and ProductOriginStore. Imports MetricsModule so
 * CatalogService can record per-prefix hit/miss events.
 */
import { Module } from '@nestjs/common'
import { CatalogController } from './catalog.controller.js'
import { CatalogService } from './catalog.service.js'
import { ProductOriginStore } from './product-origin.store.js'
import { MetricsModule } from '../metrics/metrics.module.js'

/** Registers the product read-through routes and their dependencies. */
@Module({
  imports: [MetricsModule],
  controllers: [CatalogController],
  providers: [CatalogService, ProductOriginStore],
})
export class CatalogModule {}
