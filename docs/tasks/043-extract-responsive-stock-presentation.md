# TASK-043: Extract Responsive Stock Presentation

## Status

Done

## Goal

Perform the second implementation phase recommended by TASK-041 by extracting responsive stock-presentation responsibility from `src/routes/+page.svelte`.

TASK-036 introduced two stock presentations:

```text
wide viewport
→ WatchlistTable

constrained viewport
→ WatchlistCards
```

The current page still owns:

* the responsive `presentationMode` state;
* browser-width/breakpoint observation;
* Table/Card selection;
* the mutually exclusive rendering of `WatchlistTable` and `WatchlistCards`.

TASK-041 identified this as presentation responsibility that does not need to live at page-orchestration level.

TASK-043 introduces a dedicated component, conceptually:

```text
StockPresentation
```

that owns the responsive choice between Table and Cards.

After this task, the page should conceptually become:

```text
+page.svelte
│
├── WatchlistTabs
├── StockAddForm
├── Company filter
├── InvestmentAllocationControls
└── StockPresentation
      ├── WatchlistTable
      └── WatchlistCards
```

The component receives the already derived stock data and existing callbacks/state required by both presentations.

It does **not** own filtering, sorting, allocation lifecycle, Watchlist state, or mutation orchestration.

This is a behavior-preserving presentation refactoring.

Do not introduce the `WatchlistWorkspace` abstraction yet.

---

# Architectural Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* `docs/architecture/frontend-architecture-audit.md`
* TASK-023;
* TASK-024;
* TASK-031;
* TASK-032;
* TASK-033;
* TASK-034;
* TASK-036;
* TASK-041;
* TASK-042;
* current `src/routes/+page.svelte`;
* current `WatchlistTable.svelte`;
* current `WatchlistCards.svelte`;
* current `TargetPriceCell.svelte`;
* current `watchlistPresentation.ts`;
* current `sortableStockColumns.ts`;
* current responsive-related Playwright tests;
* this task completely.

Inspect the current TASK-042 state before implementation.

Do not assume the exact `+page.svelte` structure from earlier task descriptions.

---

# TASK-041 Decision

## 1. Accepted Extraction

TASK-041 identified responsive Table/Card selection as a coherent presentation responsibility.

Implement a dedicated component:

```text
src/lib/components/StockPresentation.svelte
```

or a repository-consistent equivalent.

---

## 2. Responsibility

Its responsibility is:

> Render the current visible stock collection using the appropriate responsive presentation and own the browser-level Table/Card presentation-mode lifecycle.

---

## 3. What It Does Not Own

`StockPresentation` must not own:

* Watchlist loading;
* active Watchlist selection;
* company-name filter state;
* filtering algorithm;
* sort state;
* sorting algorithm;
* investment-allocation lifecycle;
* stock mutation workflows;
* Target Price mutation workflow;
* `managementBusy`;
* API calls;
* shell calls.

---

# Existing Presentation Rule

## 4. Preserve Breakpoint

TASK-036 empirically established:

```text
STOCK_CARD_PRESENTATION_BREAKPOINT_PX = 1120
```

Preserve this breakpoint.

Do not re-evaluate or change it during this refactoring.

---

## 5. Presentation Semantics

Preserve exactly:

```text
viewport width < 1120
→ Cards

viewport width >= 1120
→ Table
```

---

## 6. One Active Presentation

Preserve TASK-036's accessibility-critical rule:

> Table and Cards are mutually exclusive in the rendered component tree.

Do not render both and hide one with CSS.

This prevents duplicate:

* Target Price inputs;
* stock remove actions;
* stock content

in the accessibility tree.

---

# Existing Helper

## 7. `watchlistPresentation.ts`

Inspect the existing helper introduced by TASK-036.

Expected responsibilities include:

```text
presentation mode type
breakpoint constant
viewport-width → presentation-mode mapping
```

Confirm actual code.

---

## 8. Preserve Pure Mapping

The viewport-width-to-mode mapping should remain a pure helper.

