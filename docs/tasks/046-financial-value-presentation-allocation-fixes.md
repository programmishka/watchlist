# TASK-046: Financial Value Presentation and Allocation Boundary Fixes

## Status

Done

> **Follow-up:** `046-followup-target-price-decimal-formatting.md` extended
> `formatEditableNumber()` to pad to a *minimum* of two decimal places (e.g.
> `14,3` → `14,30`) for visual consistency with the rest of the application's
> two-decimal financial columns, and to expand small values out of scientific
> notation wherever they still fit the existing 20-character input limit
> (e.g. `1e-7` → `0.0000001`). This file's original implementation history
> below is kept as written and is not rewritten to describe the follow-up's
> behavior as though it had always existed; see ARCHITECTURE.md §26.19 for
> the current, final rule.

## Goal

Correct three defects observed by the Product Owner in the current Watchlist application:

1. Large financial values are visually truncated in the desktop table without a reliable way to inspect the complete value. The observed example is a JPY Price above 14,000.
2. Target Price inputs display a decimal point even when the surrounding financial values use a decimal comma (e.g. Price `149,30`, Target Price `149.3`).
3. A stock whose current Price exactly equals its Target Price receives a zero Savings Amount because a valid zero Distance to Target is treated like an unavailable distance.

The first two changes concern presentation and interaction. The third is an intentional correction to financial allocation semantics and supersedes the zero-distance factor behavior explicitly preserved by TASK-031.

Do not introduce unrelated refactoring or deploy production.

## Context

Read `CLAUDE.md`, `ARCHITECTURE.md`, TASK-003, TASK-014, TASK-021, TASK-024, TASK-031, TASK-033, TASK-034, TASK-036, TASK-038, TASK-040, TASK-044 and TASK-045 where relevant. Inspect the current implementations and tests of:

- `WatchlistTable.svelte`, `WatchlistCards.svelte`, `TargetPriceCell.svelte`, `StockPresentation.svelte`;
- client formatting and Target Price parsing helpers;
- `watchlistWorkspace.svelte.ts`, `watchlistShell.ts`;
- `investmentAllocation.ts`, `InvestmentAllocationService` and related domain, API and service tests;
- current table CSS, responsive breakpoints and Playwright configuration.

Use the actual current code rather than assuming historical task descriptions are still exact.

## 1. Complete financial values in the desktop table

### Observed defect

A Price such as `14.310,xx` is visually truncated to `14.310,...`. Hovering does not reveal the complete value in the Product Owner's environment. Firefox is a possible factor, not an established root cause.

TASK-040 introduced native full-value titles for Savings Amount. Inspect and reuse that approach where appropriate.

### Requirements

- Reproduce the Price truncation using a deterministic large-price fixture.
- Inspect all numeric display columns for ellipsis/clipping: Market Cap (USD bn), Price, Dividend Yield, Distance to Target and Savings Amount.
- For every populated numeric display cell that can truncate, expose the complete locale-formatted value through a native HTML `title` on the actual hoverable element. Applying titles to all populated values in these columns is acceptable; no overflow measurement is required.
- The complete formatted value must remain DOM text. CSS alone may visually shorten it.
- Use the existing formatter for both text and title. Do not introduce a separate tooltip number format.
- Preserve signed Distance formatting, whole-Euro Savings Amount formatting, and two-decimal formatting for other displayed financial values.
- Real zero is a populated value. Missing values remain `—` and need no title.
- Inspect whether existing Savings Amount titles are attached to an appropriate hover target and work in Firefox. Do not assume that the absence of a tooltip proves a browser defect.
- Verify native hover behavior manually in Firefox and Chromium where available. Playwright should assert full DOM text and exact title values; do not attempt to locate browser-native tooltip chrome as page DOM.
- Native titles are supplemental, not a guaranteed keyboard/touch disclosure mechanism. Preserve full accessible text and full-value Card presentation. If a native tooltip remains unreliable in a supported browser, report the cause and propose the smallest accessible alternative before introducing custom tooltip infrastructure.
- Keep the table compact. Do not widen columns or change the 1120px Table/Card breakpoint merely to accommodate extreme values.
- Cards must continue displaying complete financial values without intentional ellipsis.

## 2. Locale-aware Target Price input

### Observed defect

With a decimal-comma locale, Price is displayed as `149,30` while the editable Target Price is displayed as `149.3`. The same inconsistency may exist in both Table and Card modes because both reuse TargetPriceCell.

### Requirements

