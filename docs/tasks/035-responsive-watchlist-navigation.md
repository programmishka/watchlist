# TASK-035: Responsive Watchlist Navigation

## Status

Ready

## Goal

Replace the horizontally scrolling Watchlist tab strip with responsive navigation that guarantees:

> **The active Watchlist is always visible. Inactive Watchlists may move into an overflow menu.**

TASK-034 compacted Watchlist management into a single tab/create row. This significantly improved workspace density, but production-like testing with many Watchlists exposed a navigation problem:

```text
many Watchlists
        ↓
tab strip becomes wider than available space
        ↓
horizontal tab scrolling
        ↓
newly activated Watchlist may be outside the visible area
        ↓
user cannot immediately see which Watchlist is active
```

This is especially problematic because TASK-034 deliberately removed the duplicate active-Watchlist heading. The active navigation item is now the primary indication of the current workspace.

Horizontal scrolling is therefore no longer an acceptable primary overflow strategy for Watchlist navigation.

The new navigation model is:

```text
visible Watchlists
+
active Watchlist always visible
+
overflow menu for additional inactive Watchlists
+
fixed Watchlist-creation area
```

Conceptually on wide/medium screens:

```text
[Dividend] [Growth] [Current ×] [Value] [More ▾]    [New watchlist name] [+]
```

On narrow/mobile screens:

```text
[Current ×] [Watchlists ▾]

[New watchlist name] [+]
```

or an equivalent compact responsive arrangement.

This task also fixes the visual centering of the active-Watchlist `×` delete control introduced by TASK-034.

This is a client-side navigation/interaction task.

Do not change Watchlist persistence, server selection semantics, APIs, authentication, stock-table behavior, or business calculations.

---

# Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* TASK-016;
* TASK-019;
* TASK-023;
* TASK-032;
* TASK-034;
* current `WatchlistTabs.svelte`;
* current Watchlist management code in `+page.svelte`;
* current `app.css`;
* existing Watchlist-management/tab Playwright tests;
* responsive-layout/UI-polish Playwright tests;
* this task completely.

Inspect the actual TASK-034 implementation before choosing component boundaries.

Do not assume the current tab markup or CSS from task text.

---

# Product Observation

## 1. Current Problem

With many Watchlists, the current navigation can behave conceptually like:

```text
[1] [2] [3] [4] [5] [6] [7] [8] ... [13 ×]  | [New watchlist] [+]
 ↑ visible viewport ends earlier
```

The active Watchlist may be outside the currently visible scrolled portion.

The user must manually scroll the tab strip to discover which Watchlist is active.

This is poor workspace navigation.

---

## 2. Active Context Must Be Obvious

Because the duplicate active-Watchlist heading was intentionally removed in TASK-034, the navigation must always make the current Watchlist obvious without manual horizontal scrolling.

This is the central acceptance rule.

---

# Navigation Model

## 3. No Horizontal Tab Scrolling

Remove horizontal scrolling as the normal Watchlist-navigation mechanism.

Do not require the user to swipe/scroll sideways through tabs to find the active Watchlist.

---

## 4. Visible Watchlists

Display a bounded set of Watchlists directly as tabs/navigation items.

Inactive Watchlists that do not fit the current responsive navigation capacity move into an overflow menu.

---

## 5. Overflow Control

Provide an overflow control conceptually equivalent to:

```text
More ▾
```

or:

```text
Watchlists ▾
```

depending on viewport/context.

Do not introduce an icon library solely for this control.

A text label with a small disclosure indicator is preferred over an unexplained icon-only ellipsis unless accessibility and discoverability are equally strong.

---

## 6. Overflow Contents

The overflow menu lists Watchlists that are not currently displayed directly.

Each item must be identifiable by its full Watchlist name.

Selecting an item activates that Watchlist through the existing selection workflow.

---

# Active Watchlist Invariant

## 7. Active Watchlist Always Visible

The active Watchlist MUST always be represented directly outside the overflow menu.

It may never exist only inside:

```text
More
```

or:

```text
Watchlists
```

after activation.

---

## 8. Selecting Overflow Item

