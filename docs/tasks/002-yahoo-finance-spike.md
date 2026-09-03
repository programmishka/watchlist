# TASK-002: Yahoo Finance Integration Spike

## Status

Done

## Goal

Evaluate whether `yahoo-finance2` can be used reliably as the Yahoo Finance integration for the Watchlist application when running in the project's SvelteKit / Cloudflare Workers environment.

This is a **technical spike**, not a production feature implementation.

The purpose is to answer:

> Can `yahoo-finance2` retrieve the market data required by Watchlist for representative international stocks while handling Yahoo's cookie/crumb mechanism without a manually maintained personal Yahoo cookie?

A negative result is a valid and useful outcome.

Do not work around fundamental incompatibilities merely to make the spike appear successful.

---

## Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* this task completely

The existing legacy application accesses Yahoo Finance using a manually maintained Yahoo cookie and crumb.

The desired new architecture should avoid this manual cookie maintenance if `yahoo-finance2` can reliably handle the Yahoo authentication/session mechanism itself.

Yahoo Finance is an unofficial and potentially unstable dependency and must remain isolated from application business logic.

---

## Hypothesis

The hypothesis to test is:

> `yahoo-finance2` works in the Cloudflare Workers-compatible SvelteKit server environment, handles Yahoo cookie/crumb acquisition without a manually supplied personal Yahoo cookie, supports batch quote retrieval, and returns the fields required by Watchlist for representative international home-exchange symbols.

---

## Required Market Data

Watchlist currently requires the following Yahoo data:

```text
symbol
longName
regularMarketPrice
currency
trailingAnnualDividendRate
marketCap
```

The spike must determine whether these fields can be retrieved with sufficient consistency for the selected test symbols.

Do not assume every field is populated for every stock.

Document missing or unexpected values.

---

## Representative Symbols

The test universe must include the following known symbols:

```text
LISP.SW
HEXA-B.ST
TOM.OL
```

These are important because the legacy application contains Yahoo-specific dividend corrections for them.

Additionally select representative symbols covering at least:

* a US exchange;
* Germany / XETRA or Frankfurt;
* the United Kingdom, preferably a stock reported by Yahoo using `GBp`;
* India, preferably a stock reported using `INR`;
* Switzerland;
* Scandinavia.

Reuse the required symbols above where they already satisfy a market requirement.

Aim for approximately 6–10 symbols total.

Document the final test universe and the reason each symbol was selected.

Do not introduce these symbols as production configuration.

They exist only for the spike.

---

## Requirements

### 1. Install yahoo-finance2

Add the current stable `yahoo-finance2` package using the package manager already used by the project.

Do not add alternative Yahoo Finance libraries as part of the initial experiment.

Record the exact package version tested.

---

### 2. Keep Spike Code Isolated

Keep experimental code clearly isolated from future production application code.

Do not introduce a complete market-data architecture as part of this task.

A small experimental server-side module, development endpoint, script, or test harness is acceptable.

The implementation must never execute Yahoo requests from browser/client-side code.

Do not add Yahoo-specific logic to Svelte components.

---

### 3. Cloudflare Runtime Compatibility

The primary question is whether the library works in the runtime architecture selected for this project.

Verify compatibility with:

* SvelteKit server-side execution;
* the Cloudflare Workers target;
* the project's production build.

Pay attention to dependencies on Node.js APIs that may not exist or behave differently in Cloudflare Workers.

A successful local Node.js-only execution is NOT sufficient evidence of compatibility.

Document any compatibility flags, runtime configuration, polyfills, or Node compatibility settings required.

Avoid adding compatibility workarounds unless they are small, documented, and appropriate for production use.

---

### 4. Cookie and Crumb Handling

Determine whether `yahoo-finance2` can acquire and maintain the Yahoo cookie/crumb information it requires without using the personal cookie from the legacy application.

The spike MUST NOT:

* copy the legacy Yahoo cookie into the repository;
* request the user's personal Yahoo cookie unless the automatic mechanism has first been demonstrated to be impossible;
* commit cookies, crumbs, session tokens, or similar values;
* expose such values to browser code;
* print complete sensitive cookie/session values into committed files.

Document:

* whether cookie acquisition is automatic;
* whether crumb acquisition is automatic;
* whether repeated requests continue to work;
* whether a new library/client instance changes the behavior;
* any observed expiration or session-related behavior that can reasonably be tested during the spike.

---

### 5. Single Quote Retrieval

Verify retrieval for individual representative symbols.

For each test symbol, inspect the required Watchlist fields:

```text
symbol
longName
regularMarketPrice
currency
trailingAnnualDividendRate
marketCap
```

Record whether each required field is:

* available;
* missing;
* unexpectedly typed;
* represented using an unexpected unit or currency.

Do not treat an optional/missing dividend as an automatic provider failure if the company legitimately has no dividend.

---

### 6. Batch Quote Retrieval

Verify that multiple symbols can be requested efficiently.

The desired application behavior is to load the symbols of the current watchlist as a batch when possible.

Determine:

* whether `yahoo-finance2` supports the required batch operation;
* what API/module is used;
* what result structure is returned;
* how partial results are represented;
* what happens when one requested symbol is invalid.

Include at least one deliberately invalid/nonexistent symbol in a batch experiment.

The spike should establish whether one invalid symbol prevents successful symbols from being returned.

---

### 7. International Market Behaviour

Explicitly inspect international results.

Particular attention must be paid to:

#### GBp

Determine whether Yahoo reports the selected UK stock currency as:

```text
GBp
```

and inspect how:

```text
regularMarketPrice
trailingAnnualDividendRate
marketCap
```

are represented.

Do not implement the production GBp normalization yet.

Document the observed units.

#### INR

