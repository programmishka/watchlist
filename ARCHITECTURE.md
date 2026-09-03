# Watchlist Architecture

## 1. Purpose

Watchlist is a small web application for maintaining personal stock watchlists and supporting an investment strategy based on target prices, dividend yields, market capitalization, and weighted investment allocation.

The application originated as a personal single-user tool. The new implementation shall remain lightweight while being designed for multiple users from the beginning.

The project also serves as a learning project. Architectural simplicity, maintainability, and understandable technology choices are preferred over enterprise-scale patterns.

---

## 2. Goals

The application shall:

* provide multiple independent stock watchlists per user;
* retrieve current stock information from an external market-data provider;
* support stocks from international home exchanges and their respective trading currencies;
* maintain user-specific target prices independently of individual watchlists;
* calculate target-price distance;
* calculate normalized dividend yield;
* convert market capitalization to USD;
* distribute an available investment amount across stocks according to their target-price distance;
* support multiple authenticated users with isolated data;
* require no application-managed passwords;
* run with zero infrastructure cost under expected usage;
* keep business logic on the server;
* keep the browser focused on presentation and UI-related state;
* isolate unstable external APIs from application and domain logic;
* remain small enough to understand and maintain as a personal project.

---

## 3. Non-Goals

The initial implementation does not aim to provide:

* real-time or tick-level market data;
* a trading or brokerage integration;
* automatic order execution;
* portfolio accounting;
* transaction history;
* collaborative watchlist editing;
* sharing of watchlists between users;
* automatic cleanup of unused target prices;
* automatic recalculation of investment allocation after every relevant change;
* persistent investment-allocation results;
* persistent market-data caching;
* comprehensive account administration;
* self-managed passwords;
* automated end-to-end testing against the production infrastructure.

These capabilities may be reconsidered later.

---

## 4. Architectural Constraints

### 4.1 Cost

The application is a hobby and learning project.

The target infrastructure cost is:

> **0 EUR per month under normal expected usage.**

Services should therefore preferably provide free plans with hard usage limits rather than automatically creating usage-based charges.

Expected usage is very low. Initially, only one user is expected, with potentially a small number of additional users later.

### 4.2 Simplicity

The architecture shall avoid unnecessary infrastructure.

In particular:

* no separate heavyweight backend application;
* no Java/Spring Boot backend;
* no relational DBMS;
* no microservices;
* no application-managed identity database unless future requirements make one necessary.

### 4.3 Server-Owned Business Logic

Business logic belongs to the server.

Svelte components and client-side stores MUST NOT contain investment calculations, persistence logic, authentication logic, or external-provider integration logic.

---

## 5. Technology Stack

| Concern              | Technology                                                  |
| -------------------- | ----------------------------------------------------------- |
| Language             | TypeScript                                                  |
| Frontend             | Svelte 5                                                    |
| Full-stack framework | SvelteKit                                                   |
| Server runtime       | Cloudflare Workers                                          |
| Deployment           | Cloudflare                                                  |
| Authentication       | Cloudflare Access                                           |
| Login mechanism      | Email One-Time PIN                                          |
| Persistence          | Cloudflare Workers KV                                       |
| Market data          | Yahoo Finance                                               |
| Yahoo integration    | `yahoo-finance2`                                            |
| FX data              | Frankfurter API                                             |
| API style            | JSON over HTTP / REST-style endpoints                       |
| Unit testing         | TypeScript test framework selected during project bootstrap |
| Styling              | Native CSS                                                  |
| Responsive Design    | CSS Grid, Flexbox, and media/container queries              |

A separate Node.js backend application is not planned.

SvelteKit server functionality provides the backend part of the application.

### 5.1 UI and Styling

The application uses modern native CSS for layout, styling, and responsive
design.

No general-purpose CSS framework such as Tailwind CSS, Bootstrap, or
Semantic UI is planned.

Preferred CSS capabilities include:

- CSS Grid;
- Flexbox;
- media queries;
- container queries where appropriate;
- modern responsive sizing functions such as `min()`, `max()`, and `clamp()`.

Small Svelte-native headless component libraries may be introduced when
they provide a concrete benefit for complex interactive or accessibility-
sensitive components.

Bits UI is the preferred candidate if such a library becomes necessary.

Do not introduce a UI component library or CSS framework without a concrete
requirement.

---

## 6. High-Level Architecture

