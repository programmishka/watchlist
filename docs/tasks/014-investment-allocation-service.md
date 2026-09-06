# TASK-014: Investment Allocation Application Service

## Status

Done

> **Superseded in part by TASK-031:** TASK-031 preserves factor-`0`
> allocation behavior for stocks with an unavailable Target Price distance,
> while changing that distance's representation from `0` to `undefined`
> upstream in `WatchlistQueryService`/`WatchlistStock`. This service's
> factor/allocation formulas themselves were not changed.

## Goal

Implement the server-side application use case for calculating a temporary investment allocation for all stocks in one Watchlist.

The user supplies:

```text
userId
watchlistId
totalSavings
```

The service must use the current composed Watchlist data and the existing pure investment-domain functions to distribute the available amount across all stocks in that Watchlist.

Conceptually:

```text
userId + watchlistId
        |
        v
WatchlistQueryService
        |
        v
current Watchlist stocks
        |
        +--> distanceToTarget
        |
        v
calculateInvestmentFactor(...)
        |
        v
calculateSavingsAllocation(...)
        |
        v
calculateInvestedTotal(...)
        |
        v
InvestmentAllocation
```

Investment allocation is:

* explicitly triggered by the user;
* temporary;
* not persisted;
* calculated over all stocks in the selected Watchlist;
* rounded down to whole Euro amounts per stock.

This task implements the application service only.

Do not implement the REST endpoint or Svelte UI in this task.

---

## Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* this task completely

Relevant existing production code includes:

* `WatchlistQueryService`;
* `WatchlistView`;
* `WatchlistStock`;
* `calculateInvestmentFactor(...)`;
* `calculateFactorSum(...)`;
* `calculateSavingsAllocation(...)`;
* `calculateInvestedTotal(...)`;
* existing total-savings validation from TASK-003.

TASK-003 established the pure investment calculations.

TASK-011 established the read-only Watchlist composition that already provides each stock's current:

```text
distanceToTarget
```

Do not duplicate these calculations.

---

## 1. Application Service Boundary

Introduce a small server-only application service responsible for investment allocation.

A conceptual API is:

```ts
class InvestmentAllocationService {
  constructor(watchlistQueryService: WatchlistQueryService);

  calculateAllocation(
    userId: string,
    watchlistId: string,
    totalSavings: number
  ): Promise<InvestmentAllocation>;
}
```

The exact naming may follow existing project conventions.

Keep the service narrowly focused on this one use case.

---

## 2. Trusted User ID

The service receives:

```text
userId
```

from a trusted server-side caller.

It MUST NOT depend directly on:

* `AuthenticatedUser`;
* `AuthenticationContext`;
* `event.locals`;
* `ctx.access`;
* HTTP requests.

The later REST endpoint will provide:

```text
event.locals.user.id
        |
        v
InvestmentAllocationService
```

---

## 3. Watchlist Source

Use:

```text
WatchlistQueryService.getWatchlist(userId, watchlistId)
```

to obtain the current composed Watchlist.

Do not independently load:

* WatchlistRepository;
* TargetPriceRepository;
* Yahoo market data;
* exchange rates.

The query service already owns composition of:

```text
Watchlist membership
Target Prices
Market Data
FX-derived Market Cap
Dividend Yield
Distance to Target
```

The allocation service should consume that existing result.

---

## 4. No Duplicate Target-Distance Calculation

Each composed:

```text
WatchlistStock
```

already contains:

```text
distanceToTarget
```

Use that value as the input to:

```text
calculateInvestmentFactor(...)
```

Do not independently recalculate:

```text
price / targetPrice - 1
```

inside this service.

---

## 5. Allocation Scope

The allocation always includes **all stocks in the requested Watchlist**.

The service has no concept of:

* UI filtering;
* table sorting;
* hidden rows;
* currently visible rows.

For example, if the Watchlist contains:

```text
AAPL
SAP.DE
GAW.L
```

all three stocks participate in the allocation according to the established factor semantics.

