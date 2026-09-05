# TASK-025: Final UI States, Accessibility and Responsive Polish

## Status

Done

## Goal

Perform the final V1 UI quality pass over the complete Watchlist application.

All planned V1 business functionality is already implemented.

This task introduces **no new business feature**.

Its purpose is to review the application as a complete user workflow and improve consistency in:

* visual hierarchy;
* spacing and layout;
* forms and buttons;
* loading/busy states;
* error presentation;
* warning presentation;
* empty states;
* table readability;
* responsive behavior;
* keyboard accessibility;
* semantic accessibility;
* permanent Playwright regression coverage.

The application should feel like one coherent small product rather than a sequence of independently implemented UI tasks.

Do not redesign the application.

Do not change business rules.

---

## Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* this task completely

The complete V1 UI currently includes:

```text
Application shell
Watchlist tabs

Watchlist management
├── create Watchlist
└── delete active Watchlist + confirmation

Stock management
├── add stock
└── remove stock

Stock table
├── Symbol
├── Name
├── Cap (USD)
├── Price
├── Div
├── Currency
├── Target Price
├── Distance to Target
├── Savings Amount
└── Delete

Target Price editing

Company-name filtering
Stock counts

Table sorting

Investment allocation
├── Total Savings
├── Calculate
├── Savings Amount
└── Invested
```

Permanent Playwright coverage already exists for the individual feature areas.

This task should work with the existing architecture rather than replacing it.

---

# General Principle

## 1. No New Business Functionality

Do NOT add new product features.

In particular, do not introduce:

* Watchlist rename;
* Watchlist reorder;
* stock autocomplete;
* additional market data;
* automatic investment recalculation;
* Target Price deletion;
* allocation persistence;
* additional filtering;
* multi-column sorting;
* user settings;
* themes;
* dark mode;
* dashboards.

This is a polish task.

---

## 2. No Broad Refactor

Do not perform large architectural refactors merely because the application is now complete.

Existing working boundaries such as:

```text
+page.svelte
client orchestration
client API
presentational components
server API
```

should remain intact.

Small extraction is acceptable only when it directly improves UI consistency or readability required by this task.

---

# Full UI Review

## 3. Review the Complete Page

Run the application and inspect the complete page rather than individual components in isolation.

Review at least:

```text
application title
Watchlist creation controls
Watchlist tabs
Watchlist delete control
stock-add controls
filter
investment-allocation controls
warnings/errors
stock table
counts
```

Evaluate whether these elements form a coherent hierarchy.

---

## 4. Functional Grouping

Controls with related purposes should appear visually grouped.

Conceptually:

```text
Watchlist
────────────────────────────────────

[ Watchlist name ] [+]       [ Delete current ]

[ Main ] [ Dividend ] [ Tech ]

[ Stock symbol ] [+]     [ Filter by company name ]

[ Total savings ] [ Calculate ]    Invested: 997 €

┌───────────────────────────────────────────────┐
│ Stock table                                   │
└───────────────────────────────────────────────┘

3 stocks
```

This is illustrative, not a mandatory pixel layout.

Use judgment to improve grouping without redesigning the application.

---

## 5. Visual Hierarchy

Ensure the page clearly distinguishes:

* application title;
* Watchlist navigation;
* Watchlist controls;
* stock/table controls;
* investment controls;
* table content;
* status/error/warning information.

Avoid making every control visually equal in prominence.

Do not introduce elaborate branding.

---

# Consistent Form Controls

## 6. Input Consistency

Review all inputs:

```text
Watchlist name
Stock symbol
Filter by company name
Total savings
Target Price
```

Ensure reasonable consistency in:

* height;
* border;
* border radius if used;
* typography;
* focus state;
* disabled state.

Target Price inputs may remain more compact because they live inside table cells.

---

## 7. Button Consistency

Review:

```text
Add Watchlist
Delete Watchlist
Add Stock
Calculate
Remove Stock
sortable headers
```

Use a small coherent button vocabulary.

Do not create a component library solely for this.

Reasonable visual distinctions may include:

```text
primary action
normal/secondary action
destructive action
compact table action
```

Keep styling simple.

---

## 8. Destructive Actions

Watchlist deletion and stock removal are destructive actions.

They should be visually identifiable as destructive without overwhelming the page.

Watchlist deletion continues to require confirmation.

Stock removal continues to require no confirmation.

Do not change those business interaction rules.

