/**
 * @fileoverview `JsonTree` — a thin isolation wrapper around `@uiw/react-json-view`
 * so the third-party dependency is touched in exactly one place. It renders objects
 * and arrays as a collapsible dark-themed tree and falls back to a plain scalar
 * display for primitives (the viewer's `value` is typed `T extends object`). Shared
 * by the Explorer detail drawer and the Playground result panels.
 *
 * @module components/ui/json-tree
 */

'use client'

import JsonView from '@uiw/react-json-view'
import { darkTheme } from '@uiw/react-json-view/dark'

// The viewer's dark theme is a plain style object passed straight to the `style` prop.
const DARK_THEME = darkTheme

/** Props for {@link JsonTree}. */
export interface JsonTreeProps {
  /** The decoded value to render (object/array → tree; primitive → scalar). */
  value: unknown
  /** Depth at which nodes start collapsed (default 2). */
  collapsed?: number
}

/**
 * Render a decoded value as a collapsible JSON tree or a scalar.
 *
 * @param props - The value and collapse depth.
 * @returns The tree (objects/arrays) or a mono scalar (primitives).
 */
export function JsonTree({ value, collapsed = 2 }: JsonTreeProps) {
  if (value === null || typeof value !== 'object') {
    return (
      <pre className="overflow-x-auto rounded-lg border border-(--glass-border) bg-(--glass-bg) p-3 font-mono text-xs">
        {JSON.stringify(value) ?? 'undefined'}
      </pre>
    )
  }
  return (
    <JsonView
      value={value}
      style={DARK_THEME}
      collapsed={collapsed}
      displayDataTypes={false}
      enableClipboard={false}
      className="rounded-lg border border-(--glass-border) bg-(--glass-bg) p-3 text-xs"
    />
  )
}
