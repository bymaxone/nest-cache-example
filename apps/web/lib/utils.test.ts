/**
 * @fileoverview Unit tests for `cn()` — the Tailwind class-merge helper.
 *
 * Proves the two behaviours every UI primitive relies on: `clsx` truthiness
 * filtering of mixed inputs (strings/objects/arrays/falsey), and `tailwind-merge`
 * conflict resolution where a later utility in the same group wins.
 *
 * @module lib/utils.test
 */
import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('joins string, object, and array inputs, dropping falsey entries', () => {
    /*
     * Scenario: a primitive composes a base class with conditional and grouped
     * classes plus a falsey branch.
     * Rule it protects: clsx flattens every ClassValue form and omits falsey
     * values, so only the active classes survive.
     */
    const out = cn('a', { b: true, c: false }, ['d', null, undefined, 'e'])
    expect(out).toBe('a b d e')
  })

  it('resolves conflicting Tailwind utilities so the last one wins', () => {
    /*
     * Scenario: a caller overrides a default padding with a later one.
     * Rule it protects: tailwind-merge dedupes same-group utilities, keeping the
     * trailing value (`p-4`) and dropping the superseded one (`p-2`).
     */
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })
})
