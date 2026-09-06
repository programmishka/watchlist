# TASK-031: Nullable Target Price Distance Semantics

## Status

Ready

## Goal

Correct the semantic representation of `distanceToTarget`.

A numeric Target Price distance must exist **only when the distance can actually be calculated from valid market-price and Target-Price data**.

The current application historically uses `0` in some missing/invalid-data cases.

That is semantically ambiguous because:

```text
distanceToTarget = 0
```

can currently mean either:

```text
current market price exactly equals Target Price
```

or:

```text
distance could not be calculated
```

These are different business states.

V2 establishes the rule:

> `0` is a real calculated Target Price distance and means that the current market price exactly equals the Target Price.

> Missing or invalid inputs produce no Target Price distance.

Conceptually:

```text
valid price + valid Target Price
        |
        v
calculated numeric distance
        |
        +-- may legitimately be 0

missing/invalid price
        |
        v
distanceToTarget = undefined

missing/invalid Target Price
        |
        v
distanceToTarget = undefined
```

The UI displays an unavailable distance as:

```text
—
```

Investment allocation behavior must remain economically unchanged:

```text
distanceToTarget = undefined
        |
        v
investment factor = 0
        |
        v
stock receives no savings allocation
```

This task fixes the semantic model without changing the investment-allocation formula for stocks with calculable distances.

---

# Production Observation

The Product Owner observed the following V2 issue:

```text
market price:
—

Target Price:
1

Distance to Target:
2,673.74 %
```

A stock without a valid market price must never display a calculated Target Price distance.

Expected behavior:

```text
Price:              —
Target Price:       1
Distance to Target: —
```

If investment allocation is calculated:

```text
factor:        0
savingsAmount: 0 €
```

The exact erroneous percentage is not itself a business rule.

The regression requirement is:

> Missing/invalid market price must never produce a numeric Target Price distance.

---

# Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* TASK-003;
* TASK-006;
* TASK-011;
* TASK-014;
* TASK-015;
* TASK-021;
* TASK-024;
* current Target Price mutation/composition flow;
* current investment-allocation flow;
* this task completely.

Inspect the actual implementation before changing types.

Do not assume every historical description still matches the current code.

---

# Historical Semantics

## 1. TASK-003

TASK-003 introduced the pure Target Price distance calculation and historically used:

```text
0
```

for missing/zero inputs and defensive invalid-result handling.

That decision was useful for making downstream investment allocation robust, but it conflated:

```text
real zero distance
```

with:

```text
distance unavailable
```

TASK-031 explicitly supersedes that missing-data aspect.

---

## 2. TASK-014

TASK-014 relied on the composed Watchlist representation where missing price/Target Price effectively became:

```text
distanceToTarget = 0
```

and therefore:

```text
investment factor = 0
```

The desired allocation outcome remains correct.

Only the semantic representation changes.

New model:

```text
distanceToTarget = undefined
        ↓
investment-allocation layer
        ↓
factor = 0
```

---

# Domain Semantics

## 3. Distance Return Type

Change the Target Price distance calculation so its conceptual return type is:

```ts
number | undefined
```

rather than always:

```ts
number
```

Use the actual existing type aliases/module structure where appropriate.

---

## 4. Valid Distance

A numeric distance may be returned only when:

```text
regularMarketPrice
```

is:

* present;
* finite;
* strictly greater than zero;

and:

```text
targetPrice
```

is:

* present;
* finite;
* strictly greater than zero.

---

## 5. Missing Market Price

For:

```text
regularMarketPrice = undefined
targetPrice = 1
```

return:

```text
undefined
```

Never:

```text
0
```

and never another calculated numeric value.

---

## 6. Missing Target Price

For:

```text
regularMarketPrice = 100
targetPrice = undefined
```

return:

```text
undefined
```

---

## 7. Zero Market Price

For:

```text
regularMarketPrice = 0
```

return:

```text
undefined
```

A zero market price is not a valid input for this calculation.

---

## 8. Zero Target Price

For:

```text
targetPrice = 0
```

return:

```text
undefined
```

Target Prices are already required to be positive by the Target Price application service/persistence model.

Keep the domain calculation defensive.

---

## 9. Negative Inputs

Negative market prices or Target Prices return:

```text
undefined
```

Do not calculate a distance from invalid financial inputs.

---

## 10. Non-Finite Inputs

For either input:

```text
NaN
Infinity
-Infinity
```

return:

```text
undefined
```

---

## 11. Non-Finite Result

If mathematically valid-looking finite inputs nevertheless produce a non-finite result because of numeric overflow/underflow behavior, return:

```text
undefined
```

Do not expose:

```text
NaN
Infinity
-Infinity
```

as a Target Price distance.

---

# Real Zero Distance

## 12. Equal Price and Target

For:

```text
regularMarketPrice = 100
targetPrice = 100
```

return exactly:

```text
0
```

This is a real business value.

It MUST remain distinguishable from `undefined`.

---

## 13. Zero Display

A real calculated:

```text
distanceToTarget = 0
```

must continue to display as:

```text
0%
```

or the existing locale-equivalent formatting.

Do not display `—` for real zero.

---

# Existing Formula

## 14. Preserve Formula

For valid inputs, preserve the existing Target Price distance formula exactly.

Do not redefine what positive or negative distance means.

Do not reverse signs.

Do not change percentage semantics.

Only invalid/missing-data behavior changes.

---

## 15. Representative Existing Cases

Existing valid calculation tests for:

* price above Target Price;
* price below Target Price;
* price equal to Target Price;

must continue to produce the same numeric values as before.

---

# Watchlist Composition

## 16. Composed Stock Type

Ensure the composed Watchlist stock model represents:

```ts
distanceToTarget?: number
```

or:

```ts
distanceToTarget: number | undefined
```

consistently.

Do not use `0` as a missing-data sentinel.

---

## 17. Missing Market Data

If a stock has:

```text
price = undefined
```

then composed:

```text
distanceToTarget = undefined
```

even when a valid Target Price exists.

This directly covers the production observation.

---

## 18. Missing Target Price

If a stock has a valid market price but no Target Price:

```text
distanceToTarget = undefined
```

---

## 19. Valid Equal Values

If:

```text
price === targetPrice
```

then composed:

```text
distanceToTarget = 0
```

---

## 20. Partial Market Data

Preserve the existing partial-market-data behavior.

A stock may remain visible even when its current price is unavailable.

Its row should conceptually be:

```text
Symbol:             XYZ
Price:              —
Target Price:       1
Distance to Target: —
```

Do not remove the stock from the composed Watchlist merely because distance is unavailable.

---

# Target Price Mutation

## 21. Target Price Save With Valid Market Price

When a Target Price is saved and market data is available:

```text
Target Price save
        ↓
market price available
        ↓
distance recalculated
        ↓
numeric distance returned
```

Preserve existing behavior.

---

## 22. Target Price Save With Missing Market Price

When:

```text
market price = undefined
```

and a valid Target Price is successfully persisted:

```text
targetPrice = persisted value
distanceToTarget = undefined
```

The persistence operation succeeds.

Do not invent a distance.

---

## 23. Market Data Unavailable After Save

Preserve TASK-021's partial-success semantics:

```text
Target Price persisted
+
market data unavailable
        ↓
successful Target Price mutation
+
distanceToTarget = undefined
+
warning
```

Do not convert this into a failed Target Price save.

---

# Investment Factor

## 24. Factor Input Semantics

The investment-allocation layer must explicitly support:

```text
distanceToTarget = undefined
```

as:

```text
cannot participate in allocation
```

Result:

```text
factor = 0
```

---

## 25. Real Zero Distance

Preserve the existing business rule for:

```text
distanceToTarget = 0
```

according to the current `calculateInvestmentFactor()` formula.

Do not conflate this with `undefined`.

This is critical.

If the existing formula gives factor `0` for a real zero distance, preserve that.

