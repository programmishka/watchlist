# TASK-036: Responsive Stock Card Layout

## Status

Done

## Goal

Replace horizontal stock-table scrolling on constrained viewports with a responsive Stock Card presentation.

The Watchlist currently has two strong desktop characteristics:

* the table efficiently presents many financial values;
* at sufficiently wide viewports, the complete 10-column table fits without horizontal scrolling.

On tablet/mobile widths, however, the same 10-column table requires horizontal scrolling. This makes it difficult to compare and edit stock data because important values and row actions are outside the visible viewport.

V3 establishes the responsive presentation rule:

> Use the stock table when the available viewport provides enough space for the financial columns to remain useful. Use Stock Cards on constrained viewports instead of horizontally scrolling the table.

Conceptually:

```text
same Watchlist state
same filtered stocks
same sorted stocks
same allocation
same Target Price editing
same stock actions
        |
        v
responsive presentation
   /               \
wide              constrained
 |                    |
table                cards
```

The responsive switch is presentation only.

Do not duplicate or move business logic into the card implementation.

---

# Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* TASK-017;
* TASK-020;
* TASK-021;
* TASK-022;
* TASK-023;
* TASK-024;
* TASK-025;
* TASK-031;
* TASK-032;
* TASK-033;
* TASK-034;
* TASK-035;
* current `WatchlistTable.svelte`;
* current `TargetPriceCell.svelte`;
* current `+page.svelte`;
* current `watchlistSort.ts`;
* current `watchlistFilter.ts`;
* current allocation presentation;
* current `app.css`;
* existing responsive/table/stock-management/Target-Price/allocation Playwright specs;
* this task completely.

Inspect the actual current layout at 375, 768, 1280, and 1600 px before selecting the final breakpoint.

---

# Product Principle

## 1. Presentation Changes, Data Does Not

Cards and table represent the same stock collection.

The source remains conceptually:

```text
activeView.stocks
        ↓
filter
        ↓
sort
        ↓
visibleStocks
```

Only after `visibleStocks` has been derived may presentation differ:

```text
visibleStocks
   /       \
table     cards
```

Do not create a second filtering or sorting pipeline for cards.

---

## 2. Table Remains Preferred for Wide Displays

The desktop table remains the preferred representation where it fits comfortably.

Do not replace the table globally with cards.

Financial comparison across rows is easier in tabular form on sufficiently wide screens.

---

## 3. Cards Replace Horizontal Table Scrolling

On constrained viewports, Stock Cards become the normal representation.

Do not require users to horizontally scroll through a 10-column table during normal tablet/mobile usage.

---

# Determine the Breakpoint Empirically

## 4. Inspect Current Table

Before implementation, inspect the current TASK-034/TASK-033 table at:

```text
375px
768px
1280px
1600px
```

Record:

* whether the complete table fits;
* whether columns remain readable;
* whether Target Price editing remains comfortable;
* whether horizontal table scrolling is required.

---

## 5. Select One Presentation Breakpoint

Choose one explicit breakpoint at which the application switches between:

```text
cards
↕
table
```

Do not create several subtly different table/card hybrids.

---

## 6. Breakpoint Guidance

Based on the current application, the likely breakpoint is somewhere between:

```text
768px
and
1280px
```

A breakpoint around:

```text
900–1000px
```

may be appropriate, but this is not mandatory.

Use observed usability rather than an arbitrary framework breakpoint.

---

## 7. Document Final Breakpoint

The completion report and `ARCHITECTURE.md` must state the final breakpoint and why it was selected.

---

# Desktop Table

## 8. Preserve Existing Table

Above the selected breakpoint, preserve the current `WatchlistTable` presentation from TASK-033/TASK-034.

Do not redesign its desktop appearance as part of this task.

---

## 9. Existing Table Features

Desktop table must preserve:

