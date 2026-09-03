# TASK-003: Core Investment Domain Logic

## Status

Ready

## Goal

Implement the first infrastructure-independent business logic of the Watchlist application.

This task establishes the core domain calculations for:

* target-price distance;
* investment factor;
* savings allocation;
* invested total.

All calculations must be implemented as pure, server-owned TypeScript logic with comprehensive unit tests.

This task must not introduce persistence, external providers, authentication, HTTP APIs, or UI functionality.

---

## Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* this task completely

Also consult:

* `docs/spikes/002-yahoo-finance.md`

only if needed for general project context. Yahoo-specific findings are not part of the implementation in this task.

The architecture requires business logic to live on the server and to remain independently testable without Cloudflare or network access.

---

## Scope

Implement only the following business concepts:

```text
Target Price
     |
     v
Distance to Target
     |
     v
Investment Factor
     |
     +----------------+
                      |
All stock factors     |
     |                |
     v                |
Factor Sum            |
     |                |
     +--------+-------+
              |
              v
      Savings Allocation
              |
              v
          Invested
```

Do not implement dividend or currency-related calculations in this task.

---

## 1. Domain Types

Introduce only the minimal application-owned types required by this task.

Do not reuse Yahoo Finance response types as domain types.

The implementation should make a clear distinction between externally supplied market information and application-owned values.

Do not create speculative domain entities or abstractions for functionality that is not required by this task.

Type and file names may follow existing project conventions.

---

## 2. Target Price Distance

Implement the business calculation:

```text
distanceToTarget =
    regularMarketPrice / targetPrice - 1
```

The behavior must preserve the established application semantics.

Conceptually:

```ts
function calculateTargetPriceDistance(
  regularMarketPrice: number | undefined,
  targetPrice: number | undefined
): number {
  if (!targetPrice || !regularMarketPrice || targetPrice === 0) {
    return 0;
  }

  return regularMarketPrice / targetPrice - 1;
}
```

### Expected Examples

```text
price = 80
target = 100
distance = -0.20
```

```text
price = 100
target = 100
distance = 0
```

```text
price = 120
target = 100
distance = 0.20
```

### Missing Values

The result is `0` when a usable calculation cannot be performed according to the established semantics.

At minimum test:

* missing market price;
* missing target price;
* target price `0`;
* market price `0`.

Do not introduce client/display percentage formatting into this calculation.

The function returns the decimal ratio, not a formatted percentage.

---

## 3. Investment Factor

Implement:

```text
factor =
    1 / (1 + distanceToTarget)
```

while preserving the established legacy semantics.

Conceptually:

```ts
function calculateFactor(
  targetPriceDistance: number | undefined
): number {
  if (!targetPriceDistance) {
    return 0;
  }

  return 1 / (1 + targetPriceDistance);
}
```

This means that:

```text
undefined -> 0
0         -> 0
```

The fact that an exact target-price distance of `0` results in factor `0` is intentional for the current implementation and MUST NOT be "corrected" as part of this task.

Test positive and negative target-price distances.

---

## 4. Factor Sum

The investment calculation uses the sum of the factors of all stocks participating in the current allocation.

Implement this without coupling the calculation to UI filtering.

The calculation must operate on the complete supplied stock/allocation input.

Filtering is a client-side presentation concern and MUST NOT affect factor summation.

The implementation should handle zero factors safely.

---

## 5. Savings Allocation

Implement proportional allocation of an available total-savings amount across all supplied stocks.

For each stock:

```text
savingsAmount =
    floor((factor / factorSum) * totalSavings)
```

A stock receives `0` when it cannot participate in the allocation according to the established factor/factor-sum semantics.

The allocation is always rounded down to whole Euro amounts.

Do not redistribute the rounding remainder.

### Example

For:

```text
totalSavings = 1000

factors:
Stock A = 1
Stock B = 2
Stock C = 1
```

the result is:

```text
Stock A = 250
Stock B = 500
Stock C = 250
```

### Rounding Example

If proportional allocation mathematically produces:

```text
33.33
33.33
33.33
```

the persisted/calculated savings amounts are:

```text
33
33
33
```

and the remaining Euro is intentionally not redistributed.

---

## 6. Invested Total

Implement:

```text
invested =
    sum(savingsAmount)
```

The result is the actual amount allocated after individual amounts have been rounded down.

Therefore:

```text
invested <= totalSavings
```

The implementation MUST NOT assume equality.

---

## 7. Total Savings Validation

`totalSavings` represents an amount in whole Euros.

Business logic must not silently produce nonsensical allocations for invalid input.

Define and test reasonable validation for the server-side domain/application boundary.

At minimum consider:

* zero;
* negative amounts;
* fractional amounts;
* non-finite numbers.

Do not implement locale-specific parsing here.

For example, converting UI input such as:

```text
"1.000,50"
```

into a number is a client/input-boundary concern and is not part of this task.

Document any validation decision that is not already explicitly defined in `ARCHITECTURE.md`.

Do not silently change an invalid amount into another amount.

---

