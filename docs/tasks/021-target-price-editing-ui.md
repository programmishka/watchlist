# TASK-021: Target Price Editing UI

## Status

Done

## Goal

Implement inline Target Price editing in the Watchlist stock table.

The current table displays Target Price as read-only data. Replace that cell with an editable numeric input that persists changes through the existing REST API.

The workflow is:

```text
Target Price input
       |
       v
user enters value
       |
       v
PUT /api/target-prices/{symbol}
{
  "targetPrice": <number>
}
       |
       v
server persists Target Price
       |
       +--> refreshes current market data when possible
       |
       v
{
  "symbol": "...",
  "targetPrice": ...,
  "distanceToTarget": ...,
  "warnings": [...]
}
       |
       v
update only the affected stock in activeView
```

The client MUST NOT calculate `distanceToTarget`.

The server remains responsible for:

* Target Price validation;
* Target Price persistence;
* market-data refresh;
* Target Price distance calculation.

This task also introduces locale-friendly Target Price input parsing so values such as:

```text
200,5
```

can be entered naturally and sent to the API as:

```json
{
  "targetPrice": 200.5
}
```

Do not implement filtering, sorting, or investment-allocation UI in this task.

---

## Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* this task completely

Relevant existing frontend functionality includes:

* application shell;
* Watchlist tabs;
* Watchlist create/delete;
* stock add/remove;
* `WatchlistTable.svelte`;
* `watchlistApi.ts`;
* `watchlistShell.ts`;
* stable API errors/warnings;
* permanent Playwright E2E infrastructure.

Relevant existing endpoint:

```http
PUT /api/target-prices/{symbol}
```

Request:

```json
{
  "targetPrice": 200.5
}
```

The endpoint already persists the Target Price and returns server-derived Target Price/distance information.

Do not add another backend endpoint.

---

# API Contract

## 1. Client API Extension

Extend the existing client API boundary with an operation conceptually equivalent to:

```ts
setTargetPrice(symbol: string, targetPrice: number)
```

Do not call `fetch()` directly from `WatchlistTable.svelte` or `+page.svelte`.

Reuse the existing:

* API request infrastructure;
* `WatchlistApiError`;
* warning representation.

---

## 2. Request

Send:

```http
PUT /api/target-prices/{symbol}
Content-Type: application/json
```

with:

```json
{
  "targetPrice": 200.5
}
```

Do not send:

* user ID;
* Watchlist ID;
* market price;
* distance;
* currency.

Target Price ownership remains:

```text
User + Symbol
```

and user identity remains server-derived.

---

## 3. Symbol URL Encoding

Safely encode the symbol path segment.

Representative symbols include:

```text
AAPL
GAW.L
HEXA-B.ST
```

Use the same safe URL construction principles already established for stock removal.

Do not rewrite the symbol itself.

---

## 4. Response

Use the existing API response from TASK-013.

The client representation must retain at least:

```text
symbol
targetPrice
distanceToTarget
warnings
```

according to the actual existing API contract.

Verify the exact current response shape before implementing client types.

Do not assume a stale conceptual shape if the existing endpoint differs.

---

# Target Price Input

## 5. Replace Read-Only Cell

Replace the current read-only Target Price table cell with an input.

Each stock row receives its own Target Price input.

Do not introduce a separate edit page or modal.

---

## 6. Initial Input Value

If a Target Price exists, initialize the displayed input from:

```text
stock.targetPrice
```

If none exists, display an empty input.

Do not display:

```text
—
```

inside the editable field.

The existing missing-value placeholder remains appropriate for non-editable fields only.

---

## 7. Input Type

Choose an input implementation that supports the required locale-friendly behavior.

Be cautious with:

```html
<input type="number">
```

because browser handling of comma decimal separators varies by locale/browser and can interfere with explicit parsing.

Using:

```html
<input type="text" inputmode="decimal">
```

is acceptable and may be preferable if it provides deterministic support for:

```text
200,5
```

and:

```text
200.5
```

Use the smallest robust solution.

---

## 8. Accessible Name

Every Target Price input must have an accessible name that identifies the stock.

Conceptually:

```text
Target price for AAPL
Target price for SAP.DE
Target price for GAW.L
```

Do not rely only on the table header to distinguish multiple editable inputs if that produces ambiguous accessible names.

---

# Locale Input Parsing

## 9. Client Parsing Responsibility

The REST API accepts a JSON number.

The UI therefore owns conversion from user-entered text into a JavaScript number.

This is input parsing, not business calculation.

Do not move Target Price business validation or distance calculation into the client.

---

## 10. Accepted Decimal Separators

Support at minimum:

```text
200
200.5
200,5
```

as valid user input.

Both:

```text
.
```

and:

```text
,
```

may act as the decimal separator for the simple Target Price input.

---

## 11. Whitespace

Trim surrounding whitespace.

For example:

```text
"  200,5  "
```

must parse as:

```text
200.5
```

---

## 12. Invalid Input

Reject input that cannot unambiguously be interpreted as one numeric Target Price.

Examples include:

```text
abc
200abc
,
.
```

Do not send an API request for syntactically invalid local input.

---

## 13. Positive Value

The backend remains authoritative that Target Price must be:

```text
finite
and
> 0
```

The client should also prevent obviously invalid values such as:

```text
0
-10
```

from being submitted where practical.

Do not introduce different valid-value semantics from the server.

---

## 14. No Thousands-Separator Complexity

Do not attempt to support ambiguous formatted input such as:

```text
1,234.56
1.234,56
```

in this task.

Target Price input is intended as a simple numeric editor, not a general locale-number parser.

If both `.` and `,` occur in the same value, treat it as invalid rather than guessing.

---

## 15. Parsing Helper

Introduce a small client-safe pure helper for Target Price parsing.

Conceptually:

```ts
parseTargetPriceInput(value: string): number | undefined
```

or an explicit result type if that makes invalid state clearer.

Keep it presentation/input-oriented.

Do not place parsing logic inline in table markup.

---

# Save Interaction

## 16. Save Trigger

The Target Price must be persistable without adding a large amount of row UI.

Use a simple interaction.

Preferred behavior:

* save on `change`/blur after the value has changed;
* Enter also commits the current value.

A small explicit save button per row is acceptable only if it clearly produces a better interaction.

Prefer the minimal inline-editing experience.

---

## 17. No Save for Unchanged Value

If the user focuses and leaves an input without changing its effective numeric value, do not issue an unnecessary PUT request.

For example:

```text
existing = 200
input = "200"
```

requires no save.

Likewise, locale-equivalent:

```text
existing = 200.5
input = "200,5"
```

should be considered unchanged after parsing.

---

## 18. Empty Input

There is currently no Target Price delete operation.

Therefore clearing an existing Target Price input MUST NOT delete it.

An empty input cannot be persisted.

If the user clears the field and attempts to commit:

* do not call the API;
* show local validation feedback;
* preserve the persisted Target Price in application state.

Do not invent:

```text
DELETE /api/target-prices/{symbol}
```

or send:

```text
targetPrice = null
targetPrice = 0
```

as deletion semantics.

---

## 19. Successful Save

On successful PUT:

* update the affected stock's `targetPrice`;
* update the affected stock's `distanceToTarget`;
* preserve all unrelated stock fields;
* preserve all other rows;
* preserve stock order;
* preserve active Watchlist metadata.

Do not reload the complete Watchlist.

---

## 20. Row-Scoped Update

The mutation response affects one symbol.

Update only the matching stock in:

```text
activeView.stocks
```

using exact symbol identity.

Do not reconstruct the entire Watchlist from partial response data.

Do not mutate another Watchlist's client data.

---

## 21. No Distance Calculation in Client

Never calculate:

```text
price / targetPrice - 1
```

in browser code.

Use only the server-returned:

```text
distanceToTarget
```

value.

This is a critical architecture rule.

---

## 22. Input Normalization After Success

After successful persistence, update the visible input to a clean representation of the server-confirmed Target Price.

For example:

```text
user enters: 200,50
server confirms: 200.5
```

The input may then display:

```text
200.5
```

or a locale-appropriate simple representation.

Choose a consistent approach.

Do not preserve misleading extra text that was not persisted.

---