Do not move pure breakpoint logic into ad hoc component conditionals if the existing helper already models it clearly.

---

## 9. Naming Collision

TASK-041 identified a low-severity naming concern between:

```text
watchlistPresentation.ts
```

and:

```text
StockPresentation.svelte
```

Do not rename the helper in TASK-043 unless the collision creates a genuine readability problem during implementation.

A potential rename belongs to optional TASK-045.

Document the resulting naming assessment.

---

# Responsive State Ownership

## 10. Move `presentationMode`

Move the current:

```text
presentationMode
```

state from `+page.svelte` into `StockPresentation.svelte`.

Use the actual current state representation.

---

## 11. Move Breakpoint Observation

Move the browser-level logic that observes crossing the 1120px breakpoint into `StockPresentation`.

This includes the current equivalent of:

```text
window.innerWidth
matchMedia
media-query listener
cleanup
```

where actually used.

---

## 12. Page Must Not Know Viewport Mode

After TASK-043, `+page.svelte` should not need to know whether the stock presentation is currently:

```text
table
```

or:

```text
cards
```

unless a concrete remaining page-level behavior genuinely requires it.

If such a dependency exists, stop and document it before broadening the design.

---

# Svelte / SSR Safety

## 13. Preserve SSR Safety

TASK-036 deliberately guarded browser-only APIs.

Preserve safe SvelteKit server rendering/build behavior.

Do not access:

```text
window
matchMedia
```

unconditionally during SSR.

---

## 14. Lifecycle Cleanup

Responsive listeners must be removed correctly when the component is destroyed.

Do not introduce leaked media-query listeners.

---

## 15. No Global Singleton

Do not move responsive state into a module-level mutable singleton.

Presentation mode belongs to the component instance.

---

# Component Inputs

## 16. Use Existing Derived Stocks

`StockPresentation` receives the already-derived:

```text
visibleStocks
```

or current equivalent from the page.

It must not receive raw stocks merely to re-run filtering/sorting internally.

---

## 17. No Filtering

Do not import or call:

```text
filterStocksByCompanyName
```

inside `StockPresentation`.

---

## 18. No Sorting Algorithm

Do not call:

```text
sortWatchlistStocks
```

inside `StockPresentation`.

The supplied stocks are already ordered.

---

# Sort State

## 19. Existing Sort State Remains Page-Owned

The current:

```text
sort
```

state remains in `+page.svelte`.

It is workspace state, not responsive-presentation state.

---

## 20. Why Sort Must Cross the Boundary

Both presentations need the same sort state differently:

```text
Table
→ sortable headers

Cards
→ explicit sort controls
```

Therefore `StockPresentation` may receive the current sort and sort callback and pass them to the active presentation.

This is a cohesive presentation dependency.

---

## 21. No Card-Specific Sort State

Do not introduce a second sort state.

---

# Allocation Presentation

## 22. Allocation Lookup

Pass the existing allocation data/lookup needed by Table and Cards through `StockPresentation`.

Do not recompute investment allocation.

---

## 23. Allocation Lifecycle

Do not move:

```text
investmentAllocation
```

ownership or invalidation rules into `StockPresentation`.

---

# Target Price

## 24. Existing Callback

Pass the existing Target Price save callback/state required by Table/Cards through `StockPresentation`.

---

## 25. No Target Price Workflow

`StockPresentation` must not import:

```text
watchlistShell
watchlistApi
```

or perform the Target Price mutation itself.

---

## 26. Existing Cell Reuse

Table/Card components continue using the established `TargetPriceCell` behavior.

Do not refactor it.

---

# Stock Removal

## 27. Existing Callback

Pass the existing stock-removal callback/state through `StockPresentation`.

---

## 28. No Remove Workflow

Do not perform API/shell operations inside `StockPresentation`.

---

# Busy State

## 29. Existing Busy Inputs

Pass only the busy/disabled state needed by Table/Cards.

Do not move `managementBusy` calculation into `StockPresentation`.

