# TASK-034: Compact Responsive Watchlist Workspace

## Status

Done

## Historical Note (TASK-035)

TASK-035 replaces this task's horizontally scrollable many-tab strategy with active-visible responsive overflow navigation, and corrects the compact active-tab delete button's `×` alignment introduced here. The consolidated toolbar, wider desktop page, content-aware table column widths, and other layout work described below are otherwise unchanged. See `ARCHITECTURE.md` §14.5 and §26.12.

## Historical Note (TASK-036)

TASK-036 completes the responsive stock-presentation evolution this task started: wide viewports keep the table established/refined here, while constrained viewports now use Stock Cards instead of the table's horizontal-scroll fallback. The content-aware table column widths, wider desktop page, and consolidated toolbar described below are unchanged and remain in effect for the table's own wide-viewport presentation. See `ARCHITECTURE.md` §14.6 and §26.13.

## Goal

Redesign the existing Watchlist workspace layout to use screen space more efficiently and give the stock table clear visual priority.

The application is primarily a **financial data workspace**. On desktop, the current UI dedicates too much vertical and horizontal space to forms and management controls while the 10-column stock table is forced into a comparatively narrow area.

The new layout should be:

* compact;
* data-first;
* responsive;
* easy to scan;
* efficient on wide desktop displays;
* still usable on tablets and phones;
* consistent with the existing visual language from TASK-025/TASK-033.

The desired hierarchy is conceptually:

```text
Watchlist

[Watchlist tabs........................]   [New watchlist] [+]

[Stock symbol] [+]   [Filter by company name]   [Total savings] [Calculate]   Allocated savings: €997

┌──────────────────────────────────────────────────────────────────────────────┐
│ Stock table                                                                  │
└──────────────────────────────────────────────────────────────────────────────┘

Total: 50 stocks
```

On sufficiently wide desktop screens, the stock table should normally fit without horizontal scrolling.

Horizontal table scrolling remains the fallback for constrained viewports.

This task is a **UI layout and interaction refinement only**.

Do not change financial calculations, APIs, persistence, authentication, or application-service semantics.

---

# Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* TASK-016;
* TASK-017;
* TASK-018;
* TASK-019;
* TASK-020;
* TASK-021;
* TASK-022;
* TASK-024;
* TASK-025;
* TASK-032;
* TASK-033;
* current `+page.svelte`;
* current `WatchlistTabs.svelte`;
* current `WatchlistTable.svelte`;
* current `TargetPriceCell.svelte`;
* current `app.css`;
* current responsive-layout/UI-polish Playwright specs;
* this task completely.

Inspect the actual rendered layout and existing CSS before changing it.

Do not recreate the old application visually.

The old application screenshots supplied by the Product Owner are reference material only for useful UX principles such as compact controls and data density.

The new application should retain its own established design language.

---

# Design Principle

## 1. Data Has Priority

The stock table is the primary working surface.

Controls exist to manipulate or inspect the table and should not dominate the viewport.

Prefer:

```text
compact controls
+
large data area
```

over:

```text
large form areas
+
small data area
```

---

## 2. Reduce Vertical Chrome

The current layout uses several separate rows/sections above the table.

Reduce unnecessary vertical separation so that on a typical desktop more stock rows are visible without scrolling the page.

Do not remove useful grouping entirely.

---

## 3. Use Horizontal Space Intentionally

Inputs should be sized according to their expected content.

Do not make short-value fields consume the entire available page width.

Examples:

```text
Stock symbol
→ compact

Total savings
→ compact

Filter by company name
→ wider

New Watchlist name
→ moderate
```

---

# Page Width

## 4. Wider Desktop Workspace

The current centered page container leaves substantial unused space on wide displays while the table may require horizontal scrolling.

Increase the usable maximum width substantially.

A conceptual strategy is:

```css
.page {
  width: min(calc(100% - 2rem), 1600px);
  margin-inline: auto;
}
```

The exact value should be determined by inspecting the existing design and table requirements.

