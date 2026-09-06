# TASK-023: Watchlist Table Sorting

## Status

Done

## Goal

Implement client-side sorting of the currently displayed Watchlist table through interactive column headers.

Sorting applies to the stock data already loaded in the browser.

The workflow is:

```text
activeView.stocks
        |
        v
company-name filter
        |
        v
filteredStocks
        |
        v
table sorting
        |
        v
visibleStocks
        |
        v
WatchlistTable
```

The user can sort by each of the eight stock-data columns:

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

The `Delete` column is not sortable.

Sorting:

* is client-side only;
* performs no API request;
* does not mutate `activeView.stocks`;
* works together with the existing company-name filter;
* resets when the active Watchlist changes;
* remains active for same-Watchlist mutations;
* is covered by permanent Playwright tests.

Do not implement investment-allocation UI in this task.

---

## Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* this task completely

Relevant existing frontend functionality includes:

* `WatchlistTable.svelte`;
* company-name filtering from TASK-022;
* `filteredStocks`;
* total/filtered counts;
* inline Target Price editing;
* stock add/remove;
* permanent Playwright E2E infrastructure.

No backend/API change is required.

---

# Sorting Model

## 1. Sort State

Introduce small UI-local sort state representing:

```ts
type SortDirection = 'asc' | 'desc';
```

and the selected sortable stock field.

Conceptually:

```ts
interface WatchlistSort {
  column: WatchlistSortColumn;
  direction: SortDirection;
}
```

The exact representation may follow existing client conventions.

Do not persist sorting.

---

## 2. Sortable Columns

Support exactly these sortable columns:

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

Map them to the corresponding stock values:

```text
Symbol             -> symbol
Name               -> name
Cap (USD)          -> marketCapBillionsUsd
Price              -> price
Div                -> dividendYield
Currency           -> currency
Target Price       -> targetPrice
Distance to Target -> distanceToTarget
```

Do not make `Delete` sortable.

---

## 3. First Click

When no sorting is active, clicking a sortable column starts:

```text
ascending
```

sorting.

Example:

```text
click Price
-> Price ascending
```

---

## 4. Second Click

Clicking the currently sorted column again toggles:

```text
ascending -> descending
descending -> ascending
```

There is no third:

```text
unsorted
```

state.

---

## 5. Switching Columns

When another column is selected, sorting starts ascending.

Example:

```text
Price descending
       |
click Name
       |
       v
Name ascending
```

Do not preserve the previous direction when changing columns.

---

## 6. Initial State

Initial Watchlist rendering has no active sort.

Rows therefore remain in persisted Watchlist/API order until the user chooses a sortable column.

Do not automatically sort by Symbol or Name.

---

# String Sorting

## 7. String Columns

Sort these as strings:

```text
Symbol
Name
Currency
```

Use locale-aware string comparison.

Prefer:

```text
localeCompare
```

or a reusable `Intl.Collator`.

Do not compare strings through raw `<` / `>` where a locale-aware comparison is more appropriate.

---

## 8. Case Insensitivity

String sorting must be case-insensitive.

Conceptually:

```text
apple
Apple
APPLE
```

should compare by their textual value rather than uppercase/lowercase ASCII ordering.

Use an appropriate collator option or normalized comparison.

Do not rewrite displayed values.

---

## 9. Symbol Sorting

Sort the complete symbol string.

Examples:

```text
AAPL
GAW.L
HEXA-B.ST
SAP.DE
```

Do not parse:

* exchange suffixes;
* punctuation;
* ticker/exchange separately.

---

## 10. Name Sorting

Sort:

```text
stock.name
```

when available.

Stocks without a company name follow the missing-value rule defined below.

Do not fall back to symbol for sorting missing names.

---

## 11. Currency Sorting

Sort the displayed currency value exactly as an application string.

For example:

```text
CHF
EUR
GBp
NOK
USD
```

Do not convert `GBp` to `GBP` for sorting.

---

# Numeric Sorting

## 12. Numeric Columns

Sort these numerically:

```text
Cap (USD)
Price
Div
Target Price
Distance to Target
```

Do not sort their formatted display strings.

For example:

```text
2
10
100
```

