/**
 * @fileoverview `IsolationProof` — proves the namespace boundary. [Seed FOREIGN
 * namespace] writes `other-app:demo` via the raw client (the documented
 * anti-pattern); [Flush namespace & verify] runs `flushNamespace()` then asserts the
 * foreign key survived. The result line shows the `cache-example:*` keys cleared and
 * the foreign key surviving. In production the flush is guarded — the
 * `403 cache.flush_disabled_in_production` error renders with the severity palette.
 *
 * @module components/tenants/IsolationProof
 */

'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckCircle2, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { tenantsApi, unwrap, ApiRequestError } from '@/lib/cache-api'
import { httpErrorSeverityMeta } from '@/lib/cache-status'
import { KEYS_QUERY_ROOT } from '@/hooks/use-keys'
import { KEYSPACE_QUERY_ROOT } from '@/hooks/use-keyspace'
import { APP_NAMESPACE } from '@/lib/constants'

/**
 * The namespace-isolation proof band.
 *
 * @returns The seed-foreign / flush-and-verify controls plus the result panel.
 */
export function IsolationProof() {
  const queryClient = useQueryClient()

  const seedForeign = useMutation({
    mutationFn: () => tenantsApi.seedForeign().then(unwrap),
    onSuccess: (result) => toast.success(`Wrote foreign key ${result.key}`),
    onError: (error) => toast.error(error.message),
  })

  const prove = useMutation({
    mutationFn: () => tenantsApi.proveIsolation().then(unwrap),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [KEYS_QUERY_ROOT] })
      void queryClient.invalidateQueries({ queryKey: [KEYSPACE_QUERY_ROOT] })
    },
    onError: (error) => {
      // Structured API errors render inline (the guarded 403); only a network-layer
      // failure needs a toast, since it has no `apiError` to display.
      if (!(error instanceof ApiRequestError)) toast.error(error.message)
    },
  })

  const proveError = prove.error instanceof ApiRequestError ? prove.error.apiError : null
  const severity = proveError ? httpErrorSeverityMeta(proveError.status) : null

  return (
    <Card>
      <CardHeader accent>
        <CardTitle className="text-base">Isolation proof</CardTitle>
        <p className="text-xs text-muted-foreground">
          Flush clears <span className="font-mono">{APP_NAMESPACE}:*</span> but leaves keys in other
          namespaces intact.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={seedForeign.isPending}
            onClick={() => seedForeign.mutate()}
          >
            Seed FOREIGN namespace (other-app:*)
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={prove.isPending}
            onClick={() => prove.mutate()}
          >
            {prove.isPending ? 'Flushing…' : 'Flush namespace & verify'}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Seeding writes <span className="font-mono">other-app:demo</span> via raw{' '}
          <span className="font-mono">getClient()</span> — the documented anti-pattern, shown only
          to prove the boundary.
        </p>

        {prove.data ? (
          <div
            className="space-y-1 rounded-lg border p-3 text-sm"
            style={{ borderColor: '#22c55e' }}
          >
            <p className="flex items-center gap-1.5" style={{ color: '#22c55e' }}>
              <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
              Cleared {prove.data.flushedNamespaceKeys} keys under {APP_NAMESPACE}
            </p>
            <p className="flex items-center gap-1.5" style={{ color: '#22c55e' }}>
              <ShieldCheck aria-hidden="true" className="h-4 w-4" />
              other-app:demo{' '}
              {prove.data.foreignKeySurvived ? 'SURVIVED' : 'was unexpectedly removed'}
            </p>
          </div>
        ) : null}

        {proveError && severity ? (
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
              {severity.label} · {proveError.status}
            </span>
            <p className="font-mono text-xs text-muted-foreground">{proveError.code}</p>
            <p className="text-muted-foreground">{proveError.message}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