* 10 columns;
* Name-ascending default sort;
* sortable headers;
* exact-two-decimal formatting;
* signed Distance to Target;
* favorable/unfavorable Distance styling;
* Target Price editing;
* Savings Amount;
* compact stock removal;
* Total/Filtered footer.

---

## 10. No Normal Desktop Scroll Regression

At the existing verified wide desktop fixture, do not reintroduce unnecessary horizontal table scrolling.

---

# Stock Card Component

## 11. Dedicated Component

Introduce a dedicated presentational component, conceptually:

```text
WatchlistCards.svelte
```

or another clearly named equivalent.

Do not overload `WatchlistTable.svelte` with two substantially different markup structures if a separate component is clearer.

---

## 12. Same Stock Type

Cards consume the existing client `WatchlistStock` representation.

Do not create a parallel card-specific financial data model.

---

## 13. Same Stock Order

Cards render `visibleStocks` exactly in the order supplied.

Do not sort internally.

---

## 14. Stable Identity

Key cards by the same stable stock identity used by the table:

```text
symbol
```

unless the current implementation has a stronger existing key.

---

# Card Information Hierarchy

## 15. Header

Each card starts with the stock identity:

```text
AAPL
Apple Inc.
```

Symbol should be visually prominent.

Company Name should remain clearly associated with it.

---

## 16. Missing Name

If company name is unavailable:

```text
AAPL
—
```

or the existing missing-value convention.

Do not substitute Symbol as Name.

---

## 17. Primary Valuation Group

Price, Target Price, and Distance to Target are the most closely related valuation fields.

Present them as a visually coherent group.

Conceptually:

```text
Price               319.97 USD
Target Price        [ 200.00 ]
Distance to Target  +59.99%
```

The exact responsive markup may differ.

---

## 18. Price + Currency

In Card mode, combine Price and Currency visually.

Example:

```text
Price
319.97 USD
```

This avoids spending a separate card row on Currency.

Do not alter the underlying Price/Currency values.

---

## 19. Missing Price

If Price is unavailable:

```text
Price
—
```

Do not display a misleading currency-only value such as:

```text
— USD
```

unless existing product conventions strongly justify it.

Prefer treating the unavailable price as one unavailable combined value.

---

# Target Price in Cards

## 20. Reuse TargetPriceCell

Reuse the existing Target Price editing component/logic.

Do not implement a second parser/save flow for Cards.

---

## 21. Same Save Semantics

Card Target Price editing preserves:

* dot/comma decimal parsing;
* positive-number validation;
* blur save;
* Enter save path;
* unchanged-value no-op;
* error preservation;
* MARKET_DATA_UNAVAILABLE partial success;
* allocation invalidation;
* management busy behavior.

---

## 22. Card Input Width

Target Price input may use a card-appropriate width but should remain compact.

Do not make it full-card-width unless responsive usability requires it on very narrow screens.

---

# Distance to Target

## 23. Preserve Value Semantics

Card mode uses exactly the TASK-033/TASK-031 semantics:

```text
distance < 0
→ favorable
→ green

distance = 0
→ neutral

distance > 0
→ unfavorable
→ red

distance unavailable
→ —
```

---

## 24. Signed Formatting

Preserve:

```text
-15.20%
0.00%
+15.20%
—
```

using the existing formatter.

Do not duplicate percentage formatting in the Card component.

---

## 25. Visual Prominence

Distance to Target should be one of the visually prominent values in the Card because it is central to the product's value-investing workflow.

Do not make it visually indistinguishable from secondary metadata.

---

## 26. No Trading Recommendation Language

Do not label favorable/unfavorable values as:

```text
Buy
Sell
Good
Bad
```

The application remains a decision aid.

---

# Secondary Financial Data

## 27. Market Cap

Display:

```text
Market Cap (USD bn)
```

with the existing two-decimal formatter.

---

## 28. Dividend Yield

Display:

```text
Dividend Yield
```

with the existing percentage formatter.

---

## 29. Savings Amount

Display:

```text
Savings Amount
```

using the existing whole-Euro semantics.

