# TASK-044: Extract Watchlist Workspace State and Workflow Lifecycle

## Status

Ready

## Goal

Perform the central frontend architecture refactoring recommended by TASK-041.

Extract the coupled page-level reactive state, derived workspace state, operation lifecycle, and user-workflow orchestration currently owned by `src/routes/+page.svelte` into a dedicated, **per-page-instance** Svelte 5 rune-based workspace abstraction.

Conceptually:

```text
+page.svelte
    ↓
create one WatchlistWorkspace instance
    ↓
render components from workspace state
    ↓
forward user intents to workspace methods


WatchlistWorkspace
├── server-derived client state
├── workspace state
├── operation/error state
├── derived state
├── transition/invalidation rules
│
└── workflows
    ├── load()
    ├── selectWatchlist()
    ├── createWatchlist()
    ├── deleteWatchlist()
    ├── addStock()
    ├── removeStock()
    ├── saveTargetPrice()
    └── calculateAllocation()
             ↓
        watchlistShell
             ↓
        watchlistApi
```

The purpose is not simply to reduce `+page.svelte` line count.

The primary goals are:

* make state ownership explicit;
* give the repeated mutation lifecycle a clear architectural home;
* make coupled transition rules locally understandable;
* make important state transitions directly unit-testable;
* keep the route focused on composition;
* preserve the existing clean `watchlistShell`, `watchlistApi`, pure helpers, and component boundaries.

This is a behavior-preserving architecture refactoring.

Do not redesign the product.

---

# Architectural Basis

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* `docs/architecture/frontend-architecture-audit.md`
* TASK-016 through TASK-040 where relevant;
* TASK-041;
* TASK-042;
* TASK-043;
* current `src/routes/+page.svelte`;
* current `src/lib/client/watchlistShell.ts`;
* current `src/lib/client/watchlistApi.ts`;
* all current client helpers;
* all current Svelte components;
* current unit tests;
* current Playwright tests;
* this task completely.

TASK-041 is the primary design input.

TASK-042 and TASK-043 have already removed presentation responsibilities that should not be part of the Workspace.

Inspect the actual post-TASK-043 code before implementation.

---

# Core Architectural Decision

## 1. Introduce One Workspace Abstraction

Introduce one cohesive abstraction conceptually named:

```text
WatchlistWorkspace
```

The implementation is expected to use a Svelte 5 rune-capable module such as:

```text
src/lib/client/watchlistWorkspace.svelte.ts
```

or another repository-consistent client-safe location.

---

## 2. Factory / Per-Page Instance

The Workspace MUST be instantiated separately for each page instance.

Conceptually:

```ts
const workspace = createWatchlistWorkspace(...);
```

or:

```ts
const workspace = new WatchlistWorkspace(...);
```

The exact implementation may differ.

---

## 3. No Imported Mutable Singleton

Do NOT implement:

```ts
export const workspace = $state(...);
```

as shared module-level mutable state.

This is an explicit architectural prohibition.

---

## 4. SvelteKit Safety

The design must not allow mutable frontend workspace state to be shared:

* between requests;
* between SSR executions;
* between independent page instances;
* between tests.

Per-instance ownership must be obvious from the code.

---

# Workspace Responsibility

## 5. Responsibility Statement

`WatchlistWorkspace` should have one concise responsibility:

> Own the reactive state and lifecycle of one rendered Watchlist workspace and coordinate existing stateless client operations into consistent page-state transitions.

---

## 6. It Is Not a Domain Model

Do not move server-domain logic into the Workspace.

The Workspace does not become a client reimplementation of:

* WatchlistService;
* allocation formulas;
* MarketDataProvider;
* Target Price domain logic.

---

## 7. It Is Not HTTP Transport

The Workspace must not implement raw:

```text
fetch()
```

calls.

HTTP remains behind the existing client API/shell boundary.

---

# Preserve Existing Layers

## 8. `watchlistApi`

TASK-041 found `watchlistApi` to be a clean HTTP transport boundary.

Preserve that responsibility.

Conceptually:

```text
watchlistApi
→ HTTP
```

Do not move HTTP implementation into the Workspace.

---

## 9. `watchlistShell`

TASK-041 found `watchlistShell` to be clean, stateless client application orchestration.

Preserve it.

Conceptually:

```text
watchlistShell
→ stateless async operations around watchlistApi
```

---

## 10. Workspace vs Shell

The final implementation must maintain a clear distinction:

```text
WatchlistWorkspace
→ stateful
→ owns reactive page lifecycle
→ applies success/failure/reset/invalidation rules

watchlistShell
→ stateless
→ executes individual client operations
→ returns results to caller
```

If implementation reveals that this distinction does not hold for a particular existing shell function, document the issue before broadening scope.

---

# Pure Helpers

## 11. Preserve Pure Functions

Continue using existing pure helpers for concerns such as:

* filtering;
* sorting;
* allocation lookup;
* count formatting;
* Stock Symbol parsing;
* input parsing;
* presentation-independent calculations.

Do not copy their algorithms into the Workspace.

---

## 12. Workspace Composes Helpers

The Workspace may use pure helpers to derive state.

Conceptually:

```text
workspace.activeView.stocks
        ↓
filterStocksByCompanyName(...)
        ↓
sortWatchlistStocks(...)
        ↓
workspace.visibleStocks
```

---

# State Migration

## 13. Audit Current State First

Before editing, compare current `+page.svelte` state against TASK-041's inventory.

Record any differences introduced by TASK-042/TASK-043.

Do not blindly migrate a stale list.

---

## 14. Server-Derived Client State

Expected candidates for Workspace ownership include current equivalents of:

```text
watchlists
activeWatchlistId
activeView
```

These values originate from the server but are retained/reactively updated for the current page.

Confirm actual code.

---

## 15. Workspace UI State

Expected candidates include:

```text
companyNameFilter
sort
```

These are page-level UI state coupled to active-Watchlist lifecycle.

---

## 16. Transient Allocation State

The current:

```text
investmentAllocation
```

or equivalent should move to Workspace ownership because:

* it is used across Table/Cards;
* it is invalidated by several mutation workflows;
* it is reset on active-Watchlist transitions.

---

# Form Draft State

## 17. Reassess After TASK-042

TASK-042 deliberately left form draft state in `+page.svelte`.

Now reassess it in the context of Workspace lifecycle.

Expected examples:

```text
newWatchlistName
newStockSymbol
totalSavingsInput
```

Use actual names.

---

## 18. Move Only When Lifecycle Is Workspace-Level

A draft should move into the Workspace if its lifecycle depends on workflow success/failure or cross-component transitions.

Examples:

```text
stock-add success
→ clear stock symbol

stock-add failure
→ preserve/normalize stock symbol
```

That is evidence of Workspace-level lifecycle.

---

## 19. Truly Local State Stays Local

Do not centralize state merely because the Workspace exists.

State that is correctly local remains local.

TASK-041 examples include:

```text
TargetPriceCell draft/save state
WatchlistTabs disclosure/capacity state
StockPresentation responsive mode
```

These must remain component-owned.

---

# Presentation State

## 20. Do Not Pull Presentation Back Up

TASK-043 moved:

```text
presentationMode
```

into `StockPresentation`.

Leave it there.

---

## 21. Navigation Responsive State

Leave responsive navigation capacity/disclosure inside `WatchlistTabs`.

---

# Operation State

## 22. Inventory Operation States

Move page-level operation states that represent Workspace workflows into the Workspace.

Use actual current variables.

Likely categories include:

```text
initial load
Watchlist selection
Watchlist creation
Watchlist deletion
stock mutation
Target Price mutation
allocation calculation
```

---

## 23. Preserve Existing Semantics

Do not redesign statuses merely because they move.

If current state is:

```text
idle | loading | ...
```

or equivalent, preserve its semantics unless a tiny consolidation is demonstrably behavior-neutral and improves clarity.

---

## 24. No State-Machine Framework

Do not introduce XState or another state-machine dependency.

---

# Error State

## 25. Move Workflow Errors

Page-level errors associated with Workspace workflows should move with the corresponding workflow lifecycle.

Examples may include:

```text
load error
selection error
create error
delete error
stock mutation error
allocation error
```

Use actual current states.

---

## 26. Preserve Error Separation

Do not collapse all errors into:

```ts
error: string | undefined
```

if doing so loses workflow ownership.

A developer should still be able to distinguish:

```text
create failure
stock-add failure
allocation failure
```

---

## 27. Component-Local Errors Stay Local

Do not move Target Price draft validation or other genuinely component-local errors into the Workspace.

---

# `managementBusy`

## 28. Move Aggregate Busy State

The current derived:

```text
managementBusy
```

should normally become Workspace-derived state because it aggregates several Workspace operation lifecycles.

Confirm from actual code.

---

## 29. Preserve Serialization

The exact existing concurrency semantics must remain.

TASK-044 must not allow two mutations that were previously mutually exclusive to execute concurrently.

---

## 30. No New Queue

