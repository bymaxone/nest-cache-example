/**
 * Unit: LIBRARY_PROBE — the dual-subpath compile-time resolution probe.
 *
 * The probe is inert at runtime: importing it evaluates the two module-level
 * arrays (server exports + shared error codes) and freezes their counts onto the
 * exported constant. These asserts execute every top-level statement and pin the
 * counts to ground truth derived from the library itself, so a future regression
 * in the published exports map (a dropped server export, a renamed error code)
 * surfaces here rather than only at `pnpm typecheck`.
 *
 * @module library-probe.spec
 */
import { CACHE_ERROR_CODES } from '@bymax-one/nest-cache/shared'
import { LIBRARY_PROBE } from './library-probe.js'

describe('LIBRARY_PROBE (unit)', () => {
  it('counts both probed server exports', () => {
    /*
     * Scenario: read the frozen server-export count.
     * Rule it protects: the probe references exactly two server symbols
     * (`BymaxCacheModule`, `CacheService`), so the resolved count is 2 — a guard
     * that both must keep type-resolving from the `.` subpath.
     */
    expect(LIBRARY_PROBE.serverExportCount).toBe(2)
  })

  it('counts every shared error code from the library', () => {
    /*
     * Scenario: read the frozen shared-code count.
     * Rule it protects: the probe enumerates `Object.values(CACHE_ERROR_CODES)`,
     * so its count must match the live library map — derived here from the same
     * source rather than hard-coded, proving the `./shared` subpath resolves.
     */
    expect(LIBRARY_PROBE.sharedCodeCount).toBe(Object.values(CACHE_ERROR_CODES).length)
    expect(LIBRARY_PROBE.sharedCodeCount).toBeGreaterThan(0)
  })

  it('exposes a frozen, read-only shape', () => {
    /*
     * Scenario: inspect the exported constant's shape.
     * Rule it protects: `LIBRARY_PROBE` is an `as const` object exposing exactly the
     * two numeric counters — the stable contract other compile-time probes rely on.
     */
    expect(LIBRARY_PROBE).toEqual({
      serverExportCount: 2,
      sharedCodeCount: Object.values(CACHE_ERROR_CODES).length,
    })
  })
})
