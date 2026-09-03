# TASK-010: Target Price Application Service

## Status

Done

## Goal

Implement the server-side application service for managing persistent user-specific Target Prices.

A Target Price belongs to:

```text
User + Symbol
```

and explicitly does **not** belong to a Watchlist.

This task implements the application use cases required to:

* load all Target Prices for a user;
* retrieve the Target Price for one symbol;
* set a Target Price for a symbol.

Setting a Target Price must support both:

* creating a new Target Price;
* replacing an existing Target Price.

Target Prices are intentionally long-lived user data and are never automatically deleted when symbols or Watchlists are removed.

This task does not implement REST APIs, UI, Yahoo validation, Watchlist composition, or target-distance recalculation.

---

## Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* this task completely

Relevant existing production code includes:

* `TargetPriceRepository`;
* `TargetPrices`;
* `CloudflareKvTargetPriceRepository`;
* `WatchlistService`;
* target-price-distance domain calculation;
* authentication context.

TASK-007 introduced:

```ts
type TargetPrices = Record<string, number>;

interface TargetPriceRepository {
  get(userId: string): Promise<TargetPrices>;
  save(userId: string, targetPrices: TargetPrices): Promise<void>;
}
```

Reuse these contracts.

Do not introduce another Target Price persistence model.

---

## 1. Application Service Boundary

Introduce a small server-only Target Price application service.

Conceptually:

```ts
class TargetPriceService {
  // use cases
}
```

or an equivalent functional design consistent with the existing project.

The service must depend on:

```text
TargetPriceRepository
```

rather than Cloudflare KV.

It MUST NOT access:

```text
WATCHLIST_KV
```

directly.

---

## 2. Trusted User ID

All operations receive:

```text
userId
```

from a trusted server-side caller.

The service must not derive ownership from:

* request parameters;
* URL paths;
* request bodies;
* browser state;
* email addresses.

Authentication-to-service wiring belongs to a later REST/server-route task.

The service does not need to depend directly on:

* `AuthenticatedUser`;
* `AuthenticationContext`;
* `event.locals`;
* `ctx.access`.

---

## 3. Load Target Prices

Implement:

```text
loadTargetPrices(userId)
```

or an equivalent use case.

The result is the complete Target Price document for the user.

Example:

```json
{
  "AAPL": 200.5,
  "SAP.DE": 220,
  "GAW.L": 185
}
```

For a user with no persisted Target Prices, return:

```json
{}
```

using the repository's established empty-state behavior.

Do not create an empty KV document merely because Target Prices were loaded.

---

## 4. Get Target Price

Implement retrieval of one Target Price by symbol.

Conceptually:

```text
getTargetPrice(userId, symbol)
```

The service must:

1. validate and normalize the symbol input;
2. load the user's Target Prices;
3. return the value associated with the exact normalized symbol.

If no Target Price exists for the symbol, return:

```text
undefined
```

or an equivalently explicit optional result.

A missing Target Price is a legitimate state and MUST NOT be treated as an error.

---

## 5. Set Target Price

Implement:

```text
setTargetPrice(userId, symbol, targetPrice)
```

or an equivalent use case.

The service must:

1. validate and normalize the symbol;
2. validate the Target Price;
3. load the user's current Target Prices;
4. add or replace the entry for that symbol;
5. save the updated Target Price document;
6. return a useful application-level result.

For example:

Before:

```json
{
  "AAPL": 200,
  "SAP.DE": 220
}
```

Calling:

```text
setTargetPrice(userId, "AAPL", 205.5)
```

produces:

```json
{
  "AAPL": 205.5,
  "SAP.DE": 220
}
```

Calling:

```text
setTargetPrice(userId, "GAW.L", 150)
```

then produces:

```json
{
  "AAPL": 205.5,
  "SAP.DE": 220,
  "GAW.L": 150
}
```

---

## 6. Existing Value Is Replaced

Target Price updates use replace semantics.

If an entry already exists for:

```text
User + Symbol
```

the new valid Target Price replaces the old one.

Do not:

* keep Target Price history;
* create multiple values for one symbol;
* merge values;
* average values.

There is exactly one current Target Price per:

```text
User + Symbol
```

---

## 7. Re-Saving the Same Value

Setting the same Target Price again is valid.

For example:

```text
existing:
AAPL = 200

set:
AAPL = 200
```

may perform the normal repository save.

Do not introduce special no-op optimization logic solely to avoid this write.

The application semantics are:

> The requested Target Price is persisted as the current Target Price.

---

## 8. Symbol Validation

Use the same basic symbol-input semantics established by `WatchlistService`.

