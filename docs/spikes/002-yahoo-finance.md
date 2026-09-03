# SPIKE-002: Yahoo Finance Integration (`yahoo-finance2`)

## Environment

| Component | Version / Configuration |
| --- | --- |
| Node.js | v26.8.1 |
| Svelte | 5.57.0 |
| SvelteKit | 2.70.3 |
| `@sveltejs/adapter-cloudflare` | 7.2.9 |
| `wrangler` | 4.128.0 |
| `yahoo-finance2` | **4.0.2** (current stable, `latest` dist-tag) |
| Cloudflare compatibility flags | `["nodejs_als"]` (unchanged from TASK-001 bootstrap; **no** `nodejs_compat` was added or required) |
| Cloudflare compatibility date | `2026-09-03` |

`yahoo-finance2` v4 is a major-version rewrite from the v2/v3 API the legacy application implicitly assumed. It uses a `new YahooFinance()` client instance rather than a default singleton export. Its own README claims Cloudflare support ("Modern releases, tested in CI via Workers Vitest under `nodejs_compat`"), which this spike independently verified for the `quote` module specifically (see [Cloudflare Compatibility](#cloudflare-compatibility)).

## Test Universe

| Symbol | Market | Yahoo Currency | Reason selected |
| --- | --- | --- | --- |
| `AAPL` | US – NASDAQ | USD | US exchange baseline |
| `SAP.DE` | Germany – XETRA | EUR | Germany/XETRA coverage |
| `SHEL.L` | UK – LSE | GBp | UK stock reported by Yahoo in `GBp` (pence) |
| `RELIANCE.NS` | India – NSE | INR | India/INR coverage; legacy app applies an INR dividend correction |
| `LISP.SW` | Switzerland – SIX | CHF | Required symbol; legacy dividend correction (`/10`) |
| `HEXA-B.ST` | Sweden – Stockholm | SEK | Required symbol; legacy provider-specific dividend correction |
| `TOM.OL` | Norway – Oslo | NOK | Required symbol; legacy provider-specific dividend correction |
| `NOTAREALSYMBOL123` | n/a | n/a | Deliberately invalid symbol, used only in error-handling/batch experiments (not a real market symbol) |

7 real symbols, covering all required markets/units plus the 3 mandated legacy-correction symbols, and 1 invalid symbol for error-path testing.

## Required Field Results

Retrieved via single-symbol `quote()` calls. All values below were obtained from live Yahoo responses (both in local Node.js and inside the Cloudflare Workers runtime — see [Cloudflare Compatibility](#cloudflare-compatibility)):

| Symbol | `symbol` | `longName` | `regularMarketPrice` | `currency` | `trailingAnnualDividendRate` | `marketCap` |
| --- | --- | --- | --- | --- | --- | --- |
| `AAPL` | ✅ | ✅ | ✅ 324.96 | ✅ USD | ✅ 1.05 | ✅ |
| `SAP.DE` | ✅ | ✅ | ✅ 184.74–185.16 | ✅ EUR | ✅ 2.5 | ✅ |
| `SHEL.L` | ✅ | ✅ | ✅ 3412–3413 | ✅ GBp | ✅ 1.511 | ✅ (see note) |
| `RELIANCE.NS` | ✅ | ✅ | ✅ 1309–1312 | ✅ INR | ⚠️ `0` | ❌ **missing** |
| `LISP.SW` | ✅ | ✅ | ✅ 8515–8525 | ✅ CHF | ✅ 1800 (raw, uncorrected) | ✅ |
| `HEXA-B.ST` | ✅ | ✅ | ✅ 98.88–99 | ✅ SEK | ✅ 0.14 (raw, uncorrected) | ✅ |
| `TOM.OL` | ✅ | ✅ | ✅ 107.1–107.3 | ✅ NOK | ✅ 0.182 (raw, uncorrected) | ✅ |

Notes:

- Values fluctuated slightly between calls (seconds apart) because these are live, real-time market quotes, not fixtures.
- `RELIANCE.NS`: `marketCap` was **absent** from the response entirely (`undefined`, not `0` or `null`). `trailingAnnualDividendRate` was `0`, which conflicts with Reliance Industries' known real-world dividend history — this looks like a genuine Yahoo data-completeness gap for this NSE symbol rather than "no dividend", and should not be assumed reliable without cross-checking. This is exactly the kind of partial-data condition ARCHITECTURE.md §16/§30 already plans to handle via UI placeholders.
- `SHEL.L`: `regularMarketPrice` (3412–3413) and `trailingAnnualDividendRate` (1.511) are consistent with pence-denominated values (i.e. GBp). `marketCap` (≈187.7 billion) is **not** in pence — at that scale it is already consistent with GBP (major currency unit), not `GBp`. This is a new finding beyond what ARCHITECTURE.md §17.2 currently documents (which only discusses price/dividend GBp normalization) and should inform the future market-cap-conversion implementation: **the GBp → GBP unit correction must not be blindly applied to `marketCap`.**
- `LISP.SW` / `HEXA-B.ST` / `TOM.OL`: raw `trailingAnnualDividendRate` values are recorded above uncorrected, as evidence for the future dividend-normalization task. Sanity-checking against real-world dividend/yield expectations:
  - `LISP.SW`: raw `1800` against a price of ~8515–8525 implies an implausible ~21% yield uncorrected; dividing by 10 (the documented legacy correction) gives ~180, a plausible ~2.1% yield — consistent with the legacy `/10` correction being justified.
  - `HEXA-B.ST` and `TOM.OL`: raw values (`0.14` and `0.182` respectively) imply implausibly low yields (<0.2%) for companies with a history of paying non-trivial dividends, consistent with the legacy app's claim that a provider-specific multiplier is needed. This spike does **not** attempt to derive the exact multiplier (out of scope; ARCHITECTURE.md §19.1 explicitly requires this to be verified before implementation).
- No field was ever returned with an unexpected *type* (numbers were numbers, strings were strings); the only anomalies were missing/zero values, not type mismatches.

## Cookie / Crumb Findings

**Fully automatic — no manual cookie or crumb was supplied, and none is required.**

- Source inspection of `yahoo-finance2`'s internal `getCrumb.js` confirms the flow: it fetches `https://finance.yahoo.com/quote/AAPL` to obtain session cookies (following an optional EU/GDPR consent-redirect chain if Yahoo presents one), then calls `https://query1.finance.yahoo.com/v1/test/getcrumb` with those cookies to obtain the crumb. Both steps run inside the library with no user-supplied credentials.
- This was also empirically confirmed: every quote request in this spike succeeded on the first attempt with a freshly constructed `new YahooFinance()` instance and no pre-seeded cookie/cookie file.
- Repeated requests on the same client instance reuse the cached crumb/cookie (the crumb is cached in a `WeakMap` keyed by the cookie jar; the client only re-fetches it if no cached crumb is present). Two sequential calls on a fresh instance both completed in well under 200ms each in this environment, consistent with cheap in-process reuse after the first bootstrap.
- A new `YahooFinance()` instance creates a new, independent cookie jar/crumb cache — i.e. crumb state is per-instance, not global. For a Cloudflare Worker handling a request, this means the client instance (and its cookie/crumb) should be created once per request (or reused across requests within the same isolate) rather than assuming persistence across isolate restarts.
- No expiration was observed during this short spike session; Yahoo's crumb/cookie expiry behavior over longer periods (hours/days) was not tested and remains unverified.
- **No cookie, crumb, or session value was committed, logged into a tracked file, or exposed to client/browser code.** Console output during manual runs was not captured into any committed artifact.
- Separately, raw `curl` requests made directly to `query1.finance.yahoo.com` / `query2.finance.yahoo.com` **without** first visiting `finance.yahoo.com` (i.e., skipping the cookie-bootstrap step) were rejected with `429 Too Many Requests` from this environment's network egress. `yahoo-finance2`'s full navigate-then-crumb flow avoided this by presenting proper cookies/referer context, which is the correct behavior — but it demonstrates that Yahoo does aggressively gate bare API access from this class of network origin.

## Batch Findings

- `yahooFinance.quote(string[])` supports batch retrieval directly — the same `quote()` method used for single symbols accepts an array and returns `Quote[]` (or a `Map`/object, via a `return` option).
- A batch of the 7 valid test symbols plus 1 deliberately invalid symbol (`NOTAREALSYMBOL123`) returned **7 results** — the invalid symbol was silently **omitted** from the array rather than causing the whole batch to fail. This is good partial-success behavior and maps cleanly onto ARCHITECTURE.md §16's planned partial-success handling: application code must compare requested vs. returned symbols to detect which ones failed, since there is no per-symbol error object in the array response.
- A **single**-symbol `quote()` call for the same invalid symbol did **not** throw — it resolved to `undefined`. This is a meaningful, non-obvious behavior: application code cannot rely on `try/catch` alone to detect an unknown symbol for single-symbol lookups; it must explicitly check for an `undefined`/falsy result.
- No case was found (within this spike's scope) where a single invalid symbol caused the entire batch call to reject/throw.

## Cloudflare Compatibility

This section distinguishes what was verified in local Node.js from what was verified inside the actual Cloudflare Workers runtime, per the task's requirement.

**Works in local Node.js:** ✅ Verified. All single-quote, batch-quote, invalid-symbol, and simulated-network-failure experiments ran successfully via a standalone script (`spike/yahoo-finance/run-node.ts`) executed directly with `node` (v26.8.1, using its native TypeScript execution support — no separate compile step or `ts-node`/`tsx` dependency was needed).

**Works in the Cloudflare Workers-compatible runtime:** ✅ Verified — actually executed, not just built.

- A temporary SvelteKit server endpoint was added, the project was built for the Cloudflare target (`npm run build`, producing `.svelte-kit/cloudflare/_worker.js`), and that built worker was run with `npx wrangler dev .svelte-kit/cloudflare/_worker.js`, which starts the real `workerd` runtime (not Node.js) locally.
- An HTTP request to the running worker (`GET /spike-yahoo-finance`) successfully executed `yahooFinance.quote()` for all 7 single symbols and the 8-symbol batch **inside `workerd`**, returning the same field values (modulo live-market fluctuation) as the Node.js run, with a clean `200 OK` and no runtime errors or warnings in the wrangler log.
- **No `nodejs_compat` compatibility flag was needed.** The project's existing `compatibility_flags: ["nodejs_als"]` (added by the SvelteKit Cloudflare adapter during TASK-001, for `AsyncLocalStorage` support) was sufficient for the `quote` module code path exercised here. This is narrower than what `yahoo-finance2`'s own README implies is required for their CI ("under `nodejs_compat`") — it's possible their test suite exercises other modules/features (e.g. the optional file-based cookie store, or other API modules) that do need it. **This spike only verified the `quote` module; other modules were not tested and may have different runtime requirements.**
- A successful production build alone (`npm run build`) was explicitly **not** treated as sufficient evidence — the build was additionally exercised at runtime via `wrangler dev` against real network calls, per the task's instruction that build success does not imply runtime compatibility.

## Problems / Risks

1. **`RELIANCE.NS` missing `marketCap`** and an unreliable-looking `trailingAnnualDividendRate` of `0`. Partial/missing required fields do occur for real, non-obscure symbols (Reliance Industries is one of India's largest companies) and must be handled via placeholders, not assumed to be a rare edge case.
2. **`GBp` affects `marketCap` differently than price/dividend fields** (see Required Field Results above) — an important, previously-undocumented nuance for the future currency/unit-normalization implementation.
3. **Single-symbol invalid lookups resolve to `undefined` instead of throwing** — an easy source of bugs if application code assumes exceptions are the only failure signal.
4. **Yahoo aggressively rate-limits/blocks bare API requests** that skip the cookie-bootstrap navigation Yahoo expects (observed via direct `curl` to `query1`/`query2` returning `429` immediately). `yahoo-finance2`'s approach avoids this, but it confirms Yahoo's anti-automation posture is real and could affect reliability if Yahoo tightens detection further.
5. **Rate-limiting under sustained/production load was not tested.** This spike made a small number of sequential requests within a single short session from a single environment. It does not establish behavior under concurrent Cloudflare Workers production traffic, nor over long time periods (hours/days), nor whether Yahoo treats Cloudflare's shared Workers egress IP ranges differently from this spike's network origin.
6. **Dependency surface.** `yahoo-finance2` pulls in `@modelcontextprotocol/sdk`, `zod`, `tough-cookie`, and `tough-cookie-file-store` as dependencies (it also ships a CLI and MCP server, which are unrelated to this project's needs). This did not cause build or runtime failures, but it is a heavier dependency footprint than a minimal HTTP-only client would have.
7. **Legacy dividend corrections are still unimplemented and unverified.** This spike only gathered raw evidence (as required); the exact multipliers for `HEXA-B.ST` and `TOM.OL` still need to be determined per ARCHITECTURE.md §19.1 before production dividend-yield calculations can be trusted for those symbols.
8. **Crumb/session behavior over longer time horizons (expiry, revocation, Yahoo-side session invalidation) was not observed** during this short spike and remains an operational unknown.

## Recommendation

```text
ACCEPT yahoo-finance2 WITH CONDITIONS
```

`yahoo-finance2` v4.0.2 successfully retrieved all required Watchlist fields for a representative international test universe — including all three symbols with known legacy dividend-correction requirements, a GBp-denominated UK stock, and an INR-denominated Indian stock — using fully automatic cookie/crumb handling with no manually maintained personal Yahoo cookie. Batch retrieval works and degrades gracefully when one symbol is invalid. Critically, this was verified not just via a successful production build, but via an actual HTTP request executed inside the Cloudflare Workers runtime (`workerd`, via `wrangler dev`) against the real built worker, using only the compatibility flag already required by SvelteKit's Cloudflare adapter — no additional `nodejs_compat` flag or polyfill was needed for the `quote` module.

Conditions for production use:

1. Treat `quote()` as **not** exception-safe for detecting invalid single symbols — explicitly check for an `undefined` result, in addition to `try/catch` for network/provider failures.
2. For batch requests, detect missing symbols by diffing requested vs. returned symbols; do not assume a 1:1 correspondence or an error per missing symbol.
3. Implement the currency/unit-normalization and dividend-normalization rules from ARCHITECTURE.md §17.2/§19 based on empirically-gathered raw values (this spike's data), and explicitly verify/derive the still-unknown `HEXA-B.ST`/`TOM.OL` multipliers before relying on their dividend yields.
4. When implementing market-cap conversion, do **not** apply the GBp pence-correction to `marketCap` — this spike's evidence indicates Yahoo already reports `marketCap` in major-currency-unit scale for GBp-quoted stocks, unlike `regularMarketPrice`/`trailingAnnualDividendRate`. Verify this against a small set of additional GBp symbols before finalizing the conversion logic.
5. Handle missing required fields (e.g., `marketCap`) via the UI-placeholder behavior ARCHITECTURE.md already plans, rather than treating a missing field as a hard provider failure.
6. Because production-scale/long-duration rate-limiting behavior is unverified, add basic error visibility (e.g., logging of provider failures) once deployed, and be prepared to fall back to the documented partial-success/provider-unavailable UI behavior if Yahoo throttling is observed in practice.
7. If future work adds other `yahoo-finance2` modules beyond `quote` (e.g. `historical`, `chart`, `search`) or the file-based cookie store, re-verify Cloudflare Workers compatibility for those specific code paths rather than assuming this spike's result generalizes.
