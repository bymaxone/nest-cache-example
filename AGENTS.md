# AGENTS.md — nest-cache-example

Reference application demonstrating every public export of `@bymax-one/nest-cache`, a typed Redis cache module for NestJS.

**Stack:** NestJS 11 (`apps/api`) · Next.js 16 (`apps/web`) · Redis 7 · `@bymax-one/nest-cache`

Read `docs/` first:

- `TECHNICAL_SPECIFICATION.md` — architecture, API contracts, feature matrix
- `DEVELOPMENT_PLAN.md` — phased roadmap, conventions, and quality gates
- `DASHBOARD.md` — web dashboard page inventory and design spec
- `docs/tasks/phase-NN-*.md` — per-phase task files (authoritative source for in-progress work)

## Non-negotiables

- **English only** — all identifiers, comments, JSDoc, and commit messages must be in English.
- **Conventional Commits** — format enforced by commitlint; scopes: `api | web | cache | docker | deps | docs | config`.
- **No Swagger** — REST contracts are JSDoc on controllers; request/response shapes are Zod schemas.
- **No `@ts-ignore` / `eslint-disable` / suppression comments** — fix the root cause.
- **No `--no-verify`** — never skip the pre-commit (lint-staged) or commit-msg (commitlint) hooks.
- **Design system verbatim** — `apps/web` uses the shared Bymax design tokens, fonts, and shell without alteration; reference `docs/design_system.html`.
- **TypeScript strict** — `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`; zero `any`.
