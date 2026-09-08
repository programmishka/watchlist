# TASK-041: Frontend Architecture and Responsibility Audit

## Status

Ready

## Goal

Perform a focused architecture and responsibility audit of the current Svelte/SvelteKit frontend before beginning structural refactoring.

The application has evolved incrementally from a small V1 Watchlist page into a substantially richer workspace containing:

* Watchlist navigation and management;
* responsive navigation overflow;
* stock addition/removal;
* company-name filtering;
* table sorting;
* responsive Table/Card presentation;
* Target Price editing;
* investment allocation;
* loading/busy/error/warning states;
* responsive presentation state.

During this evolution, `src/routes/+page.svelte` intentionally remained the central page-level composition and orchestration component.

That approach was appropriate while product behavior was still evolving. The application is now functionally mature enough that internal frontend structure should be reviewed deliberately.

The Product Owner's goal is not merely to reduce line count.

The goal is:

> Improve readability, traceability, responsibility boundaries, and maintainability for a human developer while preserving the application's established behavior.

The project should also demonstrate that agent-assisted software development can result in an architecture that is understandable and maintainable by humans rather than merely functionally correct.

TASK-041 must analyze the current frontend architecture and propose a justified refactoring plan.

It must **not implement that refactoring yet**.

---

# Primary Question

Determine whether the current frontend has reached the point where:

```text
+page.svelte
```

owns too many responsibilities, and if so, define a clearer architecture with smaller cohesive responsibilities.

The analysis must be based on the actual current code.

Do not begin with a predetermined conclusion such as:

```text
all state belongs in stores
```

or:

```text
every form must become a component
```

or:

```text
+page.svelte must contain fewer than N lines
```

---

# Architectural Objective

The desired architecture should optimize for:

1. human readability;
2. local reasoning;
3. explicit responsibility boundaries;
4. predictable state ownership;
5. minimal hidden coupling;
6. testability;
7. traceable workflows;
8. appropriate Svelte/SvelteKit conventions;
9. low accidental complexity;
10. preservation of existing business behavior.

---

# Human Developer Perspective

## 1. Primary Evaluation Question

A developer unfamiliar with the implementation should be able to answer questions such as:

```text
Where is active Watchlist state owned?

Where is filtering performed?

What resets filter/sort/allocation when the active Watchlist changes?

How does Add Stock move from UI to API?

Who owns Target Price draft state?

Who decides Table vs Cards?

What disables mutations while another operation is running?

Where does investment allocation live?

Which code is presentation-only?

Which code communicates with the server?
```

without reading the entire frontend.

---

## 2. Small Responsibilities

Prefer components/modules whose purpose can be described in one concise sentence.

Do not optimize for the maximum possible number of small files.

A component containing three lines is not automatically better architecture than a cohesive 50-line component.

---

## 3. Traceability

A user action should have a reasonably obvious execution path.

Example:

```text
Add Stock button
    ↓
StockAddForm
    ↓
workspace/application operation
    ↓
watchlistShell
    ↓
watchlistApi
    ↓
HTTP
```

The final recommendation may differ, but workflows should remain traceable.

---

# Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* README frontend/product sections;
* TASK-016 through TASK-040 where relevant;
* current `src/routes/+page.svelte`;
* all files under `src/lib/components/`;
* all frontend/client files under `src/lib/client/`;
* relevant shared modules under `src/lib/shared/`;
* current frontend-related unit tests;
* current Playwright tests;
* this task completely.

Do not rely solely on historical task descriptions.

The implementation has evolved through later tasks that superseded earlier structures.

---

# Current Route Component

## 4. Analyze `+page.svelte`

Perform a detailed responsibility analysis of:

```text
src/routes/+page.svelte
```

Do not merely report:

```text
file has X lines
```

Classify what the file actually does.

---

## 5. Responsibility Categories

At minimum identify whether `+page.svelte` currently owns logic related to:

* initial loading;
* active Watchlist selection;
* Watchlist creation;
* Watchlist deletion;
* stock addition;
* stock removal;
* Target Price mutation;
* investment allocation;
* filtering;
* sorting;
* responsive Table/Card presentation;
* busy-state aggregation;
* error state;
* warning state;
* derived stock presentation;
* event-handler glue;
* component composition.

Add categories discovered from the actual code.

---

# State Inventory

## 6. Complete Page State Inventory

Inventory every page-level `$state`, equivalent reactive state, or other mutable client state.

For each state value document:

| State | Purpose | Owner Today | Consumers | Mutators | Persistence |
| ----- | ------- | ----------- | --------- | -------- | ----------- |

---

## 7. State Classification

Classify each state as one of:

```text
server-derived state
client application/workspace state
presentation state
form/draft state
operation/request state
error/warning state
```

If a value belongs to multiple categories, explain why.

---

## 8. Server-Derived State

Identify state whose authoritative source is the server.

Examples may include:

```text
watchlists
activeWatchlistId
activeView
```

Confirm from actual code.

---

## 9. Client Workspace State

Identify state that exists only to support the current workspace.

Expected examples may include:

```text
filter
sort
investmentAllocation
```

Confirm actual ownership and lifecycle.

---

## 10. Presentation State

Identify state such as:

```text
Table vs Cards presentation
responsive navigation capacity
overflow open/closed
```

and determine whether it belongs at page, component, or helper level.

---

## 11. Local Component State

Inventory important state already correctly localized inside components.

Examples may include:

```text
Target Price draft text
Target Price saving state
overflow disclosure state
```

Do not recommend moving correctly local state upward merely for centralization.

---

# Derived State

## 12. Complete Derived-State Inventory

Inventory significant `$derived` values or equivalent computed state.

Expected examples may include:

```text
filteredStocks
visibleStocks
stock counts
allocation lookup
managementBusy
presentation mode
```

Use actual names.

---

## 13. Dependency Graph

Document the important derivation graph.

Conceptually:

```text
activeView.stocks
       ↓
companyNameFilter
       ↓
filteredStocks
       ↓
sort
       ↓
visibleStocks
```

and:

```text
operation states
       ↓
managementBusy
```

and:

```text
investmentAllocation
       ↓
allocationBySymbol
```

Include all important relationships found.

---

## 14. Derived-State Ownership

For each important derived value determine whether it should conceptually belong to:

* page composition;
* workspace/view-model;
* pure helper;
* child component.

Do not implement the move.

---

# Workflow Inventory

## 15. User Actions

Inventory all major frontend workflows.

At minimum:

```text
initial load
select Watchlist
create Watchlist
delete Watchlist
add Stock
remove Stock
edit Target Price
filter stocks
change sort
calculate allocation
resize across Table/Card breakpoint
```

---

## 16. Workflow Trace

For every major mutating workflow, document the current path.

Example format:

```text
UI event
→ +page handler
→ watchlistShell operation
→ watchlistApi
→ HTTP
→ response
→ state mutation
→ derived-state consequences
```

Use actual implementation.

---

## 17. Reset/Preservation Rules

Identify all established state-transition rules.

Examples from historical tasks include:

```text
active Watchlist change
→ filter reset
→ sort reset to Name ascending
→ allocation reset
```

versus:

```text
same-Watchlist stock mutation
→ filter preserved
→ sort preserved
→ allocation may invalidate
```

Confirm current behavior from code/tests.

---

## 18. Coupled State

Identify state values that are coupled by workflow semantics.

This is important for deciding whether separate independent stores would help or hurt.

For example, determine whether:

```text
active Watchlist
filter
sort
allocation
```

must transition together.

---

# Existing Client Architecture

## 19. `watchlistApi.ts`

Document its actual responsibility.

Determine whether it cleanly represents:

```text
HTTP client boundary
```

or has accumulated other concerns.

---

## 20. `watchlistShell.ts`

Document its actual responsibility.

Determine:

* what orchestration it already performs;
* what state it does not own;
* whether introducing another workspace layer would duplicate it;
* what distinction should exist between `watchlistShell` and a potential ViewModel/workspace.

This distinction is critical.

---

## 21. Pure Client Helpers

Inventory current pure client helpers such as:

```text
watchlistFilter
watchlistSort
watchlistNavigation
watchlistPresentation
distancePresentation
investmentAllocation
input parsers
formatting
```

Use actual files.

---

## 22. Preserve Good Existing Abstractions

Identify helpers that are already:

* cohesive;
* pure;
* easily tested;
* clearly named;
* correctly placed.

Explicitly recommend leaving good abstractions alone.

The refactoring plan must not rewrite code merely because TASK-041 exists.

---

# Existing Components

## 23. Component Inventory

Inventory all current Svelte components.

For each component record:

| Component | Responsibility | Important Props | Events/Callbacks | Local State | Assessment |
| --------- | -------------- | --------------- | ---------------- | ----------- | ---------- |

---

## 24. Component Quality

Determine which existing components already have good boundaries.

Likely candidates may include:

```text
WatchlistTabs
WatchlistTable
WatchlistCards
TargetPriceCell
```

but inspect actual code.

---

## 25. Missing Component Boundaries

Identify UI areas still implemented inline in `+page.svelte` that represent cohesive interactions.

Candidates to evaluate include:

```text
StockAddForm
CompanyFilter
InvestmentAllocationControls
Watchlist creation/management
StockPresentation
```

Do not assume every candidate deserves extraction.

---

# Component Extraction Criteria

## 26. Recommend Extraction Only When It Helps

A new component should provide one or more concrete benefits:

* hides substantial markup;
* owns local state;
* creates a meaningful interaction boundary;
* reduces unrelated concerns in parent;
* improves testing;
* gives a concept a clear name;
* reduces repeated presentation logic.

---

## 27. Avoid Cosmetic Extraction

Do not recommend extracting a component solely because:

```text
it is 10 lines of HTML
```

if doing so creates a large prop/callback API with no conceptual benefit.

---

# Prop Drilling Analysis

## 28. Current Prop Surfaces

Inspect existing major component prop interfaces.

Identify components with overly broad APIs.

---

## 29. Predicted Prop Explosion

For each proposed component extraction, estimate what data/actions would need to cross the boundary.

If a proposed:

```text
WatchlistWorkspaceToolbar
```

would require 20 unrelated props, report that as evidence that state ownership should be reconsidered rather than merely extracting markup.

---

## 30. Avoid Hidden Global State as Shortcut

Do not recommend global stores merely to eliminate props.

Props are explicit dependencies and are often desirable.

The question is whether the dependency surface remains cohesive.

---

# State Architecture Alternatives

## 31. Evaluate Current Page-Owned State

Assess whether retaining page-owned state with better component decomposition is sufficient.

This is a legitimate outcome.

Do not assume a ViewModel is mandatory.

---

## 32. Evaluate Svelte Context

Assess whether Svelte Context would improve the architecture.

Consider:

* dependency visibility;
* component coupling;
* testability;
* whether components are actually part of one cohesive workspace subtree.

Do not recommend Context merely as a prop-drilling escape hatch.

---

## 33. Evaluate Classic Stores

Assess whether Svelte stores (`writable`, `derived`, etc.) are appropriate for any state.

Do not assume they are preferred simply because state exists outside a component.

---

## 34. Evaluate Svelte 5 Rune-Based State

Evaluate whether a rune-based state module such as:

```text
watchlistWorkspace.svelte.ts
```

would improve the architecture.

Consider:

* `$state`;
* `$derived`;
* lifecycle;
* SSR safety;
* per-page-instance isolation;
* testability;
* explicit dependencies.

---

## 35. Avoid Accidental Singleton State

If recommending module-based rune state, explicitly address whether importing the module would create shared singleton state across requests/page instances.

The recommendation must remain safe for SvelteKit.

Prefer a factory/per-page instance if necessary.

---

# ViewModel / Presentation Model Evaluation