Before allocation:

```text
—
```

After allocation:

```text
0
250
1000
```

according to the existing formatter.

---

## 30. Missing Values

Use the existing:

```text
—
```

placeholder consistently.

---

# Suggested Card Layout

## 31. Conceptual Layout

A suitable starting point is:

```text
┌──────────────────────────────────────┐
│ AAPL                     Apple Inc.  │
│                                      │
│ Price                    319.97 USD  │
│ Target Price             [ 200.00 ]  │
│ Distance                 +59.99%     │
│                                      │
│ Market Cap (USD bn)       4,669.70   │
│ Dividend Yield                0.33%  │
│ Savings Amount                    —  │
│                                      │
│                              [ 🗑 ]  │
└──────────────────────────────────────┘
```

This is conceptual, not pixel-level specification.

---

## 32. Avoid Ten Vertical Table Rows

Do not mechanically render every table column as an equally weighted full-width label/value row.

Use visual hierarchy and compact grouping.

---

## 33. Readability Before Maximum Density

Cards should be compact, but not so dense that values become difficult to associate with labels.

---

# Card Grid

## 34. Narrow Mobile

At approximately 375px:

```text
one card per row
```

---

## 35. Wider Card View

If the selected Card-mode range includes enough width for two useful cards side-by-side, a responsive grid may use:

```text
two cards per row
```

only if each card remains comfortably readable.

Do not force two columns at 768px if that makes Target Price editing or financial labels cramped.

---

## 36. Grid Must Not Change Ordering

CSS grid placement must preserve the supplied `visibleStocks` order.

---

# Stock Removal

## 37. Reuse Existing Remove Flow

Card removal uses the same stock-removal handler as the table.

Do not implement separate API orchestration.

---

## 38. Compact Action

Use the existing compact removal vocabulary/icon where appropriate.

---

## 39. Accessible Name

Preserve:

```text
Remove AAPL
```

or the current equivalent.

---

## 40. No Confirmation

Preserve the existing stock-removal behavior:

```text
no confirmation dialog
```

Do not add one as part of Card design.

---

# Filtering

## 41. Existing Filter

The company-name filter remains above the stock presentation.

---

## 42. Same Results

Filtering affects the same `visibleStocks`.

Table and Card modes must show the same matching stock set.

---

## 43. No-Match State

Preserve:

```text
No stocks match the current filter.
```

Do not render an empty Card grid underneath it.

---

## 44. Counts

Preserve TASK-033 footer semantics:

```text
Total: N stocks
```

or:

```text
Total: N stocks · Filtered: M stocks
```

The same count summary applies to Card mode.

---

# Sorting in Card Mode

## 45. Problem

Table mode exposes sorting through column headers.

Cards have no column headers.

Therefore Card mode requires an explicit compact sorting control.

---

## 46. Reuse Existing Sort State

The Card sort control manipulates the existing:

```text
WatchlistSort
```

state.

Do not introduce separate `cardSort`.

---

## 47. Default Sort

Preserve TASK-032:

```text
Name ascending
```

when a Watchlist becomes active.

Card mode must initially reflect that state.

---

## 48. Sort Column Control

Provide a compact control conceptually equivalent to:

```text
Sort by [Name ▾]
```

or:

```text
Sort: [Name ▾]
```

using the existing sortable columns.

---

## 49. Available Sort Columns

Expose the same sortable data columns as the desktop table.

Do not expose:

```text
Actions
Savings Amount
```

if they remain non-sortable in the table.

---

## 50. Direction Control

Provide a compact way to switch:

```text
ascending
descending
```

Conceptually:

```text
Sort: [Name ▾] [↑]
```

The exact control may be:

* direction button;
* select;
* equivalent accessible interaction.

---

## 51. Direction Accessibility

Do not rely on arrow glyph alone.

Provide an accessible name such as:

```text
Sort direction: ascending
```

or:

```text
Change sort direction
```

