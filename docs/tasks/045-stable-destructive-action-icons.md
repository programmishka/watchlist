
# TASK-045: Stable Destructive Action Icons

## Status

Done

## Goal

Replace font/emoji-based destructive-action symbols with deterministic inline SVG icons and ensure both stock-removal and active-Watchlist-removal controls are geometrically and visually centered.

Source artwork for this task is stored in:

docs/tasks/assets/045-stock-remove.svg
docs/tasks/assets/045-watchlist-remove.svg

Treat these files as design inputs. Clean/simplify the SVG markup as specified by this task before using it in production components. Do not use the source files as runtime image URLs.

A real rendering defect has been observed for the current stock-removal button:

```html
<button
  type="button"
  class="btn btn-destructive btn-icon"
  aria-label="Remove ABT"
>
  🗑
</button>
```

The trash emoji is dependent on the operating system/browser/font environment and currently renders incorrectly in at least one real environment.

The active-Watchlist delete control has a related presentation issue: the text glyph `×` is not optically centered reliably even though the surrounding button uses centering CSS.

TASK-045 removes both font-dependent icon representations.

Use the two Product-Owner-provided SVG designs as the source artwork:

* Trash SVG for stock removal.
* Circular Close SVG for active-Watchlist removal.

The SVG geometry may be cleaned and simplified for inline application use, but its visual design must remain recognizably based on the supplied artwork.

The Product Owner will replace `favicon.svg` separately.

Do not modify the favicon in this task.

---

## Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* TASK-025;
* TASK-034;
* TASK-035;
* TASK-036;
* TASK-041;
* TASK-042;
* TASK-043;
* TASK-044;
* current `src/app.css`;
* current `WatchlistTabs.svelte`;
* current `WatchlistTable.svelte`;
* current `WatchlistCards.svelte`;
* current stock-remove button implementation;
* current active-Watchlist-remove implementation;
* existing responsive/accessibility Playwright coverage;
* this task completely.

Inspect the actual current implementation before editing.

This is a small visual robustness/accessibility task, not another frontend architecture refactoring.

---

## Supplied Trash Icon

The Product Owner supplied a trash-can SVG with:

```text
viewBox="0 0 512 512"
```

and a multicolor red/orange/black design.

Use this artwork as the source for the stock-removal icon.

The source contains SVG-repository metadata/groups such as:

```text
SVGRepo_bgCarrier
SVGRepo_tracerCarrier
SVGRepo_iconCarrier
```

These repository/export artifacts do not need to remain in production markup.

The implementation may remove:

* generator/repository metadata;
* unused IDs;
* unnecessary `version`;
* unnecessary `xmlns:xlink`;
* explicit source `width="64px"` / `height="64px"`;
* redundant groups;
* other export-only attributes

provided the visual icon itself is preserved.

Do not redraw the trash icon into an unrelated design.

---

## Supplied Watchlist Close Icon

The Product Owner supplied a circular Close SVG with:

```text
viewBox="0 0 24 24"
```

containing:

* circular outline;
* centered cross;
* red stroke.

Use this artwork as the source for active-Watchlist removal.

The same export-cleanup rules apply.

The existing textual:

```text
×
```

must no longer be the rendered icon after this task.

---

## Implementation Strategy

### 1. Inline SVG

Use inline SVG inside the existing buttons.

Conceptually:

```svelte
<button
    type="button"
    class="btn btn-destructive btn-icon"
    aria-label="Remove AAPL"
>
    <svg ... aria-hidden="true">
        ...
    </svg>
</button>
```

Do not use:

* emoji;
* Unicode icon characters;
* icon fonts;
* external SVG URLs;
* CSS background-image URLs.

---

### 2. No Icon Library

Do not add:

* Font Awesome;
* Material Icons;
* Lucide;
* Heroicons;
* another icon dependency.

Two application icons do not justify an icon framework.

---

### 3. No Generic Icon Framework

Do not introduce an abstraction such as:

```text
Icon.svelte
icons.ts
IconName
icon registry
```

solely for these two icons.

Inline SVGs in the responsible components are acceptable and preferred unless actual code demonstrates a smaller clearer alternative.

---

## Stock Removal Icon

### 4. Replace Emoji

Replace every production stock-removal rendering of:

```text
🗑
```

with the supplied Trash SVG.

Search the complete frontend rather than assuming only the table contains it.

---

### 5. Table

The stock-removal button in `WatchlistTable` must use the SVG.

---

### 6. Cards

Inspect `WatchlistCards`.

If Card stock removal currently uses the same emoji or another font-dependent representation, replace it with the same Trash artwork.

