# TASK-005: Exchange Rate Provider and Market Cap Conversion

## Status

Done

## Goal

Implement the application's exchange-rate boundary using the Frankfurter API and add the server-side business/application logic required to convert stock market capitalization into billions of USD.

This task establishes the boundary:

```text
Application / Domain Logic
          |
          v
ExchangeRateProvider
          |
          v
FrankfurterAdapter
          |
          v
Frankfurter API
```

and enables:

```text
Yahoo marketCap + currency
          |
          v
Exchange Rate
          |
          v
Market Cap in USD
          |
          v
Market Cap in billions USD
```

The implementation must remain server-only and independently testable without live network access.

Do not implement dividend normalization or general Yahoo currency/unit normalization as part of this task.

---

## Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* `docs/spikes/002-yahoo-finance.md`
* this task completely

Relevant existing production code includes:

* the application-owned `StockMarketData` type;
* `MarketDataProvider`;
* `YahooFinanceAdapter`.

Yahoo market data provides:

```text
marketCap
currency
```

The Watchlist UI ultimately requires market capitalization expressed as:

> billions of USD

The application must no longer use hard-coded exchange-rate multipliers.

Frankfurter is the selected exchange-rate provider.

---

## 1. Application-Owned Exchange Rate Boundary

Introduce a small application-owned abstraction for retrieving exchange rates.

Conceptually:

```ts
interface ExchangeRateProvider {
  // exact contract to be decided during implementation
}
```

The provider must support retrieving the rates needed to convert multiple currencies to USD efficiently.

Do not design a generic foreign-exchange SDK.

The interface should expose only what the Watchlist application currently needs.

Frankfurter-specific types and response structures MUST NOT leak through this boundary.

---

## 2. Frankfurter Adapter

Implement the first `ExchangeRateProvider` using the Frankfurter API.

The adapter must:

* execute only on the server;
* use HTTPS;
* require no API key;
* explicitly map Frankfurter responses into application-owned types;
* distinguish provider failures from valid responses;
* avoid exposing raw Frankfurter exceptions as its public contract.

Do not add authentication or credentials for Frankfurter.

---

## 3. Batch Exchange-Rate Retrieval

A Watchlist may contain stocks using several currencies.

For example:

```text
USD
EUR
CHF
GBP
SEK
NOK
INR
```

Do not issue one external HTTP request per stock.

The provider/application flow should determine the distinct currencies needed for the current operation and retrieve the required exchange rates efficiently.

Prefer one Frankfurter request for multiple required currencies where supported by the API.

Duplicate source currencies must not cause duplicate external requests.

---

## 4. USD Handling

USD is the target currency for market-cap conversion.

Converting USD to USD must use the identity rate:

```text
USD -> USD = 1
```

The implementation should not require a Frankfurter request solely to obtain this identity conversion.

For a Watchlist containing only USD market caps, no external FX request should be necessary.

---

## 5. Currency Codes

Generic exchange-rate conversion in this task operates on supported ISO-style currency codes.

Examples include:

```text
EUR
CHF
GBP
SEK
NOK
INR
USD
```

Do not assume that every value Yahoo exposes in its `currency` field is automatically a valid Frankfurter currency code.

---

## 6. Important GBp Rule

Yahoo may report UK-listed stocks with:

```text
currency = "GBp"
```

`GBp` represents British pence and is not equivalent to the ISO currency code `GBP`.

However, TASK-002 established an important provider-specific observation:

> Yahoo's `currency = GBp` does not mean that every numeric Yahoo field, especially `marketCap`, is represented in pence.

Therefore this task MUST NOT implement a generic rule such as:

```text
if currency === "GBp":
    divide every Yahoo numeric value by 100
```

and MUST NOT apply a `/ 100` transformation to Yahoo `marketCap`.

For market-cap conversion, the application must map the Yahoo market currency `GBp` to the FX currency `GBP` **without scaling the market-cap value**.

Conceptually:

```text
Yahoo:

currency  = GBp
marketCap = X

Market-cap FX conversion:

X GBP -> USD
```

This rule is specific to the market-cap conversion context.

Do not generalize it to stock price or dividend data.

Price/dividend unit normalization belongs to a later task.

---

## 7. Market Currency Mapping

Introduce the smallest practical mechanism needed to map market-data currency identifiers to currencies accepted by the exchange-rate provider.

For this task, the known special mapping is:

```text
GBp -> GBP
```

for market-cap FX conversion.

Normal ISO currencies pass through unchanged.

Do not introduce a large currency metadata framework.

The mapping should be explicit and unit-tested.

---

## 8. Market Cap Conversion

Implement server-side logic that converts a market capitalization into billions of USD.

Conceptually:

```text
marketCapInUsd =
    marketCap * exchangeRateToUsd

marketCapInBillionsUsd =
    marketCapInUsd / 1_000_000_000
```

For USD:

```text
marketCapInBillionsUsd =
    marketCap / 1_000_000_000
```

Do not perform display rounding inside the business calculation.

The result remains a numeric value.