Do not introduce request queuing or reconciliation logic.

---

# Derived State

## 31. Move Workspace-Level Derivations

Expected derived values to migrate include current equivalents of:

```text
filteredStocks
visibleStocks
totalStockCount
stockCountText
allocationBySymbol
managementBusy
```

Confirm actual code.

---

## 32. Keep Presentation-Specific Derivation Local

Do not move responsive Table/Card mode into Workspace.

---

## 33. Avoid Mutable Counters

Continue deriving counts from source arrays.

---

# Filter State

## 34. Workspace Owns Filter

`companyNameFilter` should move to Workspace ownership because its reset lifecycle is coupled to active-Watchlist transitions.

---

## 35. Filter Helper Remains Pure

Filtering algorithm remains in existing helper.

---

## 36. Existing Semantics

Preserve:

* immediate local filtering;
* name-only matching;
* case-insensitive contains;
* max length 100;
* no API request;
* same-Watchlist mutation preservation;
* active-Watchlist transition reset.

---

# Sort State

## 37. Workspace Owns Sort

Move sort state into Workspace ownership.

---

## 38. Default Sort

Preserve:

```text
Name ascending
```

as the default/reset sort.

---

## 39. Existing Helper

Continue using:

```text
sortWatchlistStocks
toggleWatchlistSort
DEFAULT_WATCHLIST_SORT
```

or actual current equivalents.

---

## 40. Existing Semantics

Preserve:

* new column starts ascending;
* active column toggles;
* missing values last;
* stable ordering;
* same-Watchlist mutation preservation;
* active-Watchlist transition reset.

---

# Allocation State

## 41. Workspace Owns Allocation Result

Move current allocation result into Workspace.

---

## 42. Preserve Invalidation Rules

The audit identified allocation invalidation as a major cross-workflow rule.

Preserve all current invalidation triggers exactly.

Expected triggers include successful:

```text
active Watchlist transition
stock add
stock remove
Target Price save
```

Confirm actual current implementation.

---

## 43. Failures Preserve Allocation

Where current semantics preserve allocation after failed mutation, retain that behavior.

---

## 44. Filter/Sort Do Not Invalidate

Filtering and sorting remain presentation-only and must not invalidate allocation.

---

## 45. Input Editing Does Not Invalidate

Editing Total Savings text without calculation must not erase the existing allocation result if current behavior preserves it.

---

# Active Watchlist Transition

## 46. Centralize Transition Rule

The current active-Watchlist transition is repeated across:

* direct tab selection;
* create success;
* delete replacement.

Move the common state consequence into one clear Workspace-level operation/helper.

Conceptually:

```text
applyActiveWatchlistTransition(...)
```

The exact name may differ.

---

## 47. Transition Consequences

Preserve the current coupled rule:

```text
active Watchlist changes
    ↓
server-derived active state updated
filter reset
sort reset to Name ascending
allocation cleared
```

Include any other actual current consequences.

---

## 48. Success Only

Do not apply reset consequences on failed transitions.

---

# Initial Load

## 49. Workspace Method

Move initial loading lifecycle into a clearly named Workspace method such as:

```text
load()
```

or equivalent.

---

## 50. Preserve Initial Behavior

Preserve:

* initial loading state;
* server-loaded Watchlist list;
* active Watchlist behavior;
* initial default sort;
* initial filter;
* initial allocation absence;
* existing errors.

---

## 51. Route Lifecycle

`+page.svelte` may still trigger the initial Workspace load through its normal Svelte lifecycle.

The Workspace owns what loading means for state.

---

# Select Watchlist Workflow

## 52. Workspace Method

Move the current selection workflow into something conceptually equivalent to:

```text
workspace.selectWatchlist(id)
```

---

## 53. Preserve Failure Behavior

Selection failure must preserve previous active state and existing error semantics.

---

## 54. Navigation Presentation Remains Component-Owned

The Workspace does not manage `More`/`Watchlists` disclosure state.

---

# Create Watchlist Workflow

## 55. Workspace Method

Move the create lifecycle into a clearly named Workspace operation.

---

## 56. Preserve Semantics

Preserve:

* blank validation;
* max length;
* duplicates allowed;
* one request;
* created Watchlist becomes active;
* filter reset;
* sort reset;
* allocation reset;
* input clear on success;
* input preservation on failure;
* busy/error behavior.

---

# Delete Watchlist Workflow

## 57. Workspace Method

Move deletion lifecycle into Workspace.

---

## 58. Confirmation Remains UI

The browser confirmation interaction belongs to UI/component/page presentation.

