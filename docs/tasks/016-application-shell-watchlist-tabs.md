# TASK-016: Application Shell and Watchlist Tabs

## Status

Done

## Historical Note (TASK-035)

TASK-035 later evolved this task's horizontally scrollable Watchlist tab strip into responsive direct-tab-plus-overflow navigation, while preserving the active-Watchlist semantics (server-authoritative selection, `id`-based tab identity, duplicate-name handling) established here. See `ARCHITECTURE.md` §14.5 and §26.12.

## Goal

Implement the first production Svelte UI for the Watchlist application.

This task establishes:

* the application shell;
* initial client-side loading of Watchlist metadata;
* rendering Watchlists as tabs;
* restoring the persisted active Watchlist;
* switching between Watchlists;
* loading the composed data of the active Watchlist;
* responsive page/layout foundations using native CSS.

The UI must use the existing authenticated REST API.

This task intentionally does **not** implement the stock table or Watchlist/stock mutation controls.

Conceptually:

```text
Application starts
       |
       v
GET /api/watchlists
       |
       v
render tabs
       |
       v
determine activeWatchlistId
       |
       v
GET /api/watchlists/{id}
       |
       v
store active Watchlist view
```

On tab change:

```text
User selects tab
       |
       v
PUT /api/watchlists/active
       |
       v
update tab metadata
       |
       v
GET /api/watchlists/{id}
       |
       v
update active Watchlist view
```

---

## Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* this task completely

Relevant existing production functionality includes:

* authenticated Cloudflare Access integration;
* REST API from TASK-013;
* Watchlist metadata endpoint;
* active-Watchlist mutation endpoint;
* composed-Watchlist endpoint;
* stable API errors and warnings;
* Svelte 5 / SvelteKit application foundation.

The current page is only the bootstrap UI.

This task begins the actual Watchlist frontend.

---

## 1. UI Technology

Use:

* Svelte 5;
* current Svelte conventions already configured in the project;
* TypeScript;
* native CSS.

Do NOT introduce:

* Tailwind CSS;
* Bootstrap;
* Semantic UI;
* a general-purpose CSS framework;
* a full UI component library.

Use modern native CSS capabilities such as:

* Flexbox;
* CSS Grid where appropriate;
* `gap`;
* responsive sizing;
* media queries;
* container queries where they provide a concrete benefit.

Do not add a UI dependency without a concrete requirement.

---

## 2. Application Shell

Replace the bootstrap-only page with a minimal production application shell.

The page should contain:

```text
Watchlist
```

as the application title and provide the structural area required for:

```text
title/header
Watchlist tabs
active Watchlist content
```

Keep the visual design simple and clean.

Do not spend this task building a design system.

---

## 3. Page Width and Layout

The application must remain usable on both desktop and narrow/mobile viewports.

Use a sensible responsive content container.

Avoid:

* fixed desktop-only widths;
* horizontal page overflow caused by the shell;
* pixel-perfect assumptions tied to one viewport.

The future stock table may scroll horizontally, but the application shell itself should not require horizontal scrolling.

---

## 4. Native Responsive CSS

Implement responsive layout using native CSS only.

The initial shell should adapt naturally to available width.

Do not introduce a large predefined breakpoint system.

Use only the breakpoints actually required by this UI.

---

## 5. Client-Side API Boundary

Introduce a small client-side API layer for Watchlist HTTP operations required by this task.

Do not scatter raw:

```ts
fetch(...)
```

calls throughout Svelte components.

The API layer should provide application-specific functions conceptually equivalent to:

```text
loadWatchlists()
selectActiveWatchlist(watchlistId)
loadWatchlist(watchlistId)
```

The exact naming/file organization may follow current project conventions.

This client API layer owns:

* endpoint URLs;
* HTTP methods;
* JSON parsing;
* HTTP success/failure detection;
* mapping API errors into a small client-consumable representation.

It does NOT own business calculations.

---

## 6. Client API Types

Define client-facing TypeScript types matching the REST API contracts required by this task.

At minimum represent:

### Watchlist Metadata

```ts
interface WatchlistMetadata {
  id: string;
  name: string;
}
```

### Watchlists Metadata Response

Conceptually:

```ts
interface WatchlistsMetadataResponse {
  activeWatchlistId?: string;
  watchlists: WatchlistMetadata[];
}
```

### Composed Watchlist

Represent the existing API response sufficiently to retain:

```text
id
name
stocks
warnings
```