Do not blindly copy this CSS literal if a better value integrates with the current stylesheet.

---

## 5. Desktop Goal

At a sufficiently wide viewport, the complete 10-column table should normally fit without horizontal scrolling.

Test at least:

```text
1600px
```

viewport width.

A small safety margin is acceptable.

Do not require every conceivable long company name or extreme value to fit without table overflow.

The normal deterministic test fixture should fit.

---

## 6. 1280px Behavior

At approximately:

```text
1280px
```

use the available width efficiently.

Internal table scrolling is acceptable if the complete table genuinely cannot fit without making columns unreadably narrow.

Do not create page-level horizontal overflow.

---

## 7. Constrained Viewports

At:

```text
768px
375px
```

horizontal table scrolling remains expected.

Only the table container should overflow horizontally.

The page itself must not.

---

# Watchlist Management Layout

## 8. Remove Duplicate Active Watchlist Name

The current UI displays the active Watchlist name both:

* in the active tab;
* again below the stock-add controls.

Remove the second standalone Watchlist-name display.

The active tab is sufficient identification of the current workspace.

---

## 9. Active Tab Is the Workspace Label

The active Watchlist tab should remain visually clear enough that removing the duplicate name does not make the current context ambiguous.

Preserve existing:

```text
role="tab"
aria-selected
```

semantics.

---

# Delete Current Watchlist

## 10. Remove Large Delete Button

Remove the separate large:

```text
Delete current watchlist
```

button from its own row.

This action consumes too much space relative to how frequently it is used.

---

## 11. Delete Control on Active Tab

Place the current-Watchlist delete control directly beside the active tab name.

Conceptually:

```text
Dividend     Lieblingsaktien ×
                         ─────
                         active
```

Only the active Watchlist needs the delete control.

---

## 12. Delete Symbol

Prefer a compact:

```text
×
```

control for deleting/closing the active Watchlist.

This follows familiar tab-close interaction semantics.

A similarly compact icon is acceptable if it integrates substantially better with the existing UI, but do not introduce an icon library solely for this task.

---

## 13. Accessible Name

The compact visual control must have a meaningful accessible name.

Example:

```text
Remove watchlist "Lieblingsaktien"
```

Use the actual active Watchlist name.

Do not expose only:

```text
×
```

to assistive technology.

---

## 14. Confirmation

Preserve the existing Watchlist-deletion confirmation behavior.

The compact control must not make deletion immediate.

Conceptually:

```text
click ×
    ↓
Delete watchlist "Lieblingsaktien"?
    ↓
confirm / cancel
```

Do not remove the confirmation dialog in this task.

---

## 15. No Delete Control Without Watchlists

If there are no Watchlists, no Watchlist-delete control is shown.

---

# Create Watchlist

## 16. Move Creation Into Tab Area

Move the new-Watchlist input and add button into the same high-level row as the Watchlist tabs.

Conceptually on desktop:

```text
[Dividend] [Lieblingsaktien ×]             [New watchlist name] [+]
```

This replaces the current full-width dedicated creation row.

---

## 17. New Watchlist Input Width

The new-Watchlist-name field should use a moderate width rather than consuming all remaining screen width.

It must still accommodate practical Watchlist names.

Do not introduce a new business-level maximum length in this UI task.

---

## 18. Existing Create Behavior

Preserve all TASK-019 semantics:

* duplicate names allowed;
* blank/whitespace names rejected;
* Enter submits;
* button submits;
* no duplicate request;
* success activates the created Watchlist;
* failure preserves input/state;
* management busy behavior remains.

---

# Tab Overflow

## 19. Many Watchlists

The tabs area must remain usable when many Watchlists exist.

Allow the tab strip to:

* consume flexible available width;
* scroll horizontally within its own area where necessary.

Do not let a large number of tabs push the create controls outside the page.

---

## 20. Long Watchlist Names

Long Watchlist names must not cause page-level horizontal overflow.

Use a reasonable tab sizing/overflow strategy.

Do not truncate the persisted Watchlist name itself.

