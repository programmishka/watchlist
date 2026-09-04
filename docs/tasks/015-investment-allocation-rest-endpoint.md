# TASK-015: Investment Allocation REST Endpoint

## Status

Done

## Goal

Expose the existing `InvestmentAllocationService` through the authenticated JSON/HTTP API.

Implement:

```http
POST /api/watchlists/{watchlistId}/investment-allocation
Content-Type: application/json
```

Request:

```json
{
  "totalSavings": 1000
}
```

Response:

```json
{
  "totalSavings": 1000,
  "invested": 997,
  "allocations": [
    {
      "symbol": "AAPL",
      "factor": 1.23,
      "savingsAmount": 320
    }
  ]
}
```

This task extends the REST API established in TASK-013.

Reuse the existing:

* authentication handling;
* API error format;
* request-body helpers;
* error mapping;
* composition root;
* `InvestmentAllocationService`;
* domain validation.

Do not implement any Svelte UI in this task.

---

## Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* this task completely

Relevant existing production code includes:

* REST/API infrastructure from TASK-013;
* `createApplicationServices(...)`;
* `requireUserId(...)`;
* request-body validation helpers;
* API error mapping;
* `InvestmentAllocationService`;
* `InvestmentAllocation`;
* `StockAllocation`.

TASK-014 established the complete application use case.

This task only exposes that use case through HTTP and wires it into the existing production service graph.

---

## 1. Endpoint

Implement:

```http
POST /api/watchlists/{watchlistId}/investment-allocation
```

The endpoint calculates a fresh temporary allocation for the requested Watchlist.

It MUST NOT persist the allocation.

---

## 2. Authentication

The endpoint is authenticated exactly like the existing API routes.

Use:

```text
event.locals.user.id
```

as the trusted application user ID.

If no authenticated user exists, return the existing:

```text
401
UNAUTHENTICATED
```

API error.

Do not accept or inspect a client-provided user ID.

---

## 3. Request Body

The request body contains exactly the application input required by this use case:

```json
{
  "totalSavings": 1000
}
```

`totalSavings` must be a JSON number.

Do not accept:

```json
{
  "totalSavings": "1000"
}
```

Do not perform locale parsing in the REST layer.

The future UI will convert locale-specific input into a JSON number before sending the request.

---

## 4. HTTP-Level Total Savings Validation

Validate `totalSavings` before invoking `InvestmentAllocationService`.

A valid value must be:

* a number;
* finite;
* an integer;
* greater than or equal to `0`.

Valid:

```text
0
1
500
1000
```

Invalid:

```text
-1
12.5
NaN
Infinity
-Infinity
```

JSON itself cannot normally represent `NaN` or infinities, but the server-side validation helper should remain robust when called directly in tests.

### Reason

TASK-014 deliberately relies on the domain function for validation, which means an invalid value could otherwise trigger:

```text
WatchlistQueryService
    |
    +-- KV
    +-- Yahoo
    +-- Frankfurter
```

before the domain validation fails.

The HTTP boundary already owns external request validation, so reject obviously invalid `totalSavings` before any application/provider work occurs.

The existing domain validation remains authoritative and MUST NOT be removed.

---

## 5. Invalid Request

Malformed JSON, missing `totalSavings`, wrong type, or structurally invalid input must return:

```text
400 Bad Request
```

using the existing stable API error shape.

Use:

```text
INVALID_REQUEST
```

for malformed or structurally invalid HTTP input.

For a numeric `totalSavings` that violates the business input constraints, either:

* map the existing `InvalidTotalSavingsError` to a stable dedicated API code; or
* use `INVALID_REQUEST`;

choose the smallest design consistent with the existing TASK-013 API conventions.

If a new stable code is introduced, prefer:

```text
INVALID_TOTAL_SAVINGS
```

and document it in `ARCHITECTURE.md`.

Do not expose `InvalidTotalSavingsError` as the client-facing code.

---

## 6. Application Service Wiring

Add:

```text
InvestmentAllocationService
```

to the existing request-scoped application composition root.

Conceptually:

```text
WatchlistQueryService
        |
        v
InvestmentAllocationService
```

Reuse the same request-scoped `WatchlistQueryService` already constructed for composed Watchlist queries.

Do not construct a second independent:

* Watchlist repository;
* Target Price repository;
* Yahoo adapter;
* Frankfurter adapter;
* WatchlistQueryService

solely for investment allocation.

---

## 7. Route Thinness

The route/handler should perform only:

```text
authenticate
    |
validate request
    |
call InvestmentAllocationService
    |
map result to API DTO
    |
return JSON
```

Do not implement:

* factor formula;
* factor summation;
* savings allocation;
* rounding;
* invested calculation;
* target-distance calculation

inside the route.

---

## 8. Response DTO

Return an API-owned representation of the allocation.

Conceptually:

```ts
interface InvestmentAllocationResponse {
  totalSavings: number;
  invested: number;
  allocations: StockAllocationResponse[];
}

interface StockAllocationResponse {
  symbol: string;
  factor: number;
  savingsAmount: number;
}
```

The exact internal mapper/type organization may follow the API conventions established in TASK-013.

Do not expose application objects merely by accidental structural equivalence if an API mapping boundary is already the established project pattern.

---

## 9. Numeric Representation

All values remain normal JSON numbers.

Example:

```json
{
  "totalSavings": 1000,
  "invested": 997,
  "allocations": [
    {
      "symbol": "SAP.DE",
      "factor": 1.137,
      "savingsAmount": 427
    }
  ]
}
```

Do not return:

```text
"1.000 €"
"427 €"
"1,137"
```

Formatting belongs to the client.

---

## 10. Allocation Order

Preserve the order returned by:

```text
InvestmentAllocationService
```

which already corresponds to Watchlist order.

Do not sort allocations in the HTTP layer.

---

## 11. Empty Watchlist

For an existing empty Watchlist, return a successful response:

```json
{
  "totalSavings": 1000,
  "invested": 0,
  "allocations": []
}
```

Do not return an error merely because there are no stocks.

---

## 12. Zero Total Savings

For:

```json
{
  "totalSavings": 0
}
```

return a successful allocation.

Expected semantics:

```text
invested = 0
all savingsAmount = 0
```

Do not reject zero.

---

## 13. Missing Watchlist

If the requested Watchlist does not exist, reuse the existing API mapping:

```text
404
WATCHLIST_NOT_FOUND
```

Do not convert it to an empty allocation.

---

## 14. Market Data Failure

Investment allocation requires the current composed Watchlist.

If the market-data provider fails globally, reuse the existing mapping:

```text
503
MARKET_DATA_UNAVAILABLE
```

Do not return a partial or fabricated allocation.

---

## 15. FX Failure

A global FX-provider failure does not prevent investment allocation.

This behavior is already implemented below the HTTP layer:

```text
WatchlistQueryService
        |
        +-- FX warning
        |
        v
InvestmentAllocationService
        |
        v
valid allocation
```

Therefore the endpoint should return the successful allocation normally.

Do not turn an FX warning into an HTTP failure.

The allocation response does not need an FX warning because FX availability does not affect allocation correctness.

---

## 16. No Persistence

The endpoint MUST NOT persist:

* totalSavings;
* factor;
* savingsAmount;
* invested;
* allocation response.

Do not introduce a new KV key or repository.

Every POST performs a fresh calculation.

---

## 17. No Automatic Recalculation

This endpoint runs only when explicitly requested.

Do not invoke it automatically from:

* Target Price mutation;
* add-stock endpoint;
* remove-stock endpoint;
* Watchlist query;
* active-Watchlist selection.

Automatic recalculation remains a future improvement.

---

## 18. No Share Calculation

The endpoint returns Euro allocation amounts only.

Do not calculate:

* number of shares;
* fractional shares;
* order quantities;
* conversion into trading currencies.

---

## 19. API Error Mapping

Reuse the centralized TASK-013 error-mapping infrastructure.

Do not create route-local `instanceof` chains.

If `INVALID_TOTAL_SAVINGS` is introduced, add its mapping centrally.

Do not expose:

* stack traces;
* domain exception names;
* Yahoo errors;
* Frankfurter errors;
* KV errors.

---

## 20. Request Validation Reuse

Reuse existing TASK-013 request-body parsing/validation helpers where practical.

If the current helpers do not support the exact finite-integer constraint cleanly, add the smallest reusable helper rather than embedding ad hoc parsing logic in the route.

Do not introduce a schema-validation dependency solely for this endpoint.

---

## 21. Testing Strategy

Tests introduced by this task must not require:

* Cloudflare;
* KV;
* Access;
* Yahoo Finance;
* Frankfurter;
* network access.

Use the same handler/test seams established by TASK-013.

Do not reconstruct real external infrastructure merely to test HTTP behavior.

---

## 22. Required Success Test

Given:

```text
totalSavings = 300
```

and an application result such as:

```text
AAPL   -> factor 0.5 -> savings 50
SAP.DE -> factor 2.0 -> savings 200
GAW.L  -> factor 0.5 -> savings 50
```

verify:

```text
HTTP 200
```

and the exact JSON DTO.

