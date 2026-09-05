# TASK-024: Investment Allocation UI

## Status

Done

## Goal

Implement the user interface for explicitly calculating and displaying the temporary investment allocation for the currently active Watchlist.

The user enters the available investment amount in whole Euros and explicitly starts the calculation.

Conceptually:

```text
[ Total savings: 1000 ] [ Calculate ]    Invested: 997
```

The client sends only:

```text
watchlistId
totalSavings
```

through the existing REST endpoint:

```http
POST /api/watchlists/{watchlistId}/investment-allocation
```

The server returns:

```json
{
  "totalSavings": 1000,
  "invested": 997,
  "allocations": [
    {
      "symbol": "AAPL",
      "factor": 0.8,
      "savingsAmount": 320
    }
  ]
}
```

The UI then displays each returned `savingsAmount` in a new table column associated with the corresponding stock symbol.

The client MUST NOT calculate:

* investment factors;
* factor sums;
* savings allocation;
* invested total.

All investment-allocation business logic remains server-side.

Allocation results are temporary and are never persisted.

---

## Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* this task completely

Relevant existing functionality includes:

* `WatchlistTable.svelte`;
* active Watchlist state;
* company-name filtering;
* table sorting;
* Target Price editing;
* stock add/remove;
* client REST API boundary;
* permanent Playwright infrastructure;
* Investment Allocation application service from TASK-014;
* Investment Allocation REST endpoint from TASK-015.

Relevant endpoint:

```http
POST /api/watchlists/{watchlistId}/investment-allocation
```

Request:

```json
{
  "totalSavings": 1000
}
```

Response:

```json
{
  "totalSavings": 1000,
  "invested": 997,
  "allocations": [
    {
      "symbol": "AAPL",
      "factor": 0.8,
      "savingsAmount": 320
    }
  ]
}
```

Do not modify the server-side allocation formula.

---

# Allocation Controls

## 1. Total Savings Input

Add an input for the total amount available for investment.

Use an accessible name such as:

```text
Total savings
```

The value represents:

```text
whole Euros
```

Do not append or encode a currency in the API request.

---

## 2. Input Type

Use an input appropriate for non-negative whole-Euro amounts.

A numeric input is acceptable because this field intentionally accepts only integers.

Conceptually:

```html
<input type="number" min="0" step="1">
```

or an equivalent implementation.

Do not support decimal savings amounts.

---

## 3. Valid Values

Valid values include:

```text
0
1
500
1000
25000
```

Invalid values include:

```text
-1
12.5
abc
```

The server remains authoritative, but obvious invalid client input should not generate an API request.

---

## 4. No Locale Decimal Parsing Required

Unlike Target Price editing, Total Savings accepts only whole Euros.

There is no need to support:

```text
1000,50
```

or:

```text
1000.50
```

Do not introduce unnecessary locale-decimal parsing.

---

## 5. Calculate Button

Add an explicit calculation button.

A visible text or calculator-style control is acceptable.

It must have an accessible name such as:

```text
Calculate investment allocation
```

Use a real `<button>`.

---

## 6. Explicit Calculation Only

Allocation is calculated only when the user explicitly activates the Calculate button.

Do NOT calculate automatically:

* while typing;
* when the Watchlist loads;
* when the filter changes;
* when sorting changes;
* when Target Price changes;
* when a stock is added;
* when a stock is removed.

This preserves the established application behavior.

---

## 7. Enter Submission

If the controls are implemented as a form, pressing Enter in the Total Savings input may trigger calculation.

Ensure button activation and Enter submission share one request path and cannot produce duplicate POST requests.

---

# Client API

## 8. Client API Extension

Extend the existing client API boundary with an operation conceptually equivalent to:

```ts
calculateInvestmentAllocation(
  watchlistId: string,
  totalSavings: number
): Promise<InvestmentAllocationResponse>
```

Do not call `fetch()` directly from Svelte components.

---

## 9. Request

Send:

```http
POST /api/watchlists/{watchlistId}/investment-allocation
Content-Type: application/json
```

with:

```json
{
  "totalSavings": 1000
}
```

Do not send:

* user ID;
* symbols;
* filtered stocks;
* sorted stocks;
* Target Prices;
* distances;
* factors.

This is important.

The server determines the complete Watchlist allocation scope.

---

## 10. Full Watchlist Scope

The allocation must always use all stocks in the active Watchlist.

The current client filter and sort state affect only presentation.

For example:

```text
Watchlist:
AAPL
SAP.DE
GAW.L

Filter:
"Apple"

Visible:
AAPL
```

The request remains:

```json
{
  "totalSavings": 1000
}
```

It MUST NOT send:

```text
AAPL only
```

The server allocates across:

```text
AAPL
SAP.DE
GAW.L
```

---

# Response Types

## 11. Client Allocation Types

Introduce client-safe API types matching the existing response.

Conceptually:

```ts
interface StockAllocationResponse {
  symbol: string;
  factor: number;
  savingsAmount: number;
}

interface InvestmentAllocationResponse {
  totalSavings: number;
  invested: number;
  allocations: StockAllocationResponse[];
}
```

Do not import server-only types.

---

## 12. Allocation State

Store the most recent successful allocation as UI-local state.

Conceptually:

```text
investmentAllocation
```

This state is:

* temporary;
* associated with the currently active Watchlist state;
* not persisted.

Do not introduce a global store.

---

# Savings Amount Column

## 13. Add Savings Amount Column

Add:

```text
Savings Amount
```

to the stock table.

The final table columns become:

```text
Symbol
Name
Cap (USD)
Price
Div
Currency
Target Price
Distance to Target
Savings Amount
Delete
```

Do not change the order of the existing columns.

---

## 14. Before Calculation

Before any successful allocation has been calculated for the active Watchlist, display:

```text
—
```

in each Savings Amount cell.

Do not display:

```text
0
```

because no allocation has been calculated yet.

This distinction is important.

---

## 15. After Calculation

After a successful calculation, associate each allocation with the stock row using:

```text
symbol
```

and display:

```text
savingsAmount
```

for that stock.

Do not associate results positionally in the client.

The server/application response already contains symbols.

---

## 16. Whole-Euro Display

Savings Amount is a whole-Euro value.

Display it as an integer using locale-aware formatting.

A visible Euro unit is appropriate because this value represents allocation of the user's Euro budget.

A suitable display is:

```text
320 €
```

or locale-equivalent formatting.

Use browser-native number/currency formatting where practical.

Do not convert it into the stock's trading currency.

---

## 17. Zero Allocation

A calculated:

```text
savingsAmount = 0
```

is a real calculated value.

Display:

```text
0 €
```

or locale equivalent.

Do not display `—` for a calculated zero.

---

## 18. Missing Allocation Entry

The server should return one allocation entry per Watchlist stock.

However, if an allocation response unexpectedly lacks the currently displayed symbol, display:

```text
—
```

rather than inventing `0`.

Do not crash the table.

---

# Invested Display

## 19. Invested Amount

Display the returned:

```text
invested
```

near the Total Savings controls.

Conceptually:

```text
Invested: 997 €
```

This value is server-calculated.

Do not sum visible Savings Amount cells in the browser.

---

## 20. Before Calculation

Before any successful allocation exists, do not display a misleading:

```text
Invested: 0 €
```

unless the user has explicitly calculated a zero allocation.

Prefer hiding the Invested value or displaying a neutral placeholder before calculation.

---

## 21. Calculated Zero

If the user explicitly calculates:

```text
totalSavings = 0
```

then:

```text
invested = 0
```

is a legitimate calculated result.

Display:

```text
Invested: 0 €
```

This must remain distinguishable from "not calculated yet".

---

## 22. Rounding Difference

The server may return:

```text
totalSavings = 100
invested = 99
```

because individual allocations are rounded down.

Display the returned value exactly.

