/**
 * In-memory product origin store.
 *
 * Layer: catalog. Stands in for a real database. Every read incurs an
 * artificial delay so the dashboard can make cache hits visibly faster than
 * origin fetches — the core lesson of the read-through demo.
 */
import { Injectable } from '@nestjs/common'
import type { Product } from './product.types.js'
import { SEED_PRODUCTS } from './product.types.js'

/** Artificial delay so a cache hit is visibly faster than an origin miss on the dashboard. */
const ORIGIN_LATENCY_MS = 120

/**
 * Injectable in-memory store seeded from SEED_PRODUCTS.
 *
 * Resets on restart by design — this is intentionally NOT a persistent
 * database. Unknown ids always resolve to `null`; the store never throws.
 */
@Injectable()
export class ProductOriginStore {
  private readonly store = new Map<string, Product>()

  constructor() {
    for (const product of SEED_PRODUCTS) {
      this.store.set(product.id, product)
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise<void>((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Fetches a single product, simulating an origin round-trip.
   *
   * @param id - The product id.
   * @returns The product, or `null` when the id is unknown.
   */
  async find(id: string): Promise<Product | null> {
    await this.delay(ORIGIN_LATENCY_MS)
    return this.store.get(id) ?? null
  }

  /**
   * Fetches multiple products in a single simulated round-trip.
   *
   * One delay for the whole batch mirrors how a real database processes a
   * multi-row SELECT in one network round-trip.
   *
   * @param ids - The product ids to fetch.
   * @returns Values positionally aligned with `ids`; `null` for missing rows.
   */
  async findMany(ids: string[]): Promise<Array<Product | null>> {
    await this.delay(ORIGIN_LATENCY_MS)
    return ids.map((id) => this.store.get(id) ?? null)
  }
}
