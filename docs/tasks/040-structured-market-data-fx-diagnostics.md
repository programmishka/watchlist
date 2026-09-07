# TASK-040: Structured Production Diagnostics for Market Data and FX

## Status

Done

## Goal

Introduce focused, structured production diagnostics for incomplete market data and FX conversion so missing Watchlist values can be traced to their actual upstream cause.

The Product Owner observed differences between the legacy application and the current production application for real stocks such as:

```text
2330.TW
ASSA-B.ST
AZO
```

For example, a missing:

```text
Market Cap (USD bn): —
```

may have fundamentally different causes:

```text
Yahoo/MarketDataProvider did not provide marketCap
```

or:

```text
marketCap exists
but the required FX rate is unavailable
```

or:

```text
all required upstream values exist
but application composition still produces undefined
```

The application currently represents these cases safely as missing data, but production diagnostics are insufficient to distinguish them.

TASK-040 adds **anomaly-oriented structured logging** using Cloudflare Workers' existing logging/observability facilities.

The task must not attempt to fix the observed Market Cap cases before their causes are established from real diagnostic evidence.

As a small unrelated UI polish item requested by the Product Owner, this task also adds native tooltips for visually truncated Savings Amount values in the desktop table.

---

# Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* TASK-002;
* TASK-003;
* TASK-004;
* TASK-006;
* TASK-011;
* TASK-014;
* TASK-017;
* TASK-024;
* TASK-031;
* TASK-033;
* TASK-034;
* TASK-036;
* TASK-037;
* TASK-038;
* TASK-039;
* current `MarketDataProvider`;
* current `YahooFinanceAdapter`;
* current `ExchangeRateProvider`;
* current Frankfurter adapter;
* current Watchlist composition/query flow;
* current investment-allocation composition;
* current `WatchlistTable.svelte`;
* current `WatchlistCards.svelte`;
* current formatting helpers;
* current `wrangler.jsonc`;
* current Cloudflare observability configuration;
* this task completely.

Inspect the actual current implementation before deciding exactly where diagnostics belong.

---

# Production Observation

## 1. Missing Market Cap

The Product Owner imported real Watchlists from the legacy application and observed that some stocks have no Market Cap in the current application.

Representative investigation symbols:

```text
2330.TW
ASSA-B.ST
AZO
```

Current UI result may be:

```text
Market Cap (USD bn)
—
```

The reason is currently not visible.

---

## 2. Do Not Assume FX Is the Cause

For `2330.TW`, FX conversion is a plausible cause because the instrument is not USD-denominated.

For symbols such as:

```text
ASSA-B.ST
AZO
```

the cause may differ.

Do not encode assumptions about these particular stocks into production logic.

---

## 3. Diagnostic Question

Production diagnostics should make it possible to answer:

> Why did this stock field become unavailable?

For Market Cap, distinguish at minimum:

```text
provider field missing
```

from:

```text
FX conversion unavailable
```

from:

```text
unexpected composition anomaly
```

where the architecture makes that distinction possible.

---

# Cloudflare Logging Strategy

## 4. Use Workers Logs

Use Cloudflare Workers' built-in logging/observability infrastructure.

Do not add:

* Datadog;
* Sentry;
* Grafana;
* Logtail;
* another SaaS logging provider.

No external logging service is required for the current application.

---

## 5. Verify Current Cloudflare Configuration

Inspect the current Wrangler configuration and current Cloudflare Workers documentation for the installed/current Wrangler/runtime behavior.

Determine whether Workers Logs/observability require an explicit repository configuration such as:

```json
"observability": {
  "enabled": true
}
```

or whether the current Worker configuration already enables the required behavior.

Do not guess.

---

## 6. Repository Configuration

If an explicit Wrangler observability setting is required or materially improves configuration clarity, add the smallest appropriate configuration.

Do not introduce unrelated Cloudflare configuration changes.

---

## 7. Dashboard Manual Step

If Cloudflare Dashboard configuration must be performed manually by the Product Owner, document the exact post-task steps.

Do not claim to have changed production Dashboard settings.

---

# Logging Philosophy

## 8. Log Anomalies, Not Normal Operation

Do not log every successful quote, FX lookup, Watchlist load, or stock composition.

Prefer:

```text
normal data
→ no diagnostic log

missing/unavailable/anomalous data
→ structured diagnostic event
```

This reduces noise and keeps production logs useful.

---

## 9. No Debug Flood

Do not introduce logging such as:

```text
Loaded AAPL
Loaded MSFT
Loaded SAP.DE
FX USD→EUR succeeded
```

for every normal request.

---

## 10. Diagnostic Level

Use an appropriate warning/error distinction.

Conceptually:

```text
expected partial-data condition
→ console.warn

unexpected provider/application failure
→ existing error handling / console.error where appropriate
```

Do not classify every missing optional Yahoo field as a fatal application error.

---

# Small Logging Abstraction

## 11. Avoid Scattered `console.warn`

Do not spread unrelated direct `console.warn()` calls throughout business/application services if a tiny abstraction can keep diagnostics consistent and testable.

Introduce a small server-side diagnostic logging boundary if appropriate.

Conceptually:

```ts
interface DiagnosticLogger {
  warn(event: string, context: Record<string, unknown>): void;
}
```

The exact interface may differ.

---

## 12. Keep It Small

Do NOT build:

* logger hierarchies;
* configurable appenders;
* log transports;
* runtime log-level management;
* MDC frameworks;
* tracing frameworks;
* logging dependency injection across the entire application.

This task needs structured anomaly diagnostics, not a general-purpose logging platform.

---

## 13. Production Implementation

The production implementation may ultimately delegate to:

```ts
console.warn(...)
console.error(...)
```

because Cloudflare Workers captures console output.

Keep Cloudflare-specific logging mechanics outside domain logic where practical.

---

## 14. Testability

The diagnostic boundary should allow unit tests to verify:

```text
which event was emitted
with which diagnostic fields
```

without parsing console text or requiring Cloudflare.

---

# Structured Events

## 15. Stable Event Names

Use stable machine-readable event names.

Examples:

```text
market_data_incomplete
fx_rate_unavailable
market_cap_conversion_unavailable
market_data_provider_failure
fx_provider_failure
market_data_composition_anomaly
```

Use the smallest final set that accurately reflects the current architecture.

Do not create dozens of hyper-specific event types.

---

## 16. Structured Context

Prefer structured context such as:

```text
event
symbol
provider
operation
missingFields
currency
fromCurrency
toCurrency
reason
```

where relevant.

---

## 17. Avoid Log-String Parsing

Prefer:

```ts
logger.warn('market_data_incomplete', {
  symbol,
  missingFields: ['marketCap'],
  currency
});
```

over constructing a large prose sentence that later needs to be searched/parsing manually.

---

# Sensitive Data

## 18. Never Log Authentication Material

Do not log:

```text
Cf-Access-Jwt-Assertion
CF_Authorization
Authorization
Access JWT
cookies
request headers
```

---

## 19. Do Not Log User Identity

The diagnostic cases in this task do not require:

```text
email
user UUID
authenticated user ID
```

Do not include them.

---

## 20. Do Not Log Complete Provider Responses

Do not dump raw Yahoo or Frankfurter response objects.

Only log the minimum fields needed to understand why application data became unavailable.

---

## 21. No Watchlist Content Dumps

Do not log complete Watchlists, Target Prices, Savings Amounts, or persisted documents.

---

# MarketDataProvider Diagnostics

## 22. Provider Boundary

Inspect how Yahoo responses are mapped into the provider-neutral market-data model.

Identify where the application can reliably know:

```text
provider returned quote
but marketCap is missing
```

or:

```text
provider returned quote
but price is missing
```

---

## 23. Missing Quote

If the provider returns no quote for a symbol during ordinary Watchlist composition, preserve existing partial-data semantics and emit an appropriate diagnostic event where useful.

Do not turn missing quote into a new fatal error.

---

## 24. Missing Market Cap

When a quote exists but the provider-neutral Market Cap input is unavailable, emit a structured diagnostic event.

Conceptually:

```text
event: market_data_incomplete
symbol: AZO
provider: yahoo-finance
missingFields:
  - marketCap
reason: provider_field_missing
```

Use actual architecture terminology.

---

## 25. Missing Price

Similarly, when Price is unavailable and the stock remains visible through existing partial-data semantics, emit diagnostics sufficient to explain:

```text
Price: —
Distance to Target: —
```