```text
                         User
                          |
                          v
                 Cloudflare Access
                  Email One-Time PIN
                          |
                          v
+------------------------------------------------------+
|                  Cloudflare                         |
|                                                     |
|                  SvelteKit                          |
|                                                     |
|   +-------------------+     +-------------------+   |
|   |   Svelte Client   |     |  SvelteKit Server |   |
|   |                   |     |                   |   |
|   | Components        | --> | HTTP endpoints    |   |
|   | UI state          |     | Application logic |   |
|   | Filtering         |     | Domain logic      |   |
|   | Sorting           |     | Authorization     |   |
|   | Dialog state      |     |                   |   |
|   +-------------------+     +---------+---------+   |
|                                       |             |
|                            +----------+----------+  |
|                            |                     |  |
|                            v                     v  |
|                      Workers KV          Provider Adapters
|                                                |    |
+------------------------------------------------|----+
                                                 |
                                   +-------------+-------------+
                                   |                           |
                                   v                           v
                              Yahoo Finance              Frankfurter
                              Market Data                 FX Rates
```

---

## 7. Client / Server Boundary

### 7.1 Client Responsibilities

The browser is responsible for presentation and UI-related state.

Examples include:

* selected tab in the currently rendered UI;
* filter text;
* table sorting;
* new-symbol input;
* new-watchlist-name input;
* total-savings input;
* dialog visibility;
* loading state;
* error presentation;
* formatting values for display;
* parsing locale-specific numeric input;
* displaying server-provided stock data.

Filtering and sorting are client-side operations because the complete current watchlist is already available in the browser.

Filtering MUST NOT cause server requests for each keystroke.

### 7.2 Server Responsibilities

The server is responsible for:

* authenticated-user identification;
* authorization;
* watchlist management;
* target-price management;
* persistence;
* Yahoo Finance communication;
* exchange-rate communication;
* provider-data normalization;
* target-price-distance calculation;
* dividend normalization;
* dividend-yield calculation;
* market-cap conversion;
* investment-factor calculation;
* savings allocation;
* invested-total calculation;
* validation of business inputs.

### 7.3 Architectural Rule

Business formulas MUST have a single server-side implementation.

For example, the client MUST NOT independently calculate `distanceToTarget` from `price` and `targetPrice`.

---

## 8. Authentication and Authorization

### 8.1 Authentication

Authentication is handled by Cloudflare Access.

The initial login mechanism is Email One-Time PIN.

This allows users to authenticate using any supported email account, including Proton Mail, without Proton itself acting as an identity provider.

The application MUST NOT:

* store passwords;
* hash passwords;
* implement password reset;
* implement authentication credentials itself.

### 8.2 User Identity

The authenticated Cloudflare Access identity is the source of the application user identity.

The application derives the authenticated user identity from the Cloudflare Workers Access context (ctx.access). The stable Access user identifier returned by the authenticated identity is used as the application user ID. Application code does not parse or validate Access JWTs itself.

If `ctx.access` is unavailable, or Access returns no identity, the application MUST treat the request as unauthenticated. It MUST NOT fall back to an anonymous or hard-coded identity. Absence of a valid Access context always fails closed.

Email addresses may be used for display purposes but MUST NOT be used as persistent primary identifiers for application data.

### 8.3 Authorization Rule

The client MUST NOT supply the user ID for normal data operations.

For example:

```http
GET /api/watchlists
```

is valid.

An API design such as:

```http
GET /api/users/{userId}/watchlists
```

shall not be used for ordinary user-owned resources.

The server derives the user ID from the authenticated request.

All persistence access is scoped to that authenticated user.

---

## 9. Domain Model

The conceptual domain contains the following major concepts.

### 9.1 User

A user is identified through Cloudflare Access.

The application initially requires no separate persistent User entity.

A user owns:

* zero or more Watchlists;
* zero or more Target Prices.

### 9.2 Watchlist

A Watchlist contains:

```text
id
name
symbols[]
```

Properties:

* `id` uniquely identifies the watchlist;
* `name` is user-defined;
* duplicate watchlist names are allowed;
* `symbols` contains stock symbols;
* a symbol may occur at most once in a particular watchlist;
* the same symbol may occur in multiple watchlists.

The application additionally persists which watchlist was most recently active.

A user may have zero watchlists.

### 9.3 Target Price

A Target Price belongs to:

```text
User + Symbol
```

It explicitly does NOT belong to a Watchlist.

