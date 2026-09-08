# Frontend Architecture and Responsibility Audit (TASK-041)

Status: audit only. No production code was changed as part of this document.

This audit analyzes the current Svelte 5/SvelteKit frontend, based on the actual code as of this
task (`src/routes/+page.svelte`, `src/lib/components/`, `src/lib/client/`, `src/lib/shared/`, and
the existing Vitest/Playwright suites), and proposes a justified, incremental refactoring plan. It
does not implement that plan.

---

## 1. Current Architecture Overview

The application is a single SvelteKit route (`src/routes/+page.svelte`, 786 lines: ~444 lines of
`<script>`, ~220 lines of markup, ~200 lines of scoped CSS). It composes four presentational
components and delegates all HTTP/orchestration to two client-side layers:

```text
src/routes/+page.svelte            route: state + composition + workflow wiring + layout
src/lib/components/
    WatchlistTabs.svelte           watchlist navigation, own responsive capacity state
    WatchlistTable.svelte          desktop stock table (presentational)
    WatchlistCards.svelte          narrow-viewport stock cards (presentational)
    TargetPriceCell.svelte         per-row Target Price inline editor (owns draft state)
src/lib/client/
    watchlistApi.ts                HTTP transport + DTOs + WatchlistApiError
    watchlistShell.ts              stateless async workflow orchestration over watchlistApi
    watchlistFilter.ts             pure: company-name filter + count text
    watchlistSort.ts               pure: sort/toggle
    watchlistNavigation.ts         pure: nav partition + capacity-by-width
    watchlistPresentation.ts       pure: table/cards mode-by-width
    distancePresentation.ts        pure: favorable/unfavorable/neutral classification
    investmentAllocation.ts        pure: allocation response -> Map<symbol, entry>
    investmentSavingsInput.ts      pure: total-savings text parsing
    targetPriceInput.ts            pure: target-price text parsing
    sortableStockColumns.ts        pure: shared column metadata (table + cards)
    format.ts                      pure: display formatting (no business formulas)
src/lib/shared/
    stockSymbol.ts, watchlistName.ts, targetPrice.ts, investmentSavings.ts
                                   pure, dependency-free rules shared with server code
```

There is no client-side store, Context, or ViewModel layer today. All reactive page state is
`$state`/`$derived` declared directly in `+page.svelte`. No frontend module imports `$lib/server`
(verified by `grep -rn "$lib/server" src/routes src/lib/components src/lib/client src/lib/shared`
— zero matches), so the client/server boundary in `ARCHITECTURE.md` §7 is currently respected.

### 1.1 Current Dependency Graph

```text
+page.svelte
   │  props/callbacks
   ├──> WatchlistTabs.svelte ──────> watchlistNavigation.ts (pure)
   ├──> WatchlistTable.svelte ─┬───> format.ts, distancePresentation.ts,
   │                           │     sortableStockColumns.ts (pure)
   │                           └───> TargetPriceCell.svelte ──> targetPriceInput.ts (pure)
   └──> WatchlistCards.svelte ─┬───> format.ts, distancePresentation.ts,
                                │     sortableStockColumns.ts (pure)
                                └───> TargetPriceCell.svelte (same instance type as above)

+page.svelte (script)
   ├──> watchlistShell.ts ──> watchlistApi.ts ──> fetch() ──> /api/*
   ├──> watchlistFilter.ts, watchlistSort.ts, watchlistPresentation.ts,
   │    investmentAllocation.ts, investmentSavingsInput.ts, format.ts   (pure helpers, direct)
   └──> src/lib/shared/{stockSymbol,watchlistName,investmentSavings}.ts (bounds, mirrored client-side)

watchlistShell.ts ──> src/lib/shared/{stockSymbol,watchlistName}.ts (pre-request validation)
```

No circular dependencies were found: pure helpers and `watchlistApi.ts` have no imports back into
`watchlistShell.ts`, components, or the route; `watchlistShell.ts` imports only `watchlistApi.ts`
and `$lib/shared`. Components import only pure client helpers and (for the two stock-presentation
components) `TargetPriceCell.svelte`; no component imports `watchlistShell.ts` or `watchlistApi.ts`
directly. This is a healthy, acyclic, unidirectional graph.

---

## 2. `+page.svelte` Responsibility Map

`+page.svelte` currently owns, in one file:

| Category | Evidence |
| --- | --- |
| Initial loading orchestration | `onMount` → `loadInitialWatchlists` (L163–191) |
| Active-watchlist selection | `handleSelectTab` (L193–229) |
| Watchlist creation | `handleCreateSubmit` (L231–269) |
| Watchlist deletion (incl. confirmation) | `handleDeleteClick` (L271–317), `window.confirm` |
| Stock addition (incl. symbol normalization UX) | `handleStockSymbolInput`, `handleAddStockSubmit` (L319–353) |
| Stock removal | `handleRemoveStock` (L359–379) |
| Target Price mutation orchestration | `handleSaveTargetPrice` (L381–409) — draft/parse/local error stays in `TargetPriceCell`; the page owns the async round trip and merge-into-`activeView` |
| Investment allocation | `handleCalculateAllocation` (L411–443) |
| Filtering | `companyNameFilter` state, `filteredStocks`/`isFiltered`/`stockCountText` derived (L82, 151–159) |
| Sorting | `sort` state, `handleSort`, `visibleStocks` derived (L87, 355–357, 155) |
| Responsive Table/Card presentation | `presentationMode` state, `currentPresentationMode()`, `$effect` `matchMedia` listener (L100–121) |
| Busy-state aggregation | `managementBusy` derived from 6 flags (L137–144) |
| Error state | 9 distinct error variables (see §3) |
| Warning state | `activeView.warnings` loop in markup (L632–634); per-row market-data warning is relayed through `TargetPriceCell`'s own local state |
| Derived stock presentation | `filteredStocks`, `visibleStocks`, `allocationBySymbol`, `stockCountText` |
| Event-handler glue | 9 handler functions, ~300 of the 444 script lines |
| Component composition | `WatchlistTabs`, conditional `WatchlistTable`/`WatchlistCards` |
| Page layout/markup | watchlist bar, workspace toolbar (3 forms), status/error/warning rendering, count footer |
| Page-level CSS | ~200 lines of scoped styles for all of the above |

**Assessment.** This is not merely "a long file." It is the single place where every workflow's
state-transition rules (busy/error bookkeeping, reset-on-transition, invalidate-on-mutation) are
expressed. The nine handler functions share a near-identical shape: call a `watchlistShell`
function with a `handlers` object whose callbacks each mutate 2–4 `$state` variables. That
repeated *mutation-lifecycle* shape — not raw line count — is the most concrete evidence that
`+page.svelte` has accumulated a distinct responsibility (workflow/state orchestration) on top of
its route-composition responsibility.

---

## 3. Complete Page-State Inventory

