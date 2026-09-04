# TASK-022: Watchlist Filtering and Counts

## Status

Done

## Goal

Implement client-side filtering of the currently active Watchlist by company name and display stock counts below the table.

The filtering behavior follows the original Watchlist application:

```text
[ Filter by company name... ]
```

The filter:

* searches the company name;
* uses substring/contains matching;
* ignores case;
* reacts immediately to every input change;
* requires no submit button;
* performs no server request;
* affects only the rows displayed in the current Watchlist.

The table footer/count area must display:

* the total number of stocks in the active Watchlist;
* the number of stocks matching the current filter when filtering is active.

Conceptually:

```text
activeView.stocks
        |
        +---------------------> total count
        |
        v
company-name filter
        |
        v
visible stocks
        |
        +---------------------> filtered count
        |
        v
WatchlistTable
```

This task is pure client-side UI behavior.

Do not implement table sorting or investment-allocation UI.

---

## Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* this task completely

Relevant existing frontend functionality includes:

* application shell;
* Watchlist tabs;
* Watchlist management;
* stock management;
* inline Target Price editing;
* `WatchlistTable.svelte`;
* active composed Watchlist state;
* permanent Playwright E2E infrastructure.

The active composed Watchlist already contains the complete stock collection required for filtering.

No backend/API change is required.

---

# Filtering Semantics

## 1. Client-Side Only

Filtering MUST operate exclusively on:

```text
activeView.stocks
```

already loaded into the browser.

Do NOT:

* call the REST API when the filter changes;
* call Yahoo;
* reload the Watchlist;
* persist the filter.

Filtering is UI state.

---

## 2. Filter Field

Add a text input for filtering the active Watchlist.

Place it logically above the stock table, near the stock-management controls.

The exact responsive arrangement may follow the existing page layout.

The input must have an accessible name such as:

```text
Filter by company name
```

Do not rely solely on placeholder text for accessibility.

---

## 3. Immediate Filtering

The filter reacts immediately to each input change.

There is:

* no submit button;
* no Enter requirement;
* no explicit apply action.

Do not debounce the filter in this task.

The Watchlists are small and already loaded in memory.

---

## 4. Search Field

Filter only by:

```text
stock.name
```

Do NOT search:

* symbol;
* currency;
* Target Price;
* price;
* market cap;
* dividend;
* distance.

The original requirement is specifically company-name filtering.

---

## 5. Contains Matching

Use substring matching.

Conceptually:

```ts
stock.name.includes(filter)
```

after the required case normalization.

Do not implement:

* prefix-only matching;
* fuzzy search;
* tokenized search;
* regex input.

---

## 6. Case Insensitivity

Matching must ignore case.

Example:

```text
Company:
Games Workshop Group PLC

Filters that match:
games
GAMES
Workshop
shop
group plc
```

Use a straightforward case-normalized comparison.

Do not introduce locale-search libraries.

---

## 7. Filter Trimming

Leading/trailing whitespace in the filter should not affect matching.

For example:

```text
"  shop  "
```

must behave like:

```text
"shop"
```

The user's raw input may remain visible in the field; trimming applies to matching semantics.

---

## 8. Empty Filter

An empty or whitespace-only filter means:

```text
no filtering
```

All stocks must be visible.

Do not treat an empty filter as matching zero stocks.

---

## 9. Missing Company Name

A stock may have:

```text
name = undefined
```

because market data is unavailable.

When the filter is empty, that stock remains visible.

When a non-empty company-name filter is active, a stock without a company name does not match.

Do not:

* search its symbol instead;
* treat the visual `—` placeholder as a company name.

---

## 10. Preserve Stock Order

Filtering must preserve the current stock order.

Example:

```text
Original:
SAP.DE
AAPL
GAW.L

Filtered matches:
SAP.DE
GAW.L
```

must remain:

```text
SAP.DE
GAW.L
```

Do not sort as part of filtering.

---

# Client State

## 11. Filter State

Store the filter as UI-local Svelte state.

Conceptually:

```text
companyNameFilter
```

Do not:

* add it to server persistence;
* add it to Watchlist metadata;
* add it to URL/query parameters;
* introduce a global store.

---

## 12. Derived Visible Stocks

Derive the visible stock collection from:

```text
activeView.stocks
+
companyNameFilter
```

Use current Svelte 5 reactive/derived state conventions.