Therefore:

* adding an existing symbol to another watchlist automatically reuses its existing target price;
* changing a target price affects that symbol wherever it appears for that user;
* removing a symbol from a watchlist does not delete its target price;
* deleting a watchlist does not delete any target prices;
* target prices intentionally survive even when the symbol currently occurs in no watchlist.

Target prices may contain decimal values.

### 9.4 Market Data

Market data is external, transient data.

Required stock market-data fields are:

```ts
interface StockMarketData {
  symbol: string;
  name?: string;
  price?: number;
  currency?: string;
  annualDividend?: number;
  marketCap?: number;
}
```

The exact TypeScript representation may evolve during implementation.

Market data is not persisted in the initial architecture.

### 9.5 Derived Stock Data

The server combines:

```text
Watchlist membership
        +
Target Price
        +
Market Data
        +
Exchange Rates
        |
        v
Derived Watchlist Stock
```

Derived values include:

* market cap in billions USD;
* dividend yield;
* distance to target;
* investment factor;
* savings amount.

---

## 10. Persistence Model

Cloudflare Workers KV is used as persistence.

The data model intentionally resembles small per-user documents rather than relational records.

Conceptual keys:

```text
user:<userId>:watchlists
user:<userId>:target-prices
```

### 10.1 Watchlists Document

Conceptual example:

```json
{
  "activeWatchlistId": "wl-1",
  "watchlists": [
    {
      "id": "wl-1",
      "name": "Main",
      "symbols": ["AAPL", "MSFT", "KO"]
    },
    {
      "id": "wl-2",
      "name": "Dividend",
      "symbols": ["KO", "PEP"]
    }
  ]
}
```

### 10.2 Target Prices Document

Conceptual example:

```json
{
  "AAPL": 180,
  "MSFT": 410.5,
  "KO": 65
}
```

An entry does not need to exist until a target price has actually been assigned.

### 10.3 KV Consistency

Cloudflare KV is eventually consistent.

This is accepted because:

* datasets are small;
* users modify their own data;
* concurrent editing is not an expected use case;
* transactions across multiple users are unnecessary;
* temporary propagation delays are acceptable for this application.

This decision MUST be reconsidered if collaborative or strongly consistent workflows are introduced.

---

## 11. Watchlist Behaviour

### 11.1 Creating a Watchlist

The user enters a name and confirms creation using the corresponding UI action.

Rules:

* the name is required;
* duplicate names are allowed;
* every watchlist receives a unique ID;
* the newly created watchlist becomes the active watchlist, even when other watchlists already exist.

### 11.2 Deleting a Watchlist

The currently selected watchlist may be deleted.

Deletion requires a confirmation dialog.

Deleting a watchlist:

* removes the watchlist;
* removes its symbol memberships;
* does NOT delete target prices.

If no watchlists remain:

* the application displays an appropriate empty state;
* the delete-watchlist action is disabled.

If other watchlists remain after deletion, the new active watchlist is selected deterministically:

> Select the previous watchlist in tab order. If the deleted watchlist was the first watchlist, select the new first watchlist.

The relative order of the remaining watchlists is otherwise preserved.

### 11.3 Active Watchlist

The last selected watchlist is persisted.

When the user returns to the application, that watchlist should be selected when it still exists.

---

## 12. Stock Membership

### 12.1 Adding a Stock

The user enters a stock symbol and confirms using the add action.

The server resolves the symbol using the configured market-data provider.

If successful, the symbol is added to the current watchlist.

If a target price already exists for:

```text
authenticated user + symbol
```

that target price is automatically used.

### 12.2 Duplicate Symbols

A symbol is unique inside a watchlist.

Attempting to add an already existing symbol to the same watchlist MUST be rejected with an understandable error.

The same symbol may occur in different watchlists.

### 12.3 Removing a Stock

A stock is removed from the current watchlist by symbol.

Removing it:

* removes only the membership in that watchlist;
* does not remove it from other watchlists;
* does not remove its target price.

### 12.4 Empty Watchlist

If a watchlist contains no symbols, an empty-state message is displayed instead of rendering an otherwise empty table containing only headers.

---

## 13. Watchlist Table

The main application component is a stock table.

The table contains:

* symbol;
* name;
* market cap in billions USD;
* current price;
* dividend yield;
* currency;
* target price;
* distance to target;
* savings amount;
* delete action.

### 13.1 Sorting

