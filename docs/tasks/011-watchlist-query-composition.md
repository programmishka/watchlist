# TASK-011: Watchlist Query and Stock Composition

## Status

Done

## Goal

Implement the server-side query/composition service that produces the complete stock data required to display one Watchlist.

This task combines existing application data, external market data, exchange rates, and pure domain calculations.

The service must compose:

```text
Watchlist membership
        +
Target Prices
        +
Yahoo Market Data
        +
Exchange Rates
        +
Domain Calculations
        |
        v
Display-ready Watchlist data
```

This is a read/query use case.

The service MUST NOT modify:

* Watchlists;
* Target Prices;
* market data;
* exchange rates.

It must support partial external-data failures so that one unavailable stock or unavailable FX conversion does not unnecessarily make the entire Watchlist unusable.

Do not implement REST APIs or UI in this task.

---

## Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* this task completely

Relevant existing production code includes:

* `WatchlistRepository`;
* `TargetPriceRepository`;
* `MarketDataProvider`;
* `YahooFinanceAdapter`;
* `ExchangeRateProvider`;
* `FrankfurterAdapter`;
* market-cap conversion;
* dividend-yield calculation;
* target-price-distance calculation.

Reuse the existing abstractions and pure domain functions.

Do not duplicate their logic.

---

## 1. Application Query Boundary

Introduce a server-only query/composition service.

A suitable conceptual name is:

```ts
class WatchlistQueryService {
  // query use cases
}
```

The exact name may follow existing project conventions.

The service is responsible for composing a Watchlist for presentation.

It is not responsible for Watchlist mutations.

---

## 2. Dependencies

The service should depend only on application-owned abstractions and pure business functions.

Expected infrastructure abstractions are:

```text
WatchlistRepository
TargetPriceRepository
MarketDataProvider
ExchangeRateProvider
```

It MUST NOT depend directly on:

```text
Cloudflare KV
YahooFinanceAdapter
FrankfurterAdapter
ctx.access
event.locals
```

Concrete infrastructure wiring belongs to a later server-route/composition-root task.

---

## 3. Trusted User ID

All queries receive:

```text
userId
```

from a trusted server-side caller.

Do not obtain ownership from:

* URL user IDs;
* request bodies;
* browser state;
* email addresses.

Authentication-to-query-service wiring belongs to the later HTTP layer.

---

## 4. Query One Watchlist

Implement a query that loads one Watchlist by ID.

Conceptually:

```text
getWatchlist(userId, watchlistId)
```

The exact method name may differ.

The service must:

1. load the user's Watchlists;
2. locate the requested Watchlist;
3. load the user's Target Prices;
4. retrieve market data for all symbols in the Watchlist as one batch;
5. determine required FX currencies;
6. retrieve required exchange rates efficiently;
7. derive the display values for each stock;
8. return an application-owned composed Watchlist result.

Do not make one Yahoo request per stock.

Do not make one Frankfurter request per stock.

---

## 5. Watchlist Not Found

If the requested `watchlistId` does not exist for the user, fail with an explicit application-level Watchlist-not-found error/result.

Do not:

* return an empty Watchlist;
* create a Watchlist;
* fall back to the active Watchlist.

The query is explicitly for the supplied Watchlist ID.

---

## 6. Empty Watchlist

If the Watchlist exists but contains no symbols, return a valid composed Watchlist with:

```text
stocks = []
```

Do not call Yahoo Finance.

Do not call Frankfurter.

The UI will later display the empty-Watchlist state.

---

## 7. Composed Watchlist Type

Introduce an application-owned query result representing the selected Watchlist.

Conceptually:

```ts
interface WatchlistView {
  id: string;
  name: string;
  stocks: WatchlistStock[];
}
```

The exact naming may follow existing conventions.

Do not expose persistence documents directly as the final presentation/query contract if a small explicit query type makes the boundary clearer.

---

## 8. Composed Stock Type

Introduce an application-owned composed stock type.

Conceptually:

```ts
interface WatchlistStock {
  symbol: string;
  name?: string;
  marketCapBillionsUsd?: number;
  price?: number;
  dividendYield: number;
  currency?: string;
  targetPrice?: number;
  distanceToTarget: number;
}
```

The exact shape may evolve slightly if required by explicit error/availability representation.

This type represents the stock data required by the initial table before investment allocation.

Do NOT include:

```text
factor
savingsAmount
```

in this task.

Those values belong to the separate user-triggered investment-allocation workflow.

---

## 9. Stock Order

The result MUST preserve the symbol order stored in the Watchlist.

Yahoo batch response order must not determine UI order.

