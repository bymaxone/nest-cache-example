/**
 * Domain types for the product catalog.
 *
 * Layer: catalog. Single source of truth for the Product shape shared across
 * the catalog service, DTOs, and the web app. The origin store is seeded from
 * SEED_PRODUCTS so every demo run has a stable, deterministic dataset.
 */

/**
 * A product in the catalog.
 *
 * The shape is intentionally small — enough to demonstrate typed caching of
 * a structured value through the JSON serializer.
 */
export interface Product {
  id: string
  name: string
  priceCents: number
  tags: string[]
  stock: number
}

/**
 * Deterministic seed rows for the in-memory origin store.
 *
 * IDs are stable short strings so demo URLs are readable. Prices, tags, and
 * stock levels are realistic enough to make the dashboard legible.
 */
export const SEED_PRODUCTS: readonly Product[] = [
  {
    id: 'p1',
    name: 'Wireless Headphones',
    priceCents: 7999,
    tags: ['electronics', 'audio'],
    stock: 42,
  },
  {
    id: 'p2',
    name: 'Mechanical Keyboard',
    priceCents: 12999,
    tags: ['electronics', 'input'],
    stock: 15,
  },
  {
    id: 'p3',
    name: 'Standing Desk Mat',
    priceCents: 3499,
    tags: ['office', 'ergonomics'],
    stock: 87,
  },
  {
    id: 'p4',
    name: 'USB-C Hub 7-in-1',
    priceCents: 4599,
    tags: ['electronics', 'accessories'],
    stock: 31,
  },
  {
    id: 'p5',
    name: 'Adjustable Laptop Stand',
    priceCents: 2999,
    tags: ['office', 'ergonomics'],
    stock: 54,
  },
] as const
