/**
 * @fileoverview `KeyDetailDrawer` — the Explorer's value inspector. Opens on row
 * click as a right-anchored sheet with four tabs: **Value** (the decoded value as a
 * `@uiw/react-json-view` tree), **Raw** (the raw stored string — the serializer
 * story), **TTL** (a live countdown ring plus Extend +60s / Persist ∞), and
 * **Metadata** (type, encoding, byte size, composed key segments). Row actions —
 * copy key, copy value, refresh, delete, persist — invalidate the relevant queries
 * on success and toast the result.
 *
 * @module components/explorer/KeyDetailDrawer
 */

'use client'

import { toast } from 'sonner'
import { Copy, Infinity as InfinityIcon, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { JsonTree } from '@/components/ui/json-tree'
import { TtlRing } from './TtlRing'
import { useKeyInspect } from '@/hooks/use-key-inspect'
import { useDeleteKey, useExpireKey, usePersistKey } from '@/hooks/use-cache-mutations'
import { formatBytes } from '@/lib/format'

/** Props for {@link KeyDetailDrawer}. */
export interface KeyDetailDrawerProps {
  /** The selected key, or `null` when the drawer is closed. */
  keyName: string | null
  /** Called when the drawer requests to close. */
  onClose: () => void
}

/** Seconds added to the current TTL by the Extend action. */
const EXTEND_SECONDS = 60

/** Copy text to the clipboard and toast the outcome. */
async function copy(text: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${label} copied`)
  } catch {
    toast.error(`Could not copy ${label.toLowerCase()}`)
  }
}

/** A labelled metadata row. */
function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-(--glass-border) py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-mono">{children}</span>
    </div>
  )
}

/**
 * The tabbed key detail drawer with inline actions.
 *
 * @param props - The selected key and the close handler.
 * @returns The drawer sheet.
 */
export function KeyDetailDrawer({ keyName, onClose }: KeyDetailDrawerProps) {
  const isOpen = keyName !== null
  const query = useKeyInspect(keyName ?? '', isOpen)
  const deleteKey = useDeleteKey()
  const persistKey = usePersistKey()
  const expireKey = useExpireKey()

  const result = query.data
  const inspect = result?.ok ? result.data : null
  const segments = keyName ? keyName.split(':') : []

  const handleDelete = () => {
    if (!keyName) return
    deleteKey.mutate(keyName, {
      onSuccess: (res) => {
        toast.success(res.deleted > 0 ? `Deleted ${keyName}` : 'Key already gone')
        onClose()
      },
      onError: (error) => toast.error(error.message),
    })
  }

  const handlePersist = () => {
    if (!keyName) return
    persistKey.mutate(keyName, {
      onSuccess: () => toast.success('TTL removed — key is now persistent'),
      onError: (error) => toast.error(error.message),
    })
  }

  const handleExtend = () => {
    if (!keyName) return
    const current = inspect?.ttl ?? -1
    const next = current > 0 ? current + EXTEND_SECONDS : EXTEND_SECONDS
    expireKey.mutate(
      { key: keyName, seconds: next },
      {
        onSuccess: () => toast.success(`TTL set to ${next}s`),
        onError: (error) => toast.error(error.message),
      },
    )
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="break-all text-sm">{keyName}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => keyName && void copy(keyName, 'Key')}
          >
            <Copy aria-hidden="true" />
            Copy key
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!inspect}
            onClick={() => inspect && void copy(JSON.stringify(inspect.value), 'Value')}
          >
            <Copy aria-hidden="true" />
            Copy value
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            <RefreshCw aria-hidden="true" />
            Refresh
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={persistKey.isPending}
            onClick={handlePersist}
          >
            <InfinityIcon aria-hidden="true" />
            Persist
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={deleteKey.isPending}
            onClick={handleDelete}
          >
            <Trash2 aria-hidden="true" />
            Delete
          </Button>
        </div>

        {query.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : result && !result.ok ? (
          <p className="text-sm text-destructive">{result.error.message}</p>
        ) : inspect ? (
          <Tabs defaultValue="value">
            <TabsList>
              <TabsTrigger value="value">Value</TabsTrigger>
              <TabsTrigger value="raw">Raw</TabsTrigger>
              <TabsTrigger value="ttl">TTL</TabsTrigger>
              <TabsTrigger value="metadata">Metadata</TabsTrigger>
            </TabsList>

            <TabsContent value="value">
              <JsonTree value={inspect.value} />
            </TabsContent>

            <TabsContent value="raw">
              <pre className="overflow-x-auto rounded-lg border border-(--glass-border) bg-(--glass-bg) p-3 font-mono text-xs">
                {inspect.raw ?? '— (raw string only applies to string keys)'}
              </pre>
            </TabsContent>

            <TabsContent value="ttl" className="space-y-4">
              <div className="flex items-center gap-4">
                <TtlRing ttlSeconds={inspect.ttl} size={64} strokeWidth={5} countdown showLabel />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={expireKey.isPending}
                  onClick={handleExtend}
                >
                  <Plus aria-hidden="true" />
                  Extend +60s
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={persistKey.isPending}
                  onClick={handlePersist}
                >
                  <InfinityIcon aria-hidden="true" />
                  Persist ∞
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="metadata">
              <div className="rounded-lg border border-(--glass-border) bg-(--glass-bg) px-3">
                <MetaRow label="Type">{inspect.type}</MetaRow>
                <MetaRow label="Encoding">—</MetaRow>
                <MetaRow label="Byte size">{formatBytes(inspect.memoryBytes)}</MetaRow>
                <MetaRow label="Segments">
                  <span className="flex flex-wrap justify-end gap-1">
                    {segments.map((segment, index) => (
                      <span
                        key={`${segment}-${index}`}
                        className="rounded bg-(--glass-bg-raised) px-1.5 py-0.5 text-xs"
                      >
                        {segment}
                      </span>
                    ))}
                  </span>
                </MetaRow>
              </div>
            </TabsContent>
          </Tabs>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
