# Watchlist

A multi-user investment planning application for managing savings plans and individual investments in an existing stock portfolio using a value-oriented approach.

The project is also an exploration of **agent-assisted software engineering**: product requirements, architecture, implementation tasks, reviews, testing, and production deployment were developed through a structured collaboration between a human Product Owner and AI agents with clearly separated responsibilities.

## What the Application Does

Watchlist is designed for investors who already own or follow a portfolio of individual stocks and want to decide **where new capital should be invested based on the relationship between the current market price and their own valuation**.

The central concept is the **Target Price**.

For every stock, the user can define a Target Price representing the price against which the current market valuation should be assessed. The application retrieves current market data and calculates the stock's distance from that Target Price.

This makes the Watchlist more than a conventional price tracker:

* a stock trading relatively close to or below its Target Price can receive a higher investment weighting;
* a stock trading far above its Target Price can receive a lower weighting or no allocation;
* Target Prices remain the user's own investment assumptions rather than values supplied by a market-data provider.

### Savings Plan Allocation

The primary use case is allocating a periodic savings amount across an existing stock portfolio.

The user enters a total amount to invest, for example:

```text
Total savings: €1,000
```

The server calculates an investment factor for every stock based on its current distance from the configured Target Price and distributes the available savings amount accordingly.

Conceptually:

```text
Current market price
        +
Target Price
        |
        v
Distance to Target
        |
        v
Investment Factor
        |
        v
Relative allocation of the savings amount
```

The resulting Watchlist shows how much of the available capital would be assigned to each stock.

The calculation is intentionally explicit and on demand. It is not an automated trading system and does not place orders.

### Individual Investment Decisions

The same information can also be used without the savings-plan allocation.

The Watchlist can simply serve as a value-oriented decision aid for individual investments: current prices, Target Prices, and the resulting distance make it easier to identify which stocks currently trade closest to the investor's own valuation.

### Additional Portfolio Information

The Watchlist enriches the decision view with market information such as:

* current market price;
* company name and trading currency;
* dividend yield;
* market capitalization normalized to billions of USD;
* Target Price;
* distance to Target Price;
* calculated savings allocation.

Watchlists can be filtered by company name and sorted by their financial columns. Multiple Watchlists are supported per user.

## Product Principles

A few principles deliberately shape the application:

**User valuation stays separate from market data.** Target Prices belong to the user and are persisted independently of the current Watchlist membership or data returned by Yahoo Finance.

**Financial calculations are server-side.** Dividend yield normalization, market-cap conversion, Target Price distance, investment factors, and savings allocation are not recalculated in the browser.

**Investment allocation is advisory and transient.** Allocation results are calculated on demand and are never persisted or automatically translated into trades.

**Partial market data should not make the entire Watchlist unusable.** Where possible, unavailable values are represented explicitly rather than fabricated.

**Users are isolated by authenticated identity.** Watchlists and Target Prices are stored separately for each authenticated user.

## Technology

### SvelteKit and TypeScript

The application is built with **SvelteKit and TypeScript**.

SvelteKit provides both the responsive browser application and the server-side REST/API layer in one codebase. This keeps the project small while still maintaining a clear boundary between client presentation, application services, domain calculations, provider adapters, and persistence.

TypeScript is used throughout to make those boundaries explicit and to catch integration mistakes early.

Svelte was deliberately chosen for a lightweight application that does not require a large client framework or global state-management solution. Reactive derived state is particularly useful for client-side filtering, sorting, and presentation while the financial business logic remains on the server.

### Cloudflare Workers

The production application runs on **Cloudflare Workers**.

This was chosen because the application is small, serverless, and naturally request-oriented. It does not require a permanently running application server.

The SvelteKit application is built directly for the Workers runtime and its compatibility with external integrations is tested explicitly rather than assuming Node.js compatibility.

### Cloudflare KV

**Cloudflare KV** stores the small amount of persistent application state:

```text
User
├── Watchlists
└── Target Prices
```

The application does not need a relational data model, joins, transactions, or a high-write database. Whole-document KV persistence therefore keeps the infrastructure intentionally small.

Target Prices are stored independently from Watchlists. Removing a stock from a Watchlist does not remove its Target Price, so adding the stock again restores the user's existing valuation assumption.

### Cloudflare Access

Authentication is delegated entirely to **Cloudflare Access**.