Example:

```text
Watchlist symbols:
SAP.DE
AAPL
GAW.L
```

must produce composed stocks in exactly:

```text
SAP.DE
AAPL
GAW.L
```

even if Yahoo returns:

```text
AAPL
GAW.L
SAP.DE
```

or another order.

---

## 10. Target Price Composition

For each symbol, obtain its user-specific Target Price from the loaded Target Price document.

If a Target Price exists:

```text
targetPrice = stored value
```

If none exists:

```text
targetPrice = undefined
```

Do not treat a missing Target Price as an error.

Do not mutate or create Target Prices during this query.

---

## 11. Market Data Batch

Use:

```text
MarketDataProvider.getQuotes(...)
```

for all symbols in the Watchlist.

Do not call:

```text
getQuote(...)
```

once per symbol.

The query service must understand only the application-owned:

```text
MarketDataBatchResult
```

contract.

It must not know that Yahoo silently omits invalid symbols.

That provider-specific behavior has already been normalized by `MarketDataProvider`.

---

## 12. Missing Market Data

If market data is missing for one requested symbol, the Watchlist query must still return that stock entry.

Example:

```text
Watchlist:
AAPL
UNKNOWN
SAP.DE
```

MarketDataProvider:

```text
found:
AAPL
SAP.DE

missing:
UNKNOWN
```

The composed result must still contain:

```text
AAPL
UNKNOWN
SAP.DE
```

in Watchlist order.

For the missing stock:

* `symbol` remains available;
* stored `targetPrice`, if any, remains available;
* provider-derived fields are unavailable;
* derived calculations requiring provider data use their established unavailable/default semantics.

Do not fail the entire Watchlist because one symbol has no market data.

---

## 13. Market Data Provider Failure

A global:

```text
MarketDataProviderError
```

is different from one missing symbol.

If the market-data provider request fails globally:

* do not pretend every symbol was individually unknown;
* propagate or map the provider failure as an application-level query failure;
* do not return misleading valid-looking market data.

The future HTTP/UI layer will turn this into an understandable Yahoo/market-data error message.

Do not expose raw Yahoo exceptions.

---

## 14. Name

For a stock with market data:

```text
name = StockMarketData.name
```

If unavailable:

```text
name = undefined
```

Do not substitute the symbol as the name inside the business/query model.

The UI may choose how to display missing names.

---

## 15. Price

For a stock with market data:

```text
price = StockMarketData.price
```

No currency conversion is applied.

Target Price and current Price remain in the stock's corresponding trading currency.

Do not convert prices to EUR or USD.

---

## 16. Currency

For a stock with market data:

```text
currency = StockMarketData.currency
```

Preserve Yahoo's application-mapped currency identifier.

For example:

```text
GBp
```

may remain the displayed/raw market currency.

Do not replace the composed stock's display currency with the FX-normalized:

```text
GBP
```

used internally for market-cap conversion.

---

## 17. Dividend Yield

Calculate:

```text
dividendYield
```

using the existing server-side dividend-yield domain logic.

Do not duplicate its formula.

The existing function already handles:

* normal dividend calculation;
* GBp dividend-unit normalization;
* missing dividend;
* invalid/missing price;
* invalid numeric values.

The query service supplies the raw:

```text
annualDividend
price
currency
```

from `StockMarketData`.

---

## 18. Target Price Distance

Calculate:

```text
distanceToTarget
```

using the existing:

```text
calculateTargetPriceDistance(...)
```

domain function.

Inputs are:

```text
current market price
stored target price
```

Do not duplicate the formula.

A missing Target Price or unusable market price follows the existing domain function's established semantics.

---

## 19. Market Cap in Billions USD

Calculate:

```text
marketCapBillionsUsd
```

using the existing market-cap conversion logic.

Do not duplicate:

* FX conversion;
* GBp → GBP market-cap currency mapping;
* division by one billion.

The raw:

```text
StockMarketData.marketCap
```

must remain unchanged.

---

## 20. Determine Required FX Currencies

Before calling `ExchangeRateProvider`, determine which FX currencies are actually required for the stocks returned by the market-data provider.

Use the existing market-cap currency-mapping logic.

Examples:

```text
USD -> USD
EUR -> EUR
GBp -> GBP
CHF -> CHF
```

Do not request exchange rates for:

* stocks without market cap;
* stocks without currency;
* missing market-data entries where no conversion is possible.

Avoid unnecessary provider work.

---

## 21. USD-Only Watchlists

If all market caps that can be converted are already in USD:

* market-cap conversion must still work;
* no external Frankfurter request should be necessary if the existing ExchangeRateProvider/conversion implementation supports the identity path without network access.

Do not force an FX request merely because an ExchangeRateProvider dependency exists.

---

## 22. FX Batch Behaviour

For non-USD currencies, retrieve required rates through the existing:

```text
ExchangeRateProvider
```

batch abstraction.

Do not call Frankfurter directly.

Do not make one request per stock.

Do not make one request per duplicate currency.

---

## 23. Partial FX Availability

If the ExchangeRateProvider successfully returns rates for some currencies but marks others as missing, compose as much data as possible.

Example:

```text
rates:
EUR -> available
CHF -> missing
USD -> identity
```

Then:

```text
AAPL / USD
marketCapBillionsUsd -> available

SAP.DE / EUR
marketCapBillionsUsd -> available

Swiss stock / CHF
marketCapBillionsUsd -> unavailable
```

All other available stock fields remain usable.

Do not fail the entire Watchlist because one FX currency is unsupported/missing.

---

## 24. Global FX Provider Failure

TASK-005 intentionally allowed:

```text
ExchangeRateProviderError
```

to propagate from the provider layer.

This query/composition service is the layer that must implement graceful degradation.

If the FX provider fails globally:

### USD Market Caps

Stocks whose market cap can be converted without external FX data must still receive:

```text
marketCapBillionsUsd
```

For USD:

```text
marketCap / 1_000_000_000
```

### Non-USD Market Caps

Stocks requiring external FX conversion receive unavailable:

```text
marketCapBillionsUsd
```

### Other Fields

The following must remain available where Yahoo supplied them:

* symbol;
* name;
* price;
* currency;
* dividend yield;
* Target Price;
* distance to Target.

A Frankfurter outage MUST NOT make the entire Watchlist query fail if market data itself is available.

---

## 25. FX Failure Visibility

The query result must allow the later HTTP/UI layer to know that FX conversion failed globally.

Do not silently make all converted market caps `undefined` without any indication why.

Introduce the smallest practical query-level warning/status representation.

Conceptually, the result might include something like:

```ts
interface WatchlistView {
  id: string;
  name: string;
  stocks: WatchlistStock[];
  warnings: WatchlistQueryWarning[];
}
```

or an equivalent small representation.

The exact design is an implementation decision.

At minimum, callers must be able to distinguish:

```text
some individual market caps unavailable
```

from:

```text
the FX provider failed globally
```

Do not expose raw Frankfurter errors to the eventual client contract.

---

## 26. Missing Individual Market Cap

A stock may legitimately have:

```text
marketCap = undefined
```

as observed during the Yahoo spike.

This is not a global FX failure.

For that stock:

```text
marketCapBillionsUsd = undefined
```

or the equivalent unavailable representation.

Other stock fields remain available.

---

## 27. Derived-Value Representation

Keep the query result simple.

For table-oriented values, optional values are acceptable where the reason is not required by the initial UI.

However, do not lose the global FX-failure signal required above.

Do not introduce deeply nested result wrappers for every field unless necessary.

The goal is a practical display-oriented application DTO, not a generic data-quality framework.

---

## 28. No Mutation

This service is read-only.

It MUST NOT call:

```text
WatchlistRepository.save(...)
TargetPriceRepository.save(...)
```

It MUST NOT:

* create Watchlists;
* select Watchlists;
* delete Watchlists;
* add/remove symbols;
* create/update Target Prices.

Tests must verify that query operations do not perform persistence writes where the fake repositories make this observable.

---

## 29. No Market Data Persistence

Do not persist:

* Yahoo market data;
* converted market caps;
* dividend yields;
* target distances;
* exchange rates.

All are transient query results.

---

## 30. No Caching

Do not introduce:

* Yahoo caching;
* Frankfurter caching;
* query-result caching;
* KV market-data caching.

The architecture intentionally defers caching.

---

## 31. No Investment Allocation

Do not calculate:

```text
factor
savingsAmount
invested
```

in this query.

Those values only exist after the user explicitly supplies:

```text
totalSavings
```

and triggers investment allocation.

The normal Watchlist query must not invent or restore prior allocation values.

---

## 32. No UI Filtering or Sorting

The service returns stocks in persisted Watchlist order.

Do not implement:

* company-name filtering;
* table sorting;
* filtered counts.

Those are client-side presentation concerns.

---

## 33. Server-Only Implementation

The query/composition service belongs under the existing server-only structure.

It MUST NOT be implemented in:

* `.svelte` components;
* client stores;
* browser modules.

The client eventually receives already derived business values.

