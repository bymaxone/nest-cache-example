/**
 * @fileoverview Root client provider boundary. Holds the three cross-cutting
 * providers the whole dashboard needs: TanStack Query (server-state cache),
 * the nuqs adapter (mandatory in nuqs v2 — without it every `useQueryState`
 * call throws, breaking the shareable deep-link controls), and the Sonner
 * toast portal styled for the dark glass design. Kept separate from
 * `layout.tsx` so only this leaf is a Client Component.
 *
 * @module app/providers
 */

'use client'

import { type ReactNode, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { Toaster } from '@/components/ui/sonner'

/** Default query stale-time in milliseconds — balances freshness vs network chatter. */
const DEFAULT_STALE_TIME_MS = 5_000

interface ProvidersProps {
  /** Page or nested layout content rendered inside the provider tree. */
  children: ReactNode
}

/**
 * Root client provider — TanStack Query cache, the nuqs URL-state adapter, and
 * the Sonner toast portal.
 *
 * The `QueryClient` is created once per browser tab (lazy `useState` init) so it
 * survives re-renders without being recreated.
 *
 * @param props - Provider props.
 * @param props.children - The subtree to wrap.
 * @returns The provider tree enclosing `children` plus the toast portal.
 */
export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: DEFAULT_STALE_TIME_MS, refetchOnWindowFocus: false },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <NuqsAdapter>{children}</NuqsAdapter>
      <Toaster theme="dark" position="bottom-right" closeButton />
    </QueryClientProvider>
  )
}
