# TASK-013: REST API and Application Wiring

## Status

Done

## Goal

Expose the existing Watchlist application functionality through a small authenticated JSON/HTTP API using SvelteKit server routes.

This task is the application composition root.

It must wire:

```text
Cloudflare Access
       |
       v
event.locals.user
       |
       v
SvelteKit API Routes
       |
       v
Application Services
       |
       +-- WatchlistService
       +-- AddStockToWatchlistService
       +-- TargetPriceService
       +-- WatchlistQueryService
       |
       v
Infrastructure
       |
       +-- Cloudflare KV
       +-- YahooFinanceAdapter
       +-- FrankfurterAdapter
```

After this task, the server-side application must be usable through authenticated REST-style endpoints.

Do not implement the Watchlist UI in this task.

---

## Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* this task completely

Relevant existing production code includes:

* Cloudflare Access authentication context;
* `event.locals.user`;
* `WatchlistRepository`;
* `TargetPriceRepository`;
* Cloudflare KV repository implementations;
* `WatchlistService`;
* `TargetPriceService`;
* `AddStockToWatchlistService`;
* `WatchlistQueryService`;
* `MarketDataProvider`;
* `YahooFinanceAdapter`;
* `ExchangeRateProvider`;
* `FrankfurterAdapter`.

Reuse these components.

Do not duplicate their business logic inside routes.

---

## 1. API Principles

The API is:

* JSON over HTTP;
* REST-style;
* authenticated;
* user-scoped through server-side identity;
* intentionally small.

Do not introduce:

* GraphQL;
* tRPC;
* RPC frameworks;
* API-generation frameworks;
* a second backend application.

Use SvelteKit `+server.ts` routes and current SvelteKit conventions.

---

## 2. Authentication

Every application API endpoint introduced by this task requires an authenticated user.

Use:

```text
event.locals.user
```

established by TASK-008.

If no authenticated user is available, return:

```text
HTTP 401
```

with the standard API error shape defined by this task.

Do not:

* read a user ID from query parameters;
* read a user ID from request bodies;
* put user IDs into normal resource URLs;
* use email as ownership identity;
* parse Cloudflare Access JWTs inside routes.

The persistence user ID always comes from:

```text
event.locals.user.id
```

---

## 3. API Error Shape

Introduce one small stable JSON error representation for application APIs.

Conceptually:

```json
{
  "error": {
    "code": "DUPLICATE_SYMBOL",
    "message": "The symbol already exists in this watchlist."
  }
}
```

The exact TypeScript type may resemble:

```ts
interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}
```

Client code must depend on stable API error codes rather than:

* JavaScript class names;
* raw exception messages;
* Yahoo errors;
* Frankfurter errors;
* Cloudflare errors.

---

## 4. Error Codes

Define a small explicit set of stable API error codes.

At minimum support equivalents of:

```text
UNAUTHENTICATED
INVALID_REQUEST

WATCHLIST_NOT_FOUND
NO_ACTIVE_WATCHLIST
INVALID_WATCHLIST_NAME

INVALID_SYMBOL
UNKNOWN_STOCK_SYMBOL
DUPLICATE_SYMBOL
SYMBOL_NOT_FOUND

INVALID_TARGET_PRICE

MARKET_DATA_UNAVAILABLE

PERSISTENCE_ERROR
INTERNAL_ERROR
```

Use names consistently.

Do not expose implementation-specific class names as API codes.

---

## 5. HTTP Status Mapping

Use consistent HTTP semantics.

At minimum:

```text
Unauthenticated
-> 401 Unauthorized

Malformed JSON / structurally invalid request
-> 400 Bad Request

Invalid Watchlist name
-> 400 Bad Request

Invalid symbol input
-> 400 Bad Request

Invalid Target Price
-> 400 Bad Request

Watchlist not found
-> 404 Not Found

Symbol not found when removing
-> 404 Not Found

Unknown stock symbol according to MarketDataProvider
-> 422 Unprocessable Content
   or the current standards-compatible equivalent used by the project

Duplicate symbol
-> 409 Conflict

No active Watchlist
-> 409 Conflict

Market-data provider unavailable
-> 503 Service Unavailable

Persistence failure
-> 500 Internal Server Error

Unexpected internal error
-> 500 Internal Server Error
```

Choose one consistent status for unknown stock symbols and document it.

Do not use HTTP 200 for failed operations.

---

## 6. Error Mapping Boundary

Centralize error-to-HTTP mapping sufficiently that every route does not reproduce a large `instanceof` chain.