even though stocks are not rendered as a table yet.

Do not import server-only types into browser code.

The HTTP API is the client/server boundary.

---

## 7. No Server Module Imports

Client code MUST NOT import from:

```text
$lib/server
```

or any server-only application/domain module.

Do not reuse server types by violating the SvelteKit client/server boundary.

If a small API type is required by both sides in the future, that may be addressed separately.

For this task, client API types may live in a client-safe module.

---

## 8. Initial Watchlist Metadata Load

When the application starts, request:

```http
GET /api/watchlists
```

The UI must support:

```text
loading
success with Watchlists
success with zero Watchlists
failure
```

Do not assume at least one Watchlist exists.

---

## 9. Persisted Active Watchlist

If the metadata response contains a valid:

```text
activeWatchlistId
```

use it as the selected tab.

Do not choose another Watchlist merely because it appears first.

This restores the last active Watchlist persisted by the server.

---

## 10. Defensive Missing Active ID

The persistence layer guarantees active-Watchlist integrity, but the UI should still behave sensibly if metadata contains Watchlists without an active ID.

If:

```text
watchlists.length > 0
```

but:

```text
activeWatchlistId
```

is absent, select the first Watchlist locally for display.

Do not persist this defensive fallback automatically in this task.

Do not fail the entire page.

This is a client robustness rule, not a replacement for server integrity.

---

## 11. No Watchlists State

If:

```text
watchlists = []
```

render an explicit empty state.

For example:

```text
No watchlist has been created yet.
```

Do not render:

* empty tabs;
* a fake default Watchlist;
* an empty stock table.

The Watchlist creation UI belongs to a later task.

---

## 12. Watchlist Tabs

Render one tab per Watchlist metadata entry.

Each tab displays:

```text
watchlist.name
```

Watchlist names may be duplicated.

Therefore:

* use Watchlist `id` as the Svelte identity/key;
* do not use the name as a unique key;
* do not assume names uniquely identify tabs.

---

## 13. Active Tab Styling

The active Watchlist must be visually distinguishable.

Use simple accessible styling.

Do not rely on color alone where practical.

The tab should expose appropriate semantic/accessibility state, such as:

```text
aria-selected
```

where the chosen HTML structure supports it.

---

## 14. Tab Accessibility

Implement tabs using appropriate accessible HTML semantics.

At minimum:

* tabs must be keyboard-focusable;
* active state must be programmatically identifiable;
* tab labels must remain readable;
* interaction must use real interactive elements rather than clickable generic `<div>` elements.

Do not implement an elaborate keyboard-navigation framework beyond what is reasonable for the initial UI.

If native buttons provide the simplest accessible solution, prefer them.

---

## 15. Tab Overflow

A user may eventually have more tabs than fit horizontally.

The tab area must not break the page layout.

Use a simple responsive strategy such as:

```text
horizontal scrolling
```

or wrapping if that produces better tab usability.

Do not implement tab dropdown menus or advanced overflow management.

---

## 16. Initial Active Watchlist Data Load

After determining the active Watchlist, request:

```http
GET /api/watchlists/{activeWatchlistId}
```

Store the returned composed Watchlist data in client-side state.

This data includes:

```text
id
name
stocks
warnings
```

Do not render the stock table yet.

---

## 17. Temporary Active-Watchlist Content

Until TASK-017 implements the stock table, display a minimal content area proving that the composed Watchlist has loaded.

A suitable temporary representation is:

```text
<Watchlist name>

N stocks
```

For example:

```text
Main

12 stocks
```

Do not render individual stock rows.

Do not duplicate future table work.

---

## 18. Empty Active Watchlist

If the active Watchlist contains:

```text
stocks = []
```

display:

```text
This watchlist is empty.
```

or an equivalent concise message.

Do not render a table header with no rows.

This empty state will remain useful after the stock table is implemented.

---

## 19. Tab Switching

When the user selects another tab:

1. prevent redundant work if it is already active;
2. call:

```http
PUT /api/watchlists/active
```

with:

```json
{
  "watchlistId": "<selected-id>"
}
```

3. use the returned Watchlist metadata state;
4. load:

```http
GET /api/watchlists/{selected-id}
```

5. update the active Watchlist content.

The server remains the source of truth for persisted active-tab state.

---

## 20. No Optimistic Active Persistence

Do not permanently treat the new tab as selected before:

```text
PUT /api/watchlists/active
```

succeeds.

A short-lived loading indication is acceptable.

