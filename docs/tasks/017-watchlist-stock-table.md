# TASK-017: Watchlist Stock Table

## Status

Done

## Goal

Implement the read-only stock table for the currently loaded Watchlist.

The table must display the composed stock data already returned by:

```http
GET /api/watchlists/{watchlistId}
```

This task is presentation-focused.

It must render:

* symbol;
* company name;
* market capitalization in billions USD;
* current market price;
* dividend yield;
* currency;
* Target Price;
* distance to Target Price.

The table must be responsive through horizontal scrolling on narrow viewports.

Do not implement:

* Target Price editing;
* stock deletion;
* filtering;
* sorting;
* savings allocation;
* savings amount.

Those belong to later tasks.

---

## Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* this task completely

Relevant existing frontend code includes:

* application shell from TASK-016;
* `WatchlistTabs.svelte`;
* `watchlistApi.ts`;
* `watchlistShell.ts`;
* active composed Watchlist client state.

The composed Watchlist API already provides stock data conceptually equivalent to:

```ts
interface WatchlistStock {
  symbol: string;
  name?: string;
  marketCapBillionsUsd?: number;
  price?: number;
  dividendYield: number;
  currency?: string;
  targetPrice?: number;
  distanceToTarget: number;
}
```

Use the existing client API type rather than introducing a second stock representation without a concrete reason.

---

## 1. Table Component

Introduce a dedicated presentational Svelte component for the stock table.

A suitable conceptual name is:

```text
WatchlistTable.svelte
```

The component should receive the already composed stock data as input.

It MUST NOT:

* load market data;
* call REST APIs;
* access client application state directly;
* perform business calculations.

The page remains responsible for selecting the data to render.

---

## 2. Table Columns

Render the following columns in this order:

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

Do not add:

```text
Savings Amount
Delete
```

yet.

Do not add speculative columns.

---

## 3. Semantic Table

Use semantic HTML table elements:

```html
<table>
  <thead>
  <tbody>
  <tr>
  <th>
  <td>
```

Do not recreate a table using generic `<div>` elements.

Column headings must use appropriate header semantics.

---

## 4. Symbol

Display:

```text
stock.symbol
```

exactly as supplied by the API.

Examples:

```text
AAPL
SAP.DE
GAW.L
HEXA-B.ST
```

Do not:

* uppercase;
* lowercase;
* remove exchange suffixes;
* modify punctuation.

Symbol is always available.

---

## 5. Company Name

Display:

```text
stock.name
```

when available.

Example:

```text
Apple Inc.
```

If the value is unavailable, display the common missing-value placeholder defined by this task.

Do not substitute the symbol as the company name.

---

## 6. Market Capitalization

Display:

```text
stock.marketCapBillionsUsd
```

under:

```text
Cap (USD)
```

The value already represents:

> billions of USD

Do NOT:

* perform FX conversion;
* divide by one billion;
* round in business logic;
* append nine zeros.

Only display formatting is performed on the client.

---

## 7. Market Cap Display Precision

Display market capitalization with a sensible compact numeric precision.

Use up to two fractional digits.

Examples conceptually:

```text
248.79
42.5
5
```

When rendered under German locale conventions, these may appear as:

```text
248,79
42,5
5
```

Do not force unnecessary trailing zeroes unless the existing UI formatting convention naturally does so.

Do not append:

```text
bn
B
Mrd.
USD
```

inside each cell because the column heading already establishes:

```text
Cap (USD)
```

and the architecture defines the unit as billions.

---

## 8. Price

Display:

```text
stock.price
```

without currency conversion.

The displayed number remains in:

```text
stock.currency
```

Examples:

```text
AAPL   -> USD price
SAP.DE -> EUR price
GAW.L  -> GBp price
```

Do not convert price to EUR or USD.

---

## 9. Price Formatting

Use locale-aware numeric formatting.

Do not hard-code:

```text
value.toFixed(2)
```

for every stock.

Different stock prices may reasonably contain different useful decimal precision.