Do not change TASK-031 semantics.

---

## 26. Missing Currency

If Currency is unavailable and this affects downstream calculations/conversion, record the relevant anomaly.

---

## 27. Provider Failure

If Yahoo throws/fails rather than returning partial data, preserve existing:

```text
MARKET_DATA_UNAVAILABLE
```

or equivalent application semantics.

Add diagnostic logging without changing the public API error.

---

## 28. Provider Error Context

For provider failures, log:

* provider;
* operation;
* symbol(s) where safe/useful;
* sanitized error category/message where appropriate.

Do not serialize arbitrary error objects if they may contain unnecessary internals.

---

# FX Diagnostics

## 29. Exchange Rate Boundary

Inspect the current ExchangeRateProvider and conversion/composition flow.

Determine exactly where:

```text
FX rate required
but unavailable
```

can be distinguished from:

```text
Market Cap itself missing
```

---

## 30. Missing FX Rate

When a Market Cap exists but cannot be converted to USD because the required FX rate is unavailable, emit a structured event.

Conceptually:

```text
event: market_cap_conversion_unavailable
symbol: 2330.TW
fromCurrency: TWD
toCurrency: USD
reason: fx_rate_missing
```

Include the original Market Cap only if useful and safe.

---

## 31. FX Provider Failure

If the FX provider fails technically, distinguish that from a normal missing-rate result where the current abstraction makes such a distinction.

Preserve existing application behavior.

---

## 32. No FX Needed

Do not log an FX anomaly for stocks whose Market Cap already requires no conversion.

---

# Composition Diagnostics

## 33. Unexpected Composition Anomaly

If all required inputs are present:

```text
Market Cap
Currency
required FX rate
```

but composed:

```text
marketCapBillionsUsd
```

still becomes unavailable because of defensive numeric checks or another application condition, emit an anomaly event.

This should be distinct from upstream missing data.

---

## 34. Numeric Safety

Do not weaken existing finite-number/invalid-data defenses merely to avoid an anomaly log.

---

# Diagnostic Reasons

## 35. Reason Vocabulary

Prefer a small stable reason vocabulary where it improves analysis.

Examples:

```text
provider_quote_missing
provider_field_missing
fx_rate_missing
provider_failure
invalid_numeric_result
```

Do not expose implementation stack traces as the reason field.

---

# No Business Behavior Changes

## 36. Missing Values Stay Missing

Diagnostics must not replace:

```text
undefined
```

with fabricated data.

---

## 37. No Provider Fallback

Do not introduce:

* another market-data provider;
* another FX provider;
* Yahoo Search;
* synthetic Market Cap;
* cached fallback values

as part of this task.

---

## 38. No New User-Facing Error

Do not show technical diagnostic reasons in the Watchlist UI.

The UI continues to show:

```text
—
```

for unavailable optional data.

Production logs are for diagnosis.

---

# Real Symbol Investigation

## 39. Investigate Representative Symbols

After diagnostics are implemented, perform a controlled verification with:

```text
2330.TW
ASSA-B.ST
AZO
```

where the real providers are available.

The purpose is to observe diagnostic behavior, not to implement symbol-specific fixes.

---

## 40. Record Actual Cause

For each symbol, report what the current provider chain actually returns.

At minimum determine where possible:

```text
Yahoo quote exists?
Yahoo marketCap?
Yahoo price?
Yahoo currency?
FX required?
FX rate available?
final composed Market Cap?
```

---

## 41. No Hardcoded Exceptions

Do not add:

```ts
if (symbol === '2330.TW') ...
```

or any equivalent symbol-specific production logic.

---

## 42. If Issue Cannot Be Reproduced

If provider data has changed and one of the observed cases no longer reproduces, report that fact.

Do not fabricate a diagnostic result.

---

# Cloudflare Production Diagnostics Documentation

## 43. README / Operations Documentation

Add concise developer/operator documentation describing how to inspect Worker logs.

Include the currently supported workflow, for example:

```text
Cloudflare Dashboard
→ Worker
→ Logs
```

and/or:

```bash
npx wrangler tail
```

according to current verified Cloudflare documentation/tooling.

---

## 44. Symbol Search

Document how the Product Owner can reproduce an issue:

```text
1. Open Workers Logs / Live Logs.
2. Load the affected Watchlist.
3. Filter/search for the symbol, e.g. 2330.TW.
4. Inspect structured diagnostic events.
```

Use the actual Cloudflare UI terminology confirmed during implementation.

---

## 45. Retention/Free-Plan Claims

If documenting Cloudflare Free-plan limits or retention, verify them against current authoritative Cloudflare documentation at implementation time.

Do not hardcode potentially stale pricing/retention claims into architecture unless necessary.

---

# Tests — Diagnostic Logger

## 46. Structured Warning

Test that a warning event retains:

```text
event name
structured context
```

without requiring Cloudflare runtime.

---

## 47. No Sensitive Context

Do not add sensitive fields to logger tests merely to prove they are omitted.

Instead keep the logger API/context producers minimal enough that those fields are never supplied.

---

# Tests — Market Data

## 48. Missing Market Cap

Provider quote with:

```text
marketCap = undefined
```

must produce the intended diagnostic event while preserving:

```text
Market Cap = undefined
```

in the composed result.

---

## 49. Missing Price

Provider quote with:

```text
price = undefined
```

must produce the appropriate diagnostic event while preserving TASK-031:

```text
distanceToTarget = undefined
```

---

## 50. Complete Quote

A complete normal quote should not emit an incomplete-market-data warning.

This proves anomaly-only logging.

---

## 51. Provider Failure

Test provider failure logging without changing existing error semantics.

---

# Tests — FX

## 52. FX Missing

Given:

```text
Market Cap present
non-USD currency
required FX rate unavailable
```

verify:

* final converted Market Cap remains unavailable;
* FX/conversion diagnostic event emitted;
* event identifies symbol and currency pair;
* no fabricated rate/value.

---

## 53. FX Success

Normal successful conversion should not emit an anomaly warning.

---

## 54. FX Failure

Provider failure should emit appropriate diagnostics while preserving existing application behavior.

---

# Tests — Composition

## 55. Invalid Result

Where current defensive calculation can produce an unavailable result despite available upstream inputs, verify the composition anomaly event.

Do not create artificial unreachable production branches solely for a test.

---

# Production/Runtime Logging Verification

## 56. Local Runtime

Verify structured logs under the local Worker runtime where practical.

Use the project's normal:

```text
npm run preview
```

or Wrangler/workerd workflow.

---

## 57. No Production Deployment

Do not deploy merely to complete the task.

The Product Owner will deploy manually.

---

## 58. Post-Deployment Instructions

Completion report must give exact steps for the Product Owner to:

1. deploy manually;
2. open Workers Logs;
3. load affected Watchlist;
4. search for `2330.TW`;
5. search for `ASSA-B.ST`;
6. search for `AZO`;
7. provide or inspect the resulting diagnostic events.

---

# Unrelated UI Polish: Truncated Savings Amount Tooltip

## 59. Observed UI Issue

At large Savings Amount values, the compact desktop table may visually truncate the value.

Example:

```text
17.85...
```

instead of the complete formatted amount.

The table column should remain compact rather than being widened solely for unrealistic/extreme allocation amounts.

---

## 60. Full Value Remains in DOM

Do not replace the actual value with a manually shortened string.

Render the complete formatted Savings Amount and let CSS perform visual ellipsis where necessary.

Conceptually:

```html
<span class="truncated-value" title="17.857 €">
  17.857 €
</span>
```

---

## 61. Native Tooltip

For calculated Savings Amount values in the desktop table, add a native:

```html
title="..."
```

containing the complete formatted value.

No JavaScript tooltip library is needed.

---

## 62. Same Formatter

The visible value and tooltip must derive from the same existing Savings Amount formatter.

Do not create a separate tooltip-specific number format.

---

## 63. Missing Savings Amount

For:

```text
Savings Amount = unavailable
```

continue displaying:

```text
—
```

A tooltip is unnecessary for the missing placeholder.

---

## 64. Real Zero

For:

```text
Savings Amount = 0
```

display the real zero according to existing whole-Euro semantics.

Do not treat zero as missing.

A native title containing the same complete value is acceptable.

---

## 65. Table Only

The truncation/tooltip requirement primarily applies to the desktop table.

Stock Cards should continue displaying the full Savings Amount without intentional ellipsis where layout allows.

