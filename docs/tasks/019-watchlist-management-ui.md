# TASK-019: Watchlist Management UI

## Status

Done

## Goal

Implement the user interface for creating and deleting Watchlists.

This task adds the first Watchlist-management controls to the existing Svelte UI:

```text
[ Watchlist name                 ] [ + ]

[ Main ] [ Dividend ] [ Tech ]             [ Delete current ]
```

The exact responsive placement may differ where appropriate.

The UI must use the existing REST API and server-side business rules.

The task implements:

* Watchlist-name input;
* create-Watchlist action;
* automatic transition to the newly created active Watchlist;
* delete-current-Watchlist action;
* confirmation before deletion;
* correct transition to the server-selected replacement Watchlist;
* correct transition to the no-Watchlists state after deleting the final Watchlist;
* persistent Playwright coverage for these user workflows.

Do not implement stock add/remove controls, Target Price editing, filtering, sorting, or investment allocation.

---

## Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* this task completely

Relevant existing frontend functionality includes:

* application shell;
* Watchlist tabs;
* active-Watchlist state;
* `watchlistApi.ts`;
* `watchlistShell.ts`;
* Watchlist stock table;
* loading/error/empty states;
* Playwright E2E foundation.

Relevant existing API endpoints include:

```http
GET    /api/watchlists
POST   /api/watchlists
PUT    /api/watchlists/active
DELETE /api/watchlists/active
GET    /api/watchlists/{watchlistId}
```

The backend already owns:

* Watchlist-name validation;
* Watchlist ID generation;
* duplicate-name allowance;
* newly created Watchlist becoming active;
* deterministic replacement selection after deletion.

Do not duplicate these business rules in the client.

---

## 1. Client API Extension

Extend the existing client-side Watchlist API boundary with operations conceptually equivalent to:

```ts
createWatchlist(name: string)
deleteActiveWatchlist()
```

Use the existing REST endpoints:

```http
POST /api/watchlists
DELETE /api/watchlists/active
```

Do not place raw `fetch()` calls directly in Svelte components.

Reuse the existing client API error representation.

---

## 2. Create Request

Creating a Watchlist sends:

```http
POST /api/watchlists
Content-Type: application/json
```

with:

```json
{
  "name": "Dividend"
}
```

Do not send:

* Watchlist ID;
* user ID;
* active flag;
* symbols.

The server owns those values.

---

## 3. Create Response

The existing API returns updated Watchlist metadata.

Use that response as the source of truth.

The server guarantees that the newly created Watchlist becomes active.

After successful creation:

1. replace/update client Watchlist metadata from the response;
2. use the returned `activeWatchlistId`;
3. load the newly active composed Watchlist through:

```http
GET /api/watchlists/{activeWatchlistId}
```

4. display the resulting content.

Do not independently invent which Watchlist should become active.

---

## 4. New Watchlist Empty State

A newly created Watchlist initially contains:

```text
stocks = []
```

After loading it, display the existing empty-Watchlist state:

```text
This watchlist is empty.
```

Do not render an empty table.

---

## 5. Watchlist Name Input

Add a text input for entering a new Watchlist name.

The control should be placed logically near the Watchlist tabs/management area.

Use an accessible label.

A visible label is preferred where it fits the layout; an appropriate accessible name is required in all cases.

Do not rely solely on an unlabeled placeholder.

---

## 6. Create Button

Place a button adjacent or logically associated with the Watchlist-name input.

The visual control may use:

```text
+
```

if it has an accessible name such as:

```text
Add watchlist
```

or:

```text
Create watchlist
```

Do not use a clickable generic `<div>`.

Use a real `<button>`.

---

## 7. Create by Button

Entering a valid name and activating the create button must trigger the create workflow.

Do not require a page reload.

---

## 8. Create by Enter

When focus is in the Watchlist-name input, pressing:

```text
Enter
```

should submit the create action.

Prefer a semantic:

```html
<form>
```

with submit behavior rather than custom keyboard handling where practical.

Do not create duplicate requests from simultaneous form/button handlers.

---

## 9. Basic Client Validation

The server remains authoritative for Watchlist-name validation.