Supported table columns may be sorted through their headers.

Sorting is a client-side presentation concern.

### 13.2 Filtering

A separate filter input filters by company name.

Rules:

* substring / `contains` matching;
* case-insensitive;
* applied immediately after input changes;
* no explicit confirmation;
* filtering is performed client-side.

Filtering MUST NOT affect investment allocation.

### 13.3 Footer

The table footer displays:

* total number of stocks in the current watchlist;
* number of stocks matching the current filter.

---

## 14. Responsive Design

The application must remain usable on desktop and mobile screen sizes.

Responsive behavior is implemented using native CSS rather than a
responsive UI framework.

### 14.1 General Layout

Toolbars and input groups should adapt to available space using CSS Grid
or Flexbox.

Controls may wrap or switch from horizontal to vertical layouts on smaller
viewports.

Responsive behavior should be driven by actual UI requirements rather than
a large predefined breakpoint system.

### 14.2 Watchlist Table

The watchlist table contains more columns than can reasonably fit on a
small mobile viewport.

For the initial implementation:

- preserve the tabular representation;
- allow horizontal scrolling on narrow viewports;
- keep the table usable without breaking the surrounding page layout;
- do not introduce a separate mobile card representation.

A dedicated mobile representation or selective column hiding may be
considered as a future improvement if horizontal scrolling proves
insufficient.

### 14.3 Accessibility

Interactive controls must remain keyboard-accessible and usable across
supported viewport sizes.

For complex interactive controls such as modal confirmation dialogs,
prefer native platform capabilities or accessible Svelte-native headless
components over implementing accessibility behavior from scratch.

## 15. Market Data

### 15.1 Provider

Yahoo Finance is initially used as the market-data source.

Yahoo Finance is an unofficial and potentially unstable dependency.

The application therefore MUST isolate Yahoo-specific behavior behind a market-data adapter/provider boundary.

Domain and application code MUST NOT depend directly on Yahoo response structures.

### 15.2 Required Yahoo Fields

Currently required Yahoo information is:

```text
symbol
longName
regularMarketPrice
currency
trailingAnnualDividendRate
marketCap
```

The Yahoo adapter maps these fields into application-owned types.

### 15.3 Data Loading

Market data is loaded:

* during initial application/watchlist loading;
* when switching to another watchlist.

All symbols of the selected watchlist should be requested as a batch where the provider permits it.

The initial architecture does not persist or explicitly cache market data.

Caching may be introduced later if necessary.

---

## 16. Market-Data Error Handling

Market-data retrieval should support partial success.

If Yahoo successfully returns data for some but not all requested symbols:

* the watchlist remains usable;
* successful stocks are displayed normally;
* unavailable fields for failed symbols are represented using UI placeholders.

If Yahoo Finance itself cannot be reached or the request fails globally:

* the user receives an understandable error message;
* raw provider errors MUST NOT be exposed directly as user-facing messages.

---

## 17. Currency and Exchange Rates

### 17.1 FX Provider

Frankfurter is used as the initial exchange-rate provider.

FX access MUST be isolated behind an application-owned abstraction such as:

```text
ExchangeRateProvider
```

Domain logic MUST NOT depend directly on Frankfurter response structures.

### 17.2 Currency Normalization

Provider-specific currency units must be normalized before generic FX conversion.

A known example is Yahoo's `GBp` representation.

`GBp` represents British pence rather than GBP.

Therefore:

```text
100 GBp = 1 GBP
```

This is a unit-normalization rule, not an exchange-rate rule.

This value-scaling rule applies to price/dividend-like fields. It does
**not** apply uniformly to every Yahoo numeric field: TASK-002 empirically
established that Yahoo's `marketCap` is not pence-scaled even when
`currency = GBp`. Market-cap FX conversion instead uses only a currency
*code* mapping (`GBp` -> `GBP`), with no value scaling — see §18.

### 17.3 FX Failure

Failure of the FX provider should not make all Yahoo market data unusable.

If exchange-rate data cannot be retrieved:

* data not requiring FX conversion may still be displayed;
* derived values requiring conversion may be unavailable;
* the UI shall display an understandable indication that currency conversion is currently unavailable.

---

## 18. Market Capitalization

Yahoo market capitalization is treated as being expressed in the stock's corresponding market currency.

The application displays market capitalization as:

> billions of USD

Conceptually:

```text
Yahoo marketCap
      |
      v
map market currency to FX currency code
      |
      v
convert to USD (no value scaling)
      |
      v
divide by 1,000,000,000
      |
      v
cap (USD billions)
```

Formula:

```text
capInBillionsUsd =
    convertToUsd(marketCap, currency) / 1_000_000_000
```

The "map market currency to FX currency code" step is a currency-*code*
mapping only (e.g. `GBp` -> `GBP` for the exchange-rate lookup). It MUST
NOT scale `marketCap` itself — in particular, `marketCap` MUST NOT be
divided by 100 when `currency = GBp`. This differs from the price/dividend
`GBp` unit normalization described in §17.2, which does scale the value.
TASK-002 confirmed Yahoo already reports `marketCap` in major-currency-unit
scale even when `currency = GBp`.

Exact presentation rounding is a UI concern and may be defined during implementation.

---

## 19. Dividend Yield

Yahoo's `trailingAnnualDividendRate` cannot always be consumed without normalization.

The production implementation intentionally contains exactly one
normalization rule (`GBp`, see §19.1). It is a fixed unit relationship, not
an exchange-rate conversion, and does not depend on `ExchangeRateProvider`.

Conceptually:

```text
Yahoo trailingAnnualDividendRate
             |
             v
GBp unit normalization (only when currency = GBp)
             |
             v
normalized annual dividend
             |
             v
normalizedDividend / regularMarketPrice
             |
             v
dividend yield
```

Normal case:

```text
dividendYield =
    annualDividend / regularMarketPrice
```

GBp case:

```text
dividendYield =
    (annualDividend * 100) / regularMarketPrice
```

The `GBp` adjustment exists because Yahoo expresses `regularMarketPrice` in
pence for `GBp`-quoted stocks while `annualDividend` is treated as GBP for
this calculation; multiplying by 100 puts both values in pence before
dividing.

If dividend or market price is absent, invalid, or non-positive, dividend yield is `0`.

### 19.1 GBp Unit Normalization

The only current production dividend-normalization rule is:

```text
currency GBp -> annualDividend * 100 (before dividing by price)
```

This rule applies solely to dividend-yield calculation. It MUST NOT be
applied to `StockMarketData.marketCap`, which uses a separate, FX-based
rule (§18): `GBp` maps to the FX currency code `GBP` with no `* 100` or
`/ 100` scaling of the market-cap value. Keep these two `GBp` rules
distinct.

The legacy application also applied an `INR -> dividend * 100` correction
and symbol-specific corrections for `LISP.SW`, `HEXA-B.ST`, and `TOM.OL`.
These were intentionally discarded during TASK-006: current evidence does
not justify retaining them, and they are not part of the production
implementation. If Yahoo data for a specific stock or currency is later
demonstrated to require correction, it must be introduced through a
separate explicit requirement with current evidence and corresponding
tests, not reinstated from the legacy source.

---

## 20. Target Price

Target price is user-editable.

Target prices:

* are persisted;
* belong to User + Symbol;
* may contain decimal values;
* are expressed in the corresponding stock's trading currency.

The UI should accept locale-friendly decimal input, including comma-based decimal notation where appropriate.

The REST API communicates numeric values as JSON numbers using standard JSON numeric syntax.

The server MUST validate target-price input.

---

## 21. Distance to Target

Changing a target price causes `distanceToTarget` to be recalculated.

The calculation is server-side.

Formula:

```text
distanceToTarget =
    regularMarketPrice / targetPrice - 1
```

Equivalent TypeScript semantics from the legacy application:

```ts
if (!targetPrice || !regularMarketPrice || targetPrice === 0) {
  return 0;
}

return regularMarketPrice / targetPrice - 1;
```

Examples:

| Price | Target | Distance |
| ----: | -----: | -------: |
|    80 |    100 |     -20% |
|   100 |    100 |       0% |
|   120 |    100 |     +20% |

A negative distance means the current market price is below the target price.

---

## 22. Investment Allocation

Investment allocation is explicitly triggered by the user.

The user enters the total available savings amount as a whole-Euro amount and starts the calculation.

The calculation uses **all stocks in the currently selected watchlist**.

The current table filter MUST NOT influence investment allocation.

### 22.1 Total Savings Validation

`totalSavings` must be a finite, non-negative integer.

- `0` is valid and results in zero allocation for all stocks.
- negative values are invalid;
- fractional values are invalid;
- `NaN` and infinite values are invalid.

