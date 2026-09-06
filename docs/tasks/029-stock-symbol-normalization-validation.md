# TASK-029: Stock Symbol Normalization and Syntax Validation

## Status

Done

> **Extended by TASK-038.** TASK-038 later added a 20-character maximum
> (`MAX_STOCK_SYMBOL_LENGTH`) to the existing stock-symbol grammar this task
> established, enforced before `MarketDataProvider.resolveSymbol()`/
> `getQuote()`, and applied it to every external Stock Symbol boundary
> (stock addition and the Target Price `symbol` path parameter). The
> normalization/grammar rule itself (trim, then uppercase, then the
> `^[A-Z0-9]+(?:[.-][A-Z0-9]+)*$` pattern) is unchanged.

## Goal

Introduce a single, explicit application rule for stock-symbol normalization and syntactic validation.

This is the first V2 change based on observations from real production use.

The current application largely preserves the user's symbol input after trimming. This leads to inconsistent behavior such as:

```text
aapl
```

being sent to the MarketDataProvider in lowercase even though the intended Yahoo-style symbol is:

```text
AAPL
```

It also allows syntactically invalid input to reach provider validation unnecessarily.

The new canonical input pipeline is:

```text
raw input
    |
    v
trim
    |
    v
uppercase
    |
    v
syntax validation
    |
    +-- invalid
    |      |
    |      v
    |   INVALID_STOCK_SYMBOL
    |   no provider request
    |
    v
normalized valid symbol
    |
    v
existing provider-backed existence validation
```

Examples:

```text
" aapl "
    -> "AAPL"

"sap.de"
    -> "SAP.DE"

"hexa-b.st"
    -> "HEXA-B.ST"

"0700.hk"
    -> "0700.HK"
```

Invalid examples:

```text
AAPL!
SAP..DE
SAP_DE
SAP DE
.SAP
SAP.
-SAP
SAP-
```

The server is authoritative.

The client should apply the same normalization and syntax rule for immediate user feedback, but client validation is only a UX optimization and MUST NOT replace server validation.

This task does **not** introduce `MarketDataProvider.resolveSymbol()` yet.

The existing provider-backed existence behavior remains in place for syntactically valid symbols until TASK-030.

---

# Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* TASK-012;
* TASK-020;
* current stock-add client/API/server implementation;
* this task completely.

Inspect the actual current stock-add flow before changing it.

The current flow is conceptually:

```text
Stock symbol input
        |
        v
client add-stock API
        |
        v
AddStockToWatchlistService
        |
        v
trim
        |
        v
MarketDataProvider.getQuote(...)
        |
        +-- undefined
        |      |
        |      v
        |   UNKNOWN_STOCK_SYMBOL
        |
        v
WatchlistService.addSymbol(...)
```

TASK-012 deliberately preserved the trimmed input without case normalization.

TASK-029 explicitly supersedes that decision.

---

# Product Rule

## 1. Supported Symbol Grammar

For V2, a stock symbol is syntactically valid when its normalized representation matches:

```regex
^[A-Z0-9]+(?:[.-][A-Z0-9]+)*$
```

This is an **application input grammar**, not a claim that every possible exchange worldwide follows one universal ticker standard.

The grammar is intentionally designed around common Yahoo-style equity identifiers used by the application.

---

## 2. Supported Examples

The rule must accept at least:

```text
AAPL
SAP.DE
GAW.L
HEXA-B.ST
BRK-B
0700.HK
7203.T
0005.HK
```

This is important: numeric ticker components MUST be supported.

Do not restrict symbols to letters only.

---

## 3. Invalid Examples

The rule must reject at least:

```text
AAPL!
SAP..DE
SAP--DE
SAP.-DE
SAP-.DE
SAP_DE
SAP DE
.SAP
SAP.
-SAP
SAP-
```

The separator characters:

```text
.
-
```

may occur only between non-empty alphanumeric components.

---

## 4. No Arbitrary Maximum Length

Do not introduce an arbitrary maximum symbol length in this task.