---

## 34. Testability

Unit tests must not require:

* real Cloudflare KV;
* Cloudflare Access;
* Yahoo Finance;
* Frankfurter;
* network access.

Use fake implementations of:

```text
WatchlistRepository
TargetPriceRepository
MarketDataProvider
ExchangeRateProvider
```

Do not mock concrete Yahoo/Frankfurter adapters.

The query service should be tested against application-owned contracts.

---

## 35. Required Basic Query Tests

At minimum test:

### Normal Watchlist

A Watchlist with several symbols and complete market/FX data produces fully composed stocks.

Verify:

* symbol;
* name;
* price;
* currency;
* targetPrice;
* distanceToTarget;
* dividendYield;
* marketCapBillionsUsd.

### Stock Order

Provider result order differs from Watchlist symbol order.

Result still follows Watchlist order.

### Empty Watchlist

Returns:

```text
stocks = []
```

without calling MarketDataProvider or ExchangeRateProvider.

### Missing Watchlist

Fails explicitly.

---

## 36. Required Target Price Tests

At minimum test:

### Existing Target Price

Target Price appears in composed stock and affects `distanceToTarget`.

### Missing Target Price

```text
targetPrice = undefined
```

and the existing target-distance semantics are used.

### Same Symbol in Different User Data

The service uses only the Target Prices loaded for the supplied `userId`.

---

## 37. Required Market Data Partial-Success Tests

At minimum test:

### One Missing Symbol

Given:

```text
Watchlist:
AAPL
UNKNOWN
SAP.DE
```

with market data only for:

```text
AAPL
SAP.DE
```

verify:

* all three stocks are returned;
* order is preserved;
* `UNKNOWN` retains its symbol;
* `UNKNOWN` may retain a stored Target Price;
* provider-derived fields for `UNKNOWN` are unavailable;
* other stocks are fully composed.

### Global Market Provider Failure

Verify that `MarketDataProviderError` is not misrepresented as individual missing symbols.

The query fails with an appropriate application/provider failure.

---

## 38. Required Dividend Tests

Do not retest every domain-function edge case.

Instead test composition correctness:

### Standard Dividend

Verify raw market-data values are passed through the existing calculation and the composed yield is correct.

### GBp Dividend

Use a representative GBp example and verify the composed yield reflects the existing `* 100` unit normalization.

This demonstrates that the query service uses the established domain function rather than naïve division.

---

## 39. Required Market Cap / FX Tests

At minimum test:

### USD

USD market cap is converted to billions without requiring external FX.

### Non-USD

A deterministic exchange rate produces the expected USD-billions result.

### GBp

Verify that GBp market currency uses the existing market-cap-specific:

```text
GBp -> GBP
```

FX mapping without scaling raw market cap by 100.

### Missing Market Cap

Only that stock's converted market cap is unavailable.

### Missing FX Currency

Partial FX response leaves only affected market caps unavailable.

---

## 40. Required Global FX Failure Test

Use a Watchlist containing at least:

```text
AAPL / USD
SAP.DE / EUR
```

Make `ExchangeRateProvider` fail globally.

Verify:

### AAPL

```text
marketCapBillionsUsd
```

is still calculated using USD identity conversion.

### SAP.DE

```text
marketCapBillionsUsd
```

is unavailable.

### Both

Other Yahoo/Target-Price-derived fields remain available.

### Query Result

Contains an explicit warning/status indicating global FX-provider failure.

The query itself does not fail solely because Frankfurter failed.

---

## 41. Required Read-Only Tests

Verify that:

```text
WatchlistRepository.save
TargetPriceRepository.save
```

are never called during the query.

If the existing repository fakes do not expose save calls conveniently, use small query-specific fakes.

Do not modify production repository contracts solely for test observability.

---

## 42. User Isolation

Explicitly verify that the same:

```text
watchlistId
symbol
```

for two different users is composed from each user's own:

* Watchlist document;
* Target Prices.

The service must pass the trusted `userId` unchanged to both repositories.

Do not introduce application-global query state.

---

## 43. Application Error / Warning Model

Introduce only the smallest application-level query error/warning types needed.

At minimum distinguish:

```text
Watchlist not found
global market-data provider failure
global FX provider warning/degradation
```

Do not create a broad generic error hierarchy.

Reuse existing application/provider errors where that keeps the contract clear.

Do not expose Yahoo- or Frankfurter-specific error types through the composed DTO.

---

## 44. Architecture Documentation

Update `ARCHITECTURE.md` to document the query/composition responsibility if it is not already explicit enough.

Make targeted changes only.