Do not mutate:

```text
activeView.stocks
```

to apply filtering.

The original composed Watchlist remains intact.

---

## 13. Filter and Target Price Updates

If a Target Price is edited while a filter is active:

* the filter remains active;
* the row remains visible if its company name still matches;
* the updated Target Price/distance appears normally.

Do not reset the filter because `activeView` changed.

---

## 14. Filter and Stock Removal

If a visible filtered stock is removed:

* update the active composed Watchlist through the existing mutation flow;
* recompute the filtered rows;
* update total and filtered counts.

Do not manually decrement counters separately from the stock collection.

Counts must be derived from state.

---

## 15. Filter and Stock Addition

If a stock is added while a filter is active:

* preserve the filter text;
* the newly returned stock appears only if its company name matches the current filter.

Do not clear the filter after adding a stock.

---

# Watchlist Changes

## 16. Tab Switching

When switching to another Watchlist, reset the company-name filter.

The filter belongs to the currently viewed Watchlist interaction, not to persistent application state.

After the new Watchlist loads:

```text
filter = ""
```

and all its stocks are visible.

---

## 17. Watchlist Creation

After creating a new Watchlist and making it active, reset the filter.

The new Watchlist begins with:

```text
stocks = []
filter = ""
```

---

## 18. Watchlist Deletion / Replacement

After deleting the active Watchlist and transitioning to the server-selected replacement Watchlist, reset the filter.

Do not carry a previous Watchlist's search term into the replacement Watchlist.

---

## 19. Initial Load

Initial application load starts with an empty filter.

Do not restore a previous filter from browser storage.

---

# Empty States

## 20. Empty Watchlist

If the active Watchlist itself contains:

```text
stocks = []
```

preserve the existing:

```text
This watchlist is empty.
```

state.

Do not show the table.

The filter input may be hidden or disabled when there are no stocks; choose the simplest clean interaction.

---

## 21. No Filter Matches

A different state occurs when:

```text
activeView.stocks.length > 0
```

but:

```text
filteredStocks.length === 0
```

because of the filter.

Display an explicit filtered-empty state such as:

```text
No stocks match the current filter.
```

Do NOT display:

```text
This watchlist is empty.
```

because the Watchlist itself is not empty.

---

## 22. Table on No Matches

When no stocks match the active filter, do not render an empty table header unless there is a clear usability reason.

Prefer the explicit filtered-empty state.

The count area should remain visible.

---

# Counts

## 23. Count Area

Add a small count/footer area associated with the active Watchlist table.

This replaces the original application's table-footer count behavior in a responsive-friendly form.

It does not have to use an actual HTML `<tfoot>` if placing the count immediately below the scrollable table provides cleaner responsive behavior.

Use semantic/simple markup.

---

## 24. Total Count

Always derive:

```text
totalCount = activeView.stocks.length
```

Do not maintain a separate mutable counter.

---

## 25. Filtered Count

When a non-empty normalized filter is active, derive:

```text
filteredCount = filteredStocks.length
```

Do not maintain a separate mutable counter.

---

## 26. Count Display Without Filter

When no filter is active, display the total count clearly.

A suitable representation is:

```text
3 stocks
```

For one stock:

```text
1 stock
```

Use correct singular/plural English wording.

Do not display redundant:

```text
3 of 3 stocks
```

when no filter is active.

---

## 27. Count Display With Filter

When a non-empty filter is active, display both filtered and total counts.

A suitable representation is:

```text
1 of 3 stocks
```

For example:

```text
Filter: shop

Visible:
GAW.L

Count:
1 of 3 stocks
```

This corresponds to the original requirement that the footer shows both total and filtered counts.

---

## 28. Zero Matches Count

For an active filter with no matches:

```text
0 of 3 stocks
```

must be displayed.

Do not hide the count merely because no rows match.

---

## 29. Missing-Name Rows and Counts

Given:

```text
AAPL       name = Apple Inc.
UNKNOWN    name = undefined
```

without a filter:

```text
2 stocks
```

With:

```text
filter = apple
```

display:

```text
1 of 2 stocks
```

The missing-name row remains part of the total count.

---

# Component Boundaries

## 30. WatchlistTable Input

Pass the derived:

```text
filteredStocks
```

to `WatchlistTable`.

The table component should not own the company-name filtering rule.

