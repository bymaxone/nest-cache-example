/**
 * @fileoverview Read-only namespace chip. The library binds one `namespace` per
 * module instance, so this chip displays the prefix (`ns: cache-example`) but
 * never switches it — multi-tenancy is prefix scoping (see `TenantSwitcher`),
 * not namespace switching. A tooltip explains the distinction.
 *
 * @module components/controls/NamespaceChip
 */

'use client'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { APP_NAMESPACE } from '@/lib/constants'

/** Read-only mono chip showing the bound namespace prefix. */
export function NamespaceChip() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className="inline-flex h-8 cursor-default items-center rounded-full border border-(--glass-border) px-3 font-mono text-xs text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            ns: {APP_NAMESPACE}
          </span>
        </TooltipTrigger>
        <TooltipContent>One namespace per module instance; tenants are prefixes.</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
