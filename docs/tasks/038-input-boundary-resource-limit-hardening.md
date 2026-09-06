# TASK-038: Input Boundary and Resource Limit Hardening

## Status

Done

## Follow-Up

TASK-039 completes the remaining request-body-size hardening intentionally deferred from this task.

## Goal

Implement the input-boundary and resource-limit hardening identified by TASK-037.

The application already validates the semantic shape of most user inputs, but TASK-037 found several externally controlled values without explicit upper bounds.

TASK-038 establishes bounded input as an application-wide rule:

> Every externally controlled value has an explicit, authoritative server-side bound where it crosses the HTTP/application boundary. Browser constraints mirror those limits for UX but are never trusted as security enforcement.

The task also introduces a maximum Watchlist capacity:

> A Watchlist may contain at most 1,000 stocks.

The final limits are:

| Input / Resource      | Final rule                                                |
| --------------------- | --------------------------------------------------------- |
| Watchlist name        | 1–50 UTF-16 code units after trimming                     |
| Stock symbol          | max. 20 characters after normalization + existing grammar |
| Target Price          | finite, `> 0`, `<= 1,000,000`                             |
| Target Price UI text  | `maxlength=20`                                            |
| Total Savings         | safe integer, `0..10,000,000`                             |
| Total Savings UI text | `maxlength=8`                                             |
| Watchlist ID          | max. 64 characters                                        |
| Symbol URL parameter  | same normalization, length and grammar as Stock Symbol    |
| Company-name filter   | max. 100 characters, client-side                          |
| Stocks per Watchlist  | max. 1,000                                                |

There is currently no relevant persisted production data that exceeds these limits, so no data migration is required.

Request-body-size hardening remains separate and belongs to TASK-039.

---

# Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* `docs/security/input-boundary-audit.md`
* TASK-003;
* TASK-005;
* TASK-009;
* TASK-010;
* TASK-012;
* TASK-013;
* TASK-015;
* TASK-019;
* TASK-020;
* TASK-021;
* TASK-022;
* TASK-024;
* TASK-029;
* TASK-030;
* TASK-037;
* all current API handlers/routes;
* all relevant client parsers;
* current Watchlist service/repository structure;
* this task completely.

Treat TASK-037's audit as the implementation basis.

Inspect current code before choosing module boundaries.

---

# General Security Rule

## 1. Client Validation Is UX

HTML constraints such as:

```html
maxlength="50"
```

improve user experience but are not security controls.

A direct HTTP caller can bypass them.

---

## 2. Server Is Authoritative

Every network-crossing product input covered by this task must be bounded on the server independently of client behavior.

---

## 3. Reject Before Expensive Work

Where possible, reject invalid input before:

* MarketDataProvider calls;
* ExchangeRateProvider calls;
* repository writes;
* expensive composition;
* unnecessary external requests.

This is especially important for Stock Symbol and Watchlist capacity validation.

---

## 4. Shared Semantics

Where client and server need the same product rule, prefer a shared client-safe constant/helper.

Do not maintain unrelated duplicate numeric literals such as:

```text
20
50
1000000
10000000
```

throughout the codebase.

---

## 5. Domain-Oriented Validation

Do not introduce a giant generic:

```text
validation.ts
```

for unrelated product concepts.

Prefer small domain-oriented modules.

Conceptually:

```text
stockSymbol.ts
watchlistName.ts
targetPrice...
investmentSavings...
watchlistLimits...
```

Use the repository's actual structure.

---

# Watchlist Name

## 6. Final Rule

A Watchlist name is valid only when its trimmed value contains:

```text
1..50
```

UTF-16 code units.

Use normal JavaScript string `.length`.

Do not add grapheme-cluster dependencies.

---

## 7. Trim Before Length Check

Required order:

```text
raw input
    ↓
trim
    ↓
empty?
    ↓
length <= 50?
```

Examples:

```text
" Main "
→ "Main"
→ valid
```

```text
" " * many
→ ""
→ invalid
```

---

## 8. Existing Name Semantics

Preserve:

* duplicate Watchlist names allowed;
* no new character whitelist;
* Unicode names allowed;
* existing trimming behavior.

Only the explicit upper bound is new.

---

## 9. Shared Constant

Introduce one canonical limit such as:

```ts
MAX_WATCHLIST_NAME_LENGTH = 50
```

in an appropriate shared/client-safe domain module.

---

## 10. Client Constraint

