# TASK-004: Market Data Provider and Yahoo Finance Adapter

## Status

Done

## Goal

Turn the successful Yahoo Finance spike into a small production-ready market-data integration.

Introduce an application-owned market-data boundary and implement Yahoo Finance as its first provider using the already validated `yahoo-finance2` dependency.

The rest of the application must no longer need to know:

* which Yahoo library is used;
* Yahoo response types;
* Yahoo field names;
* Yahoo cookie/crumb handling;
* Yahoo-specific missing-symbol behavior.

This task establishes the boundary:

```text
Application
     |
     v
MarketDataProvider
     |
     v
YahooFinanceAdapter
     |
     v
yahoo-finance2
     |
     v
Yahoo Finance
```

Do not implement Watchlist business functionality, persistence, currency conversion, dividend normalization, or UI as part of this task.

---

## Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* `docs/spikes/002-yahoo-finance.md`
* this task completely

TASK-002 established that `yahoo-finance2` version 4.0.2 works in the Cloudflare Workers `workerd` runtime for the required quote functionality.

The spike also established important provider behavior:

* Yahoo cookie/crumb handling works automatically;
* a single invalid symbol may resolve to `undefined` instead of throwing;
* a batch containing an invalid symbol may return successful symbols while silently omitting the invalid one;
* required Yahoo fields may be absent;
* provider/network failures are catchable;
* Yahoo remains an unofficial and potentially unstable external dependency.

These findings must inform the production adapter.

---

## 1. Application-Owned Market Data Type

Introduce an application-owned type representing the raw market information required by Watchlist.

Conceptually:

```ts
export interface StockMarketData {
  symbol: string;
  name?: string;
  price?: number;
  currency?: string;
  annualDividend?: number;
  marketCap?: number;
}
```

The exact naming may be adjusted if there is a clear reason and it remains consistent with `ARCHITECTURE.md`.

The type MUST NOT:

* extend a `yahoo-finance2` type;
* expose Yahoo-specific type definitions;
* contain Watchlist persistence data;
* contain target prices;
* contain target-price distance;
* contain dividend yield;
* contain investment factors;
* contain savings amounts;
* contain converted USD market capitalization.

It represents provider-sourced market information only.

---

## 2. Yahoo Field Mapping

The Yahoo adapter must map the required Yahoo quote fields:

```text
Yahoo                       Application

symbol                      symbol
longName                    name
regularMarketPrice          price
currency                    currency
trailingAnnualDividendRate  annualDividend
marketCap                   marketCap
```

Yahoo field names MUST NOT leak beyond the Yahoo adapter implementation or Yahoo-specific tests.

Do not rely on structural coincidence between Yahoo responses and application-owned types.

Perform explicit mapping.

---

## 3. MarketDataProvider Boundary

Introduce a small application-owned provider abstraction.

It must support the application's two relevant use cases:

1. resolving/fetching one symbol;
2. fetching market data for multiple symbols.

Do not design a generic financial-data SDK.

The interface should expose only what Watchlist currently needs.

A conceptual shape could be:

```ts
interface MarketDataProvider {
  getQuote(symbol: string): Promise<StockMarketData | undefined>;
  getQuotes(symbols: string[]): Promise<...>;
}
```

The exact batch return type is an implementation decision, but it must make it easy for application code to identify:

* successfully resolved symbols;
* requested symbols for which Yahoo returned no result.

Prefer a result shape that avoids requiring callers to understand Yahoo's omission behavior.

---

## 4. Symbol Identity

`symbol` is the identity of a stock within a Watchlist.

The provider boundary should preserve the provider-returned symbol while also allowing callers to correlate results with requested symbols.

Do not introduce fuzzy matching or symbol search in this task.

Do not silently substitute another symbol when Yahoo does not resolve the requested one.

---

## 5. Single-Symbol Behaviour

Implement single-symbol retrieval.

Expected behavior:

### Valid Symbol

Return mapped `StockMarketData`.

### Unknown / Invalid Symbol

Return a clean application-level "not found" result according to the provider interface design.

Do not expose Yahoo's `undefined` behavior as an undocumented accident.

An unknown symbol is not the same as a provider outage.

### Provider Failure

A Yahoo/network/provider failure must be distinguishable from an unknown symbol.

Do not convert all exceptions into "symbol not found".

---

## 6. Batch Behaviour

Implement batch retrieval suitable for loading an entire Watchlist.

The implementation should use Yahoo's batch capability rather than making one Yahoo request per symbol.

### Partial Success

If the request contains:

```text
AAPL
SAP.DE
THIS-SYMBOL-DOES-NOT-EXIST
TOM.OL
```

and Yahoo returns:

```text
AAPL
SAP.DE
TOM.OL
```

the provider result must make the missing symbol identifiable without failing the entire request.

This behavior is required by the architecture's partial-success strategy.

### Provider Failure

If the Yahoo request fails globally, return/throw an application-level provider failure rather than pretending all symbols were individually missing.

---

## 7. Error Model

Introduce only the minimal application-level error model needed to distinguish:

```text
symbol not found / omitted
```

from:

```text
market-data provider unavailable / failed
```

Do not expose raw `yahoo-finance2` exceptions to application callers as the public contract.

Preserve the original error as a cause where useful for diagnostics.

Do not introduce a large general-purpose error hierarchy.

---

## 8. Missing Fields

Yahoo may return a valid quote with some optional fields absent.

This must not cause the entire stock to be treated as missing.

For example, a stock without:

```text
trailingAnnualDividendRate
```

may still be valid market data.

The adapter must map unavailable optional fields to `undefined`.

Do not:

* invent values;
* convert missing market data to `0`;
* calculate dividend yield;
* perform currency conversion.

The distinction between:

```text
missing external data
```

and:

```text
calculated business value = 0
```

must remain explicit.

---

## 9. No Provider-Specific Business Corrections

Do NOT yet implement the known dividend corrections for:

```text
GBp
INR
LISP.SW
HEXA-B.ST
TOM.OL
```

The adapter in this task returns the Yahoo `trailingAnnualDividendRate` as `annualDividend` without applying Watchlist's known normalization rules.

The raw Yahoo value must remain available for the later dividend-normalization task.

Likewise, do not normalize `GBp` or apply unit conversion to `regularMarketPrice`.

---

## 10. Market Capitalization

Map Yahoo's `marketCap` directly into the application-owned market-data type.

Do NOT:

* divide by one billion;
* convert it to USD;
* apply GBp normalization to it;
* call an exchange-rate provider.

Market-cap conversion is a separate future business/application concern.

The spike specifically established that a stock having Yahoo currency `GBp` does not imply that `marketCap` should be divided by 100.

Do not implement generic currency normalization across all Yahoo numeric fields.

---

## 11. yahoo-finance2 Encapsulation

Only the Yahoo adapter and its Yahoo-specific tests may directly depend on `yahoo-finance2`.

Other application/domain modules MUST NOT import:

* `yahoo-finance2`;
* Yahoo quote types;
* Yahoo modules;
* Yahoo-specific helper types.

Cookie/crumb behavior remains the responsibility of `yahoo-finance2`.

Do not manually implement cookie/crumb handling in this task.

Do not introduce a personal Yahoo cookie.

---

## 12. Runtime Compatibility

The production adapter must remain compatible with the Cloudflare Workers target validated during TASK-002.

Do not introduce additional `yahoo-finance2` modules unless required by this task.

If an additional module or configuration changes the runtime assumptions established by the spike, verify it under `workerd` before completing the task.

Do not add `nodejs_compat` or other compatibility flags unless genuinely required and justified.

---

## 13. Server-Only Implementation

Market-data provider code belongs exclusively on the server.

Use SvelteKit server-only module conventions so that provider code cannot accidentally be bundled into browser code.

No Yahoo code may be imported from:

* `.svelte` components;
* client-side stores;
* browser modules.

---

## 14. Testing Strategy

Add automated tests for the production market-data boundary.

Standard unit tests MUST NOT depend on live Yahoo Finance access.

Use test doubles/mocks at the Yahoo library boundary where necessary.

### Required Test Scenarios

At minimum test:

#### Mapping

Given a representative Yahoo quote, verify explicit mapping of:

```text
symbol
longName
regularMarketPrice
currency
trailingAnnualDividendRate
marketCap
```

into the application-owned market-data type.

#### Missing Optional Fields

Verify that missing optional Yahoo fields remain `undefined`.

#### Single Valid Symbol

Verify successful mapped retrieval.

#### Single Invalid Symbol

Verify clean not-found semantics when Yahoo returns `undefined`.

#### Single Provider Failure

Verify that a Yahoo/library/network exception becomes the defined application-level provider failure.

#### Batch Success

Verify multiple successful mapped results.

#### Batch Partial Success

Given requested symbols where Yahoo omits one result, verify that the missing symbol is identifiable.

#### Batch Provider Failure

Verify that a global Yahoo failure remains distinguishable from individual missing symbols.

#### No Business Transformation

Tests should demonstrate that raw provider values such as:

```text
currency = "GBp"
```

and raw dividend values are mapped without applying later business/provider-normalization rules.

---

## 15. Testability

Production code should make the Yahoo boundary testable without requiring network access.

Do not make unit tests dependent on module-global behavior that is difficult to replace.