# Failure Semantics

## 23. Invalid Local Input

For locally invalid syntax:

* do not call the API;
* show row-local or clearly associated validation feedback;
* keep the entered value available for correction.

Do not replace the entire page/table with an error state.

---

## 24. Server Validation Failure

The server may return:

```text
INVALID_TARGET_PRICE
```

Display understandable validation feedback.

Do not update:

```text
stock.targetPrice
stock.distanceToTarget
```

from the failed attempt.

Keep the user's entered value available for correction.

---

## 25. Persistence Failure

If Target Price persistence fails:

* keep the existing persisted stock values in `activeView`;
* preserve the entered input;
* display an understandable error.

Do not claim the Target Price was saved.

---

# Saved but Distance Refresh Failed

## 26. Important Partial-Success Case

TASK-013 deliberately established this behavior:

```text
Target Price persistence succeeds
        |
        v
market-data refresh fails
        |
        v
HTTP success
```

The Target Price is saved even though the current distance cannot be refreshed.

The UI MUST treat this as successful persistence.

---

## 27. Partial-Success Response

When the response indicates:

```text
targetPrice = newly saved value
distanceToTarget = unavailable
warning = MARKET_DATA_UNAVAILABLE
```

or the equivalent actual API shape:

* update the Target Price;
* do not revert the input;
* represent distance as unavailable;
* show/preserve the warning.

Do NOT display:

```text
Failed to save target price
```

because persistence succeeded.

---

## 28. Distance Availability

The current composed Watchlist type historically uses numeric:

```text
distanceToTarget
```

while the Target Price mutation API may represent unavailable refreshed distance differently.

Inspect the actual API contract from TASK-013.

If the client stock type cannot currently represent this legitimate partial-success state cleanly, make the smallest client/API-DTO adjustment necessary.

Do NOT solve the problem by substituting:

```text
0
```

for unavailable refreshed distance unless that is explicitly what the current API contract already guarantees.

The UI must not misrepresent:

```text
distance unavailable
```

as:

```text
distance = 0 %
```

if the API distinguishes them.

---

## 29. Distance Placeholder

When the Target Price save succeeded but refreshed distance is unavailable, display:

```text
—
```

in the Distance to Target cell if the client contract supports the unavailable state.

This differs from a genuine server-provided numeric:

```text
0
```

which must display:

```text
0 %
```

Do not conflate missing and zero.

---

# Busy / Race Behavior

## 30. Row Save Busy State

While a Target Price PUT is in progress:

* prevent duplicate saves for that row;
* expose an appropriate disabled/busy state.

A row-scoped busy symbol is preferable if simple.

A global Target Price mutation busy state is also acceptable for V1.

Do not introduce a request queue.

---

## 31. Conflicting Mutations

Prevent stale Target Price responses from updating the wrong UI state.

While a Target Price save is in progress, it is acceptable to temporarily disable:

* tab switching;
* Watchlist create/delete;
* stock add/remove.

This follows the simple serialized-mutation strategy established in TASK-019/TASK-020.

Prefer simple correctness over concurrent mutation complexity.

---

## 32. Error Clearing

After a later successful save, clear stale Target Price validation/save errors for that row.

Do not leave a previous failure visible after the value has been successfully persisted.

---

# Component Boundaries

## 33. WatchlistTable Responsibility

`WatchlistTable.svelte` remains primarily presentational.

It may own the temporary text value of each Target Price input if that produces the cleanest Svelte implementation.

However, it MUST NOT:

* call REST APIs;
* calculate Target Price distance;
* know Cloudflare/user identity.

It reports save intent upward through a callback/event-like prop using current Svelte 5 conventions.

---

## 34. Save Intent

The table should report conceptually:

```text
symbol
parsed targetPrice
```

to its parent/orchestration layer.

If local parsing/validation is table-owned, report only valid parsed values.

If parsing is placed in a client helper/orchestration module, keep component responsibilities similarly clear.

Do not duplicate parsing rules across layers.

---

## 35. Client Orchestration

Extend the existing client orchestration layer or add a focused Target Price helper.

Conceptually:

```text
setTargetPriceForActiveStock(...)
```

should:

1. call the client API;
2. receive server-confirmed Target Price/distance/warnings;
3. update the matching stock;
4. preserve all unrelated state.

Keep `+page.svelte` focused on Svelte state and event wiring.

---

# Responsive Design

## 36. Target Price Input Width

Target Price inputs live inside the horizontally scrollable table.

Give them a sensible compact width.

Do not allow the input to expand the Target Price column excessively.

Do not make it so narrow that typical values are unreadable.

---

## 37. Mobile Behavior

At approximately:

```text
375px
```

verify:

* table remains horizontally scrollable;
* Target Price inputs are reachable;
* inputs are usable with touch;
* Delete column remains reachable;
* page-level horizontal overflow remains absent.

Do not introduce a separate mobile editing UI.

---

# Accessibility

## 38. Keyboard Editing

A keyboard user must be able to:

* focus the Target Price input;
* edit the value;
* commit through the selected interaction;
* receive validation feedback.

Do not require pointer interaction.

---

## 39. Validation Accessibility

Validation feedback should be associated clearly enough with the affected input.

Use:

```text
aria-invalid
aria-describedby
```

where appropriate.

Do not rely solely on input border color.

---

## 40. Busy Accessibility

Use native disabled state and/or:

```text
aria-busy
```

where appropriate during persistence.

---

# Client API Tests

## 41. API Unit Tests

Extend:

```text
watchlistApi.spec.ts
```

for Target Price mutation.

At minimum verify:

* PUT endpoint;
* safe symbol URL encoding;
* numeric JSON body;
* response parsing;
* warnings parsing;
* stable API error parsing.

Use a representative symbol such as:

```text
HEXA-B.ST
```

where useful.

---

# Parsing Unit Tests

## 42. Target Price Parser Tests

Add deterministic unit tests for the input parser.

At minimum:

```text
"200"       -> 200
"200.5"     -> 200.5
"200,5"     -> 200.5
" 200,5 "   -> 200.5
```

Reject:

```text
""
" "
"abc"
"200abc"
"."
","
"1,234.56"
"1.234,56"
```

Also cover:

```text
0
negative values
```

according to the chosen parser/validation split.

---

# Orchestration Unit Tests

## 43. Successful Update

Given an active Watchlist containing:

```text
AAPL
SAP.DE
```

save a new Target Price for AAPL.

Verify only AAPL's:

```text
targetPrice
distanceToTarget
```

are updated.

SAP.DE remains unchanged.

---

## 44. Order Preservation

Verify row/stock order remains unchanged after Target Price update.

---

## 45. No Follow-Up GET

Verify successful Target Price save does not issue a composed-Watchlist GET.

The mutation response is sufficient for the affected fields.

---

## 46. Save Failure

Verify a failed API call leaves the persisted values in `activeView` unchanged.

---

## 47. Partial Success

Verify:

```text
Target Price saved
+
distance unavailable
+
MARKET_DATA_UNAVAILABLE warning
```

updates the Target Price without pretending the operation failed.

---

# Playwright E2E

## 48. Permanent Spec

Create:

```text
tests/e2e/target-price.spec.ts
```

for the user-facing behavior introduced by this task.

Do not create temporary external Playwright scripts for deterministic Target Price workflows.

---

## 49. E2E: Existing Target Price

Load a Watchlist with a stock having:

```text
targetPrice = 200
```

Verify the Target Price input initially displays that value.

---

## 50. E2E: Missing Target Price

Load a stock with no Target Price.

Verify its Target Price input is empty.

Do not display `—` inside the input.

---

## 51. E2E: Decimal Dot Input

Enter:

```text
200.5
```

commit it, and verify:

* exactly one PUT occurs;
* body contains numeric `200.5`;
* server-confirmed Target Price appears;
* server-confirmed distance appears.

---

## 52. E2E: Decimal Comma Input

Enter:

```text
200,5
```

commit it, and verify the request body contains:

```json
{
  "targetPrice": 200.5
}
```

Do not require a German browser locale for this behavior.

---

## 53. E2E: Enter Commit

Verify pressing Enter commits a changed valid value.

Ensure blur following Enter does not generate a duplicate PUT.

---