Do not introduce Card truncation merely for consistency.

---

## 66. No DOM Overflow Measurement

Do not add JavaScript logic such as:

```text
scrollWidth > clientWidth
```

solely to decide whether `title` should exist.

Using the full-value title consistently for calculated table Savings Amounts is acceptable and simpler.

---

## 67. Accessibility

The complete Savings Amount must remain the DOM text content.

`title` is supplemental.

Do not make the tooltip the only source of the complete value.

---

# Tests — Savings Tooltip

## 68. Full DOM Value

Use a sufficiently large calculated Savings Amount and verify the element's text content contains the complete formatted value.

Do not assert the ellipsis text as DOM content.

---

## 69. Title

Verify the same element has:

```text
title = complete formatted value
```

---

## 70. Missing Value

Verify missing Savings Amount remains:

```text
—
```

without misleading tooltip content.

---

## 71. Card Presentation

Verify Card mode continues to expose the complete Savings Amount normally.

Do not require a native tooltip there unless the implementation naturally shares one without causing UX problems.

---

# Architecture Documentation

## 72. Diagnostics Rule

Update `ARCHITECTURE.md` with:

> Optional provider data remains fail-soft in the product UI, while structured server-side anomaly diagnostics record why data became unavailable.

---

## 73. Logging Boundary

Document the final minimal logging abstraction and that Cloudflare Workers Logs is the production sink through standard Worker console logging.

---

## 74. Sensitive Data Rule

Document that diagnostic logs must not contain:

* authentication tokens;
* cookies;
* user email;
* user identity;
* complete Watchlists;
* complete provider responses.

---

## 75. Anomaly-Only Strategy

Document that normal successful market-data/FX operations are not logged individually.

---

# Security Considerations

## 76. Log Injection / Untrusted Strings

Symbols and provider error messages are externally influenced.

Use structured logging and avoid constructing executable/control-like log strings.

Do not blindly include large arbitrary upstream error bodies.

---

## 77. Bounded Diagnostic Values

TASK-038 already bounds symbols.

Keep diagnostic context intentionally small.

Do not log unbounded provider payloads.

---

# Historical Tasks

## 78. TASK-004 / Provider Tasks

Do not rewrite historical provider tasks.

If useful, add a concise note only where repository conventions justify it.

---

## 79. TASK-034 / TASK-036

No historical update is required for the small Savings tooltip unless existing documentation explicitly says truncated table values have no full-value affordance.

---

# README

## 80. Operations Section

Add or update a concise operational section if README is currently the appropriate place for production-log inspection instructions.

Do not turn the README into a logging manual.

A focused operations/security document is also acceptable if more consistent with the repository.

---

# Non-Goals

Do NOT implement:

* a fix specifically for `2330.TW`;
* a fix specifically for `ASSA-B.ST`;
* a fix specifically for `AZO`;
* alternate MarketDataProvider;
* alternate FX provider;
* provider retries;
* provider caching changes;
* synthetic financial values;
* new user-facing diagnostics;
* logging of every successful provider call;
* full request logging;
* Access-token logging;
* user-identity logging;
* distributed tracing;
* OpenTelemetry;
* Sentry;
* Datadog;
* Grafana;
* another external logging SaaS;
* long-term log archival;
* custom tooltip library;
* JavaScript overflow measurement for Savings Amount;
* wider Savings Amount column solely for extreme values;
* production deployment;
* unrelated V3/V4 functionality.

---

# Acceptance Criteria

The task is complete when all of the following are true:

1. Current Cloudflare Workers logging configuration is inspected.
2. Current Cloudflare observability requirements are verified from authoritative documentation.
3. Required Wrangler observability config is added only if necessary.
4. No external logging provider is introduced.
5. A minimal structured diagnostic logging approach exists.
6. Logging remains server-side.
7. Stable diagnostic event names exist.
8. Diagnostic context is structured.
9. Normal successful provider operations do not flood logs.
10. Missing Market Cap can be distinguished from FX conversion failure.
11. Missing Price is diagnosable.
12. Missing Currency is diagnosable where relevant.
13. Missing quote is diagnosable where relevant.
14. MarketDataProvider technical failure is diagnosable.
15. Missing FX rate is diagnosable.
16. FX provider failure is diagnosable.
17. Unexpected composition failure is diagnosable where reachable.
18. Existing fail-soft optional-data behavior remains.
19. No missing value is fabricated.
20. Existing public API errors remain unchanged.
21. Authentication tokens are never logged.
22. Cookies are never logged.
23. User email is never logged.
24. User ID is not logged for these diagnostics.
25. Complete provider responses are not logged.
26. Complete Watchlists are not logged.
27. Diagnostic context remains bounded.
28. Missing-Market-Cap unit coverage exists.
29. Missing-Price unit coverage exists.
30. Complete normal quote produces no anomaly warning.
31. Missing-FX unit coverage exists.
32. Successful FX conversion produces no anomaly warning.
33. Provider failure logging has coverage.
34. Real/provider verification investigates `2330.TW`.
35. Real/provider verification investigates `ASSA-B.ST`.
36. Real/provider verification investigates `AZO`.
37. Actual findings are reported without symbol-specific production fixes.
38. Production log-inspection workflow is documented.
39. `npx wrangler tail` or current equivalent is documented where verified.
40. Product Owner receives explicit post-deployment diagnostic steps.
41. Savings Amount column remains compact.
42. Complete calculated Savings Amount remains in DOM.
43. Table Savings Amount receives native full-value tooltip.
44. Tooltip uses the same formatter as the visible value.
45. Missing Savings Amount remains `—`.
46. Real zero remains a real value.
47. Cards do not intentionally truncate Savings Amount.
48. No tooltip library is introduced.
49. No JavaScript overflow measurement is introduced solely for tooltip behavior.
50. `ARCHITECTURE.md` documents production diagnostic strategy.
51. Sensitive-data logging rules are documented.
52. Existing project checks pass.
53. No unnecessary production dependency is introduced.
54. No production deployment occurs.

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

1. current Workers observability configuration;
2. structured warning output locally;
3. complete normal quote produces no warning;
4. missing quote behavior;
5. missing Market Cap behavior;
6. missing Price behavior;
7. missing Currency behavior where relevant;
8. missing FX-rate behavior;
9. provider technical failure behavior;
10. FX-provider technical failure behavior;
11. no sensitive identity/authentication data in diagnostic context;
12. real-provider `2330.TW` investigation;
13. real-provider `ASSA-B.ST` investigation;
14. real-provider `AZO` investigation;
15. full Savings Amount remains DOM text;
16. native table tooltip contains full Savings Amount;
17. missing Savings Amount remains `—`;
18. Card Savings Amount remains fully available;
19. no production deployment performed.

Do not report a verification step as successful unless actually executed.

Do NOT deploy production.

---

# Task Status

After all implementation, testing, provider investigation, documentation, and UI-polish criteria are satisfied, change:

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
2. current Cloudflare observability configuration found;
3. any Wrangler observability change;
4. final diagnostic logger structure;
5. final diagnostic event names;
6. structured context fields;
7. anomaly-only logging behavior;
8. MarketDataProvider missing-data logging;
9. MarketDataProvider failure logging;
10. FX missing-rate logging;
11. FX-provider failure logging;
12. composition-anomaly logging;
13. sensitive-data exclusions;
14. unit tests added/changed;
15. real `2330.TW` provider findings;
16. real `ASSA-B.ST` provider findings;
17. real `AZO` provider findings;
18. whether each missing Market Cap is caused by Yahoo data, FX data, or composition;
19. confirmation no symbol-specific fix was introduced;
20. local/workerd logging verification;
21. documented production-log inspection workflow;
22. exact post-deployment steps for the Product Owner;
23. Savings Amount tooltip implementation;
24. full-value DOM behavior;
25. missing/zero Savings behavior;
26. Card behavior;
27. Playwright tests added/changed;
28. `ARCHITECTURE.md` changes;
29. README/operations documentation changes;
30. results of `test`, `test:e2e`, `check`, `lint`, and `build`;
31. confirmation no external logging dependency/provider was added;
32. confirmation no authentication/user identity data is logged;
33. confirmation no production provider-data fix was introduced;
34. confirmation no production deployment occurred;
35. confirmation task status changed to Done;
36. assumptions or unresolved issues;
37. deviations from this task or `ARCHITECTURE.md`.

Do not proceed to a provider-data fix until the diagnostic evidence has been reviewed.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