For the initial UI, use a sensible maximum number of fractional digits without inventing provider precision that is not present.

A practical default is:

```text
maximumFractionDigits: 2
```

unless existing project conventions indicate otherwise.

Do not append the currency inside the price cell because currency has its own column.

---

## 10. Dividend Yield

Display:

```text
stock.dividendYield
```

as a percentage.

The API supplies a decimal ratio.

Example:

```text
0.0266
```

must display approximately:

```text
2.66 %
```

under an English locale or:

```text
2,66 %
```

under German locale formatting.

Do not multiply or otherwise transform dividend data except as required for percentage display formatting.

The underlying business calculation remains server-side.

---

## 11. Dividend Precision

Display dividend yield with up to two fractional percentage digits.

Examples:

```text
0        -> 0 %
0.0266   -> 2.66 %
0.04327  -> 4.33 %
```

using locale-aware formatting.

Do not expose the raw decimal ratio to the user.

---

## 12. Currency

Display:

```text
stock.currency
```

exactly as returned by the API.

Examples include:

```text
USD
EUR
CHF
SEK
NOK
GBp
```

Do not convert:

```text
GBp
```

to:

```text
GBP
```

for display.

The FX-specific `GBp -> GBP` mapping belongs exclusively to server-side market-cap conversion.

---

## 13. Target Price

Display:

```text
stock.targetPrice
```

when available.

Target Price remains in the stock's trading currency.

Do not convert it.

Do not make it editable in this task.

TASK-020 or the corresponding later Target Price UI task will replace the display-only representation with an input.

---

## 14. Distance to Target

Display:

```text
stock.distanceToTarget
```

as a percentage.

Example:

```text
-0.10 -> -10 %
0.05  -> 5 %
```

Use locale-aware percentage formatting with up to two fractional percentage digits.

Preserve the sign.

Do not recalculate:

```text
price / targetPrice - 1
```

on the client.

---

## 15. Zero Distance Semantics

The existing server domain may return:

```text
distanceToTarget = 0
```

both when:

* price equals Target Price;
* the calculation cannot be performed because required data is missing.

The current API does not expose a separate availability flag.

Therefore render the supplied value normally:

```text
0 %
```

Do not attempt to infer missing Target Price or market data from `distanceToTarget` alone.

Target Price itself remains independently optional.

---

## 16. Missing Value Placeholder

Use one consistent placeholder for unavailable optional table values.

Use:

```text
—
```

for this task.

Apply it to unavailable:

* name;
* market cap;
* price;
* currency;
* Target Price.

Do not use inconsistent values such as:

```text
N/A
-
?
0
```

for missing provider data.

---

## 17. Missing Market Data Row

TASK-011 intentionally returns rows even when Yahoo could not resolve a symbol.

Example:

```text
symbol = UNKNOWN
targetPrice = 100
name = undefined
price = undefined
currency = undefined
marketCapBillionsUsd = undefined
```

The table must still render that row.

Conceptually:

```text
UNKNOWN | — | — | — | 0 % | — | 100 | 0 %
```

Do not remove the row merely because provider-derived data is unavailable.

---

## 18. Numeric Formatting Utilities

Introduce small client-safe formatting helpers where they improve consistency.

Suitable conceptual functions include:

```text
formatNumber(...)
formatPercentage(...)
```

Do not scatter repeated `Intl.NumberFormat` construction and formatting rules throughout table markup.

Keep these helpers presentation-only.

They MUST NOT contain business formulas.

---

## 19. Locale

Use locale-aware formatting through:

```text
Intl.NumberFormat
```

or an equivalent browser-native API.

Prefer the user's/browser's normal locale rather than hard-coding German punctuation manually.

Do not implement custom comma/period replacement.

The application should naturally display German formatting for a German-locale browser.

---

## 20. Numeric Alignment

Numeric columns should be visually easy to scan.

Use appropriate CSS alignment for:

```text
Cap (USD)
Price
Div
Target Price
Distance to Target
```