Do not:

* redistribute the remaining Euro;
* change invested to equal totalSavings;
* display a client warning merely because invested is lower.

This is expected business behavior.

---

# Filter + Sort Integration

## 23. Filtering Does Not Affect Allocation

Filtering changes only which stock rows are visible.

It MUST NOT alter:

* the request;
* the allocation result;
* invested total.

If a stock is hidden by the company-name filter, its allocation remains part of:

```text
invested
```

and remains stored in the temporary allocation state.

---

## 24. Hidden Allocation

When a filter hides a stock:

* do not delete its allocation from client state;
* do not recalculate invested.

If the filter is cleared, the row must reappear with its previously calculated Savings Amount.

---

## 25. Sorting Does Not Affect Allocation

Sorting affects only row order.

It must not:

* trigger recalculation;
* alter savings amounts;
* alter invested total.

Savings Amount follows the stock symbol as rows move.

---

## 26. Savings Amount Sorting

Do NOT make the new:

```text
Savings Amount
```

column sortable in this task.

TASK-023 defined exactly eight sortable stock-data columns.

The new allocation column is a transient calculated UI result and remains display-only.

Do not expand sorting scope unless explicitly requested later.

---

## 27. Delete Column

The Delete column remains non-sortable.

---

# Allocation Invalidation

## 28. Why Invalidation Is Required

A calculated allocation is based on the current Watchlist composition and current Target Price distances.

If relevant business inputs change afterward, the previous allocation becomes stale.

The UI must not continue displaying stale Savings Amount values as if they were current.

---

## 29. Invalidate on Target Price Change

After a Target Price is successfully changed:

```text
investmentAllocation = undefined
```

or equivalent.

Savings Amount cells return to:

```text
—
```

and Invested returns to the pre-calculation state.

Do not automatically recalculate.

---

## 30. Invalidate on Stock Addition

After a stock is successfully added:

* invalidate the current allocation;
* do not automatically recalculate.

The new stock changes the allocation population/factor sum.

---

## 31. Invalidate on Stock Removal

After a stock is successfully removed:

* invalidate the current allocation;
* do not automatically recalculate.

---

## 32. Invalidate on Active Watchlist Change

Reset allocation when:

* switching tabs;
* creating a new active Watchlist;
* deleting the active Watchlist and transitioning to another.

Do not carry allocation data between Watchlists.

---

## 33. Initial Load

Initial application load starts with:

```text
no investment allocation
```

even if the Watchlist has been used before.

Allocation is never persisted.

---

## 34. Filter Does Not Invalidate

Changing or clearing the company-name filter does NOT invalidate allocation.

Filtering is presentation-only.

---

## 35. Sorting Does Not Invalidate

Changing sort column or direction does NOT invalidate allocation.

Sorting is presentation-only.

---

## 36. Failed Target Price Change

If Target Price mutation fails, do NOT invalidate an existing allocation because the business state did not change.

---

## 37. Failed Stock Add/Remove

If stock addition/removal fails, do NOT invalidate an existing allocation.

Only successful business-state mutations invalidate it.

---

## 38. Target Price Partial Success

If Target Price persistence succeeds but market-data refresh fails, the Target Price itself changed.

Therefore invalidate the allocation.

Do not preserve it merely because distance refresh was unavailable.

---

# Total Savings Input After Calculation

## 39. Input Editing Does Not Immediately Invalidate

After a successful allocation, the user may edit the Total Savings input.

Do not immediately erase the existing calculated result merely because the text field changed.

The displayed allocation represents the last successful calculation.

A new result replaces it only after Calculate succeeds.

---

## 40. Last Calculated Amount

The returned:

```text
investmentAllocation.totalSavings
```

is authoritative for the currently displayed allocation.

The editable input may temporarily contain another value before the next calculation.

Do not relabel the old allocation as if it were based on the newly typed unsaved amount.

---

## 41. Invested Context

Where useful for clarity, keep the UI arrangement such that the displayed Invested amount is visually associated with the last successful calculation.