Suppose:

```text
visible:
1 2 3 4 5

overflow:
6 7 8 9 10 11 12 13
```

and the user selects:

```text
13
```

Expected after the existing PUT/GET transition succeeds:

```text
visible:
1 2 3 4 13

overflow:
5 6 7 8 9 10 11 12
```

or another deterministic equivalent.

The exact inactive tab displaced is presentation policy.

The active Watchlist `13` must be directly visible.

---

## 9. Failed Selection

If selecting an overflow Watchlist fails during the existing active-Watchlist mutation:

* previous active Watchlist remains active;
* previous active Watchlist remains directly visible;
* failed target does not become visually active;
* existing error behavior remains.

Preserve TASK-016 semantics.

---

# Deterministic Visibility Strategy

## 10. Avoid Fragile Pixel Packing

Do not build a complex browser-like tab-packing algorithm unless genuinely necessary.

Avoid unnecessary runtime measurement of every tab width, font glyph, and resize event.

Prefer a deterministic responsive capacity model.

---

## 11. Responsive Capacity

Use a small responsive policy for how many Watchlists may be directly visible.

The exact final capacities should be selected based on the current layout and verified screenshots.

A conceptual starting point is:

```text
wide desktop
→ up to 8 visible Watchlists

medium desktop/tablet
→ up to 5 visible Watchlists

mobile
→ active Watchlist only
```

These are starting points, not mandatory magic numbers.

The implementation must document the final selected policy.

---

## 12. Active Slot

The active Watchlist consumes one visible slot.

When necessary, an inactive directly visible Watchlist moves into overflow to make room for the active Watchlist.

---

## 13. Stable Inactive Selection

Avoid unnecessary reshuffling of visible inactive Watchlists on every render.

Use a deterministic policy based on the existing Watchlist order.

For example:

```text
take the earliest inactive Watchlists that fit
+
always include active Watchlist
```

or an equivalent predictable rule.

Document the chosen rule.

---

## 14. No Persistence of Visibility

Which Watchlists are directly visible vs. overflowed is presentation state only.

Do not persist this selection.

---

# Watchlist Order

## 15. Preserve Server Watchlist Order

Use the Watchlist order supplied by the existing document as the source order.

Do not reorder Watchlists alphabetically merely for overflow navigation.

---

## 16. No Tab Reordering

Do not implement:

* drag/drop;
* manual tab ordering;
* most-recently-used ordering;
* persisted navigation ordering.

These are outside this task.

---

# Duplicate Watchlist Names

## 17. Identity by ID

Duplicate Watchlist names remain allowed.

Navigation identity must continue to use Watchlist ID, not name.

---

## 18. Duplicate Names in Overflow

If two Watchlists have the same visible name, both must remain selectable as separate Watchlists.

Do not deduplicate overflow items by label.

Tests should prove ID-based selection still works.

---

# Long Watchlist Names

## 19. Direct Tab

Long directly visible names must not cause page-level horizontal overflow.

A reasonable visual maximum width/ellipsis is acceptable.

---

## 20. Full Accessible Name

If a direct tab visually truncates:

```text
Long Dividend Grow...
```

its accessible name must still represent the full Watchlist name.

---

## 21. Overflow Menu Name

Overflow items should display the full Watchlist name where practical.

If menu width must be bounded on mobile, allow wrapping rather than silently making multiple long names indistinguishable.

---

# Active Watchlist Delete

## 22. Preserve Active-Only Delete

TASK-034 established:

```text
active Watchlist
→ compact × delete control

inactive Watchlist
→ no delete control
```

Preserve this rule.

---

## 23. Delete Remains Directly Visible

Because the active Watchlist is always directly visible, its delete control is also always directly reachable without opening the overflow menu.

---

## 24. Fix × Alignment

Correct the current visual misalignment of the `×` inside its circular/square delete button.

Use proper layout centering rather than padding/line-height guessing.

Conceptually:

```css
display: inline-grid;
place-items: center;
padding: 0;
```

or an equivalent flex/grid solution.

---

## 25. Typographic Close Symbol

Use the multiplication/close character:

```text
×
```