Table and Cards should represent the same action consistently.

---

### 7. Accessible Name

Preserve the existing stock-specific accessible name:

```text
Remove <symbol>
```

Examples:

```text
Remove AAPL
Remove ABT
Remove NOVO-B.CO
```

The SVG itself is decorative.

---

### 8. SVG Accessibility

Set the inline SVG appropriately so it does not create an additional accessible object/name.

Use:

```html
aria-hidden="true"
```

or the equivalent established approach.

Do not add redundant `<title>` elements to decorative SVGs when the button already has a complete `aria-label`.

---

## Watchlist Removal Icon

### 9. Replace Text Glyph

Replace the active-Watchlist removal:

```text
×
```

with the supplied circular Close SVG.

---

### 10. Active Only

Preserve TASK-035 behavior:

```text
active Watchlist
→ delete control visible

inactive Watchlist
→ no delete control
```

---

### 11. Accessible Name

Preserve the full Watchlist-specific accessible name.

Conceptually:

```text
Remove watchlist "<full name>"
```

Do not replace it with:

```text
Close
```

or:

```text
Delete
```

without the Watchlist identity.

---

### 12. Confirmation

Preserve the existing confirmation flow.

The SVG change must not alter:

```text
click
→ window.confirm(...)
→ confirmed deletion intent
```

---

## Icon Sizing

### 13. Do Not Use Source 64px Dimensions

The supplied SVG files use:

```text
width="64px"
height="64px"
```

as source/export dimensions.

These are not appropriate for the compact application controls.

Remove or override them.

---

### 14. CSS-Controlled Size

Use explicit application-level icon dimensions.

A reasonable starting point is approximately:

```text
1rem–1.25rem
```

for the visible SVG inside the compact button.

The exact value must be chosen by visual verification.

---

### 15. Button vs Icon Size

Do not make the SVG fill the entire clickable button.

Conceptually:

```text
button hit area
┌──────────┐
│          │
│   icon   │
│          │
└──────────┘
```

There should be visually balanced space around the artwork.

---

## Geometric Centering

### 16. Explicit Button Geometry

Both destructive icon buttons must use predictable square geometry.

Conceptually:

```css
.btn-icon {
    inline-size: ...;
    block-size: ...;
    padding: 0;
    display: inline-grid;
    place-items: center;
}
```

Use the existing CSS architecture rather than blindly adding these exact declarations.

---

### 17. SVG as Block

Avoid inline-text baseline behavior.

Use an approach such as:

```css
.btn-icon svg {
    display: block;
}
```

or equivalent.

---

### 18. Explicit SVG Dimensions

The SVG should have explicit CSS width/height or inline dimensions derived from CSS variables/classes.

Do not let intrinsic source dimensions determine layout.

---

### 19. No Glyph Hacks

Do not use fixes such as:

```css
position: relative;
top: 1px;
```

or arbitrary asymmetric padding to compensate for glyph metrics.

The purpose of SVG is to eliminate that problem.

---

## Close SVG Geometry

### 20. Avoid Double Border Appearance

The supplied Close SVG itself contains a red circular outline.

The current destructive button may also have a red border.

Inspect the combined rendering carefully.

Avoid an accidental visual result resembling:

```text
double red circle
```

or an unnecessarily heavy destructive control.

---

### 21. Preserve Supplied Design

The circular outline is part of the supplied Close artwork.

Prefer adapting the surrounding button presentation rather than deleting the circle without reason.

However, the final control must visually fit the existing Watchlist navigation.

Document any small SVG/CSS adjustment required to avoid redundant borders.

---

## Trash SVG Geometry

### 22. Source ViewBox

The Trash source uses:

```text
0 0 512 512
```

but the visible artwork may not occupy the full square symmetrically.

Inspect actual rendered optical centering.

---

### 23. No Distortion

Preserve the SVG aspect ratio.

Do not stretch the icon differently horizontally and vertically just to fill the button.

---

### 24. Optical Verification

Because SVG viewBox geometry can itself contain uneven whitespace, visually verify that the Trash artwork appears centered after CSS centering.

If the source viewBox has clearly unnecessary empty space, a carefully adjusted viewBox is acceptable.

Do not alter path geometry unless necessary.

Document any viewBox adjustment.

---

## Shared Button Vocabulary

### 25. Preserve Existing Classes

Continue using the established button vocabulary where applicable:

```text
.btn
.btn-destructive
.btn-icon
```

Do not create an unrelated second destructive-button system.

---

### 26. Scoped Variant If Needed

If the circular Watchlist Close artwork requires a slightly different surrounding border treatment from the stock Trash button, introduce a narrowly named variant.