---

## 9. Disabled State

Disabled controls must look and behave disabled.

Do not rely only on:

```text
cursor: not-allowed
```

or color.

Use native `disabled` semantics where applicable.

---

## 10. Focus State

All interactive controls must retain a clearly visible keyboard focus state.

Review:

* text inputs;
* buttons;
* tabs;
* sortable table headers;
* Target Price inputs.

Do not remove browser focus outlines without a suitable replacement.

---

# Loading and Busy States

## 11. Initial Loading

Review the initial:

```text
Loading watchlists…
```

state.

Ensure it is visually clear and does not resemble an error or empty state.

Do not introduce a skeleton library.

---

## 12. Active Watchlist Loading

When switching Watchlists, preserve the established state semantics.

Ensure the content loading indication is clear.

Do not regress the race protection established in TASK-016.

---

## 13. Mutation Busy States

Review busy behavior for:

* Watchlist creation;
* Watchlist deletion;
* stock addition;
* stock removal;
* Target Price persistence;
* investment allocation.

Ensure controls cannot produce duplicate requests.

Do not introduce spinners everywhere merely for decoration.

A disabled button/input and concise busy text/state is sufficient.

---

## 14. Busy Consistency

Where practical, use consistent language/state treatment for operations in progress.

Avoid a mixture such as:

```text
Loading...
Please wait
Saving...
Working
```

without reason.

Use operation-specific text only where it improves clarity.

---

# Errors

## 15. Error Presentation

Review all client-visible error paths.

Errors should:

* be understandable;
* be visually identifiable;
* not expose implementation details;
* not destroy unrelated usable UI state.

Use the stable API messages already provided by the backend/client API layer.

---

## 16. Error Consistency

Avoid different visual error patterns for every feature.

Where practical, establish one small consistent application error presentation.

This may be a reusable CSS class or small component if justified.

Do not introduce a notification/toast framework.

---

## 17. Local Validation vs Server Errors

Keep local input validation visually associated with the relevant input.

Examples:

```text
Target Price invalid
Total Savings invalid
```

Broader API failures may use the existing page/operation error presentation.

Do not move every validation message into a global banner.

---

## 18. Error Recovery

Verify a successful subsequent operation clears stale relevant errors.

Examples:

```text
failed stock add
→ later successful stock add
→ old error gone
```

```text
invalid Target Price
→ corrected and saved
→ validation error gone
```

Do not leave obsolete error messages visible.

---

# Warnings

## 19. Warning Presentation

Review warnings returned with composed Watchlist data.

At minimum this includes:

```text
FX_PROVIDER_UNAVAILABLE
```

and Target Price partial-success warnings such as:

```text
MARKET_DATA_UNAVAILABLE
```

where applicable.

Warnings are not fatal errors.

Present them distinctly from errors.

---

## 20. Warning Meaning

A warning should communicate that:

```text
some data is temporarily unavailable
```

while the rest of the Watchlist remains usable.

Do not style warnings as if the entire operation failed.

---

## 21. Warning Consistency

Use one coherent warning presentation pattern.

Avoid raw warning codes as the only visible user-facing text if a readable message is already available.

Stable codes remain useful internally/tests.

---

# Empty States

## 22. No Watchlists

Review:

```text
No watchlist has been created yet.
```

Ensure the state is understandable and visually connected to the Watchlist creation control.

Do not add a fake Watchlist.

---

## 23. Empty Watchlist

Review:

```text
This watchlist is empty.
```

Ensure the stock-add control remains discoverable.

Do not render an empty table.

---

## 24. Filtered Empty State

Review:

```text
No stocks match the current filter.
```

Ensure it remains clearly distinct from an actually empty Watchlist.

The count:

```text
0 of N stocks
```

must remain visible.

---

## 25. Pre-Allocation State

Savings Amount cells display:

```text
—
```

before calculation.

Do not change this to zero.

Invested must remain absent/neutral until an explicit calculation succeeds.

---

# Table Polish

## 26. Table Readability

Review the complete ten-column table:

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

Improve readability where necessary through:

* spacing;
* alignment;
* header distinction;
* reasonable column widths;
* line wrapping.

Do not introduce excessive decoration.

---

## 27. Numeric Alignment

Ensure numeric columns remain consistently aligned:

```text
Cap (USD)
Price
Div
Target Price
Distance to Target
Savings Amount
```

Target Price input alignment should fit naturally with other numeric values.

