# TASK-037: Input Boundary Security Audit

## Status

Done

## Goal

Perform a focused security audit of all externally controlled application inputs before implementing systematic input-length and numeric-range hardening.

The application already validates many inputs semantically, but several inputs currently have no explicit upper bounds.

Examples include:

```text
Watchlist name
Stock symbol
Target Price
Total Savings
Watchlist IDs in URL paths
Stock symbols in URL paths
```

Client-side fields also do not consistently expose HTML length constraints such as:

```html
maxlength="..."
```

This creates two separate concerns:

1. **UX:** users can enter values that the application should never reasonably accept.
2. **Server security/robustness:** a caller can bypass the UI entirely and send excessively long or numerically extreme input directly to the HTTP API.

The intended security principle is:

> Every externally controlled string and numeric value must eventually have an explicit, justified bound at the authoritative server boundary.

Browser restrictions mirror those rules for UX but are never treated as security enforcement.

This task is an **audit and design task only**.

Do not implement the final validation changes yet.

The output of this task will define the exact scope and limits for TASK-038.

---

# Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* all current REST route handlers;
* all current API request parsers;
* all current client input parsers;
* all current shared validation utilities;
* TASK-005;
* TASK-007;
* TASK-009;
* TASK-010;
* TASK-012;
* TASK-013;
* TASK-015;
* TASK-019;
* TASK-020;
* TASK-021;
* TASK-024;
* TASK-029;
* TASK-030;
* current route tree under `src/routes/api/`;
* this task completely.

Inspect the actual current implementation rather than assuming the historical task descriptions still represent every validation rule.

---

# Scope

## 1. Audit All Untrusted Inputs

Identify every value that can be controlled by an external HTTP caller.

Do not limit the audit to visible HTML input fields.

Include at minimum:

```text
request bodies
URL path parameters
query parameters, if any
relevant request headers, if application-controlled
form values, if any
```

Authentication headers managed by Cloudflare Access are outside the ordinary product-input scope, but their handling may be mentioned separately where relevant.

---

## 2. Client Inputs

Inventory all user-editable product fields currently present in the browser.

Expected examples include:

```text
Watchlist name
Stock symbol
Target Price
Total Savings
company-name filter
```

Determine which of these values ever cross the network boundary.

---

## 3. Server Inputs

Inventory all server-side route inputs independently of the browser.

Expected examples include:

```text
watchlistId path parameter
symbol path parameter
Watchlist name request body
stock symbol request body
Target Price request body
Total Savings request body
```

A value is untrusted even if normal application navigation generates it rather than asking the user to type it manually.

---

# Threat Model

## 4. UI Is Not a Security Boundary

Assume an attacker can call every public application endpoint directly.

For example:

```text
POST /api/watchlists
```

does not become safe merely because the browser later receives:

```html
maxlength="50"
```

The authoritative limit must exist server-side.

---

## 5. Direct URL Abuse

Consider requests such as:

```text
/api/watchlists/<extremely-long-value>
```

and:

```text
/api/target-prices/<extremely-long-symbol>
```

without going through the application UI.

---

## 6. Oversized JSON Values

Consider requests conceptually like:

```json
{
  "name": "<very large string>"
}
```

or:

```json
{
  "symbol": "<very large string>"
}
```

and determine where the current implementation first rejects or processes them.

---

## 7. Numeric Extremes

Consider:

```text
very large integers
very long numeric strings
Number.MAX_SAFE_INTEGER boundaries
unsafe integers
Infinity/NaN where representable internally
exponential JSON numbers
very small positive numbers
```

according to the actual parser/API behavior.

Do not assume HTML input behavior constrains direct JSON requests.

---

# Validation Layers

## 8. Record Every Existing Layer

For each audited input, document validation at each applicable layer:

```text
HTML/input constraint
client parser
client orchestration
HTTP handler
application service
domain function
repository/provider boundary
```

Do not describe a validation as server-side merely because a client helper is shared with server code; identify where it is actually invoked.

