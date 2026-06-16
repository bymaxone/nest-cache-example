# CLAUDE.md — nest-cache-example

Reference application demonstrating every public export of `@bymax-one/nest-cache`, a typed Redis cache module for NestJS.

**Stack:** NestJS 11 (`apps/api`) · Next.js 16 (`apps/web`) · Redis 7 · `@bymax-one/nest-cache`

See `docs/` for full details:

- `TECHNICAL_SPECIFICATION.md` — architecture, API contracts, feature matrix
- `DEVELOPMENT_PLAN.md` — phased roadmap with conventions
- `DASHBOARD.md` — web dashboard page inventory and design spec

## Non-negotiables

- **English only** — all identifiers, comments, JSDoc, commit messages.
- **Conventional Commits** — enforced by `commitlint` + husky `commit-msg` hook.
- **No Swagger** — controllers are documented with JSDoc; DTOs are Zod schemas.
- **No `@ts-ignore` / `eslint-disable`** — fix the root cause instead.
- **Design system verbatim** — `apps/web` reuses the shared Bymax design tokens and shell without alteration; see `docs/design_system.html`.
- **No `--no-verify`** — never bypass the pre-commit or commit-msg hooks.