Do not re-test the underlying factor formula extensively; TASK-014 owns those tests.

---

## 23. Required Authentication Test

Without:

```text
event.locals.user
```

verify:

```text
401
UNAUTHENTICATED
```

and verify the allocation service is not invoked.

---

## 24. Required User-ID Test

With:

```text
event.locals.user.id = "user-1"
```

verify the service receives:

```text
user-1
```

exactly.

A client-provided:

```json
{
  "userId": "user-2",
  "totalSavings": 1000
}
```

must not override the authenticated user.

If extra request fields are ignored by the existing API convention, verify ownership still uses `user-1`.

Do not introduce user-ID parsing from the body.

---

## 25. Required Malformed JSON Test

Malformed JSON must return:

```text
400
INVALID_REQUEST
```

using the existing API JSON error shape.

The service must not be invoked.

---

## 26. Required Missing Field Test

For:

```json
{}
```

verify:

```text
400
INVALID_REQUEST
```

and no service invocation.

---

## 27. Required Wrong-Type Test

For:

```json
{
  "totalSavings": "1000"
}
```

verify:

```text
400
INVALID_REQUEST
```

and no service invocation.

Do not coerce the string.

---

## 28. Required Invalid Numeric Tests

Verify rejection before service invocation for:

```text
-1
12.5
NaN
Infinity
-Infinity
```

Where values cannot be represented through real JSON, test the validation helper directly.

Verify no Watchlist query/provider call can occur because the application service is never invoked.

---

## 29. Required Zero Test

For:

```json
{
  "totalSavings": 0
}
```

verify successful HTTP response.

---

## 30. Required Empty Watchlist Test

Configure the application service to return:

```ts
{
  totalSavings: 1000,
  invested: 0,
  allocations: []
}
```

Verify this is returned as:

```text
HTTP 200
```

with the expected JSON body.

---

## 31. Required Missing Watchlist Test

Configure the service to throw:

```text
WatchlistNotFoundError
```

Verify existing centralized mapping:

```text
404
WATCHLIST_NOT_FOUND
```

---

## 32. Required Market Data Failure Test

Configure the service to throw:

```text
MarketDataProviderError
```

Verify:

```text
503
MARKET_DATA_UNAVAILABLE
```

using the existing error shape.

---

## 33. Required Domain Validation Safety Test

Although the HTTP layer performs early validation, the existing domain/application validation remains a second line of defense.

Do not remove or weaken:

```text
InvalidTotalSavingsError
```

from TASK-003/TASK-014.

If the application service still throws it despite HTTP validation, ensure it maps to an appropriate stable client error rather than `500 INTERNAL_ERROR`.

This prevents future non-HTTP callers from producing inconsistent API behavior if validation paths change.

---

## 34. Required DTO Mapping Test

Verify the API mapper preserves:

```text
symbol
factor
savingsAmount
totalSavings
invested
```

without:

* formatting;
* sorting;
* rounding beyond what the application result already contains.

---

## 35. Composition Root Test

Update the existing composition-root tests to verify:

```text
InvestmentAllocationService
```

is constructed and shares the existing request-scoped:

```text
WatchlistQueryService
```

dependency graph.

Do not test private object identity through brittle implementation details if the same guarantee can be established through behavior or a small exposed service graph.

---

## 36. Runtime Smoke Test

This task only extends already verified REST infrastructure, but the new route should still receive a small `workerd` smoke test.

Under the project's documented Cloudflare runtime:

1. use the synthetic local Access identity;
2. use local KV;
3. create or reuse local Watchlist data;
4. ensure at least one valid stock is present;
5. POST a valid `totalSavings`;
6. verify a successful allocation response.

Do not add permanent debug routes.

The smoke test may use the existing real Yahoo/Frankfurter integration because the production graph does.

Keep external calls minimal.

---

## 37. Invalid Runtime Smoke Test

Also verify one simple invalid request, for example:

```json
{
  "totalSavings": -1
}
```

returns a client error without requiring a successful Yahoo/Frankfurter request.

This provides runtime evidence that early HTTP validation prevents unnecessary application/provider work.

Do not add diagnostic production code solely to prove call counts.

Unit tests remain responsible for exact "service not called" assertions.

---

## 38. README

Update `README.md` only if developer commands or runtime instructions change.

Adding one endpoint does not by itself require a README update.

Do not duplicate the API specification into README unless the repository already maintains such an endpoint list there.

---

## 39. Architecture Documentation

Update `ARCHITECTURE.md` with a targeted addition to the REST API section.

Document:

```http
POST /api/watchlists/{watchlistId}/investment-allocation
```

and state that:

* it requires authentication;
* `totalSavings` is a non-negative whole-Euro JSON number;
* allocation is calculated server-side;
* the response contains `totalSavings`, `invested`, and per-symbol factor/savings amount;
* the result is temporary and not persisted;
* zero is valid;
* invalid savings input is rejected before expensive Watchlist/provider composition where possible;
* market-data failure prevents allocation;
* FX failure does not prevent allocation;
* no automatic recalculation occurs.

Do not rewrite unrelated architecture sections.

---

## Non-Goals

Do NOT implement:

* Svelte UI;
* total-savings input field;
* calculator button;
* `invested` display;
* automatic allocation recalculation;
* allocation persistence;
* allocation history;
* share quantities;
* trading-currency conversion;
* new repositories;
* new provider adapters;
* caching;
* Target Price changes;
* Watchlist mutation changes;
* API versioning.

Do not modify investment formulas.

---

## Acceptance Criteria

The task is complete when all of the following are true:

1. `POST /api/watchlists/{watchlistId}/investment-allocation` exists.
2. The endpoint requires authentication.
3. Ownership uses only `event.locals.user.id`.
4. Client-supplied user IDs cannot override ownership.
5. The request requires numeric `totalSavings`.
6. Numeric strings are not coerced.
7. `totalSavings` is validated before application-service invocation.
8. Valid total savings must be finite, integral, and non-negative.
9. Zero total savings is valid.
10. Invalid HTTP input returns a stable 400-level API error.
11. Existing domain total-savings validation remains intact.
12. `InvestmentAllocationService` is added to the existing composition root.
13. It reuses the existing Watchlist query dependency graph.
14. Routes do not duplicate allocation formulas.
15. The response contains `totalSavings`.
16. The response contains `invested`.
17. The response contains ordered per-symbol allocations.
18. Each allocation contains `symbol`, `factor`, and `savingsAmount`.
19. Numeric response values remain unformatted JSON numbers.
20. Empty Watchlists return a successful empty allocation.
21. Missing Watchlists map to `WATCHLIST_NOT_FOUND`.
22. Market-data failure maps to `MARKET_DATA_UNAVAILABLE`.
23. FX failure does not make the endpoint fail.
24. Allocation is not persisted.
25. No automatic recalculation is introduced.
26. No share quantity or currency-order calculation is introduced.
27. Existing centralized API error mapping is reused.
28. Existing request-body infrastructure is reused or minimally extended.
29. Unit/handler tests require no live infrastructure.
30. Authentication, validation, DTO, error, and composition-root behavior are tested.
31. The route is smoke-tested under `workerd`.
32. Early invalid-input behavior is smoke-tested.
33. No permanent debug route remains.
34. `ARCHITECTURE.md` documents the endpoint and semantics.
35. Existing project checks still pass.
36. No Svelte UI is implemented.
37. No unnecessary production dependency is introduced.

---

## Verification

Before completing the task, execute:

```bash
npm run check
npm run test
npm run lint
npm run build
```

Additionally:

* run the documented Cloudflare runtime;
* smoke-test the new authenticated endpoint;
* smoke-test one invalid `totalSavings` request.

All normal automated tests must remain independent of live external infrastructure.

Do not report a verification step as successful unless it was actually executed successfully.

---

## Task Status

After all acceptance criteria are satisfied and all required verification checks pass, change:

```text
Status: Ready
```

to:

```text
Status: Done
```

Do not mark the task `Done` if a required acceptance criterion or verification step remains unsatisfied.

Do not modify the status of unrelated tasks.

---

## Completion Report

When finished, report:

1. files added or changed;
2. final endpoint path/method;
3. request DTO;
4. response DTO;
5. authentication behavior;
6. early total-savings validation behavior;
7. stable error code used for invalid total savings;
8. composition-root changes;
9. confirmation that existing investment-domain logic is reused;
10. empty-Watchlist behavior;
11. zero-total-savings behavior;
12. missing-Watchlist behavior;
13. market-data failure behavior;
14. FX-failure behavior;
15. confirmation that allocation is not persisted;
16. confirmation that no automatic recalculation occurs;
17. handler/route test scenarios added;
18. composition-root test changes;
19. runtime smoke-test procedure and result;
20. invalid-input runtime smoke-test result;
21. changes made to `ARCHITECTURE.md`;
22. README changes, if any;
23. results of `check`, `test`, `lint`, and `build`;
24. confirmation that no permanent debug endpoint remains;
25. confirmation that this task's status was changed to `Done`;
26. assumptions or unresolved issues;
27. deviations from this task or `ARCHITECTURE.md`.

Do not proceed to the Svelte UI.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
