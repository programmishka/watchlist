# Input Boundary Security Audit

Status: Complete (TASK-037); field/resource-bound findings closed by TASK-038

This document is the output of TASK-037. It is an **audit and design
document only**. No validation behavior was changed while producing it. It
defines the scope for TASK-038 (final field-level bounds) and identifies
whether a separate TASK-039 (request-body-size hardening) is warranted.

## TASK-038 Implementation Status

TASK-038 implemented every field-level bound and the Watchlist stock-capacity
limit this audit recommended (§14/§15/§18), largely as recommended:

* Watchlist name (≤ 50, UTF-16 code units after trim), Stock Symbol (≤ 20,
  applied identically to stock addition *and* the Target Price `symbol` path
  parameter — closing the §4 casing/grammar inconsistency), Target Price
  (`0 < value <= 1,000,000`, no decimal-place restriction), Total Savings
  (`0 <= value <= 10,000,000`, `Number.isSafeInteger`), Watchlist ID (≤ 64
  characters, `400 INVALID_REQUEST` distinct from `404 WATCHLIST_NOT_FOUND`
  as this audit recommended in §7/§17), and the company-name filter (≤ 100,
  client-only) are all enforced exactly as recommended in §15.
* A new resource bound not covered by TASK-037 was introduced by TASK-038's
  own task specification: a Watchlist may contain at most 1,000 stocks
  (`MAX_STOCKS_PER_WATCHLIST`), enforced before `MarketDataProvider.resolveSymbol()`.
* Error-code reuse followed §11 exactly: no new API codes were introduced for
  the field-level bounds themselves. One genuinely new code,
  `WATCHLIST_STOCK_LIMIT_REACHED` (409), was introduced for the new capacity
  rule, which this audit did not anticipate.
* Request-body-size/transport-level hardening remains explicitly **open**,
  exactly as recommended in §10/§18 — see **TASK-039** below.

This section records implementation status only; the findings above (§1-§18)
are preserved unmodified as the original audit record.

Method: every route handler, request parser, domain/service validation
function, persistence repository, and client input component under
`src/` was read directly (not assumed from historical task descriptions).
A small number of local, temporary Node experiments (not committed) were
used to confirm JSON-parsing and floating-point edge cases; see §9.

---

## 1. Complete HTTP Route Inventory

| Method | Route | Body fields | Path params | Query params |
| --- | --- | --- | --- | --- |
| GET | `/api/watchlists` | — | — | — |
| POST | `/api/watchlists` | `name: string` | — | — |
| PUT | `/api/watchlists/active` | `watchlistId: string` | — | — |
| DELETE | `/api/watchlists/active` | — | — | — |
| GET | `/api/watchlists/{watchlistId}` | — | `watchlistId` | — |
| POST | `/api/watchlists/{watchlistId}/stocks` | `symbol: string` | `watchlistId` | — |
| DELETE | `/api/watchlists/{watchlistId}/stocks/{symbol}` | — | `watchlistId`, `symbol` | — |
| PUT | `/api/target-prices/{symbol}` | `targetPrice: number` | `symbol` | — |
| POST | `/api/watchlists/{watchlistId}/investment-allocation` | `totalSavings: number` | `watchlistId` | — |

Found via direct inspection of `src/routes/api/**/+server.ts` (8 files) and
by grepping the whole tree for `request.json()`, `params`,
`url.searchParams`, and `request.formData()`. No route uses query
parameters or `formData()`. No SvelteKit form actions (`+page.server.ts`)
exist anywhere in `src/routes` — every mutation is a JSON `fetch` call from
the client API module (`src/lib/client/watchlistApi.ts`).

The only application-relevant request **header** is
`Cf-Access-Jwt-Assertion`, read once in
`CloudflareAccessJwtAuthenticationContext.ts` and cryptographically
verified against Cloudflare's JWKS. Per the task's framing this is
Cloudflare-Access authentication plumbing, not a product input, and is out
of scope for length/range hardening.

Every route requires authentication via `requireUserId(locals)`
(`src/lib/server/api/auth.ts`); the user ID is always taken from
`locals.user.id`, never from the client. No route lets the client supply a
user ID. This matches ARCHITECTURE.md §8.3/§29 and was not further audited
beyond confirming no regression.

---

## 2. Visible Client Input Inventory

| Field | Component | Crosses network? | Notes |
| --- | --- | --- | --- |
| Watchlist name | `+page.svelte` (`#new-watchlist-name`) | Yes → `POST /api/watchlists` `name` | `type="text"`, no `maxlength` |
| Stock symbol | `+page.svelte` (`#new-stock-symbol`) | Yes → `POST .../stocks` `symbol` | `type="text"`, uppercased live via `oninput`, no `maxlength` |
| Target Price | `TargetPriceCell.svelte` (per row) | Yes → `PUT /api/target-prices/{symbol}` `targetPrice` | `type="text" inputmode="decimal"`, no `maxlength` |
| Total Savings | `+page.svelte` (`#total-savings`) | Yes → `POST .../investment-allocation` `totalSavings` | `type="text" inputmode="numeric"`, no `maxlength` |
| Company-name filter | `+page.svelte` (`#company-name-filter`) | **No** | Purely local, never sent to the server |

No other `<input>`/`<select>`/`<textarea>` in the codebase accepts
free-text/numeric user input that is sent to the server. (`WatchlistCards.svelte`
has a `<select>` for sort column — a fixed enum, not free text, and it is
local-only.) None of the five inputs above currently declare an HTML
`maxlength`.

---

## 3. Watchlist Name

**Current behavior** (`WatchlistService.createWatchlist`,
`src/lib/server/watchlist/WatchlistService.ts:37-42`):

* trimmed (`value.trim()`) — no other whitespace normalization;
* rejected only if the trimmed result is empty (`InvalidWatchlistNameError`
  → `400 INVALID_WATCHLIST_NAME`);
* **no maximum length** — a multi-megabyte name is accepted by the server
  today, limited only by the fact that `request.json()` must first
  succeed and the value must be a `string` (`requireStringField`);
