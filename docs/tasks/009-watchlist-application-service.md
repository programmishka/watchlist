# TASK-009: Watchlist Application Service

## Status

Done

## Goal

Implement the server-side application service for managing a user's Watchlists and their symbol memberships.

This task introduces the first application/use-case layer above the persistence repositories.

The service must implement:

* loading a user's Watchlists;
* creating a Watchlist;
* selecting the active Watchlist;
* deleting the active Watchlist;
* adding a symbol to a Watchlist;
* removing a symbol from a Watchlist.

The service operates on a trusted server-provided `userId`.

It must preserve the established separation between:

```text
Authentication
      |
      v
trusted userId
      |
      v
WatchlistApplicationService
      |
      v
WatchlistRepository
```

This task does not implement REST APIs, Svelte UI, Yahoo symbol validation, or Target Price operations.

---

## Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* this task completely

Relevant existing production code includes:

* `AuthenticatedUser`;
* Cloudflare Access authentication context;
* `WatchlistRepository`;
* `TargetPriceRepository`;
* Cloudflare KV repository implementations;
* existing domain calculations and external providers.

TASK-007 introduced:

```ts
interface Watchlist {
  id: string;
  name: string;
  symbols: string[];
}

interface WatchlistsDocument {
  activeWatchlistId?: string;
  watchlists: Watchlist[];
}
```

and:

```ts
interface WatchlistRepository {
  get(userId: string): Promise<WatchlistsDocument>;
  save(userId: string, document: WatchlistsDocument): Promise<void>;
}
```

Use these existing contracts rather than introducing a second Watchlist persistence model.

---

## 1. Application Service Boundary

Introduce a small server-side Watchlist application service.

Conceptually:

```ts
class WatchlistService {
  // use cases
}
```

or an equivalent functional design.

The exact implementation style may follow existing project conventions.

The service must depend on the application-owned:

```text
WatchlistRepository
```

abstraction rather than directly on Cloudflare KV.

Do not instantiate or access `WATCHLIST_KV` inside the application service.

---

## 2. Trusted User ID

All service operations are scoped by:

```text
userId
```

supplied by a trusted server-side caller.

The service does NOT obtain the user ID from:

* request parameters;
* request bodies;
* URL paths;
* browser state.

Authentication-to-service wiring belongs to a later REST/server-route task.

Do not modify the repository's existing user-ID validation semantics.

---

## 3. Load Watchlists

Implement a use case for loading all Watchlists belonging to a user.

The service should return the persisted:

```ts
WatchlistsDocument
```

or an application-owned equivalent if a small additional result type is justified.

For a new user with no persisted document, the repository already provides:

```ts
{
  activeWatchlistId: undefined,
  watchlists: []
}
```

The service must preserve this legitimate empty state.

Do not automatically create a default Watchlist.

---

## 4. Create Watchlist

Implement creation of a new Watchlist.

Input:

```text
userId
name
```

The service must:

1. validate the Watchlist name;
2. load the user's current Watchlists;
3. generate a unique Watchlist ID;
4. append the new Watchlist;
5. make the newly created Watchlist active;
6. save the updated document;
7. return the created Watchlist and/or updated document in a useful application-level result.

### New Watchlist Shape

A newly created Watchlist starts with:

```ts
{
  id: '<generated-id>',
  name: '<supplied-name>',
  symbols: []
}
```

### Duplicate Names

Duplicate Watchlist names are explicitly allowed.

For example:

```text
Dividend
Dividend
```

is valid as long as the two Watchlists have different IDs.

---

## 5. Watchlist Name Validation

A Watchlist name must contain meaningful text.

At minimum reject:

```text
""
"   "
```

Leading/trailing whitespace should not become part of the persisted Watchlist name.

Therefore normalize:

```text
"  Dividend  "
```

to:

```text
"Dividend"
```

before persistence.

Do not introduce arbitrary restrictions on punctuation, casing, or duplicate names.

Do not introduce a maximum length unless an existing framework/storage constraint makes one necessary and it is documented.

---

## 6. Watchlist ID Generation

Every created Watchlist must receive a unique ID.

Use a runtime-appropriate standard identifier mechanism.

Prefer a UUID generated using platform-standard functionality where available.

Do not:

* derive the ID from the Watchlist name;
* use the array index as the ID;
* require the client to provide the ID;
* use a global incrementing counter;
* introduce an external ID-generation dependency without a clear need.