- Establish the current locale selection and Target Price draft initialization/synchronization behavior.
- Introduce or reuse a dedicated editable-number formatter that uses the same locale policy as the existing financial display formatters.
- For example, stored numeric value `149.3` should display as `149,3` in a German locale and `149.3` in an English decimal-point locale. Showing `149,30` is also acceptable if the chosen input-formatting policy preserves all meaningful precision and respects the input limit. Document the chosen policy.
- Do not hardcode the German decimal separator globally.
- Do not insert thousands-grouping separators into editable values unless the existing parser unambiguously supports them. Prefer ungrouped editable decimal text.
- Do not reuse a two-decimal display formatter if doing so rounds a valid stored Target Price. TASK-038 deliberately permits more than two decimal places.
- Preserve acceptance of both comma and dot decimal input according to the existing parser, positive finite values up to 1,000,000, and `maxlength=20`.
- Preserve the actual numeric value sent to the API. Locale formatting is a client presentation concern only.
- Ensure an unchanged localized value remains a no-op on blur or Enter; no accidental PUT, rounding or allocation invalidation.
- Preserve successful-save synchronization, draft text on failure, validation messages, partial success warnings, busy state and accessibility.
- Do not reformat on every keystroke or disrupt cursor position during editing.
- Inspect representability of very small or high-precision valid server values within the existing 20-character input limit and accepted decimal syntax. Do not silently round, truncate or overwrite them. If exact editable representation cannot be achieved under the existing constraints, document the conflict and request a Product Owner decision rather than changing the numeric contract silently.
- Implement the fix in the shared TargetPriceCell/formatting path so Table and Cards behave consistently.

## 3. Correct zero-distance investment allocation

### Observed defect and historical context

When Price and Target Price both equal `149.3`, Distance to Target correctly displays `0,00 %`, but Savings Amount is `0 €` even when the stock should participate in allocation.

TASK-031 introduced `number | undefined` for unavailable distances and explicitly retained the existing factor behavior that collapsed zero and undefined. Its completion report identified a truthiness check in `calculateInvestmentFactor()` as the reason. Verify the actual current implementation and reproduce the defect before changing it.

### Required financial semantics

- `undefined` distance means unavailable valuation data and must remain excluded from allocation (factor zero).
- A numeric distance of exactly zero, including JavaScript negative zero, is a valid valuation at Target Price and must be evaluated by the regular existing investment-factor formula.
- Remove the truthiness-based conflation of zero and missing distance. Use explicit missing/invalid-value checks appropriate to the existing domain contract.
- Preserve defensive handling of non-finite distances and invalid inputs. Do not allow NaN or Infinity to contaminate allocation results.
- Preserve the existing formula and all existing rules for valid nonzero distances. Do not invent a new weighting formula, special bonus, minimum allocation or rounding algorithm.
- Derive and document the expected factor at zero from the actual formula. If the formula itself produces zero or is undefined at zero, stop and report the architectural/product conflict before inventing a replacement formula.
- A positive factor does not guarantee a positive whole-Euro Savings Amount for every possible budget or portfolio: existing rounding and zero-budget behavior remain unchanged.
- Do not use formatted percentages to determine whether a distance equals zero. A small nonzero raw distance may display as `0,00 %` and must still use its actual numeric value.
- Preserve TASK-031 distance calculation and DTO semantics: missing distance remains undefined/omitted, real zero remains numeric zero.
- Preserve allocation across the full active Watchlist, independent of filtering and sorting.
- Preserve existing allocation invalidation after Target Price changes and all existing Workspace lifecycle rules.
- No client-side financial formula. The authoritative correction belongs in the server domain/application allocation path.

## 4. Automated tests

### Formatting and input unit tests

- Test explicit German and English locale behavior without relying on the machine's default locale.
- Test integer and fractional Target Prices, zero trailing digits where relevant, values with more than two decimal places, and the maximum valid Target Price.
- Verify formatter/parser round-trip for representative valid editable values and document any representability limitation.
- Verify both comma and dot inputs retain their existing numeric semantics.
- Verify formatting an unchanged value does not cause a mutation or precision loss.

### Domain and allocation unit tests

- Reproduce the old zero-distance factor behavior before fixing it.
- Assert the exact expected factor for distance zero, derived from the existing formula.
- Assert undefined remains excluded; test negative zero and defensive non-finite inputs.
- Preserve existing positive/negative distance formula tests.
- Add an allocation-service regression with one eligible stock at exact Target Price and a sufficiently large positive savings budget. It must receive the expected allocation under the existing formula and rounding rules.
- Add a mixed portfolio containing negative, zero, positive and unavailable distances. Verify expected relative weights and final allocation using independently calculated expectations.
- Verify a portfolio containing only unavailable distances retains existing no-allocation behavior.
- Verify zero budget and whole-Euro rounding remain unchanged.
- Verify a small nonzero distance that displays as zero is not treated as exact zero by the domain logic.
- Verify API/DTO composition preserves numeric zero and the corrected allocation response.
- Update existing assertions that explicitly encode the obsolete zero-factor rule; do not weaken unrelated assertions.