## 36. Evaluate a Workspace ViewModel

Determine whether the current page-level state/workflow complexity justifies a cohesive abstraction conceptually similar to:

```text
WatchlistWorkspace
```

or:

```text
WatchlistWorkspaceViewModel
```

---

## 37. Potential Responsibilities

Evaluate whether such an abstraction should own:

```text
server-derived Watchlist state
filter
sort
allocation
operation states
derived visibleStocks
managementBusy
page-level workflows
```

Do not assume all of these belong there.

---

## 38. What Must Stay Outside

Explicitly identify concerns that should NOT move into a workspace ViewModel.

Candidates likely include:

```text
HTTP implementation
pure sort/filter algorithms
local Target Price draft state
native overflow disclosure state
pure formatting
```

Confirm from actual architecture.

---

## 39. Shell vs Workspace

If recommending a Workspace abstraction, define a crisp distinction between:

```text
WatchlistWorkspace
```

and:

```text
watchlistShell
```

For example, a possible distinction is:

```text
Workspace
→ owns reactive page state and UI workflow lifecycle

Shell
→ stateless orchestration around API operations
```

Do not use this wording unless it accurately matches the current code.

---

# Recommended Responsibility Layers

## 40. Evaluate This Conceptual Model

Use the following only as a hypothesis to evaluate:

```text
Route
→ page composition

Components
→ presentation + local interaction state

Workspace/ViewModel
→ page-level reactive state + workflow lifecycle

Client Shell
→ stateless client application orchestration

Client API
→ HTTP transport

Pure helpers
→ deterministic filtering/sorting/parsing/formatting
```

Determine whether the actual project supports this model.

---

## 41. Simpler Alternative

If the audit concludes that:

```text
Route + components + existing shell/helpers
```

is sufficient without a ViewModel, recommend that instead.

Prefer the simplest architecture that creates clear responsibilities.

---

# Feature-Oriented Structure

## 42. Evaluate Current Directory Layout

Assess current:

```text
src/lib/components
src/lib/client
src/lib/shared
```

organization.

Determine whether it remains easy to navigate.

---

## 43. Feature-Oriented Alternative

Evaluate whether a structure conceptually like:

```text
src/lib/watchlist/
    components/
    client/
```

would improve discoverability.

---

## 44. Do Not Recommend Mass Move Lightly

Moving dozens of files produces:

* large diffs;
* import churn;
* git-history noise;
* merge difficulty;
* little behavioral value.

Recommend directory restructuring only if its human-navigation benefit clearly exceeds those costs.

---

## 45. Incremental Migration

If feature-oriented structure is desirable, propose an incremental migration rather than one giant file-move task.

---

# SvelteKit Route Responsibility

## 46. Define Ideal `+page.svelte`

Recommend what `+page.svelte` should be responsible for after refactoring.

A likely target is:

```text
create/obtain page workspace
compose major components
connect high-level dependencies
```

but derive the final answer from the audit.

---

## 47. Do Not Set Arbitrary Line Limit

Do not recommend:

```text
+page.svelte must be < 100 lines
```

or another arbitrary metric.

Responsibility matters more than line count.

---

# Error and Busy State

## 48. Inventory Operation States

Document all current status/error variables.

Examples may include:

```text
createStatus
createError
stockMutation...
targetPriceMutation...
allocation...
```

Use actual code.

---

## 49. State-Machine Smells

Identify places where several booleans/string states together represent an implicit state machine.

Example:

```text
idle
loading
success
error
```

Assess whether current representation is understandable.

Do not automatically replace everything with formal state machines.

---

## 50. `managementBusy`

Analyze the current aggregate busy rule.

Determine:

* which operations feed it;
* which components depend on it;
* whether ownership is currently clear;
* where it should live after refactoring.

---

# Error Ownership

## 51. Page-Level Errors

Identify which errors are page/workflow-level.

---

## 52. Local Errors

Identify errors that should remain local to a component, such as Target Price draft validation where applicable.

---