* no character-set restriction — any Unicode string is accepted verbatim;
* duplicate names are explicitly allowed (ARCHITECTURE.md §9.2/§11.1);
  tabs are keyed by `id`, never by `name`;
* persisted verbatim as one field inside the single per-user
  `user:<userId>:watchlists` KV document (ARCHITECTURE.md §10.1) —
  there is no per-watchlist record, so an oversized name inflates the one
  document every watchlist operation reads/writes.

**Client validation**: `createWatchlistAndActivate`
(`src/lib/client/watchlistShell.ts:167-175`) only refuses an
empty/whitespace-only trimmed name before sending the request. No length
check exists client-side, and the input has no `maxlength`.

**Authoritative layer**: server (`WatchlistService.createWatchlist`) for
non-emptiness. For maximum length: **MISSING** — no layer enforces one.

**Length-bound recommendation.** The 50-character starting candidate is
appropriate:

* the compact tab strip (§14.5/§26.12, `WatchlistTabs.svelte`) renders each
  watchlist's name as a direct tab label competing for horizontal space
  with up to 7 sibling tabs on a wide desktop — a very long name would
  visually dominate or force wrapping/truncation the component doesn't
  currently implement;
* duplicate names are allowed, so there is no uniqueness reason to allow
  long names to disambiguate entries;
* the storage model (one JSON document per user containing all watchlists)
  means every watchlist's name is loaded on every read — bounding it keeps
  the document's size predictable;
* no existing test asserts a specific maximum, so 50 introduces no
  contradiction with current coverage (`WatchlistService.spec.ts` tests
  trimming/empty-rejection/duplicate-allowed only).

**Final recommendation: 50 characters, counted after trimming.**