Invalid total-savings input must be rejected rather than coerced.

### 22.2 Factor

For every stock:

```text
factor = 1 / (1 + distanceToTarget)
```

Following the existing semantics, a missing/falsy distance produces factor `0`.

Conceptually:

```ts
function calculateFactor(targetPriceDistance?: number) {
  if (!targetPriceDistance) {
    return 0;
  }

  return 1 / (1 + targetPriceDistance);
}
```

Mathematically invalid or non-finite factor results do not participate in
the allocation and are treated as factor `0`.

Factors that are non-finite or non-positive are treated as `0` during
factor summation and allocation.

### 22.3 Factor Sum

```text
factorSum = sum(stock.factor)
```

over all stocks of the current watchlist.

### 22.4 Savings Amount

For every stock:

```text
savingsAmount =
    floor((factor / factorSum) * totalSavings)
```

If the stock has no usable factor or the factor sum cannot be used, its savings amount is `0`.

Savings amounts are always whole-Euro values.

### 22.5 Invested

The UI additionally displays:

```text
invested: <amount>
```

where:

```text
invested = sum(savingsAmount)
```

Because every individual savings amount is rounded down:

```text
invested <= totalSavings
```

Any remainder is intentionally left undistributed.

### 22.6 Persistence

The following values are NOT persisted:

```text
totalSavings
factor
savingsAmount
invested
```

They represent a temporary calculation.

---

## 23. Recalculation Behaviour

The initial version retains the explicit investment-calculation workflow.

Changing a target price immediately causes the server to return an updated target-price distance.

It does NOT automatically recalculate previously calculated savings allocations.

Similarly, adding or removing stocks does not automatically trigger a new savings allocation.

Automatic recalculation after:

* target-price changes;
* stock additions;
* stock removals;
* market-price updates

is considered a future improvement.

---

## 24. REST API Principles

The server exposes a small JSON/HTTP API through SvelteKit server routes.

The exact endpoint design is defined during implementation.

Principles:

* use simple resource-oriented endpoints;
* use JSON request/response bodies;
* do not introduce GraphQL;
* do not introduce an additional RPC framework without a demonstrated need;
* never expose persistence implementation details;
* never require a client-provided user ID for user-owned resources;
* validate all mutation input server-side;
* return understandable application errors rather than raw provider or infrastructure exceptions.

Possible resource groups include:

```text
/api/watchlists
/api/watchlists/{watchlistId}
/api/watchlists/{watchlistId}/stocks
/api/target-prices
/api/investment-allocation
```

These paths are illustrative rather than final contracts.

---

## 25. Server-Side Structure

The implementation should maintain clear boundaries without introducing unnecessary Clean Architecture ceremony.

Conceptually:

```text
SvelteKit Routes
      |
      v
Application / Domain Services
      |
      +----------------------+
      |                      |
      v                      v
Repositories            Provider Interfaces
      |                      |
      v              +-------+-------+
Cloudflare KV          |               |
                       v               v
                 Yahoo Adapter   Frankfurter Adapter
```

Responsibilities should be separated so that:

* routes handle HTTP concerns;
* services coordinate use cases and business rules;
* repositories hide persistence;
* provider adapters hide external APIs;
* pure calculations remain independently unit-testable.

Interfaces should be introduced where they provide a meaningful boundary, especially for external providers and persistence.

The project MUST NOT introduce layers or abstractions solely to imitate enterprise architecture patterns.

---

## 26. Client-Side State

Client-side state should remain close to presentation concerns.

Examples:

```text
selectedTab
filterText
sortColumn
sortDirection
newSymbolInput
newWatchlistNameInput
totalSavingsInput
deleteConfirmationOpen
loadingState
errorState
```

Server-returned data may naturally be held by the client for rendering.

Holding server data in client state does not make the client responsible for deriving business values from it.

---

## 27. Testing Strategy

### 27.1 Unit Tests

Unit tests are required for business logic.

Important test subjects include:

* target-price-distance calculation;
* investment-factor calculation;
* factor summation;
* savings allocation;
* invested-total calculation;
* dividend normalization;
* dividend-yield calculation;
* currency-unit normalization;
* market-cap USD conversion;
* business validation.

Business calculations should be implemented so they can be tested without:

* Cloudflare;
* KV;
* Yahoo Finance;
* Frankfurter;
* network access.