---

## 28. Text Alignment

Review:

```text
Symbol
Name
Currency
```

for consistent readable alignment.

---

## 29. Header Buttons

Sortable header buttons must remain visually identifiable as sortable without looking like unrelated primary action buttons.

The active direction indicator must remain visible.

Preserve:

```text
aria-sort
```

semantics.

---

## 30. Delete Column

Keep the Delete column compact.

Row Delete buttons must remain understandable and keyboard accessible.

Do not make destructive controls dominate the table visually.

---

## 31. Long Names

Verify long company names wrap or size sensibly without making the rest of the table unusable.

Do not truncate important information unnecessarily.

---

# Responsive Review

## 32. Required Viewports

Perform visual/browser review at least at:

```text
375px
768px
1280px
```

viewport widths or close equivalents.

These represent:

* narrow mobile;
* intermediate/tablet-like;
* desktop.

---

## 33. Mobile Layout

At approximately 375px:

* application title fits;
* Watchlist management controls remain usable;
* tabs remain usable;
* stock-add control remains usable;
* filter remains usable;
* Total Savings/Calculate remain usable;
* Invested remains readable;
* table scrolls inside its own container;
* page itself does not horizontally overflow.

---

## 34. Intermediate Layout

At approximately 768px:

Review whether controls wrap naturally.

Avoid awkward layouts that are neither compact mobile nor spacious desktop.

Do not add breakpoints without an observed need.

---

## 35. Desktop Layout

At approximately 1280px:

Ensure the page uses space sensibly.

Do not stretch controls unnecessarily across the entire viewport.

Maintain a readable content width while allowing the table sufficient space.

---

## 36. Table Horizontal Scrolling

Preserve the established mobile strategy:

```text
page fixed to viewport
table container horizontally scrollable
```

Do not replace it with:

* mobile cards;
* hidden columns;
* responsive column removal.

---

## 37. Touch Targets

On mobile, interactive controls should remain reasonably usable by touch.

Review:

* tab buttons;
* add buttons;
* Calculate;
* Delete buttons;
* Target Price inputs.

Do not make compact desktop styling unusably small on mobile.

---

# Accessibility Review

## 38. Semantic Structure

Review heading structure and landmark semantics.

The application should have a clear main heading.

Do not add unnecessary ARIA where semantic HTML already provides the correct behavior.

---

## 39. Labels

Verify every editable input has an accessible name:

```text
Watchlist name
Stock symbol
Filter by company name
Total savings
Target price for <symbol>
```

---

## 40. Tabs

Preserve:

```text
role="tablist"
role="tab"
aria-selected
```

or the existing equivalent accessible implementation.

Do not regress keyboard focusability.

---

## 41. Table

Preserve semantic:

```text
table
thead
tbody
th
td
```

and:

```text
aria-sort
```

for sortable headers.

---

## 42. Status Messages

Loading, error, validation, and warning messages should be discoverable by assistive technology where practical.

Use:

```text
role="alert"
aria-live
```

only where appropriate.

Avoid making every changing count or table update an aggressive live announcement.

---

## 43. Color Independence

No important state should be communicated through color alone.

This includes:

* active tab;
* error;
* warning;
* destructive action;
* sort direction;
* invalid input.

---

# Browser E2E Regression Pass

## 44. Existing E2E Suite

Do not replace the existing focused E2E specs.

They remain the primary behavioral regression suite.

Review failures caused by polish changes and update selectors only when the accessible/UI contract intentionally changed.

Do not weaken assertions merely to make tests pass.

---

## 45. Add Final UI Spec

Create:

```text
tests/e2e/ui-polish.spec.ts
```

for cross-feature UI-state behavior that does not naturally belong to one existing feature spec.

Keep it small.

Do not duplicate all existing E2E coverage.

---

## 46. E2E: Complete Populated View

Render deterministic data representing a realistic populated application:

```text
multiple Watchlist tabs
multiple stocks
Target Prices
positive/negative distances
Savings Amounts after calculation
stock counts
```

Verify the major page regions and controls coexist without regression.

Do not assert exact pixel coordinates.

---

## 47. E2E: Warning vs Error

Provide deterministic API states demonstrating:

```text
warning
```

and:

```text
error
```

Verify they are visually/semantically distinguishable.

Do not rely only on color assertions.

---

## 48. E2E: Error Recovery

Exercise at least one representative recoverable failure.

