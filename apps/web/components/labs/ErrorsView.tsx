/**
 * @fileoverview `ErrorsView` — the interactive body of the Error Explorer
 * (DASHBOARD §13). Lists all 15 `CACHE_ERROR_CODES` (imported from the library's
 * `/shared` subpath — never hard-coded), each with a {@link ErrorTrigger} firing
 * `POST /errors/:code`, and a response panel showing the HTTP status, the
 * structured `{ error: { code, message, details } }` body, and the canonical
 * message read **from the response body** (never from a server-only import). A
 * prod-guard toggle documents the live `flushNamespace` 403 guard.
 *
 * @module components/labs/ErrorsView
 */

'use client'

import { useState } from 'react'
import { CACHE_ERROR_CODES, type CacheErrorCode } from '@bymax-one/nest-cache/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorTrigger } from './ErrorTrigger'
import { JsonTree } from '@/components/ui/json-tree'
import { errorsApi, ERROR_CODES } from '@/lib/labs-api'
import { type ApiError } from '@/lib/api-client'
import { httpErrorSeverityMeta } from '@/lib/cache-status'
import { cn } from '@/lib/utils'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

/**
 * Canonical code → HTTP status, keyed by the imported `/shared` codes so the
 * compiler enforces exhaustiveness — a new library code without an entry here is a
 * type error. Mirrors the canonical table in TECHNICAL_SPECIFICATION.md §19.2 and
 * lets each row be colored by severity before it is triggered.
 */
const CODE_HTTP_STATUS: Record<CacheErrorCode, number> = {
  [CACHE_ERROR_CODES.CONNECTION_FAILED]: 500,
  [CACHE_ERROR_CODES.COMMAND_TIMEOUT]: 504,
  [CACHE_ERROR_CODES.CONNECTION_LOST]: 503,
  [CACHE_ERROR_CODES.SERIALIZATION_FAILED]: 500,
  [CACHE_ERROR_CODES.DESERIALIZATION_FAILED]: 500,
  [CACHE_ERROR_CODES.INVALID_NAMESPACE]: 500,
  [CACHE_ERROR_CODES.INVALID_KEY]: 400,
  [CACHE_ERROR_CODES.SCRIPT_NOT_REGISTERED]: 500,
  [CACHE_ERROR_CODES.SCRIPT_EXECUTION_FAILED]: 500,
  [CACHE_ERROR_CODES.SCRIPT_REGISTRY_MISSING]: 500,
  [CACHE_ERROR_CODES.FLUSH_DISABLED_IN_PRODUCTION]: 403,
  [CACHE_ERROR_CODES.CLUSTER_MISCONFIGURED]: 500,
  [CACHE_ERROR_CODES.SENTINEL_MISCONFIGURED]: 500,
  [CACHE_ERROR_CODES.SHUTDOWN_TIMEOUT]: 500,
  [CACHE_ERROR_CODES.UNSUPPORTED_IN_CLUSTER]: 500,
}

/**
 * The Error Explorer page body.
 *
 * @returns The trigger list, the response panel, and the prod-guard toggle.
 */
export function ErrorsView() {
  const [isProdGuard, setIsProdGuard] = useState(false)

  const trigger = useMutation<ApiError, Error, CacheErrorCode>({
    mutationFn: async (code: CacheErrorCode) => {
      const result = await errorsApi.trigger(code)
      // The endpoint always errors by contract; an `ok` response is the anomaly.
      if (result.ok) throw new Error('Expected an error response from the trigger endpoint')
      return result.error
    },
    onError: () => toast.error('Unexpected non-error response'),
  })

  const response = trigger.data
  const selectedCode = trigger.variables
  const meta = response ? httpErrorSeverityMeta(response.status) : undefined
  const ResponseIcon = meta?.icon

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader accent>
          <CardTitle className="text-base">Triggers</CardTitle>
          <p className="font-mono text-xs text-muted-foreground">
            POST /errors/:code · {ERROR_CODES.length} codes
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-1.5">
            {ERROR_CODES.map((code) => (
              <ErrorTrigger
                key={code}
                code={code}
                httpStatus={CODE_HTTP_STATUS[code]}
                isPending={trigger.isPending && selectedCode === code}
                isSelected={selectedCode === code}
                onTrigger={() => trigger.mutate(code)}
              />
            ))}
          </ul>

          <label className="flex items-start gap-2 border-t border-(--glass-border) pt-3 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={isProdGuard}
              onChange={(event) => setIsProdGuard(event.target.checked)}
              className="mt-0.5 accent-brand-500"
            />
            <span>
              <span className="font-medium text-foreground">Run API as NODE_ENV=production.</span>{' '}
              The live <span className="font-mono text-foreground">flushNamespace</span> guard
              returns{' '}
              <span className="font-mono text-foreground">
                403 cache.flush_disabled_in_production
              </span>{' '}
              in production — start the API with{' '}
              <span className="font-mono text-foreground">NODE_ENV=production</span> and call the
              admin flush to see it live. Triggering that code here surfaces the same 403 exception.
            </span>
          </label>
          {isProdGuard ? (
            <button
              type="button"
              onClick={() => trigger.mutate(CACHE_ERROR_CODES.FLUSH_DISABLED_IN_PRODUCTION)}
              className="text-xs font-medium text-brand-500 hover:underline"
            >
              Trigger the production flush guard →
            </button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader accent>
          <CardTitle className="text-base">Response</CardTitle>
        </CardHeader>
        <CardContent>
          {response && meta && ResponseIcon ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ResponseIcon
                  aria-hidden="true"
                  className="h-4 w-4"
                  style={{ color: meta.color }}
                />
                <span
                  className={cn('rounded-full px-2 py-0.5 font-mono text-xs font-semibold')}
                  style={{ color: meta.color, backgroundColor: `${meta.color}1f` }}
                >
                  HTTP {response.status}
                </span>
                <span className="text-xs text-muted-foreground">{meta.label}</span>
              </div>
              <JsonTree
                value={{
                  error: {
                    code: response.code,
                    message: response.message,
                    details: response.details ?? null,
                  },
                }}
              />
            </div>
          ) : (
            <div className="flex min-h-40 items-center justify-center rounded-2xl border border-(--glass-border) bg-(--glass-bg) p-6 text-center text-sm text-muted-foreground">
              Trigger a code on the left to see its status + structured body →
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