Visual ellipsis is acceptable if the full accessible name remains available.

---

# Primary Workspace Toolbar

## 21. Consolidate Controls

Place the common table-related controls into a compact responsive toolbar immediately above the table.

The controls are:

```text
Stock symbol
Add stock

Filter by company name

Total savings
Calculate

Allocated savings
```

---

## 22. Desktop Layout

On a sufficiently wide desktop, aim for a single row:

```text
[Stock symbol] [+]   [Filter by company name]   [Total savings] [Calculate]   Allocated savings: €997
```

Exact spacing may vary.

The controls should visually form logical groups without large unused gaps.

---

## 23. Logical Groups

Treat the toolbar as three conceptual groups:

```text
Stock mutation:
[Stock symbol] [+]

Table presentation:
[Filter by company name]

Allocation:
[Total savings] [Calculate] [Allocated savings]
```

Use spacing to distinguish groups.

Do not add heavy borders/cards around every group unless required for clarity.

---

# Stock Symbol Input

## 24. Compact Width

The Stock Symbol input should be sized for ticker identifiers rather than arbitrary long text.

Target an effective desktop width around:

```text
180–220px
```

or another evidence-based compact width.

Do not make it stretch across the page.

---

## 25. Existing Symbol UX

Preserve TASK-029/TASK-030:

* uppercase normalization;
* syntax validation;
* supported-equity resolution;
* Enter submission;
* button submission;
* error handling;
* no provider request for invalid syntax.

---

## 26. Add Button

Keep the stock-add button compact.

The existing `+` representation is appropriate.

Preserve its accessible label.

---

# Company Filter

## 27. Filter Width

The company-name filter should be wider than the Stock Symbol input because users type names/fragments.

On desktop, an effective width around:

```text
280–400px
```

is appropriate.

Use responsive constraints rather than an inflexible fixed width if possible.

---

## 28. Existing Filter Semantics

Preserve TASK-022:

* immediate local filtering;
* case-insensitive contains;
* name only;
* no API request;
* filter state behavior across mutations/transitions;
* Total/Filtered footer behavior.

---

# Savings Allocation Controls

## 29. Total Savings Input

The Total Savings input should be compact and appropriate for a numeric amount.

Do not make it consume large horizontal space.

Preserve existing parsing/validation semantics.

---

## 30. Calculate Button

Keep:

```text
Calculate
```

as the primary action label.

Use the existing primary-button vocabulary.

---

# Rename Invested

## 31. Replace `Invested`

Rename the result label:

```text
Invested
```

to:

```text
Allocated savings
```

This better describes the value.

The application has not actually executed an investment.

---

## 32. Meaning of Allocated Savings

`Allocated savings` represents:

> The sum of the savings amounts actually distributed across stocks by the current allocation result.

It may be lower than Total Savings because the existing allocation formula floors per-stock amounts and does not redistribute the remainder.

Do not change this calculation.

---

## 33. Example

Conceptually:

```text
Total savings:      1,000
Allocated savings:    997
```

This is valid.

Do not force them to be equal.

---

## 34. No Result Yet

Preserve the existing behavior that allocation-result information is shown only when an allocation has successfully been calculated.

Do not display a misleading:

```text
Allocated savings: 0
```

before any calculation unless that is already required by current semantics.

A successfully calculated true zero remains a real result and must be displayed.

---

# Responsive Toolbar

## 35. Wide Desktop

At wide desktop size, keep the toolbar on one row where practical.

---

## 36. Medium Width

At medium widths, allow logical groups to wrap.

A suitable conceptual layout is:

```text
[Stock symbol] [+]    [Filter by company name]

[Total savings] [Calculate]    Allocated savings: €997
```

Do not require exactly this break if CSS can produce a better natural wrap.

---

## 37. Mobile

At mobile width, controls may stack:

```text
[Stock symbol      ] [+]

[Filter by company name]

[Total savings] [Calculate]

Allocated savings: €997
```

Inputs must remain reachable and readable.

---

## 38. No Page Overflow