Right alignment is appropriate.

Do not right-align:

```text
Symbol
Name
Currency
```

unless there is a clear visual reason.

---

## 21. Table Readability

Use simple native CSS to provide:

* clear header distinction;
* reasonable row spacing;
* column separation through whitespace;
* readable typography;
* consistent numeric alignment.

Avoid excessive borders or decorative styling.

Do not introduce zebra striping unless it clearly improves readability.

---

## 22. Header Behavior

The column headers are display-only in this task.

Do NOT make them:

* clickable;
* buttons;
* sorting controls.

Sorting belongs to a later task.

Do not visually imply that sorting is available.

---

## 23. Responsive Table Container

The table has more columns than fit comfortably on a narrow viewport.

Wrap it in a container that allows:

```text
horizontal scrolling
```

when necessary.

Conceptually:

```css
.table-container {
  overflow-x: auto;
}
```

The table itself may retain a useful minimum width.

Do not force every column to collapse into unreadably narrow cells.

---

## 24. No Page-Level Horizontal Overflow

On narrow screens:

* the table container may scroll horizontally;
* the application page itself must not horizontally overflow because of the table.

This distinction is important.

The user should scroll the table area, not the entire application page.

---

## 25. No Mobile Card Representation

Do not create a separate mobile card layout.

V1 responsive behavior is:

```text
semantic table
+
horizontal table scrolling
```

A card representation may be considered later if needed.

---

## 26. Long Company Names

Long company names must not destroy the table layout.

Use a sensible minimum/maximum width or wrapping strategy.

Do not truncate company names permanently without a way to access the full value unless necessary.

For this task, normal wrapping is acceptable.

Avoid making the Name column so wide that all other columns become impractical.

---

## 27. Table Integration

Replace TASK-016's temporary active-Watchlist stock-count-only content with the real table when:

```text
activeWatchlist.stocks.length > 0
```

The Watchlist name may remain as a content heading if it fits the existing shell.

Do not duplicate the tab label unnecessarily if the current layout already makes the active Watchlist obvious.

Use judgment while keeping the UI simple.

---

## 28. Empty Watchlist State

Preserve the existing TASK-016 empty state.

When:

```text
stocks = []
```

display:

```text
This watchlist is empty.
```

or the existing equivalent.

Do not render the table header without rows.

---

## 29. Loading State

Preserve TASK-016's active-Watchlist loading behavior.

Do not render stale rows as if they belonged to the newly selected Watchlist while it is loading.

Use the existing shell state semantics.

Do not redesign tab-loading behavior as part of this task.

---

## 30. Error State

Preserve TASK-016's active-Watchlist error behavior.

If the composed Watchlist cannot be loaded:

* keep tabs visible;
* show the existing content error;
* do not render a misleading table.

Do not replace API error handling with table-specific behavior.

---

## 31. Warning Preservation

Preserve existing active-Watchlist warnings.

If the current shell already renders a generic warning, keep it.

Do not remove warning state while introducing the table.

Final warning presentation remains a later polish task.

---

## 32. No Client Business Logic

The table MUST NOT calculate:

* market cap conversion;
* dividend yield;
* target-price distance;
* investment factor;
* savings allocation.

It only formats server-provided values for display.

---

## 33. No API Changes

This task should not require backend API changes.

Use the existing:

```http
GET /api/watchlists/{watchlistId}
```

response.

Do not add table-specific endpoints.

If an actual API defect blocks correct rendering, report it before modifying backend architecture.

---

## 34. No Target Price Editing

Target Price is read-only in this task.

Do not add:

* `<input>`;
* change handlers;
* PUT calls;
* optimistic Target Price state.

---

## 35. No Stock Removal

Do not add a delete/remove button or icon.

Stock removal UI belongs to a later task.

---

## 36. No Savings Column

Do not render:

```text
Savings Amount
```

yet.

The normal composed Watchlist API does not contain allocation values.

