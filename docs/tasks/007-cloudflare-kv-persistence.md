# TASK-007: Cloudflare KV Persistence

## Status

Ready

## Goal

Implement the server-side persistence boundary for user-owned Watchlist data using Cloudflare Workers KV.

This task introduces two independent persistence concerns:

```text
Application
    |
    +-- WatchlistRepository
    |       |
    |       v
    |   Cloudflare KV
    |
    +-- TargetPriceRepository
            |
            v
        Cloudflare KV
```

The implementation must preserve the established domain rules:

* Watchlists belong to a user.
* Target prices belong to `User + Symbol`.
* Target prices are independent of individual Watchlists.
* Removing a symbol or deleting a Watchlist must never implicitly delete target prices.
* Market data and savings calculations are not persisted.

This task implements repositories and KV serialization only.

Do not implement authentication, application use cases, REST APIs, or UI.

---

## Context

Read before starting:

* `CLAUDE.md`
* `ARCHITECTURE.md`
* this task completely

Relevant existing production code includes:

* server-side domain calculations;
* `MarketDataProvider`;
* `YahooFinanceAdapter`;
* exchange-rate infrastructure;
* dividend-yield calculation.

Cloudflare Workers KV is the accepted persistence technology.

The application is designed for multiple users, although initially only one user is expected.

---

## 1. Persistence Ownership

All persisted application data is scoped by a server-provided user ID.

Conceptually:

```text
user:<userId>:watchlists
user:<userId>:target-prices
```

For example:

```text
user:ce40d564-c72f-475f-a9b8-f395f19ad986:watchlists
user:ce40d564-c72f-475f-a9b8-f395f19ad986:target-prices
```

The repository receives `userId` from its server-side caller.

This task does NOT determine where that user ID comes from.

Cloudflare Access integration belongs to a later task.

---

## 2. User ID Validation

Repository operations must not accidentally create global or malformed keys because of an unusable user ID.

At minimum reject:

* empty user IDs;
* whitespace-only user IDs.

Do not invent a Cloudflare Access UUID validation rule yet.

The repository must remain testable with simple IDs such as:

```text
user-1
user-2
```

Do not accept a missing user ID and silently fall back to shared/global storage.

---

## 3. Watchlist Persistence Model

Introduce the minimal application-owned persistence/domain types required to represent Watchlists.

Conceptually:

```ts
interface Watchlist {
  id: string;
  name: string;
  symbols: string[];
}

interface WatchlistsDocument {
  activeWatchlistId?: string;
  watchlists: Watchlist[];
}
```

The exact names may follow existing project conventions.

### Rules

* A user may have zero Watchlists.
* Watchlist IDs must be persisted.
* Watchlist names may be duplicated.
* Symbols are persisted as strings.
* The same symbol may occur in multiple Watchlists.
* A symbol must not occur more than once in one Watchlist.
* The active Watchlist is represented by ID, not by an `active` flag duplicated on each Watchlist.

Do not implement Watchlist creation/deletion business operations in this task.

The repository stores and retrieves valid documents supplied by later application services.

---

## 4. Empty Watchlist State

A user with no persisted Watchlist document must be represented to application callers as the application's empty state.

Conceptually:

```ts
{
  activeWatchlistId: undefined,
  watchlists: []
}
```

Do not require every authenticated user to have an eagerly created KV document.

This supports the application requirement that a new user may legitimately have no Watchlists.

---

## 5. Target Price Persistence Model

Target prices are stored independently of Watchlists.

Conceptually:

```ts
type TargetPrices = Record<string, number>;
```

Example:

```json
{
  "AAPL": 200.5,
  "SAP.DE": 220,
  "GAW.L": 185
}
```

A Target Price belongs to:

```text
User + Symbol
```

and not:

```text
User + Watchlist + Symbol
```

This is a fundamental persistence rule.

---

## 6. Empty Target Price State

A user with no persisted target-price document must be represented as:

```ts
{}
```

Do not eagerly create an empty KV document solely because a user has authenticated.

---

## 7. Persistence Independence

Watchlists and Target Prices MUST use separate KV values.

Updating:

```text
user:<userId>:watchlists
```

must not require rewriting:

```text
user:<userId>:target-prices
```

and vice versa.

This preserves the independent lifecycle of target prices.

---

## 8. Target Price Lifecycle

The persistence layer must support the following future application behavior:

```text
Add AAPL to Watchlist A
        |
        v
Target price may exist independently

Remove AAPL from Watchlist A
        |
        v
Target price remains

Delete Watchlist A
        |
        v
Target price remains

Later add AAPL to Watchlist B
        |
        v
Existing target price is available
```

Do not implement these application workflows yet.

The repository design must simply make them possible without coupling Watchlist deletion to Target Price deletion.

---

## 9. Repository Boundaries

Introduce small application-owned repository abstractions.

Conceptually:

```ts
interface WatchlistRepository {
  get(userId: string): Promise<WatchlistsDocument>;
  save(userId: string, document: WatchlistsDocument): Promise<void>;
}
```

and:

```ts
interface TargetPriceRepository {
  get(userId: string): Promise<TargetPrices>;
  save(userId: string, targetPrices: TargetPrices): Promise<void>;
}
```

The exact method names may differ if there is a clear reason.

Do not build a generic repository framework.

Do not introduce CRUD methods for every nested object unless needed by this task.

Whole-document read/write is appropriate for the current small KV data model.

---

## 10. Cloudflare KV Adapters

Implement Cloudflare KV-backed versions of both repositories.

The adapters are responsible for:

* constructing user-scoped KV keys;
* reading KV values;
* parsing persisted JSON;
* validating the persisted document shape sufficiently to avoid returning malformed application data;
* serializing application-owned documents;
* writing JSON to KV;
* mapping infrastructure failures to a small application-owned persistence error.

Cloudflare-specific types must remain inside the persistence/infrastructure boundary where practical.

---

## 11. KV Binding

Use a clearly named Cloudflare KV binding.

A suitable name is:

```text
WATCHLIST_KV
```

unless the existing project conventions strongly suggest another name.

Configure the binding in the Cloudflare project configuration as required for the application to compile and for local development/test typing to work.

Do NOT insert:

* a real production namespace ID;
* account-specific credentials;
* secrets.

If Cloudflare tooling requires a placeholder/local configuration, use the normal current development convention and document it.

Production namespace creation/deployment is not part of this task.

---

## 12. Key Construction

KV key construction must be centralized rather than repeated as string literals throughout repository code.

Conceptually:

```text
user:<userId>:watchlists
user:<userId>:target-prices
```

The exact helper design should remain simple.

Do not expose raw KV keys outside the persistence implementation.

---

## 13. Serialization

Persist JSON using an explicit application-owned shape.

Do not serialize framework objects, classes, Yahoo responses, or arbitrary runtime state.

Watchlist persistence contains only:

```text
activeWatchlistId
watchlists[]
    id
    name
    symbols[]
```

Target-price persistence contains only:

```text
symbol -> numeric target price
```

Do not persist derived values.

---

## 14. Data Not Persisted

The following MUST NOT be stored by these repositories:

```text
name from Yahoo
regular/current market price
currency
annual dividend
dividend yield
market cap
market cap in USD
distance to target
investment factor
total savings
savings amount
invested
exchange rates
Yahoo cookies
Yahoo crumbs
authentication tokens
email address
```

Market data is transient.

Investment allocation is transient.

Authentication identity is external to these documents.

---

## 15. Persisted Data Validation

KV contains external serialized data from the application's perspective and must not be blindly trusted after JSON parsing.

Implement lightweight validation of persisted documents.

At minimum verify:

### Watchlists Document