with current state available to assistive technology.

---

## 52. Existing Toggle Semantics

Preserve TASK-023 behavior where practical:

* activating another column starts ascending;
* changing direction reverses the current column.

Do not invent a new sort model for Cards.

---

## 53. Sorting Remains Raw-Value Based

Cards must use `sortWatchlistStocks()`.

Never sort formatted strings.

---

# Table/Card Switching

## 54. Same State Across Resize

Switching between Card and Table presentation due to viewport resize must preserve:

* active Watchlist;
* filter text;
* sort column;
* sort direction;
* allocation result;
* Target Price state;
* stock data.

---

## 55. No Network Request on Resize

Resizing across the presentation breakpoint must not trigger:

* Watchlist PUT;
* Watchlist GET;
* stock mutation;
* Target Price request;
* allocation request.

Presentation switch is local only.

---

## 56. Sort State Example

If user selects:

```text
Price descending
```

in Card mode and resizes to Table mode:

```text
Price
→ aria-sort="descending"
```

and rows remain in the same sorted order.

The reverse direction must also work.

---

# Responsive Implementation

## 57. Prefer CSS for Presentation Visibility

Where practical, use responsive CSS/media queries to select Card vs Table presentation.

Avoid unnecessary JavaScript viewport state if CSS can safely handle visibility.

---

## 58. Sort Control Visibility

The Card-specific sort controls should be visible only when Card presentation is active.

Desktop sortable table headers remain the sorting UI in Table mode.

---

## 59. Avoid Duplicate Accessible Interfaces

Do not leave both a visible Card UI and an off-screen-but-accessible Table UI active simultaneously.

The inactive presentation must not create duplicate interactive Target Price/Delete controls in the accessibility tree.

This is critical.

---

## 60. Component Mounting

If CSS-only hiding would leave duplicate interactive controls mounted/accessibly discoverable, use a safe responsive component-selection mechanism instead.

Choose accessibility correctness over avoiding a small amount of responsive JS.

---

## 61. SSR Safety

Any browser-width detection must remain SvelteKit SSR-safe.

---

# Horizontal Scrolling

## 62. Card Mode Has No Table Scroll

When Card mode is active, the stock presentation must not require horizontal scrolling.

---

## 63. No Page-Level Overflow

Card content must remain inside the viewport.

Long company names, symbols, formatted percentages, and inputs must not create page-level horizontal overflow.

---

## 64. Table Scroll Container

The desktop Table component may retain its existing defensive overflow container for exceptional content.

Do not remove useful defensive CSS solely because Card mode exists.

---

# Long / Extreme Values

## 65. Long Symbol

Symbols such as:

```text
HEXA-B.ST
NOVO-B.CO
```

must display without breaking the Card.

---

## 66. Long Company Name

Long company names may wrap.

Do not truncate so aggressively that company identity becomes unclear.

---

## 67. Large Distance

Large values such as:

```text
+18,242.50%
```

must remain readable without overflowing the Card.

Allow wrapping or appropriate value layout.

Do not silently truncate financial values with ellipsis.

---

## 68. Large Market Cap

Values such as:

```text
4,669.70
```

must remain readable.

---

# Busy State

## 69. Preserve Global Serialization

Existing `managementBusy` semantics remain.

Card controls must respect the same busy state as table controls.

---

## 70. Target Price Busy

Card Target Price editing must prevent duplicate save behavior exactly as the table does.

---

## 71. Remove Busy

Card remove action must respect stock mutation busy state.

---

# Error and Warning States

## 72. Target Price Error

Target Price row/cell errors must remain visible and associated with the corresponding Card.

---

## 73. Partial Success Warning

MARKET_DATA_UNAVAILABLE Target Price partial-success warning must remain visible in Card mode.

---

## 74. Page-Level Errors

Existing stock-add/allocation/Watchlist errors remain unchanged.

---

# Empty Watchlist

## 75. Empty State

If the active Watchlist has no stocks:

```text
This watchlist is empty.
```

remains.

Do not render an empty Card container.

---

# Accessibility

## 76. Card Semantics

Use reasonable semantic structure for each Card.

Possible patterns include:

```text
article
```

or a semantic list of stocks.

Do not create arbitrary role complexity.

---

## 77. Stock Identity

Screen-reader users should be able to identify which stock each Card represents.

---

## 78. Label/Value Association

Financial labels and values should have clear semantic/structural association.

---

## 79. Target Price Label

The existing accessible Target Price input name:

```text
Target price for AAPL
```

or equivalent must remain.

---

## 80. Remove Label

Preserve meaningful stock-specific remove labels.

---

## 81. Sort Controls

Card sort controls must be keyboard accessible and clearly labelled.

---

## 82. Focus Visibility

Preserve TASK-025 focus-visible styling.

---

# Component Reuse

## 83. Shared Formatting

Reuse:

* `formatNumber`;
* `formatPercentage`;
* `formatSignedPercentage`;
* `formatWholeEuro`;
* missing-value placeholder.

Do not duplicate formatting functions.

---

## 84. Shared Distance Classification

If favorable/unfavorable classification currently exists only inline in `WatchlistTable`, consider extracting a tiny shared presentation helper if necessary so Table and Cards cannot drift.

Do so only if it genuinely improves reuse.

---

## 85. Shared Target Price Component

Reuse `TargetPriceCell`.

Mandatory unless a concrete technical limitation is discovered and reported.

---

# No Server Changes

## 86. Server

No server changes are expected.

Do not change:

```text
src/lib/server/
```

to support responsive Cards.

---

## 87. API

No API shape changes.

---

## 88. Persistence

No persistence changes.

---

## 89. Financial Calculations

No financial formula changes.

---

# Unit Tests

## 90. Existing Business Tests

All existing business/application tests remain green.

---

## 91. Shared Helper Tests

If a new shared presentation helper is extracted, add focused unit coverage.

Do not add unit tests for static markup/CSS.

---

# Playwright E2E

## 92. Permanent Coverage

Permanent browser coverage is mandatory.

Update natural existing specs rather than building a disconnected second E2E suite.

Likely affected:

```text
watchlist-table.spec.ts
responsive-layout.spec.ts
target-price.spec.ts
stock-management.spec.ts
watchlist-sorting.spec.ts
watchlist-filtering.spec.ts
investment-allocation.spec.ts
ui-polish.spec.ts
```

---

# E2E — Presentation Mode

## 93. Wide Table Mode

At a viewport above the final breakpoint:

* table is visible;
* Cards are not interactively present;
* existing table behavior works.

---

## 94. Narrow Card Mode

At a viewport below the final breakpoint:

* Cards are visible;
* stock table is not interactively present;
* no horizontal stock-presentation scrolling is required.

---

## 95. Breakpoint Boundary

Test immediately below and immediately above the selected breakpoint where practical.

Verify exactly one presentation is active.

---

# E2E — Card Content

## 96. Stock Identity

Verify representative Card displays:

```text
Symbol
Company Name
```

---

## 97. Price/Currency

Verify:

```text
Price
319.97 USD
```

or locale-equivalent formatting.

---

## 98. Missing Price

Verify missing price displays `—` without misleading numeric content.

---

## 99. Market Cap

Verify two-decimal Market Cap presentation.

---

## 100. Dividend Yield

Verify two-decimal percentage presentation.

---

## 101. Target Price

Verify Target Price input exists and is stock-specific.

---

## 102. Distance Favorable

Verify negative distance uses favorable presentation.

---

## 103. Distance Unfavorable

Verify positive distance uses unfavorable presentation.

---

## 104. Distance Zero

Verify real zero remains neutral.

---

## 105. Distance Missing

Verify missing distance displays `—`.

---

## 106. Savings Amount

Verify pre-allocation missing and post-allocation whole-Euro values.

---

# E2E — Target Price Editing

