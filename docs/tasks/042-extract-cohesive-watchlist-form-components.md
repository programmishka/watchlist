# TASK-042: Extract Cohesive Watchlist Form Components

## Status

Done

## Goal

Perform the first implementation phase recommended by TASK-041 by extracting two cohesive UI responsibilities from `src/routes/+page.svelte` into dedicated Svelte components:

1. `StockAddForm`
2. `InvestmentAllocationControls`

This is the first step of the frontend architecture refactoring.

The purpose is not merely to reduce the line count of `+page.svelte`. The purpose is to establish clearer human-readable component boundaries around two independently understandable user interactions while preserving the existing state architecture.

After this task, a developer reading `+page.svelte` should be able to understand its composition more quickly without following the markup and accessibility details of these forms.

Conceptually:

```text
+page.svelte
│
├── WatchlistTabs
│
├── StockAddForm
│
├── Company filter remains inline
│
├── InvestmentAllocationControls
│
├── WatchlistTable
└── WatchlistCards
```

TASK-042 deliberately does **not** introduce the `WatchlistWorkspace` abstraction proposed by TASK-041.

Page-level state and workflow handlers remain owned by `+page.svelte`.

This task is a **behavior-preserving component extraction**.

---

# Architectural Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* `docs/architecture/frontend-architecture-audit.md`
* TASK-019;
* TASK-020;
* TASK-022;
* TASK-024;
* TASK-025;
* TASK-029;
* TASK-030;
* TASK-034;
* TASK-036;
* TASK-038;
* TASK-041;
* current `src/routes/+page.svelte`;
* current components under `src/lib/components/`;
* relevant client parsers/helpers;
* relevant Playwright tests;
* this task completely.

Treat the TASK-041 audit as the architectural basis for this task.

Do not broaden the refactoring beyond the two approved component boundaries.

---

# TASK-041 Decision

## 1. Accepted Extraction Boundaries

TASK-041 identified two inline UI areas as sufficiently cohesive to justify dedicated components:

```text
StockAddForm
InvestmentAllocationControls
```

Implement these two boundaries.

---

## 2. Rejected Extraction: CompanyFilter

TASK-041 explicitly concluded that a standalone:

```text
CompanyFilter
```

would currently be primarily cosmetic.

The company-name filter therefore remains inline in `+page.svelte`.

Do not extract it in TASK-042.

---

## 3. Rejected Extraction: Large Workspace Toolbar

Do not introduce:

```text
WatchlistWorkspaceToolbar
```

or another component wrapping:

* stock addition;
* filtering;
* investment allocation

into one broad API.

TASK-041 found that such a component would require a large prop/callback surface spanning unrelated responsibilities.

Visual proximity does not imply component-level responsibility cohesion.

---

# No State Architecture Change

## 4. Page Still Owns Workspace State

TASK-042 must not move page-level state out of `+page.svelte`.

Examples that remain page-owned include the current equivalents of:

```text
watchlists
activeWatchlistId
activeView

companyNameFilter
sort
investmentAllocation

operation states
page-level errors
managementBusy
```

Use actual current names.

---

## 5. No Workspace/ViewModel Yet

Do not create:

```text
watchlistWorkspace.svelte.ts
WatchlistWorkspace
WatchlistWorkspaceViewModel
```

in this task.

That belongs to TASK-044.

---

## 6. No New Store

Do not introduce:

* `writable`;
* `derived` stores;
* Context-based workspace state;
* global rune state;
* singleton state modules.

---

## 7. No Workflow Migration

Existing page handlers remain responsible for invoking:

```text
watchlistShell
```

and applying the existing state-transition rules.

The extracted components emit user intent; they do not become application workflow controllers.

---

# Component Responsibility Principle

## 8. Components Own Interaction Presentation

The extracted components should own:

* form markup;
* labels;
* inputs;
* buttons;
* accessibility attributes;
* form submission wiring;
* local presentation of their relevant validation/error/status information where appropriate;
* small purely local interaction details.

---

## 9. Page Owns Application Consequences

The page continues to own application-level consequences such as:

```text
API/shell operation
→ replace activeView
→ invalidate allocation
→ clear/preserve input according to established rules
→ update page-level error/status
```

Do not duplicate these transitions inside the extracted components.

---

# StockAddForm

## 10. Responsibility

Create:

```text
src/lib/components/StockAddForm.svelte
```