For example:

```text
stock add fails
→ error visible
→ retry succeeds
→ stale error disappears
```

Use whichever existing flow best represents the current error architecture.

---

## 49. E2E: Keyboard Smoke Flow

Using Playwright keyboard interaction, verify a representative workflow without pointer-only assumptions.

For example:

```text
Tab to Stock symbol
type symbol
Enter
Tab/focus relevant control
```

or another deterministic interaction.

Do not attempt a full formal WCAG audit.

---

## 50. E2E: 375px Complete Page

At mobile width, use a representative populated state and verify:

```text
document.documentElement.scrollWidth
<=
document.documentElement.clientWidth
```

while the stock table itself remains horizontally scrollable.

This should test the complete page with all V1 controls present.

---

## 51. E2E: 768px Complete Page

Add an intermediate-width regression check.

Verify controls remain visible and no page-level horizontal overflow occurs.

Do not assert exact layout geometry unless necessary.

---

## 52. E2E: 1280px Complete Page

Verify the complete populated page renders correctly at desktop width.

---

# Playwright Parallelism

## 53. Observe Existing Flakiness

TASK-023/TASK-024 observed intermittent Playwright failures under high parallel load that disappear with reduced worker count.

During this task, investigate only enough to determine whether the configured default E2E execution is reliable.

Do not turn this task into a large Playwright infrastructure investigation.

---

## 54. Worker Limit

If the full E2E suite remains demonstrably flaky solely because Playwright launches too many parallel workers for the local environment, set a reasonable explicit worker limit in:

```text
playwright.config.ts
```

A value such as:

```text
4
```

is acceptable if verified stable.

The exact value must be evidence-based.

Do not reduce workers merely because previous reports mentioned flakiness; reproduce the issue first if practical.

---

## 55. Do Not Hide Real Failures

Do not:

* add broad retries;
* skip failing product tests;
* weaken assertions;
* increase arbitrary timeouts

solely to make the suite green.

If a genuine product race is discovered, fix the product behavior.

If a genuine test race is discovered, fix the test.

---

# CSS Organization

## 56. Reuse Existing CSS

Prefer consolidating repeated visual patterns through small existing/global classes where appropriate.

Do not introduce:

* Tailwind;
* Sass;
* CSS-in-JS;
* CSS Modules framework;
* design-token system.

---

## 57. Global CSS

Keep global CSS limited to genuinely shared concerns.

Do not move all component styling into `app.css`.

Component-specific layout should remain near its component where practical.

---

## 58. No CSS Reset Dependency

Do not add a third-party CSS reset/normalize package.

The existing small global baseline is sufficient unless a concrete browser issue is found.

---

# Architecture and Code Quality

## 59. Client Business Logic

Confirm that final polish does not introduce client-side business calculations.

The client must still NOT calculate:

* dividend yield;
* market-cap conversion;
* Target Price distance;
* investment factors;
* savings allocation;
* invested total.

---

## 60. External Access

Browser code must still access data only through the application REST API.

Do not introduce direct browser calls to:

* Yahoo;
* Frankfurter;
* KV.

---

## 61. Mutation Semantics

Do not change established behavior:

```text
successful business mutation
→ update UI

failed mutation
→ preserve prior valid state

successful relevant mutation
→ invalidate stale allocation

filter/sort
→ presentation only
```

---

# Documentation

## 62. Architecture Documentation

Update `ARCHITECTURE.md` only if final polish establishes a durable UI convention not already documented.

Possible durable conventions include:

* shared visual distinction between errors and warnings;
* final responsive control grouping;
* explicit V1 viewport/responsive strategy;
* final busy-state convention.

Do not add a large visual-design specification.

If no architectural clarification is necessary, leave `ARCHITECTURE.md` unchanged and report that decision.

---

## 63. README

Update README only if:

* developer commands change;
* Playwright worker configuration changes in a way developers should know about.

Do not add end-user documentation merely for visual polish.

---

# Non-Goals

Do NOT implement:

* new business features;
* new REST endpoints;
* Watchlist rename/reorder;
* Target Price delete;
* stock autocomplete;
* additional filters;
* multi-column sorting;
* allocation persistence/history;
* automatic allocation recalculation;
* themes;
* dark mode;
* mobile cards;
* table pagination;
* table virtualization;
* toast framework;
* modal framework;
* component library;
* CSS framework;
* production deployment.