At the same time, do not introduce a complex dependency-injection framework.

Use the smallest practical TypeScript design that allows deterministic testing.

---

## 16. Existing Spike

The spike code under:

```text
spike/yahoo-finance/
```

is evidence and experimental tooling from TASK-002.

Do not refactor it into production code merely to avoid implementing a clean production boundary.

Production code belongs under the appropriate server-side application structure.

The spike may remain unchanged unless a concrete cleanup is necessary.

---

## Non-Goals

Do NOT implement:

* Watchlist CRUD;
* symbol persistence;
* target-price persistence;
* target-price calculations;
* savings calculations;
* dividend normalization;
* dividend yield;
* GBp normalization;
* INR dividend correction;
* symbol-specific dividend corrections;
* Frankfurter integration;
* exchange rates;
* market-cap USD conversion;
* Cloudflare KV;
* Cloudflare Access;
* authentication;
* production REST endpoints;
* stock table UI;
* filtering;
* sorting;
* caching;
* retry policies;
* rate-limit handling beyond exposing provider failure appropriately.

Do not introduce a generic caching layer.

---

## Suggested Structure

Follow existing project conventions.

A conceptual structure could resemble:

```text
src/lib/server/
├── domain/
│   └── ...
│
└── market-data/
    ├── MarketDataProvider.ts
    ├── YahooFinanceAdapter.ts
    └── ...
```

Tests should live according to the project's established test conventions.

This structure is illustrative.

Do not force it if a simpler structure better matches the existing codebase.

---

## Acceptance Criteria

The task is complete when all of the following are true:

1. An application-owned `StockMarketData` type exists.
2. The type contains only provider-sourced market information required by Watchlist.
3. A small `MarketDataProvider` abstraction exists.
4. A production Yahoo adapter implements that abstraction using `yahoo-finance2`.
5. Yahoo fields are explicitly mapped to application-owned field names.
6. Yahoo types do not leak beyond the Yahoo integration boundary.
7. Single-symbol retrieval works through the provider abstraction.
8. Unknown single symbols are represented cleanly and distinctly from provider failures.
9. Batch retrieval uses Yahoo's batch capability.
10. Batch partial success identifies requested symbols omitted by Yahoo.
11. Global provider failures remain distinguishable from missing symbols.
12. Missing optional Yahoo fields remain `undefined`.
13. No dividend correction is performed.
14. No currency conversion or GBp normalization is performed.
15. No market-cap conversion is performed.
16. No personal Yahoo cookie or manual crumb handling is introduced.
17. Provider code is server-only.
18. Automated tests cover mapping, missing data, single retrieval, batch retrieval, partial success, and provider failure.
19. Standard automated tests require no network access.
20. Existing project checks still pass.
21. No unrelated Watchlist functionality has been implemented.
22. No unnecessary production dependency has been introduced.

---

## Verification

Before completing the task, execute:

```bash
npm run check
npm run test
npm run lint
npm run build
```

All tests introduced by this task must pass without live Yahoo/network access.

If implementation changes the Cloudflare runtime assumptions established by TASK-002, additionally execute the relevant adapter path under `wrangler dev` / `workerd`.

Do not claim runtime verification unless it was actually performed.

---

## Architecture Documentation

TASK-002 changed the status of `yahoo-finance2` from an open technical question to an accepted integration with conditions.

If `ARCHITECTURE.md` still describes the Yahoo integration as awaiting validation, update only the relevant sections so that they reflect the accepted TASK-002 result.

The architecture should record that:

* `yahoo-finance2` is the accepted Yahoo integration;
* it was verified under Cloudflare `workerd`;
* cookie/crumb handling is automatic;
* unknown single symbols may produce no result;
* batch responses may omit unresolved symbols;
* Yahoo remains unofficial and replaceable behind `MarketDataProvider`;
* the spike evidence is available in `docs/spikes/002-yahoo-finance.md`.

Do not rewrite unrelated architecture sections.

---

## Completion Report

When finished, report:

1. files added or changed;
2. the final `StockMarketData` shape;
3. the final `MarketDataProvider` contract;
4. how Yahoo responses are mapped;
5. single-symbol not-found behavior;
6. batch partial-success behavior;
7. provider-failure behavior;
8. how `yahoo-finance2` was isolated from the rest of the application;
9. unit-test scenarios added;
10. whether live/workerd verification was necessary and, if so, what was executed;
11. results of `check`, `test`, `lint`, and `build`;
12. any assumptions or unresolved issues;
13. any deviations from this task or `ARCHITECTURE.md`.

Do not proceed to currency conversion, dividend normalization, persistence, authentication, REST APIs, or UI implementation.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
