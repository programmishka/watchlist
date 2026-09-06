# TASK-033: Watchlist Table Presentation Improvements

## Status

Done

## Goal

Improve the readability and financial clarity of the Watchlist stock table without changing its business logic, server APIs, persistence model, filtering semantics, or sorting calculations.

This task is based on Product Owner observations from regular use of the application.

The improvements cover:

1. clearer financial column names;
2. more logical column ordering;
3. consistent two-decimal numeric presentation;
4. value-oriented visual highlighting of `Distance to Target`;
5. a clearer table footer/count presentation.

This is a **client-side presentation task**.

Do not change server-side financial calculations.

---

# Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* TASK-017;
* TASK-022;
* TASK-023;
* TASK-024;
* TASK-025;
* TASK-031;
* TASK-032;
* current `WatchlistTable.svelte`;
* current `format.ts`;
* current `watchlistFilter.ts`;
* current `watchlistSort.ts`;
* current `+page.svelte`;
* existing table/filter/sorting Playwright specs;
* this task completely.

Inspect the current implementation before changing presentation behavior.

---

# Final Table Structure

## 1. Column Order

The final stock-table column order must be:

```text
1. Symbol
2. Name
3. Market Cap (USD bn)
4. Price
5. Currency
6. Dividend Yield
7. Target Price
8. Distance to Target
9. Savings Amount
10. Actions
```

Do not reorder the underlying stock data.

This is presentation only.

---

# Column Labels

## 2. Market Capitalization

Replace the current abbreviated label such as:

```text
Cap (USD)
```

with:

```text
Market Cap (USD bn)
```

The label must make clear that the displayed value represents **billions of US dollars**, not raw USD.

Do not change the underlying `marketCapBillionsUsd` calculation.

---

## 3. Price

Keep:

```text
Price
```

as the price-column label.

---

## 4. Currency

Move:

```text
Currency
```

directly after:

```text
Price
```

The intent is to visually associate the price value with the currency in which that price is quoted.

---

## 5. Dividend Yield

Rename the abbreviated:

```text
Div
```

column to:

```text
Dividend Yield
```

The value is a percentage yield, not a dividend cash amount.

Do not change the dividend-yield calculation.

---

## 6. Target Price

Keep:

```text
Target Price
```

unchanged.

---

## 7. Distance to Target

Keep:

```text
Distance to Target
```

unchanged.

Its presentation changes later in this task.

---

## 8. Savings Amount

Keep:

```text
Savings Amount
```

unchanged.

---

## 9. Actions

Rename the current:

```text
Delete
```

column header to:

```text
Actions
```

The row-level delete/remove control remains an action inside this column.

Do not rename the existing accessible remove/delete button unless necessary for clarity.

---

# Sorting

## 10. Sortable Columns

Preserve the existing TASK-023/TASK-032 sorting capabilities.

The same financial/data columns that are currently sortable remain sortable after renaming/reordering.

---

## 11. Actions Is Not Sortable

The new:

```text
Actions
```

column remains non-sortable.

Do not introduce action sorting.

---

## 12. Savings Amount

Preserve the existing decision regarding Savings Amount sortability.

Do not make it sortable as an incidental consequence of this task.

---

## 13. Sort by Raw Values

Sorting MUST continue to operate on the raw stock values.

Never sort by formatted display strings.

For example:

```text
4,669.70
18,242.50
```

must still be ordered according to their numeric values, not lexicographically.

This applies especially to:

* Market Cap;
* Price;
* Dividend Yield;
* Target Price;
* Distance to Target.

---

## 14. Default Name Sort

Preserve TASK-032:

```text
newly active Watchlist
→ Name ascending
```

Column-label/reordering changes must not alter the default sort.

---

# Numeric Formatting

## 15. General Rule

Existing numeric table values currently use up to two decimal places.

Change the relevant presentation rule to:

> Display exactly two decimal places for ordinary decimal financial values.

Conceptually:

```text
4669.7
→ 4,669.70

182.5
→ 182.50

0
→ 0.00
```

Locale-specific separators remain controlled by the existing `Intl.NumberFormat` behavior.

Do not hardcode German or US separators.

---

## 16. Number Formatter

Update or introduce the appropriate number formatter using semantics equivalent to:

```ts
minimumFractionDigits: 2
maximumFractionDigits: 2
```

Use the existing formatting abstraction rather than formatting values directly in Svelte templates.

---

## 17. Market Cap

Market Cap values display exactly two decimal places.

Example conceptually:

```text
3.5
→ 3.50
```

The value remains in:

```text
USD billions
```

as supplied by the server.

---

## 18. Price

Price displays exactly two decimal places.

Examples:

```text
324.9
→ 324.90

18000
→ 18,000.00
```

Do not convert currencies client-side.

---

## 19. Target Price

Target Price display in the table should use exactly two decimal places where it is presented as a formatted value.

Do not interfere with Target Price editing semantics or decimal input behavior.

Inspect `TargetPriceCell.svelte` carefully: editable input state may intentionally display server/user numeric text differently from read-only formatted table values.

Do not force formatting into an actively edited input in a way that harms editing UX.

---

# Percentage Formatting

## 20. Exactly Two Decimal Places

Percentage presentation must use exactly two decimal places.

Examples:

```text
0.182425
→ 18.24%

46.697
→ 4,669.70%

0.125
→ 12.50%

0
→ 0.00%
```

Locale-specific spacing and separators remain controlled by `Intl.NumberFormat`.

---

## 21. Dividend Yield

Dividend Yield uses the normal unsigned percentage formatter.

Example:

```text
0.0266
→ 2.66%
```

Do not add a leading `+` to positive Dividend Yield.

---

## 22. Distance to Target

Distance to Target uses a dedicated signed percentage presentation.

Examples conceptually:

```text
-0.152
→ -15.20%

0
→ 0.00%

0.152
→ +15.20%
```

Positive calculated distances must display an explicit:

```text
+
```

sign.

---

## 23. Dedicated Signed Formatter

Prefer introducing a dedicated formatter conceptually equivalent to:

```ts
formatSignedPercentage(...)
```

rather than changing the semantics of the generic percentage formatter used for Dividend Yield.

Use `Intl.NumberFormat` capabilities where appropriate.

Do not manually concatenate locale-sensitive percentage strings if the formatter can express the required sign semantics safely.

---

# Missing Numeric Values

## 24. Missing Placeholder

Preserve the existing missing-value placeholder:

```text
—
```

for unavailable numeric values.

---

## 25. Missing Is Not Zero

Do not use truthiness checks.

Examples:

```text
undefined
→ —

0
→ 0.00

distance 0
→ 0.00%
```

TASK-031's missing-vs-real-zero distinction must remain intact.

---

# Savings Amount Formatting

## 26. Preserve Whole-Euro Semantics

Savings Amount is intentionally calculated as a whole-Euro amount.

Preserve the existing whole-Euro presentation.

Examples conceptually:

```text
0
→ 0

250
→ 250

1000
→ 1,000
```

Do not change it to:

```text
250.00
```

solely to match the other table columns.

---

## 27. Missing Savings Amount

Before an investment allocation has been calculated:

```text
Savings Amount
→ —
```

Preserve existing behavior.

---

# Distance-to-Target Value Semantics

## 28. Formula Semantics

The existing Target Price distance formula remains unchanged.

Conceptually:

```text
distance = price / targetPrice - 1
```

Therefore:

```text
distance < 0
→ market price is below Target Price

distance = 0
→ market price equals Target Price

distance > 0
→ market price is above Target Price
```

---

## 29. Value-Oriented Meaning

The visual semantics intentionally differ from the mathematical sign terminology.

From a value-investing perspective:

```text
distance < 0
→ favorable

distance > 0
→ unfavorable
```

Do not call the CSS classes simply:

```text
positive
negative
```

because that would be ambiguous and easy to invert.

---

# Distance Visual States

## 30. Favorable Distance

For:

```text
distanceToTarget < 0
```

apply a visual state conceptually named:

```text
distance-favorable
```

The intended appearance is based on the previous application:

```css
color: rgb(44, 102, 45);
background: rgb(252, 255, 245);
```

Exact implementation may use the project's existing CSS custom-property system rather than repeating literal colors if that fits TASK-025's styling architecture better.

Preserve the intended green/favorable visual meaning.

---

## 31. Unfavorable Distance

For:

```text
distanceToTarget > 0
```

apply a visual state conceptually named:

```text
distance-unfavorable
```

The intended appearance is based on the previous application:

```css
color: rgb(159, 58, 56);
background: rgb(255, 246, 246);
```

Again, integrate cleanly with the existing CSS vocabulary where appropriate.

---

## 32. Neutral Distance

For:

```text
distanceToTarget === 0
```

use the normal/neutral table-cell presentation.

Do not classify zero as favorable or unfavorable.

---

## 33. Unavailable Distance

For:

```text
distanceToTarget === undefined
```

display:

```text
—
```

with neutral/default styling.

Do not classify missing data as favorable or unfavorable.

---

# Scope of Highlighting

## 34. Highlight Cell Only

Apply favorable/unfavorable highlighting only to the:

```text
Distance to Target
```

cell.

Do not color the entire stock row.

The visual statement applies specifically to the relationship between current price and Target Price.

---

## 35. Do Not Color Other Financial Values

Do not automatically color:

* Price;
* Target Price;
* Dividend Yield;
* Savings Amount;
* Market Cap

based on Target Price distance.

---

# Accessibility

## 36. Do Not Rely on Color Alone

The favorable/unfavorable distinction must not depend exclusively on color.

The signed percentage itself already provides independent information:

```text
-15.20%
+15.20%
```

Preserve this explicit sign presentation.

Do not require icons merely for accessibility unless they clearly improve the existing UI.

---

## 37. Contrast

Ensure the selected foreground/background combinations remain readable and provide reasonable contrast.

Use the existing design vocabulary where possible.

---

## 38. No Misleading Accessible Labels

Do not change the numeric accessible value into language such as:

```text
good
bad
buy
sell
```

The application provides an investment decision aid, not a trading recommendation.

---

# Table Footer / Stock Counts

## 39. Replace Existing Count Wording

Replace the current compact wording such as:

```text
3 of 6 stocks
```

with a more explicit count summary.

---

## 40. No Active Filter

When no company-name filter is active:

```text
Total: N stocks
```

Examples:

```text
Total: 50 stocks
Total: 1 stock
Total: 0 stocks
```

Use correct singular/plural grammar.

---

## 41. Active Filter

When a company-name filter is active:

```text
Total: N stocks · Filtered: M stocks
```

Examples:

```text
Total: 50 stocks · Filtered: 12 stocks
Total: 1 stock · Filtered: 1 stock
Total: 1 stock · Filtered: 0 stocks
```

Use correct singular/plural independently for each count.

---

## 42. Filtered Count Shown When Filter Is Active

If a filter is active but does not reduce the result count:

```text
Total: 50 stocks · Filtered: 50 stocks
```

is correct.

The purpose is to communicate that the table is currently in a filtered state.

---

## 43. Whitespace-Only Filter

Follow the existing TASK-022 definition of whether a filter is considered active after normalization/trimming.

Do not create a second filter-activity rule for the footer.

---

## 44. Count Source

Derive counts from existing array/state lengths.

Do not introduce mutable counters.

Conceptually:

```text
total
→ activeView.stocks.length

filtered
→ filteredStocks.length
```

Use the actual existing state pipeline.

---

## 45. Sorting Does Not Affect Counts

Changing sort order must not change:

```text
Total
Filtered
```

counts.

---

# Count Helper

## 46. Update Existing Helper

TASK-022 introduced count-formatting logic.

Update the existing helper rather than creating unrelated duplicate formatting logic.

The helper should represent the new wording cleanly.

---

## 47. Count Examples

Cover at least:

```text
total=0, no filter
→ Total: 0 stocks

total=1, no filter
→ Total: 1 stock

total=50, no filter
→ Total: 50 stocks

total=50, filtered=12, active filter
→ Total: 50 stocks · Filtered: 12 stocks

total=1, filtered=1, active filter
→ Total: 1 stock · Filtered: 1 stock

total=1, filtered=0, active filter
→ Total: 1 stock · Filtered: 0 stocks
```

---

# Table Layout

## 48. Preserve Horizontal Scrolling

The table already uses a horizontally scrollable container.

Preserve this strategy.

Longer headers such as:

```text
Market Cap (USD bn)
Dividend Yield
```

must not cause page-level horizontal overflow.

Internal table scrolling is acceptable and expected.

---

## 49. No Mobile Card Redesign

Do not replace the table with cards on mobile.

Preserve the existing responsive architecture.

---

## 50. Header Readability

Longer labels should remain readable.

Avoid unnecessary forced wrapping if it harms scanability, but do not introduce large layout changes solely to keep all columns visible simultaneously.

---

# Target Price Editing

## 51. Preserve Editable Cell

Target Price remains editable using the existing `TargetPriceCell`.

Do not replace it with static formatted text.

---

## 52. Do Not Break Input Parsing

The numeric formatting changes must not alter:

* comma-decimal support;
* dot-decimal support;
* blur-save behavior;
* Enter behavior;
* validation;
* partial-success behavior.

---