must sort numerically as:

```text
2
10
100
```

not lexicographically as:

```text
10
100
2
```

---

## 13. Dividend Sorting

Sort by the raw server-provided:

```text
dividendYield
```

ratio.

Do not sort the formatted percentage text.

---

## 14. Distance Sorting

Sort by the raw:

```text
distanceToTarget
```

number.

Negative values must sort naturally.

Example ascending:

```text
-0.20
-0.05
0
0.10
```

Do not sort by absolute distance.

---

## 15. Market Cap Sorting

Sort by:

```text
marketCapBillionsUsd
```

directly.

No additional FX or unit conversion occurs.

---

# Missing Values

## 16. Missing Values Always Last

For optional sortable values, missing values must appear at the end in both directions.

This applies at least to:

```text
name
marketCapBillionsUsd
price
currency
targetPrice
distanceToTarget
```

where the current client/API type permits absence.

Example ascending:

```text
100
200
—
```

Example descending:

```text
200
100
—
```

Do NOT allow missing values to move to the top when descending.

---

## 17. Missing vs Zero

Numeric:

```text
0
```

is a real value.

It must participate normally in numeric sorting.

Do not treat zero as missing.

For example ascending:

```text
-0.1
0
0.2
—
```

---

## 18. NaN Robustness

Client API data should already be valid, but sorting helpers should not produce unstable behavior if a non-finite numeric value reaches the client unexpectedly.

Treat unusable non-finite numeric values as missing for presentation sorting purposes.

Do not alter `activeView`.

---

# Stable Sorting

## 19. Stable Tie Behavior

Stocks with equal sort values must preserve their original order from the filtered input collection.

Example:

```text
Original:
AAPL   dividend 0
SAP.DE dividend 0
GAW.L  dividend 0
```

Sorting by Div must retain:

```text
AAPL
SAP.DE
GAW.L
```

for those equal values.

---

## 20. Explicit Stability

Modern JavaScript sorting is stable, but make the intended behavior clear and test it.

If the implementation uses a decorated index as a tie-breaker, keep it small and readable.

Do not use Symbol as an arbitrary secondary sort key.

The tie-breaker is original input order.

---

# Filter + Sort Composition

## 21. Filtering Happens First

The data pipeline is:

```text
activeView.stocks
        |
        v
filterStocksByCompanyName(...)
        |
        v
filteredStocks
        |
        v
sortWatchlistStocks(...)
        |
        v
visibleStocks
```

Do not sort the complete collection and then implement separate filtering semantics.

---

## 22. Counts Ignore Sorting

Sorting does not affect:

```text
totalStockCount
filteredStockCount
```

Counts remain derived from:

```text
activeView.stocks
filteredStocks
```

not from sort state.

For example:

```text
4 stocks
filter -> 2 matches
sort Price descending

count remains:
2 of 4 stocks
```

---

## 23. Filter Preserved During Sort

Changing sort column/direction must not modify the company-name filter.

---

## 24. Sort Preserved During Filter Changes

Once the user has selected a sort, typing or changing the company-name filter should preserve that sort.

The newly filtered subset is sorted using the current sort state.

Example:

```text
sort Price descending
filter = "a"
```

The matching rows remain Price-descending.

---

## 25. Clearing Filter

Clearing the filter restores all stocks while preserving the current sort.

Do not reset sorting merely because filtering becomes inactive.

---

# Active Watchlist Changes

## 26. Reset on Tab Switch

When switching to another Watchlist, reset sorting to the initial unsorted state.

The new Watchlist initially appears in persisted Watchlist/API order.

This mirrors the existing filter-reset behavior.

---

## 27. Reset on Watchlist Creation

When a newly created Watchlist becomes active, reset sorting.

---

## 28. Reset on Watchlist Deletion Transition

When deleting the active Watchlist causes another Watchlist to become active, reset sorting.

---

## 29. Initial Application Load

Initial load starts unsorted.

Do not persist sort state in:

* localStorage;
* sessionStorage;
* URL;
* server persistence.

---

# Same-Watchlist Mutations

## 30. Preserve Sort on Target Price Update

If Target Price is changed while sorting is active, preserve the selected sort column/direction.

