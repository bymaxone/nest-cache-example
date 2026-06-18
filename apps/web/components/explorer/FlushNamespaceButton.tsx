/**
 * @fileoverview `FlushNamespaceButton` — the guarded page-header action that flushes
 * the whole `cache-example:` namespace. It confirms first (destructive), then calls
 * `DELETE /admin/namespace`. When the API runs in production the library returns
 * `403 cache.flush_disabled_in_production`; that structured error is rendered inline
 * with the severity palette (color + icon + text), not swallowed.
 *
 * @module components/explorer/FlushNamespaceButton
 */

'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useFlushNamespace } from '@/hooks/use-cache-mutations'
import { ApiRequestError } from '@/lib/cache-api'
import { httpErrorSeverityMeta } from '@/lib/cache-status'
import { APP_NAMESPACE } from '@/lib/constants'

/**
 * Guarded namespace-flush button with confirmation and structured-error display.
 *
 * @returns The flush trigger and its confirmation dialog.
 */
export function FlushNamespaceButton() {
  const [isOpen, setIsOpen] = useState(false)
  const flush = useFlushNamespace()
  const apiError = flush.error instanceof ApiRequestError ? flush.error.apiError : null
  const severity = apiError ? httpErrorSeverityMeta(apiError.status) : null

  const handleConfirm = () => {
    flush.mutate(undefined, {
      onSuccess: (result) => {
        toast.success(`Flushed ${result.flushed} keys from ${APP_NAMESPACE}`)
        setIsOpen(false)
      },
      // On error keep the dialog open so the structured guard message stays visible.
    })
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open)
        if (!open) flush.reset()
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="destructive" size="sm">
          <Trash2 aria-hidden="true" />
          Flush namespace
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Flush namespace</DialogTitle>
          <DialogDescription>
            This deletes every key under{' '}
            <span className="font-mono text-foreground">{APP_NAMESPACE}:*</span>. Keys in other
            namespaces are left intact. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {apiError && severity ? (
          <div
            className="space-y-1 rounded-lg border p-3 text-sm"
            style={{ borderColor: severity.color }}
            role="alert"
          >
            <span
              className="flex items-center gap-1.5 font-medium"
              style={{ color: severity.color }}
            >
              <severity.icon aria-hidden="true" className="h-4 w-4" />
              {severity.label} · {apiError.status}
            </span>
            <p className="font-mono text-xs text-muted-foreground">{apiError.code}</p>
            <p className="text-muted-foreground">{apiError.message}</p>
          </div>
        ) : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={flush.isPending}
            onClick={handleConfirm}
          >
            {flush.isPending ? 'Flushing…' : 'Flush'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