**Unicode semantics.** Recommend counting **UTF-16 code units**
(JavaScript's native `string.length`), not Unicode code points or
grapheme clusters. Rationale: this is a personal-use financial tool, not
an internationalization-heavy product; introducing a grapheme-segmentation
library (e.g. `Intl.Segmenter`-based counting) for a cosmetic label field
is a speculative abstraction the project already asks not to introduce
(CLAUDE.md "Avoid speculative abstractions"). `string.length` is exactly
what `requireStringField`/`WatchlistService` already operate on with zero
new dependencies. The only practical consequence is that a name built
from astral-plane characters (rare emoji, certain CJK extension
characters) could count as 2 code units per visual character — an
acceptable, well-understood JavaScript convention, not a security gap.

---

## 4. Stock Symbol

**Current rule** (`src/lib/shared/stockSymbol.ts`, TASK-029/030, confirmed
unchanged): `parseStockSymbol` = trim → uppercase
(`normalizeStockSymbol`) → grammar check (`isValidStockSymbol`) against

```regex
^[A-Z0-9]+(?:[.-][A-Z0-9]+)*$
```

A syntactically valid, normalized symbol then goes to
`MarketDataProvider.resolveSymbol()` (`AddStockToWatchlistService.addStock`)
for provider-neutral equity resolution (TASK-030) before
`WatchlistService.addSymbol` persists it. This grammar and pipeline are
confirmed exactly as ARCHITECTURE.md §12.1/§12.1.2 describe; no drift found.

**Missing length bound.** The regex imposes **no upper bound** on length.
Confirmed experimentally: a 5,000-character string of `A` (and the same
string with a `.B` suffix) both pass `isValidStockSymbol`. This is an
explicit `MISSING` gap.

**Provider exposure — confirmed.** Because
`AddStockToWatchlistService.addStock` calls
`this.marketDataProvider.resolveSymbol(parsed.symbol)` immediately after
the (length-unbounded) grammar check, **an arbitrarily long syntactically
valid symbol currently reaches `YahooFinanceAdapter.resolveSymbol()`**,
which forwards it into the `yahoo-finance2` `quote()` call — i.e. an
outbound Yahoo Finance request is made with attacker-controlled
unbounded-length content before any application-level length rejection.
This is the concrete "boundary-hardening gap" the task asks to identify
explicitly. TASK-038 must reject invalid length before this call, exactly
as it already rejects invalid grammar before this call.

**Length-bound recommendation.** The 20-character starting candidate holds
up against real provider conventions. Yahoo-style symbols observed in the
codebase/ARCHITECTURE.md examples top out around 8–9 characters including
exchange suffix (`0700.HK`, `7203.T`, `HEXA-B.ST`, `LISP.SW`, `GAW.L`); even
generously long multi-part instruments (e.g. a 6-character US OTC root
plus a 3–4 character exchange suffix) stay well under 20. No broad Yahoo
Search integration was performed (out of scope per the task), but no
example anywhere in the domain documentation or tests approaches 20
characters.

**Final recommendation: 20 characters, measured after normalization
(trim + uppercase), enforced before `resolveSymbol()`/`getQuote()` is
called.**

**Symbol path-parameter inconsistency — confirmed.**
`PUT /api/target-prices/{symbol}` does **not** apply the same
normalization/grammar as stock addition. Its handler
(`src/lib/server/target-price/TargetPriceService.ts:8-14`,
`assertValidSymbol`) only trims and rejects empty/whitespace-only input —
no uppercasing, no grammar check. Confirmed by
`targetPriceRoute.spec.ts`'s `'trims the symbol...'` test, which round-trips
a mixed-case, already-well-formed symbol (`  GAW.L  ` → `GAW.L`) without
exercising any rejection path for a malformed one. Consequently:

* a syntactically invalid string (e.g. containing spaces, unsupported
  punctuation, or of unbounded length) that is merely non-empty after
  trimming is passed directly to `marketDataProvider.getQuote()` in
  `setTargetPrice` (`targetPriceHandlers.ts:35`) — an actual outbound
  Yahoo Finance call with unvalidated content, the same class of gap as
  §4's provider-exposure finding, but via a different route;
  DELETE `/api/watchlists/{watchlistId}/stocks/{symbol}` has no such
  exposure — that path only compares the trimmed symbol against the
  watchlist's already-normalized stored symbols and never calls the
  provider, so a malformed value simply produces `SYMBOL_NOT_FOUND`;
* a symbol persisted through the Target Price path uses a different casing
  rule than one persisted through stock addition, so `AAPL` (added as a
  stock) and a target price set via `aapl` in the URL persist as two
  different keys (`AAPL` vs `aapl`) in the Target Prices KV document —
  they would never merge, silently defeating the "Target Price belongs to
  User + Symbol" model (ARCHITECTURE.md §9.3) for a caller that bypasses
  the UI's implicit uppercase behavior. The UI never triggers this today
  because `TargetPriceCell` only edits the price for a symbol already
  displayed in the table (already uppercase-canonical), but a direct API
  caller can.

This is reported as an inconsistency only, per the task's instruction not
to fix it in TASK-037. TASK-038 should decide whether the Target Price
`symbol` path parameter is brought onto the same
`parseStockSymbol`/grammar/length rule as stock addition (recommended), or
kept as a deliberately narrower rule with its own justification.

---

## 5. Target Price

**Current client parsing** (`src/lib/client/targetPriceInput.ts`,
`parseTargetPriceInput`):

* trims whitespace;
* accepts `.` or `,` as decimal separator, never both in the same value;
* rejects empty, bare separator, non-numeric text;
* rejects `<= 0` and non-finite results;
* **no textual length constraint** — the `<input>` has no `maxlength` and
  the parser itself imposes none (a string of thousands of digits would
  still be regex-matched and `Number()`-parsed, just producing `Infinity`
  or a very large finite number, see §7);
* no explicit numeric upper bound — anything `> 0` and finite passes.

**Current server validation**
(`src/lib/server/target-price/TargetPriceService.ts:16-20`,
`assertValidTargetPrice`): `Number.isFinite(targetPrice) && targetPrice > 0`.
No maximum. `requireNumberField` (`requestBody.ts`) only enforces
`typeof value === 'number'` beforehand — a JSON string, boolean, or object
is rejected as `400 INVALID_REQUEST` before this point (§8).

**Direct-API bypass confirmed.** Because the API receives a JSON *number*,
not text, the client's textual parser (`parseTargetPriceInput`) is never
invoked for a direct HTTP caller — it is purely a browser input-handling
convenience. A direct request such as `{"targetPrice": 999999999999}` is
`finite` and `> 0`, so it is accepted today; the server holds no equivalent
of the client's "one decimal separator, no exponent typed by a human"
shape rule, because none is needed — it receives an already-parsed number.

**Numeric maximum recommendation.** 1,000,000 is a reasonable product
bound: the application's supported scope is individual equities
(ARCHITECTURE.md §12.1.1), and Target Price is expressed "in the
corresponding stock's trading currency" (§20) — a per-share price, not an
aggregate amount. Realistic per-share prices for supported equities are
routinely well under six figures even for high-priced shares (e.g.
Berkshire Hathaway Class A, one of the highest-priced individual equities
traded, has historically been in the hundreds-of-thousands-of-currency-
units range, not seven figures). 1,000,000 is generous headroom for that
class of instrument in any supported trading currency without being
unbounded. This is an application/product bound justified for *this
application's supported equities*, not a universal claim about every
financial instrument.

**Final recommendation: `0 < targetPrice <= 1,000,000`, finite.**

**Textual vs. numeric bound — kept distinct per the task's instruction.**
The server never sees Target Price as text (the JSON field is already a
number by the time `requireNumberField` runs), so the server cannot and
must not attempt to re-enforce a "textual length" on it. The client
`<input>` needs its own `maxlength`, sized for the *numeric* range above
plus formatting characters (sign is impossible since only `>0` is valid,
but a decimal separator and fractional digits are): a plausible maxlength
is around 10–12 characters (e.g. `1000000.99`), covering the recommended
numeric maximum plus 2 fractional digits and one separator. **This exact
figure is not fixed here** — TASK-038 should derive it precisely once the
final numeric maximum and decimal-precision rule (below) are both fixed,
since the textual length is *derived from*, not independent of, the
numeric bound (§53 of the task, §21).

**Decimal precision.** Confirmed by local experiment: `123.123456789012345`
parses via `JSON.parse`/`Number()` into the nearest representable IEEE-754
double, `123.12345678901235` (rounded at ~17 significant digits) — this is
standard JavaScript numeric behavior, not something the application
controls. That rounded value is exactly what gets persisted (`JSON.stringify`
round-trips it unchanged) and is exactly what the domain formula
(`calculateTargetPriceDistance`) operates on. There is currently no
explicit precision rule anywhere in the stack — arbitrary (float-representable)
decimal precision is implicitly accepted end-to-end today. This is not a
crash/security bug (IEEE-754 handles it safely), but it is an unbounded,
unreviewed input shape. **TASK-038 should decide** whether to introduce an
explicit precision limit (e.g. round/reject beyond 2 decimal places, matching
the UI's two-decimal *display* formatting introduced by TASK-033) — TASK-037
deliberately introduces no such rule now.

**Scientific notation.** Confirmed: a direct JSON body
`{"targetPrice": 1e20}` parses to the JS number `100000000000000000000`
(finite, `typeof === 'number'`) — it passes `requireNumberField` and, without
a maximum, would currently pass `assertValidTargetPrice` too (it is finite
and `>0`). A body using `1e400` parses to JS `Infinity`, which **is**
already correctly rejected today by the existing `Number.isFinite` check —
this is the one extreme case current validation already handles correctly,
independent of any new maximum. The client's `parseTargetPriceInput` never
accepts scientific-notation text (its regex is `^\d+(\.\d+)?$`, no `e`/`E`),
so a human typing `1e5` into the browser input gets a local parse
rejection — but this is a textual-input-shape rule, not a numeric-range
rule, and does not constrain direct JSON callers. **Recommendation:**
once the final numeric range (`<= 1,000,000`) is enforced, scientific
notation needs no special rejection at the API boundary — any JSON number,
however written on the wire, that satisfies the final finite/positive/
maximum rule is equally valid; the range check alone already rejects
`1e20`. No separate "reject scientific notation" rule is needed or
recommended.

---

## 6. Total Savings

**Current rules**
(`src/lib/server/domain/investmentAllocation.ts:82-86`,
`assertValidTotalSavings`, reused identically by both the HTTP-boundary
pre-check in `investmentAllocationHandlers.ts` and internally by
`calculateSavingsAllocation`):

```ts
Number.isFinite(totalSavings) && Number.isInteger(totalSavings) && totalSavings >= 0
```

* non-negative: yes, `>= 0`, and `0` is explicitly valid (ARCHITECTURE.md §22.1);
* integer: yes, via `Number.isInteger`;
* finite: yes;
* **safe integer: no** — `Number.isSafeInteger` is never used, only
  `Number.isInteger`.
* upper bound: **MISSING** — no maximum exists.

**Safe-integer finding — confirmed by experiment.**
`Number.isInteger(9007199254740993)` (i.e. `Number.MAX_SAFE_INTEGER + 2`,
after JSON round-trip) is `true` (the value silently rounds to
`9007199254740992`, itself an exact integer in float representation),
while `Number.isSafeInteger` on the same value is `false`. **Unsafe
integers are currently accepted** by `assertValidTotalSavings` — a request
such as `{"totalSavings": 9007199254740993}` passes validation today,
gets silently coerced to a neighboring representable integer, and is used
directly in `calculateSavingsAllocation`'s `Math.floor((factor /
factorSum) * totalSavings)` arithmetic without any indication to the
caller that the value it sent was not the value used.

**Client text length**: the `<input>` has no `maxlength`; the client parser
(`parseTotalSavingsInput`) only requires `^\d+$` (digits only, no sign, no
decimal), rejecting non-numeric text but not bounding length.

**Upper-bound recommendation.** 10,000,000 (whole Euros) is reasonable for
this application's stated use case — ARCHITECTURE.md explicitly frames
this as "a personal portfolio/savings-planning application" (§1), not
institutional asset management. 10,000,000 EUR is generously above any
plausible personal-savings-allocation input while remaining comfortably
inside `Number.MAX_SAFE_INTEGER` (~9.007 × 10^15), so combining this
maximum with a safe-integer check produces no floating-point-precision
concerns in the allocation arithmetic.

**Final recommendation:** `0 <= totalSavings <= 10,000,000`, integer, and
switch the finiteness check from `Number.isInteger` to
`Number.isSafeInteger` (a strict tightening — every value the current rule
rejects is still rejected, and the new maximum makes the unsafe-integer
range unreachable anyway, but `isSafeInteger` is the more defensible
primitive to state the rule with).

**Client maxlength recommendation:** 8 characters (`10000000`, 8 digits) —
directly derived from the numeric maximum, per the task's instruction not
to choose a client length independently of the numeric range.

---

## 7. Watchlist IDs

**Generation** (`WatchlistService` constructor default,
`src/lib/server/watchlist/WatchlistService.ts:30`):
`() => crypto.randomUUID()` — the Web Crypto API's standard UUID v4
generator, invoked with no arguments (no injected/attacker-influenced
seed). Format: 36-character lowercase hex-and-hyphen UUID
(`xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`). IDs are opaque, application-
generated identifiers with no embedded meaning — never user-supplied at
creation time.

**Path validation — confirmed missing.** Every consumer
(`WatchlistService.selectActiveWatchlist`,
`WatchlistService.addSymbol`/`removeSymbol`,
`WatchlistQueryService.getWatchlist`,
`InvestmentAllocationService.calculateAllocation`) locates the watchlist
purely by `document.watchlists.find(w => w.id === watchlistId)` — a plain
string-equality scan over the authenticated user's own already-loaded
document. There is **no format/length check** on the incoming
`watchlistId` before this comparison, before the KV `get()` (which happens
regardless of the parameter's value — it always fetches the caller's own
document, so a malformed ID cannot trigger extra provider/persistence
work), or before any application-service logic. A non-matching ID
(including a pathologically long or malformed one) simply falls through to
`WatchlistNotFoundError` → `404 WATCHLIST_NOT_FOUND`. This is not an
authorization gap — the lookup is already scoped to the authenticated
user's own document (ARCHITECTURE.md §8.3) — but it is an explicit
`MISSING` defensive bound per the task's stated principle that every
externally controlled value needs *some* explicit justified bound, however
generous.

**Bound recommendation.** A generous defensive maximum length that cannot
invalidate any legitimately generated ID: **64 characters** (UUIDv4 is
exactly 36; 64 gives comfortable headroom without inviting a false sense
of a "real" format constraint). No syntax/format rule (e.g. requiring
UUID shape) is recommended, because `WatchlistIdGenerator` is an
injectable seam (used for deterministic testing) and ARCHITECTURE.md does
not commit to UUIDv4 as a permanent format — a length-only bound avoids
coupling validation to today's specific generator implementation.

**Missing vs. invalid ID semantics.** Recommend that TASK-038 map an ID
that fails the defensive length bound to a distinct `400`-class validation
response (e.g. reusing or introducing a generic `INVALID_REQUEST`-style
code) **rather than** `404 WATCHLIST_NOT_FOUND`. Rationale: `404` should
continue to mean "a well-formed identifier that does not refer to any of
this user's watchlists" (the common, expected case when a watchlist was
deleted concurrently); a `1,000,000`-character path segment is a different
kind of failure (malformed input) and conflating it with "not found" would
make `404` a less reliable signal for legitimate not-found handling on the
client. This is a recommendation for TASK-038; the contract is
**unchanged** by TASK-037.

---

## 8. Company-Name Filter

Confirmed purely client-side and **local-only**:
`filterStocksByCompanyName` (`src/lib/client/watchlistFilter.ts`) operates
entirely on `activeView.stocks`, already loaded in the browser, and is
never sent in any request body, query parameter, or path segment. Grepping
`src/lib/client/watchlistApi.ts` (the sole client→server HTTP boundary)
confirms no function takes or forwards a filter string.

Because it never crosses the network boundary, it is **not a server
security boundary** and any length limit here is purely a UX/robustness
concern (protecting the local browser tab from a pathologically long
string being retyped/pasted, not protecting the server). A modest
`maxlength` (e.g. 100 characters) is reasonable defensive UX polish but
must not be described as a security control in TASK-038's documentation.

---

## 9. Unsafe Integers, JSON Parsing, and Wrong Types — Experimental Findings

Local, temporary Node experiments (not committed; run directly against
plain JS `JSON.parse`, matching exactly how `Request.json()` behaves)
established:

* `JSON.parse` never produces `NaN`/`Infinity` from a *literal* token —
  `NaN`/`Infinity` are not valid JSON syntax and raise a parse error
  (mapped today to `400 INVALID_REQUEST` via `parseJsonBody`'s catch).
* Exponential notation (`1e20`) parses to an ordinary finite JS `number`
  (`100000000000000000000`) and is indistinguishable from any other
  number by the time application code sees it — `typeof` is `'number'`,
  `Number.isFinite` is `true`. It is *not* rejected by type-checking; only
  an explicit range check catches it.
* Sufficiently extreme exponential notation (`1e400`) parses to JS
  `Infinity` — still `typeof === 'number'`, but caught today by every
  existing `Number.isFinite` check (Target Price, Total Savings).
* Small positive numbers (`1e-20`) parse and remain representable as a
  tiny positive double; nothing in current validation treats "too small"
  specially, only `> 0`/`>= 0`. This is not currently flagged as a problem —
  a tiny positive Target Price is a real (if practically meaningless)
  value, and TASK-037 does not recommend a minimum-magnitude rule beyond
  the existing `> 0`.
* A very long digit-string integer literal (400 digits) parses to
  `Infinity` (exceeds double range) and is caught by `Number.isFinite`
  today.
* `Number.isInteger` treats `Number.MAX_SAFE_INTEGER + 2` (after the
  inevitable float rounding) as an integer; `Number.isSafeInteger` does
  not. See §6.

**Unknown JSON properties** — confirmed **ignored**, not rejected and not
accidentally persisted. `requireObjectField`/`requireStringField`/
`requireNumberField` (`src/lib/server/api/requestBody.ts`) only ever read
the one named field off the parsed body; nothing iterates or persists
the rest of the object. A body like `{"symbol": "AAPL", "garbage": "..."}`
behaves identically to `{"symbol": "AAPL"}` — the `garbage` value is
discarded once the JSON is parsed and never appears in any KV write. This
is safe today but means an attacker can attach an arbitrarily large
"garbage" property to inflate the request body without it ever reaching a
field-level check (see §10 — this is precisely the body-size gap
field-level bounds alone cannot close).

**Wrong types** — confirmed **rejected uniformly** as `400 INVALID_REQUEST`
before any domain code runs: `{"symbol": 123}` fails
`typeof value !== 'string'` in `requireStringField`; `{"totalSavings":
"1000"}` fails `typeof value !== 'number'` in `requireNumberField`. Both
paths throw `InvalidRequestError`, mapped by `mapErrorToResponse` to the
same generic `INVALID_REQUEST` code used for structurally-invalid JSON.
No route currently attempts type coercion (e.g. `Number("1000")`).

---

## 10. Request Body Size

**Transport-level facts** (Cloudflare's current published documentation,
fetched during this audit — see sources below):

* Request body size limit: **100 MB** on Free/Pro Cloudflare account
  plans (200 MB Business, up to 5 GB Enterprise, self-serve) — enforced
  at the Cloudflare edge, independent of application code; oversized
  requests receive `413` before reaching the Worker.
* Per-isolate memory limit: **128 MB**, covering the JS heap and any
  WebAssembly allocations for the whole Worker invocation.
* CPU time limit: **10 ms** per request on the Free plan (paid plans
  default to 30 s, configurable up to 5 minutes).

This project's target infrastructure tier is the Cloudflare free plan
(ARCHITECTURE.md §4.1, "0 EUR per month"). A single request body
approaching even a few MB — let alone the 100 MB account ceiling — risks
exhausting the 128 MB isolate memory budget and/or the 10 ms free-plan CPU
budget purely in `JSON.parse` cost, **before** any field-level string-length
check in TASK-038 would ever run.

**`request.json()` occurs before any application-level check — confirmed.**
Every route's `parseJsonBody(request)` (`src/lib/server/api/requestBody.ts:3-9`)
calls `request.json()` directly and unconditionally; no route inspects
`Content-Length` or streams/limits the body first. Consequently, a request
whose only oversized field is one field-level bound would reject (e.g. an
absurdly long `name`) still pays the full JSON-parse cost before that
per-field check can fire — and a request whose *unknown* extra property
(§9) is what's oversized (e.g. `{"symbol": "AAPL", "garbage": "<50MB
string>"}`) is not rejected by any field-level bound at all, however
tight, because nothing ever inspects `garbage`.

**Conclusion: field-level bounds are not sufficient on their own.**
Recommend a **separate `TASK-039` for request-body-size hardening**,
rather than folding it into `TASK-038`. Reasoning: `TASK-038`'s scope
(per-field string/number bounds, enforced *after* the body is already a
parsed JS value) is a different mechanism from *transport-level* body-size
rejection (which must happen *before or during* body consumption, e.g. via
a `Content-Length` pre-check or a streaming read with a byte cap). Mixing
the two would materially expand `TASK-038`'s scope beyond "field bounds"
into request-parsing infrastructure, which the task explicitly asks to
avoid conflating (§41: "Keep transport-level body-size protection separate
if it would materially expand TASK-038"). No body-size middleware is
introduced by TASK-037 (§41/§66/Non-Goals) — this is a scope recommendation
only.

Sources consulted (current Cloudflare documentation, fetched during this
audit): Cloudflare Workers platform limits documentation
(`developers.cloudflare.com/workers/platform/limits/`), covering request
body size by account plan, per-isolate memory, and CPU time limits.

---

## 11. Existing API Validation Error Codes

Inventoried from `src/lib/server/api/ApiError.ts` and
`src/lib/server/api/errorMapping.ts`:

| Code | HTTP status | Currently covers |
| --- | --- | --- |
| `UNAUTHENTICATED` | 401 | Missing `locals.user` |
| `INVALID_REQUEST` | 400 | Malformed JSON; wrong field type; missing required field |
| `INVALID_WATCHLIST_NAME` | 400 | Empty/whitespace-only Watchlist name (today) |
| `INVALID_STOCK_SYMBOL` | 400 | Stock-add syntax-grammar failure (TASK-029) |
| `INVALID_SYMBOL` | 400 | Target Price `symbol` path param empty/whitespace-only; Watchlist `symbol` add/remove empty |
| `UNKNOWN_STOCK_SYMBOL` | 422 | Syntactically valid symbol the provider doesn't resolve as an equity |
| `DUPLICATE_SYMBOL` | 409 | Symbol already in the target watchlist |
| `SYMBOL_NOT_FOUND` | 404 | Symbol not present in the target watchlist (removal) |
| `WATCHLIST_NOT_FOUND` | 404 | No watchlist with the given ID for this user |
| `NO_ACTIVE_WATCHLIST` | 409 | Delete requested with no active watchlist |
| `INVALID_TARGET_PRICE` | 400 | Non-finite or `<= 0` Target Price (today) |
| `INVALID_TOTAL_SAVINGS` | 400 | Non-finite/non-integer/negative Total Savings (today) |
| `MARKET_DATA_UNAVAILABLE` | 503 (error) / warning | Provider failure |
| `PERSISTENCE_ERROR` | 500 | KV failure or corrupt stored document |
| `INTERNAL_ERROR` | 500 | Fallback |

**Error-code reuse strategy for TASK-038.** Do not introduce new codes for
"too long"/"too large" variants. Reuse the existing semantic codes exactly
as the task's own example prescribes:

* an over-length Watchlist name → still `INVALID_WATCHLIST_NAME` (this
  code already exists and currently only covers emptiness; extending its
  meaning to also cover length is a natural, minimal widening, **not** a
  new code);
* an over-length or too-long-after-normalization stock symbol → still
  `INVALID_STOCK_SYMBOL` (extends the existing TASK-029 syntax-failure
  code to also cover length, since both are "the symbol failed the input
  grammar/shape rule" from the caller's point of view);
* an out-of-range Target Price → still `INVALID_TARGET_PRICE`;
* an out-of-range/unsafe Total Savings → still `INVALID_TOTAL_SAVINGS`;
* a malformed/oversized `watchlistId` path parameter → **no existing code
  fits cleanly**. `INVALID_REQUEST` is the closest existing generic code
  and is the recommended reuse target (it already covers "the request is
  structurally wrong" for body-shape failures; a malformed path parameter
  is the same category of failure, just in a different request part). No
  new code is required.

**Watchlist Name error code — no gap.** `INVALID_WATCHLIST_NAME` already
exists and is stable; TASK-038 only needs to widen when it is thrown
(`WatchlistService.createWatchlist`'s existing empty check plus a new
length check), not add anything at the API-contract level.

**Path-parameter error recommendation.** Reuse `INVALID_REQUEST` (400) for
a `watchlistId` that fails its defensive length bound (§7), keeping it
distinct from `WATCHLIST_NOT_FOUND` (404) as recommended above. For the
Target Price `symbol` path parameter, if TASK-038 unifies it onto the
shared stock-symbol grammar (recommended, §4), reuse `INVALID_SYMBOL` — the
code this route already returns for its existing (narrower) validation
failure — rather than switching it to `INVALID_STOCK_SYMBOL`, to avoid a
client-visible contract change on an existing endpoint. This keeps the
"don't recommend new codes without a concrete client behavior requiring
them" principle intact (§43 of the task).

---

## 12. Client `maxlength` Candidates (for TASK-038, not applied here)

| Field | Recommended `maxlength` | Derived from |
| --- | --- | --- |
| Watchlist name | 50 | Final name-length bound (§3) |
| Stock symbol | 20 | Final symbol-length bound (§4) |
| Target Price text | ~10–12 (exact value to be fixed alongside the numeric max + precision rule) | Final numeric max + decimal-precision rule (§5) |
| Total Savings text | 8 | Final numeric max, `10,000,000` = 8 digits (§6) |
| Company-name filter | 100 (UX only, not a security control) | Local-only field, no server exposure (§8) |

**`maxlength` is UX mirroring only, not enforcement — restated explicitly
per the task.** Every bound above is enforced at the server boundary
independent of whatever `maxlength` (or its absence) the browser applies;
a direct HTTP caller bypasses `maxlength` entirely by construction, since
it is a DOM/`<input>` attribute with no server-side counterpart. Adding
`maxlength` in TASK-038 is a UX improvement layered on top of the
authoritative server bound, never a substitute for it.

**Preserving correction UX.** For a field where the user *reaches*
validation feedback (Target Price and Total Savings, both of which display
an inline error message on invalid parse rather than physically preventing
keystrokes), the existing pattern already preserves the entered text for
correction (`TargetPriceCell`'s `inputValue` binding, `+page.svelte`'s
`totalSavingsInput` binding) — neither clears the field on a failed parse
today, and TASK-038 should preserve this. For fields where `maxlength`
would be the *only* new constraint (Watchlist name, Stock symbol), browser-
native `maxlength` prevention (the input simply stops accepting further
keystrokes at the limit) is sufficient on its own — TASK-038 does not need
an additional inline "too long" message for a boundary the browser already
prevents by construction, since there is no invalid intermediate state to
explain (unlike Target Price, where a value can be fully typed and still
be semantically wrong).

---

## 13. Shared-Validation Structure Recommendation

TASK-029 established a precedent worth repeating: a small, pure,
dependency-free module under `$lib/shared/` (never `$lib/server/`) shared
verbatim between browser and server code. The same pattern fits:

* **Watchlist name** — a new `$lib/shared/watchlistName.ts` exporting the
  trim rule and the length bound (e.g. `MAX_WATCHLIST_NAME_LENGTH = 50`,
  `isValidWatchlistName(trimmed): boolean`), consumed by both
  `WatchlistService` (server, authoritative) and a new client-side
  pre-submit check in `createWatchlistAndActivate` (UX optimization only,
  mirroring how `addStockToActiveWatchlist` already pre-validates symbols).
* **Target Price range** — extend the existing domain module
  (`src/lib/server/domain/investmentAllocation.ts` already exports
  `calculateTargetPriceDistance`) or a new
  `src/lib/server/target-price/targetPriceValidation.ts` with the numeric
  bound constant. This one is **server-only** — unlike Watchlist name/stock
  symbol, there is no meaningful *shared* textual-shape rule here, since
  the client already has its own independent textual parser
  (`targetPriceInput.ts`) with different concerns (locale decimal
  separators) from the server's numeric-range check. Keep the *constant*
  (the maximum value) in one place importable by both, even if the
  *validation logic* itself isn't identical.
* **Total Savings range** — same pattern as Target Price: the numeric-range
  constant (`MAX_TOTAL_SAVINGS = 10_000_000`) belongs in
  `src/lib/server/domain/investmentAllocation.ts` next to
  `assertValidTotalSavings`, importable by the client for its own
  `maxlength` sizing without duplicating the *validation* logic.

**No giant `validation.ts`.** Each of the above stays domain-oriented and
small, matching the task's explicit instruction (§50 of the task):
`watchlistName.ts`, extending `stockSymbol.ts` (already exists), and
extending the existing `investmentAllocation.ts` domain module for both
numeric rules rather than inventing a new cross-cutting file. This also
naturally satisfies §51 of the task: any module consumed by both browser
and server code must avoid importing from `$lib/server`, which is already
true of `stockSymbol.ts` and will be true of a new `watchlistName.ts`.

---

## 14. Audit Matrix

| Input | Source | Current Client Validation | Current Server Validation | Current Bound | Gap | Recommended Bound |
| --- | --- | --- | --- | --- | --- | --- |
| Watchlist name | POST `/api/watchlists` body `name` | Non-empty (trimmed) only, no `maxlength` | Non-empty (trimmed) only (`WatchlistService`) | None (length) | **MISSING** max length | 50 chars after trim (UTF-16 code units) |
| Stock symbol (add) | POST `.../stocks` body `symbol` | Uppercase-as-typed + shared grammar pre-check, no `maxlength` | Shared grammar (`stockSymbol.ts`), then provider `resolveSymbol()` | Grammar only, no length | **MISSING** max length; unbounded string reaches Yahoo via `resolveSymbol()` | 20 chars after normalization, enforced before provider call |
| Stock symbol (remove) | DELETE `.../stocks/{symbol}` path | None | Trim + equality check only (no grammar) | None | Low-severity: no provider call, only KV-scoped equality; a malformed value just yields `SYMBOL_NOT_FOUND` | Same 20-char/grammar rule for consistency (no functional risk today) |
| Symbol (Target Price) | PUT `/api/target-prices/{symbol}` path | None | Trim + non-empty only — **no uppercase, no grammar** | None | **MISSING** grammar/length; unbounded/non-normalized string reaches Yahoo via `getQuote()`; casing inconsistency vs. stock-add path | Apply the same shared `parseStockSymbol`/20-char rule |
| Target Price | PUT `/api/target-prices/{symbol}` body `targetPrice` | Locale decimal parse, `>0`, finite, no `maxlength`/max value | `Number.isFinite && >0` (`TargetPriceService`) | Lower bound only | **MISSING** max value; direct-JSON bypasses client textual parser entirely | `0 < value <= 1,000,000`; client `maxlength` ≈10–12 (derived once precision rule is fixed) |
| Total Savings | POST `.../investment-allocation` body `totalSavings` | Digits-only text parse, `>=0`, no `maxlength`/max value | `Number.isFinite && Number.isInteger && >=0` (`assertValidTotalSavings`) | Lower bound + integer only, **not safe-integer** | **MISSING** max value; unsafe integers accepted | `0 <= value <= 10,000,000`, `Number.isSafeInteger`; client `maxlength` 8 |
| Watchlist ID | Every `/api/watchlists/{watchlistId}...` path | None | None (string-equality lookup only, scoped to authenticated user) | None | **MISSING** any defensive bound (no security impact today — lookup is user-scoped) | 64-char defensive max length, no format rule |
| Company-name filter | Local UI state only | Substring/case-insensitive match, no `maxlength` | N/A — never sent to server | N/A | Not a server gap; local-UX-only opportunity | Optional 100-char `maxlength`, UX only |
| Unknown JSON properties | Any JSON body | N/A | Silently ignored, never persisted | N/A | Not itself a correctness gap, but enables the body-size gap (§10) | No field-level fix possible; see body-size recommendation |
| Request body size | Any JSON body, any route | N/A | None — `request.json()` called unconditionally before any check | Cloudflare account-level 100 MB (Free/Pro) only | Field-level bounds alone cannot close this; Worker memory (128 MB)/CPU (10 ms free tier) exhaustion possible before field checks run | Separate `TASK-039` recommended (see §10) |

---

## 15. Final Recommended Limits Summary

| Input | Final rule | Primary motivation(s) |
| --- | --- | --- |
| Watchlist name | ≤ 50 UTF-16 code units after trim | Product/UX (tab-strip legibility) + robustness (bounded per-user document size) |
| Stock symbol (all entry points: add, Target Price path param) | ≤ 20 chars after normalization, grammar unchanged | Provider protection (stop unbounded strings reaching Yahoo) + robustness |
| Target Price | `0 < value <= 1,000,000`, finite | Product semantics (plausible per-share price for supported equities) + robustness |
| Total Savings | `0 <= value <= 10,000,000`, safe integer | Product semantics (personal-savings-planning scope) + robustness (float-precision safety) |
| Watchlist ID (path param) | ≤ 64 chars, no format constraint | Robustness/defense-in-depth only — no confirmed exploit path, since lookup is already user-scoped |
| Company-name filter | ≤ 100 chars (client-only) | UI usability only — explicitly **not** a security control |

**Outstanding Product Owner decision required:** the exact Target Price
client `maxlength` (§5, §12) cannot be finalized until TASK-038 also
settles whether an explicit decimal-precision limit is introduced (§5). If
TASK-038 adopts a 2-decimal-place rule (matching the existing 2-decimal
*display* formatting from TASK-033), the textual maxlength should be
computed as `len(str(1_000_000)) + 1 (separator) + 2 (decimals) = 10`. If
no precision rule is introduced, a slightly larger maxlength (e.g. 14) is
needed to accommodate arbitrary trailing digits a user could type before
the numeric range check catches an absurd value on save. This document
does not decide the precision question — that decision belongs to
TASK-038, per this task's explicit instruction not to introduce a new
precision rule during the audit (§23 of the task).

---

## 16. Duplicate Validation Note

`assertValidTotalSavings` is correctly *not* duplicated — it is defined
once in `investmentAllocation.ts` and reused both by the HTTP-boundary
pre-check (`requireValidTotalSavings` in `investmentAllocationHandlers.ts`)
and internally by `calculateSavingsAllocation`. This is the right pattern
and should be the template for the new Target-Price/Total-Savings/
Watchlist-name range constants (§13) — no consolidation work is needed
for `assertValidTotalSavings` itself.

By contrast, the *empty-string* check is currently duplicated with
slightly different wording across `WatchlistService.createWatchlist`
(Watchlist name), `WatchlistService.addSymbol`/`removeSymbol` (Watchlist
symbol), and `TargetPriceService.assertValidSymbol` (Target Price symbol)
— three near-identical `trim().length === 0` checks, each throwing a
different, deliberately independent error class (by design, per
`TargetPriceServiceErrors.ts`'s comment: `TargetPriceService` must not
depend on the `watchlist` module). **Recommend leaving this as-is** in
TASK-038 rather than consolidating: the task's own comments document that
this duplication is an intentional module-boundary decision (TASK-010),
not an oversight, and CLAUDE.md instructs against refactoring unrelated
code while implementing a task. Any future consolidation of this specific
duplication should be its own explicit task, not a TASK-038 side effect.

---

## 17. Assumptions and Open Product Owner Decisions

1. **Target Price decimal-precision rule** (§5, §15) — TASK-038 must
   decide whether to introduce one, and if so, at how many decimal places;
   this fixes the exact Target Price client `maxlength`.
2. **Watchlist ID malformed-vs-not-found HTTP semantics** (§7) — this
   audit recommends a `400 INVALID_REQUEST` split from `404
   WATCHLIST_NOT_FOUND`, but this is a new observable API behavior change
   (previously *every* non-matching ID, well-formed or not, produced
   `404`) and should be explicitly confirmed as acceptable before TASK-038
   implements it.
3. **Target Price `symbol` path-parameter unification** (§4) — this audit
   recommends applying the shared stock-symbol grammar/normalization to
   this endpoint for consistency and provider protection; confirming this
   does not conflict with any undocumented legacy Target Price behavior
   (e.g. an already-persisted, non-canonical-case Target Price key from
   before TASK-029) is a TASK-038 concern, not resolved here.
4. **Watchlist-name/Stock-symbol duplicate empty-check consolidation**
   (§16) — recommended to leave as-is; flagged only in case the Product
   Owner disagrees with treating this as intentional.

No other unresolved decisions were identified.

---

## 18. Final TASK-038 Scope (Recommendation)

**In scope for TASK-038:**

* Watchlist name: max length (50, UTF-16 code units) + `maxlength` HTML attribute + shared `$lib/shared/watchlistName.ts`.
* Stock symbol: max length (20, post-normalization) enforced before `resolveSymbol()`, applied identically to the stock-add path *and* the Target Price `symbol` path parameter; `maxlength` HTML attribute on the stock-symbol input.
* Target Price: numeric maximum (1,000,000) + decimal-precision decision + derived client `maxlength`.
* Total Savings: numeric maximum (10,000,000) + switch to `Number.isSafeInteger` + client `maxlength` (8).
* Watchlist ID path parameter: defensive max length (64) + `400`/`404` semantics decision (§7, §17).
* Company-name filter: optional `maxlength` (100) as UX polish, explicitly documented as non-security.
* Error-code reuse exactly as specified in §11 — no new codes except none are actually needed.
* Corresponding unit tests for every new bound (business logic, per CLAUDE.md "Testing").

**Explicitly out of scope for TASK-038** (recommended for a separate
`TASK-039`, or not recommended at all):

* Request-body-size/transport-level hardening (Content-Length pre-check or
  streaming byte cap) — recommended as **`TASK-039`**, kept separate per
  §10/§41 of this task.
* Rate limiting, CAPTCHA, WAF rules, CSRF redesign — not raised by this
  audit, unchanged Non-Goals.
* Any Yahoo/Frankfurter provider behavior change.
* Any persistence/migration change (e.g. revalidating already-persisted
  over-length names or non-canonical Target Price symbol keys) — matches
  ARCHITECTURE.md's established precedent (TASK-029/030 also did not
  migrate existing data).

---

## Sources

* Cloudflare Workers platform limits documentation, fetched during this
  audit (2026-09-06): `https://developers.cloudflare.com/workers/platform/limits/`
  — request body size by account plan, per-isolate memory limit (128 MB),
  CPU time limits (10 ms Free / configurable up to 5 min Paid).