Formatting such as:

```text
123.45
```

or locale-specific formatting belongs to the UI.

---

## 9. Missing Market Data

A market-cap conversion may be impossible because Yahoo data is incomplete.

At minimum handle:

* missing `marketCap`;
* missing `currency`.

Do not invent values.

Do not convert missing market cap to `0` merely to make the UI easier.

The calculation should preserve the distinction between:

```text
market cap is genuinely zero
```

and:

```text
market cap is unavailable
```

Use `undefined` or an equivalently explicit result where appropriate.

---

## 10. Invalid Numeric Values

Market-cap conversion must not silently produce:

```text
NaN
Infinity
-Infinity
```

as valid application data.

Handle non-finite market-cap values and exchange rates explicitly.

Do not introduce arbitrary financial-decimal libraries.

Native JavaScript/TypeScript number operations are sufficient for the current requirements.

---

## 11. Unsupported Currency

If the application receives a currency that cannot be converted by the configured exchange-rate provider, this must remain distinguishable from:

```text
market cap missing
```

and from:

```text
exchange-rate provider globally unavailable
```

Choose a small, explicit application-level representation/error model.

Do not introduce a large error hierarchy.

The eventual UI must be able to show other stock information while leaving the converted market cap unavailable.

---

## 12. Provider Failure

If Frankfurter cannot be reached or returns an invalid/global failure:

* do not treat the affected currencies as having rate `1`;
* do not invent fallback exchange rates;
* do not use hard-coded stale rates;
* expose a clean application-level provider failure.

Preserve the original error as a cause where useful for diagnostics.

The architecture requires FX failure to be recoverable as partial application data: Yahoo-derived values not requiring FX should still be usable by later application layers.

The final UI behavior is not implemented in this task.

---

## 13. No Exchange-Rate Caching

Do NOT introduce persistent or application-level exchange-rate caching in this task.

The initial architecture intentionally favors simplicity:

```text
load Watchlist
      |
      v
determine required currencies
      |
      v
fetch required FX rates
      |
      v
perform conversions
```

Caching may be introduced later if external calls become a practical concern.

Do not persist exchange rates in Cloudflare KV.

---

## 14. Server-Only Implementation

All exchange-rate provider and market-cap conversion logic belongs on the server.

Use SvelteKit server-only module conventions.

Do not put this functionality in:

* `.svelte` components;
* client-side stores;
* browser modules.

No direct Frankfurter request may originate from browser code.

---

## 15. Relationship to Market Data

Do not modify `StockMarketData` to contain the converted market cap.

It remains raw provider-sourced market information:

```ts
interface StockMarketData {
  symbol: string;
  name?: string;
  price?: number;
  currency?: string;
  annualDividend?: number;
  marketCap?: number;
}
```

The converted value is derived application/domain data.

Do not overwrite the raw Yahoo `marketCap`.

Later application composition will combine raw market data with derived values.

---

## 16. Testing Strategy

Add automated tests for both:

* the exchange-rate provider boundary/Frankfurter adapter;
* market-cap conversion logic.

Standard automated tests MUST NOT require live network access.

Use deterministic test doubles/fakes for HTTP/provider behavior.

Do not introduce a general mocking framework unless already available or clearly necessary.

---

## 17. Frankfurter Adapter Test Scenarios

At minimum test:

### Successful Multiple-Currency Response

Verify that a representative Frankfurter response containing several rates is explicitly mapped into application-owned data.

For example:

```text
EUR -> USD
CHF -> USD
GBP -> USD
```

### Provider Failure

Verify that:

* network/fetch failure;
* invalid HTTP response;

produce the selected application-level provider failure rather than leaking raw infrastructure behavior.

### Missing Requested Currency

Verify the chosen behavior when Frankfurter returns a successful response but omits one requested currency.

The missing currency must be identifiable.

### Empty Currency Request

If no external rates are needed, avoid unnecessary HTTP calls.

### USD Identity

Verify:

```text
USD -> USD = 1
```

without requiring an external rate.

---

## 18. Market Cap Conversion Test Scenarios

At minimum test:

### USD Market Cap

Example:

```text
marketCap = 2_500_000_000
currency = USD

result = 2.5
```

No FX conversion is required.

### EUR Market Cap

Given a deterministic test rate:

```text
EUR -> USD = 1.2
```

and:

```text
marketCap = 10_000_000_000 EUR
```

the result must be:

```text
12
```

billions USD.

### GBp Market

Given:

```text
currency = GBp
```

verify that:

* the FX currency is mapped to `GBP`;
* the market-cap value is NOT divided by 100;
* the GBP -> USD exchange rate is applied directly to the raw market-cap value.

### Missing Market Cap

Returns unavailable/undefined according to the selected contract.

### Missing Currency

Returns unavailable/undefined according to the selected contract.

### Non-Finite Input

Verify explicit handling of:

```text
NaN
Infinity
-Infinity
```

### Invalid Exchange Rate

Verify that invalid/non-positive/non-finite exchange rates do not produce valid-looking market-cap values.