The Watchlist-name input must expose:

```html
maxlength="50"
```

using the shared constant where practical.

---

## 11. Client Validation

Client orchestration/parser must not send a Watchlist-create request for a name that violates the final rule.

Do not rely only on `maxlength`.

---

## 12. Direct API

A direct request containing a name longer than 50 after trimming must be rejected server-side.

---

## 13. Error Code

Use the existing:

```text
INVALID_WATCHLIST_NAME
```

error semantics.

Do not introduce:

```text
WATCHLIST_NAME_TOO_LONG
```

---

## 14. User Message

Use a useful validation message.

Conceptually:

```text
Watchlist name must not exceed 50 characters.
```

The exact wording may follow current error-message conventions.

---

# Stock Symbol Length

## 15. Existing Rule

Preserve TASK-029/TASK-030:

```text
raw input
→ trim
→ uppercase
→ syntax validation
→ supported-equity resolution
```

---

## 16. Maximum Length

After normalization:

```text
symbol.length <= 20
```

is required.

---

## 17. Existing Grammar

Preserve:

```regex
^[A-Z0-9]+(?:[.-][A-Z0-9]+)*$
```

or the current exactly equivalent implementation.

---

## 18. Validation Order

The shared Stock Symbol parser should conceptually enforce:

```text
trim
→ uppercase
→ non-empty
→ max length 20
→ grammar
```

before provider resolution.

---

## 19. Provider Protection

A symbol longer than 20 must never reach:

```text
MarketDataProvider.resolveSymbol()
```

during stock addition.

TASK-037 proved that a 5,000-character syntactically valid symbol currently reaches the provider.

Add an explicit regression test proving that this no longer happens.

---

## 20. Client Constraint

Stock Symbol input:

```html
maxlength="20"
```

---

## 21. Error Code

Too-long Stock Symbol uses:

```text
INVALID_STOCK_SYMBOL
```

Do not add a length-specific API code.

---

# Symbol URL Parameters

## 22. Audit Finding

TASK-037 found a significant inconsistency in the Target Price symbol route.

The path symbol was only trimmed rather than applying TASK-029's canonical Stock Symbol semantics.

This allowed conceptually:

```text
AAPL
aapl
```

to behave as distinct Target Price persistence keys.

TASK-038 must close this inconsistency.

---

## 23. Canonical URL Symbol Rule

Every externally supplied Stock Symbol URL parameter covered by the application must use the same canonical rule:

```text
URL parameter
→ trim
→ uppercase
→ max length 20
→ existing symbol grammar
```

Do not maintain a separate weaker path-symbol parser.

---

## 24. Target Price Route

For a request conceptually equivalent to:

```text
PUT /api/target-prices/aapl
```

the server must operate on:

```text
AAPL
```

for:

* Target Price persistence;
* market-data lookup;
* response composition.

---

## 25. No Split KV Identity

After this task, case differences must not produce separate Target Price identities.

Conceptually:

```text
AAPL
aapl
AaPl
```

all refer to:

```text
AAPL
```

at the authoritative server boundary.

---

## 26. Invalid Path Symbol

A path symbol violating length or grammar is rejected before:

* TargetPriceRepository access where possible;
* MarketDataProvider access;
* persistence.

Use the appropriate existing invalid-symbol/API validation semantics.

Do not treat malformed syntax as a valid unknown Equity.

---

## 27. No Provider Call

For:

```text
/api/target-prices/<invalid-or-too-long-symbol>
```

assert zero MarketDataProvider calls.

---

# Target Price

## 28. Final Numeric Rule

A Target Price is valid only when:

```ts
Number.isFinite(targetPrice)
&& targetPrice > 0
&& targetPrice <= 1_000_000
```

Preserve the actual existing type checks.

---

## 29. No Decimal-Place Limit

Do NOT introduce a fixed decimal-precision rule.

Values such as:

```text
0.1234
123.456789
```

may remain valid if they satisfy all other rules.

TASK-033's two-decimal display formatting is presentation only.

---

## 30. Client Text Length

Target Price text input must expose:

```html
maxlength="20"
```

---

## 31. Client Parser

The existing Target Price parser must reject parsed values above:

```text
1,000,000
```

before API submission.

---

## 32. Server Validation

A direct API request with:

```json
{
  "targetPrice": 1000000
}
```

is valid.

A direct request with:

```json
{
  "targetPrice": 1000000.0001
}
```

