# TASK-018: Playwright E2E Test Foundation

## Status

Done

## Goal

Establish Playwright as the permanent browser-level UI testing foundation for the Watchlist application.

Replace the current pattern of creating temporary Playwright scripts outside the repository for repeatable UI verification with maintainable, use-case-oriented E2E tests stored in the project.

The initial E2E suite must cover the production UI already introduced by:

* TASK-016 — Application Shell and Watchlist Tabs;
* TASK-017 — Watchlist Stock Table.

The primary E2E tests introduced by this task must be:

* deterministic;
* independent of Yahoo Finance;
* independent of Frankfurter;
* independent of Cloudflare KV;
* independent of Cloudflare Access;
* executable repeatedly from the repository;
* suitable for extension by future UI tasks.

This task establishes testing infrastructure.

Do not implement new Watchlist product functionality.

---

## Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* this task completely

Relevant existing frontend functionality includes:

* Svelte application shell;
* Watchlist tabs;
* active-Watchlist switching;
* client REST API boundary;
* Watchlist stock table;
* responsive horizontal table scrolling;
* client loading/error/empty states.

Previous UI tasks used temporary external Playwright scripts for runtime verification.

Those scripts proved useful, but repeatable product behavior should now be represented by permanent repository tests.

---

## 1. Add Playwright

Add the current stable:

```text
@playwright/test
```

as a development dependency.

Do not add:

* Cypress;
* Selenium;
* Puppeteer;
* another browser-testing framework.

Playwright becomes the project's browser-level UI testing tool.

---

## 2. Test Directory

Create a permanent browser-test structure under:

```text
tests/e2e/
```

Initial specs should be organized by user-facing concern.

Use:

```text
tests/e2e/
├── watchlist-tabs.spec.ts
└── watchlist-table.spec.ts
```

or an equivalent clearly use-case-oriented structure.

Do NOT create one large:

```text
watchlist.spec.ts
```

containing unrelated UI behavior.

Future UI tasks should add or extend similarly focused specs.

---

## 3. Playwright Configuration

Add:

```text
playwright.config.ts
```

using current Playwright conventions.

Keep configuration small and understandable.

Do not introduce a large custom test harness.

---

## 4. Test Server

Configure Playwright to start the application automatically for deterministic E2E tests.

These mocked UI tests do NOT need:

* Cloudflare Access;
* Cloudflare KV;
* Yahoo;
* Frankfurter.

Therefore prefer the simplest application runtime that can serve the Svelte UI while Playwright intercepts `/api/*` requests.

If:

```text
npm run dev
```

is sufficient because all relevant API requests are intercepted, it is appropriate for this suite.

Do not require `wrangler dev` solely for mocked UI tests.

Document the selected approach.

---

## 5. Separate UI E2E from Integration Smoke Tests

The permanent Playwright suite introduced by this task primarily verifies:

```text
browser UI
+
controlled API responses
```

It is NOT intended to verify:

```text
browser
→ Cloudflare Access
→ KV
→ Yahoo
→ Frankfurter
```

on every run.

Keep these concerns separate:

```text
Playwright E2E
    |
    +-- deterministic UI behavior
    +-- mocked/intercepted application API

Cloudflare runtime smoke tests
    |
    +-- real workerd
    +-- local Access
    +-- local KV
    +-- external providers where relevant
```

Do not make ordinary E2E tests depend on external services.

---

## 6. API Interception

Use Playwright request routing/interception to provide deterministic responses for:

```text
/api/*
```

as needed by each UI test.

Tests should be able to control:

* Watchlist metadata;
* active Watchlist;
* stock data;
* warnings;
* API failures;
* active-Watchlist mutation responses.

Do not add production mock endpoints.

Do not add development-only API behavior to application source code.

---

## 7. Reusable Test Fixtures

Introduce small reusable E2E fixtures/helpers where they materially reduce duplication.

For example, representative test data may include:

```text
Main
Dividend
```

Watchlists and representative stocks such as:

```text
AAPL
SAP.DE
GAW.L
UNKNOWN
```

Keep helpers focused.

Do not build a general test-data framework.

---

## 8. Deterministic Test Data

E2E tests must not depend on live market values.

Do not assert:

```text
AAPL price is currently X
```

Instead return fixed API values from Playwright routing.

Example:

```text
AAPL
price = 200
currency = USD

SAP.DE
price = 180.5
currency = EUR

GAW.L
price = 9500
currency = GBp
```

The exact fixture values may differ.