---

# Component API

## 30. Explicit Props

Design a clear explicit prop API based on the shared needs of Table and Cards.

Likely categories include:

```text
stocks
sort
allocationBySymbol
busy state
Target Price save callback
stock remove callback
sort callback
```

Use actual current props.

---

## 31. Avoid Page Dump

Do not pass:

```text
activeView
```

as one large object merely because Table/Cards need several values that can be passed more explicitly.

However, if both existing components already consume a cohesive object and changing that would increase complexity, preserve the existing interface.

Document the decision.

---

## 32. No Unrelated Props

`StockPresentation` must not receive:

* Watchlist creation state;
* Watchlist navigation errors;
* Stock Add draft;
* company filter text;
* Total Savings draft;
* allocation form errors.

---

# Pass-Through Concern

## 33. Avoid Meaningless Wrapper

The new component must do more than:

```svelte
{#if mode === 'table'}
  <WatchlistTable {...everything} />
{:else}
  <WatchlistCards {...everything} />
{/if}
```

while leaving responsive state in the page.

Its architectural value is that it owns the **responsive presentation lifecycle**.

A small pass-through prop surface is acceptable because Table and Cards intentionally expose equivalent stock interactions.

---

# Table

## 34. Preserve Table Behavior

Do not change:

* columns;
* column widths;
* sorting;
* formatting;
* Savings Amount tooltip;
* Distance highlighting;
* Target Price editing;
* stock removal;
* accessibility.

---

# Cards

## 35. Preserve Card Behavior

Do not change:

* Card hierarchy;
* one/two-column responsive Card grid;
* sort controls;
* Price/Currency grouping;
* Target Price editing;
* Distance highlighting;
* Savings Amount;
* stock removal;
* accessibility.

---

# Card Grid Breakpoints

## 36. Preserve Existing Card Grid

TASK-036 established Card mode with:

```text
wider constrained viewport
→ two Cards per row

narrow viewport
→ one Card per row
```

Preserve the current CSS breakpoints.

Do not revisit them.

---

# Resize Behavior

## 37. State Preservation

Crossing 1120px must preserve:

* active Watchlist;
* filter;
* sort column;
* sort direction;
* investment allocation;
* stock data;
* Target Price values.

---

## 38. No Network Request

Resizing across the breakpoint must continue to trigger zero API requests.

---

## 39. Presentation Only

The only consequence of crossing the breakpoint is replacing:

```text
WatchlistTable
```

with:

```text
WatchlistCards
```

or vice versa.

---

# Initial Rendering

## 40. Initial Mode

Preserve current behavior for determining the initial presentation mode after client initialization.

---

## 41. Hydration

Avoid introducing a visible/interactive duplicate presentation during hydration.

If the existing implementation has a deliberate initial SSR mode, preserve its behavior unless extraction requires a narrowly justified adjustment.

Document any hydration consideration.

---

# Empty / No-Match States

## 42. Page Ownership

Inspect where these states are currently rendered:

```text
This watchlist is empty.
No stocks match the current filter.
```

Do not automatically move them into `StockPresentation`.

---

## 43. Preferred Boundary

If `StockPresentation` currently only renders when there are visible stocks, preserve that division unless moving stock-presentation-specific empty markup clearly improves responsibility.

Avoid scope creep.

---

# Count Footer

## 44. Preserve Ownership

The:

```text
Total: N stocks · Filtered: M stocks
```

footer should remain where it currently belongs unless the current implementation proves it is inseparable from Table/Card presentation.

Do not move it merely to make the page shorter.

---

# CSS

## 45. Move Presentation-Specific CSS Only

If `+page.svelte` contains CSS used solely for the Table/Card presentation wrapper or breakpoint handling, move it to `StockPresentation`.

---

## 46. Page Layout CSS

CSS controlling the relationship between:

* toolbar;
* stock presentation;
* count footer

may remain page/global.

---

## 47. No Visual Change

This is not a design task.

Screenshots before/after should be materially equivalent.

---