Production uses an explicit email allowlist and Email One-Time PIN authentication. The application contains no passwords, registration flow, or user-account management.

The Worker verifies Cloudflare's `Cf-Access-Jwt-Assertion` server-side against Cloudflare's JWKS, including issuer and audience validation, and uses the verified JWT subject as the stable user identity.

This keeps authentication outside the product while preserving strict per-user isolation in the application.

### Yahoo Finance

Current stock-market information is obtained through **Yahoo Finance**, isolated behind a `MarketDataProvider` abstraction.

The integration was validated separately against real symbols and the Cloudflare Workers runtime before being introduced into application services.

Provider-specific behavior therefore remains at the infrastructure boundary instead of leaking into the domain model.

### Frankfurter

Currency conversion for market capitalization uses the **Frankfurter** exchange-rate API behind a separate `ExchangeRateProvider`.

The application batches the required currencies and converts market capitalization to billions of USD for comparison while preserving the stock's original trading currency and price.

### Vitest

**Vitest** provides fast deterministic unit and application-service tests.

Domain formulas, provider adapters, persistence adapters, authentication, client orchestration, input parsing, filtering, sorting, and other isolated behavior are tested without requiring live external services.

### Playwright

**Playwright** provides permanent browser-level regression tests.

The E2E suite covers the complete user interface at desktop and mobile sizes, including Watchlist management, stock management, Target Price editing, filtering, sorting, investment allocation, error handling, and responsive behavior.

Normal browser tests intercept the application's API boundary and therefore do not depend on Cloudflare, Yahoo Finance, Frankfurter, or production credentials.

Real provider and Cloudflare-runtime behavior is verified separately through focused integration and production smoke tests.

## Agent-Assisted Development

A second goal of this project was to explore how AI coding agents can be used in a controlled software-engineering process rather than simply asking an agent to "build the application."

The work was organized around distinct responsibilities.

### Product Owner

I acted as the **Product Owner**.

I defined the investment problem, explained the behavior of the previous application, made product decisions, supplied real-world examples, reviewed intermediate results, and decided which assumptions should become actual product rules.

This was particularly important for financial behavior where seemingly small implementation assumptions can change the meaning of the application.

### Architect Agent

An AI agent acted as an **architect and engineering partner**.

Together, we:

* translated the investment workflow into explicit business rules;
* designed the application architecture;
* selected technologies and integration boundaries;
* investigated external APIs and Cloudflare behavior;
* identified ambiguities before implementation;
* documented architectural decisions in `ARCHITECTURE.md`;
* decomposed the implementation into narrowly scoped tasks;
* reviewed the implementation reports after every task;
* decided what should be implemented next.

The architect agent did not simply hand the complete application to the implementation agent. Each capability was discussed and specified before implementation.

### Implementation Agent

A separate coding agent implemented the tasks with **Claude Code**.

Each task was provided as a Markdown specification under `docs/tasks/` with:

* goal and context;
* required behavior;
* architecture constraints;
* non-goals;
* test scenarios;
* acceptance criteria;
* verification commands;
* completion-report requirements.

The implementation agent was deliberately constrained from making unrelated architectural decisions, proceeding automatically to the next task, or committing/pushing changes.

After every implementation task, its completion report was reviewed before the next task was defined.

The development loop was therefore:

```text
Product observation / requirement
        |
        v
Product Owner + Architect Agent
        |
        +-- clarify business behavior
        +-- make architecture decision
        +-- define acceptance criteria
        |
        v
Markdown implementation task
        |
        v
Claude Code implementation
        |
        +-- code
        +-- unit tests
        +-- E2E tests where applicable
        +-- runtime verification
        |
        v
Completion report
        |
        v
Product Owner + Architect review
        |
        +-- accept
        +-- investigate
        +-- correct
        +-- define next task
```

This separation was intentional: the implementation agent had considerable autonomy **inside an accepted task**, but changes to product behavior and architecture remained explicit decisions.

## From Architecture to Production

The project was developed incrementally rather than as one large generated implementation.

Early tasks established the technical foundation and validated risky integrations before they became dependencies of the product. Later tasks introduced persistence, authentication, application services, REST endpoints, and finally the user interface.

Examples of this process include:

