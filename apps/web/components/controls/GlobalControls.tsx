/**
 * @fileoverview Top-right global controls cluster — the read-only NamespaceChip,
 * the TenantSwitcher, the TimeRange selector, the LiveToggle, and the live
 * StatusChip, in display order. Rendered into the topbar's right slot by the
 * app shell so every page shares the same controls.
 *
 * @module components/controls/GlobalControls
 */

import { NamespaceChip } from './NamespaceChip'
import { TenantSwitcher } from './TenantSwitcher'
import { TimeRange } from './TimeRange'
import { LiveToggle } from './LiveToggle'
import { StatusChip } from './StatusChip'

/**
 * The composed global-controls cluster for the topbar. Returns a fragment, so it
 * must be rendered inside a flex container (the topbar's right slot provides the
 * `flex items-center gap-2` context).
 */
export function GlobalControls() {
  return (
    <>
      <NamespaceChip />
      <TenantSwitcher />
      <TimeRange />
      <LiveToggle />
      <StatusChip />
    </>
  )
}
