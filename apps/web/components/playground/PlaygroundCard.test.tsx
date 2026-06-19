/**
 * @fileoverview Unit tests for {@link PlaygroundCard} — the shared glass shell each
 * data-structure card composes.
 *
 * Drives the `OpValue` object→JSON-tree vs scalar→badge fork (including the
 * `JSON.stringify(value) ?? 'undefined'` fallback), the optional `note`, the
 * outcome present/absent fork, and the `resultingKey` + `explorerHref` link
 * branches. The `next/link` and `json-tree` dependencies render for real.
 *
 * @module components/playground/PlaygroundCard.test
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { PlaygroundCard } from './PlaygroundCard'
import { type OpOutcome } from './use-playground-op'

afterEach(cleanup)

describe('PlaygroundCard', () => {
  it('renders the title, ops line, and children but no outcome panel when outcome is null', () => {
    /*
     * Scenario: a freshly-rendered card before any op has run.
     * Rule it protects: the header + controls render, and the `outcome ?` branch
     * skips the entire result panel (no "result" label).
     */
    render(
      <PlaygroundCard title="Strings" ops="setNx · get" outcome={null}>
        <button type="button">setNx</button>
      </PlaygroundCard>,
    )
    expect(screen.getByText('Strings')).toBeInTheDocument()
    expect(screen.getByText('setNx · get')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'setNx' })).toBeInTheDocument()
    expect(screen.queryByText(/result$/)).not.toBeInTheDocument()
  })

  it('renders the optional note when provided', () => {
    /*
     * Scenario: a card with an honest-scope note.
     * Rule it protects: the `note ?` branch renders the note paragraph.
     */
    render(
      <PlaygroundCard title="Sets" ops="sadd" note="Raw string members." outcome={null}>
        <span>controls</span>
      </PlaygroundCard>,
    )
    expect(screen.getByText('Raw string members.')).toBeInTheDocument()
  })

  it('renders a scalar outcome as a badge with its label, resulting key, and Explorer link', () => {
    /*
     * Scenario: a successful scalar op (e.g. incr → 7) with a key and Explorer href.
     * Rule it protects: a primitive value renders as a stringified badge; the
     * `resultingKey` and `explorerHref` branches both render their rows.
     */
    const outcome: OpOutcome = { label: 'incr', value: 7, resultingKey: 'cache-example:views:p1' }
    render(
      <PlaygroundCard
        title="Numerics"
        ops="incr"
        outcome={outcome}
        explorerHref="/explorer?prefix=views"
      >
        <span>controls</span>
      </PlaygroundCard>,
    )
    expect(screen.getByText('incr result')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('cache-example:views:p1')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'View in Explorer →' })
    expect(link).toHaveAttribute('href', '/explorer?prefix=views')
  })

  it('renders an object outcome as a JSON tree', () => {
    /*
     * Scenario: a successful op returning an object (e.g. hgetall).
     * Rule it protects: the `typeof value === 'object'` branch of `OpValue` renders
     * the JSON tree rather than a scalar badge — the object's fields are visible.
     */
    const outcome: OpOutcome = { label: 'hgetall', value: { sku_1: { quantity: 2 } } }
    const { container } = render(
      <PlaygroundCard title="Hashes" ops="hgetall" outcome={outcome}>
        <span>controls</span>
      </PlaygroundCard>,
    )
    expect(screen.getByText('hgetall result')).toBeInTheDocument()
    // The JSON viewer splits the key across nodes; assert the rendered field name
    // appears somewhere in the tree rather than as a single exact-text node.
    expect(container.textContent).toContain('sku_1')
  })

  it('renders the undefined fallback badge for an undefined scalar value', () => {
    /*
     * Scenario: an op whose decoded value is `undefined`.
     * Rule it protects: `JSON.stringify(undefined)` is `undefined`, so the badge falls
     * back to the literal text "undefined" via the `?? 'undefined'` guard.
     */
    const outcome: OpOutcome = { label: 'get', value: undefined }
    render(
      <PlaygroundCard title="Strings" ops="get" outcome={outcome}>
        <span>controls</span>
      </PlaygroundCard>,
    )
    expect(screen.getByText('undefined')).toBeInTheDocument()
  })

  it('omits the resulting-key row and Explorer link when neither is provided', () => {
    /*
     * Scenario: an outcome with no key and the card has no Explorer href.
     * Rule it protects: the `resultingKey ?` and `explorerHref ?` branches both
     * render nothing, so no "resulting key" row or link appears.
     */
    const outcome: OpOutcome = { label: 'sismember', value: false }
    render(
      <PlaygroundCard title="Sets" ops="sismember" outcome={outcome}>
        <span>controls</span>
      </PlaygroundCard>,
    )
    expect(screen.getByText('false')).toBeInTheDocument()
    expect(screen.queryByText(/resulting key/)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'View in Explorer →' })).not.toBeInTheDocument()
  })
})