or the repository-consistent equivalent.

Its responsibility is:

> Present and collect a Stock Symbol and emit the existing Add Stock user intent while displaying the stock-add interaction state supplied by the page.

---

## 11. Existing Behavior to Preserve

Preserve all current stock-add behavior established by TASK-020, TASK-029, TASK-030, TASK-038, and later tasks.

This includes:

* Stock Symbol input;
* uppercase normalization during input;
* `maxlength=20`;
* existing syntax validation behavior;
* existing supported-equity semantics;
* Enter submission;
* `+` button submission;
* exactly one submission path;
* no duplicate request;
* clear input on success;
* preserve input on failure;
* stable API error messages;
* busy/disabled behavior;
* responsive layout;
* accessibility.

---

# Stock Add State Ownership

## 12. Inspect Current State

Before extracting, identify the current stock-add-specific state in `+page.svelte`.

Expected examples may include:

```text
stockSymbol
stockMutationStatus
stockMutationError
```

Use actual names.

---

## 13. Do Not Prematurely Move Workflow State

By default, keep stock-add state that participates in page-level workflow lifecycle in `+page.svelte`.

TASK-042 is not the Workspace migration.

---

## 14. Local Draft State Decision

If the audit/current code clearly shows that the raw Stock Symbol input text is used only by the Stock Add form and has no page-level lifecycle dependency beyond the existing success/failure callback contract, it may be considered for local ownership.

However:

* do not move it merely to make the page shorter;
* do not change success/failure semantics;
* do not make the component call `watchlistShell` directly;
* do not hide application workflow state inside the component.

Prefer the least disruptive extraction.

Document the final ownership decision.

---

# StockAddForm API

## 15. Cohesive API

Design the smallest explicit component API that represents the actual responsibility.

Conceptually, the component may need inputs such as:

```text
disabled/busy
current input value
validation/error state
submit callback
```

The exact API must follow current Svelte conventions and actual state ownership.

---

## 16. Avoid Broad Page Props

`StockAddForm` must not receive unrelated state such as:

```text
watchlists
sort
filter
investmentAllocation
presentationMode
```

---

## 17. User Intent Callback

The component should expose an explicit intent such as:

```text
onAdd(symbol)
```

or the Svelte-appropriate equivalent.

Do not pass the complete shell/API object into the component.

---

## 18. No API Dependency

`StockAddForm.svelte` must not import:

```text
watchlistApi
watchlistShell
```

The component is presentation/interaction, not client application orchestration.

---

# Stock Symbol Normalization

## 19. Reuse Existing Shared Logic

Do not duplicate Stock Symbol parsing or validation.

Reuse the existing shared/client-safe symbol utilities established by TASK-029/TASK-038.

---

## 20. Uppercase UX

Preserve the current live uppercase behavior exactly.

Do not change when normalization occurs.

---

## 21. Invalid Input

Invalid input must continue to be rejected before the API/shell operation according to current behavior.

Component extraction must not move authoritative server validation into the browser.

---

# Stock Add Error Presentation

## 22. Existing Error Semantics

Preserve current distinctions such as:

```text
INVALID_STOCK_SYMBOL
UNKNOWN_STOCK_SYMBOL
MARKET_DATA_UNAVAILABLE
WATCHLIST_STOCK_LIMIT_REACHED
```

where currently exposed to the UI.

---

## 23. Error Ownership

If the error value remains page-owned, pass only the stock-add-specific presentation data needed by `StockAddForm`.

Do not pass a generic page error collection.

---

# InvestmentAllocationControls

## 24. Responsibility

Create:

```text
src/lib/components/InvestmentAllocationControls.svelte
```

or the repository-consistent equivalent.

Its responsibility is:

> Present Total Savings input, trigger investment allocation calculation, display allocation-specific validation/error state, and display the current Allocated Savings result supplied by the page.

---

## 25. Existing Behavior to Preserve

Preserve all TASK-024/TASK-034/TASK-038 behavior:

* `Total savings` input;
* `inputmode` semantics;
* `maxlength=8`;
* whole non-negative integer parsing;
* safe-integer rule;
* maximum `10,000,000`;
* Enter submission;
* Calculate button submission;
* one form submission path;
* no duplicate request;
* allocation-specific error behavior;
* `Allocated savings` terminology;
* no result shown before successful calculation;
* explicit calculated zero remains visible;
* existing whole-Euro formatting;
* busy/disabled behavior;
* responsive behavior;
* accessibility.