However, the client may prevent obviously meaningless requests for:

```text
""
"   "
```

by disabling submission or refusing to submit.

Do not introduce client-only restrictions on:

* duplicate names;
* punctuation;
* casing;
* name length

unless already defined by the backend/API.

The client must not reject a name the server considers valid.

---

## 10. Name Trimming

The backend already trims Watchlist names.

The client may trim before submission for cleaner request behavior.

Do not create a different normalization rule.

After creation, display the server-returned Watchlist name rather than assuming the local input is authoritative.

---

## 11. Duplicate Watchlist Names

Duplicate Watchlist names are valid.

The UI MUST allow:

```text
Dividend
Dividend
```

to coexist.

The tabs remain identified by Watchlist ID.

Do not:

* reject duplicate names;
* disable creation because a name already exists;
* use name as the tab key.

---

## 12. Clear Input After Success

After successful Watchlist creation, clear the Watchlist-name input.

Do not clear it before the server confirms success.

If creation fails, preserve the entered value so the user can correct or retry it.

---

## 13. Create Loading State

While creation is in progress:

* prevent duplicate submissions;
* provide a lightweight busy indication;
* keep existing Watchlist content usable where practical.

A disabled create button with appropriate text/accessibility state is sufficient.

Do not introduce a loading library.

---

## 14. Create Failure

If:

```http
POST /api/watchlists
```

fails:

* keep the existing active Watchlist unchanged;
* keep existing tabs unchanged;
* preserve the entered name;
* display an understandable error.

Use the existing client API error semantics.

Do not optimistically add a tab before server success.

---

## 15. Successful Create Followed by GET Failure

A distinct failure mode is:

```text
POST create succeeds
        |
        v
new Watchlist is active on server
        |
        v
GET composed new Watchlist fails
```

In this case:

* metadata must reflect the successful server mutation;
* the new Watchlist tab remains active;
* the name input is cleared because creation succeeded;
* content area displays the load error.

Do not revert to the previous active Watchlist because the server has already persisted the new active state.

This follows the same state principle established for tab switching.

---

# Delete Current Watchlist

## 16. Delete Control

Add a control for deleting the currently active Watchlist.

Use a real button with an accessible name such as:

```text
Delete current watchlist
```

The visible representation may be concise.

Do not use a generic clickable element.

---

## 17. Delete Disabled Without Watchlist

When no Watchlist exists:

```text
watchlists.length === 0
```

the delete control must be disabled.

The UI should still show the existing:

```text
No watchlist has been created yet.
```

state.

Do not send:

```http
DELETE /api/watchlists/active
```

when there is no active Watchlist.

---

## 18. Confirmation Required

Unlike the legacy application, deletion in the new application requires confirmation.

Activating the delete control must first present a confirmation UI.

Do NOT immediately call the DELETE endpoint.

---

## 19. Confirmation Implementation

Use the smallest accessible confirmation implementation.

A native:

```ts
window.confirm(...)
```

is acceptable for V1 if it keeps the implementation simple and is testable with Playwright.

A small application dialog is also acceptable if implemented cleanly.

Do not introduce a modal/dialog library.

Do not build an elaborate reusable modal framework solely for this action.

---

## 20. Confirmation Message

The confirmation must clearly identify the destructive action.

Prefer including the active Watchlist name.

Conceptually:

```text
Delete watchlist "Dividend"?
```

The user must be able to distinguish:

* confirm;
* cancel.

Do not use ambiguous text such as:

```text
Are you sure?
```

without identifying what will be deleted.

---

## 21. Cancel Deletion

If the user cancels confirmation:

* do not call the DELETE endpoint;
* do not change tabs;
* do not change active Watchlist;
* do not clear current content.

Cancellation is not an error.

---

## 22. Delete Request

After confirmation, call:

```http
DELETE /api/watchlists/active
```

The client does not send:

* Watchlist ID;
* user ID.

The backend deletes the persisted active Watchlist.

This preserves the server-side rule that deletion acts on the current active Watchlist.

---

## 23. Delete Response

The DELETE endpoint returns updated Watchlist metadata.