The architecture should make clear that:

* the server composes Watchlist membership, Target Prices, market data, FX data, and derived values;
* market data is loaded in batch for the selected Watchlist;
* stock order follows persisted Watchlist order;
* one missing Yahoo symbol does not fail the Watchlist;
* a global market-data provider failure fails the market-data query;
* missing individual FX rates degrade only affected market-cap fields;
* a global FX-provider failure still permits USD market-cap calculation and other Yahoo-derived fields;
* the query result exposes enough status for the UI to show an FX-unavailable warning;
* the query service is read-only;
* filtering and sorting remain client-side;
* investment allocation is not part of the normal Watchlist query.

Do not rewrite unrelated architecture sections.

---

## Non-Goals

Do NOT implement:

* REST endpoints;
* Svelte UI;
* filtering;
* sorting;
* table footer counts;
* Watchlist mutations;
* Target Price mutations;
* Yahoo symbol validation when adding a stock;
* investment allocation;
* savings amount;
* invested total;
* automatic savings recalculation;
* market-data persistence;
* FX persistence;
* caching;
* retry policies;
* authentication wiring;
* concrete KV/provider construction in HTTP routes.

Do not modify existing domain formulas unless a genuine defect is discovered and reported before changing architecture.

---

## Acceptance Criteria

The task is complete when all of the following are true:

1. A server-only Watchlist query/composition service exists.
2. It depends on application-owned repositories/providers rather than concrete infrastructure.
3. It accepts a trusted server-side `userId`.
4. It can query one Watchlist by ID.
5. Missing Watchlists fail explicitly.
6. Empty Watchlists return an empty stock collection without provider calls.
7. An application-owned composed Watchlist result exists.
8. An application-owned composed stock result exists.
9. Stock result order follows persisted Watchlist symbol order.
10. Target Prices are composed by `User + Symbol`.
11. Missing Target Prices are legitimate.
12. Market data is fetched in one batch for the Watchlist.
13. One missing market-data symbol does not fail the Watchlist.
14. Missing-symbol entries remain present in the result.
15. A global market-data provider failure remains a query failure.
16. Price remains in the stock's trading currency.
17. Display currency remains the market-data currency, including `GBp`.
18. Dividend yield uses the existing domain calculation.
19. Target distance uses the existing domain calculation.
20. Market-cap USD conversion uses existing conversion logic.
21. Required FX currencies are deduplicated.
22. No unnecessary FX conversion is attempted for missing market caps/data.
23. Partial FX availability degrades only affected market-cap fields.
24. Global FX failure does not fail the entire Watchlist query.
25. USD market caps remain calculable during global FX failure.
26. Non-USD market caps become unavailable during global FX failure.
27. Other market/Target-Price-derived fields remain available during FX failure.
28. Global FX failure is represented by an explicit query warning/status.
29. Missing individual market cap is not represented as a global FX failure.
30. Query operations perform no persistence writes.
31. No market/FX/derived data is persisted.
32. No caching is introduced.
33. No investment allocation is performed.
34. No client filtering or sorting is performed.
35. User isolation is tested.
36. Unit tests require no Cloudflare, Yahoo, Frankfurter, or network access.
37. Existing project checks still pass.
38. `ARCHITECTURE.md` reflects the composition and graceful-degradation rules.
39. No REST API or UI functionality is implemented.
40. No unnecessary production dependency is introduced.

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

Review any `ARCHITECTURE.md` diff and verify that it only documents the new query/composition responsibility and established degradation behavior.

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
2. the final Watchlist query-service API;
3. the final composed Watchlist type;
4. the final composed Stock type;
5. query-level error/warning types introduced;
6. Watchlist-not-found behavior;
7. empty-Watchlist behavior;
8. stock-order preservation;
9. Target Price composition behavior;
10. market-data batch behavior;
11. missing-symbol behavior;
12. global market-data failure behavior;
13. dividend-yield composition;
14. target-distance composition;
15. market-cap/FX composition;
16. partial FX behavior;
17. global FX failure/degradation behavior;
18. how USD market caps remain available during FX failure;
19. confirmation that the query performs no persistence writes;
20. confirmation that no investment allocation occurs;
21. how user isolation was tested;
22. unit-test scenarios added;
23. changes made to `ARCHITECTURE.md`;
24. results of `check`, `test`, `lint`, and `build`;
25. confirmation that this task's status was changed to `Done`;
26. assumptions or unresolved issues;
27. deviations from this task or `ARCHITECTURE.md`.

Do not proceed to validated symbol addition, REST APIs, or UI implementation.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