| State | Purpose | Owner Today | Consumers | Mutators | Persistence |
| --- | --- | --- | --- | --- | --- |
| `watchlists` | Tab list metadata | `+page.svelte` | `WatchlistTabs`, `activeWatchlistName` | `onMount`, `handleSelectTab`, `handleCreateSubmit`, `handleDeleteClick` (all via shell response) | server (KV), mirrored client-side |
| `activeWatchlistId` | Which watchlist is active | `+page.svelte` | `WatchlistTabs`, mutation calls, `activeWatchlistName` | `onMount`, `handleSelectTab`, `handleCreateSubmit`, `handleDeleteClick` | server-authoritative selection |
| `metadataStatus` | Initial metadata load phase | `+page.svelte` | top-level template branch | `onMount` handlers | not persisted |
| `metadataError` | Initial metadata load failure | `+page.svelte` | template | `onMount` handlers | not persisted |
| `activeView` | Composed active watchlist (stocks, warnings) | `+page.svelte` | `filteredStocks`, table/cards, warnings loop | `onMount`, `handleSelectTab`, `handleCreateSubmit`, `handleDeleteClick`, `handleAddStockSubmit`, `handleRemoveStock`, `handleSaveTargetPrice` | server, transient client cache |
| `activeViewStatus` | Composed-watchlist load phase | `+page.svelte` | template branches, `managementBusy` | same handlers as `activeView` | not persisted |
| `activeViewError` | Composed-watchlist load failure | `+page.svelte` | template | same handlers | not persisted |
| `tabSwitchError` | Tab-switch `PUT` failure, distinct from load failure | `+page.svelte` | template | `handleSelectTab` | not persisted |
| `newWatchlistName` | Create-watchlist draft text | `+page.svelte` | create-form input (`bind:value`) | input binding, reset on success | not persisted |
| `createStatus` | Create mutation phase | `+page.svelte` | `managementBusy`, `createDisabled`, `aria-busy` | `handleCreateSubmit` | not persisted |
| `createError` | Create mutation failure | `+page.svelte` | template | `handleCreateSubmit` | not persisted |
| `deleteStatus` | Delete mutation phase | `+page.svelte` | `managementBusy`, `deleteBusy` prop | `handleDeleteClick` | not persisted |
| `deleteError` | Delete mutation failure | `+page.svelte` | template | `handleDeleteClick` | not persisted |
| `newStockSymbol` | Add-stock draft text (also redisplays normalized/invalid input) | `+page.svelte` | stock-symbol input (`value`+`oninput`) | `handleStockSymbolInput`, `handleAddStockSubmit` (reset or `onInvalidSymbol`) | not persisted |
| `stockMutationBusy` | Add/remove-stock mutation phase | `+page.svelte` | `managementBusy`, `addStockDisabled`, `busy` prop | `handleAddStockSubmit`, `handleRemoveStock` | not persisted |
| `stockMutationError` | Add/remove-stock failure | `+page.svelte` | template | `handleAddStockSubmit`, `handleRemoveStock` | not persisted |
| `stockSymbolValidationError` | Local syntax-validation message (TASK-029), precedence over `stockMutationError` | `+page.svelte` | template | `handleAddStockSubmit` | not persisted |
| `targetPriceMutationBusy` | Target Price save phase | `+page.svelte` | `managementBusy` | `handleSaveTargetPrice` | not persisted |
| `companyNameFilter` | Company-name filter text | `+page.svelte` | `filteredStocks` | filter input (`bind:value`), reset at 3 transition points | UI-local only, never persisted |
| `sort` | Active table/card sort | `+page.svelte` | `visibleStocks`, `WatchlistTable`/`WatchlistCards` `sort` prop | `handleSort`, reset at the same 3 transition points | UI-local only |
| `presentationMode` | Table vs. Cards | `+page.svelte` | template `{#if}` selection | initial `currentPresentationMode()`, `$effect` `matchMedia` listener | UI-local, viewport-derived |
| `totalSavingsInput` | Allocation draft text | `+page.svelte` | allocation input (`bind:value`) | input binding; **not** reset by any workflow | not persisted |
| `allocationInputError` | Local total-savings parse error | `+page.svelte` | template | `handleCalculateAllocation` | not persisted |
| `investmentAllocation` | Last successful allocation result | `+page.svelte` | `allocationBySymbol`, result text | `handleCalculateAllocation`; invalidated at 6 points (see §6) | transient server result, retained client-side |
| `allocationBusy` | Allocation mutation phase | `+page.svelte` | `managementBusy` | `handleCalculateAllocation` | not persisted |
| `allocationError` | Allocation mutation failure | `+page.svelte` | template | `handleCalculateAllocation` | not persisted |

### 3.1 State Classification

| Classification | Values |
| --- | --- |
| Server-derived state | `watchlists`, `activeWatchlistId`, `activeView` |
| Transient server result retained client-side | `investmentAllocation` |
| Client workspace/UI state | `companyNameFilter`, `sort` |
| Presentation state | `presentationMode` |
| Form/draft state | `newWatchlistName`, `newStockSymbol`, `totalSavingsInput` |
| Operation/request state | `metadataStatus`, `activeViewStatus`, `createStatus`, `deleteStatus`, `stockMutationBusy`, `targetPriceMutationBusy`, `allocationBusy` |
| Error/warning state | `metadataError`, `activeViewError`, `tabSwitchError`, `createError`, `deleteError`, `stockMutationError`, `stockSymbolValidationError`, `allocationInputError`, `allocationError` |

`investmentAllocation` deliberately spans two categories: its *content* originates from the server
(a real calculation), but its *lifecycle* (undefined until calculated, invalidated on unrelated
local events) is entirely client-owned and has no server-side representation — the server never
tells the client to invalidate it. This dual nature is why ARCHITECTURE.md §22.6 and this audit
both treat it as "transient server result" rather than folding it into either pure category.

### 3.2 Server-Derived State (confirmed)

