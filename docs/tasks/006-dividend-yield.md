# TASK-006: Dividend Unit Normalization and Dividend Yield

## Status

Done

## Goal

Implement the server-side business logic for calculating dividend yield from the raw market data supplied by `MarketDataProvider`.

The initial production implementation intentionally contains only one special normalization rule:

> For Yahoo market data with currency `GBp`, the stock price is expressed in pence while `annualDividend` is treated as being expressed in GBP. The dividend must therefore be multiplied by 100 before calculating dividend yield.

Do not reproduce obsolete symbol-specific or INR-specific workarounds from the legacy application.

The calculation must remain pure, infrastructure-independent, server-only, and comprehensively unit-tested.

---

## Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* `docs/spikes/002-yahoo-finance.md`
* this task completely

Relevant existing production code includes:

* `StockMarketData`;
* `MarketDataProvider`;
* `YahooFinanceAdapter`;
* exchange-rate infrastructure;
* market-cap conversion;
* existing server-side domain calculations.

`YahooFinanceAdapter` deliberately exposes Yahoo's raw:

```text
trailingAnnualDividendRate -> annualDividend
```

without applying dividend corrections.

This task introduces the application-owned dividend calculation that consumes those raw values.

---

## 1. Business Meaning

Dividend yield is calculated from:

```text
annual dividend
----------------
current stock price
```

Both values must use compatible units before division.

For normal currencies, the current assumption is that Yahoo's:

```text
annualDividend
price
```

are directly compatible.

For Yahoo currency `GBp`, they are not directly compatible.

---

## 2. Standard Dividend Yield

For normal supported market data:

```text
dividendYield =
    annualDividend / price
```

Example:

```text
annualDividend = 5
price = 100

dividendYield = 0.05
```

The domain value is the decimal ratio:

```text
0.05
```

not:

```text
5
```

and not:

```text
"5 %"
```

Percentage formatting belongs to the UI.

---

## 3. GBp Unit Normalization

Yahoo may report UK-listed stocks using:

```text
currency = "GBp"
```

where the market price is expressed in British pence.

For dividend-yield calculation, the raw Yahoo `annualDividend` is treated as being expressed in GBP.

Therefore:

```text
normalizedAnnualDividend =
    annualDividend * 100
```

before dividing by the GBp price.

Conceptually:

```ts
if (currency === 'GBp') {
  normalizedAnnualDividend = annualDividend * 100;
}
```

and then:

```text
dividendYield =
    normalizedAnnualDividend / price
```

### Example

Given:

```text
currency = GBp
annualDividend = 4.85
price = 18_000
```

normalize:

```text
4.85 GBP -> 485 pence
```

then:

```text
485 / 18_000 ≈ 0.02694
```

which corresponds to approximately:

```text
2.694 %
```

when formatted for display.

Do not use Frankfurter for this conversion.

This is a unit conversion:

```text
GBP -> pence
```

not an FX conversion.

---

## 4. Important Scope of the GBp Rule

The `GBp` rule in this task applies specifically to dividend-yield calculation.

It MUST NOT become a generic transformation of all Yahoo numeric values.

In particular:

```text
StockMarketData.marketCap
```

must NOT be divided or multiplied by 100 because the stock's Yahoo currency is `GBp`.

TASK-005 already established the separate market-cap behavior:

```text
GBp market currency
        |
        v
GBP FX currency code
        |
        v
raw marketCap * GBP->USD rate
```

without scaling the raw market-cap value.

Keep these concerns separate.

---

## 5. No INR Special Handling

The legacy application contained:

```ts
if (currency === 'INR') {
  dividend *= 100;
}
```

Do NOT implement this rule.

Current evidence does not justify retaining it, and stocks requiring this legacy workaround are no longer part of the required use case.

For `INR`, use the normal dividend calculation unless future evidence introduces a new explicit requirement.

---

## 6. No Symbol-Specific Legacy Corrections

The legacy application contained corrections for:

```text
LISP.SW
HEXA-B.ST
TOM.OL
```

Do NOT implement any of them.

Specifically, do not introduce:

```text
LISP.SW   -> dividend / 10
HEXA-B.ST -> dividend * 11
HEXA-B.ST -> dividend * 11.2
TOM.OL    -> dividend * 11
TOM.OL    -> dividend * 11.59
```

or any equivalent symbol-specific rules.

These legacy corrections are intentionally excluded from the new production implementation.

If Yahoo data for a specific stock is later demonstrated to require correction, it must be introduced through a separate explicit requirement with current evidence and corresponding tests.

---

## 7. Dividend Normalization Design

Implement the smallest practical pure-function design.

The implementation should make the unit-normalization step understandable rather than burying it inside unrelated arithmetic.

Conceptually:

```text
raw annualDividend
       |
       v
normalize dividend unit
       |
       v
normalized annualDividend
       |
       v
divide by price
       |
       v
dividend yield
```

Whether this is implemented as:

* one function;
* two small pure functions;

is an implementation decision.

Do not introduce a large normalization framework or rule engine.

There is currently exactly one production normalization rule: `GBp`.

---

## 8. Missing Dividend

If:

```text
annualDividend === undefined
```

the dividend yield is:

```text
0
```

This represents the application's established behavior for a stock without usable dividend data.

Do not throw.

---

## 9. Zero Dividend

If:

```text
annualDividend === 0
```

the dividend yield is:

```text
0
```

This is a valid result.

---

## 10. Missing or Invalid Price

A dividend yield cannot be calculated without a valid positive market price.

If price is:

* `undefined`;
* `0`;
* negative;
* `NaN`;
* `Infinity`;
* `-Infinity`;

the result must be:

```text
0
```

Do not throw for invalid provider-sourced price data.

---

## 11. Invalid Dividend Values

Provider-sourced dividend values must not cause:

```text
NaN
Infinity
-Infinity
```

to propagate as valid dividend yields.

If `annualDividend` is:

* negative;
* `NaN`;
* `Infinity`;
* `-Infinity`;

treat it as unusable and return:

```text
0
```

The application does not currently model negative dividend yield.

---

## 12. Numeric Robustness

The final calculated dividend yield must be finite and non-negative.

If normalization or division produces an unusable numeric result, return:

```text
0
```

Do not introduce arbitrary decimal/financial math libraries.

Native TypeScript number arithmetic is sufficient for this calculation.

---

## 13. Currency Behaviour

The calculation should not require a currency for the normal case.

For example:

```text
annualDividend = 5
price = 100
currency = undefined
```

may still produce:

```text
0.05
```

because no currency-specific normalization is required.

Only the explicit:

```text
currency === "GBp"
```

case changes the dividend unit.

Do not reject otherwise valid dividend data merely because the currency is absent or unfamiliar.

---

## 14. No ExchangeRateProvider Dependency

Dividend-yield calculation MUST NOT depend on:

* `ExchangeRateProvider`;
* `FrankfurterAdapter`;
* network access;
* current FX rates.

The `GBp` normalization is a fixed unit relationship:

```text
1 GBP = 100 pence
```

not a foreign-exchange rate.

This calculation must remain synchronous and pure.

---

## 15. Relationship to StockMarketData

The calculation consumes raw provider data such as:

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

Do NOT mutate the supplied `StockMarketData`.

In particular, do not replace:

```text
annualDividend
```

with its normalized value.

Normalization exists only for deriving dividend yield.

The raw provider value remains unchanged.

---

## 16. Server-Only Implementation

Dividend calculation belongs to server-owned business logic.

Place it under the existing server-side domain/application structure.

It MUST NOT be implemented in:

* `.svelte` components;
* client-side stores;
* browser modules.

The UI will eventually receive the already calculated dividend yield.

---

## 17. Unit Tests

Add comprehensive unit tests.

At minimum cover the following scenarios.

### Standard Currency

```text
annualDividend = 5
price = 100
currency = USD

result = 0.05
```

### EUR

Verify that EUR receives no special conversion.

### INR

Verify explicitly that INR receives no `* 100` legacy correction.

For example:

```text
annualDividend = 5
price = 100
currency = INR

result = 0.05
```

not:

```text
5
```

### GBp

Verify:

```text
annualDividend = 4.85
price = 18_000
currency = GBp

result ≈ 0.026944...
```

### GBp Raw Data Not Mutated

Verify that calculating the yield does not mutate the original `StockMarketData` or dividend value.

### Missing Dividend

Result `0`.

### Zero Dividend

Result `0`.

### Missing Price

Result `0`.

### Zero Price

Result `0`.

### Negative Price

Result `0`.

### Negative Dividend

Result `0`.

### Non-Finite Price

Test:

```text
NaN
Infinity
-Infinity
```

### Non-Finite Dividend

Test:

```text
NaN
Infinity
-Infinity
```

### Missing Currency

Verify that otherwise valid normal data can still be calculated.

### Unknown Currency

Verify that an unfamiliar currency code receives no arbitrary correction and uses the standard calculation.

---

## 18. No Live Provider Tests

Tests introduced by this task MUST NOT call:

* Yahoo Finance;
* Frankfurter;
* Cloudflare;
* any network service.

The raw values needed by tests should be supplied directly.

Do not mock infrastructure that the calculation does not require.

---

## 19. Update ARCHITECTURE.md

As part of this task, update the relevant dividend sections of `ARCHITECTURE.md` to reflect the decisions made after TASK-002.

The current architecture contains legacy correction rules that are no longer part of the desired production behavior.