## 107. Successful Save

Edit Target Price from Card mode.

Verify the existing PUT and response semantics.

---

## 108. Validation Failure

Invalid Target Price input remains locally/server-validly handled according to existing behavior.

---

## 109. Server Failure

Preserve entered text/error behavior.

---

## 110. Partial Success

Verify Target Price success with unavailable market data:

* Target Price updates;
* Distance becomes `—`;
* warning remains visible.

---

# E2E — Stock Removal

## 111. Remove From Card

Remove a representative stock in Card mode.

Verify existing DELETE behavior.

---

## 112. Remove Last Stock

Removing the final stock transitions to the existing empty-Watchlist state.

---

# E2E — Filtering

## 113. Filter Card Set

Apply company-name filter.

Verify only matching Cards remain.

---

## 114. No Match

Verify no-match state.

---

## 115. Counts

Verify Total/Filtered count summary remains correct.

---

# E2E — Card Sorting

## 116. Default Sort

Initial Card order is Name ascending.

---

## 117. Sort by Price

Use Card sort controls to select Price.

Expected first direction:

```text
ascending
```

according to existing semantics.

---

## 118. Reverse Direction

Reverse Price sort.

Verify descending raw numeric order.

---

## 119. Missing Values

Verify existing missing-last semantics remain in Card mode.

---

## 120. Distance Sorting

Verify negative/zero/positive/missing values use the same raw sort semantics as Table mode.

---

# E2E — Cross-Presentation State

## 121. Card to Table

In Card mode:

1. set filter;
2. set non-default sort;
3. calculate allocation where practical;
4. resize above breakpoint.

Verify Table mode preserves all state.

---

## 122. Table to Card

In Table mode:

1. select non-default sort;
2. resize below breakpoint.

Verify Card mode reflects the same order/state.

---

## 123. No API on Resize

Explicitly assert zero API calls caused solely by crossing the presentation breakpoint.

---

# Responsive Viewports

## 124. Required Viewports

Continue verifying:

```text
375px
768px
1280px
1600px
```

plus the final breakpoint boundary.

---

## 125. 375px

Expected:

* Card mode;
* one Card per row;
* no page horizontal overflow;
* no stock-presentation horizontal scrolling;
* Target Price usable;
* sorting usable;
* remove usable.

---

## 126. 768px

Expected mode depends on the empirically selected breakpoint.

Whichever mode is selected must be comfortable and documented.

Do not force Table mode merely because 768px was historically called "tablet."

---

## 127. 1280px

Expected:

* Table mode unless empirical evidence justifies otherwise;
* existing compact desktop workspace remains.

---

## 128. 1600px

Expected:

* Table mode;
* normal deterministic table fits;
* no regression from TASK-034.

---

# Horizontal Overflow Verification

## 129. Page Width

At all required viewports:

```text
document.documentElement.scrollWidth
<=
document.documentElement.clientWidth
```

within negligible rounding tolerance.

---

## 130. Card Width

In Card mode, no Card should exceed its content container.

---

## 131. No Stock Horizontal Scroll in Card Mode

Do not replace table scrolling with a horizontally scrolling Card carousel.

Cards flow vertically.

---

# Screenshot Review

## 132. Screenshots

Review populated Watchlist screenshots at:

```text
375
768
1280
1600
```

and at least one breakpoint-adjacent width.

---

## 133. Screenshot Criteria

Inspect:

* Card hierarchy;
* financial label/value clarity;
* Price/Currency grouping;
* Target Price editing;
* Distance prominence;
* favorable/unfavorable styling;
* Savings Amount;
* long names;
* large percentages;
* sort controls;
* spacing;
* absence of horizontal stock scrolling;
* smooth transition to desktop table.

---

# Architecture Documentation

## 134. Responsive Data Presentation

Update `ARCHITECTURE.md`:

> Wide viewports use the stock table for efficient cross-stock comparison. Constrained viewports use Stock Cards to avoid horizontal data scrolling.