Existence/support of a syntactically valid symbol remains a provider concern.

If an actual technical/provider/security requirement for a maximum length is discovered during implementation, report it rather than inventing a limit.

---

# Normalization

## 5. Trim

Remove leading and trailing whitespace.

Example:

```text
"  AAPL  "
-> "AAPL"
```

---

## 6. Uppercase

Convert the trimmed symbol to uppercase.

Examples:

```text
aapl
-> AAPL

sap.de
-> SAP.DE

hexa-b.st
-> HEXA-B.ST

0700.hk
-> 0700.HK
```

Use normal JavaScript uppercase conversion.

Do not introduce locale-specific casing behavior.

---

## 7. Normalization Before Validation

The order is mandatory:

```text
trim
  ↓
uppercase
  ↓
syntax validation
```

Therefore:

```text
" sap.de "
```

is valid and resolves syntactically to:

```text
SAP.DE
```

Do not validate lowercase input before normalization.

---

## 8. Canonical Stored Symbol

After successful stock addition, persist the normalized symbol.

Examples:

```text
user enters: aapl
persist:     AAPL
```

```text
user enters: hexa-b.st
persist:     HEXA-B.ST
```

This supersedes TASK-012's previous rule that preserved the exact trimmed input casing.

---

# Central Symbol Utility

## 9. Single Server-Safe Rule

Introduce a small pure stock-symbol utility that owns normalization and syntax validation.

Use a location appropriate for application/domain code and usable from server-side stock-add behavior.

Conceptually:

```ts
normalizeStockSymbol(input: string): string
```

and:

```ts
isValidStockSymbol(symbol: string): boolean
```

or a combined result/parser abstraction if that produces a cleaner API.

Choose the smallest clear design.

---

## 10. Prefer Parse/Normalize Result if Useful

A design such as:

```ts
parseStockSymbol(input: string): StockSymbolParseResult
```

is acceptable if it cleanly guarantees:

```text
valid result
=> already normalized symbol
```

Avoid forcing every caller to remember:

```text
normalize first
then validate
```

if a single abstraction can enforce the invariant more safely.

Do not introduce branded/opaque types unless they provide concrete value.

---

## 11. No Provider Dependency

The symbol syntax utility MUST NOT depend on:

* `MarketDataProvider`;
* Yahoo Finance;
* network access;
* SvelteKit request objects;
* persistence.

It is a pure application/domain rule.

---

# Error Semantics

## 12. Invalid Symbol Error

Use the application error:

```text
InvalidSymbolError
```

for syntactically invalid symbol input at the service layer if that remains the cleanest fit with the existing error hierarchy.

At the HTTP boundary, expose a stable API error code:

```text
INVALID_STOCK_SYMBOL
```

This code must distinguish syntax failure from provider-backed unknown-symbol failure.

If the existing stock-add API already maps `InvalidSymbolError` to a differently named stable code, inspect the current contract and make the smallest explicit correction necessary.

The final client-visible distinction MUST be:

```text
syntactically invalid
-> INVALID_STOCK_SYMBOL

syntactically valid but provider does not recognize/support it
-> UNKNOWN_STOCK_SYMBOL
```

---

## 13. Empty Input

Empty or whitespace-only input is syntactically invalid.

It belongs to:

```text
INVALID_STOCK_SYMBOL
```

Do not create another error code solely for empty input.

---

## 14. Invalid Syntax Must Not Reach Provider

This is a critical requirement.

For:

```text
AAPL!
SAP..DE
SAP_DE
```

the server MUST reject the request before calling:

```text
MarketDataProvider
```

No Yahoo/provider request should occur.

---

## 15. Unknown Symbol Remains Distinct

For a normalized, syntactically valid symbol such as:

```text
ZZZZZZ
```

the existing provider validation remains responsible for deciding whether market data exists.

Until TASK-030, continue using the current provider-backed behavior.

If no market data is returned:

```text
UNKNOWN_STOCK_SYMBOL
```