The ID-generation mechanism should be testable without relying on nondeterministic assertions.

Inject or otherwise isolate ID generation where appropriate.

Do not introduce a dependency-injection framework.

---

## 7. New Watchlist Becomes Active

After successfully creating a Watchlist:

```text
activeWatchlistId = newlyCreatedWatchlist.id
```

This applies even when other Watchlists already exist.

The newly created Watchlist is appended to the existing Watchlist order.

---

## 8. Select Active Watchlist

Implement a use case to select a Watchlist as active.

Input:

```text
userId
watchlistId
```

The service must:

1. load the user's Watchlists;
2. verify that `watchlistId` exists;
3. set `activeWatchlistId`;
4. persist the updated document.

If the requested Watchlist does not exist, return/throw a small application-level not-found error.

Do not silently clear the active Watchlist.

---

## 9. Delete Active Watchlist

Implement deletion of the currently active Watchlist.

The operation is based on the persisted:

```text
activeWatchlistId
```

rather than accepting an arbitrary Watchlist ID for deletion.

Input:

```text
userId
```

The confirmation dialog belongs to the future UI layer and is NOT part of this service.

The application service assumes that if this use case is called, deletion has already been confirmed by the user at the appropriate interaction boundary.

---

## 10. Delete When No Watchlist Exists

If the user has no Watchlists or no active Watchlist:

* do not perform a meaningless save;
* return/throw an explicit application-level error/result indicating that there is no active Watchlist to delete.

Do not treat this as successful deletion.

The UI will eventually disable the delete action when no Watchlist exists, but the server-side service must still enforce the rule independently.

---

## 11. Active Watchlist After Deletion

When the active Watchlist is deleted and other Watchlists remain, select the replacement deterministically.

Use this rule:

> Select the previous Watchlist in tab order. If the deleted Watchlist was the first Watchlist, select the new first Watchlist.

Examples:

### Delete Middle Watchlist

Before:

```text
A
B  <- active
C
```

After deleting `B`:

```text
A  <- active
C
```

### Delete Last Watchlist

Before:

```text
A
B
C  <- active
```

After deleting `C`:

```text
A
B  <- active
```

### Delete First Watchlist

Before:

```text
A  <- active
B
C
```

After deleting `A`:

```text
B  <- active
C
```

### Delete Only Watchlist

Before:

```text
A <- active
```

After deletion:

```ts
{
  activeWatchlistId: undefined,
  watchlists: []
}
```

The Watchlist order of all remaining entries must otherwise be preserved.

---

## 12. Target Prices Must Remain Untouched

Deleting a Watchlist MUST NOT:

* access `TargetPriceRepository`;
* delete Target Prices;
* inspect Target Prices;
* perform target-price cleanup.

This service should not require `TargetPriceRepository` as a dependency.

Target Prices have an independent lifecycle.

---

## 13. Add Symbol

Implement adding a symbol to a specific Watchlist.

Input:

```text
userId
watchlistId
symbol
```

The service must:

1. validate the symbol input;
2. load the user's Watchlists;
3. locate the requested Watchlist;
4. verify that the symbol does not already exist in that Watchlist;
5. append the symbol;
6. save the updated document.

The symbol is appended to the existing symbol order.

---

## 14. Symbol Validation

At this layer, perform only basic input validation.

At minimum reject:

```text
""
"   "
```

Leading/trailing whitespace should not be persisted.

Therefore:

```text
"  AAPL  "
```

becomes:

```text
"AAPL"
```

Do not implement Yahoo symbol existence validation in this task.

Do not automatically:

* uppercase symbols;
* rewrite exchange suffixes;
* remove punctuation;
* transform Yahoo symbol syntax.

For example:

```text
HEXA-B.ST
LISP.SW
GAW.L
```

must remain valid symbol strings.

---

## 15. Duplicate Symbol

A symbol may occur at most once in a specific Watchlist.

If:

```text
AAPL
```

already exists in Watchlist A, attempting to add:

```text
AAPL
```

again to Watchlist A must fail with an explicit application-level duplicate-symbol error/result.

Do not silently ignore the request.

Do not save an unchanged document after detecting the duplicate.

---

## 16. Symbol Comparison

For the initial implementation, symbol identity is exact after trimming surrounding whitespace.

Do not introduce case-insensitive symbol equivalence unless separately specified.