### Playwright coverage

Use existing feature specs and presentation-agnostic locators where practical.

- Large JPY Price: full locale-formatted DOM text and matching native title.
- Representative large values in other truncatable numeric columns, including signed Distance and Savings Amount.
- Missing values have no misleading title; real zero remains visible.
- Existing Savings Amount tooltip behavior remains intact.
- German locale Target Price displays a decimal comma; English locale displays a decimal point.
- Table and Card Target Price formatting and editing remain consistent.
- Enter and blur save the correct numeric value; unchanged localized draft sends no PUT.
- Preserve failure draft, validation, partial success and allocation invalidation behavior.
- Exact-zero Distance stock displays the corrected server allocation result. Mocked E2E responses verify presentation only; domain/service tests must independently prove the calculation.
- Verify no horizontal-overflow regression at representative desktop and Card widths.
- Verify Firefox hover behavior manually where available; if Firefox is not configured in the permanent suite, a focused temporary verification is acceptable. Do not expand the full browser matrix solely for this task.

## 5. Architecture and documentation

- Update `ARCHITECTURE.md` to describe locale-aware editable Target Price formatting separately from financial display formatting.
- Document full-value native titles for truncatable numeric table cells.
- Correct the investment-factor semantics (including the historical §22.2 rule if still present): unavailable distance is excluded, exact numeric zero uses the regular formula.
- Add concise supersession notes to TASK-003/TASK-031 and other historical tasks that explicitly describe the obsolete zero-factor behavior. Keep their status Done.
- Preserve TASK-038 numeric and textual limits; do not silently change the precision contract.
- Record the final formula-at-zero expectation and rationale in the completion report.

## Non-goals

- New tooltip library or general tooltip framework.
- Table/Card redesign or breakpoint changes.
- Changes to MarketDataProvider or ExchangeRateProvider.
- New financial weighting or rounding formulas.
- Target Price precision restrictions, data migration or API shape changes.
- Workspace architecture changes, unrelated renames or cleanup.
- Production deployment.

## Acceptance criteria

1. Large Price values have a complete locale-formatted native title and full DOM text.
2. Other truncatable numeric table values have consistent full-value affordances; existing Savings Amount titles remain correct.
3. Missing values and real zero remain distinct.
4. Firefox tooltip behavior is investigated and actual verification or limitations are reported.
5. Cards retain full financial values and existing responsive behavior.
6. Target Price uses the appropriate locale decimal separator in both Table and Cards.
7. Editable formatting does not silently round or change stored numeric values.
8. Both supported decimal separators remain accepted on input; existing range and length constraints remain.
9. Unchanged localized Target Price produces no PUT or allocation invalidation.
10. Exact numeric zero distance is evaluated by the regular investment-factor formula; undefined remains excluded.
11. The expected factor at zero and corrected allocation are directly verified by domain/service tests.
12. Existing nonzero-distance formulas, rounding, zero-budget behavior and invalid-data handling remain unchanged.
13. API/DTO zero-vs-undefined semantics and Workspace lifecycle remain intact.
14. Permanent regression tests cover all three defects.
15. Architecture and relevant historical task notes reflect the intentional semantic correction.
16. All project checks pass; no production deployment occurs.

## Verification

Run focused characterization tests before implementation, then execute:

```bash
npm run test
npm run test:e2e
npm run check
npm run lint
npm run build
```

Review screenshots at 375, 768, 1280 and 1600px, including large financial values and decimal-comma Target Price inputs. Verify Chromium and Firefox where available. Report actual results, not assumed successes. No production testing or deployment is required.

## Completion report

Report:

- files added/changed;
- root cause of each of the three defects;
- affected numeric columns, title implementation and Firefox/Chromium findings;
- Target Price locale and precision policy, round-trip results and any input representability conflict;
- previous and corrected factor behavior, actual formula and exact expected factor at zero;
- representative before/after allocation results, including a mixed portfolio and an unavailable-distance stock;
- tests added/updated and all verification command results;
- screenshot and responsive verification;
- architecture changes and superseded historical decisions;
- assumptions, deviations, unresolved issues and any browser/runtime verification limitations;
- confirmation no unrelated formulas, API contracts, persistence or Workspace architecture were changed;
- confirmation no production deployment occurred.

Change this task's status from Ready to Done only after implementation and verification are complete. Do not modify unrelated task statuses. Do not stage, commit or push changes; Git operations are performed manually by the Product Owner.
