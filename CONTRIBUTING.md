# Contributing to nest-cache-example

Thanks for your interest. This repository is the canonical reference application for
`@bymax-one/nest-cache`, so contributions are judged by how well they demonstrate the library, not by
generic code churn.

## Reporting security issues

Please do not open a public issue for a vulnerability. See [SECURITY.md](SECURITY.md) for the private
disclosure process (`support@bymax.one`).

## The bar for a change

> _"Does this make the demonstration of `@bymax-one/nest-cache` clearer or more complete?"_

Changes that clarify a library feature, add a missing demonstration, fix a bug, or improve the docs are
welcome. Generic refactors that obscure how the library is wired will be declined.

## Prerequisites

- Node.js >= 24 and pnpm 10 (`corepack enable`).
- Docker (Docker Compose v2) for the local Redis stack and the Testcontainers e2e suites.

## Getting started

```bash
# Clone + build the sibling library first (consumed pre-publish via file:, must be built before pnpm install)
git clone https://github.com/bymaxone/nest-cache.git ../nest-cache
cd ../nest-cache && pnpm install && pnpm build
cd ../nest-cache-example

# Install the workspace (resolves the file: link)
pnpm install

# Bring up Redis 7 (add --profile tools for RedisInsight on :5540)
pnpm infra:up
```

## Verification, run before every PR

```bash
pnpm lint
pnpm typecheck
pnpm format:check
pnpm --filter api run test:cov     # 100% coverage gate
pnpm --filter web run test:cov     # 100% coverage gate
pnpm --filter api run test:e2e     # real Redis via Testcontainers
node scripts/audit-library-exports.mjs   # every library export is demonstrated
```

The mutation gate (Stryker, api break 100 / web break 90) is authoritative locally and pre-release:
`pnpm mutation`. Because both apps exceed the hosted-runner window, the CI mutation job is gated; the scores
by feature group live in [docs/stryker/HISTORY.md](docs/stryker/HISTORY.md).

## Commits, Conventional Commits

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject`,
enforced locally by commitlint. Use the scopes in `.gitmessage`
(`api` · `web` · `cache` · `docker` · `deps` · `docs` · `config`). Do not add any AI-attribution or
`Co-Authored-By` trailer.

## Pull requests

- Keep the working tree at 100% coverage on both apps; every `it()` carries a scenario comment.
- No suppression comments (`@ts-ignore`, `eslint-disable`, `istanbul ignore`); remove dead branches instead.
- No Swagger — controllers are documented with JSDoc and DTOs are Zod schemas.
- English only; never bypass the pre-commit or commit-msg hooks (`--no-verify` is prohibited).
- CI must be green (lint, typecheck, format, unit, e2e, web build, Playwright, export-usage audit).

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