Do not over-design this distinction.

---

# Errors

## 42. Local Input Error

For invalid local Total Savings input:

* do not call the API;
* show understandable validation feedback;
* preserve the last successful allocation if one exists.

Do not clear a valid previous allocation merely because the next input attempt is invalid.

---

## 43. Server Validation Error

If the server returns:

```text
INVALID_TOTAL_SAVINGS
```

or the existing equivalent:

* show the stable API message;
* preserve the previous successful allocation;
* do not display a partial new result.

---

## 44. Watchlist Not Found

If the server returns:

```text
WATCHLIST_NOT_FOUND
```

show the stable API error.

Do not fabricate an empty allocation.

The existing client Watchlist state may remain visible unless another established shell rule dictates otherwise.

---

## 45. Market Data Failure

If allocation fails with:

```text
MARKET_DATA_UNAVAILABLE
```

show the stable API error.

Preserve the previous successful allocation if one exists because the new calculation did not succeed.

Do not replace it with zero values.

---

## 46. FX Failure

FX failure does not prevent allocation according to the existing server architecture.

The client does not need special FX handling in this workflow.

Use the successful allocation response normally.

---

# Busy / Race Safety

## 47. Calculation Busy State

While allocation calculation is in progress:

* prevent duplicate calculation requests;
* disable Calculate appropriately;
* expose a lightweight busy state.

---

## 48. Conflicting Mutations

Prevent stale allocation responses from being applied after the Watchlist business state changed.

While calculation is in progress, it is acceptable to temporarily disable:

* tab switching;
* Watchlist create/delete;
* stock add/remove;
* Target Price editing.

Reuse the serialized mutation/busy strategy already established in the page.

Prefer simple correctness over concurrent request reconciliation.

---

## 49. Filtering/Sorting While Calculating

Filtering and sorting are presentation-only.

They may remain available during calculation if this does not complicate state handling.

It is also acceptable to disable them briefly if the existing global busy strategy naturally does so.

Do not introduce complex concurrency solely for this distinction.

---

# Component Boundaries

## 50. Page State Ownership

The page/client UI orchestration owns the current:

```text
investmentAllocation
```

state.

Do not make `WatchlistTable` own the complete allocation lifecycle.

---

## 51. WatchlistTable Input

Pass enough allocation information to `WatchlistTable` to display Savings Amount by symbol.

A suitable approach is:

```text
allocationBySymbol
```

or the current `InvestmentAllocationResponse`.

Prefer a lookup-friendly representation if it keeps table rendering simple.

Do not perform server/business allocation calculations in the table.

---

## 52. No Positional Client Association

Do not rely on row index to match:

```text
stock
allocation
```

because filtering and sorting change displayed row positions.

Association MUST use:

```text
symbol
```

This is a critical requirement.

---

## 53. Client Orchestration

Extend the existing client orchestration layer or add a focused investment-allocation helper.

Conceptually:

```text
calculateInvestmentAllocationForActiveWatchlist(...)
```

should:

1. call the client API;
2. return/store the server allocation result;
3. not mutate Watchlist stock data.

Keep `+page.svelte` primarily responsible for Svelte state/event wiring.

---

# Responsive Design

## 54. Controls Layout

The Total Savings input, Calculate button, and Invested display must work on desktop and narrow/mobile layouts.

They may:

* share a row on desktop;
* wrap/stack on mobile.

Do not use fixed wide layouts.

---

## 55. Savings Column on Mobile

Savings Amount remains part of the horizontally scrollable table.

Do not hide it on mobile.

Do not create a separate mobile allocation card.

---

## 56. Mobile Verification

At approximately:

```text
375px
```

verify:

* Total Savings input is usable;
* Calculate button is reachable;
* Invested value is readable;
* Savings Amount column is reachable through table scrolling;
* Delete remains reachable;
* page-level horizontal overflow remains absent.

---

# Accessibility