Do not put:

```text
window.confirm()
```

inside the Workspace.

---

## 59. Workspace Receives Confirmed Intent

After confirmation, call:

```text
workspace.deleteWatchlist(...)
```

or equivalent.

---

## 60. Preserve Replacement Semantics

If deletion activates a replacement Watchlist, preserve the full active-transition reset rule.

---

# Add Stock Workflow

## 61. Workspace Method

Move stock-add lifecycle into Workspace.

---

## 62. Preserve Semantics

Preserve:

* client syntax validation;
* normalized redisplay where applicable;
* shell/API operation;
* input clear on success;
* input preservation on failure;
* activeView update;
* filter preserved;
* sort preserved;
* allocation invalidated on success;
* capacity error;
* provider errors;
* busy behavior.

---

# Remove Stock Workflow

## 63. Workspace Method

Move stock removal lifecycle into Workspace.

---

## 64. Preserve Semantics

Preserve:

* no confirmation;
* activeView update;
* filter preserved;
* sort preserved;
* allocation invalidated on success;
* allocation preserved on failure;
* existing errors/busy behavior.

---

# Target Price Workflow

## 65. Workspace Method

Move page-level Target Price save orchestration into Workspace.

---

## 66. Component Draft Remains Local

`TargetPriceCell` retains its own draft/edit state.

The Workspace receives the save intent/value.

---

## 67. Preserve Success Semantics

Preserve:

* activeView update;
* reactive stock repositioning under sort;
* filter preservation;
* allocation invalidation;
* MARKET_DATA_UNAVAILABLE partial-success semantics;
* warning behavior.

---

## 68. Preserve Failure Semantics

Failed save must preserve existing allocation/state according to current behavior.

---

# Investment Allocation Workflow

## 69. Workspace Method

Move allocation calculation lifecycle into Workspace.

---

## 70. Preserve Semantics

Preserve:

* Total Savings client validation;
* safe integer/range rule;
* shell/API call;
* allocation result storage;
* zero result;
* server/market-data errors;
* filter-independent server scope;
* current filter/sort preservation.

---

# Mutation Lifecycle Duplication

## 71. Main Refactoring Target

TASK-041 identified repeated mutation-lifecycle code as the strongest architecture smell.

TASK-044 should reduce duplication where the abstraction is genuine.

---

## 72. Do Not Over-Generalize

Do not create a generic mechanism such as:

```ts
runMutation({
  errorField: ...,
  busyField: ...,
  success: ...
})
```

if it makes workflows harder to read.

Explicit workflow methods are preferred.

---

## 73. Small Internal Helper Allowed

If several Workspace methods genuinely share a small lifecycle primitive such as:

```text
set status
clear relevant error
try
finally reset status
```

a private helper may be introduced.

It must improve readability rather than obscure which state each workflow changes.

---

# Public Workspace API

## 74. Human-Readable Surface

The public Workspace API should map closely to user/application concepts.

Conceptually:

```ts
workspace.load()
workspace.selectWatchlist(id)
workspace.createWatchlist(...)
workspace.deleteWatchlist(...)
workspace.addStock(...)
workspace.removeStock(...)
workspace.saveTargetPrice(...)
workspace.calculateAllocation(...)
workspace.setFilter(...)
workspace.changeSort(...)
```

Exact names may differ.

---

## 75. Avoid Generic Dispatch

Do not expose:

```ts
workspace.dispatch({ type: ... })
```

or stringly typed generic action systems.

Direct methods are more readable for this application.

---

# Reactive Public State

## 76. Readable State Surface

A developer using the Workspace from `+page.svelte` should be able to discover state such as:

```text
workspace.watchlists
workspace.activeView
workspace.visibleStocks
workspace.sort
workspace.investmentAllocation
workspace.managementBusy
```

or a similarly clear API.

---

## 77. Avoid Giant Snapshot Objects

Do not require the page to repeatedly destructure/copy one giant immutable state snapshot merely to render Svelte components.

Use Svelte 5 reactivity naturally.

---

# Rune-Based Implementation

## 78. Svelte 5 Runes

Use Svelte 5 rune-based reactive state if it provides the cleanest implementation.

Likely tools include:

```text
$state
$derived
```

in a `.svelte.ts` module.

---

## 79. No Legacy Store Requirement

Do not introduce `writable()` merely because state moves out of a `.svelte` component.

---

## 80. No Runes for Pure Helpers

Keep pure helpers as normal TypeScript functions.

---

# Testability

## 81. Direct Workspace Unit Tests