A client-side company-name filter must never influence this service.

---

## 6. Investment Factor

For every stock, use the existing:

```text
calculateInvestmentFactor(distanceToTarget)
```

domain function.

Do not duplicate:

```text
1 / (1 + distanceToTarget)
```

inside the application service.

The existing domain semantics remain authoritative.

In particular:

```text
distanceToTarget = 0
```

currently results in:

```text
factor = 0
```

This behavior MUST NOT be changed as part of this task.

---

## 7. Missing Market Data / Target Price

`WatchlistQueryService` may produce:

```text
distanceToTarget = 0
```

when the required current price or Target Price is unavailable according to the established domain semantics.

The allocation service must use that existing value normally.

Therefore such a stock receives:

```text
factor = 0
```

and consequently:

```text
savingsAmount = 0
```

under the current business rules.

Do not invent fallback prices or Target Prices.

---

## 8. Factor Sum

Use the existing domain calculation for factor summation.

Do not implement a separate summation formula inside the service.

The sum is based on the factors of **all Watchlist stocks**.

---

## 9. Savings Allocation

Use the existing:

```text
calculateSavingsAllocation(...)
```

domain function.

The established formula is:

```text
floor((factor / factorSum) * totalSavings)
```

for participating stocks.

Do not:

* round to nearest Euro;
* round up;
* redistribute rounding remainder;
* perform percentage formatting.

---

## 10. Invested Total

Use:

```text
calculateInvestedTotal(...)
```

on the calculated per-stock savings amounts.

The result is:

```text
invested = sum(savingsAmount)
```

Because individual allocations are rounded down:

```text
invested <= totalSavings
```

Do not assume equality.

---

## 11. Result Type

Introduce a small application-owned result type.

Conceptually:

```ts
interface InvestmentAllocation {
  totalSavings: number;
  invested: number;
  allocations: StockAllocation[];
}
```

with:

```ts
interface StockAllocation {
  symbol: string;
  factor: number;
  savingsAmount: number;
}
```

The exact names may follow existing conventions.

The result should preserve enough information for the later UI to display:

```text
savings amount
```

per stock and:

```text
invested
```

for the complete calculation.

---

## 12. Allocation Order

The result's:

```text
allocations
```

must preserve the stock order returned by:

```text
WatchlistQueryService
```

which already preserves persisted Watchlist order.

Do not reorder by:

* factor;
* savings amount;
* symbol;
* distance to Target.

Sorting remains a client-side presentation concern.

---

## 13. Symbol Association

TASK-003 intentionally implemented the pure allocation function positionally using:

```ts
number[]
```

This service is the layer responsible for associating the resulting savings amounts back to stocks.

Conceptually:

```text
stocks:
AAPL
SAP.DE
GAW.L

factors:
0.8
1.2
0.5

savings:
320
480
200
```

becomes:

```text
AAPL   -> factor 0.8 -> savings 320
SAP.DE -> factor 1.2 -> savings 480
GAW.L  -> factor 0.5 -> savings 200
```

Do not modify the pure TASK-003 functions merely to add symbols to them.

---

## 14. Total Savings Validation

Reuse the validation semantics already established by:

```text
calculateSavingsAllocation(...)
```

and TASK-003.

`totalSavings` must be:

* finite;
* an integer;
* greater than or equal to `0`.

Valid:

```text
0
1
500
1000
```

Invalid:

```text
-1
12.5
NaN
Infinity
-Infinity
```

Do not introduce a second conflicting validation rule.

---

## 15. Zero Total Savings

```text
totalSavings = 0
```

is valid.

The result must contain:

```text
totalSavings = 0
invested = 0
```

and every stock receives:

```text
savingsAmount = 0
```

Do not reject zero.

---

## 16. Empty Watchlist

An existing empty Watchlist is a valid allocation input.

For:

```text
stocks = []
```

return:

```ts
{
  totalSavings,
  invested: 0,
  allocations: []
}
```

Do not treat an empty Watchlist as an application error.