## 53. Avoid Giant Error Store

Do not recommend one global generic error object for unrelated workflows unless current behavior genuinely supports it.

---

# Responsive State

## 54. Table/Card Mode

Analyze current ownership of:

```text
presentationMode
```

and the 1120px breakpoint logic.

Determine whether it belongs:

* in `+page.svelte`;
* in a StockPresentation component;
* in a small responsive helper;
* elsewhere.

---

## 55. Navigation Responsive State

Compare this with responsive state already localized in Watchlist navigation.

Use this comparison to identify consistent frontend responsibility rules.

---

# Testing Architecture

## 56. Unit-Test Inventory

Identify which frontend behavior is currently covered through:

* pure helper unit tests;
* client shell tests;
* component-independent tests;
* E2E tests.

---

## 57. Testing Gaps Caused by Page Ownership

Determine whether important state-transition logic exists only inside `+page.svelte` and is therefore tested primarily through Playwright.

Examples may include:

```text
filter reset
sort reset
allocation invalidation
busy aggregation
```

Confirm actual cases.

---

## 58. ViewModel Testability

If recommending a Workspace/ViewModel, identify which current E2E-only state-transition rules could become deterministic unit tests.

This is a potential major benefit.

---

## 59. Do Not Replace E2E

Refactoring must not be justified by removing browser tests.

Permanent E2E coverage remains necessary for integrated workflows and responsive/accessibility behavior.

---

# Coupling Analysis

## 60. Dependency Graph

Produce a high-level frontend dependency graph.

Example shape:

```text
+page.svelte
   ↓
components
   ↓
client helpers

+page handlers
   ↓
watchlistShell
   ↓
watchlistApi
```

Use actual dependencies.

---

## 61. Circular Dependencies

Check for current or likely circular dependencies.

Report them.

---

## 62. Server Imports

Verify frontend modules do not accidentally depend on:

```text
$lib/server
```

or other server-only modules.

Report any violations.

Do not fix them in this task.

---

# Naming

## 63. Human-Oriented Names

Evaluate whether current names communicate responsibilities clearly.

Examples to assess:

```text
watchlistShell
WatchlistTabs
WatchlistTable
WatchlistCards
watchlistPresentation
```

Do not rename during the audit.

---

## 64. `watchlistShell`

Pay special attention to whether the term:

```text
Shell
```

is understandable to a new human developer.

If not, recommend whether it should eventually be renamed.

Do not perform the rename in TASK-041.

---

# Duplication

## 65. Table/Card Duplication

Inspect `WatchlistTable` and `WatchlistCards`.

Identify:

* intentional presentation duplication;
* shared formatting already extracted;
* remaining duplicated interaction logic;
* whether further extraction would improve or worsen readability.

---

## 66. Form Logic Duplication

Look for repeated patterns across:

```text
Watchlist create
Stock add
Allocation
Target Price
```

Do not create generic form abstractions merely because similar lines exist.

Distinguish meaningful duplication from normal explicit code.

---

# Complexity / Smell Report

## 67. Identify Concrete Smells

Report concrete examples of:

* oversized responsibility;
* state coupling;
* long handler chains;
* repeated reset logic;
* duplicated mutation lifecycle logic;
* excessive prop surfaces;
* hidden dependencies;
* unclear naming;
* UI/business orchestration mixing;
* hard-to-unit-test state transitions.

---

## 68. Severity

Classify findings:

```text
High
Medium
Low
```

based on maintainability impact.

Do not classify aesthetic preferences as High.

---

## 69. Evidence

Every finding must cite concrete files/functions/state relationships.

Do not report generic advice such as:

```text
components should be smaller
```

without evidence.

---

# Architecture Options

## 70. Produce At Least Three Options

Provide at least three realistic architecture options.

For example:

### Option A

```text
Keep page-owned state
Extract cohesive presentation components
```

### Option B

```text
Introduce WatchlistWorkspace ViewModel
Extract cohesive components
Keep shell/API/helpers
```

### Option C