Production deployment belongs to TASK-026.

---

# Acceptance Criteria

The task is complete when all of the following are true:

1. No new business feature is introduced.
2. Complete page layout has been reviewed as one application.
3. Related controls are visually grouped coherently.
4. Application title/navigation/content hierarchy is clear.
5. Inputs have consistent baseline styling.
6. Buttons have consistent baseline styling.
7. Destructive actions remain identifiable.
8. Disabled states are clear.
9. Keyboard focus remains clearly visible.
10. Initial loading state is clear.
11. Active-Watchlist loading state remains correct.
12. Mutation busy states prevent duplicate/conflicting requests.
13. Error presentation is consistent.
14. Local validation remains associated with relevant inputs.
15. Stale errors clear after successful recovery.
16. Warning presentation is distinguishable from errors.
17. Warnings do not imply total operation failure.
18. No-Watchlists state remains clear.
19. Empty-Watchlist state remains clear.
20. Filtered-empty state remains distinct.
21. Pre-allocation state remains distinct from calculated zero.
22. Ten-column table remains readable.
23. Numeric alignment remains consistent.
24. Sort controls remain visually/accessibly understandable.
25. Delete column remains compact.
26. Long company names do not break layout.
27. 375px complete page has no page-level horizontal overflow.
28. 768px complete page has no page-level horizontal overflow.
29. 1280px complete page renders coherently.
30. Table remains independently horizontally scrollable where needed.
31. Mobile controls remain usable by touch.
32. Every input retains an accessible name.
33. Tabs retain accessible semantics.
34. Table retains semantic markup.
35. Sort state remains accessible through `aria-sort`.
36. Important states are not communicated through color alone.
37. Existing focused E2E specs remain.
38. New `ui-polish.spec.ts` contains only useful cross-feature regression coverage.
39. Complete populated page has E2E coverage.
40. Warning/error distinction has E2E coverage.
41. At least one error-recovery flow has E2E coverage.
42. Representative keyboard interaction has E2E coverage.
43. Complete mobile page has E2E overflow coverage.
44. Intermediate-width page has E2E coverage.
45. Desktop complete page has E2E coverage.
46. Existing E2E assertions are not weakened merely for polish.
47. Playwright default parallelism is reviewed.
48. Worker limit is changed only if supported by observed evidence.
49. Broad retries/skips are not introduced to hide failures.
50. No client-side business calculation is introduced.
51. No direct browser provider/KV access is introduced.
52. Existing mutation/invalidation semantics remain intact.
53. Existing project checks pass.
54. `ARCHITECTURE.md` remains consistent with final UI conventions.
55. No unnecessary production dependency is introduced.
56. No production deployment work is performed.

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

Also verify the complete populated UI at approximately:

```text
375px
768px
1280px
```

Use permanent Playwright tests for repeatable browser behavior.

A short manual browser inspection is appropriate for visual judgment that does not benefit from brittle automated assertions.

Do not create temporary external Playwright scripts for repeatable behavior that belongs in the permanent E2E suite.

If Playwright parallelism is changed, execute the full E2E suite multiple times with the final configuration to establish that it is materially more reliable.

Do not report a verification step as successful unless it was actually executed successfully.

---

# Task Status

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

# Completion Report

When finished, report:

1. files added or changed;
2. overall visual/layout changes;
3. control-grouping decisions;
4. input/button consistency changes;
5. loading/busy-state changes;
6. error-presentation changes;
7. warning-presentation changes;
8. empty-state changes;
9. table readability changes;
10. responsive changes;
11. 375px verification;
12. 768px verification;
13. 1280px verification;
14. accessibility improvements;
15. keyboard verification;
16. permanent E2E scenarios added;
17. existing E2E tests adjusted and why;
18. Playwright parallelism investigation result;
19. Playwright configuration changes, if any;
20. confirmation that no tests were weakened/skipped to hide failures;
21. manual visual-review result;
22. changes made to `ARCHITECTURE.md`, if any;
23. README changes, if any;
24. results of `test`, `test:e2e`, `check`, `lint`, and `build`;
25. confirmation that no business functionality/API behavior was added;
26. confirmation that no client-side business calculation was introduced;
27. confirmation that no production deployment work was performed;
28. confirmation that this task's status was changed to `Done`;
29. assumptions or unresolved issues;
30. deviations from this task or `ARCHITECTURE.md`.

Do not proceed to production deployment.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
