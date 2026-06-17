/**
 * Simulated slow origin for the cache-stampede lab.
 *
 * Layer: stampede. Stands in for a slow upstream (database, third-party API) so a
 * single-flight collapse is observable: only the lock winner pays this latency,
 * while the losers read the value the winner cached. Deliberately stateless — the
 * count of origin fetches per burst is derived by `StampedeService` from each
 * contender's outcome, not from shared mutable module state (which would be racy
 * under concurrency and never reset between requests).
 */

/** Artificial origin latency (ms) — large enough to dwarf a cache read so the collapse is visible. */
const ORIGIN_LATENCY_MS = 400
/** Synthetic unit price (minor currency units) for the demo product. */
const DEMO_PRICE_CENTS = 1000
/** Synthetic stock level for the demo product. */
const DEMO_STOCK = 100

/**
 * A product value as returned by the slow origin and written to the cache.
 *
 * The winner writes this under the shared `product:{id}` key (the same read-through
 * cache the catalog uses — the lab deliberately populates the real product cache,
 * not a parallel one), so the shape MUST match the catalog `Product`: writing a
 * structurally-narrower value would leave a later catalog read with missing fields.
 */
export interface StampedeProduct {
  id: string
  name: string
  priceCents: number
  tags: string[]
  stock: number
}

/**
 * Resolves after `ms` milliseconds. Shared by the origin latency and the loser
 * poll-backoff so both delays read identically at their call sites.
 *
 * @param ms - Delay in milliseconds.
 * @returns A promise that resolves once the delay elapses.
 */
export function delay(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

/**
 * Fetches a product from the simulated slow origin.
 *
 * Always resolves (the demo never models an origin error) after a fixed latency,
 * returning a deterministic product shape for the given id.
 *
 * @param productId - The product id being contended for.
 * @returns The freshly-fetched product value to populate the cache with.
 */
export async function fetchProductFromOrigin(productId: string): Promise<StampedeProduct> {
  await delay(ORIGIN_LATENCY_MS)
  return {
    id: productId,
    name: `Product ${productId}`,
    priceCents: DEMO_PRICE_CENTS,
    tags: [],
    stock: DEMO_STOCK,
  }
}
