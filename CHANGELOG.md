# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **CI — mutation testing gate.** Stryker mutation no longer runs on pull
  requests (PRs stay gated by 100% unit coverage + full E2E). It now runs
  post-merge on `main` and via manual `workflow_dispatch`, and only when
  application source changed (`apps/api/src`, `apps/web/lib`,
  `apps/web/components`) — so docs/config merges spend zero CI minutes on it.
  The `reports/stryker-incremental.json` state is cached across runs so only
  changed files are re-mutated. Thresholds are unchanged (api `break: 100`,
  web `break: 90`).

## [0.1.0] — 2026-07-09

### Added

- **Reference API (`apps/api`, NestJS 11)** exercising every public export of
  `@bymax-one/nest-cache` against Redis 7: read-through catalog cache + data
  structures (strings, numerics, hashes, sets, pipelines, SCAN, TTL), namespace
  isolation and prefix-scoped tenants, default JSON and custom MessagePack
  serialization, Pub/Sub with a socket.io bridge, TTL keyspace-notification
  events, Lua single-flight cache-stampede collapse, the connection-topology
  matrix (standalone / sentinel / cluster), and the Cache Admin (Explorer) backend.
- **Observability dashboard (`apps/web`, Next.js 16)** — 10 pages (Overview,
  Explorer, Playground, Tenants, Pub/Sub, TTL Live, Stampede, Serializer, Errors,
  Connection) importing only the zero-dependency `@bymax-one/nest-cache/shared`
  subpath in the browser bundle.
- **Global exception filter** mapping all 15 `CacheException` codes to their
  canonical HTTP status; **Zod DTOs** and JSDoc-documented controllers (no Swagger).
- **Export-usage audit** (`scripts/audit-library-exports.mjs`, `pnpm audit:exports`)
  enforcing that every library export is demonstrated under `apps/` or listed in
  `.audit-ignore.json` with a reason; wired as the `export-usage-check` CI job.
- **Quality bar** — 100% unit coverage (api Jest + web Vitest), E2E of every HTTP +
  WebSocket flow (Testcontainers), 18 Playwright journeys, and Stryker mutation
  testing (api 100%, web ≥90%).
- Public-facing `README.md` (endpoints table, feature-coverage summary, ASCII
  architecture, curl journeys) and the living docs under `docs/`.