It remains responsible for rendering the stock collection it receives.

---

## 31. Filter Component

A separate small component for the filter/count UI is optional.

Do not split components merely for file-count aesthetics.

A component is appropriate only if it represents a meaningful UI responsibility and keeps `+page.svelte` readable.

---

## 32. No API Changes

Do not extend `watchlistApi.ts` for filtering.

Filtering needs no HTTP operation.

Do not add:

```text
GET /api/watchlists/{id}?filter=...
```

or similar server filtering.

---

# Responsive Design

## 33. Desktop Layout

At desktop-like width, place the filter logically with the stock controls/table.

The exact layout may use:

* a shared controls row;
* separate compact rows.

Keep it visually understandable.

Do not over-design the toolbar.

---

## 34. Mobile Layout

At approximately:

```text
375px
```

verify:

* filter input remains usable;
* filter input does not force page-level horizontal overflow;
* stock-add controls remain usable;
* table continues to scroll within its own container;
* count text remains readable.

Controls may wrap or stack.

---

# Accessibility

## 35. Filter Accessibility

The filter input must have an accessible name:

```text
Filter by company name
```

Use a real `<input>`.

Maintain visible keyboard focus.

---

## 36. Dynamic Result Count

The count must be readable as ordinary page content.

An `aria-live` region is optional and not required unless it improves the interaction without creating excessive announcements on every keystroke.

Do not introduce noisy accessibility behavior merely because the count changes.

---

## 37. Filtered Empty State Accessibility

The:

```text
No stocks match the current filter.
```

message must be normal readable content.

Do not communicate the empty result only through visual table disappearance.

---

# Unit Tests

## 38. Filtering Helper

If filtering logic is extracted into a client-safe pure helper, unit-test it directly.

A conceptual helper could be:

```ts
filterStocksByCompanyName(stocks, filter)
```

Extraction is preferred if it keeps filtering semantics independently testable.

Do not introduce a general search framework.

---

## 39. Required Filter Unit Cases

At minimum cover:

### Contains

```text
Games Workshop Group PLC
filter = shop
-> match
```

### Case Insensitive

```text
Apple Inc.
filter = APPLE
-> match
```

### Surrounding Whitespace

```text
SAP SE
filter = "  sap  "
-> match
```

### Empty Filter

All stocks remain.

### Whitespace-Only Filter

All stocks remain.

### Missing Name

Missing-name stock:

* visible without filter;
* excluded with non-empty filter.

### Order

Matching stocks preserve input order.

---

## 40. Count Unit Cases

If count-display logic is extracted, test:

```text
1 stock
3 stocks
1 of 3 stocks
0 of 3 stocks
```

Do not create a complex pluralization abstraction.

---

# Playwright E2E

## 41. Permanent Spec

Create:

```text
tests/e2e/watchlist-filtering.spec.ts
```

for the browser behavior introduced by this task.

Do not create temporary external Playwright scripts for repeatable filtering behavior.

---

## 42. E2E Fixture

Use deterministic stock fixtures including at least:

```text
AAPL
SAP.DE
GAW.L
UNKNOWN
```

with company names conceptually:

```text
AAPL    -> Apple Inc.
SAP.DE  -> SAP SE
GAW.L   -> Games Workshop Group PLC
UNKNOWN -> missing
```

Do not rely on live Yahoo.

---

## 43. E2E: Initial Count

With four fixture stocks and no filter, verify:

```text
4 stocks
```

and all four rows are visible.

---

## 44. E2E: Immediate Contains Filter

Enter:

```text
shop
```

into the filter.

Without pressing Enter or a button, verify:

* GAW.L remains visible;
* non-matching named rows disappear;
* missing-name row disappears;
* count becomes:

```text
1 of 4 stocks
```

---

## 45. E2E: Case Insensitive

Enter:

```text
APPLE
```

and verify AAPL matches.

---

## 46. E2E: Partial Contains

Enter a substring that is not the beginning of the company name.

For example:

```text
work
```

or:

```text
shop
```

for Games Workshop.

Verify it matches.

This protects the `contains`, not `startsWith`, requirement.

---

## 47. E2E: Clear Filter

After filtering, clear the input.

Verify:

* all rows return;
* count returns to:

```text
4 stocks
```

without requiring Enter.

---

## 48. E2E: No Matches

Enter a non-matching filter.

Verify:

* table rows are not shown;
* explicit:

```text
No stocks match the current filter.
```

appears;

* count displays:

```text
0 of 4 stocks
```

Do not display the empty-Watchlist message.

---

## 49. E2E: Missing Name

With no filter, verify the `UNKNOWN` row is visible.

With a non-empty filter, verify it does not match merely because its symbol or `—` placeholder happens to contain text.

---

## 50. E2E: Filter Reset on Tab Switch

Apply a filter on Watchlist A.

Switch to Watchlist B.

Verify:

* filter input is reset;
* all stocks from Watchlist B are visible;
* count reflects the complete Watchlist B.

---

## 51. E2E: Filter Reset on Create

Apply a filter, then create a new Watchlist.

Verify the newly active Watchlist starts with an empty filter.

---

## 52. E2E: Filter Reset on Delete Transition

Apply a filter to the active Watchlist.

Delete that Watchlist and let the server response select another Watchlist.

Verify the replacement Watchlist starts with an empty filter.

---

## 53. E2E: Filter Preserved on Target Price Update

Apply a filter matching one stock.

Edit that stock's Target Price successfully.

Verify:

* filter text remains;
* row remains filtered/visible;
* Target Price/distance update is visible.

Do not reset filtering for a same-Watchlist data mutation.

---

## 54. E2E: Filter Preserved on Stock Add

Apply a filter.

Add a stock.

Verify:

* filter remains;
* newly returned stock appears only if it matches the current company-name filter;
* counts update from the returned `activeView`.

Use deterministic intercepted API data.

---

## 55. E2E: Filtered Stock Removal

Apply a filter producing one visible row.

Remove that stock.

Verify:

* filter remains;
* result becomes the filtered-empty state if other non-matching stocks remain;
* total count reflects remaining Watchlist stocks;
* filtered count becomes zero.

---

## 56. E2E: Mobile Filtering

Under mobile Chromium:

* filter input is reachable;
* typing filters immediately;
* count remains readable;
* page-level horizontal overflow remains absent;
* table remains independently horizontally scrollable when rows are visible.

---

# Runtime Verification

## 57. Deterministic Verification Is Primary

Because filtering is pure client-side behavior, the permanent Playwright tests are the primary browser verification.

A real Yahoo/KV integration test adds little value to the filtering algorithm itself.

---

## 58. Real Runtime Smoke Test

Perform a small real-runtime smoke check under the documented Cloudflare runtime if practical:

1. load an existing Watchlist with multiple named stocks;
2. enter a company-name substring;
3. verify visible rows and count change without a network request.

Do not modify persisted data merely to test filtering.

Do not create temporary external Playwright scripts for this repeatable behavior.

Manual browser verification is sufficient for this integration smoke check.

---

## 59. No Network on Filter Input

During deterministic E2E and/or runtime verification, confirm that changing the filter does not cause:

```text
/api/
```

requests.

This is an important architectural property.

Use request counting in E2E where practical.

Do not attempt to block unrelated browser resource requests.

---

# Documentation

## 60. Architecture Documentation

Update `ARCHITECTURE.md` only where necessary to clarify filtering/count behavior.

Ensure it reflects:

* company-name filtering is client-side;
* matching uses case-insensitive substring/contains semantics;
* filtering reacts immediately to input;
* no API request is made for filtering;
* missing-name stocks remain visible without filter but cannot match a non-empty company-name filter;
* filtering preserves stock order;
* filter resets when the active Watchlist changes;
* same-Watchlist mutations preserve the current filter;
* total count comes from the complete active Watchlist;
* filtered count comes from visible filtered rows;
* count display distinguishes filtered and unfiltered state;
* filtering is covered by permanent Playwright tests.

Do not rewrite unrelated sections.

---

## 61. README

Update README only if developer/test commands change.

Normally no README change is required.

---

## Non-Goals

Do NOT implement:

* table sorting;
* clickable table headers;
* sort direction indicators;
* server-side filtering;
* symbol filtering;
* fuzzy search;
* search highlighting;
* filter persistence;
* URL query-state persistence;
* Target Price changes beyond compatibility with existing editing;
* stock-management changes beyond compatibility with filtering;
* savings amount;
* total-savings input;
* investment-allocation UI;
* pagination;
* virtualization;
* mobile card layout;
* UI framework;
* CSS framework.