is invalid.

---

## 33. Existing Lower Bound

Preserve:

```text
targetPrice > 0
```

Zero remains invalid.

---

## 34. Non-Finite Values

Preserve/reinforce rejection of:

```text
NaN
Infinity
-Infinity
```

where representable internally.

---

## 35. Scientific Notation

Do not create a special server-side rejection solely because a valid JSON number was written using exponent notation.

After JSON parsing, server validation concerns the numeric value.

Example:

```json
{
  "targetPrice": 1e6
}
```

is numerically equivalent to:

```text
1,000,000
```

and may be accepted.

A value above the maximum remains invalid regardless of textual notation.

---

## 36. Browser Scientific Notation

Do not broaden the browser Target Price text parser to accept scientific notation unless it already does.

Client input syntax and server numeric semantics may legitimately differ.

---

## 37. Error Code

Out-of-range Target Price uses the existing:

```text
INVALID_TARGET_PRICE
```

---

# Total Savings

## 38. Final Rule

Total Savings must satisfy:

```ts
Number.isSafeInteger(totalSavings)
&& totalSavings >= 0
&& totalSavings <= 10_000_000
```

---

## 39. Replace `Number.isInteger`

TASK-037 confirmed that current validation uses:

```ts
Number.isInteger(...)
```

and therefore accepts unsafe integer values after JavaScript numeric rounding.

Replace this semantic requirement with:

```ts
Number.isSafeInteger(...)
```

at the authoritative domain/server validation boundary.

---

## 40. Maximum

The largest valid value is:

```text
10,000,000
```

---

## 41. Client Text Length

The maximum normal decimal representation is:

```text
10000000
```

which is 8 characters.

Set:

```html
maxlength="8"
```

on the Total Savings input.

---

## 42. Client Parser

The client parser must reject:

* values above 10,000,000;
* unsafe integers;
* existing invalid fractional/negative/non-numeric forms.

---

## 43. Direct API

Direct API validation must independently enforce the same numeric rule.

---

## 44. Error Code

Use:

```text
INVALID_TOTAL_SAVINGS
```

for:

* negative;
* fractional;
* non-finite;
* unsafe integer;
* above maximum.

Do not add range-specific error codes.

---

# Company-Name Filter

## 45. Final Limit

The local company-name filter has a maximum input length of:

```text
100
```

characters.

---

## 46. Client-Only Nature

The filter remains purely local.

Do not create a server validation rule or API request for it.

---

## 47. HTML Constraint

Set:

```html
maxlength="100"
```

on the filter input.

---

## 48. Shared/Explicit Constant

Define a clear client/shared constant such as:

```ts
MAX_COMPANY_NAME_FILTER_LENGTH = 100
```

in the appropriate filtering module.

---

## 49. Filter Helper Defense

The filtering helper should behave predictably if called programmatically with an over-limit value.

Prefer explicit validation/normalization rather than relying exclusively on HTML.

Choose the smallest behavior consistent with current filter architecture.

Do not silently introduce surprising server-like errors into purely local reactive filtering.

---

# Watchlist IDs

## 50. Final Defensive Limit

Externally supplied:

```text
watchlistId
```

must not exceed:

```text
64
```

characters.

---

## 51. Existing Generated IDs

Do not change the Watchlist ID generator.

The 64-character limit must remain compatible with all legitimately generated existing IDs.

---

## 52. No Unnecessary New Grammar

Do not invent a stricter Watchlist-ID character grammar unless the current generator already establishes a stable format that is safe to enforce.

The required new rule is the defensive length bound.

---

## 53. Malformed vs Missing

A Watchlist ID violating the defensive input rule is an invalid request:

```text
400 INVALID_REQUEST
```

A structurally acceptable ID that does not identify a Watchlist belonging to the authenticated user remains:

```text
404 WATCHLIST_NOT_FOUND
```

or the current stable not-found code.

---

## 54. Validate Before Repository Work

Reject an over-limit Watchlist ID before unnecessary repository/provider/application work.

Apply this consistently to all routes accepting `watchlistId`.

---

## 55. All Watchlist ID Routes

Search and update every route/handler accepting a Watchlist ID.

Do not harden only the most visible GET route.

---

# Watchlist Stock Capacity

## 56. Final Capacity

A Watchlist may contain at most:

```text
1,000 stocks
```

---

## 57. Shared Constant

Introduce one canonical limit:

```ts
MAX_STOCKS_PER_WATCHLIST = 1_000
```

in an appropriate server/domain/shared location.

Use it consistently in validation and user-facing messaging.

---

## 58. Boundary Semantics

If a Watchlist contains:

```text
999 stocks
```

one additional valid stock may be added.

Result:

```text
1,000 stocks
```

---

## 59. Full Watchlist

If a Watchlist already contains:

```text
1,000 stocks
```

a new stock addition is rejected.

---

## 60. Defensive Over-Limit State

If a Watchlist somehow contains:

```text
> 1,000 stocks
```

it remains readable and removable.

No additional stock may be added.

Do not automatically truncate or migrate it.

---

## 61. No Migration

The Product Owner has confirmed that current relevant persisted data does not exceed the new limits.

No migration is required.

Do not introduce one.

---

# Capacity Validation Ordering

## 62. Reject Before Market Provider

A full Watchlist must reject an attempted additional stock before:

```text
MarketDataProvider.resolveSymbol()
```

is called.

This prevents unnecessary external work for an operation that cannot succeed.

---

## 63. Required Conceptual Flow

The new Add Stock flow should conceptually become:

```text
raw symbol
    ↓
normalize + syntax/length validate
    ↓
load/validate Watchlist
    ↓
capacity >= 1000?
   /             \
 yes              no
  ↓                ↓
reject          resolveSymbol()
provider=0          ↓
                supported Equity?
                    ↓
                 add symbol
```

---

## 64. Preserve User Isolation

Capacity lookup must remain scoped to:

```text
userId + watchlistId
```

Do not introduce a repository read that bypasses user isolation.

---

## 65. Architecture Review Required

The current `AddStockToWatchlistService` historically performs provider resolution before `WatchlistService.addSymbol()` performs Watchlist existence/duplicate checks.

To enforce capacity before provider access, inspect the current service architecture carefully.

Choose the smallest clean change.

Acceptable directions may include:

* a WatchlistService/application query for admission state;
* a small dedicated capacity/admission method;
* another design consistent with current architecture.

Do NOT:

* directly reach into KV from `AddStockToWatchlistService`;
* duplicate repository parsing logic;
* introduce an unrelated repository dependency solely as a shortcut;
* load the same Watchlist repeatedly without justification.

Document the final dependency/order decision.

---

## 66. Missing Watchlist Ordering

Because capacity validation requires knowing the Watchlist state, TASK-038 may necessarily change the historical provider-before-missing-Watchlist ordering.

The desired hardened behavior is:

```text
missing Watchlist
→ fail without provider call
```

if the selected architecture naturally supports it.

This is acceptable and preferable.

Document the ordering change explicitly.

---

## 67. Duplicate Ordering

If the Watchlist state is already loaded before provider resolution, consider whether an existing duplicate can also be rejected before provider access.

Prefer avoiding unnecessary provider calls for an operation already known to be impossible.

However, do not introduce a convoluted multi-layer redesign solely for this optimization.

If duplicate ordering changes cleanly as part of the same admission check, document and test it.

---

# Capacity Error

## 68. Dedicated Error

Introduce a dedicated application/domain error conceptually equivalent to:

```text
WatchlistStockLimitReachedError
```

---

## 69. Stable API Code

Expose a stable API error code:

```text
WATCHLIST_STOCK_LIMIT_REACHED
```

---

## 70. HTTP Status

Choose an appropriate 4xx status consistent with the project's existing API conventions.

Prefer a semantic client error rather than:

```text
500
```

Document the selected status.

---

## 71. User Message

Use a clear message:

```text
This watchlist can contain up to 1,000 stocks.
```

or equivalent.

---

## 72. No Mutation

When the capacity error occurs:

* no provider resolution;
* no Watchlist save;
* no partial mutation.

---

# Existing Data

## 73. No Rewrite

Do not rewrite existing Watchlist documents merely to apply new bounds.

---

## 74. Existing Valid Data

All existing relevant persisted data is known to be within the new limits.

No compatibility workaround is needed.

---

# API Request Bodies

## 75. Unknown Fields

Preserve TASK-037's observed behavior for unknown JSON properties.

Do not introduce strict unknown-field rejection as part of this task unless required by existing architecture.

---

## 76. Wrong Types

Preserve current:

```text
400 INVALID_REQUEST
```

behavior for wrong JSON types.

---

# Request Body Size