---

## 135. Final Breakpoint

Document the empirically selected breakpoint.

---

## 136. Shared Pipeline

Document:

```text
active stocks
→ filter
→ sort
→ visibleStocks
→ responsive Table/Card presentation
```

Cards do not own separate filtering/sorting semantics.

---

## 137. Card Sorting

Document that Card mode exposes explicit sorting controls because sortable table headers are absent.

Both presentations manipulate the same sort state.

---

## 138. State Preservation

Document that responsive presentation changes do not trigger server requests or reset client state.

---

# Historical Task Notes

## 139. TASK-017

Add a concise note where appropriate that TASK-036 later introduced Stock Cards for constrained viewports while preserving the table for wide displays.

Keep status Done.

---

## 140. TASK-025

If useful, note that the earlier horizontal-scroll mobile strategy was later superseded by TASK-036 for normal constrained-view stock presentation.

Keep status Done.

---

## 141. TASK-034

Add a concise note that TASK-036 completes the responsive stock-presentation evolution:

```text
wide
→ table

constrained
→ cards
```

Keep status Done.

---

# README

## 142. README

No README change is required unless it explicitly states that the stock table horizontally scrolls on mobile.

If changed, keep wording product-oriented.

---

# Non-Goals

Do NOT implement:

* server-side Card rendering logic;
* separate Card API;
* separate Card data model;
* separate Card filtering;
* separate Card sort state;
* horizontal Card carousel;
* accordion Cards;
* Card expand/collapse;
* stock-detail page;
* stock-detail modal;
* drag/drop;
* pagination;
* new financial fields;
* Target Price formula changes;
* allocation changes;
* table redesign on desktop;
* Watchlist-navigation changes;
* icon library;
* production deployment;
* unrelated V3 improvements.

---

# Acceptance Criteria

The task is complete when all of the following are true:

1. One explicit Table/Card breakpoint is selected empirically.
2. Breakpoint is documented.
3. Wide viewports retain the existing table.
4. Constrained viewports use Stock Cards.
5. Card mode does not require horizontal stock scrolling.
6. Cards consume the same `visibleStocks`.
7. No separate Card filtering pipeline exists.
8. No separate Card sort state exists.
9. Card order matches existing sort state.
10. Symbol is prominent.
11. Company Name is clearly associated.
12. Price and Currency are visually grouped.
13. Missing Price is represented clearly.
14. Target Price remains directly editable.
15. Existing Target Price save semantics remain.
16. Distance retains signed two-decimal formatting.
17. Negative Distance remains favorable.
18. Positive Distance remains unfavorable.
19. Zero Distance remains neutral.
20. Missing Distance remains `—`.
21. Market Cap remains visible.
22. Dividend Yield remains visible.
23. Savings Amount remains visible.
24. Missing Savings Amount remains `—`.
25. Calculated zero Savings Amount remains real zero.
26. Stock removal works from Cards.
27. Stock removal remains accessible.
28. Filtering works identically in Card mode.
29. No-match state remains.
30. Total/Filtered counts remain correct.
31. Card mode provides explicit sort controls.
32. Sort controls use existing sortable columns.
33. Default Card sort is Name ascending.
34. Changing Card sort updates existing sort state.
35. Direction can be changed.
36. Sorting remains raw-value based.
37. Missing-last semantics remain.
38. Table/Card resize preserves sort.
39. Table/Card resize preserves filter.
40. Table/Card resize preserves allocation.
41. Table/Card resize preserves active Watchlist.
42. Resize across breakpoint causes no API requests.
43. Exactly one interactive stock presentation is active.
44. No duplicate Target Price controls exist in accessibility tree.
45. Card layout is SSR-safe.
46. Card mode has no page-level horizontal overflow.
47. Long symbols remain readable.
48. Long company names remain readable.
49. Large percentages remain readable.
50. Large financial values remain readable.
51. Busy behavior remains intact.
52. Target Price errors remain visible.
53. Partial-success warnings remain visible.
54. Empty-Watchlist behavior remains.
55. Card semantics are accessible.
56. Card sort controls are keyboard accessible.
57. Existing shared formatters are reused.
58. `TargetPriceCell` is reused unless a concrete limitation is documented.
59. No server changes are introduced.
60. No API changes are introduced.
61. No persistence changes are introduced.
62. No financial calculations change.
63. E2E covers Table mode.
64. E2E covers Card mode.
65. E2E covers breakpoint boundary.
66. E2E covers Card financial fields.
67. E2E covers Target Price save in Card mode.
68. E2E covers Target Price failure/partial success where existing coverage requires.
69. E2E covers stock removal in Card mode.
70. E2E covers filtering in Card mode.
71. E2E covers Card sorting.
72. E2E covers missing-value sorting.
73. E2E covers Card→Table state preservation.
74. E2E covers Table→Card state preservation.
75. E2E proves no API request on resize.
76. 375px is verified.
77. 768px is verified.
78. 1280px is verified.
79. 1600px is verified.
80. No required viewport has page-level horizontal overflow.
81. Screenshots are reviewed.
82. `ARCHITECTURE.md` documents responsive Table/Card presentation.
83. Historical task context is preserved.
84. Existing project checks pass.
85. No unnecessary dependency is introduced.
86. No production deployment occurs.

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