# Accessibility

## 48. Exactly One Presentation

Verify only one set of interactive stock controls exists in the accessibility tree.

---

## 49. Target Price

At any viewport, a representative stock has exactly one accessible:

```text
Target price for <symbol>
```

input.

---

## 50. Remove Action

At any viewport, a representative stock has exactly one accessible:

```text
Remove <symbol>
```

action.

---

## 51. Card Sort Controls

Card sort controls remain accessible only when Card presentation is active.

---

## 52. Table Sort Controls

Table sortable headers remain accessible only when Table presentation is active.

---

# Existing Presentation-Agnostic Test Helpers

## 53. `stockLocators.ts`

TASK-036 introduced presentation-agnostic E2E locators.

Preserve/use them where appropriate.

Do not regress toward brittle Table-only selectors for cross-presentation workflows.

---

# Testing Strategy

## 54. No New Business Tests

This task changes no business behavior.

Do not duplicate sort/filter/allocation tests unnecessarily.

---

## 55. Existing Presentation Tests

Preserve the current Table/Card tests covering:

* breakpoint behavior;
* exactly one presentation;
* Card content;
* Table content;
* sorting;
* filtering;
* Target Price;
* allocation;
* removal;
* no API request on resize.

---

# Focused Characterization

## 56. Before Refactoring

Run focused existing tests that cover the responsive presentation before modifying code.

At minimum include the current specs responsible for:

```text
stock cards
responsive layout
table behavior
sorting
Target Price
```

Use actual filenames.

---

# New/Updated E2E Assertions

## 57. Page No Longer Owns Mode — Behavior Still Same

No E2E test should depend on the internal ownership change.

Behavioral tests remain the contract.

---

## 58. Breakpoint Boundary

Verify:

```text
1119px
→ Cards

1120px
→ Table
```

or the existing exact boundary tests.

---

## 59. Resize

Preserve explicit test:

```text
Card → Table
Table → Card
```

with state retained.

---

## 60. No API on Resize

Preserve the explicit zero-request assertion.

---

## 61. Duplicate Controls

Add or retain an assertion proving a representative stock has only one Target Price input/remove action after presentation switching.

This protects the mutually exclusive rendering requirement.

Do not add redundant coverage if already present.

---

# Unit Tests

## 62. Pure Helper

Existing `watchlistPresentation.spec.ts` remains authoritative for:

```text
viewport width
→ presentation mode
```

Do not move these tests into browser E2E.

---

## 63. No Component-Test Framework

Do not introduce a Svelte component-test harness solely for this extraction.

---

# Page Readability

## 64. Expected Result

After TASK-043, `+page.svelte` should no longer contain:

* `presentationMode` state;
* Table/Card breakpoint listener;
* Table/Card conditional markup.

---

## 65. Page Still Owns Visible Stocks

The page continues to derive:

```text
visibleStocks
```

from filter + sort state.

---

## 66. Page Still Owns Sort

The page continues to own sort lifecycle/reset rules until TASK-044.

---

## 67. Page Still Owns Allocation

The page continues to own allocation state/invalidation until TASK-044.

---

# Dependency Direction

## 68. Desired Dependency

Conceptually:

```text
+page.svelte
    ↓
StockPresentation
    ├── WatchlistTable
    └── WatchlistCards
```

---

## 69. Client Helper

```text
StockPresentation
    ↓
watchlistPresentation.ts
```

for pure presentation-mode calculation is acceptable.

---

## 70. No Shell/API

`StockPresentation` must not import:

```text
watchlistShell
watchlistApi
```

---

## 71. No Server Import

It must not import:

```text
$lib/server
```

---

# Existing Components

## 72. No Unnecessary Refactoring

Do not refactor internals of:

```text
WatchlistTable
WatchlistCards
TargetPriceCell
WatchlistTabs
StockAddForm
InvestmentAllocationControls
```

unless a minimal prop/type consequence is required.

---

# TASK-044 Preparation

## 73. Do Not Implement Workspace Early