## 8. Numeric Robustness

Business functions must behave predictably for numeric edge cases.

Do not allow an allocation result containing:

```text
NaN
Infinity
-Infinity
```

to silently propagate as a valid domain result.

If an input combination makes the formula mathematically unusable, handle it explicitly and test the chosen behavior.

Do not introduce arbitrary financial rounding libraries. Native number operations are sufficient for the currently defined business rules.

---

## 9. Pure Functions

The calculations in this task should be pure wherever practical.

They must not depend on:

* Svelte state;
* browser APIs;
* HTTP requests;
* Cloudflare Workers;
* Cloudflare KV;
* Cloudflare Access;
* Yahoo Finance;
* `yahoo-finance2`;
* Frankfurter;
* environment variables;
* current date/time;
* network access.

Given the same input, a calculation must produce the same output.

---

## 10. Server Ownership

These calculations belong to the server-side application/domain implementation.

They MUST NOT be placed in:

* `.svelte` components;
* client-side Svelte stores;
* browser-only modules.

Use the SvelteKit server-side module conventions where appropriate so that business logic cannot accidentally be imported into client-side code.

The exact directory structure should follow current project conventions and `ARCHITECTURE.md`.

Avoid unnecessary architectural layers.

---

## 11. Unit Tests

Add comprehensive unit tests for all business logic introduced by this task.

At minimum cover:

### Target Price Distance

* price below target;
* price equal to target;
* price above target;
* missing price;
* missing target;
* zero price;
* zero target.

### Factor

* positive distance;
* negative distance;
* zero distance;
* missing distance.

### Allocation

* multiple participating stocks;
* different factors;
* zero factors;
* all factors zero;
* empty stock collection;
* rounding remainder;
* allocation where some stocks receive zero;
* valid whole-Euro total savings.

### Invested

* exact allocation;
* allocation with rounding remainder;
* empty allocation.

### Invalid Numeric Inputs

Cover the validation and numeric-robustness decisions made in this task.

Tests must assert actual expected numeric results rather than merely checking that a function returned a value.

---

## 12. Test Independence

All tests introduced by this task must run without:

* network access;
* Cloudflare credentials;
* Yahoo Finance;
* Frankfurter;
* KV;
* authentication.

Do not mock infrastructure that the domain calculations do not need in the first place.

---

## Non-Goals

Do NOT implement:

* Yahoo Finance integration;
* Yahoo response mapping;
* dividend normalization;
* dividend yield;
* currency normalization;
* GBp handling;
* Frankfurter integration;
* exchange-rate conversion;
* market-cap conversion;
* Watchlist CRUD;
* target-price persistence;
* Cloudflare KV;
* Cloudflare Access;
* authentication;
* REST endpoints;
* Svelte UI;
* stock table;
* filtering;
* sorting;
* automatic savings recalculation;
* savings persistence;
* E2E tests.

Do not refactor the Yahoo spike as part of this task.

---

## Acceptance Criteria

The task is complete when all of the following are true:

1. Target-price distance is implemented as server-owned business logic.
2. The calculation preserves the agreed legacy semantics.
3. Investment-factor calculation is implemented.
4. An exact distance of `0` produces factor `0`.
5. Factor summation is implemented safely.
6. Savings allocation distributes total savings proportionally by factor.
7. Individual savings amounts are rounded down to whole Euros.
8. Rounding remainders are not redistributed.
9. Invested total is calculated from the resulting savings amounts.
10. Investment allocation operates on all supplied stocks and has no concept of UI filtering.
11. Invalid total-savings input is handled explicitly.
12. Invalid numeric calculations do not silently produce valid-looking `NaN` or infinite results.
13. Business calculations do not depend on infrastructure or external providers.
14. Business calculations are not implemented in client-side/Svelte component code.
15. Comprehensive unit tests cover normal cases, edge cases, and established special semantics.
16. Tests require no network or Cloudflare environment.
17. No out-of-scope business functionality has been implemented.
18. Existing project checks still pass.
19. No new production dependency has been introduced unless strictly necessary and explicitly justified.

---

## Verification

Before completing the task, execute:

```bash
npm run check
npm run test
npm run lint
npm run build
```

All newly introduced business tests must pass.

Do not report a command as successful unless it was actually executed successfully.

---

## Documentation

If implementation details require a business decision not already defined by `ARCHITECTURE.md`, document the decision in the completion report.

Do not modify architectural decisions merely to simplify implementation.

If a genuine conflict with `ARCHITECTURE.md` is discovered, stop and report the conflict rather than silently changing the architecture.

---

## Completion Report

When finished, report:

1. files added or changed;
2. domain/business functions introduced;
3. domain types introduced;
4. total-savings validation behavior;
5. handling of mathematically invalid/non-finite calculations;
6. unit-test scenarios added;
7. results of `check`, `test`, `lint`, and `build`;
8. any assumptions or architectural questions discovered;
9. any deviations from this task or `ARCHITECTURE.md`.

Do not proceed to dividend calculations, persistence, REST APIs, authentication, or UI implementation.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