The existing Watchlist query service already distinguishes an empty Watchlist from a missing Watchlist.

---

## 17. Missing Watchlist

If:

```text
WatchlistQueryService
```

reports that the Watchlist does not exist, propagate the existing Watchlist-not-found behavior.

Do not convert a missing Watchlist into an empty allocation.

---

## 18. Market Data Provider Failure

`WatchlistQueryService` may fail when Yahoo/MarketDataProvider fails globally.

In that case:

* do not calculate an allocation from incomplete fabricated data;
* propagate the existing market-data/query failure.

The later HTTP endpoint will map it to the established:

```text
MARKET_DATA_UNAVAILABLE
```

API error.

---

## 19. FX Failure

A global Frankfurter/FX failure does **not** prevent allocation.

`WatchlistQueryService` already degrades this situation into:

```text
fx-provider-unavailable
```

while preserving:

```text
distanceToTarget
```

because investment allocation does not depend on USD market capitalization.

Therefore the allocation service must continue normally when the composed Watchlist contains an FX warning.

Do not fail allocation solely because:

```text
marketCapBillionsUsd
```

is unavailable.

---

## 20. Query Warnings

Investment allocation itself does not need to expose Watchlist-query warnings unless they are useful for the later UI.

Since FX warnings do not affect allocation correctness, do not automatically copy every Watchlist query warning into the allocation result unless there is a concrete application need.

Keep the result focused on investment allocation.

If the implementation chooses to preserve relevant warnings, document the reason.

Do not introduce a generic warning framework.

---

## 21. No Persistence

The allocation is temporary.

Do NOT persist:

```text
totalSavings
factor
savingsAmount
invested
```

to:

* WatchlistRepository;
* TargetPriceRepository;
* Cloudflare KV;
* any new persistence store.

The service must perform no persistence writes.

---

## 22. No Allocation History

Do not implement:

* allocation history;
* previous calculations;
* timestamps;
* saved scenarios;
* named allocations.

Every call produces a fresh temporary result from the current Watchlist data.

---

## 23. No Automatic Recalculation

This service runs only when explicitly called.

Do not connect it automatically to:

* Target Price updates;
* stock additions;
* stock removals;
* Watchlist loading;
* market-data refresh.

The current architecture intentionally keeps allocation user-triggered.

---

## 24. No Currency Conversion of Savings

Savings values are in whole Euros because:

```text
totalSavings
```

is entered in Euros.

Do not convert:

```text
savingsAmount
```

into each stock's trading currency.

The current business requirement is allocation of the available Euro budget, not order-quantity calculation.

---

## 25. No Share Quantity Calculation

Do not calculate:

```text
number of shares
```

or fractional shares.

The result is only:

```text
Euro amount to allocate per stock
```

Actual trade/order calculations are outside the application scope.

---

## 26. No Client/UI Concerns

The service must not:

* format Euros;
* format percentages;
* apply locale formatting;
* filter stocks;
* sort stocks;
* calculate table footer counts.

All numeric values remain normal TypeScript numbers.

---

## 27. Server-Only Implementation

The service belongs under the existing server-only project structure.

It MUST NOT be implemented in:

* `.svelte` components;
* client stores;
* browser utilities.

The client eventually sends only:

```text
watchlistId
totalSavings
```

and receives already calculated allocation values.

---

## 28. Testing Strategy

Unit tests must use a fake:

```text
WatchlistQueryService
```

or the smallest suitable query abstraction/test seam.

Do not require:

* Cloudflare KV;
* Cloudflare Access;
* Yahoo Finance;
* Frankfurter;
* network access.

The purpose of this task is to test application orchestration around already-tested domain functions.

Do not unnecessarily reconstruct the entire TASK-011 dependency graph in every test.

---

## 29. Required Normal Allocation Test

Use a composed Watchlist with multiple stocks having different:

```text
distanceToTarget
```

values.

Verify:

* factors are calculated using existing domain semantics;
* factor order corresponds to stock order;
* savings amounts are calculated correctly;
* allocation symbols correspond to the correct positional savings amounts;
* invested equals the sum of savings amounts.

