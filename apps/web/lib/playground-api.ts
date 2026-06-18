/**
 * @fileoverview Typed endpoints for the Playground data-structure cards. Mirrors the
 * NestJS catalog/counters/collections controllers — one typed function per route —
 * over the thin {@link api} transport, returning the same non-throwing `ApiResult`.
 *
 * @module lib/playground-api
 */

import { api, type ApiResult } from './api-client'
import { type Product } from './cache-api'

/** A single cart line item (a hash field value). */
export interface CartLine {
  /** Quantity ordered. */
  quantity: number
  /** Unit price in cents. */
  priceCents: number
}

/** Result of the idempotent product seed (`setNx`). */
export interface SeedResult {
  /** Whether the write occurred (false = key already present). */
  isCreated: boolean
  /** Whether the key is currently present. */
  isPresent: boolean
}

/** Result of listing a product's tag set. */
export interface TagsResult {
  /** Raw string members of the set. */
  tags: string[]
  /** Set cardinality. */
  count: number
}

/** Encode a single path segment (ids/fields/tags are user-entered). */
function seg(value: string): string {
  return encodeURIComponent(value)
}

/** Catalog (string) ops — product read-through, idempotent seed, TTL. */
export const catalogApi = {
  /** Read-through fetch of a product (cache hit fast; miss loads + caches). */
  get: (id: string): Promise<ApiResult<Product>> =>
    api.get<Product>(`/catalog/products/${seg(id)}`),
  /** Batch read-through of several products (positional `null` for unknowns). */
  batchGet: (ids: string[]): Promise<ApiResult<Array<Product | null>>> =>
    api.get<Array<Product | null>>(`/catalog/products?ids=${ids.map(seg).join(',')}`),
  /** Remaining TTL in seconds (`-2` missing, `-1` no expiry). */
  ttl: (id: string): Promise<ApiResult<number>> =>
    api.get<number>(`/catalog/products/${seg(id)}/ttl`),
  /** Idempotent seed via `setNx`. */
  seed: (
    id: string,
    body: { name?: string; priceCents?: number },
  ): Promise<ApiResult<SeedResult>> =>
    api.post<SeedResult>(`/catalog/products/${seg(id)}/seed`, body),
  /** Set a TTL on an existing key. */
  expire: (id: string, ttlSeconds: number): Promise<ApiResult<boolean>> =>
    api.post<boolean>(`/catalog/products/${seg(id)}/expire`, { ttlSeconds }),
  /** Remove a key's TTL (make persistent). */
  persist: (id: string): Promise<ApiResult<boolean>> =>
    api.post<boolean>(`/catalog/products/${seg(id)}/persist`),
}

/** Counters (numeric) ops — atomic view increment and stock decrement. */
export const countersApi = {
  /** Current view count (0 when absent). */
  views: (id: string): Promise<ApiResult<number>> => api.get<number>(`/counters/${seg(id)}/views`),
  /** Atomic view increment (optional step `by`). */
  incrViews: (id: string, by?: number): Promise<ApiResult<number>> =>
    api.post<number>(`/counters/${seg(id)}/views/incr`, by !== undefined ? { by } : undefined),
  /** Atomic stock decrement (optional step `by`). */
  decrStock: (id: string, by?: number): Promise<ApiResult<number>> =>
    api.post<number>(`/counters/${seg(id)}/stock/decr`, by !== undefined ? { by } : undefined),
}

/** Collections ops — carts (hashes) and tags (sets). */
export const collectionsApi = {
  /** Read the whole cart hash. */
  getCart: (id: string): Promise<ApiResult<Record<string, CartLine>>> =>
    api.get<Record<string, CartLine>>(`/collections/${seg(id)}/cart`),
  /** Read one cart line. */
  getCartLine: (id: string, field: string): Promise<ApiResult<CartLine | null>> =>
    api.get<CartLine | null>(`/collections/${seg(id)}/cart/${seg(field)}`),
  /** Add or update a cart line (`hset`). */
  setCartLine: (id: string, field: string, value: CartLine): Promise<ApiResult<number>> =>
    api.post<number>(`/collections/${seg(id)}/cart`, { field, value }),
  /** Remove a cart line (`hdel`). */
  removeCartLine: (id: string, field: string): Promise<ApiResult<number>> =>
    api.del<number>(`/collections/${seg(id)}/cart/${seg(field)}`),
  /** Add tags to the set (`sadd`). */
  addTags: (id: string, tags: string[]): Promise<ApiResult<number>> =>
    api.post<number>(`/collections/${seg(id)}/tags`, { tags }),
  /** List all tags + cardinality (`smembers` + `scard`). */
  listTags: (id: string): Promise<ApiResult<TagsResult>> =>
    api.get<TagsResult>(`/collections/${seg(id)}/tags`),
  /** Test membership (`sismember`). */
  hasTag: (id: string, tag: string): Promise<ApiResult<boolean>> =>
    api.get<boolean>(`/collections/${seg(id)}/tags/${seg(tag)}`),
  /** Remove a tag (`srem`). */
  removeTag: (id: string, tag: string): Promise<ApiResult<number>> =>
    api.del<number>(`/collections/${seg(id)}/tags/${seg(tag)}`),
}