`watchlists`, `activeWatchlistId`, and `activeView` are all populated exclusively from
`watchlistApi`/`watchlistShell` responses; no client code ever synthesizes or guesses a value for
them (ARCHITECTURE.md §26.1–26.2 confirms this is intentional: "the client never invents which
Watchlist becomes active"). `activeWatchlistId` is a borderline case — it is *client-held* but its
value is always the server's answer, never a client guess (`chooseInitialActiveWatchlistId` only
falls back locally when the server's own persisted value points at a since-deleted watchlist).

### 3.3 Client Workspace State (confirmed)

`companyNameFilter` and `sort` are pure UI-local state layered over already-loaded data
(ARCHITECTURE.md §26.5–26.6: "never issues an API request and is never persisted"). Their
lifecycle is nonetheless tightly coupled to `activeWatchlistId` transitions (§6).

### 3.4 Presentation State (confirmed)

`presentationMode` is viewport-derived, has no server representation, and — per §14.6 below —
is a strong candidate to move to component level rather than stay page-level, by direct analogy
with `WatchlistTabs`' own `capacity` state.

### 3.5 Local Component State (already correctly localized — do not move)

| State | Component | Why it is correctly local |
| --- | --- | --- |
| `inputValue`, `committedValue`, `saving`, `errorMessage`, `warningMessage` | `TargetPriceCell.svelte` | Per-row draft/parse/save lifecycle; needed nowhere else; resynced from props via `$effect` |
| `capacity` (+ its `$effect` `matchMedia` listeners) | `WatchlistTabs.svelte` | Pure viewport-derived presentation state scoped to the component that renders it |
| native `<details>` open/closed (`detailsEl`, no reactive mirror) | `WatchlistTabs.svelte` | Deliberately *not* mirrored into `$state` — documented in-code rationale about a keyboard-toggle/event-timing race; a concrete example of state correctly staying out of any centralized layer |

These are explicitly **not** recommended for centralization. Moving them upward would violate the
task's own "state should live as close as possible to where it is needed, but no closer" principle
(§73) with no compensating benefit.

---

## 4. Derived-State Inventory and Dependency Graph

| Derived value | Formula | Current owner |
| --- | --- | --- |
| `managementBusy` | OR of 6 operation flags | page |
| `createDisabled` | `newWatchlistName` empty OR `managementBusy` | page |
| `addStockDisabled` | `newStockSymbol` empty OR `managementBusy` | page |
| `activeWatchlistName` | lookup in `watchlists` by id | page |
| `isFiltered` | `companyNameFilter` non-empty | page |
| `filteredStocks` | `filterStocksByCompanyName(activeView.stocks, companyNameFilter)` | page (pure helper) |
| `visibleStocks` | `sortWatchlistStocks(filteredStocks, sort)` | page (pure helper) |
| `totalStockCount` | `activeView.stocks.length` | page |
| `stockCountText` | `formatStockCount(...)` | page (pure helper) |
| `allocationBySymbol` | `buildAllocationBySymbol(investmentAllocation)` | page (pure helper) |

```text
activeView.stocks
       │
       ▼
companyNameFilter ──► filterStocksByCompanyName ──► filteredStocks ──► isFiltered, stockCountText
                                                          │
                                                          ▼
                                          sort ──► sortWatchlistStocks ──► visibleStocks
                                                                              │
                                                                              ▼
                                                             WatchlistTable / WatchlistCards

investmentAllocation ──► allocationBySymbol (Map) ──► WatchlistTable / WatchlistCards

activeViewStatus, createStatus, deleteStatus,
stockMutationBusy, targetPriceMutationBusy,
allocationBusy                                ──► managementBusy ──► every mutation control's
                                                                       disabled/aria-busy state
```

### 4.1 Derived-State Ownership

* `filteredStocks`, `visibleStocks`, `stockCountText`, `allocationBySymbol` — the *formulas* are
  already correctly pure helpers; only the `$derived` wiring lives page-level today. These belong
  wherever the source state (`activeView`, `companyNameFilter`, `sort`, `investmentAllocation`)
  ends up living — page or workspace, not a child component (multiple components/derived values
  consume them).
* `managementBusy` — genuinely page/workspace-level: it aggregates operation flags no single
  component owns, and is consumed by controls scattered across the whole tree (tabs, both forms,
  both presentation components).
* `createDisabled`, `addStockDisabled` — trivial, form-local; would naturally travel with their
  respective draft-text state if extracted into a component.
* `activeWatchlistName` — page/workspace-level (used only for the delete-confirmation message).

---

## 5. Workflow Inventory and Traces

All traces below are from the actual code (`+page.svelte` handlers → `watchlistShell.ts` →
`watchlistApi.ts` → `/api/*`).

**Initial load**
```text
onMount
→ loadInitialWatchlists(api, handlers)
→ api.loadWatchlists()           GET /api/watchlists
→ onMetadataLoaded → watchlists, activeWatchlistId set
→ api.loadWatchlist(id)          GET /api/watchlists/{id}
→ onActiveWatchlistLoaded → activeView set
```

**Select Watchlist**
```text
WatchlistTabs onSelect
→ handleSelectTab
→ switchActiveWatchlist(api, id, currentId, handlers)
→ api.selectActiveWatchlist(id)  PUT /api/watchlists/active
→ onSelected → watchlists, activeWatchlistId; companyNameFilter/sort/investmentAllocation reset
→ api.loadWatchlist(id)          GET /api/watchlists/{id}
→ onActiveWatchlistLoaded → activeView
```

**Create Watchlist**
```text
create-form submit
→ handleCreateSubmit
→ createWatchlistAndActivate(api, name, handlers)
→ api.createWatchlist(name)      POST /api/watchlists
→ onCreated → watchlists, activeWatchlistId; filter/sort/allocation reset
→ api.loadWatchlist(id)          GET /api/watchlists/{id}
→ onActiveWatchlistLoaded → activeView
```

**Delete Watchlist**
```text
WatchlistTabs onDeleteActive
→ handleDeleteClick (window.confirm gate)
→ deleteActiveWatchlistAndTransition(api, handlers)
→ api.deleteActiveWatchlist()    DELETE /api/watchlists/active
→ onDeleted → watchlists, activeWatchlistId; filter/sort/allocation reset
→ [if watchlists.length === 0: onNoWatchlistsRemaining, stop]
→ api.loadWatchlist(newId)       GET /api/watchlists/{id}
→ onActiveWatchlistLoaded → activeView
```

**Add Stock**
```text
stock-add form submit
→ handleAddStockSubmit
→ addStockToActiveWatchlist(api, watchlistId, symbol, handlers)
  → parseStockSymbol (shared, client-only pre-check) — invalid: onInvalidSymbol, no request
→ api.addStock(watchlistId, symbol)  POST /api/watchlists/{id}/stocks
→ onAdded → activeView replaced directly; investmentAllocation invalidated
```

**Remove Stock**
```text
WatchlistTable/Cards onRemove
→ handleRemoveStock
→ removeStockFromActiveWatchlist(api, watchlistId, symbol, handlers)
→ api.removeStock(watchlistId, symbol)  DELETE /api/watchlists/{id}/stocks/{symbol}
→ onRemoved → activeView replaced directly; investmentAllocation invalidated
```

**Edit Target Price**
```text
TargetPriceCell onSave (on blur/Enter, local parse first)
→ handleSaveTargetPrice
→ setTargetPriceForActiveStock(api, activeView, symbol, price, handlers)
→ api.setTargetPrice(symbol, price)  PUT /api/target-prices/{symbol}
→ onSaved → activeView stocks merged (matching symbol only); investmentAllocation invalidated
  (even when the response carries a MARKET_DATA_UNAVAILABLE warning — still a success)
→ resolves TargetPriceSaveResult back into TargetPriceCell for its own local feedback
```

**Filter stocks** — purely local: `companyNameFilter` (bind) → `filteredStocks` ($derived, pure
helper). No network request, no shell involvement.

**Change sort** — purely local: `onSort` → `handleSort` → `toggleWatchlistSort` (pure) →
`visibleStocks` ($derived). No network request.

**Calculate allocation**
```text
allocation-form submit
→ handleCalculateAllocation (parseTotalSavingsInput pre-check, local error if invalid)
→ calculateInvestmentAllocationForActiveWatchlist(api, watchlistId, totalSavings, handlers)
→ api.calculateInvestmentAllocation(watchlistId, totalSavings)
      POST /api/watchlists/{id}/investment-allocation
→ onCalculated → investmentAllocation set
```

**Resize across Table/Card breakpoint** — purely local: `matchMedia` `$effect` in `+page.svelte`
recomputes `presentationMode`; independently, `WatchlistTabs` recomputes its own `capacity` via its
own `matchMedia` `$effect`. Neither ever issues a request (confirmed by dedicated Playwright tests,
`stock-cards.spec.ts` "resizing ... causes no application API request",
`responsive-layout.spec.ts` "resizing ... recomputes navigation capacity without any additional
server request").

---

## 6. Reset / Preservation / Invalidation Rules

Confirmed directly from `+page.svelte` and cross-checked against Playwright:

```text
active-Watchlist transition (tab switch success, create success, delete/replace success)
    → companyNameFilter = ''
    → sort = DEFAULT_WATCHLIST_SORT   (Name ascending, TASK-032)
    → investmentAllocation = undefined
```

```text
same-Watchlist stock/target-price mutation success (add, remove, target-price save)
    → companyNameFilter preserved
    → sort preserved
    → investmentAllocation = undefined   (invalidated — business inputs changed)
```

```text
same-Watchlist mutation FAILURE (add, remove, target-price save, allocation calculation,
create, delete, tab switch)
    → previous activeView / watchlists / investmentAllocation left untouched
    → only the relevant *Error state is set
```

```text
Total Savings input edited alone (no submit)
    → investmentAllocation preserved (only a new successful calculation replaces it)
```

```text
filter/sort changes
    → investmentAllocation NEVER invalidated or affected (presentation-only, §13.2)
```

All of these are exercised by dedicated Playwright cases (`watchlist-filtering.spec.ts` "resets
the filter when switching...", `watchlist-sorting.spec.ts` "resets sorting when switching...",
`investment-allocation.spec.ts` "switching Watchlist tabs clears the allocation" / "a successful
stock addition invalidates the allocation..." / "a failed ... preserves the allocation", etc.).

### 6.1 Coupled State

`activeWatchlistId`, `companyNameFilter`, `sort`, and `investmentAllocation` are coupled by
workflow semantics: all three of the latter must reset **together**, and only at the exact three
points where `activeWatchlistId` itself changes. `investmentAllocation` has a *superset* of reset
triggers (also invalidated by same-watchlist mutations that leave `companyNameFilter`/`sort`
untouched). No current or hypothetical split of this state into independent stores would remove
this coupling — it would only relocate the coordination code that currently lives in the three
`handlers` objects (`onSelected`/`onCreated`/`onDeleted`) into whatever new layer replaces them.
This is significant evidence against Option C (§10) and against Svelte Context/classic stores
purely as a decomposition shortcut (§8.3–8.4).

`managementBusy`'s six inputs are coupled by mutual exclusion, not by data dependency: they exist
so that no two mutations can be in flight at once and no response can land out of order against a
newer selection (ARCHITECTURE.md §26.1–26.7, consistently). This is a different kind of coupling
(serialization, not data-flow) and argues for one aggregate flag over per-feature busy flags — the
current design already gets this right.

---

## 7. Existing Client-Layer Assessment

### 7.1 `watchlistApi.ts`

Cleanly represents an **HTTP client boundary** and nothing else: one function per endpoint, a
single shared `requestJson` helper for fetch/JSON/error-mapping, and DTO interfaces. It performs no
business calculation, no state, no orchestration across multiple calls. This is a good, correctly
scoped abstraction — no changes recommended.

### 7.2 `watchlistShell.ts`

Also cleanly scoped: nine `async function`s, each accepting `(api, ...args, handlers)` and calling
1–2 `watchlistApi` functions, translating results/errors into caller-supplied callbacks. It:

* performs pre-request validation shared with the server (`parseStockSymbol`,
  `isValidWatchlistName`) — an appropriate client-side UX optimization, not a duplicate business
  rule (both defer to the server as authoritative);
* owns **zero** reactive state of its own — every function is a plain `async` function over
  injected dependencies, independent of Svelte, and is already unit-tested that way
  (`watchlistShell.spec.ts`, 815 lines, fakes `WatchlistShellApi`);
* never decides *when* to reset `companyNameFilter`/`sort`/`investmentAllocation` — that decision
  is made entirely by the `handlers` objects the caller (`+page.svelte`) supplies.

**Distinction from a potential Workspace/ViewModel.** `watchlistShell.ts` answers "how do I
correctly sequence these two/three API calls and report the outcome," independent of any UI
framework. It has no opinion about reactive state, resets, or busy-flag aggregation — those all
live in the *caller's* `handlers`. A Workspace/ViewModel would own exactly that missing piece: the
reactive `$state`, the decision of which `*Error`/`*Busy` flags exist, and the reset/invalidation
rules — while still calling into `watchlistShell.ts` for the actual orchestration, not
reimplementing it. Introducing a Workspace layer would **not** duplicate `watchlistShell.ts`
provided it delegates to the shell rather than re-sequencing API calls itself.

### 7.3 Pure Client Helpers

| Helper | Responsibility | Quality |
| --- | --- | --- |
| `watchlistFilter.ts` | company-name substring filter + count text | cohesive, pure, tested, well-named |
| `watchlistSort.ts` | sort comparison + toggle | cohesive, pure, tested, well-named |
| `watchlistNavigation.ts` | nav partition + capacity-by-width | cohesive, pure, tested |
| `watchlistPresentation.ts` | table/cards mode-by-width | small, single-purpose, pure, tested |
| `distancePresentation.ts` | favorable/unfavorable/neutral classification | small, correctly shared between Table and Cards |
| `investmentAllocation.ts` | allocation → `Map<symbol, entry>` | small, pure, solves a real correctness problem (response-order independence) |
| `investmentSavingsInput.ts`, `targetPriceInput.ts` | locale-aware text parsing | pure, mirrors server bounds, tested |
| `sortableStockColumns.ts` | shared column metadata | prevents Table/Cards drift; good shared-data abstraction |
| `format.ts` | display-only formatting | pure, explicitly documented as containing no business formulas |

### 7.4 Explicitly Preserve

All nine modules above are cohesive, pure, independently tested, clearly named, and correctly
placed under `src/lib/client/`. **None of them should be rewritten, merged, or relocated by
TASK-042+.** This audit finds no dead weight and no accumulated scope creep in this layer — the
"pure helper" tier of the codebase is the best-architected part of the frontend today.

---

## 8. Existing Component Inventory

| Component | Responsibility (one sentence) | Key Props | Events/Callbacks | Local State | Assessment |
| --- | --- | --- | --- | --- | --- |
| `WatchlistTabs.svelte` | Render the watchlist navigation strip with responsive direct/overflow partitioning and per-active-tab delete | `watchlists`, `activeWatchlistId`, `disabled`, `deleteBusy` | `onSelect`, `onDeleteActive` | `capacity`, `detailsEl` (native disclosure) | **Good boundary.** Owns its own responsive logic end-to-end; small, cohesive prop surface |
| `WatchlistTable.svelte` | Render the desktop stock table with sortable headers | `stocks`, `sort`, `busy`, `allocationBySymbol` | `onSort`, `onRemove`, `onSaveTargetPrice` | none | **Good boundary.** Purely presentational; no API/business knowledge |
| `WatchlistCards.svelte` | Render the narrow-viewport stock cards with an explicit sort control | same shape as `WatchlistTable` | `onSort`, `onRemove`, `onSaveTargetPrice` | none (only a trivial `$derived` label) | **Good boundary.** Mirrors Table's prop contract deliberately (§9) |
| `TargetPriceCell.svelte` | Own one row's Target Price inline-edit lifecycle (draft, parse, save, feedback) | `symbol`, `targetPrice`, `busy` | `onSave` (async) | `inputValue`, `committedValue`, `saving`, `errorMessage`, `warningMessage` | **Good boundary.** The clearest example of correctly localized state + a well-designed async callback contract in the codebase |

**Assessment.** All four existing components already have well-drawn boundaries: each has a
one-sentence purpose, a prop surface proportional to its concerns, and — where it owns local
state — that state genuinely cannot live anywhere else. TASK-042+ should not touch these four
components' internal design, only extend the tree around them.

---

## 9. Missing Component Boundaries and Extraction Criteria

Candidates evaluated, using the criteria in the task (hides markup, owns local state, creates a
real interaction boundary, reduces unrelated parent concerns, improves testing, names a concept,
reduces duplication):

| Candidate | Extract? | Reasoning |
| --- | --- | --- |
| `StockAddForm` | **Yes** | ~20 lines of markup + a dedicated concept ("add a stock"); prop surface is small and single-domain (`value`, `onInput`, `onSubmit`, `disabled`, `error`) |
| `InvestmentAllocationControls` | **Yes** | ~30 lines of markup, a real interaction boundary (input + submit + conditional result + conditional error), single-domain prop surface |
| `StockPresentation` (wraps the `presentationMode` `{#if}`, empty/filtered-empty messages, and the Table/Cards choice) | **Yes** | Consolidates ~40 lines of branching template logic; also the natural home for `presentationMode` itself (§12) |
| `WatchlistCreateForm` | **Marginal — defer** | Small (~15 lines), already visually grouped with `WatchlistTabs` in one `.watchlist-bar` row; extracting it alone yields little beyond moving lines. Acceptable to do later purely for symmetry with `StockAddForm`, but not required |
| `CompanyFilter` | **No — cosmetic only** | A single `<label>` + `<input>` with one `bind:value`. Extracting it in isolation would create a component with a one-prop API and no owned state or interaction boundary — exactly the "10 lines of HTML" case the task explicitly says not to extract (§27) |
| `WatchlistWorkspaceToolbar` (wrapping `StockAddForm` + `CompanyFilter` + `InvestmentAllocationControls` as one component, per the PO's preliminary hypothesis) | **No — reject as drawn** | See §9.1 below: this would require a prop surface spanning three unrelated domains |

### 9.1 Prop-Drilling / Prop-Explosion Analysis

A single `WatchlistWorkspaceToolbar` combining all three toolbar groups would need at minimum:
`newStockSymbol`, `stockSymbolValidationError`, `stockMutationError`, `addStockDisabled`,
`onStockSymbolInput`, `onAddStockSubmit` (stock domain, 6) + `companyNameFilter` binding, a
stocks-exist guard (filter domain, 2) + `totalSavingsInput`, `allocationInputError`,
`allocationError`, `allocationBusy`, `investmentAllocation`, `onCalculateAllocation`,
`managementBusy` (allocation domain, 7) — **15+ props/callbacks spanning three functionally
unrelated concerns**, matching the task's own worked example (§29) of evidence that "state
ownership should be reconsidered rather than merely extracting markup." The three forms are only
adjacent in the current CSS layout (`.workspace-toolbar` flex row), not adjacent in domain. This
audit recommends extracting `StockAddForm` and `InvestmentAllocationControls` as **separate**
components, each with a small, single-domain prop surface, and leaving the filter input inline (or
folding it into `StockPresentation`, see §12) — the shared flex-row layout can remain page-level
CSS without forcing the three forms into one component.

---

## 10. State-Architecture Alternatives

### 10.1 Page-Owned State (status quo, with better component decomposition)

Legitimate, evaluated seriously. If only component extraction (§9) is done and all `$state` stays
in `+page.svelte`, readability improves (less inline markup) but the ~300 lines of handler/reset
wiring remain in one file, and the reset/invalidation rules (§6) remain reachable only by mounting
the full page (Playwright), not by a focused unit test.

### 10.2 Svelte Context

Rejected as the primary mechanism. Context solves *implicit* dependency passing through
intermediate components that don't otherwise need the value; none of the proposed new components
sit at more than one level of nesting below `+page.svelte`, so there is no deep-drilling problem to
solve here. Using Context here would trade explicit, traceable props for an implicit dependency
that is harder to unit test (`TargetPriceCell`'s own callback-prop pattern is a better model to
extend). Not recommended.

### 10.3 Classic Svelte Stores (`writable`/`derived`)

Evaluated and rejected as the primary mechanism, for two reasons: (1) module-level
`writable()` exports are singletons by construction, which is exactly the SSR/per-request-isolation
hazard the task warns about (§35), requiring extra care (context-scoped stores) to avoid; (2) the
project's state is a small number of *coupled* values (§6.1), not a large number of independent
ones — stores' main advantage (independently subscribable slices) is not needed here, and the
project has already standardized on Svelte 5 runes elsewhere (`$state`/`$derived`/`$effect`
throughout every existing component). Introducing classic stores alongside runes would be an
inconsistent second state paradigm for no compensating benefit.

### 10.4 Svelte 5 Rune-Based State Module

The strongest fit. A `watchlistWorkspace.svelte.ts` module using a factory function returning an
object of `$state`/`$derived` fields and methods is idiomatic Svelte 5, keeps the existing
reactivity model, and — critically — can be instantiated with a fake `WatchlistShellApi` (the same
seam `watchlistShell.spec.ts` already uses) for deterministic unit tests of the reset/invalidation
rules in §6, with no browser required. See §11 for exact scope and §13 for the SSR-safety
requirement.

---

## 11. Workspace/ViewModel Evaluation

### 11.1 Does the complexity justify it?

Yes, with a bounded scope. The evidence: nine near-identically-shaped mutation handlers; the
reset/invalidation rules in §6, which are real, non-trivial, cross-cutting invariants currently
verifiable only by mounting the whole page in Playwright; and the coupled-state relationship in
§6.1, which any viable design must still express as one coordinated unit regardless of where it
lives. A Workspace does not add complexity here — it names complexity that already exists.

### 11.2 What a Workspace Should Own

```text
server-derived state:        watchlists, activeWatchlistId, activeView, load statuses/errors
workspace state:             companyNameFilter, sort
transient server result:     investmentAllocation
operation/error state:       createStatus/Error, deleteStatus/Error, stockMutationBusy/Error,
                              stockSymbolValidationError, targetPriceMutationBusy,
                              allocationBusy/Error, allocationInputError, tabSwitchError
derived values:               managementBusy, filteredStocks, visibleStocks, stockCountText,
                              allocationBySymbol, activeWatchlistName, createDisabled,
                              addStockDisabled
workflow methods:            thin wrappers calling the existing watchlistShell functions and
                              applying their results/resets/invalidations to the fields above
```

### 11.3 What Must Stay Outside

* `watchlistApi.ts` / `watchlistShell.ts` — unchanged, called *by* the Workspace, not absorbed
  into it (§7.2).
* All pure algorithms (`watchlistFilter`, `watchlistSort`, `watchlistNavigation`,
  `watchlistPresentation`, `distancePresentation`, `investmentAllocation.ts`, `format.ts`,
  `*Input.ts` parsers) — the Workspace *calls* them, exactly as `+page.svelte` does today.
* `TargetPriceCell`'s local draft/error/saving state — stays local; the Workspace only needs to
  expose one method (`saveTargetPrice(symbol, price)`) matching the existing `onSaveTargetPrice`
  contract.
* `WatchlistTabs`' `capacity`/disclosure state — stays local, unrelated to workspace concerns.
* `presentationMode` — see §12: recommended to move to a `StockPresentation` component, not into
  the Workspace, despite appearing in the PO's preliminary hypothesis diagram as page-owned.
* `newWatchlistName`, `newStockSymbol`, `totalSavingsInput` draft text — arguable either way; this
  audit recommends keeping these **in the Workspace** rather than in the extracted form components,
  because `newStockSymbol` in particular has cross-cutting lifecycle rules (redisplay-normalized-
  on-invalid, reset-on-success) that are workflow-level, not purely presentational, and because
  `createDisabled`/`addStockDisabled` already depend on this text plus `managementBusy` together.

### 11.4 Workspace vs. `watchlistShell`

```text
watchlistShell
    → stateless orchestration around API operations: sequences 1–2 watchlistApi calls,
      reports outcomes through caller-supplied callbacks, owns no $state, framework-agnostic.

WatchlistWorkspace (proposed)
    → owns reactive page-level $state/$derived and the workflow lifecycle: which flags exist,
      what resets/invalidates when, and how a shell callback's result is applied to that state.
      Calls watchlistShell for every actual API operation; never calls fetch/watchlistApi
      directly.
```

This distinction is accurate to the current code (verified in §7.2) and is adopted for §14.

---

## 12. Responsive State: `presentationMode` vs. `WatchlistTabs`' `capacity`

Both are viewport-derived, both use a `matchMedia`-driven `$effect`, and both never issue a
request. Today they are owned inconsistently: `capacity` lives inside `WatchlistTabs` (the
component that renders the responsive UI); `presentationMode` lives in `+page.svelte`, one level
above the components (`WatchlistTable`/`WatchlistCards`) it actually decides between.

**Consistent rule (derived from comparing the two):** responsive presentation state belongs to the
component that owns the responsive rendering decision, not to the page that merely composes that
component. Applying this rule to `presentationMode` means it belongs in a new `StockPresentation`
component (§9) that internally chooses between `WatchlistTable`/`WatchlistCards`, exactly as
`WatchlistTabs` internally chooses between direct tabs and the overflow menu. This also directly
answers task §54: presentation-mode ownership belongs in a `StockPresentation` component, not
`+page.svelte`, and not a Workspace ViewModel.

---

## 13. Error and Busy State

### 13.1 Operation-State Inventory (from §3)

Nine error variables, seven busy/status variables. Grouped by workflow, each pair genuinely follows
an implicit `idle → in-flight → (success | error)` shape — most explicit as
`ActiveViewStatus`/`MetadataStatus` (`'idle' | 'loading' | 'loaded' | 'error'`), less explicit for
the boolean-flag pairs (e.g. `stockMutationBusy` + `stockMutationError`, where "idle" is simply
"busy is false and error is undefined").

### 13.2 State-Machine Smell Assessment

The two string-union statuses are already clear and do not need a formal state machine. The
boolean-pair workflows (create/delete/stock/target-price/allocation) are **not** currently
confusing in isolation — each pair is used consistently (`onX: busy=true,error=undefined`;
`onXFailed: busy=false,error=set`; `onXSucceeded: busy=false`) — but the *repetition* of this exact
shape seven times is itself the smell (§2), not any individual pair's readability. Introducing a
formal state-machine library is not warranted (task explicitly rejects XState); consolidating the
shape into one Workspace convention (e.g. a small internal `runMutation` helper used by all seven
workflow methods) would remove the repetition without adding a new abstraction paradigm.

### 13.3 `managementBusy`

Six inputs (`activeViewStatus === 'loading'`, `createStatus`, `deleteStatus`,
`stockMutationBusy`, `targetPriceMutationBusy`, `allocationBusy`). Consumers: `WatchlistTabs`
(`disabled`), the create form, the add-stock form, the allocation form, and both
`WatchlistTable`/`WatchlistCards` (`busy` prop, which further gates `TargetPriceCell` and the
remove button). Ownership is clear today (single `$derived` in one file). After refactoring, it
should move wherever its six inputs move — i.e., into the Workspace (§11.2) — since it is a
genuine cross-cutting aggregate, not something any single component should compute locally.

### 13.4 Error Ownership

**Page/workflow-level** (all nine, §3) — none are currently local-only in the sense the task asks
about, except:

**Local-only:** `TargetPriceCell`'s own `errorMessage` (parse-validation) is local and correctly
so — it never needs to be visible outside that row, and the *save* failure path is reported back
through the resolved `TargetPriceSaveResult`, not a page-level error variable at all (the message
is rendered inside the same cell). This is the one workflow that already fully avoids a
page-level error variable for its failure case, and is worth preserving as the model for any future
per-row concern.

**Avoid one giant error object:** current behavior does not support a single generic error store —
each workflow's error is genuinely independent (a create failure must not be confused with a
delete failure, etc., and several can theoretically be visible at once, e.g. a stale
`stockMutationError` beside a fresh `allocationError`). No change recommended here beyond moving
these fields into the Workspace as named, distinct fields exactly as they exist today.

---

## 14. Testing Architecture

### 14.1 Current Coverage by Layer

| Layer | Coverage |
| --- | --- |
| Pure helpers (`watchlistFilter`, `watchlistSort`, `watchlistNavigation`, `watchlistPresentation`, `distancePresentation`, `investmentAllocation`, `*Input.ts`, `format.ts`) | Full Vitest unit coverage, one `*.spec.ts` per module |
| `watchlistShell.ts` | Full Vitest unit coverage against a faked `WatchlistShellApi` (815-line spec; every handler path, including failure/no-follow-up-GET/invalid-input branches) |
| `watchlistApi.ts` | Full Vitest unit coverage (458-line spec; endpoint URLs, methods, error mapping) |
| `shared/*` | Full Vitest unit coverage |
| Component-independent tests | None — no Svelte Testing Library / component-mount unit tests exist in this project; all component behavior is verified via Playwright |
| `+page.svelte` state-transition rules (§6) | **E2E-only** — verified exclusively through `tests/e2e/*.spec.ts` |

### 14.2 Testing Gaps Caused by Page Ownership

The reset/invalidation rules in §6 (filter reset, sort reset, allocation invalidation,
`managementBusy` serialization) are *not* undertested — they have thorough, specific Playwright
coverage (confirmed: 3 filter-reset tests, 3 sort-reset tests, 9+ allocation-invalidation/
preservation tests, multiple "no additional request" busy-serialization tests). The gap is one of
**layer, not coverage**: every one of these invariants can only be exercised today by mounting the
full page in a real browser and driving it through Playwright, which is slower to run and slower to
localize a regression in than a focused unit test would be. This is a genuine, moderate finding
(§15), not a "missing tests" finding.

### 14.3 ViewModel Testability (if Workspace is adopted)

If §11's Workspace is introduced, every rule in §6 becomes directly unit-testable: instantiate
`createWatchlistWorkspace(fakeShellApi)`, call e.g. `workspace.selectWatchlist(id)`, and assert
`workspace.companyNameFilter === ''`/`workspace.sort === DEFAULT_WATCHLIST_SORT`/
`workspace.investmentAllocation === undefined` with no DOM, no `matchMedia`, no `window.confirm`,
and no Playwright browser — using the exact same fake-`WatchlistShellApi` pattern
`watchlistShell.spec.ts` already establishes. This is the single largest concrete testing benefit
identified in this audit.

### 14.4 Do Not Replace E2E

None of the above is a reason to remove or thin the Playwright suite. Playwright remains the only
layer that verifies real DOM structure, ARIA semantics, real `matchMedia`/viewport behavior, the
native `<details>` disclosure timing, and true end-to-end request/response wiring. Unit tests for a
Workspace would *add* a faster, more precise layer for state-transition logic — they would not
replace any existing Playwright spec, and no existing `tests/e2e/*.spec.ts` file should be deleted
or reduced in scope as part of TASK-042+.

---

## 15. Concrete Smells, Severity-Ranked

| # | Smell | Evidence | Severity |
| --- | --- | --- | --- |
| 1 | Repeated mutation-lifecycle shape across 9 handlers, each independently wiring busy/error `$state` around a `watchlistShell` call | `+page.svelte` L193–443, ~300 lines, near-identical `onX/onXFailed/onXSucceeded` shape repeated 9× | Medium |
| 2 | Reset/invalidation invariants (§6) verifiable only via Playwright, not unit tests | No component-mount or state-module unit test exists for `+page.svelte`'s transition rules; confirmed by absence of any `+page.svelte`-adjacent `.spec.ts` and by the shape of `watchlistShell.spec.ts` (tests the shell, not the page's use of it) | Medium |
| 3 | `presentationMode` owned one layer higher than its `WatchlistTabs`-precedent analogue (`capacity`) suggests | `+page.svelte` L100–121 vs. `WatchlistTabs.svelte` L33–57 — same pattern, inconsistent placement | Low |
| 4 | `CompanyFilter` cosmetic-extraction temptation exists in the PO's preliminary hypothesis but fails the task's own extraction criteria | §9 analysis | Low (flagged so it is *not* done, not because it currently harms anything) |
| 5 | `WatchlistWorkspaceToolbar` (as hypothesized) would combine 3 unrelated domains into one ~15-prop component | §9.1 | Medium (would be a real smell **if implemented**; currently avoided because it doesn't exist yet — recorded so TASK-042+ does not introduce it) |
| 6 | Page-level CSS (~200 lines) mixes layout for 3 unrelated toolbar groups plus overall page chrome in one `<style>` block | `+page.svelte` L670–786 | Low (cosmetic; CSS naturally follows whatever markup boundaries are chosen in §9, not a standalone problem) |

No High-severity findings. The codebase is functionally mature and already well-factored at the
pure-helper and API/shell layers (§7); the accumulated responsibility is concentrated narrowly in
`+page.svelte`'s handler-wiring section, and even there, it is a *repetition* problem, not a
correctness or untestable-business-logic problem (all business logic already lives server-side or
in already-tested pure helpers, per `ARCHITECTURE.md` §7.3/§26).

---

## 16. Duplication Assessment

### 16.1 `WatchlistTable` vs. `WatchlistCards`

Both import the same pure helpers (`format.ts`, `distancePresentation.ts`,
`sortableStockColumns.ts`) and the same `TargetPriceCell`, and both accept an almost identical
prop interface. The genuinely duplicated pieces are the **remove-button markup** (identical
`<button class="btn btn-destructive btn-icon">🗑</button>` block, byte-for-byte) and the
`distanceState`/`savingsAmount` per-row derivation (`{@const}` blocks, identical logic, different
markup shape around them). The **sort-control** markup is intentionally different (column headers
with `aria-sort` vs. a `<select>` + direction toggle), because Card mode has no table headers to
attach sort semantics to — this is legitimate, documented (ARCHITECTURE.md §26.13) presentation
divergence, not accidental duplication.

**Recommendation:** leave both components as-is. The already-extracted shared pieces
(`SORTABLE_STOCK_COLUMNS`, `distanceStateFor`, `format.ts`, `TargetPriceCell`) already capture the
real shared logic; further extracting the remove-button or the `{@const}` derivation would save
under 10 lines total per component at the cost of a new shared sub-component/helper with its own
prop surface — not a worthwhile trade per the task's own "not automatically better" guidance (§2).

### 16.2 Form Logic Duplication

Evaluated across Watchlist-create, Stock-add, Allocation, and Target-Price forms: each is a
`<form onsubmit>` with `event.preventDefault()`, a bound/controlled input, and a submit button
whose `disabled`/`aria-busy` derive from local + `managementBusy` state. This is normal, explicit,
repeated-but-not-duplicated code — each form's actual business/validation rule differs (blank-name
check, symbol-syntax check, savings-integer-parse check, price-parse check), so a generic
`<Form>` abstraction would need to parameterize away exactly the part that differs per form. No
generic form abstraction is recommended (task §66 explicitly warns against this). The one real
repeated *shape* worth addressing is the busy/error-bookkeeping pattern already covered by Finding
#1 (§15) — solved by the Workspace's internal convention (§13.2), not by a generic `<Form>`
component.

---

## 17. Naming Assessment

| Name | Assessment |
| --- | --- |
| `watchlistShell` | The weakest name in the codebase for a newcomer. "Shell" does not communicate "stateless async orchestration over the API" to someone unfamiliar with the term's use in this project; it could easily be mistaken for a UI application-shell (header/nav chrome) or an OS-shell metaphor. **Recommend renaming eventually** (e.g. to something like `watchlistOperations.ts` or `watchlistWorkflows.ts`) — but per the task, **not during TASK-041**, and not bundled into the same PR as the Workspace introduction (renaming and introducing a new layer in one change would make the diff harder to review and the git history harder to follow for this one file). |
| `WatchlistTabs` | Clear; matches its rendered UI and ARIA role (`role="tablist"`). No change. |
| `WatchlistTable` / `WatchlistCards` | Clear, symmetric, matches ARCHITECTURE.md's own vocabulary ("Table presentation" / "Card presentation"). No change. |
| `watchlistPresentation` (module) | Adequate but slightly generic given the new `StockPresentation` *component* this audit proposes (§9/§12) — the two names being this close (`watchlistPresentation.ts` the pure helper vs. `StockPresentation.svelte` the proposed component) is worth a naming pass when that component is introduced, to avoid confusion between the pure width→mode function and the component that uses it. Not a blocker; flag for TASK-042+'s component-extraction PR to choose non-colliding names up front (e.g. keep `watchlistPresentation.ts` for the pure helper, and prefer `StockCardsOrTable.svelte` or confirm `StockPresentation.svelte` reads unambiguously in review). |

No renames are performed in this task, per §93.

---

## 18. Architecture Options

### Option A — Page-Owned State + Component Extraction Only

```text
+page.svelte (still owns all $state)
    ├── StockAddForm.svelte            (new)
    ├── InvestmentAllocationControls.svelte  (new)
    ├── StockPresentation.svelte       (new; owns presentationMode)
    ├── WatchlistTabs.svelte           (unchanged)
    └── (WatchlistTable/WatchlistCards now composed inside StockPresentation)
watchlistShell.ts / watchlistApi.ts / pure helpers  (unchanged)
```

### Option B — Component Extraction + Rune-Based Workspace (recommended)

```text
+page.svelte
    │ creates one WatchlistWorkspace instance (factory, per page-instance)
    ├── WatchlistTabs.svelte
    ├── StockAddForm.svelte
    ├── InvestmentAllocationControls.svelte
    └── StockPresentation.svelte       (owns presentationMode; NOT in the Workspace)

watchlistWorkspace.svelte.ts (new)
    │ owns: watchlists, activeWatchlistId, activeView, statuses/errors,
    │       companyNameFilter, sort, investmentAllocation, managementBusy, derived stocks
    └──> watchlistShell.ts (unchanged) ──> watchlistApi.ts (unchanged) ──> pure helpers (unchanged)
```

### Option C — Multiple Independent Feature Stores

```text
watchlistSelectionStore, filterStore, sortStore, allocationStore  (separate modules)
+page.svelte subscribes to all four and manually re-coordinates their resets
```

### 18.1 Comparison

| Criterion | Option A | Option B | Option C |
| --- | --- | --- | --- |
| Readability | Better than status quo; handler wiring still page-level | Best — workflows read as named Workspace methods | Worse — one invariant spans 4 files |
| Traceability | Direct, one file | Direct, one extra named hop (page → workspace → shell → api) | Fragmented — cross-store coordination needed anyway |
| State coupling | Unchanged (still colocated, which matches reality) | Made explicit in one cohesive module | Actively fights real coupling (§6.1) |
| Prop complexity | Low per new component | Low per new component; Workspace fields passed explicitly | N/A (store-based), but reintroduces implicit `$store` access |
| Testing | No new unit-test surface for §6 rules | New unit-test surface for all §6 rules (biggest gain) | Per-store unit tests possible, but miss the actually-important cross-store invariants |
| Svelte idiomaticity | Idiomatic, minimal | Idiomatic Svelte 5 (runes), consistent with the rest of the codebase | Legacy pattern relative to the project's established runes-only convention |
| SSR safety | Trivial (component-local state only) | Safe **only if** factory-instantiated per page (§13); documented requirement | Same singleton risk, arguably worse (stores are conventionally module-level exports) |
| Implementation risk | Low | Medium — must preserve 9 workflows' exact behavior; mitigated by phasing (§19) | High — splitting genuinely coupled state is more bug-prone |
| Migration effort | Low | Medium, phased | High |

### 18.2 Recommendation

**Option B**, phased so that Option A's component extractions land first (independently valuable,
low risk, immediately reviewable) and the Workspace migration follows once those extractions are
stable — see §19. Option C is rejected outright: the coupling evidence in §6.1 shows the state is
not actually independent, so splitting it would relocate coordination complexity rather than remove
it, while adding SSR-singleton risk and a second state paradigm.

---

## 19. Evaluation of the Product Owner's Preliminary Hypothesis

The hypothesis (task body, "Preliminary Hypothesis to Validate") proposed:

```text
+page.svelte → WatchlistNavigation, WatchlistWorkspaceToolbar (StockAddForm + CompanyFilter +
InvestmentAllocationControls), StockPresentation (WatchlistTable + WatchlistCards)
WatchlistWorkspace (.svelte.ts) → page-level reactive state, derived visible state, workflow
lifecycle, uses watchlistShell + pure helpers
watchlistShell → stateless API/application orchestration
watchlistApi → HTTP transport
```

**Confirmed by this audit:** the overall three-tier shape (components → Workspace → shell → api),
the Workspace/shell distinction as drafted (§11.4), `StockPresentation` wrapping
`WatchlistTable`/`WatchlistCards`, and treating `watchlistShell`/`watchlistApi`/pure helpers as
unchanged foundations.

**Revised by this audit:**

* **Reject `WatchlistWorkspaceToolbar`** as a single component (§9.1) — the three forms it would
  wrap span unrelated domains and would produce a 15+-prop component. `StockAddForm` and
  `InvestmentAllocationControls` should be extracted as **separate** components; `CompanyFilter`
  should **not** be extracted as its own component at all (cosmetic-only, §9).
* **`presentationMode` belongs in `StockPresentation`, not the Workspace** (§12) — the hypothesis
  diagram lists `WatchlistWorkspace` as owning "derived visible state," which is correct for
  `filteredStocks`/`visibleStocks`, but `presentationMode` itself is viewport-presentation state
  with a direct precedent (`WatchlistTabs`' `capacity`) for component-level ownership, not
  workspace-level.
* **`WatchlistNavigation` as a name is unnecessary** — `WatchlistTabs.svelte` already exists,
  already does this job, and is already well-named; no rename or wrapper is needed.

The hypothesis's core structural instinct (extract cohesive components, introduce one workspace
module for coupled reactive state, keep shell/api/helpers as foundations) is validated by the
actual code. Its specific toolbar grouping is not, and should not be implemented as drawn.

---

## 20. Local-State Placement Rule

Applying "state should live as close as possible to where it is needed, but no closer" (§73) to
the concrete inventory in this audit:

| State | Correct level | Rationale |
| --- | --- | --- |
| Target Price draft | Component (`TargetPriceCell`) | Needed nowhere else; already correct |
| Overflow menu open/closed | Component (`WatchlistTabs`) | Needed nowhere else; already correct |
| Form input text (create/add-stock/allocation) | Workspace (proposed) | Cross-cuts workflow rules (redisplay-on-invalid, disabled-computation with `managementBusy`); not purely presentational |
| Responsive presentation (`presentationMode`) | Component (proposed `StockPresentation`) | Direct precedent from `WatchlistTabs`' `capacity`; needed only by the component that chooses Table vs. Cards |
| Sort | Workspace (proposed) | Consumed by 2 sibling components (`WatchlistTable`/`WatchlistCards` via `StockPresentation`) and coupled to watchlist-transition resets (§6) |
| Filter | Workspace (proposed) | Same reasoning as sort |
| Allocation | Workspace (proposed) | Transient server result with cross-cutting invalidation triggers spanning multiple workflows (§6) |
| Active Watchlist | Workspace (proposed) | Server-derived, drives nearly everything else; the coordination root |

---

## 21. Server State vs. UI State — Explicit Classification

**Server-derived state:** `watchlists`, `activeWatchlistId`, `activeView` (§3.2).

**UI/workspace state:** `companyNameFilter`, `sort` (§3.3).

**Transient server result retained client-side:** `investmentAllocation` (§3.1, §3.2).

**Local interaction state:** Target Price draft/save/error/warning (`TargetPriceCell`), overflow
open/closed and responsive `capacity` (`WatchlistTabs`), and — after refactoring —
`presentationMode` (proposed `StockPresentation`).

---

## 22. Refactoring Safety

### 22.1 Critical Invariants and Existing Test Protection

| Invariant | Existing protection |
| --- | --- |
| Active-Watchlist transition rules (server-authoritative selection, never optimistic) | `watchlist-tabs.spec.ts` ("switching tabs persists the selection before loading...", "keeps the previous tab active and shows an error when the active mutation fails") |
| Filter reset/preservation | `watchlist-filtering.spec.ts` (3 reset tests + 2 preservation tests) |
| Sort reset/preservation | `watchlist-sorting.spec.ts` (3 reset tests + 4 preservation tests) |
| Allocation invalidation/preservation | `investment-allocation.spec.ts` (9+ tests covering every invalidation/preservation trigger in §6) |
| Management-busy serialization / no duplicate mutation requests | `stock-management.spec.ts` ("submits the add-stock form exactly once on Enter"), `watchlist-management.spec.ts` ("submits the create form exactly once on Enter"), `investment-allocation.spec.ts` ("calculates exactly once on Enter"), `watchlist-tabs.spec.ts` ("does not re-issue the active mutation when selecting the already active tab") |
| Target Price partial success (`MARKET_DATA_UNAVAILABLE` warning still a save) | `investment-allocation.spec.ts` ("a Target Price save with an unavailable refreshed distance still invalidates the allocation"); Target-Price-specific warning behavior covered in `target-price.spec.ts` |
| Responsive Table/Card state preservation across the breakpoint | `stock-cards.spec.ts` ("Card→Table: filter, non-default sort, and a calculated allocation survive resizing...", "Table→Card: a non-default sort ... survives resizing...") |
| Navigation active-tab visibility (always directly visible) | `watchlist-tabs.spec.ts` ("the active watchlist is directly visible on load even far beyond the visible window", "a newly created watchlist becomes directly visible even beyond capacity") |
| No duplicate mutation requests (general) | Covered per-workflow as above; no single consolidated test, but no gap identified |

### 22.2 Characterization Coverage Conclusion

**No missing characterization coverage was identified.** Every critical invariant enumerated by the
task (§77) already has direct, specific Playwright protection. This is a notable and favorable
finding: TASK-042+ does not need a dedicated "write characterization tests" phase before touching
`+page.svelte` — the existing E2E suite already serves that role, provided every phase keeps
`npm run test:e2e` green (§22.3). The only *addition* recommended is the new Workspace-level unit
tests described in §14.3, which are additive (a faster, more precise second layer), not a
replacement for or prerequisite to the existing E2E protection.

### 22.3 Phase-by-Phase Green Requirement

Every phase in §23 must leave `npm run test`, `npm run test:e2e`, `npm run check`, `npm run lint`,
and `npm run build` green before merging, per the task's explicit requirement (§81) and
`CLAUDE.md`'s testing guidance.

---

## 23. Incremental Refactoring Plan (TASK-042+)

Four phases, each independently reviewable and each leaving the full check suite green.

### TASK-042 — Extract `StockAddForm` and `InvestmentAllocationControls`

* **Objective:** Move the stock-add form and the allocation form's markup out of `+page.svelte`
  into two new presentational components, following the existing prop/callback pattern established
  by `WatchlistTable`/`WatchlistCards` (controlled value + callback props, no owned business state).
* **Files/responsibilities affected:** new `src/lib/components/StockAddForm.svelte`, new
  `src/lib/components/InvestmentAllocationControls.svelte`; `+page.svelte` loses the corresponding
  markup but keeps all underlying `$state`/handlers unchanged (props simply thread through).
* **Behavior that must remain unchanged:** every existing Playwright assertion in
  `stock-management.spec.ts` and `investment-allocation.spec.ts` must continue to pass unmodified
  (no selector/markup changes beyond component boundaries; `aria-label`s, `id`s, and DOM structure
  preserved exactly).
* **Why independently reviewable:** pure UI extraction with zero state-ownership change; smallest
  possible diff that still delivers value; no risk to the coupled-state invariants in §6 since no
  state moves.

### TASK-043 — Extract `StockPresentation` (and relocate `presentationMode`)

* **Objective:** Introduce `src/lib/components/StockPresentation.svelte` that owns
  `presentationMode` (moved from `+page.svelte`, following the `WatchlistTabs`-`capacity`
  precedent from §12) and internally renders the empty/filtered-empty messages plus
  `WatchlistTable`/`WatchlistCards`.
* **Files/responsibilities affected:** new `StockPresentation.svelte`; `+page.svelte` loses
  `presentationMode`/`currentPresentationMode`/its `$effect`, and the corresponding template
  branch, replaced by one component instance.
* **Behavior that must remain unchanged:** all of `stock-cards.spec.ts`'s presentation/breakpoint
  tests and `responsive-layout.spec.ts`'s breakpoint-boundary test must continue to pass unmodified.
* **Why independently reviewable:** isolated relocation of one cohesive concern with an existing,
  proven precedent in the same codebase; no interaction with the mutation-lifecycle handlers.

### TASK-044 — Introduce `watchlistWorkspace.svelte.ts` and Migrate Page State

* **Objective:** Introduce the rune-based Workspace module per §11.2, instantiated via a factory
  function called from inside `+page.svelte`'s own `<script>` (never as a module-level singleton —
  see §13 requirement below), and migrate every remaining page-level `$state`/`$derived`/handler
  from §3–§5 into it, exposing workflow methods (`selectWatchlist`, `createWatchlist`,
  `deleteActiveWatchlist`, `addStock`, `removeStock`, `saveTargetPrice`, `calculateAllocation`,
  plus `companyNameFilter`/`sort` setters) that `+page.svelte` calls from thin template bindings.