Toolbar wrapping must never create page-level horizontal scrolling.

---

# Table Width Strategy

## 39. Table Remains Primary

After the toolbar, the table should begin with minimal unnecessary vertical gap.

---

## 40. Desktop Horizontal Scroll Is Fallback

Refine the previous table-overflow convention:

> Horizontal table scrolling is the fallback for constrained viewports, not the preferred layout on sufficiently wide desktop displays.

This supersedes the earlier acceptance that desktop table scrolling was always acceptable.

---

## 41. Preserve Scroll Container

Do not remove the table's horizontal overflow container.

It is still required for tablet/mobile and exceptional content.

---

# Column Width Strategy

## 42. Content-Aware Widths

Review the current table `min-width` and column behavior.

Allocate width according to content rather than allowing every column to expand similarly.

Conceptually:

```text
Symbol                 compact
Name                   flexible / largest
Market Cap (USD bn)    compact numeric
Price                  compact numeric
Currency               compact
Dividend Yield         compact numeric
Target Price           compact editable
Distance to Target     compact numeric
Savings Amount         compact numeric
Actions                very compact
```

---

## 43. Name Column

The Name column should receive most of the flexible space.

Long company names may wrap or use the existing sensible word-break behavior.

Do not make all other columns unnecessarily wide to accommodate Name.

---

## 44. Numeric Columns

Numeric financial columns should be compact but still comfortably readable with TASK-033's two-decimal formatting.

---

## 45. Currency

Currency requires only enough width for normal currency codes such as:

```text
USD
EUR
GBP
GBp
CHF
SEK
NOK
DKK
```

Do not allocate large flexible width to it.

---

# Target Price Input

## 46. Compact Target Price Cell

Reduce unnecessary width of the Target Price input.

An effective width around:

```text
90–110px
```

is a reasonable starting point.

Use the existing responsive/table structure rather than blindly hardcoding a value.

---

## 47. Editing Usability

The compact Target Price input must still comfortably support values such as:

```text
8
200
210.25
18000
```

and normal editing behavior.

Preserve:

* dot/comma decimal parsing;
* Enter;
* blur save;
* validation;
* error state;
* partial-success state.

---

# Stock Row Action

## 48. Compact Remove Action

Replace the wide visible:

```text
Delete
```

row button with a compact removal control.

Prefer a trash-can symbol/icon if available without adding a dependency.

Do not introduce an icon library solely for this task.

A simple text/symbol solution is acceptable if it is clearer and lighter.

---

## 49. Accessible Remove Action

The compact stock-removal control must have a meaningful accessible name containing the symbol.

Example:

```text
Remove AAPL
```

Preserve the existing no-confirmation behavior for stock removal.

Do not add a confirmation dialog in this task.

---

## 50. Actions Column Width

Reduce the Actions column width accordingly.

---

# Visual Hierarchy

## 51. Avoid Excessive Section Borders

Use spacing and alignment as the primary grouping mechanism.

Do not create a dashboard of nested cards.

---

## 52. Preserve Existing Design Vocabulary

Reuse TASK-025:

* CSS custom properties;
* `.btn`;
* `.btn-primary`;
* `.btn-destructive`;
* `.btn-compact`;
* `.field-input`;
* status/error/warning conventions;
* focus-visible conventions.

Extend this vocabulary only where necessary.

---

## 53. Destructive Semantics

The active-Watchlist `×` remains a destructive action even though visually compact.

Use appropriate hover/focus treatment.

The stock-remove action is also destructive but should remain visually subordinate to primary actions such as Calculate/Add.

---

# Busy State

## 54. Preserve `managementBusy`

Do not redesign request concurrency.

The existing busy serialization remains authoritative.

Relevant controls must continue to disable appropriately during mutations/calculation.

---

## 55. Tab Delete Busy Behavior

The active-tab delete control must respect the same management busy state as the old large Delete-current-Watchlist button.

---

## 56. Create Controls Busy Behavior

Moving Watchlist creation into the tab row must not alter its disabled/busy semantics.