Because a sorted field may itself change, the row may move to a new sorted position.

Example:

```text
sort Target Price ascending

AAPL 200
SAP  250

change AAPL -> 300

result:
SAP  250
AAPL 300
```

This movement is correct.

Do not freeze row positions after mutation.

---

## 31. Preserve Sort on Stock Add

When a stock is added to the same Watchlist:

* preserve current sort state;
* insert the newly returned stock into its correct derived sorted position.

Do not append it visually merely because the backend appended it to Watchlist order while sorting is active.

If sorting is inactive, normal persisted/API order remains authoritative.

---

## 32. Preserve Sort on Stock Remove

When a stock is removed:

* preserve current sort state;
* derive the remaining sorted rows normally.

---

# Sorting Helper

## 33. Pure Client Helper

Introduce a client-safe pure sorting helper.

Conceptually:

```ts
sortWatchlistStocks(
  stocks: WatchlistStock[],
  sort: WatchlistSort | undefined
): WatchlistStock[]
```

The exact API may differ.

The helper must not mutate the input array.

---

## 34. No Input Mutation

Do not call:

```ts
stocks.sort(...)
```

directly on `activeView.stocks` or `filteredStocks` if that mutates shared state.

Use a copied collection or another non-mutating approach.

This is a critical requirement.

---

## 35. Unsorted Helper Behavior

When no sort is active, preserve the existing collection order.

Avoid unnecessary mutation.

Returning the original array is acceptable if it remains read-only in the caller.

---

# Table Header UI

## 36. Interactive Headers

Each sortable header must contain an accessible interactive control.

Prefer a real:

```html
<button>
```

inside the `<th>`.

Do not make the entire `<th>` clickable through a generic event handler without an interactive element.

---

## 37. Delete Header

The `Delete` header remains plain text.

Do not render a sort button there.

---

## 38. Sort Indicator

The active sorted column must show direction visually.

A simple indicator is sufficient:

```text
↑
↓
```

or an equivalent accessible visual representation.

Do not add an icon library.

---

## 39. Inactive Headers

Inactive sortable headers should remain visibly interactive but should not show a misleading active direction.

Do not render an arrow on every column unless the distinction between inactive and active is unambiguous.

---

## 40. aria-sort

Expose sort state using table semantics.

Apply:

```text
aria-sort="ascending"
aria-sort="descending"
```

to the active sortable `<th>`.

Inactive sortable headers should use:

```text
aria-sort="none"
```

or omit it according to the cleanest valid semantic implementation.

Do not put `aria-sort` on the button itself when table-header semantics belong on `<th>`.

---

## 41. Accessible Button Names

Sort controls must have understandable accessible names.

Examples conceptually:

```text
Sort by Price
Sort by Name
```

or button text that naturally communicates the column.

The current direction should be discoverable through `aria-sort`.

Do not make screen readers depend solely on `↑` / `↓`.

---

## 42. Keyboard Operation

A keyboard user must be able to:

* focus each sortable header control;
* activate it using normal button keyboard behavior;
* observe the changed sort state.

Do not implement custom keyboard handling where native buttons suffice.

---

# WatchlistTable Component Boundary

## 43. Table Receives Visible Stocks

Pass:

```text
visibleStocks
```

to `WatchlistTable`.

The table should render the collection it receives.

---

## 44. Sort Intent

`WatchlistTable` may receive:

```text
sort
onSort(column)
```

or equivalent presentation-oriented props.

It must not own persisted/global sort state.

The page/client UI state remains the owner.

---

## 45. Existing Table Responsibilities

Preserve:

* Target Price editing;
* Delete column;
* numeric formatting;
* missing-value formatting;
* responsive horizontal scrolling.

Do not regress existing functionality while changing header markup.

---

# Responsive Design

## 46. Header Buttons

Sort buttons must fit naturally within existing table headers.

Do not significantly increase the table's minimum width solely because headers became buttons.

Keep controls compact.

---

## 47. Mobile Table

At approximately:

```text
375px
```

the existing behavior remains:

```text
page does not horizontally overflow
table container scrolls horizontally
```

Sortable headers must remain reachable through table scrolling.

---

# Accessibility