---

## 9. Missing Market Data Fixture

Include a deterministic stock representing TASK-011 partial-success behavior.

For example:

```text
symbol = UNKNOWN
name = undefined
price = undefined
currency = undefined
marketCapBillionsUsd = undefined
targetPrice = 100
distanceToTarget = 0
dividendYield = 0
```

This allows the UI placeholder behavior from TASK-017 to be tested permanently even though the normal Add Stock API rejects unknown symbols.

---

## 10. Desktop Browser Project

Configure at least one desktop Chromium project.

Use a stable desktop-like viewport.

For example:

```text
1280 × 900
```

or an equivalent sensible size.

Do not depend on the developer's local browser window dimensions.

---

## 11. Mobile Browser Project

Configure a second Chromium-based project representing the narrow/mobile layout.

Use approximately:

```text
375px
```

viewport width.

A suitable configuration might use:

```text
375 × 812
```

or a standard Playwright mobile device profile with approximately the required width.

The purpose is to permanently exercise the responsive behavior already required by TASK-016/TASK-017.

---

## 12. Browser Scope

Chromium desktop + Chromium mobile is sufficient for the initial E2E foundation.

Do not add Firefox/WebKit projects unless there is a current concrete compatibility requirement.

Cross-browser expansion can be considered later.

---

## 13. npm Scripts

Add:

```text
test:e2e
```

for normal headless execution.

Conceptually:

```json
{
  "scripts": {
    "test:e2e": "playwright test"
  }
}
```

Also add an interactive development command if useful:

```text
test:e2e:ui
```

conceptually:

```json
{
  "scripts": {
    "test:e2e:ui": "playwright test --ui"
  }
}
```

Do not change:

```text
npm run test
```

to execute Playwright.

The normal Vitest suite must remain fast and browser-independent.

---

## 14. Browser Installation

Use the normal Playwright browser installation mechanism.

Do not commit browser binaries.

Do not commit Playwright caches.

If browser installation requires a one-time developer command such as:

```text
npx playwright install chromium
```

document it in README.

Do not automatically download browsers during every normal `npm install` unless current Playwright tooling makes that clearly preferable.

---

## 15. Test Artifacts

Configure normal Playwright failure artifacts sensibly.

Useful failure artifacts may include:

* screenshot;
* trace;
* video only if justified.

Prefer:

```text
screenshot on failure
trace on first retry / failure
```

or similarly restrained defaults.

Do not commit generated screenshots/traces/videos.

Ensure relevant artifact directories are ignored by Git.

---

## 16. No Screenshot Baseline Tests Yet

Do NOT introduce visual snapshot/baseline testing in this task.

Do not commit reference screenshots.

The current goal is behavioral and responsive verification, not pixel-perfect visual regression.

Screenshots may exist as failure diagnostics only.

---

# Existing UI Coverage

## 17. Watchlist Tabs Spec

Create:

```text
tests/e2e/watchlist-tabs.spec.ts
```

covering the existing TASK-016 behavior.

---

## 18. Initial Watchlist Load

Mock:

```http
GET /api/watchlists
```

and:

```http
GET /api/watchlists/{activeId}
```

Verify:

* application title renders;
* Watchlist tabs render;
* persisted active Watchlist is selected;
* active Watchlist content loads.

Do not rely on real KV.

---

## 19. Duplicate Watchlist Names

Return:

```text
id = wl-1
name = Dividend

id = wl-2
name = Dividend
```

Verify:

* both tabs render;
* they are distinct interactive elements;
* active state follows ID rather than name;
* switching between them works.

This permanently covers the duplicate-name domain rule at the UI boundary.

---

## 20. No Watchlists

Return:

```json
{
  "watchlists": []
}
```

Verify the existing explicit no-Watchlists state is displayed.

Do not expect tabs or a stock table.

---

## 21. Empty Watchlist

Return metadata containing one Watchlist and a composed Watchlist response with:

```text
stocks = []
```

Verify the existing:

```text
This watchlist is empty.
```

or equivalent empty-state message.

---

## 22. Tab Switching

Start with at least two Watchlists.

When the user selects the second tab, verify the browser performs:

```text
PUT /api/watchlists/active
```

with the expected:

```json
{
  "watchlistId": "wl-2"
}
```

Then return a deterministic composed Watchlist for:

```text
GET /api/watchlists/wl-2
```

Verify:

* second tab becomes active;
* its content is displayed.

---

## 23. No Redundant Active Mutation

Click/select the already active tab.

