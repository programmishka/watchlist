# TASK-032: Default Watchlist Sorting by Company Name

## Status

Done

## Goal

Introduce an explicit default table sort for every newly loaded active Watchlist.

Currently, stocks are initially displayed in the order in which their symbols are stored in the Watchlist. The user can then sort the table manually.

The new V3 presentation rule is:

> Whenever an active Watchlist is initially loaded or changes to another Watchlist, the stock table starts sorted by company Name ascending.

Conceptually:

```text
Watchlist loaded
      ↓
Name ascending
```

The existing sorting functionality from TASK-023 must be reused.

This is a **client-side presentation rule**.

Do not change:

* persisted symbol order;
* Watchlist repository semantics;
* REST response order;
* server-side Watchlist composition;
* stock-add persistence behavior.

---

# Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* TASK-016;
* TASK-019;
* TASK-020;
* TASK-022;
* TASK-023;
* current `watchlistSort.ts`;
* current `+page.svelte`;
* existing sorting unit tests;
* existing sorting Playwright tests;
* this task completely.

Inspect the current sorting implementation before changing state behavior.

TASK-023 already established:

* client-owned sort state;
* pure `sortWatchlistStocks(...)`;
* stable sorting;
* `Intl.Collator`-based string comparison;
* missing values last;
* filtering before sorting;
* sort reset on active-Watchlist transitions;
* sort preservation during same-Watchlist mutations.

Reuse these rules.

---

# Product Rule

## 1. Default Sort

The default Watchlist sort is:

```text
Column:    Name
Direction: Ascending
```

Conceptually:

```ts
{
  column: 'name',
  direction: 'asc'
}
```

Use the actual existing sort type and column identifiers.

---

## 2. Default Means Active Sort

The initial Name sort is a real active sort state.

Do not merely reorder the rows while leaving the table's sort state unset.

On initial load, the Name column must therefore indicate:

```text
ascending
```

through the existing visual and accessibility mechanisms.

---

## 3. Persisted Order Is Unchanged

Suppose persistence contains:

```text
MSFT
AAPL
SAP.DE
```

The application may display:

```text
Apple Inc.
Microsoft Corporation
SAP SE
```

because Name ascending is active.

The persisted symbols must remain:

```text
MSFT
AAPL
SAP.DE
```

Do not reorder or rewrite the persisted Watchlist document.

---

## 4. API Order Is Unchanged

Do not sort server-side API responses merely to satisfy this UI requirement.

The browser owns the presentation sort.

This preserves the existing separation:

```text
persisted Watchlist order
        ↓
API/composed Watchlist
        ↓
client filtering
        ↓
client sorting
        ↓
visible table rows
```

---

# Default Sort Definition

## 5. Central Default

Introduce one explicit reusable definition for the default Watchlist sort.

Conceptually:

```ts
DEFAULT_WATCHLIST_SORT
```

representing:

```text
Name ascending
```

Place it with the existing client-side Watchlist sorting model/utility.

Do not duplicate:

```ts
{ column: 'name', direction: 'asc' }
```

across multiple reset points in `+page.svelte`.

---

## 6. Immutable Usage

Avoid accidental mutation of a shared default object.

Use whichever design best fits the current state model:

* immutable/read-only constant;
* factory returning a fresh sort value;
* equivalent safe approach.

Do not introduce complexity solely for this concern.

---

# Initial Application Load

## 7. Existing Active Watchlist

When the application initially loads and an active Watchlist exists:

```text
load Watchlists
      ↓
load active Watchlist
      ↓
display stocks
      ↓
Name ascending
```

The stored/API stock order must not be visible as the initial table order unless it happens to match Name ascending.

---

## 8. Initial Sort Indicator

On initial populated Watchlist load:

```text
Name
```

must be the active sort column.

The existing direction indicator should show ascending.

Accessibility semantics must report:

```text
aria-sort="ascending"
```

for the Name column.

Other sortable columns remain unsorted:

```text
aria-sort="none"
```

or the existing equivalent.

---

## 9. Empty Watchlist

An empty Watchlist still has the default sort state conceptually.

No special behavior is required merely because there are zero stocks.

When a stock is subsequently added, it should appear according to the active default Name sort.

---

## 10. No Watchlists

When the user has no Watchlists, no table is displayed.

Do not invent table state UI solely to expose the default sort.

When the first Watchlist is later created and populated, Name ascending applies.

---

# Active-Watchlist Transitions

## 11. Tab Switch

If the user currently has:

```text
Price descending
```

and switches to another Watchlist:

```text
Price descending
      ↓
switch Watchlist
      ↓
Name ascending
```

This replaces TASK-023's previous concept of resetting to "no sort."

---

## 12. Create Watchlist

When a newly created Watchlist becomes active:

```text
sort state
→ Name ascending
```

The new Watchlist will initially be empty, but subsequent additions use the active Name sort.

---

## 13. Delete Active Watchlist

If deleting the active Watchlist causes another Watchlist to become active:

```text
replacement Watchlist
→ Name ascending
```

Do not carry the deleted Watchlist's manual sort selection into the replacement Watchlist.

---

## 14. Delete Final Watchlist

If deleting the final Watchlist results in:

```text
no Watchlists
```

the table disappears normally.

The next active Watchlist created later must use Name ascending.

---

# Same-Watchlist Mutations

## 15. Add Stock

Adding a stock to the currently active Watchlist MUST NOT reset the active sort.

Examples:

```text
active sort:
Name ascending

add stock
→ Name ascending remains
→ new stock appears in correct Name position
```

and:

```text
active sort:
Price descending

add stock
→ Price descending remains
→ new stock appears in correct Price position
```

This preserves TASK-023 behavior.

---

## 16. Remove Stock

Removing a stock from the active Watchlist must preserve the current sort.

---

## 17. Target Price Save

Saving a Target Price must preserve the current sort.

If the active sort is a numeric column affected by the mutation, reactive sorting may reposition the row according to the existing behavior.

Do not reset to Name.

---

## 18. Investment Allocation

Calculating or invalidating investment allocation must not reset the current sort.

Savings Amount remains non-sortable under the existing design unless separately changed by another task.

---

## 19. Filtering

Changing the company-name filter must not reset the active sort.

The existing composition remains:

```text
activeView.stocks
        ↓
filterStocksByCompanyName
        ↓
sortWatchlistStocks
        ↓
visibleStocks
```

---

# Manual Sorting

## 20. Name Header First Click

Because Name ascending is already active initially, clicking the Name sort header must follow the existing toggle rule.

Expected:

```text
initial:
Name ascending

click Name
→ Name descending
```

Do not treat the first click as activation to ascending again.

---

## 21. Other Column First Click

From:

```text
Name ascending
```

clicking another sortable column, for example Price, should follow the existing activation rule:

```text
Price ascending
```

unless TASK-023 explicitly defines a different first-direction rule.

Preserve that established rule.

---

## 22. Toggle Behavior

Subsequent clicks continue using existing TASK-023 semantics.

Do not redesign sorting interactions.

---

# Name Comparison

## 23. Existing Name Comparator

Reuse the existing TASK-023 Name comparator.

Do not introduce a second default-sort-specific comparison implementation.

---

## 24. Locale-Aware Comparison

Preserve the existing:

```text
Intl.Collator
```

semantics.

Do not replace them with simple:

```text
a < b
```

comparison.

---

## 25. Case Insensitivity

Preserve existing case-insensitive Name comparison behavior.

---

## 26. Missing Names

Stocks with:

```text
name = undefined
```

must remain last under Name ascending.

Do not fall back to Symbol for the default Name sort.

Conceptually:

```text
Alphabet
Apple
Microsoft
SAP
—
—
```

---

## 27. Stable Ties

Stocks whose Name values compare equally must preserve the existing stable-sort semantics.

Do not introduce a secondary Symbol sort unless TASK-023 already defines one.

---

# Client State

## 28. Sort State Ownership

Sort state remains owned by the existing client/page state.

Do not persist sort state.

Do not move it to:

* server session;
* KV;
* URL query parameters;
* browser localStorage.

---

## 29. No Per-Watchlist Sort Memory

Do not remember different manual sort selections for individual Watchlists.

Every active-Watchlist transition resets to:

```text
Name ascending
```

This task introduces a default, not persistent per-Watchlist preferences.

---

# Server and Persistence

## 30. No Repository Changes

Do not modify:

```text
WatchlistRepository
CloudflareKvWatchlistRepository
```

for this task.

---

## 31. No WatchlistService Changes

Do not reorder symbols inside:

```text
WatchlistService
```

or change add/remove semantics.

---

## 32. No WatchlistQueryService Sorting

Do not introduce Name sorting inside:

```text
WatchlistQueryService
```

The server should continue composing stocks according to its established Watchlist order.

---

## 33. No REST Changes

No REST endpoint or DTO shape changes are required.

---

# Unit Tests — Sort Default

## 34. Default Constant

Add a unit test or equivalent compile/runtime coverage proving the central default represents:

```text
Name ascending
```

if useful given the implementation shape.

Do not write a trivial test solely to test a literal constant if existing orchestration tests cover it more meaningfully.

---

## 35. Default Name Sorting

Given API/input order:

```text
Microsoft
Apple
SAP
```

default presentation sorting should produce:

```text
Apple
Microsoft
SAP
```

Use the existing sort helper rather than a new algorithm.

---

## 36. Missing Name Last