Use that response as the source of truth.

Do not independently reproduce the backend's replacement-selection algorithm.

In particular, the client must not calculate:

```text
previous tab
```

itself.

The backend already determines the new:

```text
activeWatchlistId
```

according to the established rule.

---

## 24. Delete with Remaining Watchlists

After successful deletion, if the returned metadata contains another active Watchlist:

1. update tabs/metadata;
2. set the returned active ID;
3. request:

```http
GET /api/watchlists/{activeWatchlistId}
```

4. display that Watchlist.

Do not perform an additional:

```http
PUT /api/watchlists/active
```

because deletion already persisted the replacement active Watchlist.

---

## 25. Delete Final Watchlist

If deletion returns:

```text
watchlists = []
```

then:

* clear active Watchlist ID;
* clear active composed Watchlist;
* render the no-Watchlists state;
* keep delete disabled.

Do not issue a composed-Watchlist GET.

---

## 26. Delete Loading State

While deletion is in progress:

* prevent another delete request;
* prevent conflicting Watchlist-management mutations where practical;
* provide a lightweight busy state.

Do not leave the delete button active such that double-clicking can send multiple DELETE requests.

---

## 27. Delete Failure

If:

```http
DELETE /api/watchlists/active
```

fails:

* keep existing metadata;
* keep the current active tab;
* keep current content;
* display an understandable error.

Do not optimistically remove the tab before server success.

---

## 28. Successful Delete Followed by GET Failure

A distinct failure mode is:

```text
DELETE succeeds
        |
        v
server selects replacement Watchlist
        |
        v
GET replacement Watchlist fails
```

In this case:

* deleted tab remains removed;
* returned metadata remains authoritative;
* replacement tab remains active;
* content area displays the load error.

Do not restore the deleted Watchlist in client state.

The server mutation already succeeded.

---

# State and Orchestration

## 29. Extend Existing UI Orchestration

Extend the existing client orchestration cleanly rather than placing all mutation sequencing directly into `+page.svelte`.

Existing responsibilities in:

```text
watchlistShell.ts
```

or an appropriately focused new client module may be extended.

Keep:

```text
+page.svelte
```

primarily responsible for Svelte state and UI event wiring.

Do not create a global state-management framework.

---

## 30. Mutation Race Safety

Prevent conflicting mutations from producing inconsistent client state.

At minimum, while a create/delete operation is active:

* prevent the same operation from being submitted again;
* avoid allowing another management action to overwrite the in-flight result.

Keep the solution simple.

Do not implement a generic request queue.

---

## 31. Tab Switching During Management Mutation

It is acceptable to temporarily disable tab switching during a create/delete mutation if that is the simplest way to preserve consistent state.

If existing tab disabling/loading semantics already provide sufficient protection, reuse them.

Do not introduce complicated concurrent-state resolution.

---

## 32. Error State

Use a clear UI error state for management-operation failures.

Reuse the existing shell's error presentation where appropriate.

Do not display:

* raw exception objects;
* stack traces;
* HTTP response dumps.

Do not discard the existing Watchlist content merely because a management mutation failed.

---

## 33. Error Clearing

A successful subsequent operation should clear the corresponding stale management error.

Do not leave a previous:

```text
Failed to create watchlist
```

message visible after a later successful creation.

Keep error ownership understandable.

---

# Responsive Design

## 34. Management Layout

The create controls, tabs, and delete control must work on both:

* desktop;
* narrow/mobile viewports.

A desktop layout may place controls on one line where space permits.

A narrow layout may wrap or stack controls.

Do not force all controls into one unbroken horizontal row.

---

## 35. Narrow Viewport

At approximately:

```text
375px
```

verify:

* Watchlist-name input remains usable;
* create button remains reachable;
* delete control remains reachable;
* tabs remain usable;
* no page-level horizontal overflow is introduced.

The stock table may continue to scroll inside its own container.

---

## 36. Input Sizing

The Watchlist-name input should grow sensibly on desktop while remaining usable on mobile.

Avoid hard-coded wide pixel widths.

Use Flexbox/Grid/native responsive sizing.

---

# Accessibility

