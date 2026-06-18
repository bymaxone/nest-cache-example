/**
 * @fileoverview `StampedeView` — the interactive body of the Stampede Lab
 * (DASHBOARD §11). Controls for `productId` / `concurrency` / `lockMs` fire
 * `POST /stampede`; the response feeds the bespoke {@link StampedeTimeline}
 * swimlane, a result strip (origin fetches vs cache hits, hit-rate, load
 * reduction), and the registered single-flight script's resolved SHA1. A skeleton
 * shows while a burst runs; an action-oriented empty state shows before the first.
 *
 * @module components/labs/StampedeView
 */

'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Zap, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { StampedeTimeline } from './StampedeTimeline'
import { stampedeApi, type StampedeResult } from '@/lib/labs-api'
import { ApiRequestError, unwrap } from '@/lib/cache-api'
import { APP_NAMESPACE } from '@/lib/constants'
import { formatPercent } from '@/lib/format'

/** Default burst parameters (matching the API DTO defaults). */
const DEFAULTS = { productId: '77', concurrency: 10, lockMs: 2000 } as const

/** Parse a bounded integer from an input, clamping into `[min, max]` with a fallback. */
function clampInt(raw: string, min: number, max: number, fallback: number): number {
  const value = Number.parseInt(raw, 10)
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

/**
 * The Stampede Lab page body.
 *
 * @returns The controls, the swimlane timeline, the result strip, and the callout.
 */
export function StampedeView() {
  const [productId, setProductId] = useState<string>(DEFAULTS.productId)
  const [concurrency, setConcurrency] = useState(String(DEFAULTS.concurrency))
  const [lockMs, setLockMs] = useState(String(DEFAULTS.lockMs))

  const burst = useMutation<StampedeResult, Error, void>({
    mutationFn: () =>
      stampedeApi
        .run({
          productId: productId.trim(),
          concurrency: clampInt(concurrency, 1, 100, DEFAULTS.concurrency),
          lockMs: clampInt(lockMs, 50, 60_000, DEFAULTS.lockMs),
        })
        .then(unwrap),
    onSuccess: (result) =>
      toast.success('Burst complete', {
        description: `${result.summary.originFetches} origin fetch · ${result.summary.cacheHits} hits`,
      }),
    onError: (error) =>
      toast.error('Stampede failed', {
        description: error instanceof ApiRequestError ? error.apiError.message : error.message,
      }),
  })

  const result = burst.data
  const summary = result?.summary
  const reduction =
    summary && summary.originFetches > 0
      ? Math.round(summary.concurrency / summary.originFetches)
      : (summary?.concurrency ?? 0)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader accent>
          <CardTitle className="text-base">Controls</CardTitle>
          <p className="font-mono text-xs text-muted-foreground">POST /stampede</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="stampede-product" className="text-xs">
                productId
              </Label>
              <Input
                id="stampede-product"
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="stampede-concurrency" className="text-xs">
                concurrency
              </Label>
              <Input
                id="stampede-concurrency"
                type="number"
                min={1}
                max={100}
                value={concurrency}
                onChange={(event) => setConcurrency(event.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="stampede-lockms" className="text-xs">
                lockMs
              </Label>
              <Input
                id="stampede-lockms"
                type="number"
                min={50}
                max={60000}
                value={lockMs}
                onChange={(event) => setLockMs(event.target.value)}
                className="font-mono"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              size="sm"
              disabled={burst.isPending || productId.trim().length === 0}
              onClick={() => burst.mutate()}
            >
              {burst.isPending
                ? 'Firing…'
                : `Fire ${clampInt(concurrency, 1, 100, DEFAULTS.concurrency)} requests`}
            </Button>
            {result ? (
              <span className="font-mono text-xs text-muted-foreground">
                script: <span className="text-foreground">{result.script.name}</span> · sha:{' '}
                <span className="text-brand-500">{result.script.sha.slice(0, 10)}…</span>
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader accent>
          <CardTitle className="text-base">Timeline</CardTitle>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Zap aria-hidden="true" className="h-3.5 w-3.5 text-brand-500" />
              LOCK WON → origin → SET → release
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 text-(--color-success)" />
              waiter → cache HIT
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {burst.isPending ? (
            <Skeleton className="h-48 w-full" />
          ) : result ? (
            <StampedeTimeline timeline={result.timeline} />
          ) : (
            <div className="flex min-h-40 items-center justify-center rounded-2xl border border-(--glass-border) bg-(--glass-bg) p-6 text-center text-sm text-muted-foreground">
              Fire a burst above to watch N concurrent requests collapse into one origin fetch →
            </div>
          )}

          {summary ? (
            <div className="grid grid-cols-2 gap-3 border-t border-(--glass-border) pt-4 sm:grid-cols-4">
              <Metric
                label="origin fetches"
                value={`${summary.originFetches} / ${summary.concurrency}`}
              />
              <Metric label="cache hits" value={`${summary.cacheHits} / ${summary.concurrency}`} />
              <Metric label="hit rate" value={formatPercent(summary.hitRate)} />
              <Metric label="load reduction" value={`${reduction}×`} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex gap-3 p-4 text-sm text-muted-foreground">
          <span aria-hidden="true" className="text-lg">
            🎓
          </span>
          <p>
            Keys are <span className="text-foreground">namespaced by</span>{' '}
            <span className="font-mono text-foreground">eval</span> (
            <span className="font-mono text-foreground">
              {APP_NAMESPACE}:stampede:{productId || '77'}
            </span>
            ); the Lua body is declared in code as an{' '}
            <span className="font-mono text-foreground">IScriptDefinition</span>, never built from
            request input.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

/** One labelled metric in the result strip. */
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-mono text-lg font-bold">{value}</p>
    </div>
  )
}