If it gives another value according to the established architecture, preserve that instead.

Do not change the formula in this task.

---

## 26. Missing Distance

For:

```text
distanceToTarget = undefined
```

the allocation service must produce:

```text
factor = 0
savingsAmount = 0
```

without:

```text
NaN
Infinity
```

---

## 27. Other Stocks Still Participate

A stock with unavailable distance must not prevent valid stocks from receiving their normal allocation.

Example:

```text
AAPL
distance = valid
factor > 0

UNKNOWN
distance = undefined
factor = 0
```

Allocation proceeds using the participating stock(s).

---

# Domain API Design

## 28. Avoid Reintroducing Sentinel Conversion Too Early

Do not immediately convert:

```text
undefined
```

back to:

```text
0
```

inside Watchlist composition.

The semantic distinction must survive at least through:

```text
server composed Watchlist
REST response
client model
UI
investment-allocation composition
```

---

## 29. Allocation Boundary Conversion

If the existing pure:

```text
calculateInvestmentFactor()
```

function is best kept as a numeric-only formula, the application layer may explicitly map:

```text
undefined distance
→ factor 0
```

before calling it.

Alternatively, the domain function may accept `undefined` if that produces the clearer contract.

Choose the smallest design that preserves the semantic distinction.

Do not modify the mathematical formula for valid numeric distances.

---

# REST API

## 30. JSON Representation

An unavailable Target Price distance should be represented consistently with the existing API serialization conventions.

Prefer omission/`undefined` behavior already used for optional stock fields.

Do not serialize:

```json
{
  "distanceToTarget": 0
}
```

for unavailable distance.

---

## 31. Real Zero

A real zero distance must serialize as:

```json
{
  "distanceToTarget": 0
}
```

It must not disappear due to truthiness checks.

---

# Client Types

## 32. Client Model

Ensure the client type remains/changes to:

```ts
distanceToTarget: number | undefined
```

or optional equivalent.

TASK-021 already widened this type in at least one client path; inspect the current code and remove any remaining assumptions that it is always numeric.

---

## 33. No Client Calculation

The browser must not calculate Target Price distance.

It only displays the server-provided value.

Do not introduce:

```text
(price / targetPrice)
```

or equivalent Target Price formulas into client code.

---

# UI

## 34. Missing Distance Display

For:

```text
distanceToTarget = undefined
```

display:

```text
—
```

using the existing missing-value placeholder.

---

## 35. Real Zero Display

For:

```text
distanceToTarget = 0
```

display:

```text
0%
```

or locale equivalent.

Do not use truthiness logic such as:

```ts
distanceToTarget ? ... : '—'
```

because that would incorrectly hide zero.

---

## 36. Valid Positive/Negative Distance

Existing positive and negative percentage formatting remains unchanged.

---

# Sorting

## 37. Missing Distance Sorting

Preserve TASK-023 sorting semantics:

```text
missing numeric values
→ always last
```

in both ascending and descending sorting.

An unavailable distance now genuinely participates in this rule as a missing value.

---

## 38. Real Zero Sorting

A real:

```text
0
```

must sort numerically.

It is not missing.

---

# Filtering

## 39. No Filtering Change

Company-name filtering remains unrelated to Target Price distance availability.

Do not change filter semantics.

---

# Allocation UI

## 40. Missing Distance Before Allocation

A row with unavailable distance displays:

```text
Distance to Target: —
```

---

## 41. After Allocation

After an explicit allocation calculation, the same row may display:

```text
Distance to Target: —
Savings Amount:     0 €
```

This is correct and intentional.

Do not display `—` for a calculated zero Savings Amount.

---

# Allocation Invalidation

## 42. Existing Invalidation Rules

Preserve TASK-024:

Successful Target Price mutation invalidates an existing allocation.

Therefore:

```text
existing allocation
        ↓
Target Price successfully saved
        ↓
distance unavailable
        ↓
allocation cleared
```

No automatic recalculation occurs.

---

# Unit Tests — Distance Domain

## 43. Missing Price

