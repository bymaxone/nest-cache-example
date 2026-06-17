/**
 * @fileoverview 250px glass nav rail — grouped cache routes with an orange
 * active item. Desktop: sticky below the topbar. Mobile: a fixed overlay
 * toggled by the topbar hamburger. Active detection uses `usePathname()` with
 * exact matching for the root route and prefix matching for the rest.
 *
 * @module components/layout/Sidebar
 */

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { APP_NAMESPACE } from '@/lib/constants'
import { NAV_GROUPS } from './nav-items'

const NAV_ITEM_BASE_CLASS =
  'flex items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-sm transition-all duration-150'
const NAV_ITEM_ACTIVE_CLASS = 'border-l-brand-500 bg-brand-500/10 font-semibold text-brand-500'
const NAV_ITEM_INACTIVE_CLASS = 'border-l-transparent text-white/55 hover:bg-white/5'
const ICON_BASE_CLASS = 'h-4 w-4 shrink-0'
const ICON_ACTIVE_CLASS = 'text-brand-500'
const ICON_INACTIVE_CLASS = 'text-white/40'
const NAV_BASE_CLASSES = [
  'w-[250px] shrink-0 flex-col border-r border-white/8 bg-(--color-sidebar-bg)',
  'fixed left-0 top-16 z-100 h-[calc(100vh-64px)] overflow-y-auto',
  'lg:sticky lg:top-16 lg:h-[calc(100vh-64px)]',
] as const

/**
 * Returns whether a nav item is the active route for the given pathname.
 *
 * The root route (`/`) matches only exactly; every other route also matches its
 * nested children (`/explorer`, `/explorer/foo`).
 *
 * @param href - The nav item's route.
 * @param pathname - The current pathname from `usePathname()`.
 * @returns `true` when the item should render in its active state.
 */
function isActiveRoute(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

interface SidebarProps {
  /** Controls mobile overlay visibility. */
  isOpen: boolean
  /** Closes the mobile overlay after a navigation. */
  onNavClick?: () => void
}

/** 250px glass nav rail — grouped cache routes, orange active item. */
export function Sidebar({ isOpen, onNavClick }: SidebarProps) {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Main navigation"
      className={cn(...NAV_BASE_CLASSES, isOpen ? 'flex' : 'hidden lg:flex')}
    >
      <div className="flex h-full flex-col px-4 py-6">
        <div className="flex flex-1 flex-col gap-1">
          {NAV_GROUPS.map((group) => (
            <div key={group.group} className="mt-5 flex flex-col gap-1 first:mt-0">
              <span className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/35">
                {group.group}
              </span>
              {group.items.map((item) => {
                const isActive = isActiveRoute(item.href, pathname)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    {...(onNavClick ? { onClick: onNavClick } : {})}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      NAV_ITEM_BASE_CLASS,
                      isActive ? NAV_ITEM_ACTIVE_CLASS : NAV_ITEM_INACTIVE_CLASS,
                    )}
                  >
                    <Icon
                      className={cn(
                        ICON_BASE_CLASS,
                        isActive ? ICON_ACTIVE_CLASS : ICON_INACTIVE_CLASS,
                      )}
                    />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer: read-only namespace prefix (one namespace per module instance). */}
        <div className="mt-6 border-t border-white/8 pt-4">
          <span className="inline-flex items-center rounded-md border border-white/10 bg-white/4 px-2 py-1 font-mono text-xs text-white/55">
            ns: {APP_NAMESPACE}
          </span>
        </div>
      </div>
    </nav>
  )
}
