/**
 * @fileoverview `usePlaygroundOp` — the shared op runner every Playground card uses.
 * It fires a typed `ApiResult` call, keeps the last outcome for inline display, and
 * toasts the operation with a **View in Explorer →** action that deep-links to the
 * resulting key's pre-filtered Explorer view. Errors toast their structured message.
 *
 * @module components/playground/use-playground-op
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { type ApiResult } from '@/lib/api-client'

/** The last successful operation outcome shown inline on the card. */
export interface OpOutcome {
  /** The operation label (e.g. `get`). */
  label: string
  /** The decoded result value. */
  value: unknown
  /** The resulting `KeyBuilder` key, when the op targets one key. */
  resultingKey?: string
}

/** Arguments to {@link PlaygroundOpApi.runOp}. */
export interface RunOpArgs<T> {
  /** Operation label for the toast + inline result. */
  label: string
  /** The typed transport call to run. */
  run: () => Promise<ApiResult<T>>
  /** The resulting key to display (and link in the Explorer). */
  resultingKey?: string
  /** The Explorer deep-link offered in the toast action. */
  explorerHref?: string
}

/** The op-runner surface returned by {@link usePlaygroundOp}. */
export interface PlaygroundOpApi {
  /** The last successful outcome (or `null`). */
  outcome: OpOutcome | null
  /** Whether an op is in flight. */
  isPending: boolean
  /** Fire a typed op, toasting the result with a View-in-Explorer action. */
  runOp: <T>(args: RunOpArgs<T>) => Promise<void>
}

/**
 * Hook providing the shared Playground op runner.
 *
 * @returns The `{ outcome, isPending, runOp }` surface.
 */
export function usePlaygroundOp(): PlaygroundOpApi {
  const router = useRouter()
  const [outcome, setOutcome] = useState<OpOutcome | null>(null)
  const [isPending, setIsPending] = useState(false)

  const runOp = async <T>({
    label,
    run,
    resultingKey,
    explorerHref,
  }: RunOpArgs<T>): Promise<void> => {
    setIsPending(true)
    try {
      const result = await run()
      if (!result.ok) {
        toast.error(`${label} failed`, { description: result.error.message })
        return
      }
      setOutcome({ label, value: result.data, ...(resultingKey ? { resultingKey } : {}) })
      toast.success(label, {
        ...(resultingKey ? { description: resultingKey } : {}),
        ...(explorerHref
          ? { action: { label: 'View in Explorer →', onClick: () => router.push(explorerHref) } }
          : {}),
      })
    } catch {
      // The transport rejects only on a network-layer failure (the structured API
      // error is returned, not thrown); surface it and always clear the pending flag.
      toast.error(`${label} failed`, { description: 'Network error' })
    } finally {
      setIsPending(false)
    }
  }

  return { outcome, isPending, runOp }
}
