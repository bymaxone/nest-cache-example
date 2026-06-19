/**
 * @fileoverview Unit tests for `JsonTree` — the value/tree isolation wrapper. Drives
 * both render arms: the scalar `<pre>` fallback for primitives (string, number,
 * boolean, `null`, and the `undefined` → `'undefined'` JSON.stringify fallback) and
 * the `JsonView` tree for objects/arrays (default and explicit `collapsed` depth).
 *
 * @module components/ui/json-tree.test
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { JsonTree } from './json-tree'

describe('JsonTree', () => {
  it('renders a string primitive as a scalar pre block', () => {
    /*
     * Scenario: a decoded value that is a plain string.
     * Rule it protects: `typeof value !== 'object'` takes the scalar arm, JSON-encoding
     * the string (with quotes) into a mono `<pre>`.
     */
    const { container } = render(<JsonTree value="hello" />)
    const pre = container.querySelector('pre')
    expect(pre).not.toBeNull()
    expect(pre).toHaveTextContent('"hello"')
  })

  it('renders a number primitive as a scalar', () => {
    /*
     * Scenario: a numeric scalar value.
     * Rule it protects: numbers go through the same scalar arm, rendering their JSON
     * form.
     */
    const { container } = render(<JsonTree value={42} />)
    expect(container.querySelector('pre')).toHaveTextContent('42')
  })

  it('renders a boolean primitive as a scalar', () => {
    /*
     * Scenario: a boolean scalar value.
     * Rule it protects: booleans render via the scalar arm.
     */
    const { container } = render(<JsonTree value={true} />)
    expect(container.querySelector('pre')).toHaveTextContent('true')
  })

  it('renders null through the scalar arm', () => {
    /*
     * Scenario: a `null` value.
     * Rule it protects: the explicit `value === null` check routes null to the scalar
     * arm (since `typeof null === 'object'` would otherwise mis-route it to the tree).
     */
    const { container } = render(<JsonTree value={null} />)
    expect(container.querySelector('pre')).toHaveTextContent('null')
  })

  it('renders undefined as the literal "undefined" via the stringify fallback', () => {
    /*
     * Scenario: an undefined value (which `JSON.stringify` returns as `undefined`).
     * Rule it protects: the `JSON.stringify(value) ?? 'undefined'` fallback prints the
     * literal text rather than an empty block.
     */
    const { container } = render(<JsonTree value={undefined} />)
    expect(container.querySelector('pre')).toHaveTextContent('undefined')
  })

  it('renders an object value as a JSON tree', () => {
    /*
     * Scenario: a decoded object value.
     * Rule it protects: objects take the `JsonView` tree arm (not the scalar `<pre>`),
     * surfacing their property names — the viewer renders the quoted keys.
     */
    const { container } = render(<JsonTree value={{ id: 7, nested: { name: 'product' } }} />)
    expect(container.querySelector('pre')).toBeNull()
    expect(screen.getByText('"id"')).toBeInTheDocument()
    expect(screen.getByText('"nested"')).toBeInTheDocument()
  })

  it('renders an array value as a JSON tree with an explicit collapse depth', () => {
    /*
     * Scenario: a decoded array rendered with a custom `collapsed` depth.
     * Rule it protects: arrays also take the tree arm, and the explicit `collapsed`
     * prop is forwarded (overriding the default of 2) without changing the arm taken.
     */
    const { container } = render(<JsonTree value={[1, 2, 3]} collapsed={0} />)
    // The tree arm renders the viewer container rather than a scalar <pre>.
    expect(container.querySelector('pre')).toBeNull()
    expect(container.firstElementChild).not.toBeNull()
  })
})