remains the result.

Do not treat syntactically valid unknown symbols as syntax errors.

---

## 16. Provider Failure Remains Distinct

If a syntactically valid symbol reaches the provider and the provider fails:

```text
MARKET_DATA_UNAVAILABLE
```

or the current stable equivalent must remain distinct from:

```text
INVALID_STOCK_SYMBOL
UNKNOWN_STOCK_SYMBOL
```

Do not collapse provider outages into validation failures.

---

# Server-Side Stock Addition

## 17. Authoritative Server Flow

Update the server-side stock-add workflow to:

```text
raw symbol
    |
    v
normalize
    |
    v
validate syntax
    |
    +-- invalid
    |      |
    |      v
    |   InvalidSymbolError
    |   provider NOT called
    |
    v
normalized symbol
    |
    v
existing provider validation
    |
    +-- no result
    |      |
    |      v
    |   UnknownStockSymbolError
    |
    v
WatchlistService.addSymbol(
    normalized symbol
)
```

---

## 18. Provider Receives Normalized Symbol

For:

```text
aapl
```

the MarketDataProvider must receive:

```text
AAPL
```

not:

```text
aapl
```

For:

```text
sap.de
```

it receives:

```text
SAP.DE
```

---

## 19. WatchlistService Receives Normalized Symbol

The WatchlistService must receive the normalized symbol.

Do not normalize once for provider lookup but persist the raw/lowercase input afterward.

---

## 20. Duplicate Detection Uses Canonical Symbol

Because persisted symbols are now normalized:

```text
AAPL
aapl
AaPl
```

represent the same stock for new additions.

Example:

```text
Watchlist already contains:
AAPL

user enters:
aapl

normalized:
AAPL

result:
DuplicateSymbolError
```

Do not permit case-only duplicates.

---

# Existing Persisted Data

## 21. No Migration

Do not implement a persistence migration in this task.

Existing production/local Watchlists may theoretically contain symbols using the old casing-preserving behavior.

Do not rewrite persisted documents automatically.

---

## 22. New Mutations Use New Rule

All newly added symbols use canonical uppercase normalization.

If existing historical lowercase symbols are discovered, leave them unchanged unless a later migration task explicitly addresses them.

---

## 23. Duplicate Edge Case with Historical Data

Do not build complex case-insensitive duplicate reconciliation for hypothetical historical malformed data in this task.

The new canonical rule applies prospectively.

If the current production data is known to contain lowercase symbols and creates a concrete issue, report it.

---

# Client-Side Input

## 24. Immediate Uppercase UX

Update the stock-symbol input so lowercase user input is automatically represented in uppercase.

Example:

```text
user types:
aapl

input displays:
AAPL
```

This should happen naturally during input/editing rather than only after submission.

---

## 25. Preserve Valid Characters

Uppercase conversion must not remove or rewrite valid punctuation.

Examples:

```text
sap.de
-> SAP.DE

hexa-b.st
-> HEXA-B.ST
```

Do not convert:

```text
-
```

to:

```text
.
```

or vice versa.

---

## 26. Client Syntax Validation

Apply the same syntax semantics on the client before sending the stock-add request.

For syntactically invalid input:

* do not send POST;
* show understandable local validation feedback;
* preserve the entered normalized text for correction.

---

## 27. Shared Semantics

Avoid maintaining two unrelated regex definitions that can drift.

Prefer a client-safe pure symbol utility that can be imported by both:

```text
browser input/orchestration
server application service
```

if the repository boundaries permit this cleanly.

Do not place the shared utility under:

```text
$lib/server
```

because SvelteKit deliberately blocks that code from browser bundles.

A small shared domain/client-safe module is appropriate.

---

## 28. Server Remains Authoritative

Even though the browser validates locally, direct API requests must receive the same server validation.

Do not trust the browser's normalized value.

---

# Client Error Presentation

## 29. Invalid Syntax Message

Use a clear user-facing message for:

```text
INVALID_STOCK_SYMBOL
```