---

## 9. Authoritative Validation

For each input, identify which layer currently acts as the authoritative validation boundary.

If no authoritative server-side bound exists, state:

```text
MISSING
```

explicitly.

---

## 10. Duplicate Validation

Identify cases where equivalent validation is duplicated rather than shared.

Do not refactor them in this task.

Report whether consolidation would be appropriate in TASK-038.

---

# Watchlist Name

## 11. Current Rules

Determine the exact current Watchlist-name behavior:

* trimming;
* empty/whitespace handling;
* allowed characters;
* duplicate names;
* maximum length;
* client validation;
* server validation;
* persistence behavior.

---

## 12. Length Bound

Determine whether any explicit maximum length currently exists.

If none exists, recommend a concrete product limit.

Starting candidate:

```text
50 characters after trimming
```

Evaluate this against:

* current tab/navigation UI;
* production use case;
* duplicate-name support;
* storage model;
* existing tests.

---

## 13. Unicode Semantics

Determine whether the proposed Watchlist-name limit should count:

```text
JavaScript string length / UTF-16 code units
```

or:

```text
Unicode code points / user-perceived characters
```

Do not introduce a complex Unicode/grapheme library without a concrete need.

Recommend the simplest predictable rule appropriate for this product.

---

# Stock Symbol

## 14. Current Rules

TASK-029 established normalization and grammar.

Confirm the current production rule:

```text
trim
→ uppercase
→ syntax validation
→ provider equity resolution
```

---

## 15. Current Grammar

Confirm the actual current grammar.

Expected:

```regex
^[A-Z0-9]+(?:[.-][A-Z0-9]+)*$
```

Do not change it during this audit.

---

## 16. Missing Length Bound

Determine whether stock symbols currently have an explicit maximum length.

If not, recommend a concrete maximum.

Starting candidate:

```text
20 characters after normalization
```

Evaluate whether this safely covers the Yahoo-style international equity symbols supported by the product.

Do not perform broad Yahoo Search integration.

A focused review of existing real symbol examples/provider conventions is sufficient.

---

## 17. Provider Protection

Confirm whether an excessively long but syntactically valid symbol can currently reach:

```text
MarketDataProvider.resolveSymbol()
```

If yes, identify this explicitly as a boundary-hardening gap.

TASK-038 should ensure invalid length is rejected before provider access.

---

## 18. Symbol Path Parameter

Audit Target Price and any other routes that accept Symbol in the URL.

Determine whether those routes apply the same normalization/syntax rules as stock addition.

Identify any inconsistency.

Do not fix it yet.

---

# Target Price

## 19. Current Client Input

Inspect:

```text
TargetPriceCell
targetPriceInput parser
```

and record:

* accepted decimal separators;
* whitespace behavior;
* empty behavior;
* positivity;
* finite-number validation;
* textual length constraints;
* numeric upper bound.

---

## 20. Current Server Validation

Inspect the authoritative Target Price server/domain validation.

Determine whether it currently checks:

```text
number type
finite
> 0
maximum value
```

and whether direct API requests can bypass client textual parsing.

---

## 21. Text Length vs Numeric Range

Treat these as separate concepts.

Client textual input may need:

```text
maxlength
```

while the server receives/parses a numeric JSON value and therefore needs a numeric range rule.

Do not pretend that a server can enforce the original textual length after JSON parsing unless the actual API receives text.

---

## 22. Target Price Maximum

Recommend a concrete maximum Target Price.

Starting candidate:

```text
1,000,000
```

Evaluate whether this is appropriate for the application's supported equities and financial calculations.

The recommendation must be justified as a product/application bound, not as a claim about every possible stock market instrument.

---

## 23. Decimal Precision

Audit whether Target Price currently permits arbitrary decimal precision.

Example:

```text
123.123456789012345
```

Determine:

* how JavaScript parses it;
* what gets persisted;
* whether the product already has an implicit precision rule;
* whether TASK-038 should introduce an explicit decimal-precision limit.