If the mutation fails, keep or restore the previous active tab.

Do not allow client state to claim a persisted active Watchlist that the server rejected.

---

## 21. Tab-Switch Loading State

While another Watchlist is loading, provide a lightweight loading indication.

Do not blank the entire application shell unnecessarily.

A simple:

```text
Loading watchlist…
```

in the content area is sufficient.

Do not introduce skeleton libraries.

---

## 22. Initial Loading State

While:

```http
GET /api/watchlists
```

is pending, display a clear loading state.

For example:

```text
Loading watchlists…
```

Do not briefly render the "no watchlists" state before the request completes.

---

## 23. API Error Handling

Use the stable API error response established by TASK-013.

The client API layer should preserve at least:

```text
error.code
error.message
HTTP status
```

in a small client-side error representation.

Do not make Svelte components parse raw HTTP response structures repeatedly.

---

## 24. Initial Load Failure

If:

```http
GET /api/watchlists
```

fails, display an understandable error state.

Prefer the server-provided stable user-facing message where appropriate.

Do not display:

* stack traces;
* raw response objects;
* exception dumps.

A retry button is optional and not required in this task.

---

## 25. Active Watchlist Load Failure

If metadata loads successfully but:

```http
GET /api/watchlists/{id}
```

fails:

* keep the application shell and tabs visible;
* display an error in the content area;
* do not destroy the loaded Watchlist metadata.

This allows the user to attempt another tab.

---

## 26. Tab-Switch Failure

If:

```http
PUT /api/watchlists/active
```

fails:

* keep the previously active Watchlist selected;
* keep its existing content if available;
* show an understandable error indication.

Do not issue the new Watchlist GET after the selection mutation failed.

---

## 27. Watchlist GET Failure After Successful Selection

A different failure mode is:

```text
PUT active succeeds
        |
        v
GET composed Watchlist fails
```

In this case:

* metadata should reflect the server-confirmed active Watchlist;
* the new tab remains active;
* content area shows the load error.

Do not revert the active tab because persistence already succeeded.

This distinction is important.

---

## 28. Warning Preservation

The composed Watchlist API may return:

```text
warnings
```

such as:

```text
FX_PROVIDER_UNAVAILABLE
```

Store these warnings in client state with the active Watchlist.

Do not implement the final warning UI in this task unless a minimal generic indication is trivial.

TASK-023 will handle polished error/warning presentation.

Do not discard warning data.

---

## 29. Client State

Use Svelte 5 state mechanisms appropriate for this page.

Client state should remain UI-oriented.

Likely state includes:

```text
watchlists metadata
activeWatchlistId
active Watchlist view
initial loading
Watchlist loading
error state
```

Do not introduce client-side domain calculations.

Do not create a global state framework.

Do not add Redux-like libraries.

---

## 30. State Scope

This is currently a one-page application.

Prefer page/component-local state or a small client module where useful.

Do not create application-wide stores solely because the application may grow later.

Use the simplest Svelte 5 state structure that remains readable.

---

## 31. No Business Calculations

The client MUST NOT calculate:

* target-price distance;
* dividend yield;
* market-cap USD conversion;
* investment factor;
* savings allocation;
* invested total.

All such values come from server APIs.

---

## 32. No Direct External Provider Access

Browser code MUST NOT call:

* Yahoo Finance;
* Frankfurter;
* Cloudflare KV.

All data flows through the application's REST API.

---

## 33. No Authentication UI

Do not implement:

* login form;
* logout form;
* registration;
* OTP input.

Cloudflare Access remains responsible for authentication.

The SPA simply consumes authenticated API endpoints.

---

## 34. No Watchlist Mutations Yet

Do NOT implement UI controls for:

* creating Watchlists;
* deleting Watchlists;
* adding symbols;
* removing symbols.

The only mutation in this task is:

```text
select active Watchlist
```

because it is intrinsic to tab navigation.

---

## 35. No Stock Table Yet

Do not implement the production stock table.

Specifically do not render columns for:

* symbol;
* name;
* cap;
* price;
* dividend;
* currency;
* target price;
* distance;
* savings amount;
* delete button.

TASK-017 will own the table.

---

## 36. No Filtering or Sorting

Do not implement:

* company-name filter;
* table sorting;
* filtered counts.

These depend on the stock table and belong to later tasks.

---

## 37. No Investment Allocation UI

Do not implement:

* total-savings input;
* calculator button;
* invested display;
* savings amounts.

