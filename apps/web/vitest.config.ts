/**
 * @fileoverview Vitest configuration for the dashboard web unit tier.
 *
 * jsdom environment + the React plugin so client modules (and the
 * `@bymax-one/nest-cache/shared` browser import) resolve exactly as they do in the
 * Next.js bundle. The `@` path alias mirrors `tsconfig.json` so hook/component
 * specs import `@/…` the same way source does. v8 coverage is gated at 100% on
 * every metric over the hand-written `lib/`, `hooks/`, and `components/` surface;
 * vendored shadcn primitives (`components/ui/**`, except the two that carry real
 * logic — `chart` and `json-tree`), Next.js route shells (`app/**`), barrels, and
 * type-only files are excluded so the gate measures authored code, not glue.
 *
 * @module vitest.config
 */
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirror tsconfig `paths`: "@/*" → "./*".
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['{app,components,lib,hooks}/**/*.{test,spec}.{ts,tsx}'],
    // Bound the worker pool: each fork spins up its own jsdom + module graph (including
    // the locally-linked `@bymax-one/nest-cache` `file:` dependency), so an unbounded
    // pool multiplies that footprint and can exhaust memory on small CI runners. `'50%'`
    // stays fast on dev machines while safe (one worker on a 2-core runner).
    maxWorkers: '50%',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json-summary', 'html'],
      include: ['lib/**/*.{ts,tsx}', 'hooks/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
      // Vendored shadcn primitives are authored upstream, not here — excluded from
      // the gate, except `chart`/`json-tree` which carry hand-written logic. Route
      // shells, barrels, and type-only files carry no executable logic.
      exclude: [
        'components/ui/!(chart|json-tree).{ts,tsx}',
        '**/*.{test,spec}.{ts,tsx}',
        '**/index.ts',
        '**/types.ts',
        '**/*.types.ts',
        '**/*.d.ts',
      ],
      thresholds: { branches: 100, functions: 100, lines: 100, statements: 100 },
    },
  },
})