Use concrete expected numeric values.

---

## 30. Required Rounding Test

Use an allocation where proportional amounts contain fractions.

Verify:

* each stock's savings amount is rounded down;
* the remainder is not redistributed;
* `invested < totalSavings` where appropriate.

For example, a suitable scenario should demonstrate a result conceptually equivalent to:

```text
totalSavings = 100

allocations:
33
33
33

invested = 99
```

Use inputs consistent with the existing factor semantics.

---

## 31. Required Zero-Distance Test

Include a stock with:

```text
distanceToTarget = 0
```

Verify that the existing domain semantics produce:

```text
factor = 0
savingsAmount = 0
```

Do not "fix" this behavior.

---

## 32. Required Missing-Data Semantics Test

Use a composed stock whose query result has:

```text
distanceToTarget = 0
```

because current market data or Target Price was unavailable.

Verify that it receives:

```text
factor = 0
savingsAmount = 0
```

while other eligible stocks continue to participate.

---

## 33. Required All-Zero Factors Test

Use a Watchlist where every stock produces:

```text
factor = 0
```

Verify:

```text
all savingsAmount = 0
invested = 0
```

even when:

```text
totalSavings > 0
```

No `NaN` or `Infinity` may appear.

---

## 34. Required Zero Savings Test

For:

```text
totalSavings = 0
```

verify:

```text
invested = 0
```

and all stock allocations are:

```text
0
```

---

## 35. Required Empty Watchlist Test

For an existing Watchlist with:

```text
stocks = []
```

verify:

```text
allocations = []
invested = 0
```

The requested valid:

```text
totalSavings
```

is preserved in the result.

---

## 36. Required Invalid Savings Tests

Verify that the existing validation semantics reject:

```text
-1
12.5
NaN
Infinity
-Infinity
```

Do not duplicate all TASK-003 numeric edge-case tests.

The purpose here is to verify that the application service actually respects and propagates the domain validation.

---

## 37. Required Missing Watchlist Test

Configure the query dependency to produce the existing:

```text
WatchlistNotFoundError
```

Verify that it propagates.

Do not return an empty allocation.

---

## 38. Required Market Provider Failure Test

Configure the query dependency to produce:

```text
MarketDataProviderError
```

Verify that the allocation service propagates it.

No partial allocation should be produced.

---

## 39. Required FX Warning Test

Return a valid composed Watchlist containing:

```text
warnings = ['fx-provider-unavailable']
```

with usable:

```text
distanceToTarget
```

values.

Verify that investment allocation still succeeds normally.

This explicitly documents that market-cap FX availability is irrelevant to allocation.

---

## 40. Required Order Test

Use a Watchlist in a deliberately non-alphabetical order, for example:

```text
SAP.DE
AAPL
GAW.L
```

Verify the allocation result preserves exactly that order.

---

## 41. Required Read-Only Test

Verify structurally that the service has no dependencies on:

```text
WatchlistRepository
TargetPriceRepository
```

and performs no persistence writes.

Do not add fake persistence dependencies merely to assert that they are unused.

The constructor/API should make the absence clear.

---

## 42. User Isolation

The service must pass:

```text
userId
watchlistId
```

unchanged to `WatchlistQueryService`.

Test with:

```text
user-1
user-2
```

and verify that the query dependency receives the supplied identity exactly.

Do not introduce application-global allocation state.

---

## 43. Architecture Documentation

Update `ARCHITECTURE.md` only where necessary to clarify the application-level allocation workflow.

The architecture should state that:

* investment allocation is implemented as an explicit server-side application use case;
* it consumes the current composed Watchlist;
* it uses `distanceToTarget` already produced by Watchlist composition;
* it applies the existing pure factor/allocation/invested calculations;
* allocation includes all stocks in the Watchlist regardless of client filtering/sorting;
* stocks with factor `0` receive `0`;
* FX/market-cap availability does not affect allocation when target-distance data is available;
* the result associates positional domain calculations back to stock symbols;
* allocation values remain transient and are never persisted;
* allocation runs only when explicitly requested by the user.