## 48. Visible Focus

Header sort buttons must retain visible keyboard focus.

Do not remove native outlines without a suitable replacement.

---

## 49. Sort State Not Color-Only

Active sort state must not be communicated only through color.

Use:

* direction indicator;
* `aria-sort`.

---

# Unit Tests

## 50. Sorting Helper Tests

Add focused unit tests for the pure sorting helper.

Do not rely only on Playwright for comparator semantics.

---

## 51. String Ascending

Test a string column such as Symbol:

```text
SAP.DE
AAPL
GAW.L

-> ascending

AAPL
GAW.L
SAP.DE
```

---

## 52. String Descending

Verify reverse direction.

---

## 53. Case-Insensitive Strings

Use representative values differing by case and verify case-insensitive comparison semantics.

Do not require a particular secondary order for strings that compare equal except that stability must preserve original order.

---

## 54. Numeric Ascending

Test:

```text
100
2
10

->

2
10
100
```

---

## 55. Numeric Descending

Verify:

```text
100
10
2
```

---

## 56. Negative Numeric Values

Test Distance to Target with:

```text
0.1
-0.2
0
-0.05
```

and verify natural numeric order.

---

## 57. Missing Ascending

Verify missing optional values are last ascending.

---

## 58. Missing Descending

Verify missing optional values remain last descending.

This case is especially important.

---

## 59. Zero vs Missing

Verify:

```text
0
```

sorts as a real number and does not join the missing group.

---

## 60. Stable Equal Values

Verify equal sort values preserve original order.

---

## 61. Input Not Mutated

Explicitly verify the sorting helper does not mutate its input array.

---

## 62. No Sort

Verify an absent sort preserves input order.

---

# Playwright E2E

## 63. Permanent Spec

Create:

```text
tests/e2e/watchlist-sorting.spec.ts
```

for browser-level sorting behavior.

Do not create temporary external Playwright scripts for repeatable sorting behavior.

---

## 64. E2E Fixture

Use deterministic fixture data with deliberately unsorted values.

Include at least:

* different symbols;
* different company names;
* different market caps;
* different prices;
* different dividend yields;
* different currencies;
* Target Prices including missing;
* positive/negative/zero/missing distance where supported.

Do not depend on live Yahoo.

---

## 65. E2E: Initial Order

Verify the initial row order matches API/Watchlist order before any header is activated.

---

## 66. E2E: First Click Ascending

Click:

```text
Price
```

and verify numeric ascending order.

Verify the Price header exposes ascending state.

---

## 67. E2E: Second Click Descending

Click Price again.

Verify numeric descending order and descending state.

---

## 68. E2E: No Third Unsorted State

Click Price a third time.

Verify it returns to ascending rather than unsorted.

---

## 69. E2E: Switch Column

Start with Price descending.

Click Name.

Verify:

* Name becomes ascending;
* Price is no longer active;
* rows follow Name ascending.

---

## 70. E2E: Symbol Sorting

Verify Symbol sorting uses complete symbol strings and does not remove suffixes/punctuation.

---

## 71. E2E: Missing Values Last

Use Target Price or another optional field.

Verify missing values remain last in:

* ascending;
* descending.

---

## 72. E2E: Negative Distance

Verify Distance to Target sorts negative/zero/positive values numerically.

Do not assert based on formatted percentage text order.

---

## 73. E2E: Filtering + Sorting

Apply a company-name filter producing multiple rows.

Then sort.

Verify:

* only matching rows remain;
* matching rows are sorted;
* count remains `X of N stocks`.

---

## 74. E2E: Sort Preserved While Filter Changes

Activate sorting.

Change the filter.

Verify the current sort remains applied to the new filtered subset.

---

## 75. E2E: Clear Filter Preserves Sort

With sorting active and filtering active, clear the filter.

Verify all rows return in the currently selected sort order.

---

## 76. E2E: Sort Reset on Tab Switch

Activate sorting.

Switch Watchlist.

Verify the newly active Watchlist appears in its API order with no active sort indicator.

---

## 77. E2E: Sort Reset on Create

Activate sorting.

Create a new Watchlist.

Verify sort state resets.

---