Add dedicated unit tests for Workspace lifecycle and transition rules.

This is a major acceptance objective.

---

## 82. No DOM Required

Workspace tests should not require:

* Playwright;
* browser rendering;
* Svelte component mounting.

They should operate through the Workspace API and fake shell/dependency functions.

---

## 83. Dependency Injection

Design the Workspace so shell/application operations can be replaced with deterministic fakes in unit tests.

Do not mock global `fetch` if the existing shell abstraction gives a cleaner seam.

---

## 84. Production Defaults

The production page should still use the real existing shell operations without complicated setup.

---

# Required Workspace Unit Tests

## 85. Initial Load

Verify successful load establishes:

* Watchlists;
* active state;
* default sort;
* empty filter;
* no allocation.

---

## 86. Load Failure

Verify existing load-error semantics.

---

## 87. Active Selection Success

Verify successful selection:

* changes active state;
* resets filter;
* resets sort to Name ascending;
* clears allocation.

---

## 88. Active Selection Failure

Verify failure:

* preserves previous active state;
* preserves/reset state according to current behavior;
* sets correct error;
* does not apply successful-transition resets.

---

## 89. Create Success

Verify:

* created Watchlist becomes active;
* input lifecycle;
* filter reset;
* sort reset;
* allocation reset.

---

## 90. Create Failure

Verify previous state and draft preservation.

---

## 91. Delete Success

Verify replacement active state and transition resets.

---

## 92. Delete Failure

Verify existing state remains.

---

## 93. Stock Add Success

Verify:

* activeView updates;
* filter preserved;
* sort preserved;
* allocation invalidated;
* draft cleared.

---

## 94. Stock Add Failure

Verify:

* activeView preserved;
* filter preserved;
* sort preserved;
* allocation preserved;
* draft/error semantics preserved.

---

## 95. Stock Remove Success

Verify:

* activeView updates;
* filter preserved;
* sort preserved;
* allocation invalidated.

---

## 96. Stock Remove Failure

Verify allocation/state preservation.

---

## 97. Target Price Success

Verify:

* activeView update;
* sort/filter preserved;
* allocation invalidated.

---

## 98. Target Price Partial Success

Verify MARKET_DATA_UNAVAILABLE-warning success preserves the established success semantics and warning state.

---

## 99. Target Price Failure

Verify allocation is not incorrectly invalidated.

---

## 100. Allocation Success

Verify result stored.

---

## 101. Allocation Zero

Verify explicit zero remains a successful stored result.

---

## 102. Allocation Failure

Verify existing result preservation/clearing semantics exactly as current behavior dictates.

---

## 103. Filter

Verify filter changes:

* update filtered/visible stocks;
* cause no shell/API call;
* do not alter allocation.

---

## 104. Sort

Verify sort changes:

* update visible order;
* cause no shell/API call;
* do not alter allocation.

---

## 105. Derived Counts

Verify counts remain derived from source/filter state.

---

## 106. `managementBusy`

Verify the aggregate busy state across relevant operation statuses.

---

## 107. Mutation Serialization

Where practical through the Workspace API, verify a second prohibited management operation cannot start while an existing one is busy, preserving current semantics.

Do not introduce artificial concurrency behavior solely for the test.

---

# Existing E2E Coverage

## 108. Preserve Playwright

Do not remove existing Playwright tests merely because Workspace logic gains unit coverage.

---

## 109. E2E Role After Refactor

Playwright remains responsible for:

* component integration;
* browser event wiring;
* responsive behavior;
* accessibility;
* real form submission paths;
* overall workflow integration.

Workspace unit tests provide faster/local coverage of transition rules.

---

# `+page.svelte` After Refactor

## 110. Composition Root

The route should primarily:

* create the Workspace instance;
* trigger initial load;
* compose major components;
* bind/render Workspace state;
* forward user intents;
* handle UI-only interactions such as delete confirmation where appropriate.

---

## 111. Avoid Wrapper Handlers

Do not leave dozens of page functions like:

```ts
async function handleAddStock(...) {
  await workspace.addStock(...);
}
```

when markup can safely call the Workspace method directly.

Keep wrappers only where they add actual UI behavior or adaptation.

---

## 112. Preserve Traceability

Do not optimize for the fewest possible lines.

A human developer should still be able to trace:

```text
StockAddForm
→ workspace.addStock
→ watchlistShell
→ watchlistApi
```

---

# Component APIs

## 113. Keep Existing Components Presentation-Focused

Do not pass the entire Workspace object into every component as a convenience.