Use the smallest practical shared server-side helper.

Do not introduce a general web framework.

Application/domain/provider errors remain independent of HTTP.

The HTTP layer owns translation into:

```text
status
+
API error code
+
user-facing message
```

---

## 7. Error Messages

Messages should be concise and understandable.

Examples:

```text
The watchlist does not exist.
The symbol already exists in this watchlist.
The stock symbol could not be found.
Market data is currently unavailable.
```

Do not expose:

* stack traces;
* raw Yahoo messages;
* raw Frankfurter messages;
* KV key names;
* Cloudflare internal errors;
* cookies/tokens;
* exception causes.

Detailed causes remain server-side diagnostics.

---

## 8. Composition Root

Introduce the smallest practical server-side composition root/factory for constructing the concrete application graph.

Conceptually:

```text
WATCHLIST_KV
    |
    +--> CloudflareKvWatchlistRepository
    |
    +--> CloudflareKvTargetPriceRepository

YahooFinanceAdapter
    |
    +--> AddStockToWatchlistService
    |
    +--> WatchlistQueryService

FrankfurterAdapter
    |
    +--> WatchlistQueryService

Repositories
    |
    +--> WatchlistService
    +--> TargetPriceService
    +--> WatchlistQueryService
```

Do not instantiate the entire dependency graph independently in every route.

Do not introduce a dependency-injection framework.

---

## 9. Cloudflare Platform Requirement

Concrete production services require:

```text
event.platform.env.WATCHLIST_KV
```

or the current equivalent exposed by the Cloudflare/SvelteKit adapter.

If the required Cloudflare platform/binding is unavailable, fail safely.

Do not silently use an in-memory production fallback.

Local unit tests may inject fake services.

---

## 10. API Route: List Watchlists

Implement:

```http
GET /api/watchlists
```

Purpose:

Return the user's persisted Watchlist metadata.

This endpoint does NOT load Yahoo market data for every Watchlist.

Response conceptually:

```json
{
  "activeWatchlistId": "wl-1",
  "watchlists": [
    {
      "id": "wl-1",
      "name": "Main"
    },
    {
      "id": "wl-2",
      "name": "Dividend"
    }
  ]
}
```

The client does not need all symbol arrays merely to render tabs.

Prefer a small API DTO.

For no Watchlists:

```json
{
  "watchlists": []
}
```

with no active ID.

---

## 11. API Route: Create Watchlist

Implement:

```http
POST /api/watchlists
```

Request:

```json
{
  "name": "Dividend"
}
```

Use:

```text
WatchlistService.createWatchlist(...)
```

The newly created Watchlist becomes active according to existing business rules.

Return a response useful for updating the tab UI without an immediate second GET.

A suitable response is the updated Watchlist metadata state.

Do not require the client to generate a Watchlist ID.

---

## 12. API Route: Select Active Watchlist

Implement:

```http
PUT /api/watchlists/active
```

Request:

```json
{
  "watchlistId": "wl-2"
}
```

Use:

```text
WatchlistService.selectActiveWatchlist(...)
```

Return updated Watchlist metadata.

Do not accept a user ID.

---

## 13. API Route: Delete Active Watchlist

Implement:

```http
DELETE /api/watchlists/active
```

Use:

```text
WatchlistService.deleteActiveWatchlist(...)
```

The HTTP endpoint does not implement the confirmation dialog.

Confirmation belongs to the future client UI.

Return the updated Watchlist metadata so the client immediately knows:

* remaining tabs;
* new active Watchlist;
* empty state.

---

## 14. API Route: Get Composed Watchlist

Implement:

```http
GET /api/watchlists/{watchlistId}
```

Use:

```text
WatchlistQueryService.getWatchlist(...)
```

Return the composed `WatchlistView` through an API-owned DTO.

The response includes:

```text
id
name
stocks
warnings
```

Each stock includes the currently composed fields:

```text
symbol
name
marketCapBillionsUsd
price
dividendYield
currency
targetPrice
distanceToTarget
```

Do not include:

```text
factor
savingsAmount
```

yet.

Warnings such as:

```text
fx-provider-unavailable
```

must be represented through a stable API warning code.

Do not require the client to infer provider failure from missing market caps.

---

## 15. API Route: Add Stock

Implement:

```http
POST /api/watchlists/{watchlistId}/stocks
```

Request:

```json
{
  "symbol": "GAW.L"
}
```

Use:

```text
AddStockToWatchlistService.addStock(...)
```