---

# Errors and Warnings

## 57. Preserve Error Behavior

Moving controls must not remove or hide their existing errors.

Errors must remain visually associated with the relevant workflow.

Examples:

* Watchlist create failure;
* stock-add failure;
* allocation failure;
* Target Price row failure.

---

## 58. Avoid Layout Explosion

Error messages may occupy an additional row when needed.

Do not reserve large permanent empty areas for errors when no error exists.

---

# Empty States

## 59. No Watchlists

Preserve the existing no-Watchlists empty state.

The create-Watchlist control remains available.

---

## 60. Empty Active Watchlist

Preserve:

```text
This watchlist is empty.
```

or current equivalent.

Stock-add controls remain available.

---

## 61. Filtered Empty State

Preserve:

```text
No stocks match the current filter.
```

and its distinction from a genuinely empty Watchlist.

---

# Accessibility

## 62. Labels

All inputs retain accessible labels.

Compact layout must not turn the application into placeholder-only forms.

Visible labels may be arranged compactly, but semantic label association must remain.

---

## 63. Tab Delete Keyboard Access

The active-tab delete control must be keyboard reachable.

Do not make it a mouse-only pseudo-element.

---

## 64. Tab Semantics

Do not break:

```text
tablist
tab
aria-selected
```

semantics by embedding the delete control incorrectly.

If nesting an interactive button inside the existing tab button would create invalid HTML/accessibility behavior, structure the active-tab wrapper so the tab selector and delete button are sibling interactive controls.

This is important.

---

## 65. Focus

Preserve the global `:focus-visible` behavior for:

* tabs;
* tab delete;
* inputs;
* add buttons;
* Calculate;
* stock remove action.

---

# Component Structure

## 66. Avoid Monolithic Page Growth

`+page.svelte` is already responsible for substantial orchestration.

If the new toolbar/tab-management presentation becomes large enough to reduce readability, extract small presentational components.

Possible boundaries include:

```text
Watchlist management/tab toolbar
Stock workspace toolbar
```

Do not extract components solely to satisfy this suggestion.

Choose based on actual readability.

---

## 67. Keep Business State in Page

Do not move orchestration/business state into presentational components merely as part of layout cleanup.

Existing page/shell responsibilities remain.

---

# Unit Tests

## 68. No New Business Tests Required

This task should not require new financial/domain tests.

Do not duplicate existing business coverage.

---

## 69. Component/Helper Tests

Add unit tests only for new pure helpers if such helpers are introduced.

Do not add trivial tests for CSS constants.

---

# Playwright E2E

## 70. Permanent Coverage

This task is strongly visual/responsive.

Permanent Playwright coverage is mandatory.

Prefer updating/expanding:

```text
tests/e2e/ui-polish.spec.ts
tests/e2e/responsive-layout.spec.ts
tests/e2e/watchlist-management.spec.ts
tests/e2e/stock-management.spec.ts
tests/e2e/investment-allocation.spec.ts
```

according to responsibility.

Do not create a temporary-only verification script as the sole evidence.

---

# E2E — Watchlist Header

## 71. Duplicate Name Removed

Verify the active Watchlist name is represented by its tab and is not duplicated as a standalone workspace heading below the stock-add area.

Use semantic assertions rather than brittle CSS selectors where practical.

---

## 72. Active Tab Delete

Verify the active Watchlist exposes a compact delete control adjacent to the active tab.

---

## 73. Inactive Tab

Verify inactive tabs do not incorrectly expose the active-Watchlist delete control.

---

## 74. Delete Accessible Name

Verify the delete control has a name equivalent to:

```text
Remove watchlist "<name>"
```

---

## 75. Delete Confirmation

Verify:

* click compact delete;
* confirmation appears;
* cancel sends no DELETE;
* confirm preserves existing DELETE workflow.

Existing management tests may already cover most semantics; adapt them to the new control rather than duplicating unnecessarily.

---

# E2E — Create Watchlist

## 76. Tab-Row Creation