Test:

```text
price = undefined
target = 1
```

Expected:

```text
undefined
```

This is the primary regression case.

---

## 44. Missing Target

Test:

```text
price = 100
target = undefined
```

Expected:

```text
undefined
```

---

## 45. Zero Price

Expected:

```text
undefined
```

---

## 46. Zero Target

Expected:

```text
undefined
```

---

## 47. Negative Price

Expected:

```text
undefined
```

---

## 48. Negative Target

Expected:

```text
undefined
```

---

## 49. Non-Finite Price

Cover:

```text
NaN
Infinity
-Infinity
```

Expected:

```text
undefined
```

---

## 50. Non-Finite Target

Cover:

```text
NaN
Infinity
-Infinity
```

Expected:

```text
undefined
```

---

## 51. Overflow Result

Preserve/add a numeric robustness case where the calculation would otherwise become non-finite.

Expected:

```text
undefined
```

rather than `0`.

---

## 52. Equal Price/Target

Test:

```text
100 / 100
```

according to the existing formula.

Expected:

```text
0
```

---

## 53. Valid Existing Cases

Preserve existing exact expectations for above/below Target Price.

---

# Unit Tests — Watchlist Composition

## 54. Missing Price + Valid Target

Compose a stock with:

```text
price = undefined
targetPrice = 1
```

Expected:

```text
targetPrice = 1
distanceToTarget = undefined
```

---

## 55. Valid Price + Missing Target

Expected:

```text
distanceToTarget = undefined
```

---

## 56. Equal Price/Target

Expected:

```text
distanceToTarget = 0
```

---

## 57. Partial Market Data

Verify the stock remains in the composed Watchlist despite unavailable distance.

---

# Unit Tests — Target Price Mutation

## 58. Save With Missing Price

Persist a valid Target Price while the provider returns no usable market price.

Expected:

* Target Price save succeeds;
* returned Target Price is preserved;
* distance is unavailable;
* no fabricated numeric percentage.

---

## 59. Provider-Unavailable Partial Success

Preserve existing partial-success behavior:

```text
Target Price persisted
distance unavailable
warning present
```

---

# Unit Tests — Allocation

## 60. Undefined Distance

Given a composed stock with:

```text
distanceToTarget = undefined
```

expected:

```text
factor = 0
savingsAmount = 0
```

---

## 61. Mixed Valid/Undefined

Given:

```text
Stock A
distance valid

Stock B
distance undefined
```

verify:

* Stock A participates normally;
* Stock B factor is 0;
* Stock B savings is 0;
* invested remains finite;
* no allocation error occurs.

---

## 62. Real Zero Distance

Explicitly verify the allocation behavior for:

```text
distanceToTarget = 0
```

according to the existing formula.

This test must prove that `0` and `undefined` are separate input states even if they happen to produce the same factor under the current formula.

---

# Formatting Tests

## 63. Missing Percentage

Ensure existing percentage formatting displays:

```text
undefined
→ —
```

---

## 64. Zero Percentage

Ensure:

```text
0
→ 0%
```

not:

```text
—
```

---

# Sorting Tests

## 65. Missing Distance Last

Add/update sorting coverage so unavailable distance sorts last in:

```text
ascending
descending
```

---

## 66. Zero Is Numeric

Verify a real zero distance sorts among numeric values rather than with missing values.

---

# Playwright E2E

## 67. Permanent Coverage

Extend the most appropriate existing permanent E2E spec.

Prefer:

```text
target-price.spec.ts
```

and/or:

```text
watchlist-table.spec.ts
investment-allocation.spec.ts
```

according to the behavior being tested.

Do not create a new spec solely because this is a new task if existing feature specs are the natural home.

---

## 68. Missing Price Regression

Use deterministic API fixtures containing:

```text
price = undefined
targetPrice = 1
distanceToTarget = undefined
```

Verify the row displays:

```text
Price:              —
Target Price:       1
Distance to Target: —
```

There must be no numeric percentage.

---

## 69. Real Zero Distance