Prefer explicit state/action props where the component already has a cohesive API.

---

## 114. Avoid Workspace Service Locator

Components should not become:

```ts
workspace.doSomething()
workspace.someError
workspace.someOtherState
```

consumers across the entire tree unless that is genuinely clearer.

The Workspace belongs primarily at the route composition boundary.

---

## 115. Existing Forms

Preserve the TASK-042 component boundaries:

```text
StockAddForm
InvestmentAllocationControls
```

---

## 116. Existing Presentation

Preserve TASK-043:

```text
StockPresentation
```

owns responsive Table/Card selection.

---

# Company Filter

## 117. Keep Inline

The Company Filter remains inline unless the Workspace migration reveals a concrete new reason to extract it.

TASK-041 explicitly rejected cosmetic extraction.

---

## 118. Workspace State

Its value may now bind to Workspace filter state.

Do not create a component solely because state ownership changed.

---

# Errors in Page Markup

## 119. Reassess Presentation Only

TASK-042 intentionally kept some error paragraphs in `+page.svelte` for visual-layout preservation.

During Workspace migration, those errors may simply render from:

```text
workspace.stockMutationError
workspace.allocationError
```

or equivalent.

Do not move their markup into components unless doing so clearly improves responsibility without changing layout.

---

# Types

## 120. Explicit Workspace Types

Use clear types for:

* dependencies;
* public state where necessary;
* workflow inputs;
* operation statuses.

---

## 121. No `any`

Do not introduce `any`.

---

## 122. No Generic State Framework

Do not invent a general application state framework for one feature.

---

# Dependency Graph

## 123. Desired Direction

Conceptually:

```text
+page.svelte
      ↓
WatchlistWorkspace
      ↓
watchlistShell
      ↓
watchlistApi
```

and:

```text
WatchlistWorkspace
      ↓
pure client helpers
```

and:

```text
+page.svelte
      ↓
presentation components
```

---

## 124. Components Do Not Import Workspace

By default, existing leaf/presentation components should not import the Workspace module directly.

The route remains the composition boundary.

---

## 125. No Server Imports

Workspace and frontend components must not import:

```text
$lib/server
```

---

# Circular Dependency Safety

## 126. Check

Verify no new circular dependency is introduced among:

```text
watchlistWorkspace
watchlistShell
watchlistApi
client helpers
components
```

---

# Behavior Invariants

## 127. Preserve All TASK-041 Critical Invariants

At minimum:

* active-Watchlist transition rules;
* filter reset/preservation;
* sort reset/preservation;
* allocation invalidation/preservation;
* management busy serialization;
* Target Price partial success;
* Table/Card state preservation;
* active navigation behavior;
* no duplicate mutation requests.

---

# No API/Server Changes

## 128. Server

No changes under:

```text
src/lib/server/
```

are expected.

---

## 129. API

No REST contract changes.

---

## 130. Persistence

No persistence changes.

---

# Naming

## 131. Workspace Name

Choose a name that communicates its responsibility clearly.

Preferred conceptual name:

```text
WatchlistWorkspace
```

or:

```text
createWatchlistWorkspace
```

---

## 132. Do Not Rename `watchlistShell`

TASK-041 identified `watchlistShell` naming as a possible later cleanup.

Do not combine that rename with the Workspace migration.

---

## 133. Do Not Rename `watchlistPresentation`

Leave the TASK-043 naming collision for optional TASK-045.

---

# Directory Structure

## 134. No Mass Reorganization

Place the Workspace in the current client organization.

Do not move all Watchlist files into a new feature tree.

---

# Architecture Documentation

## 135. Frontend Audit

Update:

```text
docs/architecture/frontend-architecture-audit.md
```

with TASK-044 implementation status.

Preserve the original audit and recommendation history.

---

## 136. `ARCHITECTURE.md`

Document the implemented frontend responsibility layers:

```text
Route
→ composition

Workspace
→ reactive page state + workflow lifecycle

Shell
→ stateless client application operations

API
→ HTTP

Components
→ presentation/local interaction state

Pure helpers
→ deterministic calculations/transforms
```

Use terminology matching the final implementation.

---

## 137. State Ownership

Document which state is:

* Workspace-owned;
* component-local;
* server-derived;
* presentation-only.

Keep it concise enough to remain useful.

---

## 138. SSR Rule

Document explicitly:

> WatchlistWorkspace is instantiated per page instance and must never be exported as shared mutable module state.

This is an important architecture invariant.

---

# Historical Tasks

## 139. TASK-041