Inspect an Indian stock and document the relationship between:

```text
regularMarketPrice
trailingAnnualDividendRate
currency
```

This is relevant because the legacy implementation applies a Yahoo-specific dividend correction for INR.

#### Known Dividend Exceptions

Inspect:

```text
LISP.SW
HEXA-B.ST
TOM.OL
```

Record the raw Yahoo values for:

```text
regularMarketPrice
currency
trailingAnnualDividendRate
```

The purpose is to provide evidence for the later dividend-normalization implementation.

Do not implement those corrections in production code during this spike.

---

### 8. Error Behaviour

Observe and document behavior for at least:

* an invalid symbol;
* a batch containing valid and invalid symbols;
* provider/network failure if it can be simulated safely without introducing elaborate infrastructure.

Determine whether errors can later be mapped cleanly into the application's planned:

* partial-success behavior;
* provider-unavailable behavior.

Do not build the final error-mapping implementation yet.

---

### 9. No Business Logic

Do NOT implement:

* target prices;
* target-price distance;
* dividend yield;
* dividend corrections;
* market-cap conversion;
* Frankfurter integration;
* savings allocation;
* watchlist persistence;
* Cloudflare KV;
* authentication;
* production Watchlist APIs;
* UI for Yahoo data.

This task is solely about validating the market-data integration.

---

## Spike Report

Create:

```text
docs/spikes/002-yahoo-finance.md
```

The report is a required deliverable.

It must contain at least:

### Environment

Document:

* Node.js version;
* Svelte version;
* SvelteKit version;
* Cloudflare adapter/runtime configuration relevant to the experiment;
* `yahoo-finance2` version.

### Test Universe

Provide a table containing:

```text
Symbol | Market | Currency | Reason selected
```

### Required Field Results

Provide a concise table showing whether the required fields were successfully obtained for each symbol.

Do not dump complete Yahoo response objects into the report.

### Cookie / Crumb Findings

Document how `yahoo-finance2` handled Yahoo session requirements and whether manual credentials were necessary.

### Batch Findings

Document batch-query behavior and invalid-symbol behavior.

### Cloudflare Compatibility

Clearly distinguish:

```text
works in local Node.js
```

from:

```text
works in the Cloudflare Workers-compatible runtime
```

State exactly what was actually verified.

### Problems / Risks

Document observed issues, including intermittent or provider-specific behavior.

### Recommendation

Finish the report with exactly one of these recommendations:

```text
ACCEPT yahoo-finance2
```

```text
ACCEPT yahoo-finance2 WITH CONDITIONS
```

```text
REJECT yahoo-finance2
```

Explain the reasoning.

If the recommendation includes conditions, list them explicitly.

---

## Temporary Spike Code

Experimental code may be retained if it is useful for reproducibility, but it must be clearly identified as spike/test code.

If the experimental code has no value after the report is written, remove it before completing the task.

Do not leave:

* temporary UI;
* debug endpoints intended only for manual experimentation;
* dumped Yahoo responses;
* cookies or crumbs;
* unnecessary dependencies.

The `yahoo-finance2` dependency may remain installed because the spike is specifically evaluating it, provided the final recommendation is ACCEPT or ACCEPT WITH CONDITIONS.

If the final recommendation is REJECT, remove the dependency unless retaining it is necessary to reproduce the documented failure and there is a clear reason to do so.

---

## Acceptance Criteria

The task is complete when all of the following are true:

1. The current stable `yahoo-finance2` version has been evaluated.
2. The required Watchlist fields have been tested.
3. Representative international home-exchange symbols have been tested.
4. `LISP.SW`, `HEXA-B.ST`, and `TOM.OL` have been inspected.
5. A UK/GBp stock has been inspected.
6. An Indian/INR stock has been inspected.
7. Single-symbol retrieval has been evaluated.
8. Batch retrieval has been evaluated.
9. Invalid-symbol behavior has been evaluated.
10. Automatic cookie/crumb behavior has been investigated.
11. No personal Yahoo cookie has been committed or exposed.
12. Cloudflare Workers compatibility has been evaluated rather than assuming Node.js compatibility is sufficient.
13. `docs/spikes/002-yahoo-finance.md` contains the required findings.
14. The report ends with a clear ACCEPT, ACCEPT WITH CONDITIONS, or REJECT recommendation.
15. No Watchlist business functionality has been implemented.
16. Existing project checks still pass.
17. No credentials, cookies, crumbs, or session material are present in Git-tracked files.

---

## Verification

Before completing the task, run:

```bash
npm run check
npm run test
npm run lint
npm run build
```

Also run the relevant Yahoo spike experiments.

Do not claim that Cloudflare runtime execution was verified unless the experiment actually executed in a Cloudflare Workers-compatible runtime.

A successful Cloudflare-target production build alone proves build compatibility, not runtime compatibility.

---

## Important Decision Rule

Do not optimize for a positive result.

If `yahoo-finance2`:

* requires fragile workarounds;
* cannot handle Yahoo sessions reliably;
* fundamentally depends on unsupported runtime functionality;
* works only under local Node.js but not the intended Cloudflare runtime;

then recommend rejecting it.

The purpose of this spike is to reduce architectural risk, not to justify a previously preferred library.

---

## Completion Report

When finished, report:

1. the `yahoo-finance2` version tested;
2. the representative symbols tested;
3. whether cookie/crumb handling was automatic;
4. whether batch requests worked;
5. whether partial results/errors can support the planned application behavior;
6. whether Cloudflare runtime execution was actually verified;
7. the recommendation from `docs/spikes/002-yahoo-finance.md`;
8. files added, changed, or removed;
9. results of all project verification commands;
10. unresolved risks or assumptions.

Do not proceed to production market-data implementation or any subsequent task.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
