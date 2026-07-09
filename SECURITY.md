# Security Policy

`nest-cache-example` is the public reference application for `@bymax-one/nest-cache`. It handles surfaces
that must never leak across boundaries: per-tenant key prefixes, the namespace-flush guard, and the raw-client
escape hatch that intentionally bypasses namespacing. We triage security reports ahead of feature work.

## Supported versions

This repository tracks one library minor at a time (see [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md)).
Security fixes land on the tip of the default branch; there are no long-lived release branches to back-port
to.

| Branch / version       | Status                          |
| ---------------------- | ------------------------------- |
| `main` (current minor) | Active, receives security fixes |
| Older tags / forks     | Best effort only                |

A vulnerability in the **library itself** (`@bymax-one/nest-cache`) should be reported against
[its repository](https://github.com/bymaxone/nest-cache), not here. Report it here only if it is
reproducible through this example's own demo code.

## Reporting a vulnerability

**Do not report security issues through public GitHub Issues, Discussions, or pull requests.** Public reports
give attackers a window between disclosure and fix.

Email **support@bymax.one** with `[security] nest-cache-example` in the subject line. If you prefer, you may
instead open a GitHub
[private security advisory](https://github.com/bymaxone/nest-cache-example/security/advisories/new).

### What to include

- A clear description of the vulnerability and its impact.
- Step-by-step reproduction against the default branch.
- The affected surface (an API route, the dashboard, the build/CI, a dependency).
- A suggested fix or mitigation, if you have one.
- Whether you would like to be credited (and how).

## Scope notes

- **Dev credentials only.** The local stack runs an unauthenticated Redis bound to the loopback interface;
  these are demo defaults, not a finding.
- **Namespace flush is guarded.** `flushNamespace()` is disabled in production unless explicitly allowed; a
  report that it can wipe keys outside the configured namespace, or bypass the production guard, is in scope.
- **Tenant isolation** is app-level key-prefix composition; a report that clearing, listing, or reading one
  tenant can reach another tenant's keys is in scope.
- **`getClient()` is a documented escape hatch.** It bypasses namespacing by design; a report that a normal
  facade call (`get`/`set`/`scan`/`del`/…) leaks outside the namespace is in scope.
- **Inert demo data.** The demo domain is an in-memory product catalogue with synthetic values; please never
  attach real secrets or credentials to a report.

We aim to acknowledge a report within a few business days and to keep you updated through resolution.