---

# Allocation State Ownership

## 26. Page Retains Allocation Result

The actual:

```text
investmentAllocation
```

or current equivalent remains page/workspace state.

It affects:

* Table Savings Amount;
* Card Savings Amount;
* allocation lookup;
* invalidation after stock/Target Price mutations.

It must not move into the form component.

---

## 27. Allocation Invalidation Remains Page-Level

Rules such as:

```text
successful Target Price mutation
→ allocation invalidated

successful stock add/remove
→ allocation invalidated

active Watchlist transition
→ allocation invalidated
```

remain outside `InvestmentAllocationControls`.

---

## 28. Total Savings Draft

Inspect whether the current Total Savings text is coupled to any page-level workflow.

If it is purely form-local, local ownership may be appropriate.

If moving it would complicate established behavior or TASK-044 migration, leave it page-owned.

Again, optimize responsibility clarity, not line count.

Document the choice.

---

# InvestmentAllocationControls API

## 29. Cohesive Inputs

The component should receive only allocation-related state/actions.

Conceptually:

```text
Total Savings draft/value
disabled/busy
allocation error
allocated result
calculate intent
```

Use actual current architecture.

---

## 30. No Stock Collection Dependency Unless Necessary

Do not pass:

```text
activeView.stocks
visibleStocks
filteredStocks
```

into `InvestmentAllocationControls` unless the current presentation genuinely requires them.

The allocation calculation scope remains server-side and independent of filtering.

---

## 31. No Shell/API Dependency

The component must not import:

```text
watchlistShell
watchlistApi
```

---

# Allocated Savings

## 32. Existing Meaning

Preserve:

```text
Allocated savings
```

as the sum of the server-calculated per-stock allocation amounts.

Do not change the underlying API field or formula.

---

## 33. Before Calculation

No result is shown before successful calculation.

---

## 34. Real Zero

A successful allocation whose invested/allocated sum is:

```text
0
```

must remain visibly represented as a real result.

Do not use truthiness checks.

---

# Form Submission Semantics

## 35. Single Submit Path

Both extracted forms must preserve the established pattern:

```text
<form onsubmit=...>
```

with Enter and button click reaching one handler.

Do not introduce:

```text
onclick + onsubmit
```

duplicate mutation paths.

---

## 36. Prevent Default

Preserve current Svelte form-submit behavior and browser semantics.

---

# Busy State

## 37. `managementBusy`

The aggregate page-level:

```text
managementBusy
```

or current equivalent remains page-owned in TASK-042.

---

## 38. Component Disabled State

Pass the appropriate busy/disabled state into both extracted components.

They must not independently reconstruct global concurrency rules.

---

## 39. No Request Queue

Do not introduce new concurrency infrastructure.

---

# Error and Status Responsibilities

## 40. Stock Errors

Stock-add-specific errors may be rendered by `StockAddForm`.

---

## 41. Allocation Errors

Allocation-specific errors may be rendered by `InvestmentAllocationControls`.

---

## 42. Unrelated Errors

Do not pass or render:

* Watchlist create errors;
* Watchlist delete errors;
* Target Price errors;
* navigation errors

inside these components.

---

## 43. Warning Semantics

If either workflow currently exposes warning semantics, preserve the existing role/class behavior.

Do not redesign status presentation.

---

# Company Filter

## 44. Remains Inline

The existing company-name filter stays in `+page.svelte`.

Preserve:

* visible label;
* `maxlength=100`;
* local-only filtering;
* no API requests;
* existing responsive placement.

---

## 45. Toolbar Layout

Extracting the two neighboring forms must not change the current visual toolbar layout.

The page may continue using existing wrapper elements/classes to arrange:

```text
StockAddForm
Company filter
InvestmentAllocationControls
```

---

# CSS Strategy

## 46. Preserve Visual Output

This task is not a UI redesign.

The rendered page should remain visually equivalent.

---

## 47. Component CSS

Move component-specific CSS only when it clearly belongs to the extracted component.

Do not duplicate global styles.

---

## 48. Existing Global Vocabulary

Continue using:

```text
.btn
.btn-primary
.btn-compact
.field-input
.status
.status-error
.status-warning
```