Default sorting must place missing names last.

---

## 37. Stable Equal Names

Preserve stable order for equal names.

---

# Client/Orchestration Tests

## 38. Initial Load

Update/add coverage showing that an initially loaded populated Watchlist uses Name ascending rather than persisted/API order.

---

## 39. Tab Switch Reset

Given a manual non-default sort:

```text
Price descending
```

switching active Watchlist resets to:

```text
Name ascending
```

---

## 40. Create Reset

Creating a new active Watchlist resets to:

```text
Name ascending
```

---

## 41. Delete Replacement Reset

Deleting the active Watchlist and transitioning to its server-selected replacement resets to:

```text
Name ascending
```

---

## 42. Add Preserves Default

With:

```text
Name ascending
```

active, adding a stock preserves the sort and the new stock appears in the correct derived position.

---

## 43. Add Preserves Manual Sort

With:

```text
Price descending
```

active, adding a stock preserves Price descending.

This behavior already exists; preserve existing regression coverage.

---

## 44. Other Same-Watchlist Mutations

Preserve existing tests proving sort state survives:

* remove stock;
* Target Price mutation;
* filtering;
* other same-Watchlist state changes.

Do not duplicate all existing coverage unnecessarily.

---

# Playwright E2E

## 45. Existing Sorting Spec

Extend:

```text
tests/e2e/watchlist-sorting.spec.ts
```

rather than creating a new E2E spec.

This is a change to the existing sorting feature.

---

## 46. Initial Load Default

Provide deterministic fixture data whose API order differs from Name ascending.

Example API order:

```text
SAP SE
Microsoft Corporation
Apple Inc.
```

Expected initial table:

```text
Apple Inc.
Microsoft Corporation
SAP SE
```

---

## 47. Initial Accessibility State

Verify on initial load:

```text
Name
→ aria-sort="ascending"
```

and another representative sortable column reports the inactive state.

---

## 48. Name First Click

From initial:

```text
Name ascending
```

click Name once.

Expected:

```text
Name descending
```

and rows reverse according to the existing comparator.

---

## 49. Other Column Activation

From initial Name ascending, click Price.

Expected:

```text
Price ascending
```

according to existing activation semantics.

---

## 50. Tab Switch

Manually sort the first Watchlist by another column/direction.

Switch tabs.

Expected new active Watchlist:

```text
Name ascending
```

---

## 51. Create Watchlist

Start with a manual non-default sort.

Create a new active Watchlist.

Expected sort state:

```text
Name ascending
```

When a stock is added to that new Watchlist, it participates in the default Name ordering.

---

## 52. Delete Replacement

Start with a manual non-default sort.

Delete the active Watchlist so another becomes active.

Expected:

```text
Name ascending
```

---

## 53. Add Stock Under Default Sort

Start with a populated Watchlist sorted by default Name ascending.

Add a stock whose company name belongs between two existing rows.

Verify it appears in the correct Name position without an explicit new sort click.

Use mocked API data.

---

## 54. Add Stock Under Manual Sort

Preserve existing E2E coverage showing that adding a stock while another sort is active does not reset to Name.

---

## 55. Missing Name

Include or reuse a fixture with:

```text
name = undefined
```

Verify it appears last under default Name ascending.

---

## 56. Filtering Composition

Verify existing filter + sort behavior remains correct under the new default.

For example:

```text
initial Name ascending
→ apply company-name filter
→ matching rows remain Name ascending
```

Do not create excessive duplicate coverage if an existing test already proves the composition.

---

## 57. Mobile

Verify the default sort indicator and table remain usable in the existing mobile Chromium project.

No responsive redesign is required.

---

# Architecture Documentation

## 58. Default Presentation Sort

Update `ARCHITECTURE.md` to state:

> The default stock-table presentation sort for every newly active Watchlist is company Name ascending.

---

## 59. Reset Semantics

Document:

```text
initial active Watchlist
→ Name ascending

active Watchlist changes
→ Name ascending

same-Watchlist mutation
→ preserve current sort
```

---

## 60. Persistence Separation

Explicitly state that sorting remains client-side presentation state and does not alter persisted Watchlist symbol order.

---

## 61. TASK-023 Evolution

Where appropriate, note that TASK-032 supersedes TASK-023 only regarding the reset/default state:

```text
TASK-023:
active-Watchlist transition
→ reset sort

TASK-032:
reset now means
→ Name ascending
```

All other TASK-023 sorting semantics remain authoritative.

---

# Historical Task Note

## 62. TASK-023

If task-history conventions permit, add a concise supersession note to TASK-023.

Do not change its Done status.

Do not rewrite its historical specification.

---

# README

## 63. README Change

A README change is optional.

If the README describes table sorting behavior in sufficient detail that the new default matters, update it briefly.