The REST endpoint exists, but UI work belongs to a later task.

---

## 38. No Final Visual Design

This task establishes the structural visual baseline only.

Aim for:

* readable typography;
* sensible spacing;
* clear active tabs;
* usable mobile layout.

Do not spend substantial effort on:

* animations;
* elaborate theming;
* custom icons;
* visual effects;
* final brand design.

---

## 39. CSS Organization

Keep CSS close to the relevant Svelte components where practical.

Avoid one large global stylesheet containing component-specific rules.

Global CSS may contain only genuinely global concerns such as:

* base box sizing;
* body margin;
* base font;
* background/text defaults.

Do not introduce CSS preprocessors unless already configured.

---

## 40. Component Structure

Split components only where they represent a meaningful UI responsibility.

A reasonable conceptual structure might include:

```text
src/lib/components/
    WatchlistTabs.svelte
```

with page-level orchestration remaining in:

```text
src/routes/+page.svelte
```

This is illustrative.

Do not create:

```text
components/
atoms/
molecules/
organisms/
templates/
```

or another design-system hierarchy for this small application.

---

## 41. Client API Testability

Add tests for the client API layer where they provide meaningful value.

At minimum verify:

* correct endpoint/method for metadata loading;
* correct active-Watchlist PUT request;
* correct composed-Watchlist GET request;
* successful JSON parsing;
* stable API error parsing.

Use an injected/mock fetch or the project's normal client testing pattern.

Do not require live API access.

---

## 42. UI Testing Strategy

Add focused component/page tests where supported by the existing test setup without introducing heavy browser infrastructure.

At minimum test the core state/interaction behavior at the smallest practical level.

Important behaviors to verify include:

* metadata renders as tabs;
* persisted active Watchlist is selected;
* duplicate Watchlist names render as separate tabs;
* no-Watchlists state;
* tab selection invokes the expected API flow;
* failed selection keeps the previous active state;
* successful selection followed by failed Watchlist GET keeps the new tab active but shows content error.

Do not introduce E2E infrastructure solely for this task.

---

## 43. Duplicate Watchlist Names

Explicitly test:

```text
Watchlist id=1 name="Dividend"
Watchlist id=2 name="Dividend"
```

Both must render.

The active state is determined by ID.

Do not key tabs by name.

---

## 44. Accessibility Basics

At minimum:

* use semantic heading structure;
* use real buttons for interactive tabs;
* preserve visible keyboard focus;
* provide accessible active-tab state;
* do not disable browser zoom;
* maintain readable contrast.

Do not introduce accessibility libraries solely for these basics.

---

## 45. Responsive Verification

Manually or through available development tooling verify at least:

### Desktop-like Width

Tabs and content render normally.

### Narrow/Mobile-like Width

* application shell fits the viewport;
* title remains readable;
* tabs remain usable;
* tab overflow does not cause page-level horizontal overflow;
* content remains readable.

Do not claim responsive verification unless it was actually performed.

---

## 46. Runtime Verification

Use the documented Cloudflare runtime for the integrated UI/API flow because the API requires:

* Access context;
* KV binding.

Verify:

```text
open application
    |
    v
GET /api/watchlists
    |
    v
tabs render
    |
    v
select tab
    |
    v
PUT active
    |
    v
GET composed Watchlist
```

Use the synthetic local Access identity.

Do not require production deployment.

---

## 47. Test Data

Local runtime verification may reuse/create local KV Watchlists.

Do not introduce hard-coded production/demo Watchlists into application source code.

Local `.wrangler` data remains development-only.

---

## 48. Architecture Documentation

Update `ARCHITECTURE.md` with targeted client/UI decisions where necessary.

The architecture should make clear that:

* the application is a one-page Svelte UI;
* Watchlist metadata is loaded separately from the active composed Watchlist;
* tabs are identified by Watchlist ID, not name;
* active Watchlist state is persisted server-side;
* tab switching persists the selection before loading the new composed Watchlist;
* client state is UI-oriented;
* business calculations remain server-side;
* responsive layout uses native CSS;
* no general-purpose CSS framework is used;
* tab overflow must remain usable on narrow viewports.

Do not rewrite unrelated architecture sections.

---

## Non-Goals

Do NOT implement:

* stock table;
* stock rows;
* Watchlist creation UI;
* Watchlist deletion UI;
* delete confirmation dialog;
* add-stock UI;
* remove-stock UI;
* Target Price editing;
* filtering;
* sorting;
* table counts;
* investment-allocation UI;
* final warning presentation;
* final loading/error polish;
* login UI;
* CSS framework;
* component library;
* production deployment.