Verify Watchlist creation remains functional after moving the input/button into the tab area.

---

## 77. Enter Submission

Preserve one-request Enter submission behavior.

---

## 78. Create Failure

Preserve entered text and existing Watchlist state on failure.

---

# E2E — Workspace Toolbar

## 79. Desktop Grouping

At wide desktop size, verify Stock Symbol, Filter, Total Savings, Calculate, and Allocated Savings occupy the compact workspace-toolbar area above the table.

Do not assert exact pixel coordinates unless necessary.

Prefer structural/bounding-box relationships with reasonable tolerance.

---

## 80. Allocated Savings Label

After successful calculation, verify:

```text
Allocated savings
```

is displayed.

Verify the old:

```text
Invested
```

label is absent.

---

## 81. True Zero Allocation

A successfully calculated:

```text
allocated savings = 0
```

must still display as a real result.

---

## 82. No Result Yet

Before calculation, do not display a misleading allocation result.

---

# E2E — Stock Remove Action

## 83. Compact Row Action

Verify each row exposes a compact remove control rather than the old wide Delete button presentation.

---

## 84. Accessible Row Action

Verify a representative row has an accessible name such as:

```text
Remove AAPL
```

---

## 85. Removal Behavior

Existing stock-removal semantics must remain intact.

---

# Responsive Viewports

## 86. Required Viewports

Verify the complete workspace at:

```text
375px
768px
1280px
1600px
```

Use appropriate height values sufficient to inspect the workspace.

---

## 87. 1600px

At 1600px:

* controls should be compact;
* table should receive most available width;
* normal deterministic 10-column fixture should fit without horizontal table scrolling;
* no page-level horizontal overflow.

This is a key acceptance criterion.

---

## 88. 1280px

At 1280px:

* layout remains compact;
* toolbar may remain one row or wrap naturally;
* no page-level horizontal overflow;
* table scrolling is allowed if genuinely required.

---

## 89. 768px

At 768px:

* toolbar groups wrap coherently;
* controls remain usable;
* tabs remain usable;
* table scroll is contained internally;
* no page-level overflow.

---

## 90. 375px

At 375px:

* Watchlist creation remains reachable;
* tabs remain usable;
* active-tab delete remains usable;
* Stock Symbol input remains usable;
* filter remains usable;
* Total Savings/Calculate remain usable;
* Allocated Savings remains readable;
* table scroll is internal;
* page itself does not overflow horizontally.

---

# Horizontal Overflow Assertions

## 91. Page Overflow

At all required viewports assert conceptually:

```text
document.documentElement.scrollWidth
<=
document.documentElement.clientWidth
```

allowing only negligible browser rounding tolerance if necessary.

---

## 92. Desktop Table Fit

At 1600px with the deterministic normal fixture assert:

```text
tableContainer.scrollWidth
<=
tableContainer.clientWidth
```

within reasonable rounding tolerance.

---

## 93. Mobile Table Scroll

At 375px assert:

```text
tableContainer.scrollWidth
>
tableContainer.clientWidth
```

The table should remain horizontally scrollable internally.

---

# Visual Verification

## 94. Screenshots

Perform manual screenshot review at:

```text
375
768
1280
1600
```

for the completed populated workspace.

Use the project's persistent Playwright infrastructure where practical.

Temporary diagnostics may be used during implementation but must not be the only verification and must not remain in the repository.

---

## 95. Review Criteria

Inspect screenshots for:

* wasted horizontal space;
* excessive vertical gaps;
* awkward wrapping;
* oversized inputs;
* inaccessible actions;
* table dominance;
* clipped labels;
* overlap;
* page-level overflow;
* visual consistency.

---

# Architecture Documentation

## 96. Compact Workspace Rule

Update `ARCHITECTURE.md` to state that the Watchlist UI is a data-first financial workspace.

Controls should remain compact so the table receives priority.

---

## 97. Responsive Strategy

Document:

```text
wide desktop
→ compact mostly-horizontal controls
→ table normally fits without horizontal scrolling

medium/tablet
→ logical toolbar wrapping
→ table may scroll internally

mobile
→ stacked/wrapped controls
→ table scrolls internally
→ no page-level overflow
```

---

## 98. Table Overflow Evolution

Document that TASK-034 refines the earlier table-overflow decision:

```text
horizontal table scrolling
→ fallback for constrained width

not
→ preferred behavior on wide desktop
```

Do not rewrite the historical decision as though it never existed.

---

## 99. Allocated Savings Terminology

Document the UI terminology:

```text
Allocated savings
```

means the sum of the calculated per-stock savings allocations.

It does not mean an investment transaction has occurred.

---

# Historical Task Notes

## 100. TASK-019

If useful, add a concise note that TASK-034 later moved Watchlist creation into the tab-management area and replaced the large delete button with an active-tab delete control.

Keep status Done.

---

## 101. TASK-024

If useful, add a concise note that TASK-034 renamed the UI label `Invested` to `Allocated savings` without changing the calculation.

Keep status Done.

---

## 102. TASK-025

If useful, note that TASK-034 intentionally revises the earlier acceptance of desktop table scrolling by widening/compacting the workspace.

Do not rewrite TASK-025.

---

# README

## 103. README

No README change is required unless it contains obsolete UI terminology such as `Invested`.

Do not add detailed layout documentation to the project introduction.

---

# No Server Changes

## 104. Server

No changes should normally be required under:

```text
src/lib/server/
```

Do not modify server behavior to support layout.

---

## 105. API

Do not rename:

```text
invested
```

in the REST response solely because the UI label becomes:

```text
Allocated savings
```

The task changes presentation terminology, not the API contract.

---

## 106. Persistence

Do not modify persistence.

---

# Non-Goals

Do NOT implement:

* financial formula changes;
* REST contract changes;
* persistence changes;
* Watchlist renaming;
* drag-and-drop tabs;
* drag-and-drop stock rows;
* tab reordering;
* custom modal framework;
* stock delete confirmation;
* new table columns;
* pagination;
* mobile card layout;
* sidebar navigation;
* new icon library;
* authentication changes;
* production deployment;
* unrelated V3 improvements.

---

# Acceptance Criteria

The task is complete when all of the following are true:

1. Stock table is visually prioritized.
2. Unnecessary vertical whitespace above the table is reduced.
3. Wide desktop page uses substantially more available width.
4. Duplicate active Watchlist name is removed.
5. Active tab remains sufficient workspace identification.
6. Large standalone Delete-current-Watchlist button is removed.
7. Active Watchlist has a compact adjacent delete control.
8. Inactive tabs do not expose that active delete control.
9. Watchlist delete has a meaningful accessible name.
10. Watchlist deletion still requires confirmation.
11. Watchlist creation is integrated with the tab area.
12. Create behavior remains unchanged.
13. Many tabs remain usable.
14. Long tab names do not cause page overflow.
15. Primary table controls are consolidated into a responsive toolbar.
16. Stock Symbol input is compact.
17. Stock-add behavior remains unchanged.
18. Company filter has an appropriate wider size.
19. Filtering behavior remains unchanged.
20. Total Savings input is compact.
21. Calculate behavior remains unchanged.
22. `Invested` UI terminology is replaced by `Allocated savings`.
23. API field `invested` remains unchanged.
24. Allocated Savings accurately represents the existing calculation result.
25. True zero allocation remains visible after calculation.
26. No misleading result appears before calculation.
27. Toolbar is mostly horizontal on wide desktop.
28. Toolbar wraps logically at medium widths.
29. Toolbar remains usable at mobile width.
30. No toolbar layout causes page-level overflow.
31. Table remains immediately below the workspace controls.
32. Table scroll container remains.
33. Horizontal table scroll is a fallback rather than preferred wide-desktop behavior.
34. Normal deterministic table fits at 1600px without horizontal scrolling.
35. 1280px layout remains usable.
36. 768px layout remains usable.
37. 375px layout remains usable.
38. Page itself does not horizontally overflow at required viewports.
39. Mobile table remains internally horizontally scrollable.
40. Table columns use content-aware widths.
41. Name receives flexible width.
42. Numeric columns remain compact/readable.
43. Currency column remains compact.
44. Target Price input is more compact.
45. Target Price editing behavior remains unchanged.
46. Stock row remove action becomes compact.
47. Stock remove action has meaningful accessible name.
48. Stock-removal semantics remain unchanged.
49. Actions column becomes correspondingly compact.
50. Existing CSS vocabulary is reused.
51. No unnecessary icon dependency is introduced.
52. Busy-state behavior remains intact.
53. Error/warning behavior remains intact.
54. Empty states remain intact.
55. Input labels remain accessible.
56. Tab semantics remain valid.
57. Tab delete is keyboard accessible.
58. Focus-visible behavior remains intact.
59. No financial/domain calculations change.
60. No REST/API contract changes.
61. No persistence changes.
62. Existing business unit tests remain green.
63. Permanent E2E covers active-tab deletion.
64. Permanent E2E covers Watchlist creation in new layout.
65. Permanent E2E covers Allocated Savings terminology.
66. Permanent E2E covers compact stock removal.
67. Responsive E2E covers 375px.
68. Responsive E2E covers 768px.
69. Responsive E2E covers 1280px.
70. Responsive E2E covers 1600px.
71. E2E verifies no page-level horizontal overflow.
72. E2E verifies no table overflow at 1600px normal fixture.
73. E2E verifies internal table overflow at 375px.
74. Screenshots are manually reviewed at all required viewport widths.
75. `ARCHITECTURE.md` documents the compact workspace strategy.
76. Historical task context is preserved where appropriate.
77. Existing project checks pass.
78. No unnecessary production dependency is added.
79. No production deployment occurs.

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

1. active Watchlist name appears only in the tab/workspace identification;
2. active tab has compact delete control;
3. inactive tabs do not;
4. delete confirmation still works;
5. Watchlist creation works from the tab area;
6. stock-add workflow remains functional;
7. filter workflow remains functional;
8. Total Savings calculation remains functional;
9. result label says `Allocated savings`;
10. true zero result displays correctly;
11. Target Price editing remains functional;
12. compact stock remove control works;
13. page width/overflow at 375px;
14. page width/overflow at 768px;
15. page width/overflow at 1280px;
16. page width/overflow at 1600px;
17. normal table fixture does not horizontally scroll at 1600px;
18. table does horizontally scroll internally at 375px;
19. no page-level horizontal overflow at any required viewport;
20. screenshot review at all four required widths.

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
2. previous workspace layout;
3. final desktop workspace structure;
4. final medium-width behavior;
5. final mobile behavior;
6. final page max-width/width strategy;
7. duplicate Watchlist-name removal;
8. final active-tab delete design;
9. tab-delete accessibility behavior;
10. Watchlist-create placement;
11. many-tabs/long-name behavior;
12. final workspace-toolbar structure;
13. Stock Symbol sizing;
14. Filter sizing;
15. Total Savings sizing;
16. `Allocated savings` terminology/result behavior;
17. table width/overflow strategy;
18. 1600px table-fit result;
19. 1280px result;
20. 768px result;
21. 375px result;
22. Target Price input sizing;
23. final stock-remove action;
24. busy-state preservation;
25. error/warning preservation;
26. accessibility verification;
27. unit tests added/changed;
28. Playwright tests added/changed;
29. screenshot-review results;
30. `ARCHITECTURE.md` changes;
31. historical task notes;
32. README changes, if any;
33. results of `test`, `test:e2e`, `check`, `lint`, and `build`;
34. confirmation no server/API/persistence changes occurred;
35. confirmation no financial calculations changed;
36. confirmation no production deployment occurred;
37. confirmation task status changed to Done;
38. assumptions or unresolved issues;
39. deviations from this task or `ARCHITECTURE.md`.

Do not proceed to another V3 improvement.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
