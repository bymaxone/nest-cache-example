/**
 * Vitest configuration for the web unit tier.
 *
 * jsdom environment + the React plugin so client modules (and the
 * `@bymax-one/nest-cache/shared` browser import) resolve exactly as they do in the
 * Next.js bundle. This is the example-app bar (docs/DEVELOPMENT_PLAN.md Appendix C):
 * a focused unit suite over `lib/`, deliberately with NO coverage thresholds — the
 * web app is held to build + happy-path smoke, not coverage.
 *
 * @module vitest.config
 */
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['lib/**/*.test.ts', 'lib/**/*.test.tsx'],
  },
})