## 77. Explicitly Out of Scope

TASK-037 found that:

```text
request.json()
```

runs before field-level validation and that Cloudflare's platform body limits are much larger than legitimate application requests.

Do NOT implement transport/body-size hardening in TASK-038.

---

## 78. TASK-039

Preserve/document the recommendation for a separate:

```text
TASK-039 — Request Body Size Hardening
```

after TASK-038.

Do not silently absorb that work here.

---

# Client Input Attributes

## 79. Required `maxlength` Values

The final visible text inputs must use:

```text
Watchlist name:
maxlength=50

Stock symbol:
maxlength=20

Target Price:
maxlength=20

Total Savings:
maxlength=8

Company-name filter:
maxlength=100
```

Use constants rather than unexplained literals where practical.

---

## 80. Cards and Table

Target Price is now rendered through responsive Table/Card presentations.

Because both reuse `TargetPriceCell`, the length constraint must apply consistently in both modes.

Do not duplicate separate Card/Table limits.

---

# Client Validation Messages

## 81. Watchlist Name

Provide useful local feedback where current UX supports it.

---

## 82. Stock Symbol

Preserve existing invalid-symbol feedback.

Too-long input belongs to the same invalid-symbol semantic category.

---

## 83. Target Price

Out-of-range value uses the existing Target Price validation/error presentation.

---

## 84. Total Savings

Out-of-range/unsafe value uses existing Total Savings validation presentation.

---

## 85. Filter

The browser `maxlength` may simply prevent further entry.

No error banner is required for the local filter unless the existing architecture makes one natural.

---

# Shared Constants

## 86. No Magic Numbers

Avoid repeating:

```text
20
50
64
100
1000
1000000
10000000
```

across unrelated client/server files.

Use appropriately scoped named constants.

---

## 87. Server-Only vs Shared

A limit needed by both browser and server belongs in client-safe shared code.

A purely server-side resource bound may remain in an appropriate server/domain module.

Do not expose server-only implementation modules to browser bundles.

---

# Unit Tests — Watchlist Name

## 88. Exactly 50

A trimmed Watchlist name of exactly 50 code units is accepted.

---

## 89. 51

A trimmed Watchlist name of 51 code units is rejected.

---

## 90. Trim Boundary

Whitespace outside the name does not count after trimming.

---

## 91. Unicode

Add a representative Unicode case proving the implementation uses the documented JavaScript `.length` semantics without introducing grapheme complexity.

---

# Unit Tests — Stock Symbol

## 92. Exactly 20

A syntactically valid normalized symbol of length 20 is accepted by syntax/length validation.

Provider outcome remains separate.

---

## 93. 21

A syntactically valid normalized symbol of length 21 is rejected before provider access.

---

## 94. 5,000 Regression

Preserve the TASK-037 reproduction as a regression test:

```text
very long syntactically valid symbol
→ INVALID_STOCK_SYMBOL
→ provider calls = 0
```

The test need not literally allocate an unnecessarily huge value if a smaller over-limit case proves the same boundary; include at least one clearly pathological case where useful.

---

# Unit Tests — Symbol Path

## 95. Lowercase Canonicalization

Verify Target Price path symbol:

```text
aapl
```

becomes:

```text
AAPL
```

before persistence/provider use.

---

## 96. Invalid Grammar

Invalid path symbol is rejected before provider/repository mutation.

---

## 97. Too Long

Over-limit path symbol is rejected before provider access.

---

## 98. Case Identity

Verify `AAPL` and `aapl` cannot produce separate Target Price persistence identities through the HTTP/application path.

---

# Unit Tests — Target Price

## 99. Maximum Valid

```text
1,000,000
```

accepted.

---

## 100. Above Maximum

```text
1,000,000.0001
```

rejected.

---

## 101. Decimal Precision

A reasonable multi-decimal value below maximum remains accepted.

This proves no unintended two-decimal domain restriction was introduced.

---

## 102. Existing Invalid Cases

Preserve tests for:

* zero;
* negative;
* NaN;
* Infinity;
* -Infinity.

---

# Unit Tests — Total Savings

## 103. Maximum Valid

```text
10,000,000
```

accepted.

---

## 104. Above Maximum

```text
10,000,001
```

rejected.

---

## 105. Unsafe Integer

Explicitly verify an unsafe integer is rejected.

---

## 106. Existing Cases

Preserve:

* zero valid;
* negative invalid;
* fractional invalid;
* non-finite invalid.

---

# Unit Tests — Watchlist ID

## 107. 64 Characters

A 64-character structurally acceptable ID is not rejected solely for length.

Its eventual not-found behavior may depend on the test setup.

---

## 108. 65 Characters

A 65-character ID produces:

```text
400 INVALID_REQUEST
```

before repository/provider work.

---

## 109. All Routes

Cover the shared validation path sufficiently to prove all Watchlist-ID routes use the same rule.

Do not duplicate identical tests for every route if a shared boundary helper plus representative route tests provides stronger coverage.

---

# Unit Tests — Watchlist Capacity

## 110. 999 Stocks

Given 999 existing stocks:

```text
add one valid new stock
→ succeeds
→ resulting count 1000
```

---

## 111. 1000 Stocks

Given 1,000 existing stocks:

```text
add another
→ WatchlistStockLimitReachedError
→ provider calls = 0
→ save calls = 0
```

---

## 112. More Than 1000

Given a defensive historical state above the limit:

```text
add another
→ same capacity error
```

Do not truncate.

---

## 113. Missing Watchlist

If the hardened admission architecture now detects missing Watchlist before provider access:

```text
WatchlistNotFoundError
provider calls = 0
```

Test/document this intentional ordering change.

---

## 114. Duplicate

If duplicate detection moves before provider resolution as part of the clean admission design:

```text
DuplicateSymbolError
provider calls = 0
```

Test/document it.

If the final architecture preserves provider-before-duplicate, explain why in the completion report.

---

# API/Error Mapping Tests

## 115. Watchlist Name

Too-long name maps to:

```text
INVALID_WATCHLIST_NAME
```

---

## 116. Stock Symbol

Too-long symbol maps to:

```text
INVALID_STOCK_SYMBOL
```

---

## 117. Target Price

Above maximum maps to:

```text
INVALID_TARGET_PRICE
```

---

## 118. Total Savings

Above maximum/unsafe integer maps to:

```text
INVALID_TOTAL_SAVINGS
```

---

## 119. Watchlist ID

Over-limit ID maps to:

```text
400 INVALID_REQUEST
```

---

## 120. Capacity

Full Watchlist maps to:

```text
WATCHLIST_STOCK_LIMIT_REACHED
```

with the final selected 4xx status and clear message.

---

# Client Unit Tests

## 121. Watchlist Name

Verify client rejects over-limit name before POST.

---

## 122. Stock Symbol

Verify over-limit symbol is rejected before client API call.

---

## 123. Target Price

Verify above-max Target Price is rejected before PUT.

---

## 124. Total Savings

Verify above-max and unsafe values are rejected before allocation POST.

---

## 125. Filter

Verify local filtering remains predictable at the 100-character boundary.

---

# Playwright E2E

## 126. Permanent Coverage

Update existing feature specs rather than creating one enormous security-only browser suite.

Natural homes:

```text
watchlist-management.spec.ts
stock-management.spec.ts
target-price.spec.ts
investment-allocation.spec.ts
watchlist-filtering.spec.ts
```

Use Table/Card presentation-agnostic locators where possible.

---

## 127. HTML `maxlength`

Verify the visible fields expose the required limits:

```text
Watchlist name  50
Stock symbol    20
Target Price    20
Total Savings    8
Filter          100
```

Do this in representative Table/Card modes where relevant.

---

## 128. Watchlist Name UX

Verify browser input cannot exceed the intended length through normal typing and existing creation behavior remains functional at the boundary.

---

## 129. Stock Symbol UX

Verify normal typing respects the 20-character limit and valid ordinary symbols remain unaffected.

---

## 130. Target Price UX

Verify `maxlength=20` exists in both responsive presentations through reused `TargetPriceCell`.

---

## 131. Total Savings UX

Verify 8-character maximum and maximum valid value behavior.

---

## 132. Filter UX

Verify filter stops at 100 characters and remains local-only.

No API request should result from filter typing.

---

## 133. Server Bypass Tests

Browser `maxlength` makes it awkward to create over-limit values through normal UI typing.

Server-authoritative validation belongs primarily in unit/API tests.

Do not weaken server tests merely because E2E cannot type beyond `maxlength`.

---

## 134. Capacity UI Error

Using mocked API behavior, verify:

```text
WATCHLIST_STOCK_LIMIT_REACHED
```

