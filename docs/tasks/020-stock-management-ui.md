# TASK-020: Stock Management UI

## Status

Done

## Goal

Implement the user interface for adding stocks to and removing stocks from the currently active Watchlist.

This task adds:

```text
[ Stock symbol                 ] [ + ]
```

above the active Watchlist table and a stock-removal action to each table row.

The UI must use the existing REST API and server-side business rules.

### Add Stock

```text
symbol input
    |
    v
POST /api/watchlists/{watchlistId}/stocks
    |
    v
server validates through MarketDataProvider
    |
    v
updated composed Watchlist
    |
    v
replace active client view
```

### Remove Stock

```text
row delete action
    |
    v
DELETE /api/watchlists/{watchlistId}/stocks/{symbol}
    |
    v
updated composed Watchlist
    |
    v
replace active client view
```

Both existing mutation endpoints already return the complete updated composed Watchlist.

Therefore successful stock mutations MUST NOT trigger an unnecessary second Watchlist GET.

Do not implement Target Price editing, filtering, sorting, or investment allocation in this task.

---

## Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* this task completely

Relevant existing frontend functionality includes:

* application shell;
* Watchlist tabs;
* Watchlist create/delete UI;
* client Watchlist API boundary;
* client orchestration;
* Watchlist stock table;
* loading/error/empty states;
* permanent Playwright E2E infrastructure.

Relevant existing endpoints:

```http
POST   /api/watchlists/{watchlistId}/stocks
DELETE /api/watchlists/{watchlistId}/stocks/{symbol}
```

The backend already owns:

* symbol trimming;
* basic symbol validation;
* Yahoo/MarketDataProvider validation;
* unknown-symbol handling;
* duplicate-symbol detection;
* Watchlist membership mutation;
* user scoping;
* Target Price independence;
* composed Watchlist generation.

Do not duplicate these business rules in the client.

---

# Add Stock

## 1. Client API Extension

Extend the existing client-side Watchlist API boundary with operations conceptually equivalent to:

```ts
addStock(watchlistId: string, symbol: string)
removeStock(watchlistId: string, symbol: string)
```

Both operations return the updated composed Watchlist.

Do not place raw `fetch()` calls directly in Svelte components.

Reuse the existing:

* API DTOs;
* warning representation;
* `WatchlistApiError`.

---

## 2. Add Stock Request

Adding a stock sends:

```http
POST /api/watchlists/{watchlistId}/stocks
Content-Type: application/json
```

with:

```json
{
  "symbol": "GAW.L"
}
```

Do not send:

* user ID;
* Target Price;
* stock name;
* market price;
* currency;
* market cap;
* dividend;
* any Yahoo response data.

---

## 3. Add Stock Response

The endpoint already returns the complete updated composed Watchlist.

After successful addition:

```text
POST add stock
     |
     v
WatchlistViewResponse
     |
     v
replace activeView
```

Do NOT immediately issue:

```http
GET /api/watchlists/{watchlistId}
```

after successful addition.

The mutation response is already sufficient.

---

## 4. Stock Symbol Input

Add a text input for the symbol to add.

Place it logically above or near the stock table/content area.

The input must have an accessible label/name.

A visible label is preferred where it fits the layout.

Do not rely solely on placeholder text as the accessible label.

---

## 5. Add Stock Button

Place a button logically associated with the symbol input.

The visible representation may use:

```text
+
```

if it has an accessible name such as:

```text
Add stock
```

Use a real `<button>`.

Do not use a clickable generic element.

---

## 6. Add by Button

Entering a symbol and activating the add button must submit the add-stock operation.

Do not reload the page.

---

## 7. Add by Enter

Pressing:

```text
Enter
```

while focused in the symbol input should submit the same operation.

Prefer semantic form submission over custom key handlers where practical.

Ensure Enter and button activation do not generate duplicate POST requests.

---

## 8. Basic Client Validation

The server remains authoritative.

The client may prevent obviously meaningless submissions for:

```text
""
"   "
```

before making an API request.

Do not implement client-side Yahoo symbol validation.

Do not implement rules for:

* uppercasing;
* lowercasing;
* exchange suffixes;
* punctuation.

---

## 9. Symbol Trimming