Conceptually:

```text
Invalid stock symbol format.
```

A slightly more helpful message is acceptable, for example:

```text
Use letters, numbers, dots, or hyphens.
```

Do not expose the raw regex as the primary user message.

---

## 30. Unknown Symbol Message

Keep provider-backed unknown-symbol feedback distinct.

Conceptually:

```text
Stock symbol was not found.
```

or the current established stable message.

---

## 31. Provider Failure Message

Keep the current provider-unavailable message.

Do not make all three cases look identical.

---

# REST API

## 32. API Normalization

A direct request:

```json
{
  "symbol": "aapl"
}
```

must be accepted syntactically after normalization and processed as:

```text
AAPL
```

The REST client is not required to uppercase first.

---

## 33. API Invalid Syntax

A direct request:

```json
{
  "symbol": "AAPL!"
}
```

must return the established 4xx validation response with:

```text
INVALID_STOCK_SYMBOL
```

and must not call MarketDataProvider.

---

## 34. No API Shape Change

Do not add normalization metadata to the response.

Do not return:

```json
{
  "originalSymbol": "aapl",
  "normalizedSymbol": "AAPL"
}
```

unless the existing endpoint already has a concrete need for it.

The resulting composed Watchlist already shows the persisted canonical symbol.

---

# MarketDataProvider

## 35. No `resolveSymbol()` Yet

Do NOT add:

```ts
resolveSymbol(...)
```

to `MarketDataProvider` in this task.

That belongs to TASK-030.

---

## 36. Existing Provider Validation

For normalized syntactically valid symbols, retain the current TASK-012 validation behavior using the existing MarketDataProvider API.

Do not refactor Yahoo existence semantics prematurely.

---

## 37. No Yahoo Search

Do not introduce:

```text
yahooFinance.search()
```

in this task.

The Product Owner has explicitly decided not to use Yahoo Search for stock resolution.

---

# Equity Scope

## 38. Product Scope

Document the V2 product intent:

> Watchlist manages equities representing companies that can be individually valued.

ETFs, options, funds, cryptocurrencies, and other non-equity instruments are outside the intended product scope.

---

## 39. No Equity Enforcement Yet

Do NOT implement `quoteType === EQUITY` enforcement in TASK-029 unless it is already trivially available and required to preserve existing behavior.

Actual provider-backed equity resolution belongs to TASK-030.

TASK-029 establishes only:

```text
normalization
+
syntax
```

---

# Unit Tests — Symbol Utility

## 40. Normalization Tests

At minimum verify:

```text
"aapl"        -> "AAPL"
" AAPL "      -> "AAPL"
"sap.de"      -> "SAP.DE"
"hexa-b.st"   -> "HEXA-B.ST"
"0700.hk"     -> "0700.HK"
```

---

## 41. Valid Syntax Tests

At minimum accept:

```text
AAPL
SAP.DE
GAW.L
HEXA-B.ST
BRK-B
0700.HK
7203.T
0005.HK
```

---

## 42. Invalid Syntax Tests

At minimum reject:

```text
""
" "
AAPL!
SAP..DE
SAP--DE
SAP.-DE
SAP-.DE
SAP_DE
SAP DE
.SAP
SAP.
-SAP
SAP-
```

---

## 43. No Maximum-Length Assumption

Add no test imposing an arbitrary maximum length.

---

# Unit Tests — Server Flow

## 44. Lowercase Provider Call

Given:

```text
aapl
```

verify MarketDataProvider receives exactly:

```text
AAPL
```

---

## 45. Lowercase Persistence

Given successful provider validation for:

```text
aapl
```

verify WatchlistService/persistence receives:

```text
AAPL
```

---

## 46. Exchange Suffix Normalization

Given:

```text
sap.de
```

verify:

```text
SAP.DE
```

is used for both provider validation and persistence.

---

## 47. Hyphen Normalization

Given:

```text
hexa-b.st
```

verify:

```text
HEXA-B.ST
```

is preserved after uppercasing.

