# TASK-012: Validated Stock Addition

## Status

Done

> **Superseded in part by TASK-029.** This task's "no symbol
> canonicalization"/"no case normalization" decision (§6, §7, and the related
> acceptance criteria/tests) reflected the correct starting point at the
> time, but production usage later showed it caused inconsistent behavior
> (e.g. `aapl` reaching the provider in lowercase). TASK-029 introduced
> mandatory trim + uppercase normalization and syntax validation ahead of
> provider validation, and the normalized symbol — not the exact raw input —
> is now what is persisted. The provider-validation orchestration and error
> model this task established (§1-§3, §8-§20) remain in place; only the
> input-casing/canonicalization decision changed.

## Goal

Implement the server-side application use case for adding a stock symbol to a Watchlist only after the symbol has been successfully resolved by the configured `MarketDataProvider`.

The existing `WatchlistService.addSymbol()` intentionally manages only Watchlist membership and basic symbol validation.

This task introduces the orchestration:

```text
User-supplied symbol
        |
        v
MarketDataProvider.getQuote(...)
        |
        +------ not found ------> reject
        |
        +------ failure --------> provider failure
        |
        v
resolved successfully
        |
        v
WatchlistService.addSymbol(...)
        |
        v
updated WatchlistsDocument
```

The new use case must compose existing services rather than adding Yahoo-specific behavior to `WatchlistService`.

Do not implement REST APIs or UI in this task.

---

## Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* this task completely

Relevant existing production code includes:

* `WatchlistService`;
* `WatchlistServiceErrors`;
* `MarketDataProvider`;
* `MarketDataProviderError`;
* `YahooFinanceAdapter`;
* `StockMarketData`;
* `TargetPriceService`;
* `WatchlistQueryService`.

TASK-009 deliberately allowed `WatchlistService.addSymbol()` to persist any basically valid symbol string without querying Yahoo.

This task closes that intentional gap at a higher application-orchestration layer.

---

## 1. Application Use-Case Boundary

Introduce a small server-only use case/service responsible specifically for:

> Validate a stock symbol using market data and add it to a Watchlist.

A conceptual API could be:

```ts
class AddStockToWatchlistService {
  constructor(
    marketDataProvider: MarketDataProvider,
    watchlistService: WatchlistService
  );

  addStock(
    userId: string,
    watchlistId: string,
    symbol: string
  ): Promise<...>;
}
```

The exact naming may follow existing project conventions.

Keep the use case narrowly focused.

Do not turn it into a general Watchlist facade.

---

## 2. Reuse Existing Watchlist Logic

Do not duplicate the existing Watchlist rules implemented by `WatchlistService`.

In particular, continue to rely on `WatchlistService.addSymbol()` for:

* basic symbol validation;
* trimming;
* Watchlist lookup;
* duplicate-symbol detection;
* symbol membership mutation;
* persistence;
* user scoping.

Do not reimplement Watchlist persistence in this new service.

---

## 3. Market Data Validation

Before adding the symbol, validate it through:

```text
MarketDataProvider.getQuote(symbol)
```

The symbol is considered valid for addition only when the provider returns a:

```text
StockMarketData
```

result.

If the provider returns:

```text
undefined
```

the symbol is not recognized and must not be added.

---

## 4. Symbol Input Normalization

The symbol sent to `MarketDataProvider` must use the same basic input normalization semantics as Watchlist membership.

Leading/trailing whitespace must be removed.

Example:

```text
"  GAW.L  "
```

must be validated as:

```text
"GAW.L"
```

and, if successful, persisted as:

```text
"GAW.L"
```

Do not otherwise rewrite the symbol.

---

## 5. Invalid Basic Symbol Input

For:

```text
""
"   "
```

do not call the market-data provider.

Reject the request using the existing Watchlist/application symbol-validation semantics where practical.

Do not perform an unnecessary Yahoo request for input that is already locally invalid.

Avoid creating a second conflicting definition of basic symbol validity.

---

## 6. No Symbol Canonicalization

The application currently has no symbol-canonicalization rule.

Therefore:

```text
input symbol
     |
     v
trim surrounding whitespace
     |
     v
validate exact symbol through provider
     |
     v
persist exact trimmed input
```

Do NOT replace the input with:

```text
StockMarketData.symbol
```

returned by the provider.

For example, if the user supplies:

```text
GAW.L
```

and the provider successfully resolves it, persist:

```text
GAW.L
```

because that is the validated input.

The provider-returned symbol is evidence that the lookup succeeded, not a canonicalization instruction.

---

## 7. Case Handling

Do not automatically uppercase or lowercase symbols.

For the current implementation:

```text
aapl
```

and:

```text
AAPL
```

remain distinct inputs.

If the market-data provider resolves one of them successfully, the exact trimmed input is passed to `WatchlistService`.