and the established TASK-025 vocabulary.

---

## 49. Layout CSS Ownership

CSS controlling the relationship among the three toolbar groups may remain in the page/global layout.

Do not force cross-component layout rules into child components.

---

# Accessibility

## 50. Labels

Preserve all current accessible labels.

---

## 51. Visible/Screen-Reader Labels

If TASK-034 currently uses visually hidden labels plus placeholders, preserve the established accessible semantics exactly unless a concrete defect is found.

Do not redesign label presentation.

---

## 52. Error Roles

Preserve:

```text
role="alert"
role="status"
aria-invalid
aria-describedby
aria-busy
```

where currently applicable.

---

## 53. Keyboard

Preserve keyboard behavior for:

* Stock Symbol input;
* Add Stock submit;
* Total Savings input;
* Calculate submit.

---

# Page Composition

## 54. Expected Improvement

After extraction, `+page.svelte` should read more like page composition.

Conceptually:

```svelte
<WatchlistTabs ... />

<div class="workspace-toolbar">
    <StockAddForm ... />

    <!-- Company filter remains intentionally inline -->

    <InvestmentAllocationControls ... />
</div>

<!-- Existing Table/Card composition remains for TASK-043 -->
```

Use actual markup/layout.

---

## 55. Handlers Remain Visible

The page should still make application workflows traceable.

Do not hide all mutation logic behind generic callbacks such as:

```text
handleAction("stock", ...)
```

merely to shorten the file.

---

# Existing Components

## 56. Do Not Refactor Existing Good Boundaries

Do not structurally refactor:

```text
WatchlistTabs
WatchlistTable
WatchlistCards
TargetPriceCell
```

unless a minimal prop/type consequence is required by the extraction.

TASK-041 found these boundaries already good.

---

# Table/Card Presentation

## 57. Leave in Page

The current:

```text
presentationMode
→ WatchlistTable / WatchlistCards
```

responsibility remains in `+page.svelte`.

Do not create `StockPresentation` yet.

That belongs to TASK-043.

---

# `watchlistShell`

## 58. Leave Unchanged

Do not refactor `watchlistShell`.

TASK-041 assessed it as a clean stateless client-application orchestration layer.

---

## 59. `watchlistApi`

Leave unchanged unless an import/type-only consequence is genuinely necessary.

No HTTP behavior changes.

---

# Pure Helpers

## 60. Preserve Existing Helpers

Do not rewrite:

* Stock Symbol parser;
* Total Savings parser;
* filter helper;
* sort helper;
* allocation lookup;
* formatting;
* responsive presentation helper

as part of this extraction.

---

# Component Types

## 61. Explicit Props

Use explicit, readable prop types.

A human developer should be able to open each component and understand its required state/actions quickly.

---

## 62. Avoid `any`

Do not use `any` to make extraction easier.

---

## 63. Avoid Giant Generic Form Types

Do not introduce a generic abstraction such as:

```text
MutationFormState<T>
```

unless the current code already has a compelling reusable concept.

Explicit workflow-specific types are preferable here.

---

# Testing Strategy

## 64. Behavior Preservation

This task should not require changing business expectations.

Existing unit and E2E assertions remain authoritative.

---

## 65. No Svelte Component-Test Harness Required

The project currently relies on:

* unit tests for pure/client logic;
* Playwright for integrated Svelte behavior.

Do not introduce a new component-testing framework solely for TASK-042.

---

## 66. Existing Playwright Coverage

Identify existing E2E scenarios covering:

### Stock Add

* success;
* Enter;
* invalid syntax;
* unknown symbol;
* provider failure;
* duplicate;
* capacity error;
* input preservation on failure;
* input clear on success;
* mobile/Card behavior where relevant.

### Allocation

* success;
* Enter;
* zero;
* invalid input;
* server failure;
* allocation result;
* invalidation behavior;
* mobile/Card behavior.

Preserve these tests.

---

# E2E Locator Stability

## 67. Prefer Accessible Locators

Component extraction may change DOM nesting.

Do not preserve brittle markup solely to satisfy CSS-path selectors.

Where necessary, update tests toward:

```text
getByLabel
getByRole
```

or existing presentation-agnostic helpers.

---

## 68. Do Not Weaken Assertions

If E2E selectors must change because markup moves into components, preserve the behavioral strictness of the assertions.

---

# Characterization Before Refactor