For example, the application layer does not currently decide whether:

```text
aapl
AAPL
```

are equivalent.

A future Yahoo-validation/composition task may establish stronger normalization rules.

Avoid silently introducing such behavior now.

---

## 17. Same Symbol Across Watchlists

The same symbol may exist in different Watchlists.

Example:

```text
Watchlist A:
AAPL
SAP.DE

Watchlist B:
AAPL
GAW.L
```

is valid.

Duplicate detection is scoped to one Watchlist only.

---

## 18. Add Symbol to Missing Watchlist

If the supplied `watchlistId` does not exist for the user:

* fail with an explicit application-level Watchlist-not-found result/error;
* do not create a Watchlist implicitly;
* do not save an unchanged document.

---

## 19. Remove Symbol

Implement removing a symbol from a specific Watchlist.

Input:

```text
userId
watchlistId
symbol
```

The service must:

1. validate the symbol input;
2. load the user's Watchlists;
3. locate the requested Watchlist;
4. locate the symbol using exact symbol identity;
5. remove it from that Watchlist only;
6. preserve the order of all remaining symbols;
7. save the updated document.

---

## 20. Remove Missing Symbol

If the requested symbol does not exist in the selected Watchlist:

* fail with an explicit application-level symbol-not-found result/error;
* do not save an unchanged document.

Do not silently treat the operation as successful.

---

## 21. Removing Symbol Does Not Affect Other Watchlists

Given:

```text
Watchlist A:
AAPL
SAP.DE

Watchlist B:
AAPL
GAW.L
```

removing:

```text
AAPL
```

from Watchlist A produces:

```text
Watchlist A:
SAP.DE

Watchlist B:
AAPL
GAW.L
```

Watchlist B must remain unchanged.

---

## 22. Removing Symbol Does Not Affect Target Prices

Removing a symbol MUST NOT:

* access `TargetPriceRepository`;
* delete its Target Price;
* inspect whether the symbol exists in another Watchlist;
* perform target-price cleanup.

The Target Price remains persistent user knowledge independent of current Watchlist membership.

---

## 23. Application Error Model

Introduce the smallest practical application-level errors/results required by these use cases.

At minimum callers must be able to distinguish:

```text
invalid Watchlist name
Watchlist not found
no active Watchlist
invalid symbol
duplicate symbol
symbol not found
```

Repository/persistence failures should continue to propagate as the existing persistence error rather than being incorrectly converted to business not-found errors.

Do not introduce a large general-purpose exception hierarchy.

Follow the project's existing style where practical.

---

## 24. Persistence Failure

Application mutations follow:

```text
load
  |
modify in memory
  |
save
```

If repository `save()` fails:

* propagate the persistence failure;
* do not report the application operation as successful;
* do not attempt manual rollback logic.

No cross-document transaction is involved in this task.

---

## 25. Immutability / Mutation Safety

Prefer creating updated application data rather than mutating repository-returned documents in surprising ways.

The service should have clear ownership of the modified result.

Tests should be able to verify both:

* what is saved;
* what is returned.

Do not introduce a stateful in-memory Watchlist cache.

Each use case should operate from repository state.

---

## 26. No Market Data Yet

Adding a symbol in this task means:

> Add this symbol string to this Watchlist.

It does NOT yet mean:

> Verify that Yahoo Finance recognizes the symbol.

Therefore this task MUST NOT depend on:

```text
MarketDataProvider
YahooFinanceAdapter
```

Yahoo validation will be introduced by a later application-composition task.

This separation is intentional.

---

## 27. No Target Price Logic Yet

Adding a symbol does not need to load its existing Target Price in this task.

The persisted Target Price already exists independently and will be composed into the Watchlist view later.

Do not depend on:

```text
TargetPriceRepository
```

in `WatchlistService`.

---

## 28. No Authentication Integration Yet

The service receives:

```text
userId
```

as a trusted server-side parameter.

Do not make the service depend directly on:

```text
AuthenticatedUser
AuthenticationContext
event.locals
ctx.access
```

The later HTTP/server-route layer will connect:

```text
event.locals.user.id
       |
       v
WatchlistService
```

Keeping the service independent of SvelteKit request objects makes it easier to test.

---

## 29. Server-Only Implementation

The application service belongs under the existing server-only structure.

It MUST NOT be importable into browser code.

Do not implement Watchlist mutation logic in:

* `.svelte` components;
* client stores;
* browser utilities.

---

## 30. Testing Strategy

Unit tests for this service MUST use a fake/in-memory implementation of:

```text
WatchlistRepository
```

Do not require:

* Cloudflare KV;
* Cloudflare Access;
* Yahoo Finance;
* Frankfurter;
* network access;
* Svelte components.

The tests should focus on application behavior and repository interaction.

---

## 31. Required Load Tests

At minimum test:

### Existing Watchlists

Returns the repository document.

### No Watchlists

Returns:

```ts
{
  activeWatchlistId: undefined,
  watchlists: []
}
```

without creating a default Watchlist or performing a save.

---

## 32. Required Create Tests

At minimum test:

### First Watchlist

Creating:

```text
Main
```

for an empty user produces one empty Watchlist and makes it active.

### Additional Watchlist

The new Watchlist is appended and becomes active.

### Duplicate Name

Two Watchlists may have the same name but must have different IDs.

### Trim Name

```text
"  Dividend  "
```

is persisted as:

```text
"Dividend"
```

### Empty Name

Reject without saving.

### Whitespace Name

Reject without saving.

### Generated ID

Verify that the configured/generated ID is used and the client/user input cannot determine it.

---

## 33. Required Active-Watchlist Tests

At minimum test:

### Select Existing Watchlist

Changes `activeWatchlistId` and persists.

### Select Missing Watchlist

Fails without saving.

---

## 34. Required Delete Tests

At minimum test:

### Delete Only Watchlist

Leaves:

```ts
{
  activeWatchlistId: undefined,
  watchlists: []
}
```

### Delete First of Several

New first Watchlist becomes active.

### Delete Middle

Previous Watchlist becomes active.

### Delete Last

Previous Watchlist becomes active.

### Order Preservation

Remaining Watchlists preserve their relative order.

### No Active Watchlist

Fails explicitly and does not save.

### Empty User

Fails explicitly and does not save.

### No Target Price Interaction

Verify by design/dependencies that deletion does not require or access a Target Price repository.

---

## 35. Required Add-Symbol Tests

At minimum test:

### Add to Empty Watchlist

Symbol is appended.

### Add to Existing Symbols

Existing order is preserved and new symbol is appended.

### Trim Symbol

```text
"  GAW.L  "
```

is persisted as:

```text
"GAW.L"
```

### Empty Symbol

Reject without saving.

### Whitespace Symbol

Reject without saving.

### Duplicate Symbol

Reject without saving.

### Missing Watchlist

Reject without saving.

### Same Symbol in Another Watchlist

Allowed.

### No Symbol Rewriting

Verify that a symbol such as:

```text
HEXA-B.ST
```

is persisted unchanged.

---

## 36. Required Remove-Symbol Tests

At minimum test:

### Remove Existing Symbol

Removes only that symbol.

### Preserve Symbol Order

Remaining symbols preserve their order.

### Remove from One Watchlist Only

The same symbol in another Watchlist remains untouched.

### Missing Symbol

Fails without saving.

### Missing Watchlist

Fails without saving.

### Trim Input

Surrounding whitespace is removed before exact lookup.

### Target Price Independence

No Target Price repository interaction exists.

---

## 37. User Isolation

The service must pass the supplied trusted `userId` unchanged to the Watchlist repository.

Explicitly test that operations for:

```text
user-1
user-2
```

remain isolated when using a shared fake repository.

Do not introduce application-global Watchlist state.

---

## 38. Persistence Validation Remains in Repository

Do not duplicate TASK-007's serialized-data validation in the application service.

The repository remains responsible for validating persisted KV documents.

The application service operates on valid application-owned repository data.

Business input validation introduced by this task belongs in the service.

---

## 39. Architecture Documentation

Update `ARCHITECTURE.md` only if a necessary clarification is missing.

In particular, ensure the architecture reflects the agreed active-Watchlist deletion behavior:

> When the active Watchlist is deleted and other Watchlists remain, the previous Watchlist in tab order becomes active. If the first Watchlist is deleted, the new first Watchlist becomes active.

Also ensure the architecture reflects:

* newly created Watchlists become active;
* Watchlist names may be duplicated;
* symbols are unique only within a Watchlist;
* adding/removing symbols does not affect Target Prices.

If these rules are already fully documented, do not modify `ARCHITECTURE.md` unnecessarily.