At minimum:

```text
""
"   "
```

are invalid.

Leading and trailing whitespace is removed.

Therefore:

```text
"  GAW.L  "
```

becomes:

```text
"GAW.L"
```

before lookup or persistence.

Do not automatically:

* uppercase symbols;
* lowercase symbols;
* remove exchange suffixes;
* rewrite punctuation;
* translate Yahoo symbol syntax.

For example:

```text
HEXA-B.ST
LISP.SW
GAW.L
```

must remain unchanged.

---

## 9. Symbol Identity

Target Price identity uses exact symbol matching after trimming.

For the initial implementation:

```text
AAPL
```

and:

```text
aapl
```

are not automatically treated as equivalent by this service.

Do not introduce case normalization without a separate explicit requirement.

A later Yahoo-validation/composition layer may establish stronger symbol canonicalization rules if needed.

---

## 10. Target Price Validation

A Target Price must be:

* numeric;
* finite;
* strictly greater than `0`.

Decimal values are allowed.

Examples of valid values:

```text
1
12.5
200
200.75
```

Examples of invalid values:

```text
0
-1
NaN
Infinity
-Infinity
```

Invalid Target Prices must be rejected before persistence.

Do not silently:

* convert invalid values to `0`;
* round decimal values to integers;
* clamp values;
* replace invalid values with previous values.

---

## 11. Locale Parsing Is Not Part of This Service

The application UI may eventually allow input such as:

```text
123,45
```

for German locale users.

The application service receives a numeric TypeScript value:

```text
123.45
```

Locale-specific string parsing belongs to the HTTP/UI input boundary.

Do not add locale parsing to `TargetPriceService`.

---

## 12. No Delete Operation

Do NOT implement:

```text
deleteTargetPrice(...)
```

Target Prices intentionally survive removal of stocks and Watchlists.

The current domain provides no user-facing Target Price deletion use case.

A Target Price can only:

```text
not exist
    |
    v
be created
    |
    v
be replaced
```

There is no automatic or explicit delete operation in the current scope.

---

## 13. Watchlist Independence

`TargetPriceService` MUST NOT depend on:

```text
WatchlistRepository
WatchlistService
```

The service does not need to know whether a symbol currently occurs in:

* zero Watchlists;
* one Watchlist;
* multiple Watchlists.

All are valid.

For example:

```text
Target Prices:
AAPL = 200
```

remains valid even if no current Watchlist contains `AAPL`.

---

## 14. No Watchlist Membership Validation

Setting:

```text
AAPL = 200
```

must not require `AAPL` to exist in a Watchlist.

Do not load Watchlists before setting or retrieving a Target Price.

This preserves the independent lifecycle of Target Prices.

---

## 15. No Yahoo Validation

Do not call:

```text
MarketDataProvider
YahooFinanceAdapter
```

when loading, retrieving, or setting a Target Price.

This service manages application-owned user data only.

It does not verify whether Yahoo currently recognizes the symbol.

Yahoo validation belongs to later application composition.

---

## 16. No Distance Calculation Yet

Although Target Price influences:

```text
distanceToTarget
```

the service in this task does NOT calculate target-price distance.

The existing pure domain function remains separate.

A later Watchlist composition service will combine:

```text
market price
      +
target price
      |
      v
distanceToTarget
```

Do not add `MarketDataProvider` to this service merely to calculate distance.

---

## 17. No Savings Recalculation

Setting a Target Price must not automatically trigger:

* investment-factor calculation;
* savings allocation;
* invested-total calculation.

The initial application semantics explicitly keep investment allocation as a separate user-triggered operation.

---

## 18. Application Error Model

Introduce only the minimal application-level errors required by this service.

At minimum callers must be able to distinguish:

```text
invalid symbol
invalid target price
```

Reuse an existing error where appropriate if doing so creates a natural dependency and avoids conflicting semantics.

Do not create a large generic error hierarchy.

Persistence failures from `TargetPriceRepository` must continue to propagate as persistence failures.

Do not convert persistence failures into validation errors.

---

## 19. Error Timing

Input validation should happen before repository access where possible.

For example:

```text
setTargetPrice(userId, "", 200)
```

must fail before calling:

```text
repository.get(...)
```

Likewise:

```text
setTargetPrice(userId, "AAPL", -10)
```

must fail before repository access.

This avoids unnecessary KV operations for invalid requests.

---

## 20. Persistence Failure

The mutation flow is:

```text
validate
   |
   v
load current Target Prices
   |
   v
create updated document
   |
   v
save
```

If `save()` fails:

* propagate the persistence error;
* do not report success;
* do not attempt rollback logic.

Only one KV document is involved.

---

## 21. Mutation Safety

Prefer creating a new Target Price document rather than unexpectedly mutating the object returned by the repository.

Conceptually:

```ts
const updated = {
  ...current,
  [symbol]: targetPrice
};
```

The exact implementation may vary.

Do not introduce a Target Price cache.

Each use case should operate from repository state.

---

## 22. Return Values

Choose useful, simple application-level return values.

For example:

```text
loadTargetPrices
    -> TargetPrices

getTargetPrice
    -> number | undefined

setTargetPrice
    -> updated TargetPrices
```

or a small equivalent result for `setTargetPrice`.

Do not return Cloudflare/KV infrastructure details.

Do not return raw repository serialization strings.

---

## 23. User Isolation

The service must pass the trusted supplied:

```text
userId
```

unchanged to `TargetPriceRepository`.

Target Prices belonging to different users must remain isolated.

For example:

```text
user-1:
AAPL = 200

user-2:
AAPL = 250
```

is valid.

Setting `AAPL` for `user-1` must not affect `user-2`.

---

## 24. Server-Only Implementation

The service belongs under the existing server-only project structure.

It MUST NOT be implemented in:

* `.svelte` components;
* client-side stores;
* browser utilities.

The browser must never directly access Target Price persistence.

---

## 25. Testing Strategy

Unit tests must use a fake/in-memory:

```text
TargetPriceRepository
```

and require no:

* Cloudflare KV;
* Cloudflare Access;
* Yahoo Finance;
* Frankfurter;
* network access;
* Svelte UI.

Focus tests on application behavior and repository interaction.

---

## 26. Required Load Tests

At minimum test:

### Existing Target Prices

Given:

```json
{
  "AAPL": 200,
  "SAP.DE": 220
}
```

the service returns the complete document.

### Empty Target Prices

Given no persisted Target Price document, return:

```json
{}
```

without saving anything.

### Persistence Read Failure

The existing persistence error propagates unchanged/appropriately.

---

## 27. Required Get Tests

At minimum test:

### Existing Target Price

```text
AAPL -> 200
```

returns:

```text
200
```

### Decimal Target Price

```text
AAPL -> 200.5
```

returns:

```text
200.5
```

without rounding.

### Missing Target Price

Returns:

```text
undefined
```

without throwing.

### Trim Symbol

```text
"  GAW.L  "
```

looks up:

```text
"GAW.L"
```

### Empty Symbol

Reject before repository access.

### Whitespace Symbol

Reject before repository access.

### Exact Symbol Identity

Do not silently rewrite casing or Yahoo syntax.

---

## 28. Required Set Tests

At minimum test:

### Create New Target Price

Starting from:

```json
{}
```

set:

```text
AAPL = 200
```

and verify the saved document.

### Add to Existing Document

Starting from:

```json
{
  "SAP.DE": 220
}
```

set:

```text
AAPL = 200
```

and verify both values remain.

### Replace Existing Value

Starting from:

```json
{
  "AAPL": 200
}
```

set:

```text
AAPL = 205.5
```

and verify:

```json
{
  "AAPL": 205.5
}
```

### Same Value Again

Starting from:

```json
{
  "AAPL": 200
}
```

set:

```text
AAPL = 200
```

and verify the normal save path is allowed.

### Decimal Value

Verify decimal Target Prices are preserved exactly as normal JavaScript numbers.

### Trim Symbol

```text
"  GAW.L  "
```

is stored as:

```text
"GAW.L"
```

### Empty Symbol

Reject before repository access.

### Whitespace Symbol

Reject before repository access.

### Zero Target Price

Reject before repository access.

### Negative Target Price

Reject before repository access.

### NaN Target Price

Reject before repository access.

### Positive Infinity

Reject before repository access.

### Negative Infinity

Reject before repository access.

### No Symbol Rewriting

Verify a symbol such as:

```text
HEXA-B.ST
```

is persisted unchanged.

### Persistence Save Failure

Propagates the existing persistence failure.

---

## 29. Required Independence Tests

Explicitly verify by design/tests that:

* no `WatchlistRepository` is required;
* no `WatchlistService` is required;
* no `MarketDataProvider` is required;
* no `AuthenticationContext` is required;
* no target-distance calculation occurs;
* no savings calculation occurs.

Do not add fake dependencies merely to assert that they are unused.

Structural absence is sufficient where appropriate.

---

## 30. Required User-Isolation Test

Using a shared fake repository, verify:

```text
user-1:
AAPL = 200

user-2:
AAPL = 250
```

Then update:

```text
user-1:
AAPL = 210
```

and verify:

```text
user-1:
AAPL = 210

user-2:
AAPL = 250
```

The service must not maintain application-global Target Price state.

---

## 31. Relationship to Repository Validation

TASK-007 already validates persisted Target Prices.

Do not duplicate serialized-document validation in this application service.

The repository guarantees that loaded Target Price documents contain valid persisted numeric values.

The service validates new user/application input before persistence.

---

## 32. Architecture Documentation

Update `ARCHITECTURE.md` only if necessary to make the Target Price lifecycle explicit.

Ensure the architecture states that:

* Target Price belongs to `User + Symbol`;
* decimal Target Prices are supported;
* setting a Target Price creates or replaces the value;
* Target Prices have no current delete use case;
* removing a symbol does not remove its Target Price;
* deleting a Watchlist does not remove Target Prices;
* Target Prices may exist even when the symbol belongs to no Watchlist;
* Target Price persistence does not depend on Yahoo validation.

If these rules are already fully documented, avoid unnecessary changes.

Do not rewrite unrelated architecture sections.

---

## Non-Goals

Do NOT implement:

* Target Price deletion;
* Target Price history;
* Watchlist loading;
* Watchlist membership validation;
* Yahoo symbol validation;
* market-data loading;
* target-price-distance calculation in this service;
* automatic savings recalculation;
* investment allocation;
* REST endpoints;
* Svelte UI;
* locale-specific numeric string parsing;
* Cloudflare Access integration changes;
* direct KV access;
* caching;
* stock composition.

Do not add dependencies on `WatchlistRepository`, `WatchlistService`, or `MarketDataProvider`.

---

## Acceptance Criteria

The task is complete when all of the following are true:

1. A server-only Target Price application service exists.
2. It depends on `TargetPriceRepository`, not Cloudflare KV.
3. It accepts a trusted server-side `userId`.
4. All Target Prices for a user can be loaded.
5. The legitimate empty Target Price state remains `{}`.
6. One Target Price can be retrieved by symbol.
7. A missing Target Price returns an explicit optional result rather than an error.
8. A new Target Price can be created.
9. An existing Target Price can be replaced.
10. Setting the same value again is valid.
11. Decimal Target Prices are preserved.
12. Target Price must be finite and strictly greater than zero.
13. Invalid Target Price input is rejected before repository access.
14. Symbol input is trimmed.
15. Empty/whitespace symbol input is rejected before repository access.
16. Symbols are not otherwise rewritten.
17. Symbol identity remains exact after trimming.
18. No Target Price delete operation is introduced.
19. The service has no Watchlist repository/service dependency.
20. Target Prices may exist without Watchlist membership.
21. The service has no MarketDataProvider dependency.
22. No Yahoo validation occurs.
23. No target-distance calculation occurs in this service.
24. No savings recalculation occurs.
25. Repository persistence failures remain distinguishable from business validation errors.
26. Mutation code does not introduce a stateful Target Price cache.
27. User isolation is tested.
28. Unit tests require no Cloudflare, Yahoo, Frankfurter, or network access.
29. Existing project checks still pass.
30. No REST API or UI functionality is implemented.
31. No unnecessary production dependency is introduced.
32. `ARCHITECTURE.md` remains consistent with the implemented Target Price lifecycle.

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

Review any `ARCHITECTURE.md` diff to ensure only necessary Target Price lifecycle clarifications were introduced.

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

Do not modify the status of unrelated tasks.

---

## Completion Report

When finished, report:

1. files added or changed;
2. the final Target Price application-service API;
3. symbol validation behavior;
4. Target Price validation behavior;
5. load behavior;
6. get behavior for existing and missing values;
7. create behavior;
8. replacement behavior;
9. behavior when the same value is set again;
10. confirmation that decimal values are preserved;
11. application-level errors introduced or reused;
12. confirmation that no Target Price deletion exists;
13. confirmation that Watchlists are not accessed;
14. confirmation that Yahoo/MarketDataProvider is not accessed;
15. confirmation that target-distance and savings calculations are not triggered;
16. how user isolation was tested;
17. unit-test scenarios added;
18. changes made to `ARCHITECTURE.md`, if any;
19. results of `check`, `test`, `lint`, and `build`;
20. confirmation that this task's status was changed to `Done`;
21. assumptions or unresolved issues;
22. deviations from this task or `ARCHITECTURE.md`.

Do not proceed to Watchlist composition, Yahoo symbol validation, REST APIs, or UI implementation.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
