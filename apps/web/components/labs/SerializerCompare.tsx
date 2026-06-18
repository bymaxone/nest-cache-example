/**
 * @fileoverview `SerializerCompare` — the side-by-side panel contrasting the raw
 * stored bytes (`getRaw`) with the decoded value (`get`) for a serializer
 * round-trip (DASHBOARD §12). The raw column shows the exact stored string (mono,
 * wrapping) with its byte count — for a binary codec like MessagePack this is the
 * base64 form, typically smaller than the equivalent JSON string. The decoded
 * column renders the value as a collapsible JSON tree.
 *
 * @module components/labs/SerializerCompare
 */

'use client'

import { JsonTree } from '@/components/ui/json-tree'
import { formatBytes } from '@/lib/format'

/** Props for {@link SerializerCompare}. */
export interface SerializerCompareProps {
  /** The codec label this result was tagged with. */
  codecLabel: string
  /** The raw stored string (`getRaw`); `null` when the key was evicted. */
  raw: string | null
  /** The decoded value (`get`). */
  decoded: unknown
  /** Byte length of the raw stored string. */
  rawBytes: number
}

/**
 * Render the raw-vs-decoded comparison for one codec.
 *
 * @param props - The codec label, raw string, decoded value, and byte count.
 * @returns The two-column comparison panel.
 */
export function SerializerCompare({ codecLabel, raw, decoded, rawBytes }: SerializerCompareProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            raw (getRaw) · {codecLabel}
          </p>
          <span className="font-mono text-[11px] text-brand-500">{formatBytes(rawBytes)}</span>
        </div>
        <pre className="max-h-56 overflow-auto rounded-lg border border-(--glass-border) bg-(--glass-bg) p-3 font-mono text-xs break-all whitespace-pre-wrap">
          {raw ?? '— (key evicted)'}
        </pre>
      </div>
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">decoded (get)</p>
        <JsonTree value={decoded} />
      </div>
    </div>
  )
}