## 54. E2E: Unchanged Value

Focus and leave an unchanged Target Price.

Verify no PUT request occurs.

Also test an equivalent numeric representation where practical, such as:

```text
200.5
200,5
```

representing the same persisted value.

---

## 55. E2E: Invalid Input

Enter:

```text
abc
```

or another invalid fixture.

Verify:

* no PUT occurs;
* validation feedback appears;
* entered text remains available for correction.

---

## 56. E2E: Empty Existing Value

Clear an existing Target Price and commit.

Verify:

* no PUT occurs;
* validation feedback appears;
* no Target Price deletion semantics are invoked.

---

## 57. E2E: Server Validation Failure

Return:

```text
400
INVALID_TARGET_PRICE
```

Verify:

* entered value remains;
* old persisted Target Price/distance remain represented in application state;
* error/validation feedback is shown.

---

## 58. E2E: Successful Save

Return:

```text
symbol = AAPL
targetPrice = 250
distanceToTarget = -0.1
```

Verify:

* Target Price input reflects `250`;
* Distance to Target displays approximately `-10 %`;
* other rows remain unchanged.

---

## 59. E2E: Partial Success

Return successful persistence with:

```text
targetPrice = 250
distanceToTarget = unavailable
warning = MARKET_DATA_UNAVAILABLE
```

Verify:

* Target Price displays `250`;
* distance displays `—`;
* warning is shown/preserved;
* UI does not display a save-failed error.

---

## 60. E2E: Row Isolation

With multiple stocks, update one row.

Verify another stock's Target Price and distance remain unchanged.

---

## 61. E2E: Mobile Editing

Under mobile Chromium:

* horizontally scroll to Target Price;
* input remains usable;
* edit and commit a value;
* page-level horizontal overflow remains absent.

Do not assert brittle exact coordinates.

---

# Real Runtime Verification

## 62. Real Integration Smoke Test

Perform a focused real-runtime smoke test under the documented Cloudflare runtime using:

* synthetic Access identity;
* local KV;
* real Target Price persistence;
* real Yahoo lookup where required by the endpoint.

Verify:

```text
UI
→ edit Target Price
→ PUT
→ KV Target Price persistence
→ Yahoo refresh
→ server distance calculation
→ UI updated
```

Use a temporary/local Watchlist or restore changed local data afterward.

---

## 63. Persistence Across Removal/Re-add

This behavior was already runtime-verified in TASK-020.

Do not repeat it unless convenient.

This task focuses on Target Price editing itself.

---

# Documentation

## 64. Architecture Documentation

Update `ARCHITECTURE.md` only where necessary to clarify Target Price editing UI behavior.

Ensure it reflects:

* Target Price is edited inline in the stock table;
* Target Price input supports simple `.` and `,` decimal separators;
* locale input parsing is client-side input handling;
* business validation remains server-side;
* Target Price distance is never calculated client-side;
* successful mutation updates only the affected stock fields;
* no full Watchlist reload is required;
* clearing an input does not delete a Target Price because no delete use case exists;
* persistence success followed by market-data refresh failure remains a successful save;
* unavailable refreshed distance is visually distinct from genuine numeric zero;
* Target Price editing is covered by permanent Playwright tests.

Do not rewrite unrelated architecture sections.

---

## 65. README

Update README only if developer/test commands change.

Normally no README update is required.

---

## Non-Goals

Do NOT implement:

* Target Price deletion;
* Target Price history;
* filtering;
* sorting;
* table footer counts;
* savings amount;
* total-savings input;
* investment allocation UI;
* client-side target-distance calculation;
* stock autocomplete;
* Watchlist mutation changes;
* mobile card editing;
* UI framework;
* CSS framework;
* production deployment.

Do not modify backend Target Price business rules unless an actual API defect blocks this task and is reported before changing architecture.

---

## Acceptance Criteria

The task is complete when all of the following are true:

1. Target Price is editable inline in each stock row.
2. Missing Target Price renders as an empty input.
3. Existing Target Price initializes the input.
4. Inputs have stock-specific accessible names.
5. Simple integer input is supported.
6. `.` decimal input is supported.
7. `,` decimal input is supported.
8. Surrounding whitespace is supported.
9. Ambiguous mixed-separator input is rejected.
10. Invalid syntax sends no API request.
11. Zero/negative values are not successfully submitted.
12. Clearing a Target Price does not delete it.
13. No Target Price DELETE endpoint is introduced.
14. Target Price mutation uses the existing client API boundary.
15. Symbol URL segments are safely encoded.
16. Client sends a JSON number, not a numeric string.
17. Unchanged effective values send no unnecessary PUT.
18. Enter can commit a changed value.
19. Enter plus blur does not create duplicate saves.
20. Successful save updates the affected Target Price.
21. Successful save updates distance only from the server response.
22. Client contains no target-distance formula.
23. Other stock fields remain unchanged.
24. Other rows remain unchanged.
25. Stock order remains unchanged.
26. No full Watchlist reload occurs after successful save.
27. Failed save leaves persisted application values unchanged.
28. Failed save preserves entered text for correction/retry.
29. Server validation errors are displayed understandably.
30. Persistence success plus market-data refresh failure is treated as successful persistence.
31. Partial success updates the Target Price.
32. Partial success does not display a false save-failure message.
33. Unavailable refreshed distance is distinguishable from genuine zero where the API contract permits.
34. Target Price editing is race-safe with conflicting mutations.
35. Table remains horizontally scrollable.
36. Mobile editing remains usable.
37. Page-level horizontal overflow remains absent.
38. Validation feedback is accessible.
39. Client API tests cover Target Price mutation.
40. Parser unit tests cover dot/comma/invalid input.
41. Orchestration tests cover success/failure/partial success.
42. Permanent `target-price.spec.ts` exists.
43. E2E covers existing/missing Target Price.
44. E2E covers dot decimal.
45. E2E covers comma decimal.
46. E2E covers Enter commit.
47. E2E covers unchanged value.
48. E2E covers invalid input.
49. E2E covers empty input/no-delete semantics.
50. E2E covers server validation failure.
51. E2E covers successful Target Price/distance update.
52. E2E covers partial-success market-data warning.
53. E2E covers row isolation.
54. E2E covers mobile editing.
55. Normal E2E remains independent of Cloudflare/Yahoo/Frankfurter.
56. Focused real-runtime Target Price editing is verified.
57. Existing project checks pass.
58. `ARCHITECTURE.md` remains consistent with implemented behavior.
59. No filtering/sorting/investment-allocation UI is implemented.
60. No unnecessary production dependency is introduced.

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

Additionally perform the focused real-runtime flow:

```text
UI
→ edit Target Price
→ REST API
→ local KV
→ Yahoo refresh
→ server distance calculation
→ updated UI
```

Use synthetic local Access identity.

Restore temporary local test data where appropriate.

Do not report a verification step as successful unless it was actually executed successfully.

Do not create temporary external Playwright scripts for repeatable Target Price behavior already covered by the permanent E2E suite.

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
2. final Target Price input/component design;
3. save trigger behavior;
4. locale parsing behavior;
5. client API function added;
6. response DTO used;
7. orchestration/state-update design;
8. unchanged-value behavior;
9. empty-input/no-delete behavior;
10. successful save behavior;
11. server validation failure behavior;
12. persistence failure behavior;
13. partial-success market-data-failure behavior;
14. unavailable-distance representation;
15. confirmation that no client-side distance calculation exists;
16. mutation race/busy behavior;
17. responsive/mobile behavior;
18. accessibility behavior;
19. client API tests added;
20. parser tests added;
21. orchestration tests added;
22. Playwright scenarios added;
23. real-runtime smoke-test result;
24. changes made to `ARCHITECTURE.md`;
25. README changes, if any;
26. results of `test`, `test:e2e`, `check`, `lint`, and `build`;
27. confirmation that no Target Price delete/filtering/sorting/allocation UI was implemented;
28. confirmation that permanent E2E tests cover repeatable Target Price behavior;
29. confirmation that this task's status was changed to `Done`;
30. assumptions or unresolved issues;
31. deviations from this task or `ARCHITECTURE.md`.

Do not proceed to filtering, sorting, or investment-allocation UI.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
