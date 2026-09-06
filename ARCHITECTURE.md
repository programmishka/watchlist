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

**Production (TASK-026, superseding TASK-008's `ctx.access` mechanism):** This Worker deploys with Static Assets (`assets.binding`/`assets.directory` in `wrangler.jsonc`), and current Cloudflare documentation states that Workers with Static Assets execute behind an internal router Worker that does not forward `ctx.access` to the user Worker — Access still protects the deployment, but the native `ctx.access` API is unavailable to application code in this topology. Production authentication therefore derives identity from the `Cf-Access-Jwt-Assertion` header Access attaches to every authenticated request, cryptographically verified with `jose` against Cloudflare's JWKS (`<ACCESS_TEAM_DOMAIN>/cdn-cgi/access/certs`, fetched via `createRemoteJWKSet`, never hardcoded keys), with explicit issuer (`ACCESS_TEAM_DOMAIN`) and audience (`ACCESS_AUD`) validation and normal JWT expiration enforcement. The verified `sub` claim is used as the application user ID; the verified `email` claim is optional display metadata only. Any verification failure — missing header, bad signature, wrong issuer/audience, expired token, or JWKS retrieval failure — fails closed to unauthenticated without distinguishing the reason to the client.

**Configuration ownership (TASK-028, superseding TASK-027's dashboard-Text-variable model):** `ACCESS_TEAM_DOMAIN`/`ACCESS_AUD` are managed exclusively as Cloudflare Worker **Secrets** (Settings → Runtime variables and secrets → Type: Secret), never as `wrangler.jsonc` `vars` — real Access values must never be committed to the repository, and placeholder values must never be substituted in `wrangler.jsonc` merely to satisfy tooling. They were originally ordinary dashboard Text variables (TASK-027); that caused Wrangler remote-variable override conflicts on deploy, which is why they were changed to Secrets. Using Secret bindings is a deployment-ownership choice, not a claim that these two values are highly sensitive credentials. `wrangler.jsonc` declares `secrets: { required: ["ACCESS_TEAM_DOMAIN", "ACCESS_AUD"] }` — a names-only declaration (Wrangler 4.128.0), never values — which lets `wrangler types` generate them directly on `Env` as required `string` properties. Ordinary `wrangler deploy` does not delete or prompt to delete Secrets (unlike `vars`), so `keep_vars` is no longer needed and has been removed; there are no other dashboard-managed ordinary variables in this project. A narrow, application-owned `AccessEnvironment` type (`src/lib/server/auth/CloudflareAccessJwtAuthenticationContext.ts`) still declares the two properties (as optional) so the production authentication factory depends only on what it needs, independent of `Env`'s other bindings (`WATCHLIST_KV`/`ASSETS`); `App.Platform.env` (`src/app.d.ts`) now uses the generated `Env` directly since it already includes both properties. Neither the generated required-`string` type nor this narrow type establishes trust — missing/empty configuration is still validated at runtime and fails closed rather than falling back to any identity, exactly as before this task.

**Local development:** `npm run dev` uses a fixed synthetic development identity (`local-development-user`), selected exclusively by the trusted, build-time `dev` flag (`$app/environment`) — never by request-controlled input (headers, cookies, query parameters) — so local development requires no Cloudflare OTP. This is an intentional, documented difference from production, not a security bypass: the same flag can never evaluate to `true` in a deployed Worker.

Application code does not parse or validate Access JWTs itself outside the small `CloudflareAccessJwtAuthenticationContext` boundary described above; the rest of the application only ever consumes the resulting application-owned `AuthenticatedUser` via `event.locals.user`.

Absence of a valid production identity (missing/invalid JWT, missing configuration) MUST be treated as unauthenticated. Production MUST NOT fall back to an anonymous, hard-coded, or development identity. Absence of a valid identity always fails closed.

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

This composition is performed by a read-only server-side query/composition
step. It never mutates Watchlists, Target Prices, market data, or exchange
rates. Composed stocks preserve the symbol order stored in the Watchlist,
regardless of the order market data is returned in.

Derived values produced by this query, per stock, include:

* market cap in billions USD;
* dividend yield;
* distance to target.

Investment factor and savings amount are explicitly NOT part of this
per-Watchlist query. They belong to the separate, user-triggered investment-
allocation workflow described in §22, which operates on the already-composed
stocks rather than being computed as part of loading a Watchlist.

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

**Normalization and syntax validation (TASK-029, superseding TASK-012's
casing decision — see §12.1.1 below):** the server normalizes the raw input
— trim, then uppercase, in that order — and validates the normalized result
against the stock-symbol grammar:

```text
^[A-Z0-9]+(?:[.-][A-Z0-9]+)*$
```

before ever contacting the market-data provider. `.` and `-` are accepted
only as separators between non-empty alphanumeric components (numeric
components are supported, e.g. `0700.HK`, `7203.T`); empty input,
whitespace-only input, and repeated/mixed/leading/trailing separators
(`SAP..DE`, `SAP--DE`, `.SAP`, `SAP.`) are rejected. No arbitrary maximum
length is imposed. This rule is implemented once, as a small pure/dependency-
free module usable from both server and browser code (`$lib/shared/`, never
`$lib/server/`, so the browser can apply the same UX-optimization check —
see §26.3), and is authoritative only on the server.

A syntactically invalid symbol is rejected immediately as `InvalidSymbolError`
(`INVALID_STOCK_SYMBOL` at the HTTP boundary, §24.3) — the market-data
provider is never called for it. Only a syntactically valid, normalized
symbol proceeds to provider-backed validation using the configured
market-data provider's existing `getQuote()` lookup.

If that lookup succeeds, the **normalized** symbol — not the raw input, and
not the provider-returned symbol — is added to the current watchlist and is
what gets persisted. The provider-returned symbol remains evidence the
lookup succeeded, not a canonicalization instruction. The market data
retrieved for this validation is transient and is not persisted; the next
watchlist query retrieves current market data normally.

If the provider does not recognize the (syntactically valid) symbol, the
addition is rejected as `UNKNOWN_STOCK_SYMBOL` — distinct from a syntax
failure. If the provider itself is unavailable, that is a distinct provider
failure (`MARKET_DATA_UNAVAILABLE`) from either a syntax failure or an
unrecognized symbol, and the addition is likewise rejected rather than
silently succeeding.

Because newly added symbols are now uppercase-canonical, `AAPL`/`aapl`/`AaPl`
entered as new additions all normalize to the same stored symbol, and a
second such addition is rejected as a normal duplicate (§12.2) — there is no
separate case-insensitive duplicate mechanism. TASK-029 introduces no
migration: Watchlists/documents persisted before TASK-029 may still contain
non-canonical (e.g. lowercase) symbols, and those are left unchanged until a
future task explicitly addresses them.

#### 12.1.1 Product Scope: Equities

V2's intended scope is:

> Watchlist manages equities representing companies that can be individually
> valued.

ETFs, options, funds, cryptocurrencies, and other non-equity instruments are
outside the intended product scope. TASK-029 establishes only normalization
and syntax validation; it deliberately does not enforce this at the
provider/data level (e.g. rejecting a syntactically valid but non-equity
symbol). Provider-backed equity enforcement is implemented by TASK-030,
described next.

#### 12.1.2 Provider-Neutral Equity Resolution (TASK-030)

TASK-030 adds the semantic admission step syntax validation alone cannot
provide:

```text
TASK-012 (superseded)
getQuote-based admission validation (symbol exists)
        ↓
TASK-029
normalization + syntax validation
        ↓
TASK-030
provider-neutral equity resolution (symbol exists AND is a supported equity)
```

> A syntactically valid stock identifier is eligible for addition only when
> the configured `MarketDataProvider` resolves the exact normalized symbol as
> a supported equity.

This is expressed as a provider-neutral contract:

```ts
interface ResolvedMarketSymbol {
  symbol: string;
}

interface MarketDataProvider {
  resolveSymbol(symbol: string): Promise<ResolvedMarketSymbol | undefined>;
}
```

`resolveSymbol()` and `getQuote()`/`getQuotes()` serve different purposes and
are not interchangeable:

```text
resolveSymbol()
→ admission/existence/instrument-class check, used only when adding a new
  stock to a Watchlist

getQuote()/getQuotes()
→ current market-data retrieval, used for composing an already-persisted
  Watchlist (§15.3); never re-runs equity resolution
```

A resolved result means the exact requested symbol is a supported equity. An
`undefined` result means either that the symbol is unknown to the provider,
or that the provider recognizes it as a non-equity instrument (ETF, fund,
option, future, index, cryptocurrency, etc.) — `AddStockToWatchlistService`
does not distinguish these two cases; both surface as the existing
`UnknownStockSymbolError` / `UNKNOWN_STOCK_SYMBOL` (§24.3). A genuine
provider failure remains a distinct `MarketDataProviderError` /
`MARKET_DATA_UNAVAILABLE` and is never converted to a resolution failure.
`resolveSymbol()` requires exact symbol identity — it never accepts a
provider-returned alias or a fuzzy/canonicalized match, and the
already-normalized input symbol (not any provider-returned symbol) is what
gets persisted, unchanged from TASK-029.

The Yahoo implementation (`YahooFinanceAdapter.resolveSymbol()`) uses the
existing `quote()` module — no additional `yahoo-finance2` module and no
Yahoo Search are used. It checks that the response's `symbol` field exactly
equals the requested symbol and that its `quoteType` field equals `"EQUITY"`
(verified against installed `yahoo-finance2@4.0.2`'s `quote.d.ts`/
`quote.schema.d.ts`, which discriminates quote responses by `quoteType`
across values including `EQUITY`, `ETF`, `MUTUALFUND`, `OPTION`, `FUTURE`,
`INDEX`, `CRYPTOCURRENCY`, and `CURRENCY`). Both `quoteType` and the
exact-match check are internal to the adapter — application/domain code
never queries `quoteType` itself. Because this reuses the already-verified
`quote()` module and compatibility flags, no additional Cloudflare/workerd
verification beyond TASK-002's existing spike was required.

TASK-030 does not migrate or revalidate existing persisted Watchlist
symbols; it governs new stock additions only.

Adding a stock does not create, update, or load a target price. If a target price already exists for:

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

The table columns, in their final presentation order (TASK-033, superseding
TASK-017's original order/labels below), are:

1. Symbol;
2. Name;
3. `Market Cap (USD bn)`;
4. Price;
5. Currency;
6. `Dividend Yield`;
7. Target Price;
8. Distance to Target;
9. Savings Amount;
10. `Actions`.

Currency is positioned directly after Price so the price value and its
quoting currency are visually associated. `Market Cap (USD bn)` and
`Dividend Yield` replace the original abbreviated `Cap (USD)`/`Div` labels
to make the unit (billions of USD) and the percentage-yield nature of the
value explicit. `Actions` replaces the original `Delete` header — the
row-level remove control is presentationally one action inside that column,
not the column's own identity. None of this reorders the underlying
Watchlist symbol order (§9.5) or changes any server-computed value; it is
presentation only. See §26.10 for the full presentation/formatting rules.

### 13.1 Sorting

All eight stock-data columns (symbol, name, market cap in billions USD,
price, currency, dividend yield, target price, distance to target) may be
sorted through interactive headers, regardless of their display position.
The `Actions` column is not sortable.

Sorting is a client-side presentation concern operating only on the stock
data already loaded in the browser; it performs no API request.

**Default sort (TASK-032, superseding TASK-023's "initial state is
unsorted" rule below only for the reset/default state):** the default
stock-table presentation sort for every newly active Watchlist is company
Name ascending. This is a real active sort state, not merely a reordering of
rows: the Name column reports `aria-sort="ascending"` immediately, and a
subsequent click on Name therefore toggles to descending rather than
activating ascending again. Concretely:

```text
initial active Watchlist load
→ Name ascending

active Watchlist changes (tab switch, create, delete replacement)
→ Name ascending

same-Watchlist mutation (add/remove stock, Target Price save, filtering,
investment allocation)
→ preserve the current sort, whatever it is
```

There is no per-Watchlist sort memory: every active-Watchlist transition
resets to Name ascending regardless of what was manually selected on the
previously active Watchlist. This default sort is purely a client-side
presentation concern like the rest of §13.1 — it does not reorder or persist
the underlying Watchlist symbol order, does not affect the REST
response/composition order (§9.5), and introduces no server-side sorting.

Activation rules (TASK-023, still authoritative for all manual interaction):

* the first click on a sortable header activates ascending sorting on that
  column (or, from the Name-ascending default, toggles Name to descending —
  see above);
* clicking the currently active column again toggles between ascending and
  descending; there is no third/unsorted state once a column is active;
* clicking a different column switches to that column, always starting
  ascending.

String columns (symbol, name, currency) compare using a locale-aware,
case-insensitive comparison; the full symbol string is compared, without
splitting exchange suffixes or punctuation, and currency compares the
displayed application value (e.g. `GBp` is never converted to `GBP` for
sorting). Numeric columns compare raw underlying values, never formatted
display strings; non-finite numeric values are treated as missing for this
presentation-only purpose. Missing optional values always sort last in both
directions; `0` is a real value and never treated as missing. Sorting is
stable, preserving the original relative order of the filtered input for
equal sort values.

Filtering happens before sorting: the pipeline is
`activeView.stocks -> filterStocksByCompanyName -> sortWatchlistStocks ->
visibleStocks`. Sorting never affects `totalStockCount`/`filteredStockCount`,
which remain derived from `activeView.stocks`/`filteredStocks`. Sort state
resets to the Name-ascending default (see above) whenever the active
Watchlist itself changes (tab switch, Watchlist creation, deletion
transition) but is preserved across same-Watchlist mutations (Target Price
update, stock add/remove), with affected rows repositioning to their new
sorted location.

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

The table footer displays an explicit `Total: N stock(s)` count of stocks in
the current Watchlist (TASK-033, superseding TASK-022's original compact
`N of M stocks` wording), and, only while a company-name filter is active,
an additional `· Filtered: M stock(s)` count. Both counts pluralize
independently and are derived directly from `activeView.stocks.length`/
`filteredStocks.length` (§26.5) — sorting never affects either count. See
§26.10.

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

**Table-overflow strategy evolution (TASK-034, refining the above and
superseding TASK-025's acceptance that desktop scrolling was unremarkable):**

> Horizontal table scrolling is the fallback for constrained viewport width,
> not the preferred behavior on a sufficiently wide desktop display.

The table container's horizontal-scroll mechanism itself is unchanged and
still required for exceptional content (e.g. an unusually long company name)
on a wide desktop viewport. What changed is that the page and table are now
sized so the normal, deterministic column set fits within a wide desktop
viewport without needing that fallback at all. See §14.4 and §26.11 for the
concrete strategy.

**Superseded by TASK-036 for normal tablet/mobile usage.** The paragraph
above ("allow horizontal scrolling on narrow viewports... do not introduce a
separate mobile card representation") described the *original* mobile/tablet
strategy. TASK-036 replaces it: below an empirically selected breakpoint,
Stock Cards are the normal presentation instead of a horizontally scrollable
table. See §14.6 and §26.13 for the current responsive stock-presentation
rule. Horizontal table scrolling remains only as the wide-desktop exceptional-
content fallback described immediately above.

### 14.3 Accessibility

Interactive controls must remain keyboard-accessible and usable across
supported viewport sizes.

For complex interactive controls such as modal confirmation dialogs,
prefer native platform capabilities or accessible Svelte-native headless
components over implementing accessibility behavior from scratch.

### 14.4 Compact Data-First Workspace (TASK-034)

The Watchlist UI is a data-first financial workspace: the stock table is the
primary working surface, and controls exist to manipulate or inspect it, not
to dominate the viewport. Controls are kept compact and content-aware (sized
for their expected input, e.g. a ticker symbol vs. a company-name search
term) so the table receives layout priority rather than being squeezed into
whatever space forms and management chrome leave behind.

The responsive strategy by viewport class:

```text
wide desktop
→ compact, mostly-horizontal controls in one toolbar row
→ the table normally fits without horizontal scrolling

medium/tablet
→ toolbar controls wrap into logical groups across more than one row
→ the table may still need to scroll internally

mobile
→ toolbar controls stack, each remaining independently reachable
→ the table always scrolls internally
→ the page itself never scrolls horizontally
```

This is achieved without a new breakpoint system (§14.1 still applies): the
page's usable width, the toolbar's flex-based grouping, and the table's
column widths (§26.11) all respond continuously to available space rather
than switching behavior at fixed pixel thresholds, with 375/768/1280/1600px
used only as representative verification widths.

### 14.5 Responsive Watchlist Navigation (TASK-035, superseding the horizontal tab-scrolling strategy from TASK-016 and TASK-034 described below)

> The active Watchlist is always directly visible in navigation. Inactive
> Watchlists may move into a responsive overflow menu.

TASK-016 established a horizontally scrollable Watchlist tab strip (§26.1),
and TASK-034 kept that mechanism while compacting the surrounding chrome
(§26.11). With enough Watchlists, that strip could scroll the active tab out
of view — especially right after activating it — with no other indication of
which Watchlist was active, since TASK-034 had already removed the duplicate
active-Watchlist heading. Horizontal scrolling is therefore no longer used as
the Watchlist-navigation overflow strategy:

> Horizontal scrolling is not the primary Watchlist-navigation overflow
> mechanism. A bounded set of Watchlists is displayed directly; the rest move
> into an overflow disclosure.

Final responsive direct-tab capacity policy, derived from viewport width via
`matchMedia` (`src/lib/client/watchlistNavigation.ts`):

```text
width < 768px    -> 1 direct tab  (mobile: active Watchlist only)
768px-1279px     -> 5 direct tabs (medium desktop/tablet)
width >= 1280px  -> 8 direct tabs (wide desktop)
```

These breakpoints intentionally align with the project's existing
375/768/1280/1600px representative verification widths (§14.4) rather than
introducing a new breakpoint system.

The active Watchlist always consumes one of the direct slots; when necessary,
the earliest otherwise-visible inactive Watchlist moves to overflow to make
room for it. The direct/overflow split is computed by a pure, dependency-free
helper, `partitionWatchlistsForNavigation(watchlists, activeWatchlistId,
capacity)`, that preserves the server-supplied Watchlist order (§9.2) in both
the returned `visible` and `overflow` arrays, is deterministic, and performs
no DOM measurement. This is client presentation state only: it does not
reorder or persist Watchlists, and a viewport resize that crosses a capacity
breakpoint recomputes the split locally without any server request.

### 14.6 Responsive Stock Presentation (TASK-036)

> Wide viewports use the stock table for efficient cross-stock comparison.
> Constrained viewports use Stock Cards to avoid horizontal data scrolling.

This supersedes §14.2's original mobile/tablet strategy ("allow horizontal
scrolling on narrow viewports... do not introduce a separate mobile card
representation") for normal tablet/mobile usage, and completes the
responsive stock-presentation evolution started by TASK-034 (§14.4, §26.11):

```text
wide desktop
→ table (unchanged from TASK-033/TASK-034)

constrained (tablet/mobile)
→ Stock Cards (TASK-036), not a horizontally scrolling table
```

**Breakpoint.** The switch happens at a single, empirically selected width:

```text
< 1120px  -> Stock Cards
>= 1120px -> stock table
```

This value was measured, not guessed: the table's `table-layout: fixed`
column set has a `min-width: 68rem` (1088px, TASK-034 §42-45), and the page
reserves `2rem` (32px) of horizontal inset around it (§26.11), so the table
stops requiring horizontal scrolling only once the viewport reaches
`68rem + 2rem = 70rem` (1120px) — confirmed by measuring the table
container's `scrollWidth`/`clientWidth` across widths from 768px to 1600px
before choosing this value, rather than reusing an arbitrary framework
breakpoint or the existing 768/1280px Watchlist-navigation breakpoints
(§14.5). The pure mapping lives in `stockPresentationModeForWidth()`
(`src/lib/client/watchlistPresentation.ts`), independent of any DOM/browser
API and unit-tested directly.

**Shared pipeline, presentation-only fork.** Table and Cards consume the
exact same derived stock collection:

```text
activeView.stocks
        -> filterStocksByCompanyName
        -> sortWatchlistStocks
        -> visibleStocks
                /       \
            table      cards
```

`WatchlistCards.svelte` (`src/lib/components/`) is a new, dedicated
presentational component. It receives `visibleStocks` exactly like
`WatchlistTable.svelte` and renders it in the same order (no independent
sort/filter). Both components share the same client `WatchlistStock`
representation, key rows/cards by `symbol`, reuse `TargetPriceCell` verbatim
for Target Price editing, reuse the existing formatters (`formatNumber`,
`formatPercentage`, `formatSignedPercentage`, `formatWholeEuro`, plus a new
`formatPriceWithCurrency` that combines Price/Currency into one Card value),
and reuse a newly extracted shared `distanceStateFor()`
(`src/lib/client/distancePresentation.ts`) for the favorable/unfavorable/
neutral Distance-to-Target classification that previously lived only inside
`WatchlistTable.svelte` — extracted specifically so Table and Cards cannot
drift apart on this value-oriented rule (§26.10). A shared
`SORTABLE_STOCK_COLUMNS` constant (`src/lib/client/sortableStockColumns.ts`)
is the single source of the eight sortable columns/labels used by both the
table's sortable headers and the Card sort control below.

**Card sorting.** Sortable table headers don't exist in Card mode, so
`WatchlistCards` renders an explicit compact sort control (a labelled
`<select>` of the same eight sortable columns, plus a direction toggle
button with an accessible name reporting current state, e.g. `Sort
direction: ascending`) instead. Both controls manipulate the *same*
`WatchlistSort` client state and the *same* `toggleWatchlistSort()`/
`sortWatchlistStocks()` functions as the table (§26.6) via one `onSort`
callback prop — selecting a different column always starts ascending, and
the direction button re-invokes `onSort` with the *already-active* column,
which `toggleWatchlistSort` reverses. There is no separate `cardSort` state,
no second sort implementation, and sorting remains strictly raw-value based
(never formatted strings) in both presentations. The Name-ascending default
(TASK-032) and missing-last semantics (TASK-023) apply identically.

**Presentation switch is local-only.** `+page.svelte` derives which
component to render from the real browser viewport width via
`stockPresentationModeForWidth(window.innerWidth)`, guarded by `$app/
environment`'s `browser` flag so it never touches `window` during SSR
(defaulting to the table, matching pre-TASK-036 behavior) — the same
SSR-safety pattern already used by `WatchlistTabs`' capacity computation
(§26.12). A `matchMedia` listener at the single breakpoint recomputes this
on resize. Unlike Watchlist-navigation capacity, this cannot be left to CSS
alone: `WatchlistTable` and `WatchlistCards` each mount their own per-stock
`TargetPriceCell`/remove-button instances, so having both simultaneously
present (even with one hidden via `display:none`) would risk duplicate
interactive controls being discoverable in the accessibility tree. `+page
.svelte` therefore renders the two components through a single mutually
exclusive `{#if}`, so exactly one presentation — and exactly one set of
per-stock interactive controls — is ever mounted at a time. Crossing the
breakpoint on resize preserves the active Watchlist, filter text, sort
column/direction, allocation result, and Target Price state, and never
issues a Watchlist/stock/Target-Price/allocation request — it is exactly as
local as the existing Watchlist-navigation capacity recomputation (§14.5).

**No horizontal stock-scrolling in Card mode.** Cards flow vertically in a
CSS grid (one column at narrow widths, two once the Card-mode range is wide
enough for each to remain comfortably readable, per a `min-width: 56rem`
media query — never forced at Card mode's own narrower end, e.g. 768px, and
never more than two), preserving the supplied order (`{#each stocks as stock
(stock.symbol)}` with no reordering). The table's existing defensive
horizontal-scroll container (§14.2) is retained for wide-desktop exceptional
content; it is irrelevant to Card mode, which never renders it.

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

Ordinary Watchlist loading uses only `getQuote()`/`getQuotes()`. It never
calls `resolveSymbol()` (§12.1.2), which is exclusively the admission check
for adding a new stock; persisted symbols are not re-validated as equities
on every load.

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

Specifically, when the FX provider fails globally, stocks whose market
capitalization is already in USD remain calculable (USD -> USD requires no
external rate), while non-USD market caps become unavailable. Other
Yahoo/Target-Price-derived fields (price, currency, dividend yield, distance
to target) remain available regardless of FX provider status. The composed
query result carries an explicit warning/status distinguishing "the FX
provider failed globally" from "an individual market cap is unavailable",
so the UI indication above is driven by real query-level state rather than
being inferred solely on the client.

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

Setting a target price for a `User + Symbol` that already has one replaces
the existing value; there is exactly one current target price per
`User + Symbol`, and no target-price history is kept.

There is currently no target-price delete use case. A target price can be
created or replaced, but not explicitly deleted by the user.

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

Examples:

| Price | Target | Distance |
| ----: | -----: | -------: |
|    80 |    100 |     -20% |
|   100 |    100 |       0% |
|   120 |    100 |     +20% |

A negative distance means the current market price is below the target price.

### 21.1 Distance Availability (TASK-031, superseding TASK-003's use of `0` as a missing-data sentinel)

> Target Price distance is optional derived data. It exists only when both current market price and Target Price are valid positive finite values and the resulting calculation is finite.

```ts
type DistanceToTarget = number | undefined;
```

A numeric distance is produced only when `regularMarketPrice` and `targetPrice` are both present, finite, and strictly greater than zero, and the division itself produces a finite result. Missing, zero, negative, non-finite, or otherwise invalid inputs — or a non-finite result — produce `distanceToTarget = undefined`, never a fabricated `0`. This is a correctness fix for a production defect: a stock with no current market price previously composed a spurious, sometimes very large, `distanceToTarget` percentage; it must instead compose `undefined`, displayed as `—` (§30).

> `distanceToTarget = 0` is a real calculated value meaning current market price equals Target Price. It is never used as a missing-data sentinel.

Nullable semantics are established once, in the pure `calculateTargetPriceDistance` domain function, and survive unchanged through Watchlist composition, the REST response, the client model, and the UI — no layer along that path converts an unavailable distance back to `0` (§24.6, §26.4). The one deliberate exception is the pure `calculateInvestmentFactor` formula (§22.2), which — per established legacy semantics predating TASK-031 — treats both `0` and `undefined` as "does not participate," collapsing them to `factor = 0`; this does not reintroduce the ambiguity upstream, since `distanceToTarget` itself still distinguishes the two states everywhere else.

---

## 22. Investment Allocation

Investment allocation is explicitly triggered by the user.

The user enters the total available savings amount as a whole-Euro amount and starts the calculation.

The calculation uses **all stocks in the currently selected watchlist**.

The current table filter MUST NOT influence investment allocation.

Investment allocation is implemented as an explicit, server-side application
use case, not merely a set of pure formulas. It obtains the current
Watchlist by consuming the existing read-only Watchlist composition
(§9.5) rather than independently loading Watchlist membership, Target
Prices, market data, or exchange rates. It reuses the `distanceToTarget`
already produced by that composition as the input to the factor formula
below; it does not recompute target-price distance itself. Because the
pure factor/allocation/invested formulas operate positionally, the
application layer is responsible for associating each resulting factor and
savings amount back to its stock symbol, in the same order the Watchlist
composition already returns.

Investment allocation depends only on `distanceToTarget`, not on market
capitalization or currency conversion. A global FX-provider outage — which
leaves `marketCapBillionsUsd` unavailable but does not affect
`distanceToTarget` (§17.3) — therefore does not prevent investment
allocation from completing normally.

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

Following the existing semantics, a missing/falsy distance produces factor `0`. An unavailable Target Price distance (`undefined`, §21.1) results in investment factor `0` and therefore no savings allocation for that stock, without preventing other valid stocks from participating.

Conceptually:

```ts
function calculateFactor(targetPriceDistance?: number) {
  if (!targetPriceDistance) {
    return 0;
  }

  return 1 / (1 + targetPriceDistance);
}
```

`!targetPriceDistance` is true both for a real zero distance and for an unavailable (`undefined`) distance, so both currently yield `factor = 0` — this is pre-existing, intentional legacy behavior (TASK-003/TASK-014), not a reintroduction of the `0`/unavailable ambiguity: `distanceToTarget` itself keeps the two states distinct everywhere upstream of this formula (§21.1), and this task does not change the formula.

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

**UI terminology (TASK-034):** the UI presents this value under the label
`Allocated savings` rather than `Invested`, since the application has not
executed an actual investment — the label was potentially misleading. This
is a presentation-only rename: the REST field name (`invested`), the
formula above, and the client model type are unchanged; only the rendered
UI text differs from the field name it displays.

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

Principles:

* use simple resource-oriented endpoints;
* use JSON request/response bodies;
* do not introduce GraphQL;
* do not introduce an additional RPC framework without a demonstrated need;
* never expose persistence implementation details;
* never require a client-provided user ID for user-owned resources;
* validate all mutation input server-side;
* return understandable application errors rather than raw provider or infrastructure exceptions.

### 24.1 Implemented Endpoints

```text
GET    /api/watchlists
POST   /api/watchlists
PUT    /api/watchlists/active
DELETE /api/watchlists/active
GET    /api/watchlists/{watchlistId}
POST   /api/watchlists/{watchlistId}/stocks
DELETE /api/watchlists/{watchlistId}/stocks/{symbol}
PUT    /api/target-prices/{symbol}
POST   /api/watchlists/{watchlistId}/investment-allocation
```

There is intentionally no `GET /api/target-prices` or `GET /api/target-prices/{symbol}`. Target Prices are only ever observed as part of a composed Watchlist (`GET /api/watchlists/{watchlistId}`); the Target Price service otherwise remains an internal application capability.

Mutation endpoints return the resulting UI-useful state (updated Watchlist metadata, or the updated composed Watchlist) so the client does not need an immediate follow-up `GET`.

### 24.2 Authentication

Every endpoint above requires an authenticated user, derived exclusively from `event.locals.user.id` (populated by the server hook introduced in TASK-008 and updated by TASK-026 — see §8.2 — from Cloudflare Access in production, or the synthetic development identity locally). A request with no authenticated user receives `401 UNAUTHENTICATED`. The user ID is never accepted from a query parameter, request body, or URL path segment.

### 24.3 API Error and Warning Shape

Errors use a stable JSON shape independent of internal exception class names:

```json
{ "error": { "code": "DUPLICATE_SYMBOL", "message": "The symbol already exists in this watchlist." } }
```

Supported codes: `UNAUTHENTICATED`, `INVALID_REQUEST`, `WATCHLIST_NOT_FOUND`, `NO_ACTIVE_WATCHLIST`, `INVALID_WATCHLIST_NAME`, `INVALID_SYMBOL`, `INVALID_STOCK_SYMBOL`, `UNKNOWN_STOCK_SYMBOL`, `DUPLICATE_SYMBOL`, `SYMBOL_NOT_FOUND`, `INVALID_TARGET_PRICE`, `INVALID_TOTAL_SAVINGS`, `MARKET_DATA_UNAVAILABLE`, `PERSISTENCE_ERROR`, `INTERNAL_ERROR`. Business/domain/provider exception classes remain independent of HTTP; one small server-side mapping helper centralizes the translation to status + code + message, so routes never expose raw Yahoo/Frankfurter/Cloudflare errors or reproduce this mapping themselves.

`INVALID_STOCK_SYMBOL` (TASK-029) is specifically the stock-add syntax-validation failure (§12.1) and is distinct from `UNKNOWN_STOCK_SYMBOL` (syntactically valid, provider does not recognize it) and `MARKET_DATA_UNAVAILABLE` (provider itself failed). `INVALID_SYMBOL` remains a separate, narrower code used only by the Target Price `symbol` path parameter (empty/whitespace-only check, §20) — it does not apply the stock-symbol grammar and was intentionally left unchanged by TASK-029.

Non-fatal degraded conditions (e.g. the FX provider being globally unavailable, or a post-save market-data refresh failing) are represented as warnings on an otherwise-successful response, using the same stable-code principle: `FX_PROVIDER_UNAVAILABLE`, `MARKET_DATA_UNAVAILABLE`.

### 24.4 Composition Root

Concrete infrastructure (Cloudflare KV repositories, the Yahoo adapter, the Frankfurter adapter) is wired server-side by a small per-request composition root/factory, constructed from the current request's Cloudflare platform bindings (`event.platform.env.WATCHLIST_KV`). Routes depend on this factory rather than instantiating infrastructure themselves or duplicating KV/Yahoo/Frankfurter logic. If the required platform binding is unavailable, service construction fails rather than silently falling back to an in-memory substitute.

### 24.5 Target Price Mutation and Market-Data Refresh

`PUT /api/target-prices/{symbol}` persists the Target Price first. It then attempts a market-data lookup to compute `distanceToTarget` for the response. A failed or unavailable lookup at this stage does **not** roll back or fail the already-successful save — the response still reflects the persisted Target Price, omits `distanceToTarget`, and carries a `MARKET_DATA_UNAVAILABLE` warning instead.

### 24.6 Numeric Representation

API numeric values (`price`, `targetPrice`, `distanceToTarget`, `dividendYield`, `marketCapBillionsUsd`) are plain JSON numbers, never locale-formatted strings. Locale-specific parsing and display formatting belong to the client.

### 24.7 Investment Allocation Endpoint

`POST /api/watchlists/{watchlistId}/investment-allocation` requires authentication like every other endpoint. The request body carries `totalSavings`, a non-negative whole-Euro JSON number; zero is valid. An invalid `totalSavings` is rejected with `400 INVALID_TOTAL_SAVINGS` before the request composes application services or contacts Yahoo/Frankfurter, avoiding unnecessary provider work.

The allocation itself is calculated entirely server-side. The response contains `totalSavings`, `invested`, and an `allocations` array of per-symbol `factor` and `savingsAmount` values. The result is computed on demand and is not persisted; it is not recalculated automatically and only reflects the Watchlist state at the moment of the request.

Market-data unavailability prevents the allocation entirely (the endpoint fails rather than returning a partial result), while an FX-provider failure does not — this is inherited unchanged from the underlying Investment Allocation domain service and is not re-implemented at the HTTP layer.

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

### 26.1 Application Shell (TASK-016)

The application is currently a single Svelte page (`src/routes/+page.svelte`) rather than a multi-route SPA. It establishes the production application shell: a title/header, a Watchlist tab strip, and an active-Watchlist content area.

Watchlist metadata (`GET /api/watchlists`) and the composed active Watchlist (`GET /api/watchlists/{id}`) are loaded as two separate requests, not one combined payload. Metadata drives tab rendering; the composed Watchlist drives the content area. This keeps the tab strip renderable/interactive independently of how long the (potentially Yahoo/FX-backed) composed Watchlist query takes.

Tabs are identified and keyed by Watchlist `id`, never by `name`, because Watchlist names may be duplicated (§9.2).

The server remains the source of truth for the active Watchlist. Switching tabs first persists the selection (`PUT /api/watchlists/active`) and only loads the newly selected composed Watchlist after that mutation succeeds — the client never optimistically treats an unpersisted tab as active. If the `PUT` fails, the previously active tab and its already-loaded content are kept and an inline error is shown. If the `PUT` succeeds but the subsequent composed-Watchlist `GET` fails, the newly selected tab remains active (persistence already succeeded) while the content area shows a load error.

Client-side Watchlist HTTP access is centralized behind a small client API module (`src/lib/client/watchlistApi.ts`), which owns endpoint URLs, HTTP methods, JSON parsing, and mapping the stable API error shape (`error.code`/`error.message`/HTTP status) into a `WatchlistApiError`. A separate, framework-agnostic orchestration module (`src/lib/client/watchlistShell.ts`) implements the initial-load and tab-switch flows described above as plain async functions over injected API calls and state-transition callbacks, independent of Svelte's reactivity so this orchestration logic is unit-testable without rendering a component. The Svelte page itself only holds UI-oriented `$state` (loading/error status, the current tab, the loaded views) and wires it to that orchestration module.

Tab controls are disabled while a Watchlist load (initial or tab-switch) is in flight, which also prevents out-of-order network responses from a superseded request from overwriting newer state.

Tab overflow on narrow viewports was originally handled with simple horizontal scrolling on the tab strip rather than a dropdown or other overflow menu. TASK-035 (§14.5, §26.12) later replaced this with responsive direct-tab-plus-overflow navigation once many-Watchlist testing showed the active tab could scroll out of view; the tab identity/keying, disabled-while-loading, and server-authoritative-selection rules described above are otherwise unchanged. No general-purpose CSS framework or component library was introduced; layout uses native Flexbox and a responsive content-width container.

### 26.2 Watchlist Management UI (TASK-019)

Creating and deleting Watchlists reuses the shell established in §26.1 rather than introducing a separate state-management layer. `src/lib/client/watchlistApi.ts` gains `createWatchlist(name)` (`POST /api/watchlists`) and `deleteActiveWatchlist()` (`DELETE /api/watchlists/active`); `src/lib/client/watchlistShell.ts` gains `createWatchlistAndActivate` and `deleteActiveWatchlistAndTransition`, following the same pattern as `switchActiveWatchlist`.

Both mutations treat the server response as the sole source of truth: the client never invents which Watchlist becomes active after creation, nor which Watchlist replaces the deleted one — it simply follows the returned `activeWatchlistId` and loads that composed Watchlist. No client-side replacement-selection algorithm exists. Deleting the last Watchlist (`watchlists = []`) stops after updating metadata and does not issue a composed-Watchlist `GET`.

`createWatchlistAndActivate` refuses an empty/whitespace-only name before calling the API, so the client never sends an obviously meaningless create request; the backend remains authoritative for all other name validation, including allowing duplicate names (tabs stay keyed by `id`, per §26.1).

Watchlist deletion requires confirmation. The UI uses a native `window.confirm()` dialog naming the active Watchlist rather than a custom modal/dialog library, per the project's preference for the smallest workable accessible implementation (§14.3). Cancelling sends no request and leaves existing state untouched.

A single derived "management busy" flag in `+page.svelte` — true while the active Watchlist content is loading, or a create/delete mutation is in flight — disables the create input/button, the delete button, and the tab strip together. This reuses the existing tab-disabling mechanism from §26.1 rather than introducing a generic request queue or separate concurrency-control abstraction.

### 26.3 Stock Management UI (TASK-020)

Adding and removing stocks on the active Watchlist follows the same shell pattern as §26.1/§26.2 rather than introducing a new state-management layer. `src/lib/client/watchlistApi.ts` gains `addStock(watchlistId, symbol)` (`POST /api/watchlists/{watchlistId}/stocks`) and `removeStock(watchlistId, symbol)` (`DELETE /api/watchlists/{watchlistId}/stocks/{symbol}`, with the symbol path segment `encodeURIComponent`-encoded); `src/lib/client/watchlistShell.ts` gains `addStockToActiveWatchlist` and `removeStockFromActiveWatchlist`.

Both mutation endpoints already return the complete updated composed Watchlist (§24.1), so both shell functions replace `activeView` directly from the mutation response and never issue a follow-up `GET /api/watchlists/{watchlistId}` — including when removal empties the Watchlist (`stocks = []`), which the existing empty-Watchlist UI (§12.4) already renders once `activeView` is replaced. A failed add or remove leaves the previous `activeView` untouched; a failed add additionally preserves the entered symbol input so the user can correct or retry it. `addStockToActiveWatchlist` refuses an empty/whitespace-only symbol before calling the API, trimming the symbol it does send; it performs no case normalization, canonicalization, or Yahoo-specific validation client-side — that remains entirely server-owned (§12.1).

Stock removal requires no confirmation, unlike Watchlist deletion (§11.2) — it is easily reversible (re-adding the symbol) and does not touch Target Price or broader Watchlist structure. Removing a stock never invokes any Target Price endpoint; Target Price persistence is untouched by Watchlist-membership mutation (§12.3), so a symbol removed and later re-added is composed with its existing Target Price again.

`WatchlistTable.svelte` gains a final `Delete` column and an `onRemove(symbol)` callback prop plus a `busy` prop; it remains presentational and still performs no API calls or knowledge of the active Watchlist ID. `+page.svelte` extends the existing `managementBusy` flag (§26.2) to also cover an in-flight stock mutation, so a stock add/remove disables the Watchlist create/delete controls and the tab strip, and conversely tab switching or Watchlist create/delete disables the add-stock form and row-removal buttons — reusing the single-busy-flag strategy rather than a generic request queue.

### 26.4 Target Price Editing UI (TASK-021)

Target Price is edited inline in the stock table rather than through a separate page or modal. The read-only Target Price cell in `WatchlistTable.svelte` is replaced by a small `TargetPriceCell.svelte` child component (one per row, keyed by symbol) that owns the row's transient editable text, a local parse/validation error, a market-data-unavailable warning, and a per-row saving/busy flag. It renders `<input type="text" inputmode="decimal">` rather than `<input type="number">`, because native numeric inputs have inconsistent locale handling of comma decimals; a missing Target Price renders as an empty input, never the `—` placeholder used elsewhere for non-editable missing values.

Locale input parsing is a client-side input-handling concern, not a business calculation: `src/lib/client/targetPriceInput.ts` exports a pure `parseTargetPriceInput(value): number | undefined` that trims whitespace, accepts `.` or `,` (but not both together) as the decimal separator, and rejects anything else — including bare `.`/`,`, non-numeric text, and zero/negative values — returning `undefined` for all of these. This mirrors the server's `finite && > 0` rule (§20) without introducing different client-side semantics.

The Target Price input commits on blur; Enter blurs the input (there is no separate keydown-triggered save path), so a single commit handler runs exactly once even when Enter is immediately followed by blur. A commit is skipped entirely (no API call) when the parsed value equals the last server-confirmed value, or when the input was and remains empty. Clearing an existing Target Price and attempting to commit does not call the API and does not delete anything — there is no Target Price delete endpoint or semantics; local validation feedback is shown instead and the previously persisted value stays represented in `activeView`.

`src/lib/client/watchlistApi.ts` gains `setTargetPrice(symbol, targetPrice)` (`PUT /api/target-prices/{symbol}`, symbol path-segment `encodeURIComponent`-encoded, numeric JSON body) and a `TargetPriceMutationResponse` type matching the existing TASK-013 response (`symbol`, `targetPrice`, optional `distanceToTarget`, `warnings`). `src/lib/client/watchlistShell.ts` gains `setTargetPriceForActiveStock`, which calls the API and merges only the matching symbol's `targetPrice`/`distanceToTarget` into the given active Watchlist view — preserving every other stock, field, and the existing stock order — with no follow-up composed-Watchlist `GET`. A `MARKET_DATA_UNAVAILABLE` warning on an otherwise-successful response (§24.5) is treated as a successful save: the Target Price still updates, and the warning message is surfaced back to the caller separately rather than as a failure.

Because a Target Price mutation can report a successful save with an unavailable refreshed distance (§24.5), `WatchlistStock.distanceToTarget` in the client DTO (`watchlistApi.ts`) is `number | undefined`, unlike the composed-Watchlist query's always-numeric `distanceToTarget` (§9.5). `formatPercentage` already renders `undefined` as the `—` placeholder, so an unavailable refreshed distance is visually distinct from a genuine numeric `0%` without any client-side calculation — the client never computes `price / targetPrice - 1` itself.

`+page.svelte` wires `TargetPriceCell`'s save callback to `setTargetPriceForActiveStock`, replacing `activeView` with the merged result on success and folding a `targetPriceMutationBusy` flag into the existing `managementBusy` flag (§26.2/§26.3), so a Target Price save temporarily disables tab switching, Watchlist create/delete, and stock add/remove — the same simple serialized-mutation strategy as TASK-019/TASK-020, rather than a per-row concurrency model. A per-row `saving` flag (owned by `TargetPriceCell`) additionally prevents a duplicate save for the same row.

### 26.5 Watchlist Filtering and Counts UI (TASK-022)

Company-name filtering is a purely client-side, UI-local concern layered over the already-loaded `activeView.stocks` — it never issues an API request and is never persisted, added to Watchlist metadata, or reflected in the URL. `src/lib/client/watchlistFilter.ts` exports two pure, independently unit-tested functions: `filterStocksByCompanyName(stocks, filter)`, which trims and lowercases the filter and keeps a stock only when `stock.name` (lowercased) contains it as a substring — a stock with no `name` can never match a non-empty filter, and an empty/whitespace-only filter returns the input array unchanged, preserving order — and `formatStockCount(totalCount, filteredCount, isFiltered)`, which renders the `N stock`/`N stocks` singular/plural footer text and, when filtered, the `X of N stocks` form. Neither function mutates its input.

`+page.svelte` holds `companyNameFilter` as local `$state`, alongside `$derived` values (`filteredStocks`, `isFiltered`, `stockCountText`) computed from it and `activeView`. `WatchlistTable.svelte` continues to only receive and render the stocks it is given — it receives `filteredStocks` rather than `activeView.stocks` and owns no filtering rule itself. The filter input (labelled "Filter by company name") and the count footer are only rendered once the active Watchlist has at least one stock, matching the existing empty-Watchlist state (§12.4); when the Watchlist has stocks but none match the filter, a distinct "No stocks match the current filter." message is shown instead of either the table or the empty-Watchlist message, and the count footer (`0 of N stocks`) remains visible.

`companyNameFilter` is reset to `''` at the three points where the active Watchlist itself changes — a successful tab switch, a successful Watchlist creation, and a successful Watchlist deletion/replacement transition (§26.1/§26.2) — but is left untouched by same-Watchlist mutations (stock add/remove via §26.3, Target Price save via this section), so a filter survives those and continues to apply to the updated `activeView.stocks` on the next render.

### 26.6 Watchlist Table Sorting UI (TASK-023)

Table sorting is a purely client-side, UI-local concern layered over
`filteredStocks` (§26.5) — it never issues an API request and is never
persisted, added to Watchlist metadata, or reflected in the URL.
`src/lib/client/watchlistSort.ts` exports `sortWatchlistStocks(stocks, sort)`,
a pure, independently unit-tested function that returns a new array (the
input is never mutated, nor is `activeView.stocks`/`filteredStocks`) and
implements the comparison, missing-value, and stability rules of §13.1, and
`toggleWatchlistSort(current, column)`, a pure function implementing the
ascending/toggle/switch-column activation rules of §13.1.

`+page.svelte` holds `sort` as local `$state<WatchlistSort | undefined>`,
alongside a `$derived` `visibleStocks = sortWatchlistStocks(filteredStocks,
sort)` that is passed to `WatchlistTable` instead of `filteredStocks`;
`totalStockCount`/`stockCountText` continue to derive from
`activeView`/`filteredStocks`, unaffected by `sort`. `sort` is reset to
`undefined` at the same three active-Watchlist transitions where
`companyNameFilter` is reset (§26.5) — tab switch, Watchlist creation, and
Watchlist deletion/replacement — and is otherwise left untouched, so it
survives same-Watchlist mutations and continues to apply reactively as
`activeView`/`filteredStocks` change (e.g. a Target Price edit moves that row
to its new sorted position without special-case handling).

`WatchlistTable.svelte` renders each sortable header as a `<th aria-sort="ascending"|"descending"|"none">` containing a `<button aria-label="Sort by {Column}">`, so the accessible name communicates the column independently of the `↑`/`↓` indicator (rendered only for the active column, `aria-hidden`). `WatchlistTable` receives `sort` and an `onSort(column)` callback as presentation-oriented props and owns no persisted sort state itself; `+page.svelte` turns `onSort` into `sort = toggleWatchlistSort(sort, column)`. The `Delete` header remains plain text with no button and no `aria-sort`.

### 26.7 Investment Allocation UI (TASK-024)

The Investment Allocation UI is a Total Savings input, a `<button aria-label="Calculate investment allocation">`, and an Invested display, wired to the existing `POST /api/watchlists/{watchlistId}/investment-allocation` endpoint (§22, §24.7) established by TASK-014/TASK-015. `src/lib/client/watchlistApi.ts` gains `StockAllocationResponse`/`InvestmentAllocationResponse` client-safe types and `calculateInvestmentAllocation(watchlistId, totalSavings)`, sending only `{ totalSavings }` as the JSON body — never symbols, filter text, sort state, or Target Prices. `src/lib/client/watchlistShell.ts` gains `calculateInvestmentAllocationForActiveWatchlist`, which calls that endpoint and reports the result through handlers; it never reads or mutates `activeView.stocks`, matching the page's ownership of the allocation lifecycle (§53 of the task).

Total Savings input parsing is a pure, independently unit-tested function, `parseTotalSavingsInput` (`src/lib/client/investmentSavingsInput.ts`), mirroring the `targetPriceInput.ts` pattern (§26.4) but intentionally rejecting any decimal separator — only a non-negative whole-Euro integer string is accepted. The input renders as `<input type="text" inputmode="numeric">` rather than `type="number"`, for the same locale-input-control reasoning as Target Price (§26.4). The Total Savings input and Calculate button share one `<form onsubmit>` handler, so a native Enter submission and a button click both resolve to the same single code path and cannot produce a duplicate `POST`. Locally invalid input (empty, negative, fractional, non-numeric) is rejected before any request is sent, shown via `aria-invalid`/`aria-describedby` on the input, and never clears an existing successful allocation.

`+page.svelte` owns `investmentAllocation: InvestmentAllocationResponse | undefined` as transient, unpersisted UI state (§22.6) — the most recent successful calculation for the active Watchlist, or `undefined` before any calculation has succeeded. A calculated `totalSavings = 0` / `invested = 0` is a real result and is displayed as `0`, distinct from the `undefined` pre-calculation state; the Invested line itself is only rendered once `investmentAllocation` is set, rather than defaulting to a misleading `0`. Editing the Total Savings input alone never clears `investmentAllocation` — only a new successful calculation (via `onCalculated`) replaces it, so the displayed result always reflects the last successful `totalSavings`/`invested`/`allocations`, independent of whatever the input currently contains.

Association between an allocation result and a table row uses the stock `symbol`, never response array position or row index (§52 of the task), because the allocation response order, the current company-name filter, and the current sort can each independently reorder what is displayed relative to what the server returned. `src/lib/client/investmentAllocation.ts` exports a pure `allocationBySymbol(allocation)` returning a `Map<string, StockAllocationResponse> | undefined`, unit-tested with a response order deliberately different from a representative table order. `+page.svelte` derives `allocationBySymbol` from `investmentAllocation` and passes it to `WatchlistTable` as a lookup-friendly prop (rather than the full response), alongside the existing `stocks`/`sort`/`busy` props; `WatchlistTable` performs no allocation calculation itself, only a `Map.get(stock.symbol)` per row. A `Map.get` miss — either because no allocation exists yet, or because a calculated response unexpectedly omits a displayed symbol — renders the same missing-value placeholder (`—`) as other unavailable table values; a real calculated `0` is rendered as `0`, never conflated with the placeholder. `format.ts` gains `formatWholeEuro`, following the existing `formatNumber`/`formatPercentage` shape (missing → placeholder, real `0` → `0`, browser-native `Intl.NumberFormat` currency formatting).

A new `Savings Amount` column is added to `WatchlistTable.svelte` immediately before `Delete` (§13), rendered as a plain non-interactive `<th>` with no sort button/`aria-sort`, per the fixed eight-sortable-column rule of §13.1 — this column is a transient, calculated, presentation-only value and is never sortable.

Because a calculated allocation reflects the Watchlist's business inputs (membership and each stock's `distanceToTarget`) at the moment it was calculated, `+page.svelte` invalidates it (`investmentAllocation = undefined`) whenever one of those inputs successfully changes afterward: a successful Target Price save (including the MARKET_DATA_UNAVAILABLE-warning case of §26.4/§24.5, because the Target Price itself still changed), a successful stock addition, and a successful stock removal. A *failed* Target Price save, stock addition, or stock removal leaves the previous allocation untouched, since the underlying business state did not actually change. The three existing active-Watchlist-transition points that already reset `companyNameFilter`/`sort` (§26.5/§26.6) — a successful tab switch, Watchlist creation, and Watchlist deletion/replacement — additionally reset `investmentAllocation`, so a temporary allocation never carries over to a different Watchlist. None of these invalidation points trigger an automatic recalculation (§23); the user must explicitly press Calculate again. Filtering and sorting never invalidate or otherwise affect `investmentAllocation` — they remain presentation-only exactly as before (§13.2, §26.5, §26.6) — and the allocation calculation itself always targets the complete active Watchlist via `activeWatchlistId`, never the filtered/sorted/visible subset.

An in-flight calculation sets a local `allocationBusy` flag that is folded into the page's existing single `managementBusy` flag (§26.2-§26.4), so a calculation in progress disables tab switching, Watchlist create/delete, stock add/remove, and Target Price editing, and conversely those other mutations disable the Calculate button/Total Savings input — reusing the established serialized-mutation strategy rather than introducing per-feature concurrency handling or reconciling out-of-order responses.

### 26.8 Final UI Polish Conventions (TASK-025)

TASK-025 introduced no new business behavior; it consolidated the visual language accumulated across TASK-016 through TASK-024 into a small set of durable, global conventions, kept in native CSS (no framework, no design-token system):

* **Shared CSS custom properties** (`:root` in `src/app.css`): `--color-text`, `--color-text-muted`, `--color-border`, `--color-primary`, `--color-danger`, `--color-warning`, and matching `-bg` tints, plus `--radius`. Component-scoped `<style>` blocks reference these instead of repeating hex literals, so a future palette change has one place to happen.
* **Shared button vocabulary**: global (unscoped) classes `.btn` + one of `.btn-primary` / `.btn-destructive`, optionally combined with `.btn-compact` for table-row actions (e.g. the per-row Delete button). This replaced five near-duplicate component-local button rules (create/add-stock/allocation/delete/remove) with one definition per role.
* **Shared text-input baseline**: the global `.field-input` class (height, border, radius, disabled/invalid styling) applied to Watchlist name, Stock symbol, Filter by company name, and Total savings. The Target Price input intentionally keeps its own smaller, component-local sizing (§26.4) because it lives inside a table cell.
* **Warning vs. error, beyond color**: both use a `.status` base plus either `.status-error` or `.status-warning` (left accent border + bold weight, not color alone). Semantically, mutation/load errors keep `role="alert"` (assertive); non-fatal data warnings (`FX_PROVIDER_UNAVAILABLE`, and the Target Price row-level `MARKET_DATA_UNAVAILABLE` case) use `role="status"` (polite) instead of no role, so they are discoverable by assistive technology without interrupting like an alert.
* **Empty-state presentation**: "No watchlist has been created yet." and "This watchlist is empty." share a bordered `.empty-state` treatment; "No stocks match the current filter." intentionally stays a plain, `font-style: italic` line via `.filtered-empty` so a temporarily-filtered watchlist is never visually confused with a genuinely empty one (§12.4, §24 of the task).
* **Viewport strategy confirmed**: manual and Playwright verification target 375px (mobile), 768px (intermediate), and 1280px (desktop) as the three representative widths (§14). No additional breakpoints were introduced. The table's existing horizontal-scroll-in-container strategy (§14.2) is unchanged and, by design, can still activate on wider viewports once all ten columns exceed the content width — this is the same accepted mechanism, not a new mobile-only behavior.

### 26.9 Stock Symbol Normalization and Syntax Validation UI (TASK-029)

The Stock symbol input (§26.3) uppercases characters live as the user types, via a plain `oninput` handler (`value.toUpperCase()`) rather than `bind:value` — punctuation (`.`/`-`) is preserved unchanged, and trimming/full grammar validation is deliberately deferred to submission rather than applied per keystroke. The normalization/validation rule itself (`normalizeStockSymbol`, `isValidStockSymbol`, `parseStockSymbol`) lives in `src/lib/shared/stockSymbol.ts` — a new pure, dependency-free module (no provider, network, SvelteKit request object, or persistence dependency) importable from both server application code (`AddStockToWatchlistService`) and browser code, deliberately placed outside `$lib/server` so the browser bundle can include it. This avoids maintaining two separate regex definitions that could drift.

`addStockToActiveWatchlist` (`src/lib/client/watchlistShell.ts`) normalizes and validates the trimmed symbol with `parseStockSymbol` before calling the API; a syntactically invalid symbol short-circuits through a new `onInvalidSymbol(normalizedSymbol)` handler instead of `onAdding`/`onAddFailed`/`onAdded` — no request is sent. `+page.svelte` uses this to redisplay the normalized (uppercased) text in the input for correction and show a local validation message (`INVALID_STOCK_SYMBOL_MESSAGE`, exported alongside), taking precedence over any previous server-reported mutation error. This client check is a UX optimization only (§28 of the task) — the server independently normalizes and validates every request regardless of what the browser sent, so a direct/bypassing API request receives the same `INVALID_STOCK_SYMBOL` rejection.

### 26.10 Table Presentation Refinements (TASK-033)

TASK-033 changed only client-side presentation of the already-composed
Watchlist stock data (§13, §13.3): column labels/order, decimal
formatting, a signed/highlighted Distance-to-Target presentation, and the
footer wording. It introduced no new business calculation, no client-side
recomputation of a server-owned formula, no API change, and no persistence
change.

**Numeric formatting.** `formatNumber`/`formatPercentage`
(`src/lib/client/format.ts`) now always render exactly two decimal places
(`minimumFractionDigits`/`maximumFractionDigits: 2`), covering Market Cap,
Price, and Dividend Yield. `formatNumber` and `formatPercentage` continue to
render `undefined` as the `—` placeholder and a real `0` as `0.00`/`0.00%`
respectively (§21.1, §24.6) — this task additionally hardens both against
non-finite (`NaN`, `Infinity`, `-Infinity`) input, treating it the same as
`undefined` rather than risking a misleading formatted string. Savings
Amount is intentionally excluded from this two-decimal rule: `formatWholeEuro`
(§26.7) keeps its existing whole-Euro presentation, because the underlying
`savingsAmount` value is itself always a whole number (§22.4) and formatting
it with decimals would misrepresent that.

**Signed Distance to Target.** A new `formatSignedPercentage` renders an
explicit `+` for a positive distance, keeps the natural `-` for a negative
distance, and — unlike the generic percentage formatter — renders a real
zero distance neutrally as `0.00%` rather than `+0.00%`
(`Intl.NumberFormat`'s `signDisplay: 'exceptZero'`). It is used only for the
Distance-to-Target cell; Dividend Yield continues to use the unsigned
`formatPercentage`, since a forced sign is meaningful only for a
value-oriented distance, not a yield.

**Distance-to-Target visual states.** `WatchlistTable.svelte` classifies
each row's Distance-to-Target cell into one of three presentation states,
intentionally named for investment meaning rather than mathematical sign so
the CSS vocabulary can't be misread as generic positive/negative:

```text
distanceToTarget < 0   -> "favorable"   (market price below Target Price)
distanceToTarget > 0   -> "unfavorable" (market price above Target Price)
distanceToTarget = 0   -> neutral (real equal-price result)
distanceToTarget = undefined -> neutral (no calculable value)
```

Two new global CSS custom properties per state
(`--color-distance-favorable`/`-bg`, `--color-distance-unfavorable`/`-bg` in
`src/app.css`, following the existing TASK-025 token convention) supply the
colors. The resulting class is applied only to the Distance-to-Target `<td>`
— never the surrounding `<tr>` and never any other financial column (Price,
Target Price, Dividend Yield, Savings Amount, Market Cap) — because the
visual statement is specific to the price/Target-Price relationship. The
explicit `+`/`-` sign remains the accessible, non-color-dependent source of
the same information; no icon or changed accessible name was introduced, and
the underlying numeric value/`aria`-relevant text never uses subjective
language (e.g. "good"/"bad"/"buy"/"sell") — the application remains a
decision aid, not a trading recommendation.

**Footer wording.** `formatStockCount` (§26.5) was reworded from the
original compact `N of M stocks` form to an explicit `Total: N stock(s)`,
plus `· Filtered: M stock(s)` whenever a company-name filter is active
(including when the filter matches every stock, so the UI communicates that
filtering is in effect even when it changes nothing visible). Singular/
plural wording for Total and Filtered are computed independently. This is
the same underlying derived counts and active-filter rule as before
(§13.3, §26.5) — only the rendered text changed.

### 26.11 Compact Responsive Workspace (TASK-034)

TASK-034 is a layout/interaction refinement of the shell established in
§26.1-§26.10. It introduces no new business behavior, API call, or piece of
client-side state beyond what those sections already describe; it changes
where and how the existing controls are presented so the stock table (§13,
§14.4) receives layout priority.

**Duplicate Watchlist name removed.** The active Watchlist name was
previously shown both by the active tab and by a standalone `<h2>` heading
above the table. The heading is removed; the active tab (`aria-selected`,
§26.1) remains the sole workspace identification.

**Watchlist creation moved into the tab row.** The Watchlist-name input and
create button (§26.2) now share one flex row with `WatchlistTabs` instead of
occupying a separate full-width row above it. The tab strip takes the
flexible remaining width (scrolling internally when many Watchlists exist,
per its existing §26.1 mechanism) while the create form keeps a fixed,
moderate width, so a long tab strip cannot push Watchlist creation off the
page.

**Active-tab delete control.** The separate, large "Delete current
watchlist" button is removed. `WatchlistTabs.svelte` now renders a compact
`×` delete control next to the active tab only, with an accessible name of
the form `Remove watchlist "<name>"` using the real active Watchlist name.
Because a `<button>` cannot contain another interactive `<button>`, and
nesting one inside the `role="tab"` button would also make a delete click
select the tab, the tab button and the delete button are rendered as
sibling elements inside a small non-semantic wrapper, preserving
`tablist`/`tab`/`aria-selected` semantics (§26.1) rather than nesting
incorrectly. `+page.svelte`'s existing deletion orchestration — the
`window.confirm()` dialog (§26.2), `managementBusy` gating, and the
transition to the server-selected replacement Watchlist — is unchanged; only
which markup triggers it changed. With no Watchlists, `WatchlistTabs` itself
is not rendered, so no delete control exists, with no extra conditional
needed beyond the existing one. TASK-035 (§26.12) later corrected this
control's visual `×` centering and gave it explicit square geometry; the
sibling-elements structure and accessible name described here are otherwise
unchanged.

**Consolidated workspace toolbar.** The stock-add form (§26.3), the
company-name filter (§26.5), and the investment-allocation form (§26.7)
previously occupied separate rows/sections above the table. They now share
one flex-wrap toolbar row, grouped into three logical clusters — stock
mutation, table presentation, allocation — distinguished by spacing rather
than borders (§14.4). The filter and allocation clusters are only rendered
once the active Watchlist has at least one stock (matching their existing
preconditions, §26.5/§26.7); the stock-add cluster remains available
regardless, so a first stock can still be added to an empty Watchlist. None
of the underlying mutation handlers, validation, or busy-state logic
changed — only their shared container and visual grouping.

Each input's visible `<label>` is now visually hidden (a standard
"screen-reader-only" utility class, clipped but not `display:none`/
`aria-hidden`) with a `placeholder` attribute supplying the same text as a
compact visual affordance instead. The label element itself is unchanged
and remains part of the accessibility tree and available to label-based
lookups, so this is a visual-density change only, not an accessibility
regression (§14.3).

**Allocated savings terminology.** See §22.5.

**Wider desktop page.** The page container's width strategy changed from a
fixed `max-width` centered on a narrow content column to
`width: min(calc(100% - 2rem), 1600px)`, substantially increasing usable
width on wide displays while still capping at a sane maximum and leaving a
small inset on narrower ones.

**Content-aware table column widths.** `WatchlistTable.svelte` now uses
`table-layout: fixed` with an explicit `<colgroup>`: every column except
Name has an explicit width sized for its formatted content (e.g. a compact
width for Symbol/Currency/Price, a wider one for Target Price to
accommodate its editable input); Name has no explicit width and therefore
receives the remaining space, per the `table-layout: fixed` column-width
algorithm. This is what allows the normal deterministic stock set to fit a
wide desktop viewport without horizontal scrolling (§14.2) while still
scrolling internally on narrower viewports, per the same
`table-container`/`overflow-x` mechanism as before. Header labels
(`white-space: normal`) wrap onto multiple lines rather than truncating
when a header's text is longer than its column, so a compact column never
hides its own header text; the same is true of the Symbol/Name cells for
unusually long values, wrapping rather than clipping.

**Compact row actions.** The per-row stock-removal control (§26.3) changed
from a `Delete`-labeled button to a compact icon-only button (a trash-can
glyph), keeping its existing accessible name (`Remove <symbol>`) and
no-confirmation removal semantics unchanged.

### 26.12 Responsive Watchlist Navigation (TASK-035)

TASK-035 replaces the horizontally scrollable Watchlist tab strip (§26.1,
§26.11) with the responsive direct-tab-plus-overflow navigation model
described in §14.5, while otherwise reusing the existing shell: `+page.svelte`
still owns `watchlists`/`activeWatchlistId` and the tab-switch/create/delete
orchestration (§26.1-§26.2); only how the navigation is presented changed.
`WatchlistTabs.svelte` kept its filename (its responsibility — direct tabs
plus overflow navigation — remains the same component boundary described by
the task; see the task's §55 for why no rename was needed) but now owns the
capacity-driven visibility split.

**Visibility algorithm.** `partitionWatchlistsForNavigation` (§14.5,
`src/lib/client/watchlistNavigation.ts`) is a pure function with no DOM
dependency: given the full Watchlist list, the active id, and a capacity, it
returns `{ visible, overflow }`, each preserving source order. The rule is
"always include the active Watchlist, then take the earliest inactive
Watchlists that fit" — implemented by seeding a selected-id set with the
active Watchlist (if present) before filling remaining capacity from the
front of the list, then partitioning the original array by membership in
that set. This guarantees the active Watchlist is never overflow-only,
avoids unnecessary reshuffling of already-visible inactive Watchlists, and
keeps duplicate-named Watchlists distinct (identity is by `id` throughout,
consistent with §26.1). `navigationCapacityForWidth` (same module) is the
pure width-to-capacity mapping documented in §14.5; the component computes
its live capacity from `window.innerWidth`, guarded by `$app/environment`'s
`browser` flag so it never touches `window`/`matchMedia` during SSR, and
recomputes only on `matchMedia` `change` events at the two capacity
breakpoints — never on every resize pixel, and never via a server request.

**Overflow disclosure.** Overflow Watchlists render inside a native
`<details>`/`<summary>` disclosure (no icon library, no menu component
introduced), kept as a sibling of the `role="tablist"` div rather than
inside it, so it is never mistaken for a Watchlist tab. Its label is
`Watchlists` when the direct capacity is 1 (mobile — only the active
Watchlist is ever directly visible) and `More` otherwise. Overflow items are
plain `<button>`s inside a `<ul>`, not `role="tab"`; selecting one calls the
same `onSelect(watchlistId)` callback a direct tab uses, so overflow
selection reuses TASK-016's existing PUT-then-load flow, error handling, and
`managementBusy` gating verbatim — there is no separate overflow-specific
selection or error path. The menu closes as soon as a selection is
initiated (before the network call resolves, so a failed selection doesn't
leave a stale menu open) and on Escape or an outside click.

Two mechanisms intentionally do not read the same signal for "is the
overflow open": the declarative `open={overflowOpen}` binding (backed by a
`$state` variable, synced from the native `<details>` via an explicit
`ontoggle` handler rather than Svelte's `bind:open`) drives rendering, while
the Escape-key and outside-click dismissal handlers read `detailsEl.open`
(the live DOM property) directly instead of `overflowOpen`. This is a
deliberate fix for a real timing bug found during implementation: a
keyboard-triggered (Space/Enter) native toggle flips the DOM `open` property
synchronously, but the `toggle` event that updates `overflowOpen` fires on a
separately queued task shortly after (per the HTML `<details>` spec); gating
dismissal on `overflowOpen` occasionally raced that delay and left a
just-opened menu unclosable by Escape. Reading `detailsEl.open` directly has
no such race, since it reflects the browser's own synchronous state.

**Active-delete `×` centering fix.** The compact delete control introduced
by TASK-034 (§26.11) is now `display: inline-grid; place-items: center` with
an explicit equal `width`/`height` and `padding: 0`, rather than relying on
line-height/padding to visually center the glyph — a scoped override local
to `WatchlistTabs.svelte`, not a change to the shared `.btn-icon` class also
used by the per-row stock-removal control (§26.11), so that control's
appearance is unaffected. The `×` glyph, accessible name
(`Remove watchlist "<name>"`), and confirmation workflow are unchanged from
TASK-034.

**No business/persistence change.** Direct-vs-overflow placement is
client-only presentation state, recomputed from already-loaded Watchlist
metadata; it does not reorder or persist Watchlists (§9.2, §11.3) and issues
no additional API requests beyond the existing tab-switch/create/delete
flows.

### 26.13 Responsive Stock Presentation (TASK-036)

See §14.6 for the full rule, breakpoint, and rationale. This section records
only the client-state-specific consequences.

`+page.svelte` gains one additional derived-from-viewport piece of UI state,
`presentationMode: 'table' | 'cards'`, following the exact SSR-guard pattern
`WatchlistTabs` already established for navigation capacity (§26.12):
computed synchronously from `window.innerWidth` behind the `browser` flag at
`$state` initialization (so client hydration reflects the real viewport
immediately, with no post-mount flash), and recomputed only on a
`matchMedia` `change` event at the single breakpoint — never on every resize
pixel. This is presentation state exactly like `sort`/`companyNameFilter`
(§26), not business state: it is never persisted, never sent to the server,
and does not participate in the three existing active-Watchlist-transition
resets (tab switch, create, delete) that already reset `sort`/
`companyNameFilter`/`investmentAllocation` (§26.5-§26.7), because it depends
only on viewport width, not on which Watchlist is active.

`visibleStocks`, `sort`, `busy`, and `allocationBySymbol` are passed
identically to whichever of `WatchlistTable`/`WatchlistCards` the current
`presentationMode` selects; neither component is aware the other exists.
`WatchlistCards`' own local state is limited to derived display values
(e.g. the sort-direction accessible-name label) — it owns no persisted state
of its own, matching `WatchlistTable`.

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

Playwright (`@playwright/test`) is the project's browser-level UI/E2E testing framework, established by TASK-018. It is a separate concern from Vitest, which remains the unit/application test framework.

Permanent browser specs live under `tests/e2e/`, organized by user-facing concern (e.g. `watchlist-tabs.spec.ts`, `watchlist-table.spec.ts`) rather than one large undifferentiated spec file.

Normal Playwright UI tests exercise:

```text
browser UI
+
controlled/intercepted application API responses
```

They use Playwright request routing to return deterministic responses for `/api/*` and therefore do not normally depend on Cloudflare Access, Cloudflare KV, Yahoo Finance, or Frankfurter. `npm run dev` is a sufficient runtime for this suite because every relevant `/api/*` request is intercepted in the browser before it reaches the SvelteKit server.

Real `workerd`/provider verification (Cloudflare Access, KV, Yahoo Finance, Frankfurter) remains a separate, manual deployment smoke-test concern rather than part of the normal Playwright suite. This decision may be revisited as the application grows.

Desktop and narrow/mobile UI behavior (tab strip, Table/Card presentation, page-level overflow) are covered by Playwright projects using distinct viewports rather than relying on a developer's local browser window dimensions. `tests/e2e/ui-polish.spec.ts` (TASK-025) additionally covers cross-feature UI state (a complete populated page, warning/error distinction, an error-recovery flow, a keyboard-only flow, and a 768px intermediate-viewport check) that does not belong to one single focused feature spec. `tests/e2e/stock-cards.spec.ts` (TASK-036) covers Stock Card presentation, content, sorting, and cross-presentation state preservation specifically; `tests/e2e/watchlist-table.spec.ts`/`watchlist-sorting.spec.ts` remain scoped to the desktop Table presentation only, since Card mode has a differently shaped (but state-equivalent) sort control (§14.6, §26.13).

`playwright.config.ts` pins `workers: 4` (TASK-025 §53-54). TASK-023/024 reported intermittent failures under high parallel load; TASK-025 reproduced this against an 8-core development machine (2 of 3 full-suite runs failed a different test at 8 workers, versus 0 failures across 6+ full-suite runs at 4 workers) before pinning the value, so a future change to this number should be similarly evidence-based rather than adjusted on suspicion alone.

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

### 29.1 Input Boundary Validation (TASK-037)

> Browser input constraints are UX only; all externally controlled values
> require authoritative server-side validation and explicit bounds.

An HTML constraint such as `maxlength` on a client `<input>` never makes a
value safe — a caller can bypass the browser entirely and call any public
endpoint directly (e.g. `POST /api/watchlists`) with arbitrary string
length or numeric magnitude. Every externally controlled string and
numeric value (request bodies, URL path parameters) must eventually have
an explicit, justified bound enforced at the server boundary, independent
of whatever the browser does or does not restrict. TASK-037 audited every
current input against this rule; see `docs/security/input-boundary-audit.md`
for the full inventory and gap analysis. The concrete numeric/length
bounds identified as currently missing are recommendations pending
TASK-038 implementation, not yet part of this architecture.

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
* more advanced investment-allocation strategies;
* further responsive column selection beyond the Table/Card switch introduced by TASK-036 (§14.6, §26.13).

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