## 69. Run Relevant Tests First

Before extraction, run the relevant focused Playwright specs to establish the current baseline.

At minimum inspect/run the specs covering:

```text
stock management
investment allocation
responsive layout
UI polish
```

Use actual filenames.

---

## 70. No Missing Coverage Invented

TASK-041 found no missing characterization coverage for critical invariants.

Do not create redundant tests simply to increase counts.

Add a test only if extraction reveals a real uncovered boundary.

---

# Code Readability Review

## 71. Page Improvement

After extraction, review `+page.svelte` manually.

Confirm that the removed markup corresponds to meaningful responsibilities rather than merely being moved elsewhere.

---

## 72. Component Readability

Each new component should be understandable independently.

A human developer should be able to answer:

### StockAddForm

```text
What does the user enter?
When is submit possible?
What intent is emitted?
How are errors shown?
```

### InvestmentAllocationControls

```text
What does the user enter?
How is calculation triggered?
What result is shown?
How are errors shown?
```

without reading `+page.svelte`.

---

# Dependency Direction

## 73. Desired Direction

The dependency direction should remain conceptually:

```text
+page.svelte
    ↓
components
```

and:

```text
+page.svelte handlers
    ↓
watchlistShell
    ↓
watchlistApi
```

---

## 74. No Reverse Dependency

Components must not import route modules.

---

## 75. No Server Imports

New frontend components must not import:

```text
$lib/server
```

---

# Circular Dependency Check

## 76. Verify

After extraction, check that no new circular client/component dependencies were introduced.

---

# Architecture Documentation

## 77. Audit Implementation Status

Update:

```text
docs/architecture/frontend-architecture-audit.md
```

with a concise implementation-status note indicating that TASK-042 completed the first recommended extraction phase.

Do not rewrite the original audit findings.

---

## 78. `ARCHITECTURE.md`

Update only if needed to reflect the now-real component responsibilities.

Keep the change concise.

Do not document TASK-043/TASK-044 target architecture as already implemented.

---

# Historical Task

## 79. TASK-041

A concise follow-up note may be added stating that TASK-042 implemented the first extraction phase.

Keep TASK-041 status Done.

---

# No Directory Reorganization

## 80. Existing Component Location

Place the new components with the current component organization.

Do not introduce a feature-oriented directory migration in this task.

---

# Non-Goals

Do NOT implement:

* `WatchlistWorkspace`;
* ViewModel;
* rune-based page state module;
* Svelte Context;
* global stores;
* independent feature stores;
* StockPresentation component;
* CompanyFilter component;
* WatchlistWorkspaceToolbar;
* `watchlistShell` refactoring;
* `watchlistApi` refactoring;
* directory restructuring;
* module renaming;
* state-machine framework;
* new component-test framework;
* UI redesign;
* CSS redesign;
* business behavior changes;
* API changes;
* server changes;
* persistence changes;
* production deployment;
* unrelated cleanup.

---

# Acceptance Criteria

The task is complete when all of the following are true:

1. `StockAddForm.svelte` exists.
2. Its responsibility is limited to Stock Add interaction/presentation.
3. It does not import `watchlistShell`.
4. It does not import `watchlistApi`.
5. It does not receive unrelated workspace state.
6. Existing Stock Symbol uppercase behavior remains.
7. Existing Stock Symbol `maxlength=20` remains.
8. Existing Stock Symbol validation remains.
9. Enter and `+` share one submission path.
10. Success still clears Stock Symbol input.
11. Failure still preserves Stock Symbol input.
12. Existing stock-add errors remain correctly presented.
13. Existing stock-add busy behavior remains.
14. `InvestmentAllocationControls.svelte` exists.
15. Its responsibility is limited to allocation input/result interaction/presentation.
16. It does not import `watchlistShell`.
17. It does not import `watchlistApi`.
18. It does not own `investmentAllocation`.
19. Existing Total Savings `maxlength=8` remains.
20. Existing Total Savings parsing/range behavior remains.
21. Enter and Calculate share one submission path.
22. No allocation result appears before success.
23. Successful zero allocation remains visible.
24. `Allocated savings` terminology remains.
25. Allocation errors remain correctly presented.
26. Existing allocation busy behavior remains.
27. Allocation invalidation remains page-level.
28. Company filter remains inline.
29. No `CompanyFilter` component is created.
30. No broad workspace-toolbar component is created.
31. Page-level workspace state remains in `+page.svelte`.
32. No ViewModel/workspace is introduced.
33. No new global/store/context state is introduced.
34. Table/Card presentation remains page-owned.
35. Existing components are not unnecessarily refactored.
36. `watchlistShell` remains stateless and unchanged.
37. `watchlistApi` transport behavior remains unchanged.
38. Pure helpers remain unchanged unless a minimal type/import consequence is required.
39. Existing toolbar visual layout remains materially unchanged.
40. Existing responsive behavior remains.
41. Existing accessibility semantics remain.
42. New component props are explicit and cohesive.
43. No `any` is introduced.
44. No generic form framework is introduced.
45. E2E Stock Add behavior remains green.
46. E2E allocation behavior remains green.
47. Responsive/Card behavior remains green.
48. E2E assertions are not weakened.
49. `+page.svelte` becomes easier to read as a composition/orchestration component.
50. New components are independently understandable.
51. Dependency direction remains clean.
52. No server-only frontend imports are introduced.
53. No circular dependency is introduced.
54. Frontend architecture audit records TASK-042 implementation status.
55. Existing project checks pass.
56. No unnecessary dependency is introduced.
57. No production deployment occurs.

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