This ensures Yahoo validation occurs before persistence.

After successful addition, return the **updated composed Watchlist**.

That means the route should:

1. perform validated addition;
2. query the updated Watchlist through `WatchlistQueryService`;
3. return the resulting Watchlist DTO.

This avoids requiring the client to perform an immediate second GET.

Do not return the transient market-data object used during validation.

---

## 16. API Route: Remove Stock

Implement:

```http
DELETE /api/watchlists/{watchlistId}/stocks/{symbol}
```

Use:

```text
WatchlistService.removeSymbol(...)
```

After successful removal, return the updated composed Watchlist.

Do not delete the Target Price.

### URL Encoding

Symbols may contain characters significant in URLs.

Use normal URL path decoding.

Do not invent custom symbol encoding.

Tests should include representative symbols such as:

```text
GAW.L
HEXA-B.ST
```

If a valid Yahoo symbol cannot safely be represented as one path segment under normal URL encoding, document the issue before changing the API shape.

---

## 17. API Route: Set Target Price

Implement:

```http
PUT /api/target-prices/{symbol}
```

Request:

```json
{
  "targetPrice": 200.5
}
```

Use:

```text
TargetPriceService.setTargetPrice(...)
```

The client does NOT send:

```text
userId
watchlistId
```

for Target Price ownership.

Target Price remains:

```text
User + Symbol
```

---

## 18. Target Price Mutation Response

The Target Price mutation should return enough server-derived information for the UI to update the affected stock without calculating business logic itself.

Return conceptually:

```json
{
  "symbol": "AAPL",
  "targetPrice": 200.5,
  "distanceToTarget": -0.08
}
```

The exact values depend on current market data.

To calculate the updated distance server-side, the HTTP/application orchestration may use:

```text
MarketDataProvider.getQuote(symbol)
+
calculateTargetPriceDistance(...)
```

or a small application-level helper if that avoids placing business orchestration directly in the route.

Do not calculate `distanceToTarget` in the client.

---

## 19. Target Price Response and Market Data Failure

The Target Price persistence operation and market-data lookup have different reliability.

The Target Price must not be lost merely because Yahoo is temporarily unavailable.

Use this sequence:

```text
validate + persist Target Price
        |
        v
attempt current market-data lookup
        |
        +-- success --> return targetPrice + distanceToTarget
        |
        +-- unavailable --> return persisted targetPrice with
                            distanceToTarget unavailable
                            and an explicit warning
```

Do NOT roll back the successfully persisted Target Price because Yahoo failed afterward.

The response must allow the client to distinguish:

```text
Target Price saved successfully,
but current distance could not be refreshed.
```

from:

```text
Target Price was not saved.
```

Introduce the smallest practical warning representation.

---

## 20. No GET Target Prices Endpoint

Do NOT implement:

```http
GET /api/target-prices
```

or:

```http
GET /api/target-prices/{symbol}
```

The client receives Target Prices through:

```http
GET /api/watchlists/{watchlistId}
```

The Target Price service remains an internal application capability.

Only the mutation endpoint is currently required.

---

## 21. Request Validation

HTTP request bodies are external input.

Validate their structure before calling application services.

At minimum:

### Create Watchlist

Require an object containing a string:

```text
name
```

### Select Watchlist

Require an object containing a string:

```text
watchlistId
```

### Add Stock

Require an object containing a string:

```text
symbol
```

### Set Target Price

Require an object containing numeric:

```text
targetPrice
```

Do not silently coerce:

```json
{
  "targetPrice": "200.5"
}
```

into a number at the REST layer.

Locale parsing belongs to the UI.

---

## 22. Malformed JSON

Malformed JSON must return:

```text
400 Bad Request
```

with:

```text
INVALID_REQUEST
```

or equivalent stable code.

Do not allow raw JSON parse exceptions to produce framework-default HTML error pages.

API endpoints must consistently return JSON errors.

---

## 23. Response DTO Boundary

Do not expose application/domain objects merely because their current shape happens to match the desired JSON.

Introduce small API mapping helpers/types where useful.

The API contract should remain stable even if internal application types evolve.

Avoid excessive duplicate DTO boilerplate where there is no meaningful boundary benefit.

---

## 24. Numeric Representation

API numeric values are JSON numbers.

Examples:

```json
{
  "price": 184.74,
  "targetPrice": 200.5,
  "distanceToTarget": -0.078,
  "dividendYield": 0.0266,
  "marketCapBillionsUsd": 42.3
}
```

