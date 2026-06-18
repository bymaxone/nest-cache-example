/**
 * @fileoverview `FilterRail` — the Explorer's left rail of facets: a key-prefix
 * filter (free text plus quick chips for the demo prefixes), a single-select
 * data-type facet (string/hash/set), and a has-TTL toggle. Every facet is a
 * controlled prop bound by the page to a `nuqs` URL param, so the filtered view is
 * a shareable deep-link.
 *
 * @module components/explorer/FilterRail
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { KEY_TYPES, type KeyTypeFacet } from '@/lib/filters'
import { dataTypeMeta } from '@/lib/cache-status'
import { cn } from '@/lib/utils'

/** Quick-pick chips for the demo domain's entity prefixes. */
const DEMO_PREFIXES = ['product', 'cart', 'tags'] as const

/** Props for {@link FilterRail}. */
export interface FilterRailProps {
  /** Active prefix filter (empty = all prefixes). */
  prefix: string
  /** Called with the new prefix. */
  onPrefixChange: (prefix: string) => void
  /** Active data-type facet (`null` = all types). */
  type: KeyTypeFacet | null
  /** Called with the new type facet (`null` clears it). */
  onTypeChange: (type: KeyTypeFacet | null) => void
  /** Whether the has-TTL facet is active. */
  hasTtl: boolean
  /** Called with the new has-TTL state. */
  onHasTtlChange: (hasTtl: boolean) => void
}

/**
 * The Explorer filter rail.
 *
 * @param props - The controlled facet values and their change handlers.
 * @returns The composed rail card.
 */
export function FilterRail({
  prefix,
  onPrefixChange,
  type,
  onTypeChange,
  hasTtl,
  onHasTtlChange,
}: FilterRailProps) {
  return (
    <Card className="h-fit">
      <CardHeader accent>
        <CardTitle className="text-base">Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="prefix-filter" className="text-xs uppercase tracking-wide">
            Prefix
          </Label>
          <Input
            id="prefix-filter"
            value={prefix}
            placeholder="e.g. product"
            onChange={(event) => onPrefixChange(event.target.value)}
            className="font-mono"
          />
          <div className="flex flex-wrap gap-1.5">
            {DEMO_PREFIXES.map((option) => (
              <Button
                key={option}
                type="button"
                size="sm"
                variant={prefix === option ? 'default' : 'outline'}
                onClick={() => onPrefixChange(prefix === option ? '' : option)}
                className="font-mono"
              >
                {option}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Type</span>
          <div className="flex flex-wrap gap-1.5">
            {KEY_TYPES.map((option) => {
              const meta = dataTypeMeta(option)
              const isActive = type === option
              const Icon = meta.icon
              return (
                <Button
                  key={option}
                  type="button"
                  size="sm"
                  variant={isActive ? 'default' : 'outline'}
                  onClick={() => onTypeChange(isActive ? null : option)}
                  className="font-mono"
                >
                  <Icon
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                    style={isActive ? undefined : { color: meta.color }}
                  />
                  {meta.label}
                </Button>
              )
            })}
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">TTL</span>
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={hasTtl ? 'default' : 'outline'}
              aria-pressed={hasTtl}
              onClick={() => onHasTtlChange(!hasTtl)}
              className={cn('font-mono')}
            >
              Has TTL
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