Add a concise follow-up note that TASK-044 implemented the recommended Workspace phase.

Keep Done.

---

## 140. TASK-042 / TASK-043

Do not rewrite them.

A short follow-up note is acceptable if repository convention warrants it.

---

# README

## 141. README

No README change is required unless the repository's developer architecture overview currently describes the old page-owned architecture.

Do not add detailed internal state diagrams to the product introduction.

---

# Refactoring Review

## 142. Compare Before/After

At completion, compare:

* `+page.svelte` responsibilities;
* Workspace responsibilities;
* component responsibilities;
* shell responsibility.

Do not use line-count reduction as the primary success metric.

---

## 143. Human Traceability Review

Manually inspect representative workflows after refactor:

```text
Create Watchlist
Add Stock
Save Target Price
Calculate Allocation
```

A developer should be able to follow each workflow through named layers without searching through unrelated code.

---

# Non-Goals

Do NOT implement:

* UI redesign;
* new business features;
* server changes;
* API changes;
* persistence changes;
* new state-management library;
* Redux;
* Zustand;
* XState;
* global singleton Workspace;
* independent filter/sort/allocation stores;
* Svelte Context unless an unavoidable concrete need is discovered and reported;
* CompanyFilter component;
* new workspace-toolbar component;
* responsive presentation changes;
* Watchlist navigation changes;
* `watchlistShell` rename;
* `watchlistPresentation` rename;
* feature-directory migration;
* broad naming cleanup;
* production deployment;
* unrelated cleanup.

---

# Acceptance Criteria

The task is complete when all of the following are true:

1. A dedicated WatchlistWorkspace abstraction exists.
2. It uses Svelte 5 reactive state appropriately.
3. Workspace state is instantiated per page instance.
4. No shared mutable Workspace singleton exists.
5. SSR/request isolation is preserved.
6. `+page.svelte` creates/owns one Workspace instance.
7. Server-derived Watchlist state moves to Workspace.
8. filter state moves to Workspace.
9. sort state moves to Workspace.
10. allocation result moves to Workspace.
11. appropriate workflow operation states move to Workspace.
12. appropriate workflow error states move to Workspace.
13. form drafts are reassessed based on lifecycle.
14. genuinely Workspace-coupled drafts move where justified.
15. TargetPriceCell local state remains local.
16. WatchlistTabs responsive state remains local.
17. StockPresentation responsive state remains local.
18. Workspace-level derived state moves to Workspace.
19. filteredStocks remains derived via existing helper.
20. visibleStocks remains derived via existing sort helper.
21. allocation lookup remains derived via existing helper.
22. counts remain derived rather than mutable.
23. managementBusy becomes Workspace-derived where appropriate.
24. active-Watchlist transition consequences are centralized.
25. successful active transition resets filter.
26. successful active transition resets sort to Name ascending.
27. successful active transition clears allocation.
28. failed active transition does not apply successful resets.
29. initial load lifecycle is Workspace-owned.
30. Watchlist selection lifecycle is Workspace-owned.
31. Watchlist creation lifecycle is Workspace-owned.
32. Watchlist deletion lifecycle is Workspace-owned.
33. stock-add lifecycle is Workspace-owned.
34. stock-remove lifecycle is Workspace-owned.
35. Target Price save lifecycle is Workspace-owned.
36. allocation-calculation lifecycle is Workspace-owned.
37. stock-add success preserves filter/sort.
38. stock-add success invalidates allocation.
39. stock-add failure preserves relevant state.
40. stock-remove success preserves filter/sort.
41. stock-remove success invalidates allocation.
42. stock-remove failure preserves allocation.
43. Target Price success preserves filter/sort.
44. Target Price success invalidates allocation.
45. Target Price partial success remains correct.
46. Target Price failure does not incorrectly invalidate allocation.
47. filtering causes no API request.
48. sorting causes no API request.
49. filtering does not invalidate allocation.
50. sorting does not invalidate allocation.
51. allocation success stores result.
52. explicit zero allocation remains a valid result.
53. allocation failure preserves existing semantics.
54. existing management serialization remains.
55. no generic dispatch/action framework is introduced.
56. no state-machine dependency is introduced.
57. `watchlistShell` remains stateless.
58. `watchlistApi` remains HTTP transport.
59. Workspace performs no raw fetch calls.
60. pure helpers remain pure.
61. presentation components do not become workflow controllers.
62. existing components are not passed an indiscriminate Workspace service object.
63. `+page.svelte` primarily becomes composition + UI-only adaptation.
64. unnecessary wrapper handlers are removed.
65. delete confirmation remains UI-owned.
66. Company Filter remains inline unless a concrete audit-level reason is documented.
67. Table/Card presentation remains StockPresentation-owned.
68. responsive navigation remains WatchlistTabs-owned.
69. direct Workspace unit tests exist.
70. Workspace tests require no browser/DOM.
71. Workspace dependencies can be faked deterministically.
72. unit tests cover initial load.
73. unit tests cover load failure.
74. unit tests cover selection success/failure.
75. unit tests cover create success/failure.
76. unit tests cover delete success/failure.
77. unit tests cover stock-add success/failure.
78. unit tests cover stock-remove success/failure.
79. unit tests cover Target Price success/failure.
80. unit tests cover Target Price partial success.
81. unit tests cover allocation success/failure.
82. unit tests cover explicit zero allocation.
83. unit tests cover filter transition behavior.
84. unit tests cover sort transition behavior.
85. unit tests cover allocation invalidation rules.
86. unit tests cover managementBusy.
87. existing Playwright coverage remains.
88. E2E assertions are not weakened.
89. no circular client dependency is introduced.
90. no server-only import is introduced.
91. no `any` is introduced.
92. architecture documentation describes the implemented layers.
93. per-page Workspace isolation is documented.
94. frontend audit records implementation status.
95. no API contract changes occur.
96. no persistence changes occur.
97. no business calculations change.
98. no unnecessary dependency is introduced.
99. all project checks pass.
100. no production deployment occurs.

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