* root is an object;
* `watchlists` is an array;
* each Watchlist has a string `id`;
* each Watchlist has a string `name`;
* each Watchlist has a string array `symbols`;
* `activeWatchlistId`, when present, is a string.

### Target Prices

* root is an object;
* keys are strings;
* values are finite numeric target prices.

Do not introduce a large schema-validation dependency solely for these two simple documents unless there is a compelling reason.

Small explicit validation functions are preferred.

---

## 16. Corrupt Persisted Data

Malformed JSON or structurally invalid persisted data must NOT silently become an empty Watchlist/Target Price document.

That would hide data corruption.

Instead, expose a small application-owned persistence error.

Distinguish:

```text
KV key does not exist
```

from:

```text
KV value exists but is invalid/corrupt
```

A missing key maps to the legitimate empty state.

Corrupt persisted data maps to an error.

---

## 17. Persistence Errors

Introduce the smallest practical application-level persistence error representation.

Infrastructure errors such as:

* KV read failure;
* KV write failure;
* JSON parse failure;
* invalid persisted shape;

must not leak as undocumented raw Cloudflare exceptions.

Preserve the original error as `cause` where useful.

Do not create a large exception hierarchy.

---

## 18. Eventual Consistency

Do not attempt to emulate transactions or strong consistency on top of Workers KV.

The architecture explicitly accepts KV's eventual consistency characteristics.

Do not add:

* locks;
* version vectors;
* distributed transactions;
* retry loops intended to create strong consistency;
* Durable Objects.

These are outside the current requirements.

---

## 19. No Cross-Document Transactions

Saving Watchlists and saving Target Prices are independent operations.

Do not introduce an abstraction pretending they can be atomically committed together.

Future application services must tolerate this persistence model.

---

## 20. No Automatic Cleanup

The persistence layer MUST NOT scan Watchlists and remove target prices that are no longer referenced.

Unused target prices are intentional retained user data.

There is no garbage collection for target prices.

---

## 21. Symbol Handling

Do not invent symbol normalization rules in the repository.

The repository stores symbols supplied by the application layer.

In particular, do not automatically:

* uppercase symbols;
* trim exchange suffixes;
* rewrite Yahoo symbols;
* remove punctuation.

Symbol validation/normalization belongs to the application/provider boundary where required.

---

## 22. Repository Mutability

Repository implementations should not accidentally allow callers to mutate internal cached state.

No repository-level cache is required.

Each read may return newly parsed application data.

Do not introduce persistence caching.

---

## 23. Server-Only Implementation

Repository interfaces and Cloudflare KV adapters belong in the server-side implementation.

Cloudflare KV MUST NOT be accessed from:

* `.svelte` components;
* client-side stores;
* browser code.

Use the existing SvelteKit server-only structure.

---

## 24. Testing Strategy

Automated repository tests MUST NOT require:

* a real Cloudflare account;
* a deployed KV namespace;
* network access;
* authentication.

Use a minimal fake/in-memory implementation of the required KV binding contract for adapter tests.

Do not introduce a general Cloudflare emulator unless current project tooling already provides a simple, appropriate option.

The purpose is to test our repository behavior, not Cloudflare itself.

---

## 25. Required Watchlist Repository Tests

At minimum test:

### Missing Document

No KV value exists:

```ts
{
  activeWatchlistId: undefined,
  watchlists: []
}
```

is returned.

### Valid Document

A valid persisted Watchlist document is parsed and returned correctly.

### Zero Watchlists

A persisted document containing an empty `watchlists` array is valid.

### Duplicate Watchlist Names

Two Watchlists with the same name are accepted.

### Symbols Across Watchlists

The same symbol appearing in two different Watchlists is accepted.

### Duplicate Symbol Within One Watchlist

Persisted data containing the same symbol more than once within one Watchlist must be treated as invalid persisted data.

This enforces the established domain invariant at the persistence boundary.

### Active Watchlist

A valid `activeWatchlistId` is preserved.

### Invalid JSON

