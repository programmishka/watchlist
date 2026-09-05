# watchlist

A lightweight multi-user stock watchlist built with SvelteKit and Cloudflare, featuring target prices, market data, dividend analysis, and investment allocation.

## Prerequisites

- Node.js (current LTS or newer)
- npm

## Getting Started

Install dependencies:

```sh
npm install
```

## Development

Start the local development server:

```sh
npm run dev
```

## Authentication

Production authentication is Cloudflare Access (Email One-Time PIN), verified
server-side from the `Cf-Access-Jwt-Assertion` header (see `ARCHITECTURE.md`
§8.2 and `docs/tasks/026-cloudflare-access-jwt-authentication.md`). No login
is implemented by the application itself.

`npm run dev` authenticates every request as a fixed synthetic local user
(`local-development-user`) — no Cloudflare login is required. This identity
is selected only through the build-time SvelteKit `dev` flag and can never be
triggered by a request header, cookie, or query parameter, in local
development or in production. `npm run dev` also has working `WATCHLIST_KV`
(local Miniflare-backed storage under `.wrangler/`, isolated from production)
via the Cloudflare adapter's dev-time platform emulation, so Watchlists,
stocks, Target Prices, filtering, sorting, and investment allocation are all
usable locally without any Cloudflare account.

Required production configuration:

```text
ACCESS_TEAM_DOMAIN   e.g. https://<team-name>.cloudflareaccess.com   (Cloudflare dashboard)
ACCESS_AUD           this Worker's Access Application Audience (AUD) tag (Cloudflare dashboard)
WATCHLIST_KV         the production KV namespace binding (wrangler.jsonc)
```

`ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` are managed only as runtime
variables in the Cloudflare Worker dashboard (Settings → Runtime variables
and secrets), not in `wrangler.jsonc` — real Access values must never be
committed to the repository. `wrangler.jsonc` sets `keep_vars: true` so
`wrangler deploy` preserves those dashboard-managed variables instead of
clearing them. `wrangler types` cannot discover dashboard-only variables, so
they are not part of the generated `Env`; the application composes them in
through a small, narrow type instead (see `ARCHITECTURE.md`).

Missing `ACCESS_TEAM_DOMAIN`/`ACCESS_AUD` values make production
authentication fail closed (every request is treated as unauthenticated)
rather than accepting an unverifiable request.

## Previewing Against the Cloudflare Runtime

Build and run the actual Worker under `workerd`:

```sh
npm run build
npm run preview
```

`npm run preview` runs the _built_ Worker, so it follows the same code path
as production — the local synthetic development identity does not apply.
Since there is no real Cloudflare Access session available locally, and no
current, documented way to simulate the `Cf-Access-Jwt-Assertion` header
under `wrangler dev`, every request to `npm run preview` is correctly
unauthenticated (`401`). This is sufficient to verify the production
fail-closed path locally, but not a full authenticated round trip — that can
only be exercised after a real deployment behind a real Cloudflare Access
application.

In short:

```text
npm run dev     -> synthetic local user, real local KV, no Cloudflare account needed
npm run preview -> production auth code path under workerd; always unauthenticated locally
```

## Testing

Run the unit test suite:

```sh
npm run test
```

## Browser E2E Tests

Playwright is the project's browser-level UI testing tool. Permanent specs live under
`tests/e2e/`, organized by user-facing concern (e.g. `watchlist-tabs.spec.ts`,
`watchlist-table.spec.ts`).

One-time browser install:

```sh
npx playwright install chromium
```

Run the suite headlessly:

```sh
npm run test:e2e
```

Or interactively:

```sh
npm run test:e2e:ui
```

`npm run test:e2e` starts the app with `npm run dev` automatically. Normal E2E tests
mock/intercept `/api/*` responses at the browser network boundary and therefore do not
require Cloudflare Access, Cloudflare KV, Yahoo Finance, or Frankfurter.

## Type/Svelte Checking

```sh
npm run check
```

## Linting and Formatting

Check code style:

```sh
npm run lint
```

Automatically fix formatting:

```sh
npm run format
```

## Build

Create a production build:

```sh
npm run build
```

## Deployment

Production deployment targets Cloudflare Workers. See `ARCHITECTURE.md` for architectural details.

Before deploying, manually confirm the real Cloudflare Access values are set
in the Cloudflare Worker dashboard (Settings → Runtime variables and
secrets — from the Access application already created for this Worker in
the Cloudflare Zero Trust dashboard):

```text
ACCESS_TEAM_DOMAIN
ACCESS_AUD
```

These are never set in `wrangler.jsonc` and are preserved across deploys by
`keep_vars: true`. This project does not automate Cloudflare account
configuration or deployment.

Deploy with:

```sh
npm run deploy
```

`npm run deploy` runs `npm run build` before `wrangler deploy` — Wrangler's
entry point (`.svelte-kit/cloudflare/_worker.js`) is generated by the
SvelteKit build and does not exist on a clean checkout, so a bare
`wrangler deploy` can fail without it.

### Post-Deployment Smoke Test

After deploying with the real values configured:

1. Open the `workers.dev` URL in an incognito/private browser window.
2. Enter an allowlisted email address and confirm Cloudflare Access sends a One-Time PIN.
3. Enter the PIN and confirm the Watchlist UI loads (not "Authentication is required.").
4. Create or load a Watchlist and confirm it persists — this exercises `user:<verified-sub>:watchlists` in production `WATCHLIST_KV`, keyed by the JWT's verified `sub`, never by email.
5. Attempt the same flow with a non-allowlisted email and confirm Cloudflare Access itself blocks the login before the application is reached.