Do not return locale-formatted strings such as:

```text
"200,50"
"2,66 %"
```

Formatting belongs to the client.

---

## 25. Optional Values

When application data is unavailable, use a consistent JSON representation.

Prefer omission or `null` consistently according to the API mapping design.

Be aware that:

```text
undefined
```

properties are omitted by JSON serialization.

Choose and document one practical convention for optional stock fields.

Do not invent numeric zero for missing market data.

---

## 26. API Warning Shape

Define a small stable warning representation.

Conceptually:

```json
{
  "warnings": [
    {
      "code": "FX_PROVIDER_UNAVAILABLE",
      "message": "Currency conversion is currently unavailable."
    }
  ]
}
```

The exact shape may be simplified, but warning codes must be stable.

At minimum support:

```text
FX_PROVIDER_UNAVAILABLE
MARKET_DATA_UNAVAILABLE
```

where applicable.

Do not expose internal warning string literals directly if an API-owned mapping gives a cleaner boundary.

---

## 27. Route Thinness

Routes should primarily:

```text
authenticate
validate HTTP input
call application service
map result
map errors
return JSON
```

Do not move business rules into `+server.ts`.

In particular, routes MUST NOT implement:

* Watchlist deletion selection rules;
* duplicate-symbol detection;
* Yahoo symbol validation;
* dividend calculations;
* market-cap calculations;
* Target Price validation;
* target-distance formula.

Reuse existing application/domain logic.

---

## 28. Service Construction

Concrete application services require the current request's Cloudflare platform binding.

Avoid mutable global service instances that capture request-specific platform state.

A small request/platform-based factory is appropriate.

For example, conceptually:

```text
createApplicationServices(platform)
```

returning the required services.

Do not introduce a service locator accessible from client code.

---

## 29. Yahoo Client Reuse

Within one service graph/request, avoid unnecessarily constructing multiple independent Yahoo adapters if the same adapter can be shared between:

* `AddStockToWatchlistService`;
* `WatchlistQueryService`;
* Target Price distance refresh.

Do not introduce cross-request mutable caching.

The goal is simple request-scoped composition.

---

## 30. Frankfurter Client Reuse

Likewise, one request-scoped `FrankfurterAdapter` may be shared where appropriate.

Do not introduce cross-request state or caching.

---

## 31. No Direct Infrastructure Logic in Routes

Routes must not:

* construct KV keys;
* parse KV JSON;
* call Yahoo URLs directly;
* call Frankfurter URLs directly;
* manipulate Cloudflare Access identities directly.

Use existing adapters/repositories/services.

---

## 32. Unit / Route Testing Strategy

Tests introduced by this task must not require:

* real Cloudflare Access;
* real KV;
* Yahoo Finance;
* Frankfurter;
* network access.

Prefer testing:

* shared HTTP mapping helpers directly;
* route behavior using injected/fake application services where practical;
* composition-root construction separately from route semantics.

Do not make route tests depend on live infrastructure.

---

## 33. Required Authentication Tests

At minimum verify:

### Missing User

Protected API endpoint returns:

```text
401
UNAUTHENTICATED
```

### Authenticated User

The route uses:

```text
event.locals.user.id
```

as the service user ID.

### No Client User ID

A request cannot override the authenticated user through payload/query data.

---

## 34. Required Error-Mapping Tests

At minimum verify mappings for:

```text
InvalidWatchlistNameError
InvalidSymbolError
InvalidTargetPriceError
WatchlistNotFoundError
NoActiveWatchlistError
DuplicateSymbolError
SymbolNotFoundError
UnknownStockSymbolError
MarketDataProviderError
PersistenceError
unexpected Error
```

Assert both:

* HTTP status;
* stable API error code.

---

## 35. Required Watchlist Metadata Tests

Test:

```http
GET /api/watchlists
```

for:

* existing Watchlists;
* no Watchlists;
* active Watchlist;
* duplicate names.

Ensure symbol arrays are not unnecessarily exposed if the selected metadata DTO omits them.

---

## 36. Required Create/Select/Delete Tests

Verify:

### Create

* valid request;
* invalid body;
* duplicate name allowed;
* returned metadata reflects new active Watchlist.

### Select

* valid Watchlist;
* missing Watchlist;
* invalid body.

### Delete Active

* normal deletion;
* deletion of final Watchlist;
* no active Watchlist.

The route must rely on existing service behavior rather than reproducing selection logic.

---

## 37. Required Composed-Watchlist Tests

Verify:

```http
GET /api/watchlists/{id}
```

maps a representative `WatchlistView` correctly.

Include:

* complete stock;
* missing optional market fields;
* Target Price;
* distance;
* dividend yield;
* market-cap USD;
* FX warning.

Do not re-test all composition calculations; TASK-011 already owns those tests.

---

## 38. Required Add-Stock Tests

Verify:

```http
POST /api/watchlists/{id}/stocks
```

for:

* successful validated addition;
* malformed body;
* invalid basic symbol;
* unknown Yahoo symbol;
* provider unavailable;
* duplicate symbol;
* missing Watchlist.

Successful response must be the updated composed Watchlist.

---

## 39. Required Remove-Stock Tests

Verify:

```http
DELETE /api/watchlists/{id}/stocks/{symbol}
```

for:

* successful removal;
* missing symbol;
* missing Watchlist;
* representative dotted/hyphenated symbol.

Successful response must be the updated composed Watchlist.

Target Price must remain untouched through the existing service semantics.

---

## 40. Required Target Price Tests

Verify:

```http
PUT /api/target-prices/{symbol}
```

for:

### Success

Target Price is persisted and response contains:

```text
symbol
targetPrice
distanceToTarget
```

when current market data is available.

### Decimal

Decimal Target Price is preserved.

### Invalid Body

Returns:

```text
400
INVALID_REQUEST
```

### Invalid Target Price

Returns the mapped validation error.

### Market Data Unavailable After Save

Verify:

* Target Price save succeeds;
* provider refresh fails;
* response still represents successful persistence;
* `distanceToTarget` is unavailable;
* response contains a stable market-data warning;
* the endpoint does NOT return a failure status implying that the save failed.

Choose an appropriate successful HTTP status such as `200`.

### Unknown Symbol During Refresh

If Target Price persistence succeeds but Yahoo currently returns no market data for the symbol, treat this similarly to unavailable distance refresh rather than rolling back the Target Price.

The Target Price service intentionally allows persistent user knowledge independent of current Yahoo availability.

---

## 41. Runtime Integration Verification

This task is the first time the full production graph is wired to actual server routes.

In addition to unit/route tests, perform a local Cloudflare-runtime smoke test under:

```text
wrangler dev
```

or the project's documented equivalent.

Use:

* synthetic local Access identity;
* local Workers runtime;
* configured KV binding.

Do not use a real production Access account.

At minimum verify that an authenticated API request reaches the real route and can access the local KV binding.

---

## 42. External Provider Runtime Smoke Test

Where practical, verify one composed Watchlist query under `workerd` using the real:

* `YahooFinanceAdapter`;
* `FrankfurterAdapter`.

Keep the test small.

Do not introduce permanent debug routes.

Temporary verification data/endpoints must be removed before completing the task.

If external-provider smoke testing cannot be performed safely, document why.

---

## 43. Local KV Behavior

TASK-007 noted that plain:

```text
npm run dev
```

does not provide the real Cloudflare KV binding.

Do not hide this limitation.

The integrated server API should be tested under the documented Cloudflare runtime command when real binding behavior is required.

Update README developer instructions if necessary so the distinction is clear:

```text
npm run dev
-> UI/basic Vite development

Cloudflare runtime command
-> Access + KV + full server integration
```

Do not fabricate production namespace IDs.

---

## 44. No Production Deployment

Do NOT:

* create a real Cloudflare Access application;
* create production KV namespaces;
* deploy to production;
* configure DNS;
* add real account IDs;
* add real emails;
* add secrets.

Production deployment is a separate future task.

---

## 45. Architecture Documentation

Update `ARCHITECTURE.md` with targeted API/composition-root decisions.

The architecture should document:

* authenticated REST-style JSON API through SvelteKit server routes;
* user identity comes exclusively from `event.locals.user`;
* stable API error codes;
* routes remain thin;
* concrete infrastructure is wired server-side through a small composition root;
* mutation endpoints return updated UI-useful state where appropriate;
* there is no separate GET Target Prices endpoint;
* Target Price mutation may succeed even when subsequent market-data refresh fails;
* business calculations remain server-side;
* API numeric values remain unformatted JSON numbers.

Do not rewrite unrelated architecture sections.

---

## Non-Goals

Do NOT implement:

* Watchlist Svelte UI;
* tabs UI;
* stock table;
* responsive design;
* filtering;
* sorting;
* delete confirmation dialog;
* total-savings input;
* investment-allocation endpoint;
* savings amount;
* invested total;
* login UI;
* production deployment;
* caching;
* API versioning;
* OpenAPI generation;
* GraphQL;
* Target Price GET endpoint.