rather than lowercase ASCII:

```text
x
```

if not already used.

The glyph should appear optically centered.

---

## 26. Delete Button Geometry

The compact delete control should have a consistent square/circular clickable area.

Width and height should be explicitly compatible.

Do not allow text line-height to determine the button geometry accidentally.

---

## 27. Delete Accessibility

Preserve a meaningful accessible name:

```text
Remove watchlist "<full name>"
```

---

## 28. Delete Confirmation

Preserve the existing confirmation workflow.

Do not make the compact `×` an immediate destructive action.

---

# Watchlist Creation Area

## 29. Creation Is Outside Navigation Overflow

The:

```text
New watchlist name
+
```

controls must not become part of the Watchlist overflow menu.

They remain a separate creation group.

---

## 30. Desktop Placement

On desktop, retain the general TASK-034 structure:

```text
[navigation...........................] [New watchlist name] [+]
```

The creation area remains directly reachable.

---

## 31. Navigation Cannot Hide Create Controls

Many Watchlists must not push the create controls off-screen.

The navigation region must shrink/use overflow before the creation group loses its usable space.

---

## 32. Mobile Creation

On mobile, the creation group may move to a second line:

```text
[Current ×] [Watchlists ▾]

[New watchlist name] [+]
```

This is preferable to squeezing all controls into one unusably narrow row.

---

# Mobile Navigation

## 33. Active-First Mobile Pattern

At narrow mobile width, show the active Watchlist directly.

Conceptually:

```text
[Lieblingsaktien ×] [Watchlists ▾]
```

Do not render a horizontally scrollable row of many tiny tabs.

---

## 34. Mobile Overflow Label

Prefer:

```text
Watchlists ▾
```

on mobile because it is more explicit than:

```text
More
```

when only the active Watchlist is directly visible.

A single responsive label strategy is also acceptable if sufficiently clear.

---

## 35. No Overflow Needed

If every Watchlist fits directly under the current capacity:

* do not display an unnecessary overflow control.

Example:

```text
3 Watchlists
capacity 5
→ 3 direct tabs
→ no More button
```

---

# Overflow Menu Interaction

## 36. Native/Simple Implementation Preferred

Use the simplest accessible menu/disclosure implementation appropriate for the current Svelte application.

Do not add a UI/menu library.

Possible implementations include:

* native `<details>/<summary>` where semantics and styling are sufficient;
* a small explicit disclosure button + menu/list;
* another dependency-free accessible pattern.

Choose based on actual keyboard/accessibility behavior.

---

## 37. Opening

The overflow control must be keyboard reachable and operable.

---

## 38. Selecting

Selecting an overflow Watchlist invokes the same:

```text
onSelected(watchlistId)
```

or equivalent existing callback as a direct tab.

Do not introduce a second selection implementation.

---

## 39. Close After Selection

After a successful selection action is initiated/handled, the overflow menu should close.

Do not leave an obsolete menu covering the workspace.

---

## 40. Outside/Escape Behavior

If using a custom disclosure/menu implementation, support reasonable dismissal such as:

* Escape;
* selecting an item;
* clicking/tapping outside where practical.

If native `<details>` provides sufficient behavior, do not recreate it unnecessarily.

---

# Accessibility Semantics

## 41. Direct Tabs

Directly visible Watchlists retain the existing:

```text
role="tab"
aria-selected
```

semantics.

---

## 42. Overflow Items Are Not Hidden Tabs

Do not blindly assign:

```text
role="tab"
```

to overflow menu items that are not part of the directly rendered tab strip.

Use appropriate button/menu/list semantics.

They still activate Watchlists through the same application action.

---

## 43. Tablist Scope

The direct Watchlist tabs remain inside the existing:

```text
role="tablist"
```

or equivalent semantic structure.

The overflow disclosure itself should not pretend to be a Watchlist tab.

---

## 44. Active Delete Is Sibling

Preserve TASK-034's correct structure:

```text
tab button
+
delete button
```

as sibling interactive controls.

Do not nest the delete button inside the tab button.

---

## 45. Keyboard Selection

