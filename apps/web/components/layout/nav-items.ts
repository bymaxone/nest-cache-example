/**
 * @fileoverview Typed navigation table for the dashboard sidebar.
 *
 * The ten cache routes are grouped into four sections (Observe / Real-time /
 * Labs / System) mirroring the dashboard's information architecture. Each item
 * carries its route `href` and a `lucide-react` icon; the Sidebar maps over
 * these groups to render the nav rail.
 *
 * @module components/layout/nav-items
 */

import {
  LayoutDashboard,
  Search,
  Boxes,
  Building2,
  Radio,
  Timer,
  Zap,
  Binary,
  TriangleAlert,
  PlugZap,
  type LucideIcon,
} from 'lucide-react'

/** A single navigation entry: visible label, route, and its icon. */
export interface NavItem {
  /** Human-readable label shown in the rail. */
  label: string
  /** App Router route the item links to. */
  href: string
  /** Lucide icon rendered beside the label. */
  icon: LucideIcon
}

/** A labelled group of navigation entries. */
export interface NavGroup {
  /** Section heading (rendered uppercase). */
  group: string
  /** Entries belonging to this section. */
  items: readonly NavItem[]
}

/** The grouped nav model: Observe / Real-time / Labs / System. */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    group: 'Observe',
    items: [
      { label: 'Overview', href: '/', icon: LayoutDashboard },
      { label: 'Explorer', href: '/explorer', icon: Search },
      { label: 'Playground', href: '/playground', icon: Boxes },
      { label: 'Tenants', href: '/tenants', icon: Building2 },
    ],
  },
  {
    group: 'Real-time',
    items: [
      { label: 'Pub/Sub', href: '/pubsub', icon: Radio },
      { label: 'TTL Live', href: '/ttl', icon: Timer },
    ],
  },
  {
    group: 'Labs',
    items: [
      { label: 'Stampede', href: '/stampede', icon: Zap },
      { label: 'Serializer', href: '/serializer', icon: Binary },
      { label: 'Errors', href: '/errors', icon: TriangleAlert },
    ],
  },
  {
    group: 'System',
    items: [{ label: 'Connection', href: '/connection', icon: PlugZap }],
  },
]