Do not add low-level client-state documentation merely for this change.

---

# Non-Goals

Do NOT implement:

* server-side sorting;
* persisted sorting;
* per-Watchlist sort preferences;
* browser localStorage sort preferences;
* URL sort parameters;
* multi-column sorting;
* secondary Symbol tie-breaking;
* new sortable columns;
* Savings Amount sorting;
* table redesign;
* pagination;
* filtering changes;
* Watchlist symbol reordering;
* production deployment;
* unrelated V3 UI improvements.

Do not proceed to another V3 improvement.

---

# Acceptance Criteria

The task is complete when all of the following are true:

1. Default Watchlist sort is Name ascending.
2. The default is represented as an actual active sort state.
3. One central default definition exists.
4. Initial populated Watchlist load uses Name ascending.
5. Initial row order does not depend on persisted/API order.
6. Name initially reports ascending accessibility state.
7. Missing names remain last.
8. Equal names preserve stable sorting.
9. Existing `Intl.Collator` comparison is reused.
10. Clicking Name from the default toggles to descending.
11. Clicking another column activates that column using existing semantics.
12. Tab switch resets to Name ascending.
13. Watchlist creation resets to Name ascending.
14. Delete/replacement transition resets to Name ascending.
15. Final-Watchlist deletion remains correct.
16. Adding a stock preserves Name ascending when it is active.
17. New stock is reactively inserted into the correct Name position.
18. Adding a stock preserves a manually selected non-default sort.
19. Removing a stock preserves current sort.
20. Target Price save preserves current sort.
21. Filtering preserves current sort.
22. Investment allocation does not reset sort.
23. Persisted Watchlist order is unchanged.
24. WatchlistRepository is unchanged.
25. WatchlistService ordering semantics are unchanged.
26. WatchlistQueryService does not gain presentation sorting.
27. REST response semantics are unchanged.
28. Sort state remains client-only.
29. Sort state is not persisted.
30. No per-Watchlist sort memory is introduced.
31. Existing sort helper is reused.
32. Unit/client tests cover default sorting.
33. Tests cover missing-name behavior.
34. Tests cover active-Watchlist reset behavior.
35. Existing same-Watchlist preservation coverage remains.
36. Playwright covers initial default ordering.
37. Playwright covers initial `aria-sort`.
38. Playwright covers first Name toggle.
39. Playwright covers another-column activation.
40. Playwright covers tab-switch reset.
41. Playwright covers create reset.
42. Playwright covers delete/replacement reset.
43. Playwright covers stock addition under default sorting.
44. Playwright preserves manual-sort stock-add behavior.
45. Playwright covers missing Name last where practical.
46. Filter/sort composition remains correct.
47. Mobile table behavior remains correct.
48. `ARCHITECTURE.md` documents the new default.
49. TASK-023 historical behavior is preserved/superseded narrowly.
50. Existing project checks pass.
51. No unnecessary dependency is introduced.
52. No production deployment occurs.

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

1. initial API order differs from Name order and UI displays Name ascending;
2. Name has `aria-sort="ascending"` immediately after load;
3. first Name click produces descending order;
4. Price or another column can still become active normally;
5. tab switch resets a manual sort to Name ascending;
6. create transition resets to Name ascending;
7. delete/replacement transition resets to Name ascending;
8. stock addition under Name ascending inserts correctly;
9. stock addition under another active sort preserves that sort;
10. missing Name remains last;
11. persisted/API order is not modified.

Do not report a verification step as successful unless it was actually executed successfully.

Do NOT deploy production.

---

# Task Status

After all implementation and verification criteria are satisfied, change:

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
2. previous initial/reset sort behavior;
3. final default sort definition;
4. location of the central default;
5. initial-load behavior;
6. initial accessibility state;
7. Name first-click behavior;
8. other-column activation behavior;
9. tab-switch reset behavior;
10. create reset behavior;
11. delete/replacement reset behavior;
12. stock-add behavior under default sort;
13. stock-add behavior under manual sort;
14. remove/Target-Price/filter/allocation preservation behavior;
15. missing-name behavior;
16. stable-sort behavior;
17. confirmation persisted symbol order is unchanged;
18. confirmation API/server ordering is unchanged;
19. unit/client tests added/changed;
20. Playwright scenarios added/changed;
21. mobile verification;
22. `ARCHITECTURE.md` changes;
23. TASK-023 supersession note;
24. README changes, if any;
25. results of `test`, `test:e2e`, `check`, `lint`, and `build`;
26. confirmation no server-side/persisted sorting was introduced;
27. confirmation no production deployment occurred;
28. confirmation task status changed to Done;
29. assumptions or unresolved issues;
30. deviations from this task or `ARCHITECTURE.md`.

Do not proceed to another V3 improvement.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