# Client-Only Scope

## 53. No Server Changes Expected

This task should normally require no changes under:

```text
src/lib/server/
```

unless a type/documentation consequence is genuinely discovered.

Do not modify server code simply to support display formatting.

---

## 54. No API Changes

Do not change REST response shapes or financial values.

---

## 55. No Domain Calculation Changes

Do not modify:

* market-cap conversion;
* dividend-yield calculation;
* Target Price distance calculation;
* investment factor;
* savings allocation.

---

# Unit Tests — Number Formatting

## 56. Two Decimal Places

Update/add formatter tests proving ordinary numeric values display exactly two decimal places.

Use an explicit locale for deterministic tests.

For example under `en-US`:

```text
4669.7
→ 4,669.70

182.5
→ 182.50

0
→ 0.00
```

---

## 57. Missing Number

Verify:

```text
undefined
→ —
```

according to the existing formatter API.

---

## 58. Non-Finite Number

Preserve existing defensive formatting semantics for:

```text
NaN
Infinity
-Infinity
```

They must not produce misleading numeric output.

---

# Unit Tests — Percentage Formatting

## 59. Dividend Percentage

Under a deterministic locale verify:

```text
0.0266
→ 2.66%
```

with exactly two decimal places.

---

## 60. Percentage Trailing Zero

Verify:

```text
0.025
→ 2.50%
```

not:

```text
2.5%
```

---

## 61. Zero Percentage

Verify:

```text
0
→ 0.00%
```

---

## 62. Signed Positive Distance

Verify:

```text
0.152
→ +15.20%
```

or locale-equivalent spacing.

---

## 63. Signed Negative Distance

Verify:

```text
-0.152
→ -15.20%
```

---

## 64. Signed Zero Distance

Verify:

```text
0
→ 0.00%
```

Do not display:

```text
+0.00%
```

unless `Intl.NumberFormat` behavior makes this unavoidable with the selected sign strategy.

Prefer neutral zero.

---

## 65. Missing Signed Percentage

Verify:

```text
undefined
→ —
```

---

# Unit Tests — Count Formatting

## 66. No-Filter Counts

Test:

* zero;
* singular;
* plural.

---

## 67. Filtered Counts

Test:

* total plural / filtered plural;
* total singular / filtered singular;
* total singular / filtered zero;
* filter active with filtered count equal to total.

---

# Presentation-State Tests

## 68. Distance Classification

If distance-state classification is implemented through a helper, test:

```text
negative
→ favorable

positive
→ unfavorable

zero
→ neutral

undefined
→ unavailable/neutral
```

Do not create a helper solely to satisfy this test if the Svelte implementation is already simple and clear.

---

# Playwright E2E

## 69. Existing Specs

Prefer extending existing specs:

```text
watchlist-table.spec.ts
watchlist-filtering.spec.ts
responsive-layout.spec.ts
ui-polish.spec.ts
```

as appropriate.

Do not create a new broad UI spec if existing feature specs are natural homes for the assertions.

---

## 70. Column Labels

Verify the exact final headers:

```text
Symbol
Name
Market Cap (USD bn)
Price
Currency
Dividend Yield
Target Price
Distance to Target
Savings Amount
Actions
```

---

## 71. Column Order

Verify the final header order exactly.

This is important because Currency has intentionally moved after Price.

---

## 72. Old Labels Absent

Verify the old labels are no longer presented as headers:

```text
Cap (USD)
Div
Delete
```

Do not confuse the row-level visible Delete button with the removed `Delete` column header.

---

## 73. Decimal Formatting

Use deterministic fixture values that require trailing zeros.

Verify examples equivalent to:

```text
4669.7
→ 4,669.70
```

and:

```text
182.5
→ 182.50
```

using the test locale/environment's expected output.

---

## 74. Dividend Yield Formatting

Verify a value requiring a trailing zero is shown with exactly two decimal places.

---

## 75. Favorable Distance

Provide:

```text
distanceToTarget < 0
```

Verify:

* signed negative percentage is shown;
* Distance cell receives the favorable visual class/state;
* row as a whole is not marked favorable.

---

## 76. Unfavorable Distance

Provide:

```text
distanceToTarget > 0
```

Verify:

* explicit `+` sign is shown;
* Distance cell receives the unfavorable visual class/state;
* row as a whole is not marked unfavorable.

---

## 77. Neutral Distance

Provide:

```text
distanceToTarget = 0
```

Verify:

```text
0.00%
```

and no favorable/unfavorable class.

---

