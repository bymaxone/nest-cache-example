/**
 * @fileoverview `PlaygroundCard` — the shared glass shell for each data-structure
 * card. It renders the title + the ops it exposes, an optional honest-scope note,
 * the card's controls, and the last operation outcome (a JSON tree or a scalar
 * badge) with the resulting `KeyBuilder` key and a persistent View-in-Explorer link.
 *
 * @module components/playground/PlaygroundCard
 */

'use client'

import { type ReactNode } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { JsonTree } from '@/components/ui/json-tree'
import { type OpOutcome } from './use-playground-op'

/** Props for {@link PlaygroundCard}. */
export interface PlaygroundCardProps {
  /** Card title (the data structure). */
  title: string
  /** A short list of the ops the card exposes. */
  ops: string
  /** Optional honest-scope note (e.g. raw set members). */
  note?: ReactNode
  /** The last successful op outcome to display. */
  outcome: OpOutcome | null
  /** Explorer deep-link for the persistent "View in Explorer" link. */
  explorerHref?: string
  /** The card's input/button controls. */
  children: ReactNode
}

/** Render a decoded op result: a JSON tree for objects, a scalar badge otherwise. */
function OpValue({ value }: { value: unknown }) {
  if (value !== null && typeof value === 'object') return <JsonTree value={value} />
  return (
    <Badge variant="secondary" className="font-mono">
      {JSON.stringify(value) ?? 'undefined'}
    </Badge>
  )
}

/**
 * The shared Playground card shell.
 *
 * @param props - Title/ops/note, the outcome to display, and the controls.
 * @returns The composed card.
 */
export function PlaygroundCard({
  title,
  ops,
  note,
  outcome,
  explorerHref,
  children,
}: PlaygroundCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader accent>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="font-mono text-xs text-muted-foreground">{ops}</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        {children}

        {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}

        {outcome ? (
          <div className="space-y-1.5 border-t border-(--glass-border) pt-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {outcome.label} result
            </p>
            <OpValue value={outcome.value} />
            {outcome.resultingKey ? (
              <p className="font-mono text-[11px] text-muted-foreground">
                resulting key: <span className="text-brand-500">{outcome.resultingKey}</span>
              </p>
            ) : null}
            {explorerHref ? (
              <Link
                href={explorerHref}
                className="inline-block text-xs font-medium text-brand-500 hover:underline"
              >
                View in Explorer →
              </Link>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
