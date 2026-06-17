/**
 * @fileoverview App chrome — fixed topbar + sticky sidebar + the page content
 * well. Owns the mobile sidebar open/close state. The content well defaults to
 * `max-w-5xl`, widening to `max-w-7xl` on chart-heavy pages via the `wide` prop.
 *
 * @module components/layout/AppShell
 */

'use client'

import { type ReactNode, useState } from 'react'
import { cn } from '@/lib/utils'
import { GlobalControls } from '@/components/controls/GlobalControls'
import { Topbar } from './Topbar'
import { Sidebar } from './Sidebar'

interface AppShellProps {
  /** Page content rendered inside the centered content well. */
  children: ReactNode
  /** Widen the content well to `max-w-7xl` (chart-heavy pages). */
  wide?: boolean
  /** Override for the topbar's right cluster; defaults to the global controls. */
  right?: ReactNode
}

/** App chrome — fixed topbar + sticky sidebar + the page content well. */
export function AppShell({ children, wide = false, right }: AppShellProps) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <>
      <Topbar right={right ?? <GlobalControls />} onMenuOpen={() => setIsOpen(true)} />
      <div className="flex pt-16">
        <Sidebar isOpen={isOpen} onNavClick={() => setIsOpen(false)} />
        {isOpen ? (
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setIsOpen(false)}
            className="fixed bottom-0 left-0 right-0 top-16 z-90 bg-black/50 lg:hidden"
          />
        ) : null}
        <main className="min-w-0 flex-1 px-6 py-8">
          <div className={cn('mx-auto', wide ? 'max-w-7xl' : 'max-w-5xl')}>{children}</div>
        </main>
      </div>
    </>
  )
}
