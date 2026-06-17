/**
 * @fileoverview Next.js configuration for apps/web.
 *
 * Security headers are applied globally. The CSP allows same-origin resources
 * and permits `unsafe-inline` for RSC streaming / React hydration — tighten to
 * nonce-based once the data layer is fully wired. The dashboard talks to the
 * NestJS API over REST (`NEXT_PUBLIC_API_URL`) and receives live cache events
 * over a socket.io WebSocket (`NEXT_PUBLIC_WS_URL`), so both the HTTP origin and
 * its `ws`/`wss` variants must appear in `connect-src`. `frame-ancestors 'none'`
 * blocks clickjacking; HSTS is enabled in production only.
 *
 * Linting is centralized at the workspace root (`eslint .`); Next 16 no longer
 * runs ESLint during the build, so no per-build lint configuration is needed.
 *
 * @module next.config
 */

import path from 'node:path'
import process from 'node:process'

const isProduction = process.env['NODE_ENV'] === 'production'

const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'
const wsBase = process.env['NEXT_PUBLIC_WS_URL'] ?? 'http://localhost:3001'

/**
 * Derive the bare origin from a URL string, returning `''` when it cannot be parsed.
 *
 * @param {string} value - A candidate absolute URL.
 * @returns {string} The origin (scheme + host + port) or an empty string.
 */
function originOf(value) {
  try {
    return new URL(value).origin
  } catch {
    return ''
  }
}

const apiOrigin = originOf(apiBase)
const wsHttpOrigin = originOf(wsBase)
// socket.io upgrades to a raw WebSocket, so the ws(s):// origin must also be allowed.
const wsOrigin = wsHttpOrigin.replace(/^http/, 'ws')

// De-duplicate: when the API and WS URLs share an origin the HTTP entry would repeat.
const connectSrc = [...new Set(["'self'", apiOrigin, wsHttpOrigin, wsOrigin].filter(Boolean))].join(
  ' ',
)

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Do not advertise the framework — drops the `X-Powered-By: Next.js` response header.
  poweredByHeader: false,
  // Emit a self-contained server bundle so the production image ships only the
  // traced runtime. `outputFileTracingRoot` points at the monorepo root so
  // pnpm's workspace dependencies are traced into the standalone output.
  output: 'standalone',
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data:",
              "font-src 'self'",
              `connect-src ${connectSrc}`,
              "frame-ancestors 'none'",
            ].join('; '),
          },
          ...(isProduction
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
            : []),
        ],
      },
    ]
  },
}

export default nextConfig