```text
Multiple independent feature stores
```

These are examples only.

Use the actual audit findings.

---

## 71. Compare Options

For each option evaluate:

* readability;
* traceability;
* state coupling;
* prop complexity;
* testing;
* Svelte idiomaticity;
* SSR safety;
* implementation risk;
* migration effort.

---

## 72. Recommend One

Choose one preferred architecture.

Do not simply list alternatives without making a recommendation.

---

# Preliminary Hypothesis to Validate

The Product Owner currently favors an architecture broadly resembling:

```text
+page.svelte
│
│ composition
│
├── WatchlistNavigation
│
├── WatchlistWorkspaceToolbar
│   ├── StockAddForm
│   ├── CompanyFilter
│   └── InvestmentAllocationControls
│
└── StockPresentation
    ├── WatchlistTable
    └── WatchlistCards


WatchlistWorkspace (.svelte.ts or equivalent)
│
├── page-level reactive state
├── derived visible state
├── workflow lifecycle
│
├── uses existing watchlistShell
├── uses pure filter/sort helpers
└── uses allocation helpers


watchlistShell
→ stateless API/application orchestration

watchlistApi
→ HTTP transport
```

TASK-041 must evaluate this hypothesis critically.

It is not a mandatory implementation design.

If the actual code suggests a simpler or clearer architecture, recommend it.

---

# Local State Principle

## 73. State Placement Rule

Evaluate the project against:

> State should live as close as possible to where it is needed, but no closer.

---

## 74. Examples

Determine whether current/local ownership is appropriate for:

```text
Target Price draft
overflow menu state
form input text
responsive presentation
sort
filter
allocation
active Watchlist
```

Do not centralize all state by default.

---

# Server State vs UI State

## 75. Explicit Classification

The final recommendation must clearly distinguish:

### Server-derived state

Examples may include:

```text
watchlists
activeView
```

### UI/workspace state

Examples may include:

```text
filter
sort
```

### Transient server result retained client-side

Example may include:

```text
investmentAllocation
```

### Local interaction state

Examples may include:

```text
Target Price draft
menu open state
```

Use actual findings.

---

# Refactoring Safety

## 76. Behavior Preservation

The future refactoring must preserve all current product behavior.

TASK-041 should identify especially fragile behavioral invariants.

---

## 77. Critical Invariants

Inventory at least:

* active-Watchlist transition rules;
* filter reset/preservation;
* sort reset/preservation;
* allocation invalidation;
* management busy serialization;
* Target Price partial success;
* responsive Table/Card state preservation;
* navigation active-tab visibility;
* no duplicate mutation requests.

---

## 78. Test Protection

For every critical invariant, identify existing tests that protect it.

If no sufficient test exists, flag it before refactoring.

---

# Refactoring Sequence

## 79. Do Not Recommend One Giant Refactor

The audit must propose an incremental sequence.

---

## 80. Suggested Phase Types

Potential phases may include:

```text
1. lock/refine characterization tests
2. extract cohesive UI components
3. extract page-level workspace state
4. move workflow lifecycle
5. simplify +page.svelte
6. optional directory/naming cleanup
```

Do not use this sequence blindly.

Derive the final sequence from findings.

---

## 81. Each Phase Independently Green

Every future implementation task should leave:

```text
test
test:e2e
check
lint
build
```

green.

Avoid a multi-task architecture where the repository is knowingly broken between phases.

---

# Refactoring Task Plan

## 82. Produce Concrete Future Tasks

Recommend a numbered sequence beginning with TASK-042.

Each proposed task must have:

* narrow objective;
* files/responsibilities affected;
* behavior that must remain unchanged;
* why the task can be reviewed independently.

---

## 83. Avoid Excessive Task Fragmentation

Do not create ten tasks if three or four coherent phases are sufficient.

---

# Deliverable

## 84. Architecture Audit Document

Create:

```text
docs/architecture/frontend-architecture-audit.md
```

or another repository-consistent equivalent.

The document must contain the substantive analysis.