---

## 48. Invalid Does Not Call Provider

For invalid syntax, explicitly assert:

```text
MarketDataProvider calls = 0
```

This is mandatory.

---

## 49. Invalid Does Not Persist

For invalid syntax, explicitly assert:

```text
WatchlistService.addSymbol calls = 0
```

or equivalent persistence/mutation observation.

---

## 50. Valid Unknown Still Calls Provider

For a syntactically valid unknown symbol:

```text
ZZZZZZ
```

verify the provider is called.

If the provider returns no result:

```text
UnknownStockSymbolError
```

remains the result.

---

## 51. Provider Failure Still Propagates

For valid syntax, verify provider failure remains distinct and propagates through the existing behavior.

---

## 52. Case-Only Duplicate

Given existing:

```text
AAPL
```

and new input:

```text
aapl
```

verify normalized addition is rejected as duplicate after provider validation according to the existing TASK-012 ordering semantics.

Do not change provider-before-duplicate ordering in this task unless required by existing architecture.

---

# API/Error-Mapping Tests

## 53. Invalid API Error

Verify syntactically invalid stock input maps to:

```text
INVALID_STOCK_SYMBOL
```

with the selected 4xx status.

Use the existing API error conventions.

---

## 54. Unknown API Error

Verify syntactically valid provider-unknown input still maps to:

```text
UNKNOWN_STOCK_SYMBOL
```

---

## 55. Provider API Error

Verify provider failure remains mapped to the existing provider-unavailable error.

---

# Client Unit Tests

## 56. Uppercase Input Semantics

Test the client-safe normalization helper directly.

Do not rely only on browser tests.

---

## 57. Local Validation

Verify invalid syntax is rejected before the client API call where the existing orchestration structure permits deterministic unit testing.

---

## 58. Valid Lowercase

Verify:

```text
aapl
```

becomes:

```text
AAPL
```

before the client API call.

---

# Playwright E2E

## 59. Permanent Coverage

Extend the existing permanent stock-management E2E coverage.

Use:

```text
tests/e2e/stock-management.spec.ts
```

unless the existing organization clearly justifies a separate symbol-input spec.

Do not create redundant test files unnecessarily.

---

## 60. E2E: Lowercase AAPL

Enter:

```text
aapl
```

Verify the input becomes:

```text
AAPL
```

and the request/persisted composed Watchlist uses:

```text
AAPL
```

---

## 61. E2E: Lowercase Exchange Symbol

Enter:

```text
sap.de
```

Verify:

```text
SAP.DE
```

is submitted/displayed.

---

## 62. E2E: Hyphenated Symbol

Enter:

```text
hexa-b.st
```

Verify:

```text
HEXA-B.ST
```

is submitted/displayed.

---

## 63. E2E: Numeric Symbol

Enter:

```text
0700.hk
```

Verify:

```text
0700.HK
```

is accepted by local syntax validation and submitted.

Use mocked API responses; do not depend on live Yahoo.

---

## 64. E2E: Invalid Character

Enter:

```text
AAPL!
```

Verify:

* local validation message appears;
* no stock-add POST occurs;
* input remains available for correction.

---

## 65. E2E: Invalid Separator

Enter:

```text
SAP..DE
```

Verify:

* local validation;
* no POST.

---

## 66. E2E: Unknown Valid Symbol

Enter a syntactically valid symbol such as:

```text
ZZZZZZ
```

Return:

```text
UNKNOWN_STOCK_SYMBOL
```

from the mocked API.

Verify the UI displays the unknown-symbol message rather than syntax validation.

---

## 67. E2E: Provider Failure

For a syntactically valid symbol, return the existing provider-unavailable API error.

Verify it remains distinguishable from both syntax-invalid and unknown-symbol errors.

---

## 68. E2E: Case-Only Duplicate

Given existing:

```text
AAPL
```

enter:

```text
aapl
```

Verify the submitted symbol is:

```text
AAPL
```

and the existing duplicate-symbol behavior is preserved.