Do not move:

```text
filter
sort
allocation
operation states
errors
activeView
watchlists
```

into a workspace module.

---

## 74. Make Remaining Page Responsibilities Visible

One objective of TASK-043 is to make the remaining state/workflow responsibility in `+page.svelte` easier to identify before TASK-044.

Do not hide those workflows behind unrelated abstractions.

---

# Architecture Documentation

## 75. Frontend Audit

Update:

```text
docs/architecture/frontend-architecture-audit.md
```

with a concise TASK-043 implementation-status note.

Record that responsive stock-presentation ownership has moved from route to component.

Do not rewrite the original audit.

---

## 76. `ARCHITECTURE.md`

Add/update a concise statement that:

```text
StockPresentation
→ owns responsive Table/Card selection

+page.svelte
→ supplies already filtered/sorted stocks and workflow callbacks
```

Do not document the future Workspace as implemented.

---

# Historical Tasks

## 77. TASK-036

If useful, add a concise supersession/architecture note that TASK-043 later moved the established responsive presentation lifecycle into a dedicated component without changing the 1120px rule.

Keep Done.

---

## 78. TASK-041

Add a concise follow-up note if consistent with current convention.

Keep Done.

---

# No Naming Cleanup Yet

## 79. `watchlistPresentation.ts`

Do not rename merely because `StockPresentation.svelte` now exists.

If the resulting names are genuinely confusing after implementation, report that for TASK-045.

---

# Non-Goals

Do NOT implement:

* WatchlistWorkspace;
* ViewModel;
* rune-based page state;
* Svelte Context;
* global stores;
* independent feature stores;
* CompanyFilter component;
* workspace toolbar component;
* `watchlistShell` refactoring;
* `watchlistApi` refactoring;
* filter-state migration;
* sort-state migration;
* allocation-state migration;
* error-state migration;
* busy-state migration;
* breakpoint changes;
* Card-grid breakpoint changes;
* Table redesign;
* Card redesign;
* UI changes;
* directory restructuring;
* broad module renaming;
* new component-test framework;
* server/API changes;
* production deployment;
* unrelated cleanup.

---

# Acceptance Criteria

The task is complete when all of the following are true:

1. `StockPresentation.svelte` exists.
2. It owns responsive Table/Card presentation.
3. `presentationMode` no longer lives in `+page.svelte`.
4. 1120px breakpoint remains unchanged.
5. Existing pure presentation helper remains reused.
6. Browser breakpoint observation lives with `StockPresentation`.
7. Responsive listener cleanup is correct.
8. SSR safety is preserved.
9. No module-level mutable singleton is introduced.
10. `+page.svelte` does not need to know current Table/Card mode.
11. `visibleStocks` remains page-derived.
12. Filtering remains page/workspace responsibility.
13. Sorting algorithm remains outside `StockPresentation`.
14. Sort state remains page-owned.
15. Allocation state remains page-owned.
16. Allocation invalidation remains page-owned.
17. Target Price workflow remains page-owned.
18. Stock-removal workflow remains page-owned.
19. `managementBusy` remains page-owned.
20. `StockPresentation` receives only cohesive presentation dependencies.
21. It does not receive unrelated form/navigation state.
22. It does not import `watchlistShell`.
23. It does not import `watchlistApi`.
24. It does not import server-only modules.
25. Table and Cards remain mutually exclusive.
26. Exactly one Target Price control exists per rendered stock.
27. Exactly one remove action exists per rendered stock.
28. Table sort controls appear only in Table mode.
29. Card sort controls appear only in Card mode.
30. Table behavior is unchanged.
31. Card behavior is unchanged.
32. Card one/two-column responsive layout is unchanged.
33. Savings Amount tooltip behavior is unchanged.
34. Distance presentation is unchanged.
35. Target Price behavior is unchanged.
36. Stock removal is unchanged.
37. Filter behavior is unchanged.
38. Sort behavior is unchanged.
39. Allocation behavior is unchanged.
40. 1119px remains Card mode.
41. 1120px remains Table mode.
42. Resize preserves active Watchlist.
43. Resize preserves filter.
44. Resize preserves sort.
45. Resize preserves allocation.
46. Resize triggers no API requests.
47. No page-level horizontal overflow regression occurs.
48. No duplicate interactive presentation exists during normal rendering.
49. Company filter remains inline.
50. StockAddForm remains unchanged in responsibility.
51. InvestmentAllocationControls remains unchanged in responsibility.
52. No Workspace/ViewModel/store/context is introduced.
53. `watchlistShell` remains unchanged.
54. `watchlistApi` behavior remains unchanged.
55. No breakpoint is redesigned.
56. Existing pure-helper unit tests remain green.
57. Existing responsive E2E remains green.
58. E2E assertions are not weakened.
59. `+page.svelte` is easier to read as composition/workflow orchestration.
60. Frontend audit records TASK-043 implementation status.
61. `ARCHITECTURE.md` reflects the implemented presentation boundary.
62. No unnecessary dependency is introduced.
63. No production deployment occurs.