Do not rewrite unrelated architecture sections.

---

## Non-Goals

Do NOT implement:

* REST endpoint;
* Svelte UI;
* total-savings input field;
* calculator button;
* `invested` display;
* automatic allocation recalculation;
* allocation persistence;
* allocation history;
* Target Price updates;
* Watchlist mutations;
* market-data fetching outside `WatchlistQueryService`;
* FX fetching outside `WatchlistQueryService`;
* share quantities;
* trade orders;
* currency conversion of savings;
* client filtering/sorting.

Do not modify the existing investment-domain formulas unless a genuine defect is discovered and reported before changing architecture.

---

## Acceptance Criteria

The task is complete when all of the following are true:

1. A server-only Investment Allocation application service exists.
2. It accepts trusted `userId`, `watchlistId`, and numeric `totalSavings`.
3. It uses `WatchlistQueryService` as the source of current Watchlist data.
4. It does not independently access repositories/providers.
5. It uses existing `distanceToTarget` values from composed stocks.
6. It uses the existing investment-factor domain function.
7. It uses the existing factor-sum/allocation domain functions.
8. It uses the existing invested-total domain function.
9. It does not duplicate investment formulas.
10. All Watchlist stocks participate according to their factor semantics.
11. Client filtering/sorting has no influence on allocation.
12. Stock/result order follows Watchlist order.
13. Positional allocation results are associated back to the correct symbols.
14. The result contains `totalSavings`.
15. The result contains `invested`.
16. The result contains per-stock factor and savings amount.
17. Savings amounts are whole Euros.
18. Rounding remainder is not redistributed.
19. `invested <= totalSavings`.
20. Zero-distance stocks retain the existing factor-0 behavior.
21. Missing-data distance semantics result in factor/savings `0`.
22. All-zero-factor Watchlists produce invested `0`.
23. `totalSavings = 0` is valid.
24. Invalid total savings follow existing domain validation.
25. Empty Watchlists produce an empty valid allocation.
26. Missing Watchlists remain errors.
27. Global market-data provider failure remains an error.
28. FX-provider warnings do not prevent allocation.
29. Allocation performs no persistence writes.
30. No allocation history/cache is introduced.
31. No automatic recalculation is introduced.
32. No savings currency conversion is performed.
33. No share quantity is calculated.
34. Unit tests require no Cloudflare, Yahoo, Frankfurter, or network access.
35. User ID is passed through unchanged and isolation is tested.
36. `ARCHITECTURE.md` reflects the application-level allocation workflow.
37. Existing project checks still pass.
38. No REST API or UI functionality is implemented.
39. No unnecessary production dependency is introduced.

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

Review any `ARCHITECTURE.md` diff and verify that only the investment-allocation workflow was clarified.

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
2. final Investment Allocation service API;
3. final allocation result types;
4. dependency on `WatchlistQueryService`;
5. factor-calculation behavior;
6. positional stock/allocation association;
7. savings-allocation behavior;
8. rounding behavior;
9. invested calculation;
10. zero-distance behavior;
11. missing-data behavior;
12. zero/all-zero-factor behavior;
13. invalid-total-savings behavior;
14. empty-Watchlist behavior;
15. missing-Watchlist behavior;
16. market-data failure behavior;
17. FX-warning behavior;
18. confirmation that no persistence occurs;
19. confirmation that no automatic recalculation occurs;
20. confirmation that no share/currency-order calculation occurs;
21. user-isolation/pass-through test;
22. unit-test scenarios added;
23. changes made to `ARCHITECTURE.md`;
24. results of `check`, `test`, `lint`, and `build`;
25. confirmation that this task's status was changed to `Done`;
26. assumptions or unresolved issues;
27. deviations from this task or `ARCHITECTURE.md`.

Do not proceed to the Investment Allocation REST endpoint or Svelte UI.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