For example conceptually:

```text
.btn-icon-watchlist-remove
```

Use actual naming consistent with current CSS.

Do not change every `.btn-icon` merely to accommodate one SVG if that would regress other controls.

---

## Busy / Disabled Behavior

### 27. Stock Removal

Preserve:

```text
disabled
aria-busy
```

and existing mutation serialization.

---

### 28. Watchlist Removal

Preserve existing Watchlist-management busy behavior.

---

### 29. SVG Must Not Affect Events

Clicks must remain owned by the button.

The SVG must not introduce separate event handling.

---

## Focus

### 30. Focus Visible

Preserve the global TASK-025 `:focus-visible` behavior.

The icon must not receive separate keyboard focus.

---

## Responsive Behavior

### 31. Desktop Table

Verify stock Trash icon in Table mode.

---

### 32. Cards

Verify stock Trash icon in Card mode.

---

### 33. Watchlist Navigation Desktop

Verify active-Watchlist Close icon in wide navigation.

---

### 34. Watchlist Navigation Mobile

Verify active-Watchlist Close icon in the compact mobile navigation.

---

## Visual Consistency

### 35. Trash

The Trash icon should be recognizable at application size.

Do not reduce it until the internal bin details become unreadable noise.

---

### 36. Close

The Close icon should remain clearly recognizable without visually dominating the active tab.

---

### 37. Destructive Meaning

Both controls retain the existing destructive visual vocabulary.

Do not make them look like primary actions.

---

## No Favicon Work

### 38. Favicon Explicitly Out of Scope

The Product Owner will replace:

```text
favicon.svg
```

manually.

Do not:

* generate a favicon;
* edit the current favicon;
* add favicon assets;
* change favicon references.

---

## Tests

### 39. Existing Behavioral Tests

Preserve all existing stock-removal and Watchlist-removal tests.

---

### 40. Do Not Test SVG Path Data

Do not write brittle assertions for exact SVG `d` path strings.

The product contract is not the byte-for-byte artwork representation.

---

### 41. SVG Presence

Add focused assertions where useful that the relevant destructive button contains an SVG rather than relying on the former text/emoji representation.

---

### 42. Decorative SVG

Verify the SVG is excluded from the accessibility tree through the selected semantics.

---

### 43. Accessible Button Names

Verify:

```text
Remove AAPL
```

or representative stock name remains discoverable by role/name.

Verify active-Watchlist removal remains discoverable by its full accessible name.

---

### 44. Stock Removal Behavior

Verify clicking the SVG-based stock-remove button still executes the existing removal workflow.

---

### 45. Watchlist Confirmation

Verify clicking the SVG-based Watchlist-remove button still opens the existing confirmation workflow.

---

## Visual / Geometry Verification

### 46. Do Not Pixel-Test Artwork

Avoid brittle screenshot pixel-diff assertions solely for centering.

Use CSS structural assertions plus manual screenshot review.

---

### 47. Square Button

Where practical, verify computed button width and height are equal or effectively equal.

---

### 48. SVG Bounds

Verify the SVG dimensions fit inside the button and do not overflow.

---

### 49. Screenshot Review

Review screenshots at:

```text
375px
768px
1280px
1600px
```

with representative:

* active Watchlist delete control;
* stock delete control.

---

### 50. Visual Criteria

Confirm:

* no broken/missing glyph;
* no emoji rendering;
* Trash icon recognizable;
* Trash icon centered;
* Close icon centered;
* no accidental double-border problem;
* no clipping;
* no SVG overflow;
* appropriate spacing around icon;
* focus ring remains visible;
* controls do not change surrounding layout.

---

## Architecture

### 51. No Architecture Change

This task does not alter the frontend responsibility architecture established by TASK-041 through TASK-044.

---

### 52. Workspace Untouched

Do not modify `WatchlistWorkspace` unless a trivial type/import consequence is unavoidable.

No workflow belongs in the icons.

---

## Documentation

### 53. `ARCHITECTURE.md`

A major architecture update is not required.

Only update documentation if the project currently records the emoji/typographic icon choice as an accepted UI convention.

---

### 54. Frontend Architecture Audit

No update is required unless implementation reveals an architecture issue relevant to the audit.

Do not add status noise for this small visual fix.

---

## Non-Goals

Do NOT implement:

* favicon changes;
* image generation;
* icon library;
* icon font;
* generic icon framework;
* generic design-system rewrite;
* new confirmation dialog;
* new stock-removal semantics;
* new Watchlist-removal semantics;
* component architecture refactoring;
* Workspace refactoring;
* naming cleanup;
* table redesign;
* Card redesign;
* navigation redesign;
* API changes;
* server changes;
* persistence changes;
* production deployment;
* unrelated cleanup.