* **Files/responsibilities affected:** new `src/lib/client/watchlistWorkspace.svelte.ts` (or
  `src/lib/workspace/watchlistWorkspace.svelte.ts` if a small dedicated directory is preferred —
  no broader directory restructuring, per §24); `+page.svelte`'s `<script>` shrinks to
  instantiating the Workspace and wiring its fields/methods to the composed components from
  TASK-042/043.
* **Behavior that must remain unchanged:** the complete existing Playwright suite must pass
  unmodified; additionally, new Vitest unit tests must be added for every reset/invalidation rule
  in §6 (filter/sort reset on the three transition points, allocation invalidation on the six
  documented triggers, allocation preservation on failure), instantiated against a fake
  `WatchlistShellApi` following the `watchlistShell.spec.ts` pattern.
* **SSR/singleton requirement:** the Workspace factory must be called from within
  `+page.svelte`'s component-scoped `<script>` (or an equivalent per-instance call site), never
  exported as an already-constructed module-level object — this task must explicitly verify no
  shared state can leak across concurrent page instances/requests before merging.
* **Why independently reviewable:** the highest-risk phase, but scoped purely to *relocating*
  existing, already-audited logic (§6) with no behavior change and no new product functionality;
  reviewable against this audit's §3–§6 inventories line by line.