## 37. Form Accessibility

The create form must have:

* accessible input label/name;
* real submit button;
* visible keyboard focus;
* usable Enter submission.

Do not disable browser zoom.

---

## 38. Delete Accessibility

The delete control must:

* be a real button;
* expose its disabled state;
* have an understandable accessible name;
* remain keyboard operable.

Confirmation must also be keyboard usable.

---

## 39. Busy State Accessibility

Where controls are disabled during requests, expose state clearly enough that users understand the action is in progress.

Use native `disabled` and/or `aria-busy` where appropriate.

Do not rely solely on color changes.

---

# Playwright E2E

## 40. Permanent E2E Spec

Create:

```text
tests/e2e/watchlist-management.spec.ts
```

for the user-facing behavior introduced by this task.

Do not create temporary Playwright scripts for these repeatable workflows.

Extend shared E2E routing helpers/fixtures where useful.

---

## 41. Deterministic API Interception

Normal E2E tests must continue to intercept application API responses.

Do not require:

* Cloudflare;
* KV;
* Yahoo;
* Frankfurter.

The tests should model the state transitions returned by the real REST API.

---

## 42. E2E: Create First Watchlist

Start with:

```text
watchlists = []
```

Enter:

```text
Main
```

and submit.

Verify:

1. `POST /api/watchlists` receives `{ name: "Main" }`;
2. returned metadata contains the new active Watchlist;
3. client requests the new composed Watchlist;
4. new tab appears active;
5. empty-Watchlist state appears;
6. input is cleared.

---

## 43. E2E: Create Additional Watchlist

Start with an existing active Watchlist.

Create:

```text
Dividend
```

Verify:

* existing tab remains;
* new tab is appended;
* new tab becomes active according to server response;
* new composed Watchlist is loaded;
* no separate active-Watchlist PUT is required.

---

## 44. E2E: Duplicate Names

Create a Watchlist with the same name as an existing one.

Verify:

* creation is allowed;
* both tabs remain visible;
* tabs remain distinct by identity;
* returned active ID determines which duplicate-name tab is active.

---

## 45. E2E: Create via Enter

Enter a Watchlist name and press:

```text
Enter
```

Verify exactly one POST request is sent.

Do not allow duplicate form/button submission.

---

## 46. E2E: Invalid Empty Name

Verify empty/whitespace-only input does not send a POST request.

Do not depend solely on the server error for this obvious case.

---

## 47. E2E: Create Failure

Return a stable API error from:

```http
POST /api/watchlists
```

Verify:

* no new tab appears;
* old active tab/content remain;
* input value remains;
* error is visible.

---

## 48. E2E: Create Success / Load Failure

Return successful metadata from POST but fail:

```http
GET /api/watchlists/{newId}
```

Verify:

* new tab exists;
* new tab is active;
* input is cleared;
* content error is shown;
* previous tab is not restored as active.

---

## 49. E2E: Delete Cancel

Trigger deletion and cancel confirmation.

Verify:

```text
DELETE /api/watchlists/active
```

is never sent.

Existing tabs/content remain unchanged.

---

## 50. E2E: Delete with Replacement

Start with at least three Watchlists and an active middle Watchlist.

Confirm deletion.

Return metadata representing the backend-selected previous Watchlist.

Verify:

* exactly one DELETE is sent;
* deleted tab disappears;
* returned active tab is selected;
* replacement composed Watchlist is loaded;
* no active-Watchlist PUT is sent.

Do not calculate replacement selection inside the test UI state; model the server response.

---

## 51. E2E: Delete First Watchlist

Return metadata where deleting the first active Watchlist causes the new first Watchlist to become active.

Verify the UI follows the returned active ID.

This protects the server/client contract without duplicating the replacement algorithm in client code.

---

## 52. E2E: Delete Final Watchlist

Start with one Watchlist.

Confirm deletion.

Return:

```json
{
  "watchlists": []
}
```

Verify:

* tab disappears;
* no composed-Watchlist GET follows;
* no-Watchlists state appears;
* delete button is disabled.

---

## 53. E2E: Delete Failure

Make DELETE fail.

Verify:

* current tab remains;
* current content remains;
* error is shown;
* no replacement GET is issued.

---

## 54. E2E: Delete Success / Replacement Load Failure

Make DELETE succeed with replacement metadata, then make replacement GET fail.

Verify:

* deleted tab remains gone;
* replacement tab remains active;
* error is displayed in the content area;
* deleted Watchlist is not restored.

---

## 55. E2E: Mobile Management Layout

Under the mobile Chromium project, verify:

* create input visible and usable;
* create button visible/reachable;
* delete button visible/reachable;
* tabs usable;
* no page-level horizontal overflow.

Do not assert brittle exact positions.

---

# Unit Tests

## 56. Client API Tests

Extend:

```text
watchlistApi.spec.ts
```

for:

```text
createWatchlist
deleteActiveWatchlist
```

At minimum verify:

* endpoint;
* HTTP method;
* request body for create;
* successful metadata parsing;
* stable API error handling.

---

## 57. Orchestration Tests

Extend:

```text
watchlistShell.spec.ts
```

or add a focused management-orchestration spec if that keeps responsibilities clearer.

Test state-transition logic such as:

* create success;
* create success followed by load failure;
* delete with replacement;
* delete final Watchlist;
* delete failure.

Do not duplicate every Playwright test at unit level.

Focus unit tests on orchestration decisions that are easier to diagnose without a browser.

---

# Runtime Verification

## 58. Real Runtime Smoke Test

In addition to deterministic Playwright tests, perform a small real integration smoke test under the documented Cloudflare runtime.

Using synthetic local Access identity and local KV:

1. create a Watchlist through the UI;
2. verify it becomes active;
3. delete it through the UI;
4. confirm deletion;
5. verify the resulting server state/UI.

Do not use temporary external Playwright scripts for these repeatable user flows.

If the normal deterministic Playwright suite cannot target the real Cloudflare runtime configuration directly, a short manual browser verification is acceptable for this integration smoke test.

Do not add permanent integration-test complexity solely for this task.

---

## 59. No Real Provider Requirement

Watchlist create/delete does not require Yahoo or Frankfurter.

The runtime smoke test should not add stocks solely to exercise providers.

Keep it focused on:

```text
UI
→ REST
→ Access
→ KV
```

---

# Documentation

## 60. Architecture Documentation

Update `ARCHITECTURE.md` only where necessary to clarify the UI management workflow.

Ensure it reflects:

* Watchlist creation occurs through the REST API;
* server-returned metadata is authoritative;
* newly created Watchlist becomes active;
* duplicate Watchlist names remain allowed;
* Watchlist deletion requires client confirmation;
* deletion acts on the server-side active Watchlist;
* client does not reproduce replacement-tab selection logic;
* after successful mutation, the client loads the returned active Watchlist;
* deletion of the final Watchlist produces the no-Watchlists UI state;
* create/delete UI uses native responsive controls without a UI framework.

Do not rewrite unrelated sections.

---

## 61. README

Update README only if developer/test commands change.

This task should normally require no README changes because Playwright commands already exist.

Do not add end-user documentation unless there is a concrete need.

---

## Non-Goals

Do NOT implement:

* stock add UI;
* stock remove UI;
* Target Price editing;
* filtering;
* sorting;
* table footer counts;
* investment allocation UI;
* Watchlist rename;
* Watchlist reorder;
* drag and drop;
* custom modal framework;
* UI component library;
* CSS framework;
* login/logout UI;
* production deployment.

Do not modify backend Watchlist business rules.

---

## Acceptance Criteria

The task is complete when all of the following are true:

1. Watchlist-name input exists.
2. Input has an accessible label/name.
3. Create button exists and is accessible.
4. Create can be submitted by button.
5. Create can be submitted by Enter.
6. Empty/whitespace names do not send requests.
7. No client-only duplicate-name restriction exists.
8. `POST /api/watchlists` is called through the client API boundary.
9. No client-provided Watchlist ID/user ID is sent.
10. Server-returned metadata becomes client source of truth after create.
11. Newly created Watchlist becomes active according to returned metadata.
12. Newly active composed Watchlist is loaded.
13. Successful create clears the name input.
14. Failed create preserves the name input.
15. Failed create preserves existing tabs/content.
16. Create success followed by GET failure keeps the new tab active.
17. Duplicate Watchlist names remain supported.
18. Delete-current-Watchlist button exists.
19. Delete button is disabled when no Watchlist exists.
20. Delete requires confirmation.
21. Cancelled deletion sends no DELETE request.
22. Confirmed deletion calls `DELETE /api/watchlists/active`.
23. Client sends no Watchlist ID/user ID for deletion.
24. Server-returned metadata becomes source of truth after deletion.
25. Client does not reproduce replacement-Watchlist selection logic.
26. Remaining active Watchlist is loaded after deletion.
27. No extra active-Watchlist PUT is sent after deletion.
28. Deleting the final Watchlist produces the no-Watchlists state.
29. Final deletion does not issue a composed-Watchlist GET.
30. Delete failure preserves existing tabs/content.
31. Delete success followed by GET failure keeps the server-selected replacement tab active.
32. Duplicate mutation submissions are prevented.
33. Existing tab-switch behavior remains functional.
34. No business logic is moved into Svelte components.
35. Raw fetch calls are not introduced into Svelte components.
36. Create/delete controls are responsive.
37. Mobile layout has no page-level horizontal overflow.
38. Controls remain keyboard accessible.
39. Permanent `watchlist-management.spec.ts` exists.
40. Create-first-Watchlist E2E behavior is covered.
41. Create-additional-Watchlist E2E behavior is covered.
42. Duplicate-name E2E behavior is covered.
43. Enter-submit behavior is covered.
44. Invalid-empty-name behavior is covered.
45. Create-failure behavior is covered.
46. Create-success/load-failure behavior is covered.
47. Delete-cancel behavior is covered.
48. Delete-with-replacement behavior is covered.
49. Delete-first behavior is covered.
50. Delete-final behavior is covered.
51. Delete-failure behavior is covered.
52. Delete-success/load-failure behavior is covered.
53. Mobile management layout is covered.
54. Client API tests cover create/delete operations.
55. Client orchestration tests cover the important state transitions.
56. `npm run test:e2e` remains independent of Cloudflare/Yahoo/Frankfurter.
57. A focused real Cloudflare Access/KV smoke test is performed.
58. No new UI framework/component library is introduced.
59. Existing project checks pass.
60. `ARCHITECTURE.md` remains consistent with the implemented workflow.
61. No unrelated product functionality is implemented.

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
→ create Watchlist
→ REST
→ local KV
→ active state
→ confirmation
→ delete Watchlist
→ local KV
→ resulting UI
```

Use synthetic local Access identity.

Do not report a verification step as successful unless it was actually executed successfully.

Do not create temporary external Playwright scripts for the repeatable product behavior covered by this task.

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
2. final create-Watchlist UI structure;
3. final delete-Watchlist UI structure;
4. confirmation implementation chosen;
5. client API functions added;
6. client orchestration/state changes;
7. create-success flow;
8. create-failure flow;
9. create-success/load-failure flow;
10. duplicate-name behavior;
11. delete-cancel flow;
12. delete-success/replacement flow;
13. final-Watchlist deletion flow;
14. delete-failure flow;
15. delete-success/load-failure flow;
16. mutation race/busy-state behavior;
17. responsive/mobile behavior;
18. accessibility behavior;
19. client API tests added;
20. orchestration unit tests added;
21. Playwright scenarios added;
22. real Cloudflare Access/KV smoke-test result;
23. changes made to `ARCHITECTURE.md`;
24. README changes, if any;
25. results of `test`, `test:e2e`, `check`, `lint`, and `build`;
26. confirmation that no stock/Target Price/filtering/sorting/allocation UI was implemented;
27. confirmation that no temporary external Playwright scripts were used for repeatable product behavior;
28. confirmation that this task's status was changed to `Done`;
29. assumptions or unresolved issues;
30. deviations from this task or `ARCHITECTURE.md`.

Do not proceed to stock management, Target Price editing, filtering, sorting, or investment-allocation UI.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