Do not introduce case normalization in this task.

---

## 8. Unknown Symbol

If:

```text
MarketDataProvider.getQuote(symbol)
```

returns:

```text
undefined
```

the use case must fail with a small explicit application-level unknown/invalid-market-symbol error.

Conceptually:

```text
UnknownStockSymbolError
```

or an equivalent name.

This must remain distinguishable from:

```text
MarketDataProviderError
```

because:

```text
symbol not found
```

and:

```text
Yahoo/provider unavailable
```

are different user-facing situations.

Do not call:

```text
WatchlistService.addSymbol(...)
```

after an unknown-symbol result.

---

## 9. Provider Failure

If:

```text
MarketDataProvider.getQuote(...)
```

throws:

```text
MarketDataProviderError
```

the stock must not be added.

Preserve the provider failure as a provider/infrastructure failure.

Do not convert it to:

```text
UnknownStockSymbolError
```

or:

```text
DuplicateSymbolError
```

The later HTTP/UI layer must be able to show an understandable provider-unavailable error.

Do not expose raw Yahoo exceptions.

---

## 10. Successful Validation

If the provider returns valid market data:

```text
MarketDataProvider.getQuote(symbol)
        |
        v
StockMarketData
```

call:

```text
WatchlistService.addSymbol(
  userId,
  watchlistId,
  trimmedSymbol
)
```

and return its updated application result.

Do not persist the market-data response.

Do not return Yahoo-specific data merely because it was retrieved during validation unless a very small application-level result clearly requires it.

The primary result of this command is the updated Watchlist state.

---

## 11. Duplicate Symbol

The agreed implementation order is:

```text
market-data validation
        |
        v
WatchlistService.addSymbol(...)
        |
        v
duplicate check
```

Therefore, attempting to add an already-present symbol may perform one unnecessary market-data request before `WatchlistService` rejects it.

This is intentional for the initial implementation.

Do not introduce additional Watchlist reads or pre-validation solely to optimize this case.

The expected behavior is:

1. provider successfully resolves the symbol;
2. `WatchlistService.addSymbol()` detects the duplicate;
3. `DuplicateSymbolError` propagates;
4. no Watchlist save occurs.

The extra provider call is acceptable for the expected application usage.

---

## 12. Missing Watchlist

Likewise, market-data validation occurs before the existing `WatchlistService` determines whether the supplied Watchlist ID exists.

Therefore:

1. provider may successfully resolve the symbol;
2. `WatchlistService.addSymbol()` determines the Watchlist does not exist;
3. `WatchlistNotFoundError` propagates;
4. no save occurs.

Do not add an additional Watchlist read merely to avoid this provider call.

---

## 13. Target Price Independence

Adding a validated stock does not need to create, update, or load a Target Price.

Do NOT depend on:

```text
TargetPriceService
TargetPriceRepository
```

in this use case.

If a Target Price already exists for:

```text
User + Symbol
```

it remains persisted independently and will automatically be composed later by `WatchlistQueryService`.

This is the desired behavior.

---

## 14. Existing Target Price Scenario

The architecture must support:

```text
Target Prices:
AAPL = 200

Current Watchlists:
(no AAPL)
```

Then:

```text
add AAPL to Watchlist
        |
        v
Yahoo validates AAPL
        |
        v
Watchlist membership added
```

No Target Price operation is required.

Later:

```text
WatchlistQueryService
```

will naturally compose:

```text
AAPL
targetPrice = 200
```

from the independently persisted Target Price document.

Do not duplicate this composition inside the add command.

---

## 15. No Market Data Persistence

The market data retrieved for validation is transient.

Do not persist:

* name;
* price;
* currency;
* annual dividend;
* market cap;
* dividend yield;
* converted market cap.

The next Watchlist query will retrieve current market data normally.

---

## 16. No Derived Calculations

This command does not need to calculate:

* dividend yield;
* market cap in USD;
* target-price distance;
* investment factor;
* savings amount;
* invested total.

The purpose of the provider lookup is symbol validation only.

Do not call Frankfurter.

---

## 17. No Batch Query

This use case validates one user-entered symbol.

Use:

```text
MarketDataProvider.getQuote(symbol)
```

not:

```text
getQuotes([symbol])
```

The batch API remains appropriate for loading an existing Watchlist, not for validating one symbol addition.

---

## 18. Trusted User ID

The use case accepts:

```text
userId
```

from a trusted server-side caller.

It must not obtain ownership from:

* request parameters;
* request bodies;
* browser state;
* email addresses.

REST/authentication wiring belongs to a later task.

---

## 19. Server-Only Implementation

The use case belongs under the existing server-only project structure.

It MUST NOT be implemented in:

* `.svelte` components;
* client-side stores;
* browser utilities.

The browser will eventually request:

```text
add this symbol
```

but the server performs both provider validation and persistence.