### TASK-045 — Naming Follow-Up (optional, defer to Product Owner)

* **Objective:** Evaluate renaming `watchlistShell.ts` (§17) now that a `WatchlistWorkspace` exists
  alongside it and the two names' relationship needs to be clear to a newcomer; evaluate whether
  `watchlistPresentation.ts` (pure helper) and `StockPresentation.svelte` (component) read
  unambiguously together, renaming one if not.
* **Files/responsibilities affected:** rename-only; no behavioral change.
* **Behavior that must remain unchanged:** entire test suite passes unmodified; only import paths
  change.
* **Why independently reviewable:** zero behavior risk, purely a naming/clarity change; explicitly
  optional and separable from TASK-042–044, so the Product Owner can decide whether to schedule it
  at all.

This is four phases (three required, one optional), not ten — consistent with §83's "avoid
excessive task fragmentation."

---

## 24. Explicit Non-Goals (of this audit and of the proposed plan)

* No component extraction, Workspace state, new stores, Context, or new dependency was implemented
  in TASK-041.
* No directory restructuring (`src/lib/watchlist/` feature-folder style, §42–45 of the task) is
  recommended at this time: the current three-directory split
  (`components`/`client`/`shared`) remains navigable at the current file count (4 components, 22
  client files, 4 shared files), and a mass move would produce import churn and git-history noise
  disproportionate to any discoverability gain (§44). If the component count roughly doubles
  after TASK-042–044 (4 → 7–8), this should be revisited, but not moved preemptively.