The savings column belongs to the Investment Allocation UI task.

---

## 37. No Filtering

Do not implement the company-name filter.

All loaded stocks are rendered.

Filtering belongs to a later task.

---

## 38. No Sorting

Do not implement sorting.

Rows remain in the order supplied by the composed Watchlist API.

That order corresponds to persisted Watchlist order.

---

## 39. Stable Row Identity

Use:

```text
stock.symbol
```

as the Svelte key for rows.

The architecture guarantees a symbol occurs at most once within one Watchlist.

Do not use array index as the primary row identity.

---

## 40. Accessibility

At minimum:

* use semantic table markup;
* column headers are identifiable as headers;
* missing-value placeholder remains readable by assistive technology;
* horizontal scrolling does not make keyboard interaction impossible;
* maintain readable contrast.

Do not introduce accessibility libraries solely for the table.

---

## 41. Testing Strategy

Add focused tests without introducing heavy component-test infrastructure.

Formatting utilities should be unit-tested directly.

If the current test setup can reasonably test table rendering without adding dependencies, test the component.

Otherwise keep presentation logic simple and verify the component through runtime/browser testing.

Do not add Playwright or another browser framework as a project dependency solely for this task.

---

## 42. Required Formatting Tests

At minimum test the client formatting helpers for:

### Number

Representative:

```text
248.79
```

### Percentage

Representative:

```text
0.0266
```

must be formatted as approximately:

```text
2.66 %
```

according to the selected locale/test locale.

### Negative Percentage

Representative:

```text
-0.1
```

must preserve the negative sign.

### Zero

Verify numeric zero is formatted as a real value and not treated as missing.

### Missing Value

Verify unavailable optional numeric values produce:

```text
—
```

through the chosen formatting boundary.

Use an explicit locale in unit tests where deterministic punctuation is required.

Production formatting may use browser/default locale.

---

## 43. Required Table Rendering Verification

Verify with representative data containing:

```text
AAPL
SAP.DE
GAW.L
UNKNOWN
```

or an equivalent set.

Ensure the rendered table demonstrates:

* normal USD row;
* normal EUR row;
* GBp row;
* missing-market-data row;
* Target Price present;
* Target Price absent;
* positive distance;
* negative distance;
* zero distance.

Do not require live Yahoo data for automated tests.

---

## 44. Required Column Verification

Verify the table renders exactly these columns in this order:

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

No:

```text
Savings Amount
Delete
```

columns should exist.

---

## 45. Runtime Verification

Use the documented Cloudflare runtime and existing local Watchlist data.

Verify a real composed Watchlist renders using the actual API.

Where practical, include:

* one USD stock;
* one non-USD stock;
* one GBp stock.

Do not add permanent demo data to application source.

---

## 46. Desktop Verification

At a desktop-like viewport, verify:

* all columns are readable;
* numeric columns align consistently;
* headers are clear;
* rows are visually distinguishable;
* the table fits naturally when enough width is available.

---

## 47. Narrow/Mobile Verification

At approximately:

```text
375px
```

viewport width, verify:

* the page itself has no horizontal overflow;
* the table container scrolls horizontally;
* table columns retain usable widths;
* tabs from TASK-016 remain usable;
* application title remains readable.

Do not claim this verification unless it was actually performed.

---

## 48. Architecture Documentation

Update `ARCHITECTURE.md` only if necessary to clarify table presentation decisions.

Ensure the architecture reflects:

* the initial table columns;
* market cap is displayed in billions USD;
* dividend and distance are formatted as percentages client-side from server-provided ratios;
* price and Target Price remain in trading currency;
* `GBp` remains visible as `GBp`;
* missing optional values use a visual placeholder rather than numeric zero;
* the initial mobile strategy is horizontal table scrolling;
* no mobile card representation exists in V1;
* filtering and sorting remain separate client-side concerns.

If these rules are already fully documented, avoid unnecessary changes.

---

## Non-Goals

Do NOT implement:

* sorting;
* filtering;
* stock count footer;
* filtered count;
* Target Price input;
* Target Price PUT calls;
* stock delete button;
* stock removal;
* add-stock UI;
* Watchlist create/delete UI;
* savings amount;
* total savings;
* invested amount;
* investment allocation;
* mobile cards;
* column hiding;
* sticky headers;
* column resizing;
* pagination;
* virtualization;
* CSS/UI framework.

Do not modify backend business logic.

---

## Acceptance Criteria

The task is complete when all of the following are true:

1. A dedicated stock-table Svelte component exists.
2. The component receives composed stock data rather than loading it itself.
3. Semantic HTML table markup is used.
4. Columns appear in the specified order.
5. Symbol is displayed unchanged.
6. Company name is displayed when available.
7. Missing company name uses `—`.
8. Market cap uses the server-provided billions-USD value.
9. Market cap is locale-formatted with sensible precision.
10. Price is displayed without currency conversion.
11. Price is locale-formatted.
12. Dividend yield is formatted as a percentage.
13. Currency is displayed unchanged, including `GBp`.
14. Target Price is displayed read-only.
15. Distance to Target is formatted as a signed percentage.
16. Missing optional values consistently use `—`.
17. Numeric zero remains distinguishable from missing data.
18. Missing-market-data stocks remain visible as rows.
19. The table preserves API/Watchlist row order.
20. Row identity uses symbol rather than array index.
21. Numeric columns are visually aligned.
22. Headers are display-only and do not imply sorting.
23. Empty Watchlists preserve the explicit empty state rather than showing an empty table.
24. Existing loading/error states remain functional.
25. Existing warning state is preserved.
26. Table overflow is contained within a horizontally scrollable table container.
27. The page itself does not horizontally overflow because of the table.
28. No mobile card representation is introduced.
29. Long company names do not break the layout.
30. No client-side business calculations are introduced.
31. No backend API changes are introduced unless an actual blocking defect is first identified.
32. No Target Price editing is implemented.
33. No stock deletion UI is implemented.
34. No savings column is implemented.
35. No filtering is implemented.
36. No sorting is implemented.
37. Formatting helpers are tested.
38. Representative table rendering is runtime-verified.
39. Desktop-like layout is verified.
40. Narrow/mobile layout is verified.
41. Existing project checks still pass.
42. `ARCHITECTURE.md` remains consistent with table presentation behavior.
43. No unnecessary production dependency is introduced.

---

## Verification

Before completing the task, execute:

```bash
npm run check
npm run test
npm run lint
npm run build
```

Additionally:

1. run the documented Cloudflare runtime;
2. load a Watchlist containing representative real stocks;
3. verify all eight columns;
4. verify number/percentage formatting;
5. verify missing-value presentation where practical;
6. inspect a desktop-like viewport;
7. inspect an approximately 375px viewport;
8. confirm horizontal scrolling occurs inside the table container rather than at page level.

Do not report a verification step as successful unless it was actually executed successfully.

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
2. final table-component structure;
3. exact rendered columns;
4. formatting utilities introduced;
5. number-formatting behavior;
6. percentage-formatting behavior;
7. missing-value behavior;
8. market-cap display behavior;
9. price/currency behavior;
10. Target Price display behavior;
11. distance display behavior;
12. missing-market-data row behavior;
13. row identity/order behavior;
14. responsive table strategy;
15. desktop verification;
16. narrow/mobile verification;
17. accessibility behavior;
18. tests added;
19. runtime verification performed;
20. changes made to `ARCHITECTURE.md`, if any;
21. results of `check`, `test`, `lint`, and `build`;
22. confirmation that no Target Price editing, stock deletion, savings, filtering, or sorting was implemented;
23. confirmation that this task's status was changed to `Done`;
24. assumptions or unresolved issues;
25. deviations from this task or `ARCHITECTURE.md`.

Do not proceed to Watchlist mutation UI, Target Price editing, filtering, sorting, or investment-allocation UI.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