Do not introduce a new precision rule during the audit.

---

## 24. Scientific Notation

Determine how direct JSON requests such as:

```json
{
  "targetPrice": 1e20
}
```

are handled.

Also determine whether the browser text parser accepts scientific notation.

Recommend whether scientific notation should remain accepted at the API boundary if it falls within the final numeric range.

---

# Total Savings

## 25. Current Rules

Inspect the current Total Savings parser/domain validation.

Record:

* non-negative requirement;
* integer requirement;
* finite requirement;
* safe-integer requirement;
* upper bound;
* client text length;
* direct API behavior.

---

## 26. Safe Integer

Determine whether current validation uses:

```ts
Number.isInteger(...)
```

or:

```ts
Number.isSafeInteger(...)
```

If only `Number.isInteger` is used, determine whether unsafe integers are currently accepted.

---

## 27. Total Savings Maximum

Recommend a concrete product maximum.

Starting candidate:

```text
10,000,000
```

Evaluate it against the actual savings-allocation use case.

The goal is not to model every possible institutional portfolio.

This is a personal portfolio/savings-planning application.

---

## 28. Client Length

Recommend a reasonable `maxlength` for Total Savings input consistent with the final numeric maximum.

Do not choose a length independently from the numeric range.

---

# Watchlist IDs

## 29. ID Generation

Determine how Watchlist IDs are currently generated.

Record:

* format;
* normal length;
* character set;
* whether IDs are opaque application-generated identifiers.

---

## 30. Path Validation

Determine whether incoming:

```text
watchlistId
```

path parameters are currently validated before:

* repository access;
* application-service lookup;
* provider work;
* persistence operations.

---

## 31. ID Bound Recommendation

Recommend a defensive maximum length and, if appropriate, syntax rule based on the actual generated format.

Do not invent a stricter rule that would invalidate legitimately generated existing IDs.

---

## 32. Missing vs Invalid ID Semantics

Determine whether malformed IDs should ultimately map to:

```text
validation error
```

rather than:

```text
Watchlist not found
```

Report the recommended API behavior for TASK-038.

Do not change the contract yet.

---

# Company Name Filter

## 33. Local-Only Input

Confirm whether the company-name filter is still purely client-side.

If it never crosses the network boundary, state this explicitly.

---

## 34. Client Length

Even though it is not a server security boundary, evaluate whether a UI `maxlength` is still useful to avoid pathological local strings.

Recommend a reasonable limit if appropriate.

Do not overstate this as server security.

---

# Other Inputs

## 35. Search Entire Route Tree

Search the route tree and request handlers for all uses of:

```text
request.json()
params
url.searchParams
request.formData()
```

or equivalent SvelteKit input mechanisms.

Do not rely solely on remembered endpoints.

---

## 36. Unknown Fields

Determine how JSON request bodies currently handle unexpected properties.

Example:

```json
{
  "symbol": "AAPL",
  "garbage": "..."
}
```

Report whether unknown properties are:

* ignored;
* rejected;
* accidentally persisted;
* otherwise processed.

Do not change behavior in this task.

---

## 37. Wrong Types

For each JSON field, inspect behavior for wrong types such as:

```json
{
  "symbol": 123
}
```

or:

```json
{
  "totalSavings": "1000"
}
```

Record current handling.

---

# Request Body Size

## 38. Separate Transport Concern

Investigate whether field-level limits alone leave an obvious oversized-request-body gap.

Example:

```json
{
  "symbol": "AAPL",
  "garbage": "<very large payload>"
}
```

---

## 39. Cloudflare Limits

Consult the current Cloudflare Workers documentation and the actual application runtime configuration to determine relevant request-body/platform limits.

Use current authoritative Cloudflare documentation.

Do not rely on remembered limits.

---

## 40. SvelteKit Parsing

Determine whether current handlers call:

```ts
request.json()
```

before any application-level body-size check.

Record the implication.

---