The backend already trims symbols.

The client may trim surrounding whitespace before sending the request.

For example:

```text
"  GAW.L  "
```

may be sent as:

```text
"GAW.L"
```

Do not otherwise rewrite the symbol.

---

## 10. No Case Normalization

Do not automatically convert:

```text
aapl
```

to:

```text
AAPL
```

The server/application currently preserves exact trimmed symbol input.

Do not introduce a conflicting client rule.

---

## 11. No Symbol Canonicalization

Do not attempt to replace the entered symbol with a canonical Yahoo symbol.

The backend already owns the current validation semantics:

```text
trimmed input
    |
    v
MarketDataProvider validation
    |
    v
persist exact trimmed input
```

The UI simply sends the input.

---

## 12. Input Clearing

After a successful stock addition, clear the symbol input.

Do not clear it before the server confirms success.

If the request fails, preserve the entered symbol so the user can correct or retry it.

---

## 13. Add Loading State

While a stock-add request is in progress:

* prevent duplicate submissions;
* disable the symbol input and/or submit button appropriately;
* expose a lightweight busy state.

Do not introduce a loading library.

---

## 14. Add Failure

If the POST fails:

* keep the existing active Watchlist/table unchanged;
* preserve the symbol input;
* display an understandable error.

Do not optimistically add a row before server success.

---

## 15. Unknown Stock Symbol

The backend may return:

```text
UNKNOWN_STOCK_SYMBOL
```

for a symbol that Yahoo/MarketDataProvider cannot resolve.

Display the stable API message.

The user must be able to distinguish this from provider unavailability.

Do not reinterpret the error as a duplicate or generic table failure.

---

## 16. Duplicate Symbol

The backend may return:

```text
DUPLICATE_SYMBOL
```

Display the stable API error.

Do not:

* add a duplicate row;
* silently treat the operation as successful;
* clear the symbol input.

---

## 17. Market Data Provider Failure

The backend may return:

```text
MARKET_DATA_UNAVAILABLE
```

when symbol validation cannot be performed because the provider is unavailable.

Display the stable API error.

Keep the existing table intact.

Preserve the symbol input.

---

## 18. Successful Add with Warnings

The returned composed Watchlist may contain warnings such as:

```text
FX_PROVIDER_UNAVAILABLE
```

The addition itself is still successful.

Replace the active view with the returned composed Watchlist and preserve/render warnings through the existing shell behavior.

Do not treat an FX warning as a failed add operation.

---

## 19. Add Requires Active Watchlist

The add-stock form only makes sense when an active Watchlist exists.

When there are no Watchlists:

* do not present an enabled add-stock form;
* keep the existing no-Watchlists state primary.

The form may be hidden entirely until a Watchlist exists.

Prefer hiding it if that produces the cleaner UI.

---

# Remove Stock

## 20. Delete Column

Extend the stock table with one additional final column:

```text
Delete
```

The table columns become:

```text
Symbol
Name
Cap (USD)
Price
Div
Currency
Target Price
Distance to Target
Delete
```

Do not add:

```text
Savings Amount
```

yet.

---

## 21. Row Delete Button

Every stock row must contain a removal button.

Use a real `<button>`.

Provide an accessible name that identifies the stock, for example:

```text
Remove AAPL
Remove SAP.DE
Remove GAW.L
```

The visible representation may be concise.

Do not rely on an unlabeled icon.

---

## 22. No Remove Confirmation

Do NOT require a confirmation dialog for removing an individual stock.

This is intentionally different from deleting an entire Watchlist.

Rationale:

* stock removal is easily reversible by adding the symbol again;
* Target Price remains persisted independently;
* no broader Watchlist structure is destroyed.

Do not introduce confirmation unless a later requirement changes this decision.

---

## 23. Remove Request

Removing a stock sends:

```http
DELETE /api/watchlists/{watchlistId}/stocks/{symbol}
```

Do not send a request body.

Do not send:

* user ID;
* Target Price.

Use normal URL encoding for the symbol path segment.

---

## 24. Symbol URL Encoding

Symbols may contain punctuation such as:

```text
GAW.L
HEXA-B.ST
```

Construct the URL safely.

Use:

```ts
encodeURIComponent(symbol)
```

or the appropriate existing URL-construction mechanism.

Do not manually remove or replace punctuation.

---

## 25. Remove Response

The DELETE endpoint already returns the updated composed Watchlist.

After success:

```text
DELETE stock
     |
     v
WatchlistViewResponse
     |
     v
replace activeView
```

Do NOT perform a second:

```http
GET /api/watchlists/{watchlistId}
```

after successful removal.

---

## 26. Target Price Independence

Removing a stock must not trigger any Target Price operation.

Do not call:

```text
PUT /api/target-prices/...
```

or invent a Target Price delete request.

The backend persistence model intentionally keeps the Target Price.

If the stock is later added again, its existing Target Price will be composed normally.

---

## 27. Remove Loading State

While a stock removal is in progress:

* prevent duplicate removal of the same row;
* expose a lightweight busy/disabled state.

It is acceptable to disable all stock mutation controls temporarily if that is the simplest race-safe design.

Do not introduce a generic request queue.

---

## 28. Remove Failure

If stock removal fails:

* keep the row;
* keep the existing active Watchlist view;
* display an understandable error.

Do not optimistically remove the row before server success.

---

## 29. Symbol Not Found

The backend may return:

```text
SYMBOL_NOT_FOUND
```

for a stale or invalid removal request.

Display the stable API error.

Do not silently treat the operation as successful.

---

## 30. Watchlist Not Found

The backend may return:

```text
WATCHLIST_NOT_FOUND
```

if the active client state refers to a Watchlist that no longer exists.

Display the stable API error.

Do not create a replacement Watchlist or silently switch tabs.

---

## 31. Remove Final Stock

If the removed stock was the final row, the successful response contains:

```text
stocks = []
```

Immediately display the existing empty-Watchlist state:

```text
This watchlist is empty.
```

Do not render an empty table header.

---

# Component Boundaries

## 32. WatchlistTable Event Boundary

`WatchlistTable.svelte` should remain primarily presentational.

It may expose a callback/event-like prop for removal, conceptually:

```text
onRemove(symbol)
```

using the current Svelte 5 component conventions.

The table MUST NOT:

* call the REST API itself;
* know the active Watchlist ID;
* own persistence state.

It renders rows and reports the user's removal intent upward.

---

## 33. Table Busy State

The table may receive enough UI state to disable removal controls while a mutation is in progress.

Keep this presentation-oriented.

Do not move orchestration into the table component.

---

## 34. Page / Client Orchestration

Keep API sequencing out of large inline Svelte handlers where practical.

Extend the existing client orchestration layer or introduce a focused stock-management orchestration helper if that keeps responsibilities clearer.

The intended separation remains:

```text
Svelte page/component
       |
       v
client orchestration
       |
       v
watchlistApi
       |
       v
REST API
```

Do not introduce global state management.

---

## 35. Mutation Race Safety

Prevent conflicting stock mutations from corrupting client state.

A simple single:

```text
stockMutationBusy
```

state is acceptable.

While stock mutation is active, it is acceptable to disable:

* add-stock form;
* row delete buttons.

If necessary, also prevent tab/Watchlist management mutations during the stock request.

Prefer simple serialization over complicated concurrent-result reconciliation.

---

## 36. Interaction with Watchlist Management

Do not allow a Watchlist to be deleted while an in-flight stock mutation could later overwrite the active view with stale data.

Reuse or extend the existing busy-state strategy from TASK-019.

Keep the solution explicit and small.

---

## 37. Interaction with Tab Switching

Likewise, avoid allowing an in-flight stock mutation to update the view after the user has switched to another Watchlist.

Temporarily disabling tab switching during stock mutation is acceptable and preferred over complex stale-response reconciliation.

---

# Responsive Design

## 38. Add Form Layout

The stock-add form must remain usable on desktop and narrow/mobile viewports.

A desktop layout may place:

```text
[ Stock symbol ] [ + ]
```

on one line.

On narrow viewports it may wrap or resize naturally.

Do not introduce fixed wide pixel dimensions.

---

## 39. Delete Column Responsive Behavior

The new Delete column remains part of the horizontally scrollable semantic table.

Do not hide the Delete column on mobile.