Use:

```text
price = 100
targetPrice = 100
distanceToTarget = 0
```

Verify:

```text
Distance to Target: 0%
```

---

## 70. Positive/Negative Distances

Preserve representative existing percentage rendering.

---

## 71. Target Price Save With Missing Price

Mock a successful Target Price mutation returning:

```text
targetPrice = 1
distanceToTarget = undefined
```

Verify:

* Target Price input shows the saved value;
* Distance shows `—`;
* operation is treated as successful.

---

## 72. Allocation With Missing Distance

Return/compose an allocation where a stock with unavailable distance receives:

```text
factor = 0
savingsAmount = 0
```

Verify UI shows:

```text
Distance to Target: —
Savings Amount: 0 €
```

or locale-equivalent currency formatting.

---

## 73. Sorting Missing Distance

Verify sorting by Distance to Target keeps missing distance last.

Do not duplicate unit coverage excessively; one browser-level regression scenario is sufficient if sorting is already comprehensively tested.

---

# Real Runtime Verification

## 74. Reproduce Original Scenario Where Practical

Using local deterministic/runtime data where possible, reproduce:

```text
Price = unavailable
Target Price = 1
```

and verify no numeric Target Price distance is produced.

Do not manipulate production market data to force Yahoo to omit a price.

A deterministic local/server test is sufficient if the real provider cannot reliably produce this state on demand.

---

# Architecture Documentation

## 75. Define Distance Availability

Update `ARCHITECTURE.md` with the V2 rule:

> Target Price distance is optional derived data. It exists only when both current market price and Target Price are valid positive finite values and the resulting calculation is finite.

---

## 76. Define Zero

Document:

> `distanceToTarget = 0` is a real calculated value meaning current market price equals Target Price. It is never used as a missing-data sentinel.

---

## 77. Define Missing

Document:

```text
missing/invalid price
OR
missing/invalid Target Price
OR
non-finite calculation
        ↓
distanceToTarget unavailable
```

The UI represents this as:

```text
—
```

---

## 78. Allocation Semantics

Document:

> An unavailable Target Price distance results in investment factor `0` and therefore no savings allocation for that stock, without preventing other valid stocks from participating.

---

## 79. Supersede Historical Semantics

Explicitly note that TASK-031 supersedes the earlier TASK-003/TASK-014 missing-data convention where unavailable distance could be represented as `0`.

Do not rewrite historical task files as though they had always used nullable distance semantics.

---

# Historical Task Notes

## 80. TASK-003

If task-history conventions permit, add a concise supersession note:

```text
TASK-031 later changed missing/invalid Target Price distance results
from numeric 0 to unavailable/undefined. Real calculated zero remains 0.
```

Keep status Done.

---

## 81. TASK-014

Where useful, add a concise note that TASK-031 preserves factor-0 allocation behavior for unavailable distances while changing their representation from `0` to `undefined`.

Keep status Done.

---

# README

## 82. Product Documentation

No README change is required unless the current README describes missing Target Price distance as zero.

If changed, keep the explanation product-oriented:

```text
Distance is shown only when current price and Target Price are available.
```

Do not expose internal `undefined` semantics unnecessarily in the product introduction.

---

# Non-Goals

Do NOT implement:

* a new Target Price formula;
* different investment-factor mathematics;
* automatic allocation recalculation;
* allocation persistence;
* new market-data provider behavior;
* retries for missing prices;
* synthetic/fallback market prices;
* Target Price deletion;
* UI redesign;
* new error codes;
* production-data migration;
* production deployment;
* unrelated V2 features.

Do not proceed to another V2 feature.

---

# Acceptance Criteria

The task is complete when all of the following are true:

1. Target Price distance can represent unavailable data.
2. Its conceptual type is `number | undefined`.
3. Missing market price produces unavailable distance.
4. Missing Target Price produces unavailable distance.
5. Zero market price produces unavailable distance.
6. Zero Target Price produces unavailable distance.
7. Negative market price produces unavailable distance.
8. Negative Target Price produces unavailable distance.
9. Non-finite market price produces unavailable distance.
10. Non-finite Target Price produces unavailable distance.
11. Non-finite calculation result produces unavailable distance.
12. Equal valid price and Target Price produces real `0`.
13. Existing valid positive/negative calculations remain unchanged.
14. `0` is never used as a missing-data sentinel.
15. Watchlist composition preserves unavailable distance.
16. Stock remains visible when distance is unavailable.
17. Missing price + valid Target Price never produces a numeric distance.
18. Target Price save may succeed with unavailable distance.
19. Partial-success Target Price behavior remains intact.
20. Client model supports unavailable distance.
21. REST representation does not fabricate zero.
22. Real zero survives serialization.
23. UI displays unavailable distance as `—`.
24. UI displays real zero as `0%`.
25. Positive/negative percentage formatting remains unchanged.
26. Sorting treats unavailable distance as missing.
27. Sorting treats zero as numeric.
28. Investment allocation explicitly handles unavailable distance.
29. Unavailable distance produces factor 0.
30. Unavailable distance produces savings amount 0.
31. Other valid stocks still participate normally.
32. Real zero and unavailable distance are separate tested states.
33. Investment formula for valid distances is unchanged.
34. No client-side Target Price formula is introduced.
35. Allocation invalidation behavior remains unchanged.
36. Primary production regression case has unit coverage.
37. Watchlist composition has missing-price coverage.
38. Target Price mutation has missing-price coverage.
39. Allocation has unavailable-distance coverage.
40. Formatting has missing-vs-zero coverage.
41. Sorting has missing-vs-zero coverage.
42. Permanent E2E covers missing-price display.
43. Permanent E2E covers real zero display.
44. Permanent E2E covers Target Price save with unavailable distance.
45. Permanent E2E covers allocation zero for unavailable distance.
46. Existing E2E behavior remains functional.
47. `ARCHITECTURE.md` documents nullable distance semantics.
48. Historical TASK-003/TASK-014 semantics are explicitly superseded where appropriate.
49. No provider behavior is changed.
50. No new error code is introduced.
51. Existing project checks pass.
52. No unnecessary dependency is introduced.
53. No production deployment occurs.

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

1. `price = undefined`, `targetPrice = 1` → unavailable distance;
2. valid equal price/Target Price → real zero;
3. missing Target Price → unavailable distance;
4. invalid/non-finite inputs → unavailable distance;
5. UI renders missing distance as `—`;
6. UI renders real zero as `0%`;
7. sorting keeps missing distance last;
8. allocation gives factor/savings 0 for unavailable distance;
9. other valid stocks still receive their normal allocation;
10. Target Price save with unavailable market price remains successful.

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
2. exact previous missing-distance behavior found in code;
3. final Target Price distance return type;
4. final valid-input rules;
5. missing-price behavior;
6. missing-Target-Price behavior;
7. invalid/non-finite behavior;
8. real-zero behavior;
9. confirmation valid formula is unchanged;
10. Watchlist composition changes;
11. Target Price mutation changes;
12. REST/client type changes;
13. UI missing-distance behavior;
14. UI real-zero behavior;
15. sorting behavior;
16. allocation handling for unavailable distance;
17. mixed valid/unavailable allocation result;
18. confirmation no client formula was introduced;
19. unit tests added/changed;
20. formatting/sorting tests added/changed;
21. Playwright scenarios added/changed;
22. reproduction/result for the original missing-price scenario;
23. `ARCHITECTURE.md` changes;
24. TASK-003/TASK-014 supersession notes;
25. README changes, if any;
26. results of `test`, `test:e2e`, `check`, `lint`, and `build`;
27. confirmation provider behavior was unchanged;
28. confirmation investment mathematics for valid distances was unchanged;
29. confirmation no production deployment occurred;
30. confirmation task status changed to Done;
31. assumptions or unresolved issues;
32. deviations from this task or `ARCHITECTURE.md`.

Do not proceed to another V2 feature.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