---

## 69. Mobile Input

Under mobile Chromium, verify uppercase normalization and local validation remain usable without page-level overflow regression.

---

# Runtime Verification

## 70. Deterministic Tests First

The normalization/syntax behavior is deterministic and should be covered primarily by unit and Playwright tests.

Do not require live Yahoo to prove regex behavior.

---

## 71. Focused Provider Smoke Check

Because the existing provider validation remains in use, perform a small real-provider check where practical using representative normalized symbols such as:

```text
AAPL
SAP.DE
GAW.L
```

Verify lowercase user input reaches the provider in normalized form.

Do not turn this into TASK-030 equity-resolution work.

---

# Architecture Documentation

## 72. Update Symbol Rule

Update `ARCHITECTURE.md` to establish the new V2 rule:

```text
Stock symbol input
→ trim
→ uppercase
→ syntax validation
→ provider validation
→ persist normalized symbol
```

---

## 73. Supersede TASK-012 Casing Decision

Explicitly document that TASK-029 supersedes TASK-012's previous:

```text
persist exact trimmed input
no case normalization
```

decision.

Do not rewrite history as though TASK-012 had always normalized symbols.

---

## 74. Error Distinction

Document:

```text
INVALID_STOCK_SYMBOL
    syntactically invalid

UNKNOWN_STOCK_SYMBOL
    syntactically valid but provider does not recognize/support it

MARKET_DATA_UNAVAILABLE
    provider cannot perform validation
```

or the exact final stable provider error code.

---

## 75. Equity Intent

Document that the product's intended instrument class is:

```text
EQUITY
```

representing individually valued companies.

State that provider-backed enforcement of this rule is deferred to TASK-030.

---

# TASK-012 Historical Note

## 76. Preserve TASK-012

Do not rewrite TASK-012 extensively.

If task-history conventions permit, add a short supersession note stating that TASK-029 later introduced uppercase canonicalization and syntax validation based on production usage findings.

TASK-012 remains Done.

---

# README

## 77. User-Facing Feature Description

If the README describes stock addition behavior, update it briefly to mention that symbols are normalized to uppercase.

Do not add implementation-level regex documentation to the main project introduction unless useful.

---

# Non-Goals

Do NOT implement:

* `MarketDataProvider.resolveSymbol()`;
* Yahoo Search;
* Yahoo symbol autocomplete;
* fuzzy symbol correction;
* typo correction such as `APPL -> AAPL`;
* provider-backed `EQUITY` enforcement;
* stock-name search;
* ticker suggestions;
* persistence migration;
* case normalization of existing stored documents;
* arbitrary symbol maximum length;
* new market-data fields;
* unrelated UI changes;
* production deployment.

TASK-030 will introduce provider-backed equity symbol resolution.

---

# Acceptance Criteria

The task is complete when all of the following are true:

1. Stock symbols have one explicit normalization rule.
2. Input is trimmed.
3. Input is uppercased.
4. Validation occurs after normalization.
5. Grammar is `^[A-Z0-9]+(?:[.-][A-Z0-9]+)*$` or an exactly equivalent implementation.
6. Letters are supported.
7. Digits are supported.
8. Dots are supported only as separators.
9. Hyphens are supported only as separators.
10. Repeated/mixed adjacent separators are rejected.
11. Empty input is invalid.
12. Whitespace-only input is invalid.
13. No arbitrary maximum length is introduced.
14. A pure shared symbol utility owns the rule.
15. Shared utility has no provider/network dependency.
16. Server validation is authoritative.
17. Client uses the same semantics.
18. Invalid syntax produces `INVALID_STOCK_SYMBOL`.
19. Valid unknown symbols remain `UNKNOWN_STOCK_SYMBOL`.
20. Provider failures remain distinct.
21. Invalid syntax never calls MarketDataProvider.
22. Invalid syntax never mutates the Watchlist.
23. Provider receives normalized symbols.
24. WatchlistService receives normalized symbols.
25. Newly persisted symbols are uppercase canonical symbols.
26. `aapl` becomes `AAPL`.
27. `sap.de` becomes `SAP.DE`.
28. `hexa-b.st` becomes `HEXA-B.ST`.
29. `0700.hk` becomes `0700.HK`.
30. Case-only new duplicates resolve to the canonical existing symbol.
31. No existing persisted-data migration is introduced.
32. No `resolveSymbol()` is introduced.
33. No Yahoo Search integration is introduced.
34. No provider-backed equity enforcement is introduced yet.
35. Symbol utility has unit coverage.
36. Server flow normalization has unit coverage.
37. Invalid-provider-zero-call behavior is explicitly tested.
38. Unknown-valid-provider-call behavior is explicitly tested.
39. API error mapping distinguishes invalid/unknown/provider-failure.
40. Client normalization has unit coverage.
41. Local client validation has coverage.
42. Permanent E2E covers lowercase AAPL.
43. E2E covers lowercase exchange suffix.
44. E2E covers hyphenated symbols.
45. E2E covers numeric symbols.
46. E2E covers invalid characters.
47. E2E covers invalid separators.
48. E2E covers syntactically valid unknown symbol.
49. E2E covers provider failure.
50. E2E covers case-only duplicate.
51. Mobile stock input remains usable.
52. Existing stock-add behavior remains otherwise intact.
53. Existing Watchlist behavior remains intact.
54. `ARCHITECTURE.md` documents the V2 rule.
55. TASK-012's historical decision is preserved/superseded explicitly.
56. Equity-only product intent is documented for TASK-030.
57. Existing project checks pass.
58. No unrelated production dependency is introduced.
59. No production deployment is performed.

---

# Verification

Before completing the task, execute:

```bash
npm run test
npm run test:e2e
npm run check
npm run lint
npm run build
```

Additionally verify:

1. lowercase simple ticker normalization;
2. lowercase exchange-suffix normalization;
3. lowercase hyphenated-symbol normalization;
4. numeric ticker support;
5. invalid characters;
6. repeated/mixed separators;
7. invalid syntax causes zero provider calls;
8. syntactically valid unknown input still reaches provider;
9. provider failure remains distinct;
10. mobile stock-input behavior.

Perform a focused real-provider smoke check if practical, but do not expand the task into equity resolution.

Do not report a verification step as successful unless it was actually executed successfully.

Do NOT deploy production.

---

# Task Status

After all implementation and verification criteria are satisfied, change:

```text
Status: Ready
```

to:

```text
Status: Done
```

Do not modify unrelated task statuses.

---

# Completion Report

When finished, report:

1. files added/changed;
2. final stock-symbol grammar;
3. normalization API/design;
4. shared client/server location;
5. uppercase behavior;
6. numeric-symbol behavior;
7. invalid-separator behavior;
8. final invalid-symbol error/code;
9. final unknown-symbol behavior;
10. provider-failure behavior;
11. proof invalid syntax never reaches provider;
12. provider normalized-symbol behavior;
13. persisted normalized-symbol behavior;
14. duplicate behavior after normalization;
15. existing persisted-data decision;
16. client input behavior;
17. client validation behavior;
18. server validation behavior;
19. unit tests added/changed;
20. API/error-mapping tests added/changed;
21. Playwright scenarios added/changed;
22. mobile verification;
23. real-provider smoke-check result, if performed;
24. `ARCHITECTURE.md` changes;
25. TASK-012 supersession note;
26. README changes, if any;
27. results of `test`, `test:e2e`, `check`, `lint`, and `build`;
28. confirmation that `resolveSymbol()` was not introduced;
29. confirmation that Yahoo Search was not introduced;
30. confirmation that provider-backed EQUITY enforcement was deferred to TASK-030;
31. confirmation that no production deployment occurred;
32. confirmation that task status changed to Done;
33. assumptions or unresolved issues;
34. deviations from this task or `ARCHITECTURE.md`.

Do not proceed to TASK-030.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