Do not create a separate mobile action menu.

The table container continues to own horizontal overflow.

---

## 40. Page-Level Overflow

At approximately:

```text
375px
```

verify:

* stock input remains usable;
* add button remains reachable;
* delete column is reachable by scrolling the table container;
* page itself does not horizontally overflow.

---

# Accessibility

## 41. Add Form Accessibility

The add form must have:

* accessible symbol input;
* accessible submit button;
* keyboard Enter submission;
* visible focus;
* native disabled/busy state where appropriate.

---

## 42. Remove Accessibility

Each row removal button must have a stock-specific accessible name.

For example:

```text
Remove AAPL
```

not merely:

```text
Delete
```

for assistive technology.

The column heading may remain:

```text
Delete
```

as required by the table design.

---

## 43. Busy Accessibility

Use native:

```text
disabled
```

and/or appropriate:

```text
aria-busy
```

where useful.

Do not indicate busy state solely by changing color.

---

# Client API Unit Tests

## 44. Add Stock API Tests

Extend:

```text
watchlistApi.spec.ts
```

to verify:

```text
addStock(...)
```

At minimum test:

* POST endpoint;
* encoded Watchlist ID if relevant;
* JSON request body;
* successful composed-Watchlist parsing;
* stable API error parsing.

---

## 45. Remove Stock API Tests

Test:

```text
removeStock(...)
```

for:

* DELETE endpoint;
* symbol URL encoding;
* no request body;
* successful composed-Watchlist parsing;
* stable API error parsing.

Use a representative symbol such as:

```text
HEXA-B.ST
```

and, where useful, a deliberately URL-significant test value to verify encoding.

Do not alter production symbol semantics merely for the test.

---

# Client Orchestration Unit Tests

## 46. Add Success

Verify:

```text
current activeView
      |
      v
addStock(...)
      |
      v
returned WatchlistView
      |
      v
new activeView
```

No follow-up GET is performed.

---

## 47. Add Failure

Verify an add error leaves the previous active view intact.

---

## 48. Remove Success

Verify removal replaces the active view directly from the DELETE response.

No follow-up GET is performed.

---

## 49. Remove Final Stock

Verify a response with:

```text
stocks = []
```

becomes the new active view so the Svelte layer can display the existing empty state.

---

## 50. Remove Failure

Verify removal failure preserves the previous active view.

Do not duplicate every browser test at the unit layer.

Focus unit tests on orchestration semantics.

---

# Playwright E2E

## 51. Permanent E2E Spec

Create:

```text
tests/e2e/stock-management.spec.ts
```

for the repeatable user behavior introduced by this task.

Do not create temporary external Playwright scripts for these deterministic workflows.

Extend shared route helpers/fixtures where useful.

---

## 52. E2E: Add Stock Success

Start with an active Watchlist containing representative existing stocks.

Enter:

```text
AAPL
```

or another fixture symbol not yet present.

Return an updated composed Watchlist from the POST.

Verify:

* exactly one POST occurs;
* request body contains the expected symbol;
* returned stock row appears;
* input is cleared;
* no follow-up composed-Watchlist GET occurs.

---

## 53. E2E: Add via Enter

Enter a symbol and press:

```text
Enter
```

Verify exactly one POST request.

---

## 54. E2E: Blank Symbol

Enter empty/whitespace-only input.

Verify no POST request occurs.

---

## 55. E2E: Unknown Symbol

Return:

```text
422
UNKNOWN_STOCK_SYMBOL
```

Verify:

* error is displayed;
* symbol input is preserved;
* existing table remains unchanged.

---

## 56. E2E: Duplicate Symbol

Return:

```text
409
DUPLICATE_SYMBOL
```

Verify:

* error is displayed;
* symbol input remains;
* no duplicate row appears.

---

## 57. E2E: Provider Failure

Return:

```text
503
MARKET_DATA_UNAVAILABLE
```

Verify:

* error is displayed;
* existing rows remain;
* input remains.

---

## 58. E2E: Add Success with Warning

Return an updated composed Watchlist containing:

```text
FX_PROVIDER_UNAVAILABLE
```

Verify:

* new row appears;
* operation is treated as successful;
* warning is preserved/rendered through existing behavior.