Do not modify backend APIs.

---

## Acceptance Criteria

The task is complete when all of the following are true:

1. A company-name filter input exists for a non-empty active Watchlist.
2. The input has an accessible name.
3. Filtering occurs immediately on input changes.
4. No submit button is required.
5. Filtering performs no API request.
6. Filtering searches only company name.
7. Matching uses substring/contains semantics.
8. Matching is case-insensitive.
9. Surrounding filter whitespace does not affect matching.
10. Empty/whitespace-only filter shows all stocks.
11. Missing-name stocks remain visible without filtering.
12. Missing-name stocks do not match a non-empty filter.
13. Filtering preserves stock order.
14. `activeView.stocks` is not mutated to apply filtering.
15. Visible stocks are derived from active Watchlist state.
16. Filter is UI-local and not persisted.
17. Filter resets on tab switch.
18. Filter resets after creating a new active Watchlist.
19. Filter resets after deleting/transitioning to another Watchlist.
20. Same-Watchlist Target Price updates preserve the filter.
21. Same-Watchlist stock additions preserve the filter.
22. Same-Watchlist stock removals preserve the filter.
23. Empty Watchlist state remains distinct from no-filter-match state.
24. No-match state displays an explicit message.
25. Total count is derived from all active Watchlist stocks.
26. Unfiltered state displays total count.
27. Singular `1 stock` is handled correctly.
28. Filtered state displays filtered and total count.
29. Zero-match state displays `0 of N stocks`.
30. Missing-name stocks remain part of total count.
31. `WatchlistTable` receives filtered rows rather than owning filter semantics.
32. No backend/API change is introduced.
33. Filter controls are responsive.
34. Mobile layout has no page-level horizontal overflow.
35. Filter accessibility basics are satisfied.
36. Filtering semantics have unit coverage.
37. Permanent `watchlist-filtering.spec.ts` exists.
38. E2E covers initial count.
39. E2E covers immediate contains filtering.
40. E2E covers case insensitivity.
41. E2E covers partial substring matching.
42. E2E covers clearing the filter.
43. E2E covers no matches.
44. E2E covers missing-name behavior.
45. E2E covers reset on tab switch.
46. E2E covers reset on create.
47. E2E covers reset on delete transition.
48. E2E covers preservation through Target Price mutation.
49. E2E covers preservation through stock addition.
50. E2E covers filtered stock removal/count update.
51. E2E covers mobile filtering.
52. E2E confirms filter input causes no application API request.
53. Normal E2E remains independent of Cloudflare/Yahoo/Frankfurter.
54. Focused runtime filtering is verified where practical.
55. Existing project checks pass.
56. `ARCHITECTURE.md` remains consistent with filtering/count behavior.
57. No sorting or investment-allocation UI is implemented.
58. No unnecessary production dependency is introduced.

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

1. verify filtering with deterministic Playwright data;
2. verify no-match and count behavior;
3. verify approximately 375px mobile behavior;
4. verify filter input causes no application API requests;
5. perform the focused real-runtime filtering smoke check if practical.

Do not report a verification step as successful unless it was actually executed successfully.

Do not create temporary external Playwright scripts for repeatable filtering behavior already covered by the permanent E2E suite.

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
2. filter UI/component structure;
3. filter state design;
4. filtering helper/algorithm;
5. case-insensitive contains behavior;
6. missing-name behavior;
7. filtered-stock derivation;
8. filter reset behavior on active-Watchlist changes;
9. filter preservation behavior for same-Watchlist mutations;
10. empty-Watchlist vs. no-match behavior;
11. count UI and singular/plural behavior;
12. total/filtered count derivation;
13. responsive/mobile behavior;
14. accessibility behavior;
15. unit tests added;
16. Playwright scenarios added;
17. confirmation that filter input causes no application API requests;
18. real-runtime smoke-check result, if performed;
19. changes made to `ARCHITECTURE.md`;
20. README changes, if any;
21. results of `test`, `test:e2e`, `check`, `lint`, and `build`;
22. confirmation that no sorting/investment-allocation UI was implemented;
23. confirmation that permanent E2E tests cover repeatable filtering behavior;
24. confirmation that this task's status was changed to `Done`;
25. assumptions or unresolved issues;
26. deviations from this task or `ARCHITECTURE.md`.

Do not proceed to table sorting or investment-allocation UI.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