Do not rewrite unrelated architecture sections.

---

## Non-Goals

Do NOT implement:

* REST endpoints;
* Svelte UI;
* delete confirmation dialog;
* Yahoo symbol validation;
* Yahoo market-data loading;
* Target Price loading;
* Target Price mutation;
* dividend calculation changes;
* market-cap calculation changes;
* investment-allocation changes;
* Cloudflare Access integration changes;
* direct KV access from the service;
* Watchlist sharing;
* Watchlist renaming;
* Watchlist reordering;
* symbol reordering;
* default Watchlist creation;
* persistence caching;
* market-data caching.

Do not add a dependency on `MarketDataProvider` or `TargetPriceRepository`.

---

## Acceptance Criteria

The task is complete when all of the following are true:

1. A server-only Watchlist application service exists.
2. It depends on `WatchlistRepository`, not Cloudflare KV.
3. It accepts a trusted server-side `userId`.
4. Loading Watchlists preserves the legitimate empty state.
5. No default Watchlist is automatically created.
6. Creating a Watchlist validates and trims its name.
7. Duplicate Watchlist names are allowed.
8. Watchlist IDs are generated server-side.
9. Newly created Watchlists are appended.
10. Newly created Watchlists become active.
11. Existing Watchlists can be selected as active.
12. Selecting a missing Watchlist fails explicitly.
13. Deleting the active Watchlist removes only that Watchlist.
14. Deleting the only Watchlist leaves no active Watchlist.
15. Deleting the first Watchlist selects the new first Watchlist.
16. Deleting a middle or last Watchlist selects the previous Watchlist.
17. Remaining Watchlist order is preserved after deletion.
18. Deleting with no active Watchlist fails explicitly.
19. Adding a symbol validates and trims the input.
20. Adding a symbol does not rewrite its Yahoo syntax.
21. Duplicate symbols within one Watchlist are rejected.
22. The same symbol may occur in different Watchlists.
23. Adding to a missing Watchlist fails explicitly.
24. Removing a symbol affects only the selected Watchlist.
25. Remaining symbol order is preserved.
26. Removing a missing symbol fails explicitly.
27. Removing from a missing Watchlist fails explicitly.
28. Neither Watchlist deletion nor symbol removal accesses Target Prices.
29. The service has no `TargetPriceRepository` dependency.
30. The service has no `MarketDataProvider` dependency.
31. The service does not depend on SvelteKit request/authentication objects.
32. Repository persistence failures remain distinguishable from business errors.
33. No unnecessary saves occur for rejected/no-op operations.
34. User isolation is tested.
35. Unit tests require no Cloudflare, Yahoo, Frankfurter, or network access.
36. Existing project checks still pass.
37. No REST API or UI functionality is implemented.
38. No unnecessary production dependency is introduced.
39. `ARCHITECTURE.md` reflects the agreed active-Watchlist deletion rule.
40. No unrelated architecture sections are modified.

---

## Verification

Before completing the task, execute:

```bash
npm run check
npm run test
npm run lint
npm run build
```

All newly introduced tests must pass without:

* Cloudflare;
* KV runtime;
* Access;
* Yahoo Finance;
* Frankfurter;
* network access.

Review any `ARCHITECTURE.md` diff to ensure only necessary Watchlist behavior was clarified.

Do not report a command as successful unless it was actually executed successfully.

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

---

## Completion Report

When finished, report:

1. files added or changed;
2. the final Watchlist application-service API;
3. Watchlist-name validation behavior;
4. ID-generation strategy;
5. create-Watchlist behavior;
6. active-Watchlist selection behavior;
7. active-Watchlist deletion and replacement-selection behavior;
8. symbol validation behavior;
9. duplicate-symbol behavior;
10. remove-symbol behavior;
11. application-level errors/results introduced;
12. confirmation that Target Prices are never accessed or deleted;
13. confirmation that MarketDataProvider is not used;
14. confirmation that authentication/request objects are not dependencies;
15. how user isolation was tested;
16. unit-test scenarios added;
17. changes made to `ARCHITECTURE.md`;
18. results of `check`, `test`, `lint`, and `build`;
19. confirmation that this task's status was changed to `Done`;
20. assumptions or unresolved issues;
21. deviations from this task or `ARCHITECTURE.md`.

Do not proceed to Target Price application services, Yahoo symbol validation/composition, REST APIs, or UI implementation.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
