/**
 * @fileoverview Fixed 64px dark-glass top bar — brand identity + global controls.
 *
 * Shows the orange-bordered stacked-layers brand mark and the gradient
 * `nest-cache-example` wordmark on the left. The right cluster renders the
 * `right` slot (the global controls, wired by the controls module) plus a
 * hamburger that toggles the mobile sidebar overlay. It takes no client state of
 * its own — the mobile toggle handler is supplied by `AppShell`.
 *
 * @module components/layout/Topbar
 */

import type { ReactNode } from 'react'
import { Menu } from 'lucide-react'

interface TopbarProps {
  /** Global controls rendered in the top-right cluster (desktop only). */
  right?: ReactNode
  /** Called when the hamburger is pressed to open the mobile sidebar. */
  onMenuOpen?: () => void
}

/** Fixed 64px dark-glass top bar — brand identity (left) + controls slot (right). */
export function Topbar({ right, onMenuOpen }: TopbarProps) {
  return (
    <header className="fixed left-0 right-0 top-0 z-200 flex h-16 items-center justify-between border-b border-white/7 bg-black/85 px-4 backdrop-blur-md lg:px-6">
      {/* ── Left: brand mark + wordmark ── */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-brand-500/40 bg-brand-500/15"
          aria-hidden="true"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5"
              stroke="var(--color-brand-500)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span className="select-none bg-linear-to-r from-brand-500 to-amber-200 bg-clip-text font-mono text-sm font-bold leading-tight text-transparent">
          nest-cache-example
        </span>
      </div>

      {/* ── Right: global controls (desktop) + hamburger (mobile) ── */}
      <div className="flex items-center gap-2">
        {right ? <div className="hidden items-center gap-2 md:flex">{right}</div> : null}
        <button
          type="button"
          aria-label="Open navigation menu"
          onClick={onMenuOpen}
          className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/5 lg:hidden"
        >
          <Menu className="h-4 w-4 text-white/70" />
        </button>
      </div>
    </header>
  )
}
