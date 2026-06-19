/**
 * @fileoverview Unit tests for the navigation data table (`nav-items`). Asserts the
 * exported `NAV_GROUPS` shape: the four sections in order, the full route catalog,
 * unique hrefs, and that every item carries a label, an absolute href, and an icon.
 *
 * @module components/layout/nav-items.test
 */
import { describe, it, expect } from 'vitest'
import { NAV_GROUPS } from './nav-items'

describe('NAV_GROUPS', () => {
  it('declares the four sections in information-architecture order', () => {
    /*
     * Scenario: the sidebar renders its grouped rail.
     * Rule it protects: the four sections appear in the documented order
     * (Observe / Real-time / Labs / System) — the rail mirrors this exactly.
     */
    expect(NAV_GROUPS.map((group) => group.group)).toEqual([
      'Observe',
      'Real-time',
      'Labs',
      'System',
    ])
  })

  it('exposes the full ten-route cache catalog', () => {
    /*
     * Scenario: the dashboard's complete route set.
     * Rule it protects: every cache route is present exactly once across the groups,
     * so no page is unreachable from the rail.
     */
    const hrefs = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href))
    expect(hrefs).toEqual([
      '/',
      '/explorer',
      '/playground',
      '/tenants',
      '/pubsub',
      '/ttl',
      '/stampede',
      '/serializer',
      '/errors',
      '/connection',
    ])
  })

  it('gives every item a label, an absolute href, and an icon', () => {
    /*
     * Scenario: the rail maps over each item to render a link with an icon.
     * Rule it protects: each entry is well-formed — a non-empty label, an absolute
     * route, and a renderable icon component — so the map never produces a broken link.
     */
    const items = NAV_GROUPS.flatMap((group) => group.items)
    for (const item of items) {
      expect(item.label.length).toBeGreaterThan(0)
      expect(item.href.startsWith('/')).toBe(true)
      expect(item.icon).toBeTruthy()
    }
  })

  it('uses a unique href per item', () => {
    /*
     * Scenario: active-route detection keys off the href.
     * Rule it protects: hrefs are unique, so no two rail items collide on the same
     * route (which would double-activate during pathname matching).
     */
    const hrefs = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href))
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })
})