## 41. Recommendation Only

Do not implement custom body-size middleware in TASK-037.

Conclude whether TASK-038 should include:

```text
field-level bounds only
```

or whether a separate:

```text
TASK-039 request-body-size hardening
```

is justified.

Keep transport-level body-size protection separate if it would materially expand TASK-038.

---

# Error Model

## 42. Existing Error Codes

Inventory existing stable validation error codes relevant to:

```text
Watchlist name
Stock symbol
Target Price
Total Savings
Watchlist ID
```

---

## 43. Avoid Error-Code Explosion

Recommend reusing semantic validation codes where possible.

Conceptually:

```text
too-long stock symbol
→ INVALID_STOCK_SYMBOL

out-of-range Target Price
→ INVALID_TARGET_PRICE

out-of-range Total Savings
→ INVALID_TOTAL_SAVINGS
```

Do not recommend:

```text
STOCK_SYMBOL_TOO_LONG
TARGET_PRICE_TOO_LARGE
```

unless a concrete client behavior requires those distinctions.

---

## 44. Watchlist Name Error

If Watchlist-name validation currently lacks a suitable stable code, recommend the smallest clean API addition for TASK-038.

---

## 45. Path Parameter Error

Recommend whether malformed path parameters need a generic or resource-specific stable validation error.

Keep the public API understandable.

---

# Client UX

## 46. `maxlength`

For bounded text inputs, recommend corresponding HTML constraints where applicable.

Examples:

```text
Watchlist name
Stock symbol
Target Price text
Total Savings text
company-name filter
```

---

## 47. HTML Is Mirroring Only

Document explicitly:

> `maxlength` is a UX constraint, not the authoritative validation mechanism.

Direct HTTP callers bypass it.

---

## 48. Preserve Correction UX

Where the user reaches validation feedback rather than being prevented from typing, recommend preserving entered text for correction.

For fields using `maxlength`, document whether browser prevention alone is sufficient or whether an inline message is still useful.

---

# Shared Validation

## 49. Reuse Existing Shared Utilities

TASK-029 successfully established shared client/server Stock Symbol semantics.

Identify similar opportunities for:

```text
Watchlist name
Target Price range
Total Savings range
```

---

## 50. Avoid Giant Validation Module

Do not recommend a single unrelated:

```text
validation.ts
```

containing every product rule.

Prefer domain-oriented modules/constants.

Conceptually:

```text
stockSymbol.ts
watchlistName.ts
targetPrice...
investmentSavings...
```

---

## 51. Client-Safe Shared Code

Any validation shared with the browser must remain outside:

```text
$lib/server
```

and must not depend on server-only modules.

---

# Audit Matrix

## 52. Required Output

Produce a concise audit matrix containing at least:

| Input | Source | Current Client Validation | Current Server Validation | Current Bound | Gap | Recommended Bound |
| ----- | ------ | ------------------------- | ------------------------- | ------------- | --- | ----------------- |

Include every externally controlled product input discovered.

---

## 53. Separate String/Numeric Bounds

Where appropriate, distinguish:

```text
textual input bound
```

from:

```text
parsed numeric bound
```

especially for Target Price and Total Savings.

---

# Proposed Limits

## 54. Evaluate, Do Not Blindly Adopt

The following are starting proposals:

```text
Watchlist name:
50 characters after trim

Stock symbol:
20 characters after normalization

Target Price:
0 < value <= 1,000,000
plus appropriate client text maxlength

Total Savings:
0 <= value <= 10,000,000
safe integer
plus appropriate client text maxlength
```

Determine whether the actual application architecture/use case supports these values.

---

## 55. Final Recommendation

The completion report must provide one final recommended rule for each audited input.

Do not leave TASK-038 to invent limits independently.

If a limit genuinely cannot be justified yet, state exactly what additional Product Owner decision is required.

---

# Security Classification

## 56. Distinguish Security from Product Rules

For every recommended bound, distinguish why it exists:

```text
security/robustness
product semantics
UI usability
provider protection
storage protection
```

A rule may serve more than one purpose.

---

## 57. No False Claims

Do not claim that a 50-character Watchlist name prevents a specific exploit unless the evidence supports that claim.

The primary goals are bounded resource use, predictable behavior, and reduced attack surface.

---

# Documentation

## 58. Audit Report Location

Create a focused report such as:

```text
docs/security/input-boundary-audit.md
```

if that fits the existing repository organization.

If a security-doc directory does not exist, creating it is acceptable.

Do not bury the findings only in the completion report.

---

## 59. Architecture

Update `ARCHITECTURE.md` only if the audit establishes a new accepted architectural rule.

At minimum it is acceptable to add the general rule:

> Browser input constraints are UX only; all externally controlled values require authoritative server-side validation and explicit bounds.

Do not document proposed numeric limits as final architecture if they still require Product Owner approval.

---

## 60. No Historical Task Rewrites

Do not rewrite old completed tasks merely because this audit discovers missing limits.

Historical tasks should remain historical.

TASK-038 will supersede relevant validation behavior.

---

# Tests

## 61. No Production Behavior Changes

Because this is an audit-only task, existing product behavior should not change.

No new validation behavior should be introduced.

---

## 62. Verification Tests

Run existing tests to ensure audit/documentation changes do not accidentally affect product code.

---

## 63. Focused Experiments

Small local experiments/tests/scripts may be used to establish current behavior for:

* unsafe integers;
* JSON numeric parsing;
* current ID format;
* oversized valid symbols;
* unknown JSON fields.

Do not leave temporary scripts in the repository.

---

## 64. No Live Abuse

Do not send intentionally oversized/adversarial requests to production.

Use local/unit/dev environments only.

---

# No Implementation

## 65. Do Not Add `maxlength`

Do not add HTML `maxlength` attributes in this task.

That belongs to TASK-038.

---

## 66. Do Not Add Server Bounds

Do not add maximum-length/range checks in this task.

---

## 67. Do Not Change Error Mapping

Do not introduce new validation error codes yet.

---

## 68. Do Not Change Provider Behavior

Do not change Yahoo/Frankfurter behavior.

---

# Non-Goals

Do NOT implement:

* final input-length validation;
* final numeric-range validation;
* `maxlength`;
* request-body middleware;
* rate limiting;
* CAPTCHA;
* WAF rules;
* CSRF redesign;
* authentication changes;
* Cloudflare Access changes;
* provider changes;
* persistence migration;
* UI redesign;
* production deployment;
* unrelated security improvements.

This task determines the exact scope for implementation.

---

# Acceptance Criteria

The task is complete when all of the following are true:

1. Every HTTP route is inspected for externally controlled input.
2. Every JSON body field is inventoried.
3. Every path parameter is inventoried.
4. Every query parameter is inventoried.
5. Relevant form-data inputs are inventoried.
6. Visible browser inputs are inventoried separately.
7. Watchlist-name validation is documented.
8. Watchlist-name maximum-length gap is assessed.
9. Stock-symbol normalization/grammar is confirmed.
10. Stock-symbol maximum-length gap is assessed.
11. Provider exposure to long symbols is assessed.
12. Symbol path-parameter validation is assessed.
13. Target Price client parsing is documented.
14. Target Price server validation is documented.
15. Target Price textual-length gap is assessed.
16. Target Price numeric-upper-bound gap is assessed.
17. Target Price decimal precision is assessed.
18. Target Price scientific-notation behavior is assessed.
19. Total Savings client parsing is documented.
20. Total Savings server validation is documented.
21. Safe-integer behavior is assessed.
22. Total Savings upper-bound gap is assessed.
23. Watchlist ID generation format is documented.
24. Watchlist ID path validation is assessed.
25. Defensive Watchlist ID bound is recommended.
26. Company filter network/local status is confirmed.
27. Other route inputs are discovered through code search rather than assumption.
28. Unknown JSON-field behavior is documented.
29. Wrong-type behavior is documented.
30. Current request-body parsing behavior is documented.
31. Current Cloudflare request-body limits are researched from authoritative current documentation.
32. Need for separate body-size hardening is assessed.
33. Existing validation error codes are inventoried.
34. Error-code reuse strategy is recommended.
35. Client `maxlength` candidates are recommended.
36. Shared-validation opportunities are identified.
37. Giant generic validation module is not recommended without cause.
38. Audit matrix is produced.
39. String and numeric bounds are distinguished where needed.
40. Final recommended Watchlist-name bound is provided.
41. Final recommended Stock Symbol bound is provided.
42. Final recommended Target Price range is provided.
43. Final recommended Total Savings range is provided.
44. Final recommended path-parameter bounds are provided.
45. Each bound includes rationale.
46. Security/product/UX motivations are distinguished.
47. Findings are persisted in a focused repository document.
48. Architecture gets the general authoritative-server-validation rule where appropriate.
49. No final validation implementation is introduced.
50. No `maxlength` is introduced.
51. No provider behavior changes.
52. No production adversarial testing occurs.
53. Existing project checks remain green.
54. No unnecessary dependency is introduced.
55. No production deployment occurs.

