'use strict'

/**
 * Jest config used ONLY by Stryker's `@stryker-mutator/jest-runner`.
 *
 * Stryker re-runs the unit suite once per mutant, so this variant of the unit
 * config differs from `jest.config.cjs` in two ways:
 *  - coverage is disabled — a mutated line would otherwise falsely trip the 100%
 *    coverage gate during a mutant run,
 *  - e2e specs are excluded — supertest + Testcontainers are flaky under Stryker
 *    instrumentation; only the co-located unit specs drive mutation.
 *
 * Uses `.cjs` to match the project's established jest-config pattern
 * (`jest.config.cjs`, `jest-e2e.config.mjs`): Jest 30 needs `ts-node` to parse a
 * `.ts` config file, which is not installed in this workspace.
 *
 * @type {import('jest').Config}
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: '<rootDir>/tsconfig.spec.json',
        // Suppresses the coverage false-positive for the `__decorate(...)` wrappers
        // (mirrors `jest.config.cjs`; harmless with coverage off).
        ignoreCoverageForAllDecorators: true,
      },
    ],
  },
  // NodeNext source imports siblings as `./foo.js`; map the `.js` specifier back to
  // the `.ts` source so Jest resolves the file it actually transpiles.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  collectCoverage: false,
  clearMocks: true,
  restoreMocks: true,
  // Stryker copies the project into `.stryker-tmp`; never let Jest discover specs or
  // a stale `dist/` build inside those directories.
  modulePathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/.stryker-tmp/'],
}