Existing direct-tab keyboard usability must remain.

Overflow Watchlists must also be keyboard selectable.

---

## 46. Focus Visibility

Preserve the global focus-visible styling for:

* direct tabs;
* active delete;
* overflow disclosure;
* overflow Watchlist items;
* create controls.

---

# Busy State

## 47. Navigation Busy

Preserve the existing management busy behavior.

While a Watchlist transition/mutation prevents navigation:

* direct tabs respect disabled/busy state;
* overflow control/items respect the same state;
* create controls preserve existing behavior;
* delete control preserves existing behavior.

---

## 48. No Duplicate Selection Requests

Rapid interaction with direct or overflow Watchlists must not introduce duplicate active-Watchlist mutation requests beyond the protections already established.

---

# Error Behavior

## 49. Direct Selection Failure

Preserve existing tab-switch failure behavior.

---

## 50. Overflow Selection Failure

Overflow selection must use the same error semantics as direct selection.

Do not create overflow-specific error messages.

---

# No Business Changes

## 51. Active Watchlist Persistence

The existing server-side active-Watchlist selection remains authoritative.

Do not optimistically invent a new active ID.

---

## 52. Watchlist Creation

Watchlist creation semantics remain unchanged.

---

## 53. Watchlist Deletion

Watchlist deletion/replacement semantics remain unchanged.

---

## 54. Stock State

Changing navigation presentation must not modify:

* stock order;
* filter semantics;
* sort semantics;
* Target Prices;
* investment allocation;
* stock mutations.

---

# Component Structure

## 55. WatchlistTabs Responsibility

It is reasonable for `WatchlistTabs.svelte` to evolve into the responsive Watchlist-navigation component.

If its name becomes misleading because it now owns direct tabs + overflow navigation, a targeted rename is acceptable.

Do not rename components without updating imports/tests/documentation consistently.

---

## 56. Pure Visibility Helper

Prefer extracting the direct-vs-overflow selection algorithm into a pure client-safe helper if it contains non-trivial logic.

Conceptually:

```ts
partitionWatchlistsForNavigation(
  watchlists,
  activeWatchlistId,
  capacity
)
```

returning something like:

```ts
{
  visible: Watchlist[],
  overflow: Watchlist[]
}
```

The exact API may differ.

---

## 57. Pure Helper Benefits

If introduced, the helper should:

* preserve source order;
* guarantee active visibility;
* preserve duplicate IDs/names correctly;
* be deterministic;
* have no DOM dependency.

This allows comprehensive unit testing without browser-width measurement.

---

# Responsive Capacity Implementation

## 58. Trusted Presentation Input

Capacity is derived from responsive presentation state, not server/business state.

Possible implementation strategies include:

* CSS/media-query coordinated component state;
* `matchMedia`;
* a small responsive helper;
* another simple browser-native mechanism.

Do not add a responsive framework.

---

## 59. SSR Safety

If browser APIs such as:

```text
matchMedia
```

are used, ensure SvelteKit SSR/build behavior remains safe.

Do not access browser-only globals unguarded during server rendering.

---

## 60. Resize Behavior

When viewport capacity changes:

```text
wide → narrow
```

or:

```text
narrow → wide
```

recompute direct/overflow navigation.

The active Watchlist remains directly visible throughout.

No server request should occur merely because the viewport resized.

---

# Unit Tests — Visibility Algorithm

## 61. Fewer Than Capacity

Given:

```text
3 Watchlists
capacity 5
```

expected:

```text
visible = all 3
overflow = []
```

---

## 62. Exactly Capacity

Given:

```text
5 Watchlists
capacity 5
```

expected:

```text
visible = all 5
overflow = []
```

---

## 63. More Than Capacity

Given:

```text
8 Watchlists
capacity 5
```

expected:

```text
visible.length = 5
overflow.length = 3
```

with source-order behavior according to the selected deterministic policy.

---

## 64. Active Inside Initial Visible Range

Verify active remains visible without unnecessary reshuffling.

---

## 65. Active Outside Initial Visible Range

Given:

```text
Watchlists 1..13
capacity 5
active = 13
```

expected:

```text
13 ∈ visible
13 ∉ overflow
```

and exactly one otherwise-visible inactive Watchlist is displaced according to policy.

---

## 66. Source Order

Visible and overflow items preserve deterministic source order according to the documented policy.

---

## 67. Duplicate Names

Two Watchlists with identical names but different IDs remain distinct.

---

## 68. Empty

Given no Watchlists:

```text
visible = []
overflow = []
```

---

## 69. Capacity One

Verify the mobile-style case:

```text
capacity = 1
```

shows exactly the active Watchlist when one exists.

---

# Playwright E2E

## 70. Permanent Coverage

Update/extend the existing permanent navigation tests.

Natural locations include:

```text
tests/e2e/watchlist-tabs.spec.ts
tests/e2e/watchlist-management.spec.ts
tests/e2e/responsive-layout.spec.ts
tests/e2e/ui-polish.spec.ts
```

Do not rely solely on temporary scripts.

---

# E2E — Desktop Navigation

## 71. Few Watchlists

With fewer Watchlists than desktop capacity:

* all are directly visible;
* no overflow control appears.

---

## 72. Many Watchlists

With more Watchlists than desktop capacity:

* direct navigation is bounded;
* overflow control appears;
* page does not horizontally overflow;
* navigation strip itself does not require horizontal scrolling.

---

## 73. Active Late Watchlist

Start with a Watchlist whose position is beyond the direct capacity.

Expected immediately after load:

* active Watchlist is directly visible;
* active Watchlist has selected state;
* active Watchlist is absent from overflow.

This directly reproduces the Product Owner's screenshot problem.

---

## 74. Select From Overflow

Open overflow and select a hidden Watchlist.

Verify:

* existing PUT active request is sent with correct ID;
* composed Watchlist is loaded according to existing flow;
* selected Watchlist becomes directly visible;
* it reports selected state;
* it disappears from overflow;
* overflow closes.

---

## 75. Overflow Selection Failure

Mock active-selection failure.

Verify:

* previous active Watchlist remains directly visible/selected;
* target does not become active;
* existing error appears.

---

## 76. Duplicate Names

Verify selecting one of two identically named Watchlists from direct/overflow navigation uses the correct ID.

Use existing ID-based helper assertions where practical.

---

# E2E — Delete

## 77. Active Delete Visible

With overflow active, verify the active directly visible Watchlist still has its adjacent delete control.

---

## 78. Delete Alignment

Do not attempt fragile pixel-perfect glyph assertions.

Instead verify structural geometry where practical:

* button width approximately equals height;
* glyph is centered by CSS/layout implementation;
* screenshot review confirms visual centering.

---

## 79. Delete Workflow

Preserve cancel/confirm behavior.

---

# E2E — Creation

## 80. Create New Watchlist Beyond Capacity

With navigation already at capacity, create a new Watchlist.

Because the new Watchlist becomes active:

* new Watchlist must become directly visible;
* another inactive Watchlist may move to overflow;
* no horizontal navigation scrolling is required.

This is a key regression scenario.

---

## 81. Create Failure

Failure preserves the previous active Watchlist and navigation state.

---

# Responsive E2E

## 82. Required Viewports

Verify at least:

```text
375px
768px
1280px
1600px
```

consistent with TASK-034.

---

## 83. 1600px

With many Watchlists:

* bounded direct tabs;
* overflow control where required by final capacity;
* active always visible;
* create controls visible;
* no page-level horizontal overflow;
* no horizontal navigation scrolling.

---

## 84. 1280px

Same invariants.

The number of direct Watchlists may be lower according to the final capacity policy.

---

## 85. 768px

Navigation remains understandable.

Overflow replaces horizontal scrolling.

Create controls remain usable.

---

## 86. 375px

Mobile behavior should conceptually be:

```text
[Active Watchlist ×] [Watchlists ▾]
```

plus creation controls on the same or following line according to final layout.

Verify:

* active visible;
* other Watchlists accessible through disclosure;
* no horizontal navigation scrolling;
* no page-level overflow.

---

# Overflow Measurements

## 87. Page Width