---

# Verification

Before completing the task, execute:

```bash
npm run test
npm run check
npm run lint
npm run build
```

`npm run test:e2e` is not mandatory for a documentation/audit-only task if no product or E2E code changes occur.

If any product code changes accidentally become necessary, stop and report the scope conflict rather than silently implementing TASK-038.

Additionally verify explicitly:

1. complete route inventory;
2. complete body/path/query input inventory;
3. Watchlist-name current behavior;
4. Stock Symbol current behavior;
5. Target Price current behavior;
6. Total Savings current behavior;
7. Watchlist ID format;
8. symbol path handling;
9. unknown JSON properties;
10. wrong JSON types;
11. unsafe integer behavior;
12. current Cloudflare body-size documentation;
13. whether `request.json()` occurs before application validation;
14. final recommended limits;
15. final TASK-038 scope.

Do not report a verification step as successful unless actually executed.

Do NOT deploy production.

---

# Task Status

After the audit, documentation, recommendations, and verification criteria are satisfied, change:

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
2. complete HTTP input inventory;
3. complete visible-client-input inventory;
4. audit matrix;
5. current Watchlist-name validation;
6. recommended Watchlist-name maximum and rationale;
7. current Stock Symbol validation;
8. recommended Stock Symbol maximum and rationale;
9. whether long valid symbols currently reach MarketDataProvider;
10. symbol path-parameter findings;
11. current Target Price client validation;
12. current Target Price server validation;
13. recommended Target Price textual limit;
14. recommended Target Price numeric range and rationale;
15. Target Price precision/scientific-notation findings;
16. current Total Savings validation;
17. safe-integer finding;
18. recommended Total Savings textual/numeric bounds;
19. Watchlist ID generation format;
20. Watchlist ID validation findings;
21. recommended Watchlist ID bounds;
22. company-filter finding;
23. any additional external inputs discovered;
24. unknown JSON-field behavior;
25. wrong-type behavior;
26. Cloudflare request-body-limit findings with source;
27. SvelteKit/request.json parsing finding;
28. whether a separate request-body-size task is recommended;
29. existing API validation error-code inventory;
30. recommended error-code strategy;
31. recommended client `maxlength` values;
32. recommended shared-validation structure;
33. final proposed TASK-038 scope;
34. `ARCHITECTURE.md` changes;
35. security audit document location;
36. results of `test`, `check`, `lint`, and `build`;
37. confirmation no final validation implementation was introduced;
38. confirmation no production adversarial requests were made;
39. confirmation no production deployment occurred;
40. confirmation task status changed to Done;
41. assumptions or unresolved Product Owner decisions;
42. deviations from this task or `ARCHITECTURE.md`.

Do not proceed to TASK-038.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