produces the intended user-facing stock-add error and leaves the active Watchlist unchanged.

Do not attempt to render 1,000 real Cards/Table rows merely to trigger the API in browser E2E.

---

# Responsive Verification

## 135. Table Mode

Verify Target Price `maxlength` and other shared controls above the 1120px breakpoint.

---

## 136. Card Mode

Verify the same Target Price constraint below 1120px.

---

# Architecture Documentation

## 137. Input Bounds

Update `ARCHITECTURE.md` with the accepted final bounds.

Keep the presentation concise.

---

## 138. Authoritative Server Rule

Preserve TASK-037's rule:

> Browser constraints are UX only. Server-side validation is authoritative.

---

## 139. Resource Capacity

Document:

> A Watchlist may contain at most 1,000 stocks.

Include why:

* bounded provider/application work;
* bounded persistence growth;
* bounded composition/allocation/rendering workload.

Do not frame 1,000 as an investment recommendation.

---

## 140. Symbol Boundary

Document that all external Stock Symbol boundaries use the same normalization/length/grammar rule.

---

## 141. Target Price Precision

Document that Target Price has an upper bound but no artificial two-decimal domain restriction.

---

## 142. Total Savings

Document safe-integer and maximum-value semantics.

---

## 143. Watchlist IDs

Document the 64-character defensive HTTP-boundary limit and malformed-vs-not-found distinction.

---

# Security Audit Follow-Up

## 144. Update Audit

Update:

```text
docs/security/input-boundary-audit.md
```

with a concise implementation-status note.

Do not erase the original findings.

Record that TASK-038 closes the field/resource-bound findings while request-body-size hardening remains open for TASK-039.

---

# Historical Tasks

## 145. TASK-029

Add a concise supersession note if appropriate:

```text
TASK-038 later added a 20-character maximum to the existing Stock Symbol grammar.
```

Keep Done.

---

## 146. TASK-037

Preserve as the audit record.

Do not rewrite it into an implementation task.

---

# README

## 147. README

No detailed security-limit table is required in the product introduction.

Update only if developer/operator documentation would materially benefit.

---

# Non-Goals

Do NOT implement:

* request-body-size hardening;
* rate limiting;
* WAF configuration;
* CAPTCHA;
* CSRF redesign;
* authentication changes;
* Access changes;
* new provider behavior;
* Target Price decimal-place restriction;
* stock-symbol autocomplete;
* Watchlist data migration;
* automatic truncation;
* strict unknown-JSON-field rejection;
* new Watchlist-ID generator;
* stock-count pagination;
* UI redesign;
* production deployment;
* unrelated V3 features.

Request-body-size hardening belongs to TASK-039.

---

# Acceptance Criteria

The task is complete when all of the following are true:

1. Watchlist names are bounded to 50 after trim.
2. Exactly 50 is valid.
3. 51 is invalid.
4. Watchlist-name client input has `maxlength=50`.
5. Server independently enforces Watchlist-name limit.
6. Existing duplicate-name behavior remains.
7. Stock Symbols are bounded to 20 after normalization.
8. Existing symbol grammar remains.
9. Stock input has `maxlength=20`.
10. Over-limit symbols never reach MarketDataProvider.
11. Too-long Stock Symbol uses `INVALID_STOCK_SYMBOL`.
12. Every external Symbol path uses canonical Stock Symbol normalization.
13. Lowercase Target Price path symbol becomes uppercase.
14. Invalid path symbol is rejected.
15. Too-long path symbol is rejected before provider access.
16. Case differences cannot split Target Price persistence identity.
17. Target Price maximum is 1,000,000.
18. Target Price remains strictly positive.
19. Target Price remains finite.
20. No two-decimal domain restriction is introduced.
21. Target Price input has `maxlength=20`.
22. Client rejects Target Price above maximum.
23. Server independently rejects Target Price above maximum.
24. Total Savings uses `Number.isSafeInteger`.
25. Total Savings maximum is 10,000,000.
26. Zero remains valid.
27. Fractional values remain invalid.
28. Unsafe integers are invalid.
29. Total Savings input has `maxlength=8`.
30. Client rejects above-max Total Savings.
31. Server independently rejects above-max Total Savings.
32. Company filter has max length 100.
33. Filter input has `maxlength=100`.
34. Filter remains local-only.
35. Watchlist IDs are bounded to 64.
36. Over-limit Watchlist ID returns `400 INVALID_REQUEST`.
37. Valid-length missing ID remains not-found.
38. All Watchlist-ID routes use the defensive boundary.
39. Watchlist capacity is 1,000 stocks.
40. 999 → add one succeeds.
41. 1,000 → add one fails.
42. > 1,000 defensive state also rejects additions.
43. Full Watchlist is not truncated.
44. Full Watchlist remains readable/removable.
45. Capacity rejection occurs before provider resolution.
46. Capacity rejection causes no persistence mutation.
47. Dedicated `WATCHLIST_STOCK_LIMIT_REACHED` API code exists.
48. Capacity error uses clear user-facing wording.
49. User isolation remains intact.
50. Missing-Watchlist/provider ordering changes are documented if changed.
51. Duplicate/provider ordering changes are documented if changed.
52. No data migration is introduced.
53. Shared constants avoid unexplained duplicate limits.
54. Client and server use consistent rules.
55. Unknown JSON-field behavior remains unchanged.
56. Wrong-type behavior remains unchanged.
57. Request-body-size hardening is not implemented.
58. Audit document records TASK-039 as remaining follow-up.
59. Unit tests cover every exact boundary.
60. Unit tests cover every over-boundary case.
61. API/error-mapping tests cover new behavior.
62. Client tests cover local pre-request validation.
63. E2E verifies all required `maxlength` attributes.
64. E2E verifies capacity-error presentation.
65. Table mode Target Price limit is verified.
66. Card mode Target Price limit is verified.
67. Existing business behavior remains green.
68. `ARCHITECTURE.md` documents final rules.
69. Security audit is updated with implementation status.
70. No unnecessary dependency is introduced.
71. No production deployment occurs.

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