* No production module is renamed in this task; `watchlistShell` naming is flagged (§17) but
  deferred to an optional, separate future task (§23, TASK-045).
* No `ARCHITECTURE.md` rewrite: §26 already describes the current, still-accurate architecture
  through TASK-036; this audit adds a forward-looking companion document rather than rewriting
  accepted history. A short pointer note is added to `ARCHITECTURE.md` (§25 of this document)
  referencing this audit, consistent with the task's optional allowance (§89).

---

## 25. `ARCHITECTURE.md` Reference Note

A short pointer was added at the end of `ARCHITECTURE.md` §26 ("Client-Side State") noting that
TASK-041 audited the accumulated frontend structure and linking to this document, without
rewriting any of the accepted TASK-016–036 architecture it describes.

---

## 26. Risks

* **TASK-044 (Workspace migration)** is the only phase with meaningful behavioral risk, because it
  touches all nine mutation workflows at once. Mitigated by: (a) no missing characterization
  coverage (§22.2) — the full existing Playwright suite already pins current behavior; (b) doing it
  last, after the lower-risk component extractions have already reduced `+page.svelte`'s surface
  area; (c) requiring new Workspace-level unit tests for every §6 rule as part of the same task,
  so a regression is caught at two independent layers.
* **SSR/singleton misuse** is a real risk category for any rune-based module introduced in
  TASK-044 if implemented incorrectly (e.g. as a module-level exported instance rather than a
  factory called per page instance). This audit flags the exact requirement (§13, §23 TASK-044) so
  the implementing task cannot silently miss it.