## 57. Input Accessibility

Total Savings input must have an accessible label/name.

---

## 58. Calculate Accessibility

Calculate control must be a real button with an understandable accessible name.

---

## 59. Validation Feedback

Local/server validation feedback must be associated clearly with the savings controls.

Use:

```text
aria-invalid
aria-describedby
```

where appropriate.

Do not rely only on color.

---

## 60. Busy Accessibility

Use native disabled state and/or:

```text
aria-busy
```

where appropriate.

---

# Client API Tests

## 61. API Unit Tests

Extend:

```text
watchlistApi.spec.ts
```

for investment allocation.

At minimum verify:

* POST endpoint;
* Watchlist ID URL handling;
* numeric JSON body;
* response parsing;
* stable API error parsing.

Verify the request contains only:

```text
totalSavings
```

as the business payload.

---

# Input Unit Tests

## 62. Savings Input Parsing/Validation

If input parsing is extracted into a helper, unit-test it.

At minimum cover:

```text
"0"    -> 0
"1"    -> 1
"1000" -> 1000
```

Reject:

```text
""
" "
"-1"
"12.5"
"abc"
```

Do not introduce decimal-locale complexity.

---

# Orchestration Unit Tests

## 63. Successful Calculation

Verify a successful API result becomes the current allocation state without modifying:

```text
activeView.stocks
```

---

## 64. Symbol Association

Verify allocation values are associated by symbol rather than row index.

Use a scenario where displayed/sorted stock order differs from allocation response order.

---

## 65. Calculation Failure

Verify failed calculation does not replace an existing successful allocation.

---

## 66. Invalidate on Target Price Success

Verify successful Target Price mutation invalidates allocation.

---

## 67. Invalidate on Target Price Failure

Verify failed Target Price mutation preserves allocation.

---

## 68. Invalidate on Stock Add Success

Verify successful stock addition invalidates allocation.

---

## 69. Invalidate on Stock Remove Success

Verify successful stock removal invalidates allocation.

---

## 70. Failed Stock Mutation

Verify failed add/remove preserves allocation.

---

## 71. Watchlist Transition

Verify tab/create/delete transition clears allocation.

---

## 72. Filter/Sort Preservation

Verify filter/sort changes do not invalidate allocation.

Do not duplicate every browser scenario at unit level; focus on state semantics.

---

# Playwright E2E

## 73. Permanent Spec

Create:

```text
tests/e2e/investment-allocation.spec.ts
```

for the repeatable browser behavior introduced by this task.

Do not create temporary external Playwright scripts for deterministic allocation workflows.

---

## 74. Deterministic Allocation Fixture

Mock the allocation endpoint with a deliberately useful response.

For example:

```json
{
  "totalSavings": 1000,
  "invested": 997,
  "allocations": [
    {
      "symbol": "SAP.DE",
      "factor": 1.2,
      "savingsAmount": 427
    },
    {
      "symbol": "AAPL",
      "factor": 0.8,
      "savingsAmount": 320
    },
    {
      "symbol": "GAW.L",
      "factor": 0.6,
      "savingsAmount": 250
    }
  ]
}
```

The allocation order may deliberately differ from displayed table order to prove symbol-based association.

---

## 75. E2E: Before Calculation

Verify:

* Savings Amount column exists;
* rows display `—` in Savings Amount;
* no misleading Invested value is shown.

---

## 76. E2E: Successful Calculation

Enter:

```text
1000
```

and calculate.

Verify:

* exactly one POST occurs;
* request contains `{ totalSavings: 1000 }`;
* no symbols/filter/sort data are sent;
* returned Savings Amounts appear on the correct rows by symbol;
* Invested displays the returned `997`.

---

## 77. E2E: Enter Calculation

Press Enter in the Total Savings input.

Verify exactly one POST occurs.

---

## 78. E2E: Zero Savings

Enter:

```text
0
```

and return an allocation with zero values.

Verify:

* request succeeds;
* Savings Amount cells display calculated zero;
* Invested displays zero;
* zero is not confused with the pre-calculation placeholder.

---

## 79. E2E: Invalid Input

Enter a negative/fractional/invalid value.

Verify:

* no POST occurs for locally invalid input;
* validation feedback appears;
* previous successful allocation remains if one existed.

---

## 80. E2E: Server Error

Return:

```text
INVALID_TOTAL_SAVINGS
```

or another allocation API failure.

Verify:

* error is shown;
* previous allocation remains unchanged.

---

## 81. E2E: Market Data Failure

Return:

```text
MARKET_DATA_UNAVAILABLE
```

Verify:

* error is shown;
* previous successful allocation remains.

---

## 82. E2E: Filter Does Not Affect Scope

Apply a filter so only one row is visible.

Calculate.

Verify the POST still contains only:

```json
{
  "totalSavings": 1000
}
```

Return allocations for all Watchlist symbols and an invested total based on all of them.

Verify the visible row shows its allocation and Invested reflects the complete response.

---

## 83. E2E: Clear Filter Restores Hidden Allocation

After calculating while a filter is active, clear the filter.

Verify previously hidden rows reappear with their already calculated Savings Amounts.

No new allocation POST occurs.

---

## 84. E2E: Sorting Preserves Allocation

Calculate allocation.

Sort the table.

Verify Savings Amount values remain attached to the correct symbols after row reordering.

No new allocation POST occurs.

---

## 85. E2E: Target Price Change Invalidates

Calculate allocation.

Successfully edit a Target Price.

Verify:

* Savings Amount cells return to `—`;
* Invested returns to pre-calculation state;
* no automatic allocation POST occurs.

---

## 86. E2E: Target Price Failure Preserves

Calculate allocation.

Attempt a Target Price change that fails.

Verify the previous Savings Amounts and Invested remain.

---

## 87. E2E: Target Price Partial Success Invalidates

Calculate allocation.

Return a successful Target Price persistence response with market-data warning/distance unavailable.

Verify allocation is invalidated because the Target Price changed.

No automatic recalculation occurs.

---

## 88. E2E: Stock Add Invalidates

Calculate allocation.

Successfully add a stock.

Verify allocation is cleared and no automatic allocation POST follows.

---

## 89. E2E: Stock Add Failure Preserves

Calculate allocation.

Fail stock addition.

Verify previous allocation remains.

---

## 90. E2E: Stock Remove Invalidates

Calculate allocation.

Successfully remove a stock.

Verify allocation is cleared.

---

## 91. E2E: Stock Remove Failure Preserves

Calculate allocation.

Fail removal.

Verify previous allocation remains.

---

## 92. E2E: Tab Switch Clears

Calculate allocation.

Switch Watchlist.

Verify new Watchlist starts without allocation values.

---

## 93. E2E: Create Clears

Calculate allocation.

Create a new active Watchlist.

Verify no allocation carries over.

---

## 94. E2E: Delete Transition Clears

Calculate allocation.

Delete active Watchlist and transition to another.

Verify no allocation carries over.

---

## 95. E2E: Editing Input Does Not Erase Last Result

Calculate:

```text
1000
```

successfully.

Then change the Total Savings input to:

```text
2000
```

without calculating.

Verify the previous allocation remains displayed.

Do not imply that it represents the new `2000` input.

---

## 96. E2E: Mobile Allocation

Under mobile Chromium:

* Total Savings input is usable;
* Calculate button is reachable;
* Invested value is readable;
* Savings Amount column is reachable through horizontal table scrolling;
* page-level horizontal overflow remains absent.

---

# Runtime Verification

## 97. Deterministic E2E Coverage

All repeatable allocation UI behavior must live in:

```text
tests/e2e/investment-allocation.spec.ts
```

Do not create temporary external Playwright scripts for deterministic product behavior.

---

## 98. Real Runtime Smoke Test

Perform a focused real-runtime integration smoke test under the documented Cloudflare runtime using:

* synthetic Access identity;
* local KV;
* real Yahoo;
* existing allocation endpoint.

Verify:

```text
UI
→ Total Savings
→ POST allocation
→ server Watchlist composition
→ server investment calculation
→ returned per-symbol savings
→ Invested
→ UI
```

Use a small Watchlist.

Restore/remove temporary local test data afterward.

---

## 99. Real Filter Scope Check

Where practical during the runtime smoke test:

1. use a Watchlist with multiple stocks;
2. filter to one visible row;
3. calculate allocation;
4. verify Invested still reflects the complete Watchlist allocation.

This is useful integration evidence but must not require expanding the task substantially.

---

# Documentation

## 100. Architecture Documentation

Update `ARCHITECTURE.md` only where necessary to document the allocation UI workflow.

Ensure it reflects:

* Total Savings is entered as non-negative whole Euros;
* calculation is explicitly user-triggered;
* client sends only `totalSavings` and Watchlist identity through the route;
* allocation always uses the complete Watchlist, independent of filtering/sorting;
* Savings Amount is displayed per stock by symbol;
* Invested comes from the server response;
* pre-calculation state is distinct from calculated zero;
* Savings Amount is shown in Euros;
* filtering/sorting do not invalidate allocation;
* successful Target Price/stock membership changes invalidate allocation;
* failed business mutations preserve allocation;
* active-Watchlist changes clear allocation;
* no automatic recalculation occurs;
* allocation remains transient and unpersisted;
* allocation UI is covered by permanent Playwright tests.

Do not rewrite unrelated sections.

---

## 101. README

Update README only if developer/test commands change.

Normally no README change is required.

---

## Non-Goals

Do NOT implement:

* automatic allocation recalculation;
* allocation persistence;
* allocation history;
* allocation scenarios;
* savings currency conversion;
* share quantity;
* fractional-share calculation;
* trade-order generation;
* Savings Amount sorting;
* server-side filtering/sorting;
* Target Price behavior changes;
* Watchlist/stock business-rule changes;
* mobile card layout;
* UI framework;
* CSS framework;
* production deployment.

Do not modify the server-side investment formula.

---

## Acceptance Criteria

The task is complete when all of the following are true:

1. Total Savings input exists.
2. Input has an accessible name.
3. Total Savings accepts non-negative whole Euros.
4. Decimal/negative/invalid local values are not submitted.
5. Calculate button exists and is accessible.
6. Calculation is explicitly triggered.
7. Enter may trigger the same calculation path without duplication.
8. Client API exposes the existing allocation endpoint.
9. Request sends only numeric `totalSavings` as business payload.
10. Filtered/sorted stock collections are never sent to the server.
11. Client-safe allocation response types exist.
12. Successful allocation is stored as temporary UI state.
13. Savings Amount column exists before Delete.
14. Savings Amount column is not sortable.
15. Before calculation, Savings Amount displays `—`.
16. Calculated zero displays as zero, not `—`.
17. Savings Amount is associated to rows by symbol.
18. Savings Amount is displayed as whole Euros.
19. Invested is displayed from the server response.
20. Pre-calculation state does not misleadingly show calculated zero.
21. Explicit zero calculation displays Invested zero.
22. Server rounding remainder is preserved.
23. Filtering does not alter allocation scope.
24. Filtering does not invalidate allocation.
25. Hidden filtered rows retain their allocation.
26. Clearing filter restores hidden allocation values.
27. Sorting does not invalidate allocation.
28. Sorting does not detach Savings Amount from its symbol.
29. Target Price success invalidates allocation.
30. Target Price failure preserves allocation.
31. Target Price partial success invalidates allocation.
32. Stock-add success invalidates allocation.
33. Stock-add failure preserves allocation.
34. Stock-remove success invalidates allocation.
35. Stock-remove failure preserves allocation.
36. Tab switch clears allocation.
37. Watchlist creation clears allocation.
38. Watchlist deletion transition clears allocation.
39. No automatic recalculation occurs after invalidation.
40. Editing Total Savings alone does not erase the previous successful allocation.
41. Failed allocation attempt preserves the previous successful allocation.
42. Market-data allocation failure is displayed without replacing previous allocation.
43. FX failure requires no special client failure behavior.
44. Allocation is never persisted.
45. No client investment formulas are introduced.
46. No client invested summation is introduced.
47. Calculation is race-safe with conflicting mutations.
48. Existing table/filter/sort/Target Price/stock-management behavior remains functional.
49. Mobile layout remains usable.
50. Savings Amount column remains reachable through table scrolling.
51. Page-level horizontal overflow remains absent.
52. Validation/busy accessibility basics are satisfied.
53. Client API tests cover allocation request/response.
54. Input validation has unit coverage where extracted.
55. Orchestration tests cover allocation/invalidation semantics.
56. Permanent `investment-allocation.spec.ts` exists.
57. E2E covers pre-calculation state.
58. E2E covers successful calculation.
59. E2E covers Enter calculation.
60. E2E covers zero savings.
61. E2E covers invalid input.
62. E2E covers server/allocation failure.
63. E2E covers filter-independent allocation scope.
64. E2E covers hidden-allocation restoration.
65. E2E covers sorting with allocation.
66. E2E covers Target Price invalidation semantics.
67. E2E covers stock add/remove invalidation semantics.
68. E2E covers active-Watchlist transition clearing.
69. E2E covers Total Savings editing without immediate invalidation.
70. E2E covers mobile allocation UI.
71. Normal E2E remains independent of Cloudflare/Yahoo/Frankfurter.
72. Focused real-runtime allocation is verified.
73. Existing project checks pass.
74. `ARCHITECTURE.md` remains consistent with allocation UI behavior.
75. No unrelated product functionality is implemented.
76. No unnecessary production dependency is introduced.

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

1. verify pre-calculation placeholders;
2. verify successful allocation;
3. verify `invested < totalSavings` is displayed correctly where rounding causes a remainder;
4. verify filtering does not change allocation scope;
5. verify sorting keeps Savings Amount attached by symbol;
6. verify successful Target Price/stock mutations invalidate allocation;
7. verify failed mutations preserve allocation;
8. verify approximately 375px mobile behavior;
9. perform the focused real-runtime allocation smoke test.

Do not report a verification step as successful unless it was actually executed successfully.

Do not create temporary external Playwright scripts for repeatable allocation behavior already covered by the permanent E2E suite.

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
2. Total Savings UI design;
3. client API function/types added;
4. input validation behavior;
5. calculation trigger behavior;
6. allocation UI-state design;
7. Savings Amount table integration;
8. symbol-based allocation association;
9. Invested display behavior;
10. pre-calculation vs. calculated-zero behavior;
11. filtering/allocation interaction;
12. sorting/allocation interaction;
13. Target Price invalidation behavior;
14. stock-add/remove invalidation behavior;
15. active-Watchlist transition behavior;
16. failed-mutation preservation behavior;
17. failed-allocation preservation behavior;
18. confirmation that no automatic recalculation occurs;
19. confirmation that no client allocation formula/summation exists;
20. mutation race/busy behavior;
21. responsive/mobile behavior;
22. accessibility behavior;
23. client API tests added;
24. input/orchestration unit tests added;
25. Playwright scenarios added;
26. real-runtime allocation smoke-test result;
27. real-runtime filtered-scope result, if performed;
28. changes made to `ARCHITECTURE.md`;
29. README changes, if any;
30. results of `test`, `test:e2e`, `check`, `lint`, and `build`;
31. confirmation that allocation remains transient/unpersisted;
32. confirmation that permanent E2E tests cover repeatable allocation behavior;
33. confirmation that this task's status was changed to `Done`;
34. assumptions or unresolved issues;
35. deviations from this task or `ARCHITECTURE.md`.

Do not proceed to final UI/error/responsive polish.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