Do not modify backend business behavior unless a genuine API defect prevents this UI task and is reported before changing architecture.

---

## Acceptance Criteria

The task is complete when all of the following are true:

1. The bootstrap page is replaced by a production application shell.
2. The UI uses Svelte 5 and TypeScript.
3. Styling uses native CSS only.
4. No general-purpose CSS/UI framework is introduced.
5. A small client-side Watchlist API boundary exists.
6. Raw fetch calls are not scattered throughout components.
7. Client code imports no `$lib/server` modules.
8. Initial load requests `GET /api/watchlists`.
9. Loading state is distinct from the no-Watchlists state.
10. Zero Watchlists produce an explicit empty state.
11. Watchlists render as tabs.
12. Duplicate Watchlist names render as distinct tabs using IDs.
13. Persisted `activeWatchlistId` determines the initial active tab.
14. Missing active ID with existing Watchlists falls back locally to the first Watchlist.
15. The active Watchlist is loaded through `GET /api/watchlists/{id}`.
16. Composed Watchlist data is retained in client state.
17. Active Watchlist warnings are not discarded.
18. The temporary content area shows Watchlist name and stock count.
19. Empty active Watchlist produces an explicit empty state.
20. Selecting another tab calls `PUT /api/watchlists/active`.
21. Successful selection then loads the selected composed Watchlist.
22. Selecting the already active tab performs no redundant mutation.
23. Failed active-selection mutation preserves the previous active tab/content.
24. Successful selection followed by failed composed-Watchlist load keeps the new tab active and shows an error.
25. Initial metadata failure produces an understandable page error.
26. Active-Watchlist load failure leaves tabs usable.
27. Client state remains UI-oriented.
28. No business calculations are implemented client-side.
29. No direct Yahoo/Frankfurter/KV access occurs from the browser.
30. No Watchlist create/delete controls are implemented.
31. No stock add/remove controls are implemented.
32. No production stock table is implemented.
33. No filtering or sorting is implemented.
34. No Target Price editing is implemented.
35. No investment-allocation UI is implemented.
36. Tabs use accessible interactive elements.
37. Active-tab state is programmatically identifiable.
38. Keyboard focus remains visible.
39. Application shell is responsive.
40. Tab overflow remains usable on narrow viewports.
41. Page-level horizontal overflow is not introduced by the shell.
42. Client API behavior is tested.
43. Core tab/state behavior is tested at the smallest practical level.
44. Integrated UI/API tab flow is verified under the Cloudflare runtime.
45. Narrow and desktop-like viewport behavior is actually checked.
46. `ARCHITECTURE.md` reflects the relevant UI/client decisions.
47. Existing project checks still pass.
48. No unnecessary production dependency is introduced.

---

## Verification

Before completing the task, execute:

```bash
npm run check
npm run test
npm run lint
npm run build
```

Additionally:

1. run the documented Cloudflare runtime;
2. verify initial Watchlist metadata loading;
3. verify active Watchlist loading;
4. verify tab switching with at least two local Watchlists;
5. verify duplicate Watchlist names remain distinct if practical;
6. inspect desktop-like layout;
7. inspect narrow/mobile-like layout.

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
2. final page/component structure;
3. client API structure and functions;
4. client API types introduced;
5. initial metadata-loading flow;
6. active-Watchlist-loading flow;
7. client-state design;
8. tab component/semantics;
9. duplicate-name handling;
10. active-tab persistence flow;
11. initial/no-Watchlist/loading states;
12. tab-switch loading behavior;
13. selection-failure behavior;
14. post-selection Watchlist-load-failure behavior;
15. API-error handling;
16. warning preservation;
17. responsive CSS strategy;
18. accessibility behavior;
19. tests added;
20. Cloudflare-runtime UI/API verification;
21. desktop-like viewport verification;
22. narrow/mobile viewport verification;
23. changes made to `ARCHITECTURE.md`;
24. results of `check`, `test`, `lint`, and `build`;
25. confirmation that no stock table or mutation UI was implemented;
26. confirmation that no CSS/UI framework was introduced;
27. confirmation that this task's status was changed to `Done`;
28. assumptions or unresolved issues;
29. deviations from this task or `ARCHITECTURE.md`.

Do not proceed to the stock table or other Watchlist UI features.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