* validating `yahoo-finance2` with real international symbols and inside the Cloudflare `workerd` runtime before adopting it;
* separating Yahoo Finance behind `MarketDataProvider`;
* separating exchange rates behind `ExchangeRateProvider`;
* implementing financial formulas as pure domain functions with explicit edge-case tests;
* keeping Target Prices independent from Watchlist membership;
* introducing permanent Playwright tests as soon as substantial browser workflows existed;
* verifying critical integration paths against real Cloudflare KV and external providers;
* correcting the production authentication architecture when the first real deployment exposed a Cloudflare Static Assets limitation that local testing could not reproduce.

That last case was particularly valuable: the initial architecture used Cloudflare's `ctx.access` identity context. Production deployment demonstrated that the Static Assets router does not forward that context to the application Worker. The architecture was reviewed rather than patched around, and production authentication was changed to cryptographically validated Cloudflare Access JWTs.

The resulting correction was documented and tested instead of hiding the history of the original decision.

## Development After V1

The first successful production deployment was not treated as the end of the product process.

After V1 was running, I continued using the application as its Product Owner and brought observations, usability issues, and improvement ideas back into the same workflow.

The process became:

```text
Use production application
        |
        v
Product Owner observation
        |
        v
Discuss expected behavior with Architect Agent
        |
        v
Refine architecture / UX decision
        |
        v
Create focused implementation task
        |
        v
Claude Code implementation
        |
        v
Review and regression verification
```

This allowed the application to evolve from actual usage rather than from an upfront feature list alone.

The repository therefore documents not only the resulting software, but also the **engineering process used to build and evolve it with AI agents under explicit human product and architectural control**.

## Repository Structure

Key documentation:

```text
ARCHITECTURE.md
    Architectural decisions, boundaries, business rules, and integration strategy

CLAUDE.md
    Repository instructions and constraints for the implementation agent

docs/tasks/
    Incremental implementation tasks and their acceptance criteria

docs/spikes/
    Focused technical investigations performed before architectural adoption

tests/e2e/
    Permanent Playwright browser regression tests
```

Together with the source code and test suite, these files provide a record of how requirements were translated into architecture and then into reviewed implementation increments.

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
ACCESS_TEAM_DOMAIN   full URL: https://<team-name>.cloudflareaccess.com   (Worker Secret)
ACCESS_AUD           this Worker's Access Application Audience (AUD) tag  (Worker Secret)
WATCHLIST_KV         the production KV namespace binding (wrangler.jsonc)
```

`ACCESS_TEAM_DOMAIN` must include the `https://` scheme — the current
authentication implementation requires the full URL, not just the team name.
`ACCESS_AUD` is the Access **Application Audience (AUD) tag** for the Access
application protecting this Worker — it is not a policy ID, account ID, or
application display name.

`ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` are configured only as Cloudflare
Worker **Secrets** (Settings → Runtime variables and secrets → Type:
Secret), not in `wrangler.jsonc` — real Access values must never be
committed to the repository. Using Secrets (rather than ordinary Text
variables) avoids Wrangler remote-variable override conflicts on deploy;
these two values are configuration, not high-value credentials.
`wrangler.jsonc` declares `secrets: { required: ["ACCESS_TEAM_DOMAIN",
"ACCESS_AUD"] }` (names only, never values), which lets `wrangler types`
generate them as part of the standard `Env`.

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
the Cloudflare Zero Trust dashboard), each with **Type: Secret**:

```text
ACCESS_TEAM_DOMAIN
ACCESS_AUD
```

These are never set in `wrangler.jsonc`. Ordinary `wrangler deploy` does not
delete or prompt to delete Secrets (unlike ordinary `vars`), so no
`keep_vars`/`--keep-vars` configuration is needed to preserve them. This
project does not automate Cloudflare account configuration or deployment.

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

**Verified (TASK-028):** Steps 1–3 have been manually confirmed in
production with an allowlisted email — the One-Time PIN was delivered,
accepted, and the Watchlist application loaded successfully (no actual
email address recorded here). Step 5 has also been manually confirmed with
a non-allowlisted email: Cloudflare Access shows the PIN-entry step but
does not deliver a PIN, so the application remains unreachable. This is
expected Cloudflare Access behavior (it avoids leaking allowlist
membership) and does not need to be reproduced inside the application. The
negative-allowlist check does not need to be repeated unless the Access
policy changes.