1. current table usability at 375/768/1280/1600 before selecting breakpoint;
2. final breakpoint immediately below/above;
3. Table mode above breakpoint;
4. Card mode below breakpoint;
5. no horizontal stock scrolling in Card mode;
6. Symbol/Name presentation;
7. Price/Currency grouping;
8. Market Cap;
9. Dividend Yield;
10. Target Price editing;
11. favorable Distance;
12. unfavorable Distance;
13. zero Distance;
14. missing Distance;
15. Savings Amount before/after allocation;
16. stock removal;
17. filtering;
18. Total/Filtered counts;
19. default Name sorting;
20. another numeric sort;
21. direction change;
22. missing-last behavior;
23. Card→Table state preservation;
24. Table→Card state preservation;
25. zero API calls caused solely by resize;
26. 375px;
27. 768px;
28. 1280px;
29. 1600px;
30. no page-level horizontal overflow;
31. screenshot review at required widths and breakpoint boundary.

Do not report verification as successful unless actually executed.

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
2. pre-change table behavior at required widths;
3. final breakpoint and rationale;
4. final Table-mode range;
5. final Card-mode range;
6. Card component structure;
7. Card information hierarchy;
8. Price/Currency presentation;
9. Target Price reuse/editing behavior;
10. Distance presentation;
11. Market Cap/Dividend Yield presentation;
12. Savings Amount presentation;
13. stock-removal behavior;
14. filtering behavior;
15. count behavior;
16. Card sort-control design;
17. sort-state reuse;
18. default-sort behavior;
19. missing-value sorting;
20. Card→Table state preservation;
21. Table→Card state preservation;
22. no-request-on-resize verification;
23. accessibility approach;
24. duplicate-interactive-control prevention;
25. long-content behavior;
26. busy/error/warning preservation;
27. unit tests added/changed;
28. Playwright tests added/changed;
29. 375px result;
30. 768px result;
31. 1280px result;
32. 1600px result;
33. breakpoint-boundary result;
34. horizontal-overflow verification;
35. screenshot-review results;
36. `ARCHITECTURE.md` changes;
37. historical task notes;
38. README changes, if any;
39. results of `test`, `test:e2e`, `check`, `lint`, and `build`;
40. confirmation no server/API/persistence changes occurred;
41. confirmation no financial calculations changed;
42. confirmation no production deployment occurred;
43. confirmation task status changed to Done;
44. assumptions or unresolved issues;
45. deviations from this task or `ARCHITECTURE.md`.

Do not proceed to another V3 improvement.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