New or changed business rules SHOULD be accompanied by corresponding unit tests.

### 27.2 Integration Tests

Integration tests may be added selectively.

External infrastructure should normally be represented by test doubles/mocks/fakes.

A dedicated deployed test environment is not required for the initial project.

### 27.3 End-to-End Tests

Automated E2E testing is initially out of scope.

Cloudflare Access, deployment, Yahoo Finance, and Frankfurter may instead be verified through a small manual deployment smoke-test procedure.

This decision may be revisited as the application grows.

---

## 28. External Dependency Strategy

External systems must be treated as replaceable infrastructure.

Application and domain logic shall depend on application-owned abstractions rather than provider-specific response models.

In particular:

```text
MarketDataProvider
        |
        v
YahooFinanceAdapter
```

and:

```text
ExchangeRateProvider
        |
        v
FrankfurterAdapter
```

This allows providers to be replaced later without redesigning investment-domain logic.

Yahoo Finance is considered the highest-risk external dependency because its API is unofficial and may change without notice.

---

## 29. Security Principles

The application shall follow these rules:

1. Authentication is performed by Cloudflare Access.
2. User identity is derived server-side.
3. Client-supplied user IDs are never trusted.
4. All persisted user data is scoped by authenticated user ID.
5. Cloudflare KV is accessed only from server-side code.
6. Yahoo credentials, cookies, crumbs, or equivalent secrets are never exposed to the browser.
7. Secrets are never committed to source control.
8. External input and mutation payloads are validated server-side.
9. Provider/internal error details are not directly exposed to users.

---

## 30. Empty and Error States

The UI should explicitly represent meaningful empty/error states.

Examples:

### No Watchlists

Display an explanatory message such as:

> No watchlist has been created yet.

The delete-watchlist action is disabled.

### Empty Watchlist

Display an explanatory empty state instead of an empty table containing only headers.

### Partial Market Data

Display the stock while unavailable market-data fields use placeholders.

### Yahoo Unavailable

Display an understandable market-data error.

### FX Provider Unavailable

Continue displaying available non-FX-dependent information and indicate that currency-converted values are currently unavailable.

---

## 31. Future Improvements

The following ideas are intentionally left open:

* automatic investment recalculation after relevant changes;
* market-data caching;
* exchange-rate caching;
* explicit market-data refresh action;
* alternative market-data providers;
* additional authentication mechanisms;
* more sophisticated account management;
* watchlist sharing;
* collaborative features;
* automated E2E testing;
* more advanced investment-allocation strategies;
* dedicated mobile stock-card representation or responsive column selection.

These are not part of the initial implementation unless introduced through a later architectural decision or task.

---

## 32. Yahoo Finance Integration Decision

`yahoo-finance2` is the accepted Yahoo Finance integration.

Version 4.0.2 was validated against representative international stocks
and successfully executed inside the Cloudflare Workers `workerd` runtime.

The library automatically handles the Yahoo cookie/crumb mechanism. No
user-provided Yahoo cookie is required.

The integration must observe the following constraints:

- single-symbol lookups may return `undefined` for unknown symbols instead
  of throwing an error;
- batch results must be compared with the requested symbols to identify
  missing results;
- missing Yahoo fields must be handled explicitly;
- Yahoo-specific behavior remains isolated behind `MarketDataProvider`;
- Cloudflare runtime compatibility must be re-evaluated before relying on
  additional `yahoo-finance2` modules;
- Yahoo remains an unofficial external dependency and failures or
  rate-limiting must be handled as provider failures.

The spike and supporting evidence are documented in
`docs/spikes/002-yahoo-finance.md`.

---

## 33. Architecture Summary

The target architecture is deliberately small:

```text
Cloudflare Access
       |
       v
SvelteKit
  |
  +-- Svelte UI
  |
  +-- Server Routes
       |
       +-- Domain/Application Logic
       |
       +-- Cloudflare KV
       |
       +-- Yahoo Finance
       |
       +-- Frankfurter
```

The core architectural principles are:

> **Thin client, server-owned business logic.**

> **User identity comes from Cloudflare Access, never from client input.**

> **Target prices belong to User + Symbol, not to Watchlists.**

> **Watchlist membership and target-price persistence are independent.**

> **External APIs are isolated behind application-owned provider boundaries.**

> **Business calculations are pure and unit-testable wherever possible.**

> **Infrastructure remains intentionally small and should operate within free usage tiers.**