---

# Verification

Before completing the task, execute:

```bash
npm run test
npm run test:e2e
npm run check
npm run lint
npm run build
```

Additionally verify explicitly:

1. baseline responsive tests before refactoring;
2. 1119px → Cards;
3. 1120px → Table;
4. 375px Card presentation;
5. 768px Card presentation;
6. 1280px Table presentation;
7. 1600px Table presentation;
8. Card one-column behavior;
9. Card two-column behavior;
10. Table sorting;
11. Card sorting;
12. filter in Card mode;
13. filter in Table mode;
14. Target Price in Card mode;
15. Target Price in Table mode;
16. stock removal in Card mode;
17. stock removal in Table mode;
18. allocation display in both presentations;
19. Savings Amount tooltip in Table mode;
20. resize Card → Table;
21. resize Table → Card;
22. sort preserved across resize;
23. filter preserved across resize;
24. allocation preserved across resize;
25. zero API calls caused by resize;
26. only one Target Price control per representative stock;
27. only one remove control per representative stock;
28. no visual regression at representative widths;
29. `+page.svelte` no longer owns presentation mode/listener;
30. `StockPresentation` has no shell/API/server dependency.

Do not report verification as successful unless actually executed successfully.

Do NOT deploy production.

---

# Task Status

After implementation, verification, documentation, and review are complete, change:

```text
Status: Ready
```

to:

```text
Status: Done
```

Do not modify unrelated task statuses.

---

# Completion Report

When finished, report:

1. files added/changed;
2. `+page.svelte` before/after size;
3. `StockPresentation` final responsibility;
4. final component prop/callback API;
5. `presentationMode` ownership;
6. breakpoint-observation implementation;
7. SSR-safety approach;
8. listener-cleanup behavior;
9. use of `watchlistPresentation.ts`;
10. naming-collision assessment;
11. `visibleStocks` ownership;
12. sort-state ownership;
13. allocation-state ownership;
14. Target Price workflow ownership;
15. stock-removal workflow ownership;
16. busy-state ownership;
17. proof no shell/API/server dependency exists;
18. Table/Card mutual-exclusion approach;
19. accessibility duplicate-control verification;
20. breakpoint-boundary verification;
21. resize/state-preservation verification;
22. no-request-on-resize verification;
23. Table behavior verification;
24. Card behavior verification;
25. tests added/changed;
26. E2E selector changes, if any;
27. results of `test`, `test:e2e`, `check`, `lint`, and `build`;
28. architecture-audit update;
29. `ARCHITECTURE.md` changes;
30. historical task notes;
31. confirmation no Workspace/ViewModel/store/context was introduced;
32. confirmation no product behavior changed;
33. confirmation no production deployment occurred;
34. confirmation task status changed to Done;
35. assumptions or unresolved issues;
36. deviations from TASK-041/TASK-043 or `ARCHITECTURE.md`.

Do not proceed to TASK-044.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
