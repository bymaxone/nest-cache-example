/**
 * @fileoverview Root App Router layout — loads the Geist Sans/Mono fonts as CSS
 * variables and forces the design system's dark theme by hard-coding the `dark`
 * class on `<html>` (no theme-switching library; the `.dark` token set in
 * `globals.css` is the only live one). All client providers live in `<Providers>`,
 * keeping this layout a Server Component. `suppressHydrationWarning` guards
 * against mismatches from the statically injected font-variable class names and
 * the hard-coded `dark` class.
 *
 * @module app/layout
 */

import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'nest-cache-example',
  description: 'Cache Observability & Control Console for @bymax-one/nest-cache.',
}

/**
 * Root App Router layout — Geist fonts, forced `dark` class, and the client
 * provider boundary.
 *
 * @param props - Layout props.
 * @param props.children - Page or nested layout subtree.
 * @returns The full HTML document shell.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} dark`}
      // The global `scroll-behavior: smooth` is opted into for the Next router so
      // it can suppress smooth scrolling during route transitions.
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
