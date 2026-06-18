/**
 * @fileoverview `KeyTable` — the Explorer's virtualized key browser (TanStack Table
 * for the column model + TanStack Virtual for row windowing). The list endpoint
 * returns only key strings; each visible row lazily inspects its own key for the
 * `type` chip, the draining `TtlRing`, and the `MEMORY USAGE` size — so size is
 * fetched on demand, never for every key up front. Infinite scroll advances the
 * SCAN cursor as the viewport nears the end.
 *
 * @module components/explorer/KeyTable
 */

'use client'

import { useEffect, useRef } from 'react'
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { TtlRing } from './TtlRing'
import { useKeyInspect } from '@/hooks/use-key-inspect'
import { dataTypeMeta } from '@/lib/cache-status'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Props for {@link KeyTable}. */
export interface KeyTableProps {
  /** The de-duplicated, fully-namespaced keys to render. */
  keys: string[]
  /** When true, render skeleton rows (first load). */
  isLoading?: boolean
  /** When true, more pages exist behind the SCAN cursor. */
  hasNextPage?: boolean
  /** When true, the next page is currently loading. */
  isFetchingNextPage?: boolean
  /** Called when the viewport nears the end and another page should load. */
  onLoadMore?: () => void
  /** Called when a row is clicked (opens the detail drawer). */
  onRowClick?: (key: string) => void
  /** The currently-selected key (highlighted row). */
  selectedKey?: string | null
}

/** Fixed row height in pixels (drives virtualization math). */
const ROW_HEIGHT = 44

/** Number of skeleton rows shown during the first load. */
const SKELETON_ROWS = 8

/** Grid template shared by the header and every row. */
const GRID_COLS = 'grid grid-cols-[1fr_96px_120px_88px] items-center gap-2 px-3'

/** Lazily-inspected `type` chip for a key. */
function TypeCell({ keyName }: { keyName: string }) {
  const { data } = useKeyInspect(keyName)
  if (!data) return <Skeleton className="h-4 w-12" />
  if (!data.ok) return <span className="text-xs text-muted-foreground">—</span>
  const { type } = data.data
  if (type === 'string' || type === 'hash' || type === 'set') {
    const meta = dataTypeMeta(type)
    return (
      <Badge variant="outline" className="font-mono" style={{ color: meta.color }}>
        {type}
      </Badge>
    )
  }
  return <span className="font-mono text-xs text-muted-foreground">{type}</span>
}

/** Lazily-inspected TTL ring for a key. */
function TtlCell({ keyName }: { keyName: string }) {
  const { data } = useKeyInspect(keyName)
  if (!data) return <Skeleton className="h-4 w-16" />
  if (!data.ok) return <span className="text-xs text-muted-foreground">—</span>
  return <TtlRing ttlSeconds={data.data.ttl} showLabel />
}

/** Lazily-inspected `MEMORY USAGE` size for a key (fetched on demand). */
function SizeCell({ keyName }: { keyName: string }) {
  const { data } = useKeyInspect(keyName)
  if (!data) return <Skeleton className="h-4 w-10" />
  if (!data.ok) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <span className="font-mono text-xs tabular-nums">{formatBytes(data.data.memoryBytes)}</span>
  )
}

/** Column model: key (mono) / type chip / TTL ring / lazy size. */
const COLUMNS: Array<ColumnDef<string>> = [
  {
    id: 'key',
    header: 'Key',
    cell: ({ row }) => (
      <span className="truncate font-mono text-xs" title={row.original}>
        {row.original}
      </span>
    ),
  },
  { id: 'type', header: 'Type', cell: ({ row }) => <TypeCell keyName={row.original} /> },
  { id: 'ttl', header: 'TTL', cell: ({ row }) => <TtlCell keyName={row.original} /> },
  { id: 'size', header: 'Size', cell: ({ row }) => <SizeCell keyName={row.original} /> },
]

/**
 * Virtualized, cursor-paged key table with lazy per-row metadata.
 *
 * @param props - The keys plus paging/selection callbacks.
 * @returns The composed table.
 */
export function KeyTable({
  keys,
  isLoading = false,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
  onRowClick,
  selectedKey,
}: KeyTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const table = useReactTable({
    data: keys,
    columns: COLUMNS,
    getCoreRowModel: getCoreRowModel(),
  })
  const rows = table.getRowModel().rows

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })
  const virtualItems = rowVirtualizer.getVirtualItems()

  // Advance the SCAN cursor when the viewport reaches the end of the loaded rows.
  useEffect(() => {
    const last = virtualItems.at(-1)
    if (!last) return
    if (last.index >= rows.length - 1 && hasNextPage && !isFetchingNextPage) onLoadMore?.()
  }, [virtualItems, rows.length, hasNextPage, isFetchingNextPage, onLoadMore])

  return (
    <div className="overflow-hidden rounded-2xl border border-(--glass-border) bg-(--glass-card-bg) backdrop-blur-md">
      <div
        className={cn(
          GRID_COLS,
          'h-10 border-b border-(--glass-border) text-xs font-medium uppercase tracking-wide text-muted-foreground',
        )}
      >
        {table.getHeaderGroups()[0]?.headers.map((header) => (
          <span key={header.id}>
            {flexRender(header.column.columnDef.header, header.getContext())}
          </span>
        ))}
      </div>

      {isLoading ? (
        <div className="divide-y divide-(--glass-border)">
          {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
            <div key={index} className={cn(GRID_COLS, 'h-11')}>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-10" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-3 py-16 text-center text-sm text-muted-foreground">
          <p>No keys in this namespace yet.</p>
          <Link href="/playground" className="font-medium text-brand-500 hover:underline">
            Seed one from the Playground →
          </Link>
        </div>
      ) : (
        <div ref={scrollRef} className="max-h-[60vh] overflow-auto">
          <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
            {virtualItems.map((virtualRow) => {
              const row = rows[virtualRow.index]
              if (!row) return null
              const isSelected = selectedKey === row.original
              return (
                <button
                  type="button"
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                  className={cn(
                    GRID_COLS,
                    'absolute left-0 top-0 w-full border-b border-(--glass-border) text-left transition-colors hover:bg-(--glass-bg-hover)',
                    isSelected && 'bg-brand-500/10',
                  )}
                  style={{
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <span key={cell.id} className="min-w-0">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </span>
                  ))}
                </button>
              )
            })}
          </div>
          {isFetchingNextPage ? (
            <div className={cn(GRID_COLS, 'h-11')}>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-10" />
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