Verify:

```text
PUT /api/watchlists/active
```

is not unnecessarily issued.

Use request counting/interception rather than implementation-specific component inspection.

---

## 24. Active Selection Failure

Configure:

```text
PUT /api/watchlists/active
```

to return an API failure.

Verify:

* previous tab remains active;
* previous content remains available where current UI semantics preserve it;
* an understandable error is shown;
* the new Watchlist GET is not issued.

This permanently covers the TASK-016 failure semantics.

---

## 25. Load Failure After Successful Selection

Configure:

```text
PUT active
```

to succeed and:

```text
GET newly selected Watchlist
```

to fail.

Verify:

* new tab remains active;
* content area displays the error;
* the UI does not revert to the previous persisted active tab.

---

# Stock Table Coverage

## 26. Watchlist Table Spec

Create:

```text
tests/e2e/watchlist-table.spec.ts
```

covering the TASK-017 table.

---

## 27. Exact Columns

Verify the table contains exactly these columns in order:

```text
Symbol
Name
Cap (USD)
Price
Div
Currency
Target Price
Distance to Target
```

Verify it does NOT contain:

```text
Savings Amount
Delete
```

---

## 28. Representative Rows

Provide deterministic composed stock data for at least:

```text
AAPL
SAP.DE
GAW.L
UNKNOWN
```

The fixture should cover:

* USD;
* EUR;
* GBp;
* Target Price present;
* Target Price absent;
* positive distance;
* negative distance;
* zero distance;
* missing market data.

---

## 29. GBp Display

Verify:

```text
GAW.L
```

renders:

```text
GBp
```

in the Currency column.

Do not accept:

```text
GBP
```

as equivalent.

This is an intentional product distinction.

---

## 30. Missing Values

For the `UNKNOWN` fixture, verify unavailable values display:

```text
—
```

where required.

At minimum cover:

* name;
* market cap;
* price;
* currency.

If Target Price exists, verify it still displays.

Verify the row itself remains visible.

---

## 31. Percentage Presentation

Using deterministic fixture values, verify the browser displays:

* dividend yield as percentage;
* positive Target distance as percentage;
* negative Target distance with negative sign;
* zero distance as `0 %` or locale-equivalent output.

Avoid assertions that are unnecessarily brittle to browser spacing around `%`.

---

## 32. Row Order

Return stock data in a deliberately meaningful order such as:

```text
SAP.DE
AAPL
GAW.L
UNKNOWN
```

Verify the table renders that exact order.

Do not allow E2E tests to assume alphabetical sorting.

---

# Responsive Coverage

## 33. Desktop Layout Test

Under the desktop project, verify:

* application shell fits viewport;
* tabs are visible;
* stock table is visible;
* all eight headers exist;
* page does not unexpectedly overflow horizontally.

Do not assert exact pixel positions unless necessary.

---

## 34. Mobile Layout Test

Under the approximately 375px project, verify:

```text
document.documentElement.scrollWidth
<=
document.documentElement.clientWidth
```

or an equivalent robust page-overflow assertion.

The application page itself must not horizontally scroll.

---

## 35. Table Horizontal Overflow

Under the mobile project, verify the table container is horizontally scrollable.

Conceptually verify:

```text
tableContainer.scrollWidth > tableContainer.clientWidth
```

This permanently replaces the temporary Playwright script previously used to verify this requirement.

---

## 36. Tabs on Mobile

Verify tabs remain usable on the mobile project.

If the tab strip overflows, confirm its configured overflow behavior does not cause page-level overflow.

Do not require all tabs to fit simultaneously.

---

# Test Design Rules

## 37. User-Facing Selectors

Prefer stable user-facing selectors:

* role;
* accessible name;
* table semantics;
* visible text.

For example:

```text
getByRole('tab', { name: 'Main' })
getByRole('table')
getByRole('columnheader', { name: 'Price' })
```

Avoid brittle selectors tied to:

* generated CSS classes;
* Svelte internals;
* DOM nesting;
* implementation-specific IDs.

Add `data-testid` only when semantic selectors are genuinely insufficient.

---

## 38. No Arbitrary Sleeps

Do not use:

```text
waitForTimeout(...)
```

as normal synchronization.

Use Playwright's auto-waiting and explicit observable conditions.

Temporary timing diagnostics may be used while debugging but must not remain in committed tests.

---

## 39. No Live External Providers

Normal:

```text
npm run test:e2e
```

must not call:

* Yahoo Finance;
* Frankfurter;
* Cloudflare KV;
* Cloudflare Access.

All API calls required by these tests must be intercepted or otherwise deterministically controlled.

This keeps the suite fast and reliable.

---

## 40. No Production Test Hooks

Do not add:

```text
if (e2e)
```

branches to production application logic.

Do not add special production routes for E2E.

Tests should interact with the application as a browser and control external behavior at the network boundary.

---

## 41. Future UI Task Rule

Update `CLAUDE.md` with a permanent rule for future UI work.

Add guidance equivalent to:

> User-visible behavior introduced or changed by UI tasks should be covered by persistent Playwright E2E tests when browser-level verification provides meaningful regression protection.

And:

> Do not create temporary Playwright scripts outside the repository for repeatable product behavior that belongs in the permanent E2E suite.

Also clarify:

> Temporary browser scripts remain acceptable for one-off diagnostics when the behavior is not itself a useful regression test, but they must be removed before task completion.

Do not require every CSS change to receive a browser test.

Use judgment based on meaningful user behavior.

---

## 42. Future Spec Organization Rule

Add guidance to `CLAUDE.md` that future browser tests should be organized by user-facing concern/use case.

Examples:

```text
watchlist-tabs.spec.ts
watchlist-table.spec.ts
watchlist-management.spec.ts
stock-management.spec.ts
target-price.spec.ts
filtering-sorting.spec.ts
investment-allocation.spec.ts
```

Do not require all these files to exist now.

They are examples for future organization.

---

## 43. Verification Guidance for Future Tasks

Update `CLAUDE.md` so that future UI tasks should normally run:

```bash
npm run test
npm run test:e2e
npm run check
npm run lint
npm run build
```

when they modify behavior covered by the E2E suite.

Backend-only tasks do not necessarily need Playwright unless they change an API contract exercised by the UI.

---

## 44. README

Update `README.md` with concise E2E developer instructions.

Document at minimum:

```bash
npx playwright install chromium
npm run test:e2e
```

and, if added:

```bash
npm run test:e2e:ui
```

Explain briefly that normal E2E tests mock/intercept application API responses and do not require Cloudflare/Yahoo/Frankfurter.

Do not turn README into a Playwright manual.

---

## 45. Git Ignore

Ensure generated Playwright output is ignored.

Depending on configuration this may include:

```text
playwright-report/
test-results/
```

and similar generated artifact directories.

Do not ignore:

```text
tests/e2e/
playwright.config.ts
```

---

## 46. Architecture Documentation

Update `ARCHITECTURE.md` with a targeted testing-strategy addition.

Document that:

* Vitest remains the unit/application test framework;
* Playwright is the browser-level UI/E2E framework;
* normal Playwright UI tests use deterministic intercepted API responses;
* UI E2E tests do not normally depend on Yahoo, Frankfurter, Access, or KV;
* real `workerd`/provider verification remains a separate integration-smoke-test concern;
* desktop and narrow/mobile UI behavior are covered by Playwright;
* browser tests are organized by user-facing use case.

Do not rewrite unrelated architecture sections.

---

## 47. Existing Unit Tests

Do not remove existing TASK-016/TASK-017 unit tests merely because Playwright now covers browser behavior.

In particular retain:

* `watchlistApi.spec.ts`;
* `watchlistShell.spec.ts`;
* `format.spec.ts`.

The test layers serve different purposes.

---

## 48. E2E Runtime Independence

A developer should be able to run:

```bash
npm run test:e2e
```

without:

* logging into Cloudflare;
* configuring a real KV namespace;
* possessing Yahoo cookies;
* having Frankfurter available;
* changing local persisted Watchlists.

The test suite owns its deterministic browser-facing API state.

---

## Non-Goals

Do NOT implement:

* new Watchlist functionality;
* Watchlist creation UI;
* Watchlist deletion UI;
* add/remove-stock UI;
* Target Price editing;
* filtering;
* sorting;
* investment-allocation UI;
* visual snapshot testing;
* cross-browser Firefox testing;
* cross-browser WebKit testing;
* production Cloudflare integration tests inside normal E2E;
* real Yahoo/Frankfurter E2E dependencies;
* CI/CD pipeline configuration unless already trivially required;
* production test-only endpoints.

Do not refactor working UI merely to make Playwright tests easier unless a genuine accessibility/testability issue is discovered.

---

## Acceptance Criteria

The task is complete when all of the following are true:

1. `@playwright/test` is a development dependency.
2. `playwright.config.ts` exists.
3. Permanent browser tests live under `tests/e2e/`.
4. Browser tests are organized by user-facing concern.
5. A desktop Chromium project exists.
6. An approximately 375px mobile Chromium project exists.
7. `npm run test:e2e` exists.
8. An interactive Playwright command exists if useful.
9. `npm run test` remains independent of Playwright.
10. Normal E2E tests start a suitable local Svelte runtime automatically.
11. Normal E2E tests do not require Cloudflare Access.
12. Normal E2E tests do not require KV.
13. Normal E2E tests do not call Yahoo.
14. Normal E2E tests do not call Frankfurter.
15. Application API responses are controlled deterministically through browser test routing/interception.
16. No production mock/test endpoint is introduced.
17. Initial Watchlist loading is covered.
18. Persisted active-tab behavior is covered.
19. Duplicate Watchlist names are covered.
20. No-Watchlists state is covered.
21. Empty-Watchlist state is covered.
22. Tab switching is covered.
23. Redundant active-tab mutation prevention is covered.
24. Active-selection failure behavior is covered.
25. Post-selection Watchlist-load failure behavior is covered.
26. The stock table's exact eight columns are covered.
27. Representative USD/EUR/GBp rows are covered.
28. Missing-market-data row behavior is covered.
29. Missing-value placeholder behavior is covered.
30. Percentage presentation is covered at browser level.
31. Row order is covered.
32. Desktop layout behavior is covered.
33. Mobile page-overflow behavior is covered.
34. Mobile table horizontal scrolling is covered.
35. Mobile tab usability/overflow is covered.
36. Tests primarily use semantic/user-facing selectors.
37. No arbitrary sleeps remain in permanent tests.
38. Failure artifacts are configured and ignored by Git.
39. No visual screenshot baselines are committed.
40. Existing frontend unit tests remain.
41. `CLAUDE.md` instructs future UI tasks to maintain persistent Playwright tests.
42. `CLAUDE.md` discourages temporary external Playwright scripts for repeatable product behavior.
43. `README.md` documents Playwright installation and commands.
44. `ARCHITECTURE.md` documents the browser-testing strategy.
45. `npm run test:e2e` passes.
46. Existing `npm run test` passes.
47. Existing `npm run check` passes.
48. Existing `npm run lint` passes.
49. Existing `npm run build` passes.
50. No new product functionality is implemented.
51. No unnecessary production dependency is introduced.

---

## Verification

Before completing the task, execute:

```bash
npm run test
npm run test:e2e
npm run check
npm run lint
npm run build
```

Also verify:

```bash
git status
```

or equivalent repository inspection to ensure no generated Playwright reports, screenshots, traces, videos, or browser caches are unintentionally tracked.

Do not delete generated project state manually when the configured npm scripts already perform the required cleanup.

Do not report a verification step as successful unless it was actually executed successfully.

---

## Task Status

After all acceptance criteria are satisfied and all required verification checks pass, change:

```text
Status: Ready
```

to:

```text
Status: Done
```

Do not mark the task `Done` if a required acceptance criterion or verification step remains unsatisfied.

Do not modify the status of unrelated tasks.

---

## Completion Report

When finished, report:

1. files added or changed;
2. Playwright version installed;
3. `playwright.config.ts` structure;
4. configured browser projects/viewports;
5. npm scripts added;
6. E2E test directory/spec organization;
7. API interception strategy;
8. deterministic fixture/test-data strategy;
9. Watchlist-tabs scenarios covered;
10. Watchlist-table scenarios covered;
11. missing-market-data scenario coverage;
12. desktop responsive assertions;
13. mobile responsive assertions;
14. table-overflow assertion;
15. selector strategy;
16. failure-artifact configuration;
17. Git-ignore changes;
18. `CLAUDE.md` changes;
19. `README.md` changes;
20. `ARCHITECTURE.md` changes;
21. confirmation that normal E2E tests require no Cloudflare/Yahoo/Frankfurter;
22. confirmation that no production test hooks/endpoints were introduced;
23. results of `test`, `test:e2e`, `check`, `lint`, and `build`;
24. confirmation that generated Playwright artifacts are not tracked;
25. confirmation that existing frontend unit tests remain;
26. confirmation that no product functionality was added;
27. confirmation that this task's status was changed to `Done`;
28. assumptions or unresolved issues;
29. deviations from this task or `ARCHITECTURE.md`.

Do not proceed to further Watchlist UI functionality.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