### Unsupported Currency

Verify the selected explicit unsupported-currency behavior.

---

## 19. Batch-Oriented Application Logic

Where appropriate, provide application logic capable of converting market caps for a collection of `StockMarketData` values without causing one FX request per stock.

Conceptually:

```text
StockMarketData[]
        |
        v
distinct required FX currencies
        |
        v
ExchangeRateProvider
        |
        v
rates
        |
        v
converted market caps
```

Do not create a Watchlist service yet.

Do not introduce persistence.

Keep this composition narrowly focused on FX requirements and market-cap derivation.

---

## Non-Goals

Do NOT implement:

* dividend normalization;
* dividend yield;
* GBp price conversion;
* GBp dividend conversion;
* INR dividend correction;
* symbol-specific dividend corrections;
* Watchlist CRUD;
* target-price persistence;
* Cloudflare KV;
* Cloudflare Access;
* authentication;
* REST endpoints;
* UI;
* table formatting;
* currency display formatting;
* exchange-rate caching;
* market-data caching;
* automatic retry policies;
* historical exchange rates;
* intraday FX data.

Do not modify Yahoo's raw `StockMarketData` values to contain converted data.

---

## Suggested Structure

Follow existing project conventions.

A conceptual structure might resemble:

```text
src/lib/server/
├── domain/
│   └── ...
│
├── market-data/
│   ├── MarketDataProvider.ts
│   └── YahooFinanceAdapter.ts
│
└── exchange-rates/
    ├── ExchangeRateProvider.ts
    ├── FrankfurterAdapter.ts
    └── marketCapConversion.ts
```

This is illustrative.

Prefer the simplest structure consistent with the existing codebase.

---

## Acceptance Criteria

The task is complete when all of the following are true:

1. An application-owned exchange-rate provider abstraction exists.
2. Frankfurter is implemented behind that abstraction.
3. Frankfurter-specific response types do not leak into application/domain logic.
4. Multiple required FX currencies can be retrieved efficiently.
5. Duplicate currencies do not cause duplicate external requests.
6. USD -> USD uses rate `1` without an external request.
7. Market-data currency `GBp` maps to FX currency `GBP` for market-cap conversion.
8. `GBp` market capitalization is NOT divided by 100.
9. Normal ISO currencies pass through without special scaling.
10. Market capitalization can be converted to USD.
11. Converted market capitalization is divided by `1_000_000_000`.
12. Business calculations do not perform UI/display rounding.
13. Missing market cap remains distinguishable from a numeric zero.
14. Missing currency is handled explicitly.
15. Unsupported currencies are distinguishable from missing data and global provider failure.
16. Non-finite values do not silently become valid derived values.
17. Provider failures do not result in invented/fallback exchange rates.
18. No hard-coded exchange-rate multipliers are introduced.
19. No exchange-rate cache or KV persistence is introduced.
20. All implementation is server-only.
21. Raw `StockMarketData.marketCap` is not overwritten with converted data.
22. Unit tests cover Frankfurter mapping/failures and market-cap conversion.
23. Standard tests require no network access.
24. Existing project checks still pass.
25. No unrelated dividend, persistence, authentication, REST, or UI functionality is implemented.
26. No unnecessary production dependency is introduced.

---

## Verification

Before completing the task, execute:

```bash
npm run check
npm run test
npm run lint
npm run build
```

All newly introduced tests must pass without live Frankfurter access.

If the implementation uses only standard Workers-compatible `fetch`, a successful project build plus deterministic adapter tests are sufficient for this task.

If additional runtime-specific functionality or dependencies are introduced, verify them under `wrangler dev` / `workerd` as appropriate.

Do not claim runtime verification unless it was actually executed.

---

## Architecture Documentation

If implementation reveals a necessary clarification to the FX or market-cap rules in `ARCHITECTURE.md`, update only the relevant sections.

In particular, ensure the architecture does not imply that `GBp -> GBP` requires dividing Yahoo `marketCap` by 100.

The architecture should preserve the distinction between:

```text
currency mapping for FX purposes
```

and:

```text
field-specific Yahoo unit normalization
```

Do not rewrite unrelated architecture sections.

---

## Completion Report

When finished, report:

1. files added or changed;
2. the final `ExchangeRateProvider` contract;
3. the Frankfurter endpoint/request strategy used;
4. the application-owned exchange-rate result shape;
5. how USD identity conversion is handled;
6. how `GBp` is handled specifically for market capitalization;
7. how missing and unsupported currencies are represented;
8. how provider failures are represented;
9. the market-cap conversion API/functions introduced;
10. how batch/multiple-currency conversion avoids one request per stock;
11. unit-test scenarios added;
12. whether live/workerd verification was necessary and, if so, what was executed;
13. results of `check`, `test`, `lint`, and `build`;
14. assumptions or unresolved issues;
15. deviations from this task or `ARCHITECTURE.md`.

Do not proceed to dividend normalization, persistence, authentication, REST APIs, or UI implementation.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