---

## Acceptance Criteria

The task is complete when all of the following are true:

1. Stock-removal emoji is removed from production UI.
2. Supplied Trash artwork is used as inline SVG.
3. Table stock removal uses the SVG.
4. Card stock removal uses the SVG where applicable.
5. No font/emoji dependency remains for stock-removal icon.
6. Existing `Remove <symbol>` accessible name remains.
7. Trash SVG is decorative to accessibility APIs.
8. Active-Watchlist textual `×` is removed.
9. Supplied circular Close artwork is used as inline SVG.
10. Active-only Watchlist delete rule remains.
11. Existing full Watchlist-specific accessible name remains.
12. Close SVG is decorative to accessibility APIs.
13. Existing Watchlist confirmation remains.
14. Source `64px` icon dimensions do not control application layout.
15. Icon dimensions are explicitly application-sized.
16. Buttons retain a predictable square hit area.
17. Trash SVG is geometrically centered.
18. Close SVG is geometrically centered.
19. No baseline/text-glyph centering hack remains.
20. SVGs do not overflow buttons.
21. SVG aspect ratios remain correct.
22. Trash icon remains recognizable at final size.
23. Close icon remains recognizable at final size.
24. Accidental double-border Close appearance is avoided.
25. Existing destructive button vocabulary is reused.
26. Busy/disabled semantics remain.
27. Focus-visible behavior remains.
28. Table stock removal still works.
29. Card stock removal still works.
30. Watchlist removal still works.
31. Watchlist confirmation still works.
32. Desktop navigation remains coherent.
33. Mobile navigation remains coherent.
34. No surrounding layout regression occurs.
35. Existing behavioral tests remain green.
36. Accessible role/name tests remain green.
37. Focused SVG-presence/accessibility coverage exists where useful.
38. No brittle SVG-path tests are introduced.
39. Screenshots are reviewed at 375/768/1280/1600.
40. No icon dependency is added.
41. No generic icon framework is introduced.
42. No favicon file/reference is changed.
43. No Workspace architecture changes occur.
44. No API/server/persistence changes occur.
45. All project checks pass.
46. No production deployment occurs.

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

Additionally verify explicitly:

1. search production frontend for the former Trash emoji;
2. search production frontend for the former active-Watchlist textual `×`;
3. Table stock-removal SVG;
4. Card stock-removal SVG;
5. active-Watchlist Close SVG;
6. stock-remove accessible name;
7. Watchlist-remove accessible name;
8. SVG `aria-hidden` behavior;
9. stock removal;
10. Watchlist removal cancel;
11. Watchlist removal confirm;
12. disabled/busy stock action;
13. disabled/busy Watchlist action;
14. keyboard focus visibility;
15. button width/height geometry;
16. SVG width/height geometry;
17. Trash optical centering;
18. Close optical centering;
19. no double-border issue;
20. 375px screenshot;
21. 768px screenshot;
22. 1280px screenshot;
23. 1600px screenshot;
24. confirmation that favicon was untouched.

Do not report verification as successful unless actually executed successfully.

Do NOT deploy production.

---

## Task Status

After implementation, testing, screenshot review, and verification are complete, change:

```text
Status: Ready
```

to:

```text
Status: Done
```

Do not modify unrelated task statuses.

---

## Completion Report

When finished, report:

1. files changed;
2. previous Trash rendering problem;
3. final Trash SVG implementation;
4. any cleanup performed on supplied Trash SVG;
5. final Trash icon size;
6. any Trash viewBox adjustment and rationale;
7. previous Watchlist `×` centering problem;
8. final Close SVG implementation;
9. any cleanup performed on supplied Close SVG;
10. final Close icon size;
11. surrounding Close-button border treatment;
12. final button geometry;
13. centering CSS;
14. Table behavior;
15. Card behavior;
16. desktop Watchlist-navigation behavior;
17. mobile Watchlist-navigation behavior;
18. accessible-name preservation;
19. SVG accessibility treatment;
20. busy/disabled preservation;
21. focus-visible preservation;
22. tests added/changed;
23. screenshot-review results at 375/768/1280/1600;
24. results of `test`, `test:e2e`, `check`, `lint`, and `build`;
25. confirmation no icon library/framework was added;
26. confirmation favicon was untouched;
27. confirmation no Workspace/API/server/persistence changes occurred;
28. confirmation no production deployment occurred;
29. confirmation task status changed to Done;
30. assumptions or deviations.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