1. Stock Add by button;
2. Stock Add by Enter;
3. invalid Stock Symbol;
4. Stock Add success clears input;
5. Stock Add failure preserves input;
6. stock-capacity error still displays correctly;
7. Total Savings calculation by button;
8. Total Savings calculation by Enter;
9. invalid Total Savings;
10. successful allocation;
11. successful zero allocation;
12. allocation failure;
13. allocation invalidation after relevant mutations remains unchanged;
14. Stock Add in responsive/Card layout;
15. allocation controls in responsive/Card layout;
16. keyboard accessibility;
17. no visual toolbar regression;
18. `StockAddForm` has no shell/API dependency;
19. `InvestmentAllocationControls` has no shell/API dependency;
20. Company filter remains inline;
21. Table/Card presentation remains page-owned.

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
3. StockAddForm final responsibility;
4. StockAddForm props/callback API;
5. Stock Symbol draft-state ownership decision;
6. Stock Add error/status ownership;
7. proof no shell/API dependency exists in StockAddForm;
8. InvestmentAllocationControls final responsibility;
9. InvestmentAllocationControls props/callback API;
10. Total Savings draft-state ownership decision;
11. allocation-result ownership;
12. allocation error/status ownership;
13. proof no shell/API dependency exists in InvestmentAllocationControls;
14. confirmation Company Filter remains inline;
15. confirmation no workspace-toolbar component was introduced;
16. page-level state left in `+page.svelte`;
17. handlers/workflows left in `+page.svelte`;
18. Table/Card presentation ownership;
19. CSS/layout changes, if any;
20. accessibility preservation;
21. E2E selector changes, if any;
22. tests added/changed;
23. results of `test`, `test:e2e`, `check`, `lint`, and `build`;
24. architecture-audit documentation update;
25. `ARCHITECTURE.md` changes, if any;
26. confirmation no Workspace/ViewModel/store/context was introduced;
27. confirmation `watchlistShell`/`watchlistApi` behavior was unchanged;
28. confirmation no product behavior changed;
29. confirmation no production deployment occurred;
30. confirmation task status changed to Done;
31. assumptions or unresolved issues;
32. deviations from TASK-041/TASK-042 or `ARCHITECTURE.md`.

Do not proceed to TASK-043.

Do not stage, commit, or push changes. Git operations are performed manually by the user.

---

## Follow-Up: TASK-044

TASK-044 introduced the rune-based `WatchlistWorkspace` and moved the underlying `$state` this task
deliberately left in `+page.svelte` (`newStockSymbol`, `stockMutationBusy`/`Error`,
`stockSymbolValidationError`, `totalSavingsInput`, `allocationInputError`, `investmentAllocation`,
`allocationBusy`/`Error`) into it. `StockAddForm.svelte` and `InvestmentAllocationControls.svelte`
themselves were not modified: their controlled `value`/`disabled`/`busy` props and `onAdd`/
`onCalculate` callback contracts are unchanged, now simply wired to Workspace fields/methods instead
of page-level `$state`/handlers. This task's own status remains `Done`; no requirement above was
revised.