## 78. Missing Distance

Provide:

```text
distanceToTarget = undefined
```

Verify:

```text
—
```

and no favorable/unfavorable class.

---

## 79. Count Without Filter

Verify:

```text
Total: N stocks
```

with the fixture's total count.

---

## 80. Count With Filter

Apply a company-name filter.

Verify:

```text
Total: N stocks · Filtered: M stocks
```

---

## 81. Filter Equal to Total

Use an active filter that still matches all fixture stocks where practical.

Verify both Total and Filtered values are displayed.

---

## 82. Sorting Still Numeric

Use a numeric column with values whose formatted strings could sort differently lexicographically.

Verify sorting remains numerically correct.

Do not rewrite existing comprehensive sorting coverage unnecessarily.

---

## 83. Default Name Sort

Preserve TASK-032 initial Name-ascending behavior after header changes.

Update accessible-name selectors affected by renamed headers.

---

## 84. Actions Non-Sortable

Verify:

```text
Actions
```

does not expose the sorting control used by sortable headers.

---

## 85. Mobile

At the existing mobile viewport verify:

* no page-level horizontal overflow;
* table remains internally horizontally scrollable;
* longer headers do not break the page;
* Distance highlighting remains visible;
* footer remains readable.

---

# Accessibility

## 86. Header Accessibility

Renamed sortable columns must retain appropriate accessible sort controls.

Examples conceptually:

```text
Sort by Market Cap (USD bn)
Sort by Dividend Yield
```

Use the existing pattern.

---

## 87. Actions Header

`Actions` is a normal non-sortable header.

---

## 88. Delete Button

Preserve a meaningful accessible name for the row-level delete/remove action, including the symbol where currently implemented.

---

# Architecture Documentation

## 89. Table Presentation

Update `ARCHITECTURE.md` with the presentation decisions where appropriate:

* final column names/order;
* exact-two-decimal financial formatting;
* whole-Euro Savings Amount exception;
* signed Distance to Target;
* favorable/unfavorable Distance cell semantics;
* clearer count/footer semantics.

Keep this concise and architectural rather than documenting CSS implementation details.

---

## 90. Distance Semantics

Document explicitly:

```text
negative distance
→ below Target Price
→ favorable presentation

positive distance
→ above Target Price
→ unfavorable presentation

zero
→ neutral

unavailable
→ neutral/missing
```

Avoid ambiguous `positive`/`negative` CSS terminology for the value-oriented state.

---

## 91. Client Formatting

Preserve/document that formatting remains a client presentation responsibility and does not alter raw API values or sorting semantics.

---

# Historical Tasks

## 92. TASK-017

If useful, add a concise supersession note that TASK-033 later refined table labels, ordering, and numeric presentation.

Do not rewrite TASK-017.

Keep status Done.

---

## 93. TASK-022

If useful, add a concise note that TASK-033 replaced the original compact stock-count wording with explicit Total/Filtered wording.

Keep status Done.

---

## 94. TASK-025

Do not undo the established global CSS vocabulary.

Integrate new favorable/unfavorable styles into the existing styling architecture rather than reintroducing widespread duplicated component CSS.

---

# README

## 95. README

No README change is required unless it contains specific obsolete table-column names or formatting behavior.

Do not add low-level UI formatting details to the project introduction unnecessarily.

---

# Non-Goals

Do NOT implement:

* new financial calculations;
* server-side formatting;
* API response changes;
* server-side sorting;
* persisted presentation preferences;
* new sortable columns;
* Savings Amount sorting;
* table pagination;
* mobile card layout;
* stock-row coloring;
* buy/sell recommendations;
* icons indicating trading advice;
* Target Price editing redesign;
* filter behavior changes;
* new business functionality;
* production deployment;
* unrelated V3 improvements.

---

# Acceptance Criteria

The task is complete when all of the following are true:

1. Final table has exactly 10 columns.
2. Column order matches this task.
3. `Market Cap (USD bn)` replaces the old capitalization header.
4. Currency appears immediately after Price.
5. `Dividend Yield` replaces `Div`.
6. `Actions` replaces the Delete column header.
7. Actions remains non-sortable.
8. Existing sortable financial columns remain sortable.
9. Sorting continues using raw values.
10. TASK-032 Name-ascending default remains intact.
11. Ordinary decimal financial display uses exactly two decimal places.
12. Trailing decimal zeros are shown.
13. Market Cap uses exactly two decimals.
14. Price uses exactly two decimals.
15. Target Price read-only presentation follows the two-decimal rule where applicable without harming editing UX.
16. Percentages use exactly two decimal places.
17. Dividend Yield has no forced positive sign.
18. Positive Distance to Target has explicit `+`.
19. Negative Distance retains `-`.
20. Zero Distance is displayed neutrally as `0.00%`.
21. Missing Distance remains `—`.
22. Savings Amount preserves whole-Euro formatting.
23. Missing Savings Amount remains `—`.
24. Negative Distance receives favorable presentation.
25. Positive Distance receives unfavorable presentation.
26. Zero Distance receives neutral presentation.
27. Missing Distance receives neutral presentation.
28. Favorable/unfavorable styling applies only to the Distance cell.
29. Entire rows are not colored.
30. Favorable/unfavorable class naming is semantically unambiguous.
31. Signed values provide non-color-only information.
32. Existing CSS vocabulary is reused where appropriate.
33. No-filter footer says `Total: N stock(s)`.
34. Active-filter footer shows Total and Filtered counts.
35. Active filter with all stocks matched still shows Filtered count.
36. Singular/plural grammar is correct.
37. Counts remain derived, not mutable.
38. Sorting does not affect counts.
39. Filtering semantics are unchanged.
40. Horizontal table scrolling remains.
41. No page-level mobile overflow is introduced.
42. No mobile card redesign is introduced.
43. Target Price editing remains functional.
44. No client-side financial calculation is introduced.
45. No server financial calculation changes.
46. No REST/API changes.
47. No persistence changes.
48. Number-formatting unit tests cover trailing zeros.
49. Percentage tests cover trailing zeros.
50. Signed-percentage tests cover positive, negative, zero, and missing.
51. Count-format tests cover zero/singular/plural/filter states.
52. E2E verifies final headers.
53. E2E verifies exact header order.
54. E2E verifies representative two-decimal values.
55. E2E verifies Dividend Yield formatting.
56. E2E verifies favorable Distance presentation.
57. E2E verifies unfavorable Distance presentation.
58. E2E verifies neutral zero.
59. E2E verifies missing Distance.
60. E2E verifies new footer without filter.
61. E2E verifies new footer with filter.
62. E2E verifies numeric sorting remains correct.
63. E2E verifies Actions is not sortable.
64. E2E verifies mobile layout.
65. `ARCHITECTURE.md` documents the presentation rules.
66. Historical task context is preserved where appropriate.
67. Existing project checks pass.
68. No unnecessary dependency is introduced.
69. No production deployment occurs.

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

1. final header names;
2. final header order;
3. Market Cap clearly communicates USD billions;
4. Currency follows Price;
5. Dividend Yield label is explicit;
6. Actions replaces the Delete header;
7. representative number with one source decimal displays two;
8. representative percentage with one displayed decimal now displays two;
9. negative Distance is favorable/green;
10. positive Distance is unfavorable/red and explicitly signed `+`;
11. zero Distance is neutral `0.00%`;
12. unavailable Distance is neutral `—`;
13. only Distance cells are highlighted;
14. no-filter count wording;
15. active-filter count wording;
16. active filter matching all stocks still displays Filtered;
17. numeric sorting still uses raw values;
18. default Name sorting remains intact;
19. Target Price editing remains functional;
20. mobile table remains internally scrollable without page overflow.

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
2. final table column order;
3. final column labels;
4. number-formatting rule;
5. percentage-formatting rule;
6. signed Distance formatter behavior;
7. Dividend Yield formatting;
8. Savings Amount exception;
9. missing-value behavior;
10. favorable Distance classification/styling;
11. unfavorable Distance classification/styling;
12. neutral-zero behavior;
13. unavailable-distance behavior;
14. proof only Distance cells are highlighted;
15. final footer wording;
16. singular/plural behavior;
17. filter-active behavior;
18. confirmation sorting still uses raw values;
19. confirmation default Name sort remains;
20. Target Price editing verification;
21. unit tests added/changed;
22. Playwright scenarios added/changed;
23. mobile verification;
24. `ARCHITECTURE.md` changes;
25. historical task notes, if any;
26. README changes, if any;
27. results of `test`, `test:e2e`, `check`, `lint`, and `build`;
28. confirmation no server/API/persistence changes were made;
29. confirmation no financial formulas changed;
30. confirmation no production deployment occurred;
31. confirmation task status changed to Done;
32. assumptions or unresolved issues;
33. deviations from this task or `ARCHITECTURE.md`.

Do not proceed to another V3 improvement.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