Do not leave the findings only in the completion report.

---

## 85. Required Audit Sections

The audit document must include:

1. current architecture overview;
2. `+page.svelte` responsibility map;
3. state inventory;
4. derived-state graph;
5. workflow map;
6. component inventory;
7. existing client-layer assessment;
8. coupling/smell findings;
9. testing implications;
10. architecture alternatives;
11. recommended target architecture;
12. responsibility definitions;
13. proposed file/component boundaries;
14. incremental refactoring plan;
15. risks;
16. explicit non-goals.

---

# Architecture Diagram

## 86. Current Diagram

Include a simple current frontend diagram.

---

## 87. Proposed Diagram

Include a proposed target diagram.

Use Mermaid only if the repository already uses/supports it appropriately; otherwise plain Markdown/ASCII is sufficient.

Prioritize readability in GitHub.

---

# ARCHITECTURE.md

## 88. Do Not Prematurely Rewrite Architecture

TASK-041 is an audit.

Do not rewrite accepted frontend architecture as though the proposed refactoring already exists.

---

## 89. Audit Reference

It is acceptable to add a concise note/reference indicating that frontend architecture has been reviewed and linking to the audit.

Only do so if consistent with repository documentation style.

---

# No Product Changes

## 90. No UI Changes

Do not change:

* layout;
* labels;
* styling;
* responsive behavior;
* accessibility behavior.

---

## 91. No State Refactoring

Do not move state out of `+page.svelte` yet.

---

## 92. No Component Extraction

Do not create the proposed new production components yet.

---

## 93. No Renaming

Do not rename:

```text
watchlistShell
WatchlistTabs
```

or other production modules yet.

---

## 94. No Directory Moves

Do not reorganize `src/lib` in TASK-041.

---

# Verification

## 95. Existing Checks

Because this is an audit/documentation task, execute:

```bash
npm run test
npm run check
npm run lint
npm run build
```

If no production/test code changes occur, `npm run test:e2e` is not mandatory.

---

## 96. Static Inspection

Additionally verify:

* all frontend components inspected;
* all client modules inspected;
* all page-level mutable state inventoried;
* all significant derived state inventoried;
* all major workflows traced;
* all reset/invalidation rules traced;
* existing test protection identified;
* no server-only frontend imports overlooked.

---

# Non-Goals

Do NOT implement:

* component extraction;
* ViewModel/workspace state;
* new Svelte stores;
* Context;
* new state-management library;
* Redux;
* Zustand;
* XState;
* directory restructuring;
* production file renames;
* UI changes;
* API changes;
* server refactoring;
* provider refactoring;
* persistence changes;
* authentication changes;
* new business functionality;
* production deployment.

Do not refactor while auditing.

---

# Acceptance Criteria

The task is complete when all of the following are true:

1. `+page.svelte` is fully inspected.
2. Its responsibilities are explicitly categorized.
3. Every page-level mutable state value is inventoried.
4. Every important derived state value is inventoried.
5. State consumers are identified.
6. State mutators are identified.
7. State lifecycle/persistence category is identified.
8. Server-derived vs UI state is distinguished.
9. Local component state is identified.
10. Important derivation dependencies are documented.
11. Initial-load workflow is traced.
12. Watchlist-selection workflow is traced.
13. Create workflow is traced.
14. Delete workflow is traced.
15. Add Stock workflow is traced.
16. Remove Stock workflow is traced.
17. Target Price workflow is traced.
18. Filter workflow is traced.
19. Sort workflow is traced.
20. Allocation workflow is traced.
21. Responsive presentation workflow is traced.
22. Reset/preservation rules are documented.
23. Coupled state transitions are identified.
24. `watchlistApi` responsibility is assessed.
25. `watchlistShell` responsibility is assessed.
26. Pure client helpers are inventoried.
27. Good existing abstractions are explicitly identified.
28. Every current Svelte component is assessed.
29. Missing meaningful component boundaries are identified.
30. Cosmetic-only extraction is avoided.
31. Current/potential prop drilling is analyzed.
32. Page-owned-state alternative is evaluated.
33. Svelte Context is evaluated.
34. classic stores are evaluated.
35. Svelte 5 rune-based state is evaluated.
36. SSR/singleton implications are addressed.
37. Workspace/ViewModel option is evaluated.
38. Workspace vs shell responsibility is explicitly distinguished if recommended.
39. Feature-oriented directory organization is evaluated.
40. Mass file movement is not recommended without clear benefit.
41. Ideal future `+page.svelte` responsibility is defined.
42. Error/busy state is inventoried.
43. `managementBusy` ownership is analyzed.
44. responsive presentation ownership is analyzed.
45. frontend testing architecture is assessed.
46. E2E-only state-transition logic is identified.
47. potential unit-test gains from refactoring are identified.
48. frontend dependency graph is produced.
49. circular dependencies are checked.
50. server-only import violations are checked.
51. naming clarity is assessed.
52. Table/Card duplication is assessed.
53. concrete architecture smells are reported with evidence.
54. findings are severity-ranked.
55. at least three realistic architecture options are compared.
56. one target architecture is recommended.
57. Product Owner's preliminary hypothesis is explicitly evaluated.
58. local-state placement rules are defined.
59. critical behavioral invariants are inventoried.
60. existing test protection for invariants is mapped.
61. missing characterization coverage is identified.
62. incremental refactoring sequence is proposed.
63. sequence keeps repository green after each phase.
64. concrete future tasks beginning with TASK-042 are proposed.
65. task plan is not excessively fragmented.
66. substantive audit document is committed to `docs/architecture/` or equivalent.
67. current architecture diagram is included.
68. proposed architecture diagram is included.
69. no production frontend code is refactored.
70. no UI behavior changes.
71. no directory moves.
72. no production module renames.
73. no unnecessary dependency is introduced.
74. existing checks pass.
75. no production deployment occurs.

---

# Verification Commands

Execute:

```bash
npm run test
npm run check
npm run lint
npm run build
```

Do not claim a command passed unless it actually passed.

Do not run/deploy production.

---

# Task Status

After the audit, recommendations, documentation, and verification are complete, change:

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
2. current `+page.svelte` size and responsibility summary;
3. complete page-state inventory summary;
4. server-derived state findings;
5. UI/workspace-state findings;
6. local-component-state findings;
7. derived-state graph summary;
8. workflow/coupling findings;
9. reset/preservation-rule findings;
10. `watchlistApi` assessment;
11. `watchlistShell` assessment;
12. pure-helper assessment;
13. component inventory/assessment;
14. recommended component extractions;
15. extractions explicitly rejected as cosmetic;
16. prop-drilling findings;
17. error/busy-state findings;
18. responsive-state findings;
19. testing architecture findings;
20. current E2E-only logic that could become unit-testable;
21. dependency/circular-import findings;
22. naming findings;
23. Table/Card duplication findings;
24. high-severity smells;
25. medium-severity smells;
26. low-severity smells;
27. architecture options considered;
28. recommended target architecture;
29. whether a Workspace/ViewModel is recommended;
30. if yes, exact Workspace vs `watchlistShell` distinction;
31. Svelte 5 rune-state recommendation;
32. Context/store recommendation;
33. SSR/per-instance-state considerations;
34. feature-oriented directory recommendation;
35. proposed future `+page.svelte` responsibility;
36. critical behavior invariants;
37. characterization-test gaps;
38. proposed incremental refactoring phases;
39. proposed TASK-042+ sequence;
40. architecture audit document location;
41. `ARCHITECTURE.md` changes, if any;
42. results of `test`, `check`, `lint`, and `build`;
43. confirmation no production frontend code was refactored;
44. confirmation no product/UI behavior changed;
45. confirmation no production deployment occurred;
46. confirmation task status changed to Done;
47. assumptions or unresolved Product Owner decisions;
48. deviations from this task.

Do not proceed with TASK-042.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