* **Toolbar over-extraction** (`WatchlistWorkspaceToolbar` as originally hypothesized) was
  evaluated and explicitly rejected (§9.1, §19) specifically to prevent a future task from
  reintroducing a high-prop-count component under the assumption that the PO's preliminary diagram
  was final guidance.

---

## 27. Summary of Recommendation

1. Do not centralize `TargetPriceCell`'s draft state or `WatchlistTabs`' disclosure/`capacity`
   state — both are correctly local today.
2. Extract `StockAddForm`, `InvestmentAllocationControls`, and `StockPresentation` (the latter
   absorbing `presentationMode`) as new, small, single-domain components. Do not extract
   `CompanyFilter` alone, and do not build a combined `WatchlistWorkspaceToolbar`.
3. Introduce one rune-based `watchlistWorkspace.svelte.ts`, factory-instantiated per page, owning
   the coupled server-derived/workspace/operation state and the workflow methods that wrap the
   unchanged `watchlistShell.ts`/`watchlistApi.ts`/pure-helper layers.
4. Leave `watchlistApi.ts`, `watchlistShell.ts`, and all nine pure client helpers exactly as they
   are — they are already correctly scoped, cohesive, pure, and tested.
5. Defer the `watchlistShell` rename and any directory restructuring; neither is justified today.
6. Sequence the work as TASK-042 (StockAddForm/InvestmentAllocationControls) → TASK-043
   (StockPresentation/presentationMode) → TASK-044 (Workspace) → optional TASK-045 (naming),
   each independently green.