## 78. E2E: Sort Reset on Delete Transition

Activate sorting.

Delete the active Watchlist and transition to another.

Verify sort state resets.

---

## 79. E2E: Sort Preserved on Target Price Update

Sort by Target Price.

Change one Target Price.

Return server data causing that row's relative position to change.

Verify:

* sort remains active;
* row moves to its correct new position.

---

## 80. E2E: Sort Preserved on Stock Add

With sorting active, add a stock.

Return the updated composed Watchlist.

Verify the new row appears in its correct sorted position rather than necessarily at the end.

---

## 81. E2E: Sort Preserved on Stock Remove

With sorting active, remove a stock.

Verify remaining rows remain sorted.

---

## 82. E2E: No API Request on Sorting

After initial loading settles, click sortable headers.

Verify no application:

```text
/api/
```

request is caused by sorting itself.

This is an important architectural property.

---

## 83. E2E: Delete Not Sortable

Verify the Delete header has no sort button and cannot activate sort state.

---

## 84. E2E: Mobile Sorting

Under mobile Chromium:

* horizontally scroll to a sortable column where necessary;
* activate sorting;
* verify row order changes;
* page-level horizontal overflow remains absent.

---

# Runtime Verification

## 85. Deterministic E2E Is Primary

Sorting is pure client-side behavior.

Permanent Playwright tests are the primary runtime verification.

No external provider is required.

---

## 86. Real Runtime Smoke Check

If practical, load an existing real Watchlist under the documented Cloudflare runtime and manually verify:

* clicking Price sorts rows;
* clicking again reverses direction;
* no network request is issued for sorting.

Do not mutate persisted data merely to test sorting.

This smoke check is optional if the environment is not configured.

Do not create a temporary external Playwright script for this repeatable behavior.

---

# Documentation

## 87. Architecture Documentation

Update `ARCHITECTURE.md` only where necessary to document sorting behavior.

Ensure it reflects:

* sorting is client-side;
* all eight stock-data columns are sortable;
* Delete is not sortable;
* first activation is ascending;
* repeated activation toggles ascending/descending;
* switching columns starts ascending;
* there is no third unsorted state after activation;
* initial state is unsorted;
* string sorting is case-insensitive and locale-aware;
* numeric fields sort numerically using raw values;
* missing values always sort last;
* sorting is stable;
* filtering occurs before sorting;
* counts are independent of sorting;
* sorting resets when active Watchlist changes;
* same-Watchlist mutations preserve sorting;
* sorting performs no API request;
* sorting is covered by permanent Playwright tests.

Do not rewrite unrelated sections.

---

## 88. README

Update README only if developer/test commands change.

Normally no README change is required.

---

## Non-Goals

Do NOT implement:

* server-side sorting;
* persisted sort state;
* multi-column sorting;
* third unsorted toggle state;
* drag-and-drop row ordering;
* filtering changes beyond integration with sorting;
* search highlighting;
* savings amount;
* total-savings input;
* investment-allocation UI;
* sticky table headers;
* column resizing;
* pagination;
* virtualization;
* mobile card layout;
* UI framework;
* CSS framework.

Do not modify backend APIs.

---

## Acceptance Criteria

The task is complete when all of the following are true:

1. Sort state is client/UI-local.
2. Initial table state is unsorted.
3. All eight stock-data columns are sortable.
4. Delete is not sortable.
5. First activation of a column sorts ascending.
6. Repeated activation toggles ascending/descending.
7. There is no third unsorted toggle state.
8. Switching to another column starts ascending.
9. Symbol sorts as a complete string.
10. Name sorts by company name.
11. Currency sorts by displayed application currency.
12. String sorting is case-insensitive.
13. String sorting is locale-aware.
14. Market Cap sorts numerically.
15. Price sorts numerically.
16. Dividend Yield sorts numerically by raw ratio.
17. Target Price sorts numerically.
18. Distance sorts numerically, including negative values.
19. Missing values sort last ascending.
20. Missing values sort last descending.
21. Zero remains a real sortable value.
22. Equal values preserve original order.
23. Sorting does not mutate `activeView.stocks`.
24. Sorting does not mutate `filteredStocks`.
25. Filtering occurs before sorting.
26. Counts remain unaffected by sorting.
27. Filter state is preserved when sorting changes.
28. Sort state is preserved when filter changes.
29. Clearing filter preserves sort state.
30. Sort resets on tab switch.
31. Sort resets after creating a new active Watchlist.
32. Sort resets after deleting/transitioning to another Watchlist.
33. Sort is preserved on same-Watchlist Target Price updates.
34. Sort is preserved on stock additions.
35. Sort is preserved on stock removals.
36. Rows reposition reactively when a sorted field changes.
37. Sortable headers use real interactive controls.
38. Active direction has a visible indicator.
39. Active header exposes correct `aria-sort`.
40. Header controls are keyboard accessible.
41. Delete header has no sorting interaction.
42. Existing Target Price editing remains functional.
43. Existing stock removal remains functional.
44. Existing horizontal table scrolling remains functional.
45. Mobile page-level overflow remains absent.
46. Pure sorting helper has unit coverage.
47. Unit tests cover string/numeric/missing/stability behavior.
48. Unit tests verify input arrays are not mutated.
49. Permanent `watchlist-sorting.spec.ts` exists.
50. E2E covers initial order.
51. E2E covers ascending/descending toggling.
52. E2E covers switching sort columns.
53. E2E covers symbol sorting.
54. E2E covers missing values last in both directions.
55. E2E covers negative-distance sorting.
56. E2E covers filtering + sorting.
57. E2E covers sort preservation while filter changes.
58. E2E covers clearing filter while sorted.
59. E2E covers sort reset on Watchlist changes.
60. E2E covers sort preservation through Target Price update.
61. E2E covers sort preservation through stock add/remove.
62. E2E confirms sorting causes no API request.
63. E2E confirms Delete is not sortable.
64. E2E covers mobile sorting.
65. Normal E2E remains independent of Cloudflare/Yahoo/Frankfurter.
66. Existing project checks pass.
67. `ARCHITECTURE.md` remains consistent with sorting behavior.
68. No investment-allocation UI is implemented.
69. No unnecessary production dependency is introduced.

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

Additionally:

1. verify initial API order remains before sorting;
2. verify ascending/descending behavior;
3. verify missing values remain last in both directions;
4. verify filter + sort composition;
5. verify sorting causes no application API request;
6. verify approximately 375px mobile behavior;
7. perform the optional real-runtime smoke check if practical.

Do not report a verification step as successful unless it was actually executed successfully.

Do not create temporary external Playwright scripts for repeatable sorting behavior already covered by the permanent E2E suite.

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
2. sort-state design;
3. sorting helper/API;
4. sortable-column mapping;
5. string comparison behavior;
6. numeric comparison behavior;
7. missing-value behavior;
8. stable-sort behavior;
9. filter/sort composition;
10. count behavior while sorting;
11. sort reset behavior on active-Watchlist changes;
12. sort preservation through same-Watchlist mutations;
13. header/button UI design;
14. `aria-sort` and accessibility behavior;
15. responsive/mobile behavior;
16. unit tests added;
17. Playwright scenarios added;
18. confirmation that sorting causes no API requests;
19. real-runtime smoke-check result, if performed;
20. changes made to `ARCHITECTURE.md`;
21. README changes, if any;
22. results of `test`, `test:e2e`, `check`, `lint`, and `build`;
23. confirmation that no investment-allocation UI was implemented;
24. confirmation that permanent E2E tests cover repeatable sorting behavior;
25. confirmation that this task's status was changed to `Done`;
26. assumptions or unresolved issues;
27. deviations from this task or `ARCHITECTURE.md`.

Do not proceed to investment-allocation UI.

Do not stage, commit, or push changes. Git operations are performed manually by the user.

---

## Supersession Note (TASK-032)

TASK-032 supersedes this task only regarding the reset/default state: an
active-Watchlist transition (initial load, tab switch, create, delete
replacement) now resets sorting to an active `Name ascending` state instead
of the "no sort" state described above. All other sorting semantics recorded
in this task (comparator, missing-value handling, stability, toggle
activation rules, filter/sort composition, same-Watchlist mutation
preservation) remain authoritative and unchanged.