Make only targeted changes to the relevant dividend sections.

### Required Architecture Changes

The architecture must state that the production dividend-yield calculation is:

```text
normal case:

dividendYield =
    annualDividend / price
```

and:

```text
GBp case:

dividendYield =
    (annualDividend * 100) / price
```

The architecture must explain that the `GBp` adjustment is a unit conversion because Yahoo's price is expressed in pence while the dividend value is treated as GBP for this calculation.

### Remove INR Correction

Remove any architectural requirement that says:

```text
INR -> dividend * 100
```

The new application has no INR-specific dividend correction.

### Remove Symbol-Specific Corrections

Remove the production requirements for:

```text
LISP.SW
HEXA-B.ST
TOM.OL
```

Do not leave them listed as current production normalization rules.

If useful for historical clarity, they may be mentioned briefly as intentionally discarded legacy workarounds, but they MUST NOT appear as required current behavior.

### Preserve Market-Cap GBp Rule

Do not accidentally change the separate TASK-005 market-cap rule.

The architecture must continue to distinguish:

```text
Dividend Yield:
GBp dividend unit normalization -> * 100
```

from:

```text
Market Cap:
GBp -> GBP currency-code mapping for FX
NO marketCap / 100 or * 100 scaling
```

### Remove Stale Open Questions

If `ARCHITECTURE.md` still says the exact multipliers for `HEXA-B.ST` or `TOM.OL` must be verified, remove that open question.

Those corrections are no longer planned.

Do not rewrite unrelated architecture sections.

---

## Non-Goals

Do NOT implement:

* symbol-specific dividend corrections;
* INR dividend correction;
* Frankfurter-based dividend conversion;
* general FX conversion for dividends;
* market-cap conversion changes;
* target-price logic;
* investment allocation changes;
* Watchlist CRUD;
* persistence;
* Cloudflare KV;
* authentication;
* REST endpoints;
* UI;
* percentage formatting;
* market-data caching;
* exchange-rate caching.

Do not modify `YahooFinanceAdapter` to calculate dividend yield.

The Yahoo adapter must continue to expose raw `annualDividend`.

---

## Acceptance Criteria

The task is complete when all of the following are true:

1. Dividend-yield calculation exists as server-owned business logic.
2. Standard dividend yield is calculated as `annualDividend / price`.
3. The returned value is a decimal ratio rather than a formatted percentage.
4. `GBp` uses `(annualDividend * 100) / price`.
5. The `GBp` rule is implemented as dividend-specific unit normalization.
6. The `GBp` rule does not modify market-cap behavior.
7. INR receives no special dividend correction.
8. `LISP.SW` receives no symbol-specific correction.
9. `HEXA-B.ST` receives no symbol-specific correction.
10. `TOM.OL` receives no symbol-specific correction.
11. Missing dividend produces yield `0`.
12. Zero dividend produces yield `0`.
13. Missing, zero, negative, or non-finite price produces yield `0`.
14. Negative or non-finite dividend produces yield `0`.
15. The final result cannot silently be `NaN` or infinite.
16. Missing or unknown currency does not prevent normal calculation.
17. No exchange-rate provider is required.
18. No external service is called by the calculation.
19. Raw `StockMarketData` is not mutated.
20. Comprehensive unit tests cover normal, GBp, INR, missing-data, and numeric edge cases.
21. Standard tests require no network access.
22. `ARCHITECTURE.md` reflects the new dividend rules.
23. Stale INR and symbol-specific production correction requirements are removed from `ARCHITECTURE.md`.
24. Existing market-cap GBp behavior remains unchanged.
25. Existing project checks still pass.
26. No unrelated persistence, API, authentication, or UI functionality is implemented.
27. No new production dependency is introduced.

---

## Verification

Before completing the task, execute:

```bash
npm run check
npm run test
npm run lint
npm run build
```

All newly introduced tests must pass without network access.

Review the relevant `ARCHITECTURE.md` diff and verify that it does not accidentally alter the market-cap rules established by TASK-005.

Do not report a command as successful unless it was actually executed successfully.

---

## Completion Report

When finished, report:

1. files added or changed;
2. the dividend normalization/calculation functions introduced;
3. the exact GBp behavior implemented;
4. confirmation that INR has no special handling;
5. confirmation that `LISP.SW`, `HEXA-B.ST`, and `TOM.OL` have no special handling;
6. missing/invalid-data behavior;
7. unit-test scenarios added;
8. the exact relevant changes made to `ARCHITECTURE.md`;
9. confirmation that market-cap GBp behavior was not changed;
10. results of `check`, `test`, `lint`, and `build`;
11. assumptions or unresolved issues;
12. deviations from this task or `ARCHITECTURE.md`.

Do not proceed to persistence, authentication, REST APIs, Watchlist composition, or UI implementation.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