At all required viewports:

```text
document.documentElement.scrollWidth
<=
document.documentElement.clientWidth
```

within negligible rounding tolerance.

---

## 88. Navigation Width

The Watchlist navigation region itself must not require user-controlled horizontal scrolling.

Do not leave:

```css
overflow-x: auto
```

as the primary navigation strategy.

---

# Screenshot Verification

## 89. Screenshots

Review screenshots at:

```text
375
768
1280
1600
```

with enough Watchlists to trigger overflow.

---

## 90. Screenshot Criteria

Verify visually:

* active Watchlist is obvious;
* no hidden selected tab;
* overflow control is discoverable;
* create controls remain visible;
* long names do not break layout;
* `×` is visually centered;
* navigation does not dominate vertical space;
* no page-level horizontal overflow.

---

# Architecture Documentation

## 91. Navigation Rule

Update `ARCHITECTURE.md` with:

> The active Watchlist is always directly visible in navigation. Inactive Watchlists may move into a responsive overflow menu.

---

## 92. No Horizontal Tab Scroll

Document that horizontal scrolling is not used as the primary Watchlist-navigation overflow strategy.

---

## 93. Responsive Navigation

Document the final direct-tab capacity policy for:

* wide;
* medium;
* mobile.

Do not document suggested numbers if implementation chooses different verified capacities.

---

## 94. Presentation Only

Document that direct-vs-overflow placement is client presentation state and does not change Watchlist order or persistence.

---

# Historical Task Notes

## 95. TASK-016

If useful, add a concise note that TASK-035 later evolved the original tab strip into responsive direct+overflow navigation while preserving active-Watchlist semantics.

Keep status Done.

---

## 96. TASK-034

Add a concise supersession note that TASK-035 replaces TASK-034's horizontally scrollable many-tab strategy with active-visible overflow navigation and corrects the compact delete-button alignment.

Keep status Done.

---

# README

## 97. README

No README change is required unless it describes horizontal tab scrolling as a product behavior.

Do not document low-level responsive capacities in the project introduction.

---

# Non-Goals

Do NOT implement:

* horizontal scrolling as a fallback for Watchlist navigation;
* drag/drop tab ordering;
* persisted navigation layout;
* most-recently-used ordering;
* Watchlist rename;
* Watchlist search;
* pagination of Watchlists;
* custom modal framework;
* new icon library;
* stock-card layout;
* table/card responsive switching;
* stock-table redesign;
* server/API changes;
* persistence changes;
* production deployment;
* unrelated V3 improvements.

Responsive stock cards belong to TASK-036.

---

# Acceptance Criteria

The task is complete when all of the following are true:

1. Horizontal Watchlist scrolling is removed as the navigation strategy.
2. Active Watchlist is always directly visible.
3. Active Watchlist never exists only inside overflow.
4. Inactive Watchlists may move into overflow.
5. Overflow control appears only when needed.
6. Overflow items remain selectable.
7. Overflow selection uses existing Watchlist-selection flow.
8. Successful overflow selection makes target directly visible.
9. Failed overflow selection preserves previous active state.
10. Direct Watchlist order follows deterministic source-order policy.
11. Duplicate names remain distinct by ID.
12. Long names do not create page-level overflow.
13. Full accessible names remain available.
14. Active delete remains directly visible.
15. Inactive Watchlists do not expose active-delete control.
16. Delete `×` is geometrically/visually centered.
17. Delete control remains keyboard accessible.
18. Delete accessible name contains full Watchlist name.
19. Delete confirmation remains.
20. Create controls remain outside overflow.
21. Many Watchlists cannot push create controls off-screen.
22. Create behavior remains unchanged.
23. Newly created active Watchlist becomes directly visible even beyond capacity.
24. Responsive direct-tab capacity is deterministic.
25. Capacity changes do not trigger server requests.
26. Active remains visible after viewport resize.
27. Mobile directly displays active Watchlist.
28. Mobile provides access to other Watchlists through disclosure/overflow.
29. Mobile does not use horizontal tab scrolling.
30. Direct tabs preserve tab semantics.
31. Overflow disclosure is not incorrectly represented as a tab.
32. Overflow items have appropriate accessible semantics.
33. Active delete remains sibling to tab control.
34. Existing busy behavior remains.
35. No duplicate selection-request regression is introduced.
36. Existing error behavior remains.
37. Server active-Watchlist semantics remain authoritative.
38. Watchlist persistence order remains unchanged.
39. No per-user navigation preference is persisted.
40. Pure visibility algorithm exists if logic is non-trivial.
41. Visibility algorithm has deterministic unit coverage.
42. Unit tests cover fewer-than-capacity.
43. Unit tests cover exact-capacity.
44. Unit tests cover overflow.
45. Unit tests cover late active Watchlist.
46. Unit tests cover duplicate names.
47. Unit tests cover capacity one.
48. E2E covers few Watchlists.
49. E2E covers many Watchlists.
50. E2E reproduces late-active-Watchlist scenario.
51. E2E covers overflow selection.
52. E2E covers overflow-selection failure.
53. E2E covers duplicate names by ID.
54. E2E covers active delete with overflow.
55. E2E covers new Watchlist creation beyond capacity.
56. Responsive E2E covers 375px.
57. Responsive E2E covers 768px.
58. Responsive E2E covers 1280px.
59. Responsive E2E covers 1600px.
60. No required viewport has page-level horizontal overflow.
61. Navigation itself does not require horizontal scrolling.
62. Screenshot review confirms centered `×`.
63. Screenshot review confirms active context is obvious.
64. `ARCHITECTURE.md` documents responsive overflow navigation.
65. Historical task context is preserved.
66. No stock-card implementation is introduced.
67. No server/API/persistence change is introduced.
68. Existing project checks pass.
69. No unnecessary dependency is introduced.
70. No production deployment occurs.

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

1. few Watchlists require no overflow;
2. many Watchlists produce overflow rather than horizontal scrolling;
3. active Watchlist at the end of a long list is immediately visible;
4. active Watchlist is never present only in overflow;
5. selecting overflow item uses correct Watchlist ID;
6. selected overflow Watchlist becomes directly visible;
7. selection failure preserves previous active Watchlist;
8. duplicate Watchlist names remain independently selectable;
9. newly created active Watchlist beyond capacity becomes directly visible;
10. active delete remains adjacent;
11. `×` is visually centered;
12. delete confirmation remains;
13. create controls remain visible;
14. viewport resize does not trigger API requests;
15. 375px behavior;
16. 768px behavior;
17. 1280px behavior;
18. 1600px behavior;
19. no page-level horizontal overflow at required viewports;
20. no user-controlled horizontal scrolling in Watchlist navigation;
21. screenshots reviewed at all required widths.

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
2. previous horizontal-scroll behavior;
3. final navigation model;
4. final responsive capacity policy;
5. direct-vs-overflow selection algorithm;
6. active-visibility guarantee;
7. source-order behavior;
8. duplicate-name behavior;
9. long-name behavior;
10. overflow-control design;
11. overflow keyboard/accessibility behavior;
12. overflow selection behavior;
13. overflow failure behavior;
14. mobile navigation design;
15. viewport-resize behavior;
16. final active-delete design;
17. `×` centering fix;
18. delete accessibility/confirmation behavior;
19. Watchlist-create behavior;
20. newly created beyond-capacity behavior;
21. busy/error-state preservation;
22. unit tests added/changed;
23. Playwright tests added/changed;
24. 375px verification;
25. 768px verification;
26. 1280px verification;
27. 1600px verification;
28. page-overflow verification;
29. navigation-overflow verification;
30. screenshot-review results;
31. `ARCHITECTURE.md` changes;
32. historical task notes;
33. README changes, if any;
34. results of `test`, `test:e2e`, `check`, `lint`, and `build`;
35. confirmation no stock-card work was introduced;
36. confirmation no server/API/persistence changes occurred;
37. confirmation no production deployment occurred;
38. confirmation task status changed to Done;
39. assumptions or unresolved issues;
40. deviations from this task or `ARCHITECTURE.md`.

Do not proceed to TASK-036.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
