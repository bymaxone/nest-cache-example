/**
 * @fileoverview Unit test for the shared dashboard constants.
 *
 * Pins `APP_NAMESPACE` to the single cache namespace the library binds this app
 * to (shown read-only in the UI), so an accidental rename is caught.
 *
 * @module lib/constants.test
 */
import { describe, it, expect } from 'vitest'
import { APP_NAMESPACE } from './constants'

describe('APP_NAMESPACE', () => {
  it('is the fixed cache-example namespace', () => {
    /*
     * Scenario: a page renders the read-only namespace badge.
     * Rule it protects: the namespace is fixed to `cache-example` (one namespace
     * per module instance), so the value must not drift.
     */
    expect(APP_NAMESPACE).toBe('cache-example')
  })
})