Produces a persistence error.

### Invalid Shape

Produces a persistence error.

### Read Failure

A KV read exception becomes the application-owned persistence error.

### Write

Saving serializes the expected application-owned JSON shape under the correct user-scoped key.

### Write Failure

A KV write exception becomes the application-owned persistence error.

---

## 26. Active Watchlist Integrity

When reading persisted Watchlist data:

* `activeWatchlistId` may be absent;
* if present, it must reference an existing Watchlist ID.

A persisted document where:

```text
activeWatchlistId = "missing-id"
```

but no Watchlist has that ID must be considered invalid persisted data.

Also reject duplicate Watchlist IDs within one user's document.

These are persistence/domain integrity constraints.

---

## 27. Required Target Price Repository Tests

At minimum test:

### Missing Document

Returns:

```ts
{}
```

### Valid Document

Returns all persisted symbol/target-price entries.

### Decimal Target Price

A value such as:

```text
200.5
```

is preserved.

### Invalid Numeric Values

Reject persisted target prices that are:

* non-numeric;
* non-finite;
* zero or negative.

Target prices represent positive prices.

### Invalid JSON

Produces a persistence error.

### Invalid Root Shape

Arrays, strings, numbers, or null as the root are invalid.

### Read Failure

Maps to the application-owned persistence error.

### Write

Serializes the expected document under the correct user-scoped key.

### Write Failure

Maps to the application-owned persistence error.

---

## 28. User Isolation Tests

Explicitly verify key isolation.

For example:

```text
user-1
user-2
```

must produce different Watchlist keys and different Target Price keys.

A save for `user-1` must not overwrite/read the value belonging to `user-2`.

This is a critical prerequisite for later multi-user operation.

---

## 29. User ID Validation Tests

At minimum verify that repository operations reject:

```text
""
"   "
```

as user IDs.

Valid simple IDs such as:

```text
"user-1"
```

must work.

Do not test Cloudflare Access-specific UUID semantics in this task.

---

## 30. No Authentication Yet

This task intentionally accepts a server-side `userId` parameter.

Do not interpret that as permission for future REST APIs to accept arbitrary user IDs from clients.

The later authentication task will provide:

```text
Cloudflare Access
       |
       v
authenticated user ID
       |
       v
Application Service
       |
       v
Repository
```

The security rule remains:

> Client requests must never determine the user ID used for persistence.

---

## 31. Cloudflare Configuration

Update Cloudflare configuration and generated environment typings only as necessary to introduce the KV binding.

Keep configuration account-independent.

Do not:

* create production namespaces;
* deploy infrastructure;
* add account IDs;
* add API tokens;
* add secrets.

If namespace IDs cannot be known until manual Cloudflare setup, leave the project in a documented state where the user can provide those values later.

Do not fabricate production namespace IDs.

---

## 32. Documentation

Update `README.md` only if local developer setup genuinely changes because of the KV binding.

Do not document production Cloudflare setup that has not yet been performed.

Update `ARCHITECTURE.md` only if implementation reveals a necessary clarification to the already agreed persistence model.

Do not rewrite unrelated architecture sections.

---

## Non-Goals

Do NOT implement:

* Cloudflare Access;
* JWT validation;
* authenticated user extraction;
* login;
* REST endpoints;
* Watchlist creation;
* Watchlist deletion;
* Watchlist renaming;
* adding/removing symbols as application use cases;
* target-price editing use cases;
* Yahoo integration changes;
* Frankfurter integration changes;
* market-data composition;
* dividend changes;
* investment-calculation changes;
* Svelte UI;
* KV caching;
* market-data caching;
* exchange-rate caching;
* migrations;
* transactions;
* Durable Objects;
* production Cloudflare deployment.

Do not create a generic persistence framework.

---

## Suggested Structure

Follow existing project conventions.

A conceptual structure may resemble:

```text
src/lib/server/
├── domain/
│   └── ...
│
├── market-data/
│   └── ...
│
├── exchange-rates/
│   └── ...
│
└── persistence/
    ├── WatchlistRepository.ts
    ├── TargetPriceRepository.ts
    ├── CloudflareKvWatchlistRepository.ts
    ├── CloudflareKvTargetPriceRepository.ts
    └── ...
```

The exact structure is illustrative.

Prefer the smallest clear structure consistent with the current codebase.

---

## Acceptance Criteria

The task is complete when all of the following are true:

1. An application-owned Watchlist persistence model exists.
2. Watchlists are represented by unique IDs, names, and symbol arrays.
3. Duplicate Watchlist names are allowed.
4. Duplicate Watchlist IDs are rejected as corrupt persisted data.
5. Duplicate symbols inside one Watchlist are rejected as corrupt persisted data.
6. The same symbol may exist in multiple Watchlists.
7. `activeWatchlistId` is optional.
8. A persisted `activeWatchlistId` must reference an existing Watchlist.
9. A missing Watchlist KV key returns the legitimate empty state.
10. An application-owned Target Price persistence model exists.
11. Target Prices are stored independently from Watchlists.
12. Decimal Target Prices are preserved.
13. Persisted Target Prices must be finite positive numbers.
14. A missing Target Price KV key returns `{}`.
15. Watchlists and Target Prices use separate KV keys.
16. Both KV keys are scoped by server-provided `userId`.
17. Empty/whitespace user IDs are rejected.
18. User isolation is explicitly tested.
19. Cloudflare KV-backed Watchlist and Target Price repository implementations exist.
20. KV key construction is centralized inside the persistence boundary.
21. Valid persisted JSON is explicitly validated before being returned.
22. Missing data and corrupt data have different behavior.
23. Infrastructure/parse/validation failures map to a small application-owned persistence error.
24. No target-price cleanup is performed when Watchlists/symbols disappear.
25. No market data is persisted.
26. No savings/allocation data is persisted.
27. No authentication information is persisted in these documents.
28. No repository cache is introduced.
29. Repository tests require no Cloudflare account or network.
30. A KV binding is configured without real account-specific credentials or fabricated production namespace IDs.
31. Cloudflare KV is server-only.
32. Existing project checks still pass.
33. No authentication, REST API, application CRUD workflow, or UI has been implemented.
34. No unnecessary production dependency has been introduced.

---

## Verification

Before completing the task, execute:

```bash
npm run check
npm run test
npm run lint
npm run build
```

All newly introduced tests must pass without:

* network access;
* a Cloudflare account;
* a real KV namespace.

Inspect the generated/built Cloudflare configuration sufficiently to verify that the KV binding is typed and available to server-side code without exposing account credentials.

Do not claim live KV verification unless a real/local Workers KV runtime was actually used.

Live Cloudflare verification is not required for this task.

---

## Completion Report

When finished, report:

1. files added or changed;
2. the final Watchlist/Watchlists document types;
3. the final Target Price document type;
4. the final repository contracts;
5. the KV key format;
6. the KV binding name and configuration changes;
7. missing-document behavior;
8. persisted-data validation rules;
9. corrupt-data behavior;
10. persistence-error behavior;
11. user-ID validation behavior;
12. how user isolation was tested;
13. how duplicate Watchlist IDs and duplicate symbols are handled;
14. how active-Watchlist integrity is enforced;
15. confirmation that Target Prices remain independent and are never automatically deleted;
16. test scenarios added;
17. whether any live/local Cloudflare KV verification was performed;
18. results of `check`, `test`, `lint`, and `build`;
19. assumptions or unresolved issues;
20. any changes made to `ARCHITECTURE.md` or `README.md`;
21. deviations from this task or `ARCHITECTURE.md`.

Do not proceed to Cloudflare Access, authentication, Watchlist application services, REST APIs, or UI implementation.

Do not stage, commit, or push changes. Git operations are performed manually by the user.
