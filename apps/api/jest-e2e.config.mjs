/**
 * Jest configuration for the API E2E + fast specs.
 *
 * ESM-native: specs and the app source are pure ESM (`"type": "module"`,
 * `NodeNext`), so Jest runs under `node --experimental-vm-modules` and ts-jest
 * transpiles every `.ts` to ESM (`useESM: true`). The `moduleNameMapper` rewrites
 * the explicit `.js` import specifiers the source uses (NodeNext requires them)
 * back to the on-disk `.ts` files Jest resolves.
 *
 * This is the example-app testing bar (see docs/DEVELOPMENT_PLAN.md Appendix C):
 * a focused, high-signal E2E smoke against a genuine Redis (Testcontainers) that
 * doubles as integration coverage for the published `@bymax-one/nest-cache`.
 * Deliberately carries NO coverage gate and NO mutation testing — those quality
 * gates belong to the library itself, not to this reference app.
 *
 * @type {import('jest').Config}
 */
export default {
  rootDir: 'test',
  // Both tiers run through one config: real-Redis `*.e2e-spec.ts` (Testcontainers)
  // and Docker-free `*.spec.ts` (ioredis-mock fast lane).
  testMatch: ['**/*.e2e-spec.ts', '**/*.spec.ts'],
  testEnvironment: 'node',
  // Container boot dominates `beforeAll`: each real-Redis spec starts a fresh
  // redis:7-alpine. This must exceed the container's own 120s startup timeout
  // (redis-container.ts) — plus headroom for a cold image pull — or `beforeAll`
  // times out before Testcontainers would have reported the container ready.
  testTimeout: 150_000,
  moduleFileExtensions: ['ts', 'js', 'mjs', 'cjs', 'json'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: '<rootDir>/../tsconfig.json' }],
  },
  // NodeNext source imports siblings as `./foo.js`; map the `.js` specifier back to
  // the `.ts` source so Jest resolves the file it actually transpiles.
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  clearMocks: true,
  restoreMocks: true,
  // Testcontainers (dockerode) and ioredis keep native handles that async_hooks
  // cannot always drain; force a clean exit so a green run never prints a worker
  // warning. Scoped to this suite only — there is no separate unit runner here.
  forceExit: true,
}