1. Workspace is created per page instance;
2. no module-level mutable Workspace singleton exists;
3. initial load;
4. load failure;
5. Watchlist selection success;
6. Watchlist selection failure;
7. create success;
8. create failure;
9. delete success;
10. delete failure;
11. stock-add success;
12. stock-add failure;
13. stock-remove success;
14. stock-remove failure;
15. Target Price success;
16. Target Price partial success;
17. Target Price failure;
18. allocation success;
19. allocation zero;
20. allocation failure;
21. filter reset on active transition;
22. sort reset on active transition;
23. allocation reset on active transition;
24. filter preservation on same-Watchlist mutation;
25. sort preservation on same-Watchlist mutation;
26. allocation invalidation after successful relevant mutation;
27. allocation preservation after failed relevant mutation;
28. filter causes no API request;
29. sort causes no API request;
30. managementBusy serialization;
31. responsive Table/Card behavior unchanged;
32. responsive navigation unchanged;
33. TargetPriceCell draft state remains local;
34. delete confirmation remains outside Workspace;
35. representative workflow traceability review;
36. no shell/API/server responsibility drift.

Do not report verification as successful unless actually executed successfully.

Do NOT deploy production.

---

# Task Status

After implementation, testing, documentation, and review are complete, change:

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
3. final Workspace file/API;
4. factory/class/per-instance design;
5. proof against mutable singleton state;
6. SSR/per-page isolation approach;
7. Workspace dependency injection design;
8. server-derived state moved;
9. UI/workspace state moved;
10. operation states moved;
11. error states moved;
12. form-draft ownership decisions;
13. local state intentionally left in components;
14. derived state moved;
15. active-Watchlist transition centralization;
16. initial-load workflow;
17. selection workflow;
18. create workflow;
19. delete workflow;
20. stock-add workflow;
21. stock-remove workflow;
22. Target Price workflow;
23. allocation workflow;
24. filter/sort preservation/reset behavior;
25. allocation invalidation/preservation behavior;
26. managementBusy implementation;
27. mutation-lifecycle duplication reduction;
28. any internal lifecycle helper introduced;
29. final `+page.svelte` responsibility;
30. final Workspace vs `watchlistShell` distinction;
31. confirmation `watchlistApi` remains transport-only;
32. pure-helper reuse;
33. component API consequences;
34. unit tests added;
35. state-transition cases now directly unit-tested that were previously E2E-only;
36. Playwright changes, if any;
37. results of `test`, `test:e2e`, `check`, `lint`, and `build`;
38. dependency/circular-import check;
39. server-import check;
40. human traceability review;
41. frontend-audit documentation update;
42. `ARCHITECTURE.md` changes;
43. historical task notes;
44. README changes, if any;
45. confirmation no UI/product behavior changed;
46. confirmation no API/server/persistence changes occurred;
47. confirmation no production deployment occurred;
48. confirmation task status changed to Done;
49. assumptions or unresolved issues;
50. deviations from TASK-041/TASK-044 or `ARCHITECTURE.md`.

Do not proceed to optional TASK-045.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