Additionally verify explicitly:

1. Watchlist name length 50/51;
2. Stock Symbol length 20/21;
3. pathological long valid Stock Symbol causes zero provider calls;
4. Target Price path `aapl` canonicalizes to `AAPL`;
5. invalid/long Target Price path symbol causes zero provider calls;
6. Target Price `1,000,000` valid;
7. Target Price above maximum invalid;
8. multi-decimal Target Price below maximum remains valid;
9. Total Savings `10,000,000` valid;
10. `10,000,001` invalid;
11. unsafe integer invalid;
12. Watchlist ID 64/65 behavior;
13. company filter 100-character UX;
14. 999-stock Watchlist accepts one;
15. 1,000-stock Watchlist rejects one;
16. capacity rejection causes zero provider calls;
17. capacity rejection causes zero saves;
18. defensive >1,000 state rejects additions;
19. capacity API error/message;
20. all five visible `maxlength` constraints;
21. Target Price constraint in Table mode;
22. Target Price constraint in Card mode;
23. no request-body-size work was accidentally introduced.

Do not report a verification step as successful unless actually executed successfully.

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
2. final shared validation/constants structure;
3. Watchlist-name implementation;
4. Watchlist-name client/server behavior;
5. Stock Symbol length implementation;
6. proof long symbols no longer reach provider;
7. Symbol URL-boundary implementation;
8. Target Price path canonicalization behavior;
9. proof Target Price case identity cannot split;
10. Target Price maximum implementation;
11. Target Price decimal-precision behavior;
12. Total Savings safe-integer implementation;
13. Total Savings maximum implementation;
14. company-filter limit implementation;
15. Watchlist-ID boundary implementation;
16. malformed-vs-not-found behavior;
17. Watchlist-capacity implementation;
18. final Add Stock admission flow;
19. capacity-before-provider proof;
20. capacity error class/API code/status/message;
21. missing-Watchlist ordering behavior;
22. duplicate ordering behavior;
23. confirmation no migration was needed;
24. client `maxlength` values;
25. unit tests added/changed;
26. API/error-mapping tests added/changed;
27. Playwright tests added/changed;
28. Table/Card validation consistency;
29. `ARCHITECTURE.md` changes;
30. security-audit follow-up changes;
31. historical task notes;
32. README changes, if any;
33. results of `test`, `test:e2e`, `check`, `lint`, and `build`;
34. confirmation request-body-size hardening remains deferred to TASK-039;
35. confirmation no server/provider behavior outside the specified validation/admission changes was introduced;
36. confirmation no production deployment occurred;
37. confirmation task status changed to Done;
38. assumptions or unresolved issues;
39. deviations from this task or `ARCHITECTURE.md`.

Do not proceed to TASK-039.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
