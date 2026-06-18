/**
 * @fileoverview `PubSubView` — the interactive body of the Pub/Sub page. Composes
 * the {@link PublishCard}, the {@link SubscriptionManager}, and a live
 * {@link EventFeed} of `cache:event` messages read from the shared, receive-only
 * {@link useCacheSocket} buffer (gated by the global Live toggle). Each feed row
 * shows the timestamp, the de-namespaced channel, the payload, and — when the
 * channel matches one of the active pattern subscriptions — the matching pattern.
 *
 * @module components/realtime/PubSubView
 */

'use client'

import { useCallback, useMemo, useState } from 'react'
import { useQueryState } from 'nuqs'
import { Card, CardContent } from '@/components/ui/card'
import { PublishCard } from './PublishCard'
import { SubscriptionManager, type SubscriptionRow } from './SubscriptionManager'
import { EventFeed } from './EventFeed'
import { useCacheSocket } from '@/hooks/use-cache-socket'
import { liveParser } from '@/lib/filters'
import { type CacheEvent } from '@/lib/socket'
import { APP_NAMESPACE } from '@/lib/constants'
import { formatClock } from '@/lib/format'

/** A `cache:event` item from the live socket buffer. */
type ChannelEvent = Extract<CacheEvent, { kind: 'event' }>

/** Strip the app namespace prefix from a channel for readable display. */
function deNamespace(channel: string): string {
  const prefix = `${APP_NAMESPACE}:`
  return channel.startsWith(prefix) ? channel.slice(prefix.length) : channel
}

/**
 * Convert a Redis glob (`*`, `?`, `[...]`) to an anchored RegExp. Runs of `*` are
 * collapsed to a single wildcard so the compiled pattern cannot backtrack
 * catastrophically (a self-inflicted ReDoS guard); other regex metacharacters are
 * escaped, while Redis character classes (`[...]`) pass through. An invalid pattern
 * (e.g. an unbalanced class) compiles to a never-matching RegExp.
 */
function globToRegExp(pattern: string): RegExp {
  const body = pattern
    .replace(/\*+/g, '*')
    .replace(/[.+^${}()|\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
  try {
    return new RegExp(`^${body}$`)
  } catch {
    return /$^/
  }
}

/** A pattern subscription with its pre-compiled matcher. */
interface PatternMatcher {
  /** The original glob pattern (shown when it matches). */
  pattern: string
  /** The compiled matcher tested against de-namespaced channel names. */
  regExp: RegExp
}

/**
 * The Pub/Sub page body.
 *
 * @returns The publish + subscriptions cards over the live channel feed.
 */
export function PubSubView() {
  const [live] = useQueryState('live', liveParser)
  const buffer = useCacheSocket(live)
  const [subs, setSubs] = useState<readonly SubscriptionRow[]>([])

  const handleRowsChange = useCallback((rows: readonly SubscriptionRow[]) => setSubs(rows), [])
  // Compile each active pattern once per subscription change (not once per event
  // per render), so the per-row match in the feed is a cheap pre-compiled test.
  const activeMatchers = useMemo<readonly PatternMatcher[]>(
    () =>
      subs
        .filter((row) => row.pattern)
        .map((row) => ({ pattern: row.channel, regExp: globToRegExp(row.channel) })),
    [subs],
  )

  // Newest-first view of the buffer, filtered to Pub/Sub messages. Read inline on
  // every render: `useCacheSocket` bumps its own version state on each rAF flush,
  // re-rendering this component so the in-place buffer is re-read (same pattern as
  // the StatusChip). The buffer is bounded upstream, so this stays cheap.
  const events = buffer
    .toArray()
    .filter((event): event is ChannelEvent => event.kind === 'event')
    .slice()
    .reverse()

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-2">
        <PublishCard />
        <SubscriptionManager onRowsChange={handleRowsChange} />
      </div>

      <Card>
        <CardContent className="flex gap-3 p-4 text-sm text-muted-foreground">
          <span aria-hidden="true" className="text-lg">
            🎓
          </span>
          <p>
            Channels are <span className="text-foreground">namespaced</span>:{' '}
            <span className="font-mono text-foreground">publish(&apos;product-events&apos;)</span>{' '}
            hits <span className="font-mono text-foreground">{APP_NAMESPACE}:product-events</span>.
            Both sides go through the library, so the namespace matches transparently. Open a second
            tab to watch a published message fan out to every connected client.
          </p>
        </CardContent>
      </Card>

      <EventFeed<ChannelEvent>
        items={events}
        ariaLabel="Live Pub/Sub message feed"
        getKey={(event, index) => `${event.at}-${index}`}
        emptyState={
          <span>
            No messages yet — enable the <span className="text-foreground">Live</span> toggle and
            publish a message →
          </span>
        }
        renderRow={(event) => {
          const name = deNamespace(event.channel)
          const pattern = activeMatchers.find((matcher) => matcher.regExp.test(name))?.pattern
          return (
            <div className="flex items-start gap-3 px-3 py-2 text-xs">
              <span className="shrink-0 font-mono text-muted-foreground">
                {formatClock(event.at)}
              </span>
              <span className="shrink-0 font-mono text-foreground">
                {deNamespace(event.channel)}
              </span>
              {pattern ? (
                <span className="shrink-0 font-mono text-brand-500">≈ {pattern}</span>
              ) : null}
              <span className="min-w-0 flex-1 truncate font-mono text-muted-foreground">
                {JSON.stringify(event.payload)}
              </span>
            </div>
          )
        }}
      />
    </div>
  )
}
