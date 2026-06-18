/**
 * @fileoverview Shared `nuqs` URL-state parsers. Persisting control state in the
 * query string makes every view a shareable deep-link (the reason
 * `<NuqsAdapter>` is mounted in the provider tree).
 *
 * The global controls (`tenant`, `live`, `range`) are defined here. The Explorer
 * filter parsers (`prefix`, `pattern`, `type`, `hasTtl`, `strategy`) provide the
 * base defaults that keep `undefined` out of consumers; the Explorer page layers
 * its own query state on top of them.
 *
 * @module lib/filters
 */

import { parseAsBoolean, parseAsString, parseAsStringLiteral } from 'nuqs'

/** Relative time-range presets for the metric charts. */
export const RANGE_PRESETS = ['5m', '15m', '1h'] as const

/** A single relative time-range preset. */
export type RangePreset = (typeof RANGE_PRESETS)[number]

/** Active tenant prefix (empty = no tenant scoping). */
export const tenantParser = parseAsString.withDefault('')

/** Whether the live socket feeds are enabled. Off by default. */
export const liveParser = parseAsBoolean.withDefault(false)

/** Selected relative time range for metric charts. */
export const rangeParser = parseAsStringLiteral(RANGE_PRESETS).withDefault('15m')

/** Explorer key-prefix filter (empty = no prefix filter). */
export const prefixParser = parseAsString.withDefault('')

/** Explorer SCAN pattern filter (empty = match all). */
export const patternParser = parseAsString.withDefault('')

/** Explorer data-type filter (empty = all types). */
export const typeParser = parseAsString.withDefault('')

/** Explorer "has TTL" filter (false = include keys without a TTL). */
export const hasTtlParser = parseAsBoolean.withDefault(false)

/** Explorer serialization-strategy filter (empty = all strategies). */
export const strategyParser = parseAsString.withDefault('')

/** Explorer key-listing strategies: `scan` (safe cursor, default) vs `keys` (O(N), dev-only). */
export const SCAN_STRATEGIES = ['scan', 'keys'] as const

/** A single key-listing strategy. */
export type ScanStrategy = (typeof SCAN_STRATEGIES)[number]

/** Explorer listing-strategy toggle, persisted to the URL (defaults to safe `scan`). */
export const scanStrategyParser = parseAsStringLiteral(SCAN_STRATEGIES).withDefault('scan')

/** Explorer data-type facet values (string/hash/set). */
export const KEY_TYPES = ['string', 'hash', 'set'] as const

/** A single data-type facet value. */
export type KeyTypeFacet = (typeof KEY_TYPES)[number]

/** Explorer data-type facet, persisted to the URL (`null` = all types). */
export const keyTypeParser = parseAsStringLiteral(KEY_TYPES)