---

## 59. E2E: Remove Stock Success

Click:

```text
Remove AAPL
```

Return an updated composed Watchlist without AAPL.

Verify:

* exactly one DELETE occurs;
* AAPL row disappears;
* other rows remain;
* no follow-up composed-Watchlist GET occurs.

---

## 60. E2E: Remove Exact Symbol

Use a representative symbol such as:

```text
HEXA-B.ST
```

Verify the correct encoded DELETE URL is used and only that row is removed.

---

## 61. E2E: Remove Failure

Return a stable API failure.

Verify:

* row remains;
* existing table remains intact;
* error is displayed.

---

## 62. E2E: Remove Final Stock

Start with one stock.

Remove it successfully.

Verify:

* table disappears;
* existing empty-Watchlist state appears;
* no empty table header remains.

---

## 63. E2E: No Watchlists

Start with:

```text
watchlists = []
```

Verify:

* no active add-stock form is available;
* no stock table/delete buttons are shown;
* existing no-Watchlists state remains primary.

---

## 64. E2E: Mobile Stock Management

Under the mobile Chromium project, verify:

* symbol input is usable;
* add button is reachable;
* stock table remains horizontally scrollable;
* Delete column is reachable within the table;
* page-level horizontal overflow remains absent.

Do not assert brittle exact coordinates.

---

# Runtime Verification

## 65. Deterministic Browser Verification

All repeatable product behavior introduced by this task must be covered by:

```text
tests/e2e/stock-management.spec.ts
```

Do not create temporary Playwright scripts for behavior already represented there.

---

## 66. Real Runtime Smoke Test

Perform a focused integration smoke test under the documented Cloudflare runtime using:

* synthetic Access identity;
* local KV;
* real application API.

Verify:

```text
UI
→ add valid stock
→ Yahoo validation
→ KV membership update
→ returned composed view
→ remove stock
→ KV membership update
→ returned composed view
```

Keep provider calls minimal.

If a temporary browser script is genuinely useful solely for this one-off real-runtime diagnostic, it is permitted under the existing `CLAUDE.md` rule, but it must be removed before completion.

The permanent deterministic user behavior must remain covered by repository E2E tests.

---

## 67. Target Price Preservation Smoke Check

If practical during the real-runtime smoke test:

1. use a symbol with an existing Target Price or set one through the existing API;
2. remove the stock;
3. add it again;
4. verify the existing Target Price is composed again.

This is useful integration evidence for the established persistence design.

Do not implement new UI merely to perform this check.

This smoke check is optional if it would significantly expand task scope.

---

# Documentation

## 68. Architecture Documentation

Update `ARCHITECTURE.md` only where necessary to clarify stock-management UI behavior.

Ensure it reflects:

* symbol input is validated server-side through the existing Add Stock endpoint;
* exact trimmed symbol semantics remain server-owned;
* successful add/remove responses already contain the complete updated composed Watchlist;
* client therefore replaces `activeView` directly without a follow-up GET;
* add failures preserve input and existing view;
* stock removal requires no confirmation;
* Target Price remains untouched by stock removal;
* removal of the final stock transitions to the existing empty-Watchlist UI;
* stock mutation is serialized with conflicting tab/Watchlist management actions;
* stock-management behavior is covered by permanent Playwright tests.

Do not rewrite unrelated sections.

---

## 69. README

Update README only if developer/test commands change.

Normally no README change should be required.

---

## Non-Goals

Do NOT implement:

* Target Price editing;
* Target Price delete;
* filtering;
* sorting;
* table footer counts;
* savings amount;
* total savings;
* invested display;
* investment allocation UI;
* stock search/autocomplete;
* fuzzy symbol search;
* symbol canonicalization;
* stock removal confirmation;
* mobile card layout;
* UI framework;
* CSS framework;
* production deployment.

Do not modify backend stock-management business rules.

---

## Acceptance Criteria

The task is complete when all of the following are true:

1. A stock-symbol input exists for an active Watchlist.
2. The input has an accessible label/name.
3. An accessible add-stock button exists.
4. Add can be submitted by button.
5. Add can be submitted by Enter.
6. Empty/whitespace symbol input sends no request.
7. No client-side Yahoo validation is introduced.
8. No case normalization/canonicalization is introduced.
9. `addStock()` exists in the client API boundary.
10. Add uses `POST /api/watchlists/{watchlistId}/stocks`.
11. Successful add replaces `activeView` from the mutation response.
12. Successful add performs no unnecessary follow-up Watchlist GET.
13. Successful add clears the symbol input.
14. Failed add preserves the symbol input.
15. Failed add preserves the existing active view.
16. Unknown-symbol errors are displayed.
17. Duplicate-symbol errors are displayed.
18. Market-data-unavailable errors are displayed.
19. Successful add with FX warning remains successful.
20. Add form is unavailable when no Watchlist exists.
21. Stock table contains a final Delete column.
22. Every row has an accessible stock-specific removal button.
23. Stock removal requires no confirmation.
24. `removeStock()` exists in the client API boundary.
25. Remove uses the existing DELETE endpoint.
26. Symbol path segments are safely URL encoded.
27. Successful remove replaces `activeView` from the mutation response.
28. Successful remove performs no unnecessary follow-up GET.
29. Removing a stock does not invoke Target Price mutation.
30. Failed removal preserves the row/current view.
31. Removing the final stock shows the existing empty-Watchlist state.
32. `WatchlistTable` remains presentational and performs no API calls.
33. Mutation sequencing prevents stale responses from conflicting tab/Watchlist actions.
34. Add/remove controls remain usable responsively.
35. Delete column remains reachable through table horizontal scrolling on mobile.
36. Page-level horizontal overflow remains absent.
37. Client API tests cover add/remove.
38. Client orchestration tests cover add/remove state transitions.
39. Permanent `stock-management.spec.ts` exists.
40. E2E covers successful add.
41. E2E covers Enter submission.
42. E2E covers blank input.
43. E2E covers unknown symbol.
44. E2E covers duplicate symbol.
45. E2E covers provider failure.
46. E2E covers successful add with warning.
47. E2E covers successful removal.
48. E2E covers exact/punctuated symbol removal.
49. E2E covers removal failure.
50. E2E covers final-stock removal.
51. E2E covers no-Watchlists behavior.
52. E2E covers mobile stock-management layout.
53. Normal E2E remains independent of Cloudflare/Yahoo/Frankfurter.
54. A focused real-runtime add/remove smoke test is performed.
55. No new UI/CSS framework is introduced.
56. Existing project checks pass.
57. `ARCHITECTURE.md` remains consistent with implemented stock-management behavior.
58. No unrelated UI functionality is implemented.

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

Additionally perform the focused real-runtime smoke test:

```text
UI
→ add stock
→ Yahoo validation
→ local KV
→ composed Watchlist
→ remove stock
→ local KV
→ composed Watchlist
```

Use synthetic local Access identity.

Do not report a verification step as successful unless it was actually executed successfully.

Do not create temporary external Playwright scripts for repeatable product behavior already covered by the permanent E2E suite.

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
2. final add-stock UI structure;
3. final remove-stock table structure;
4. client API functions added;
5. client orchestration/state changes;
6. symbol input validation/normalization behavior;
7. add-success behavior;
8. unknown/duplicate/provider-error behavior;
9. add-success-with-warning behavior;
10. remove-success behavior;
11. remove-failure behavior;
12. final-stock removal behavior;
13. Target Price independence;
14. mutation busy/race behavior;
15. responsive/mobile behavior;
16. accessibility behavior;
17. client API tests added;
18. orchestration tests added;
19. Playwright scenarios added;
20. real-runtime add/remove smoke-test result;
21. Target Price preservation smoke-check result, if performed;
22. changes made to `ARCHITECTURE.md`;
23. README changes, if any;
24. results of `test`, `test:e2e`, `check`, `lint`, and `build`;
25. confirmation that no Target Price/filtering/sorting/allocation UI was implemented;
26. confirmation that permanent E2E tests cover repeatable stock-management behavior;
27. confirmation that this task's status was changed to `Done`;
28. assumptions or unresolved issues;
29. deviations from this task or `ARCHITECTURE.md`.

Do not proceed to Target Price editing, filtering, sorting, or investment-allocation UI.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