Do not refactor existing domain/application services unless necessary to provide a clean HTTP boundary.

---

## Acceptance Criteria

The task is complete when all of the following are true:

1. Authenticated SvelteKit JSON API routes exist.
2. API ownership always uses `event.locals.user.id`.
3. Missing authentication returns JSON `401`.
4. Client-supplied user IDs cannot override authenticated ownership.
5. A stable API error shape exists.
6. Stable API error codes exist.
7. Business/provider/persistence errors are mapped consistently to HTTP.
8. Raw internal/provider exceptions are not exposed.
9. A small server-side composition root constructs concrete repositories/providers/services.
10. Concrete KV/Yahoo/Frankfurter logic is not duplicated in routes.
11. `GET /api/watchlists` returns Watchlist metadata.
12. `POST /api/watchlists` creates a Watchlist and returns updated metadata.
13. `PUT /api/watchlists/active` selects the active Watchlist.
14. `DELETE /api/watchlists/active` deletes the active Watchlist and returns updated metadata.
15. `GET /api/watchlists/{id}` returns the composed Watchlist.
16. `POST /api/watchlists/{id}/stocks` validates and adds a symbol.
17. Successful stock addition returns the updated composed Watchlist.
18. `DELETE /api/watchlists/{id}/stocks/{symbol}` removes a symbol.
19. Successful stock removal returns the updated composed Watchlist.
20. `PUT /api/target-prices/{symbol}` persists a Target Price.
21. Target Price mutation returns server-derived distance when market data is available.
22. Target Price mutation remains successful when post-save market-data refresh fails.
23. Failed distance refresh is represented by a stable warning.
24. No GET Target Prices endpoint exists.
25. Malformed JSON consistently returns JSON `400`.
26. Request bodies are structurally validated.
27. Numeric request input is not silently string-coerced.
28. API numeric responses remain unformatted JSON numbers.
29. API warning codes are stable.
30. Routes contain no duplicated business formulas.
31. Routes do not access KV/Yahoo/Frankfurter directly.
32. Request-scoped services do not introduce cross-request mutable state.
33. Route/API tests require no live external infrastructure.
34. Authentication and error mappings are tested.
35. All required endpoint behaviors are tested.
36. Full API wiring is smoke-tested under `workerd`.
37. Local Access identity is used for runtime smoke testing.
38. Local KV binding is exercised under the Cloudflare runtime.
39. No permanent debug endpoint remains.
40. No real credentials or personal identity data are committed.
41. README reflects full-runtime local-development requirements if necessary.
42. `ARCHITECTURE.md` reflects the REST/API wiring decisions.
43. Existing project checks still pass.
44. No Svelte Watchlist UI is implemented.
45. No unnecessary production dependency is introduced.

---

## Verification

Before completing the task, execute:

```bash
npm run check
npm run test
npm run lint
npm run build
```

Additionally execute the documented Cloudflare-runtime command and perform the required authenticated API/KV smoke test.

Where practical, perform the small real-provider smoke test described above.

Do not report a command/runtime path as successful unless it was actually executed successfully.

Remove all temporary verification routes/data that should not remain in the repository.

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
2. final API routes;
3. API DTO shapes;
4. API error/warning shapes and codes;
5. HTTP status mapping;
6. authentication enforcement;
7. composition-root design;
8. Watchlist metadata endpoint behavior;
9. create/select/delete Watchlist endpoint behavior;
10. composed-Watchlist endpoint behavior;
11. add/remove-stock endpoint behavior;
12. Target Price endpoint behavior;
13. Target Price post-save market-data-failure behavior;
14. confirmation that no GET Target Prices endpoint exists;
15. request-validation strategy;
16. optional/missing JSON-value convention;
17. route/API test scenarios;
18. Cloudflare runtime smoke-test procedure and result;
19. local KV verification result;
20. external Yahoo/Frankfurter smoke-test result, if performed;
21. README changes;
22. ARCHITECTURE.md changes;
23. results of `check`, `test`, `lint`, and `build`;
24. confirmation that no permanent debug endpoint remains;
25. confirmation that no real credentials/personal data were introduced;
26. confirmation that this task's status was changed to `Done`;
27. assumptions or unresolved issues;
28. deviations from this task or `ARCHITECTURE.md`.

Do not proceed to the Svelte Watchlist UI or investment-allocation API.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