---

## 20. Application Error Model

Introduce only the minimal new application error needed for:

```text
provider successfully answered,
but symbol does not exist
```

Reuse existing errors from:

```text
WatchlistService
MarketDataProvider
```

for all other cases.

Do not create duplicate errors for:

* duplicate symbol;
* missing Watchlist;
* provider unavailable.

Do not introduce a general-purpose application error hierarchy.

---

## 21. Testability

Unit tests must use:

* a fake `MarketDataProvider`;
* the real `WatchlistService` backed by a fake `WatchlistRepository`, or an equally appropriate test seam.

Prefer exercising the real `WatchlistService` so that the orchestration between validation and existing Watchlist rules is verified.

Do not use:

* Yahoo Finance;
* Cloudflare KV;
* Cloudflare Access;
* Frankfurter;
* network access.

---

## 22. Required Successful Addition Test

Given:

```text
Watchlist:
id = wl-1
symbols = []
```

and:

```text
MarketDataProvider.getQuote("AAPL")
```

returns valid market data.

Calling:

```text
addStock(user-1, wl-1, AAPL)
```

must:

1. call the provider once;
2. call through the existing Watchlist logic;
3. persist `AAPL`;
4. return the updated Watchlist state.

---

## 23. Required Trim Test

Given:

```text
"  GAW.L  "
```

verify:

* provider receives `GAW.L`;
* Watchlist stores `GAW.L`;
* surrounding whitespace is never persisted.

---

## 24. Required Invalid Basic Input Tests

For:

```text
""
"   "
```

verify:

* the operation fails;
* MarketDataProvider is NOT called;
* WatchlistRepository is not read/written unnecessarily;
* no symbol is persisted.

---

## 25. Required Unknown Symbol Test

Configure:

```text
MarketDataProvider.getQuote("DOES-NOT-EXIST")
```

to return:

```text
undefined
```

Verify:

* the explicit unknown-symbol application error is produced;
* `WatchlistService.addSymbol()` does not mutate persistence;
* no save occurs.

---

## 26. Required Provider Failure Test

Configure:

```text
MarketDataProvider.getQuote("AAPL")
```

to throw:

```text
MarketDataProviderError
```

Verify:

* the provider error remains distinguishable;
* no Watchlist mutation occurs;
* no save occurs.

Do not convert it to unknown-symbol.

---

## 27. Required Duplicate Test

Given:

```text
Watchlist:
symbols = ["AAPL"]
```

and a provider that successfully resolves:

```text
AAPL
```

verify:

1. the provider is called;
2. `WatchlistService` rejects the duplicate;
3. `DuplicateSymbolError` propagates;
4. no save occurs.

This explicitly documents the agreed validation-before-duplicate-check ordering.

---

## 28. Required Missing-Watchlist Test

Given no Watchlist with:

```text
wl-missing
```

and a provider that successfully resolves:

```text
AAPL
```

verify:

1. the provider is called;
2. `WatchlistService` rejects the missing Watchlist;
3. `WatchlistNotFoundError` propagates;
4. no save occurs.

Do not add a pre-read optimization.

---

## 29. Required Exact-Symbol Test

Use a symbol containing Yahoo exchange syntax, for example:

```text
HEXA-B.ST
```

Verify:

* provider receives `HEXA-B.ST`;
* persisted symbol is `HEXA-B.ST`;
* no punctuation or suffix is removed.

---

## 30. Required Provider-Returned-Symbol Test

Configure the fake provider so that:

```text
requested symbol = "AAPL"
```

but returned `StockMarketData.symbol` is deliberately different, for example:

```text
"AAPL-PROVIDER-VALUE"
```

The operation must still persist:

```text
AAPL
```

not the provider-returned symbol.

This explicitly protects the current no-canonicalization rule.

---

## 31. Required Case Test

Where the fake provider successfully resolves:

```text
aapl
```

verify that the persisted symbol remains:

```text
aapl
```

Do not automatically convert it to:

```text
AAPL
```

This test documents current exact-input semantics.

---

## 32. Required Existing Target Price Independence

Do not add a Target Price dependency solely for testing.

Structural absence is sufficient.

The service constructor/API must demonstrate that validated stock addition requires only:

```text
MarketDataProvider
WatchlistService
```

or their equivalent application abstractions.

---

## 33. Required User-Isolation Test

Using shared fake persistence, create:

```text
user-1:
Watchlist wl-1

user-2:
Watchlist wl-1
```

Then add:

```text
AAPL
```

for:

```text
user-1
```

Verify that:

```text
user-1 / wl-1
```

contains AAPL while:

```text
user-2 / wl-1
```

remains unchanged.

The trusted user ID must be passed unchanged through to `WatchlistService`.

---

## 34. No Direct Repository Access

The new orchestration service should not bypass `WatchlistService` by calling:

```text
WatchlistRepository.save(...)
```

directly.

Watchlist mutation rules already have an owner.

Do not duplicate them.

If a repository is used in tests, it should be through the existing `WatchlistService`.

---

## 35. No Authentication Dependency

The use case must not depend directly on:

* `AuthenticatedUser`;
* `AuthenticationContext`;
* `event.locals`;
* `ctx.access`.

The future server-route layer will provide:

```text
event.locals.user.id
        |
        v
AddStockToWatchlistService
```

---

## 36. Architecture Documentation

Update `ARCHITECTURE.md` with a targeted clarification of stock-addition behavior if necessary.

The architecture should explicitly state that adding a stock follows:

```text
trim symbol
    |
    v
validate with MarketDataProvider
    |
    +-- not found -> reject
    |
    +-- provider failure -> reject as provider failure
    |
    v
add exact trimmed symbol to Watchlist
```

It should also state that:

* market data used for validation is not persisted;
* provider-returned symbols do not currently canonicalize user input;
* adding a symbol does not touch Target Prices;
* an existing Target Price is reused later through normal Watchlist query composition;
* duplicate detection remains owned by `WatchlistService`;
* no case normalization is currently performed.

Do not rewrite unrelated architecture sections.

---

## Non-Goals

Do NOT implement:

* REST endpoints;
* Svelte UI;
* symbol autocomplete/search;
* fuzzy symbol search;
* symbol canonicalization;
* case normalization;
* Target Price loading/mutation;
* Watchlist query composition changes;
* dividend calculation;
* market-cap conversion;
* Frankfurter calls;
* investment allocation;
* caching;
* retry policies;
* market-data persistence;
* authentication wiring;
* direct KV access.

Do not modify `YahooFinanceAdapter` unless a genuine defect is discovered and reported before changing architecture.

---

## Acceptance Criteria

The task is complete when all of the following are true:

1. A server-only validated-stock-addition use case exists.
2. It composes `MarketDataProvider` with existing Watchlist mutation logic.
3. It does not duplicate Watchlist persistence logic.
4. Basic symbol input is trimmed before provider lookup.
5. Empty/whitespace symbols are rejected without provider calls.
6. Valid symbols are checked through `MarketDataProvider.getQuote()`.
7. Unknown symbols are rejected explicitly.
8. Unknown symbols do not cause Watchlist mutation.
9. Provider failures remain distinguishable from unknown symbols.
10. Provider failures do not cause Watchlist mutation.
11. Successfully resolved symbols are added through `WatchlistService`.
12. The exact trimmed input symbol is persisted.
13. Provider-returned symbols do not canonicalize input.
14. No case normalization is performed.
15. Yahoo exchange suffixes/punctuation remain unchanged.
16. Duplicate symbols are still rejected by `WatchlistService`.
17. Duplicate validation may occur after one provider request.
18. Missing Watchlists are still rejected by `WatchlistService`.
19. Missing-Watchlist validation may occur after one provider request.
20. No pre-read optimization is introduced solely to avoid these provider calls.
21. No Target Price dependency is introduced.
22. Existing Target Prices remain untouched.
23. Market data retrieved for validation is not persisted.
24. No derived stock calculations are performed.
25. No ExchangeRateProvider/Frankfurter dependency is introduced.
26. No direct Watchlist repository writes occur outside `WatchlistService`.
27. Trusted `userId` is passed through unchanged.
28. User isolation is tested.
29. Unit tests require no Cloudflare, Yahoo, Frankfurter, or network access.
30. Existing project checks still pass.
31. `ARCHITECTURE.md` reflects validated stock-addition behavior.
32. No REST API or UI functionality is implemented.
33. No unnecessary production dependency is introduced.

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

Review any `ARCHITECTURE.md` diff and verify that it only clarifies validated stock-addition behavior.

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
2. the final validated-stock-addition API;
3. dependencies used by the new use case;
4. basic symbol-validation behavior;
5. provider lookup behavior;
6. unknown-symbol behavior;
7. provider-failure behavior;
8. successful-addition behavior;
9. duplicate-symbol behavior and operation ordering;
10. missing-Watchlist behavior and operation ordering;
11. exact-symbol/no-canonicalization behavior;
12. confirmation that Target Prices are untouched;
13. confirmation that validation market data is not persisted;
14. confirmation that no FX or derived calculations occur;
15. confirmation that Watchlist mutation still goes through `WatchlistService`;
16. how user isolation was tested;
17. unit-test scenarios added;
18. changes made to `ARCHITECTURE.md`;
19. results of `check`, `test`, `lint`, and `build`;
20. confirmation that this task's status was changed to `Done`;
21. assumptions or unresolved issues;
22. deviations from this task or `ARCHITECTURE.md`.

Do not proceed to REST APIs or UI implementation.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
