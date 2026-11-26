# TASK-046 Follow-up: Minimum Decimal Precision for Editable Target Prices

## Status

Done

## Context

TASK-046 introduced `formatEditableNumber()` to ensure locale-aware Target Price formatting without losing stored numeric precision.

The implementation correctly uses the locale-specific decimal separator but does not ensure a minimum of two decimal places.

For example, under German locale:

- `14` is displayed as `14`
- `14.3` is displayed as `14,3`

This is visually inconsistent with the other financial values displayed throughout the application.

Additionally, the TASK-046 completion report identified a representability gap for very small positive Target Prices that are converted to scientific notation by JavaScript.

## Goal

Improve editable Target Price formatting so that:

- at least two decimal places are displayed;
- additional decimal precision is preserved;
- locale-specific decimal separators are used;
- formatting never changes the underlying numeric value;
- small positive values remain editable wherever representable within the existing input constraints.

This is a presentation correction, not a change to financial precision or domain validation.

## Context to Read

- `CLAUDE.md`
- `ARCHITECTURE.md`
- TASK-033
- TASK-038
- TASK-046
- `src/lib/client/format.ts`
- `src/lib/client/format.spec.ts`
- `src/lib/components/TargetPriceCell.svelte`
- existing Target Price input parser
- relevant Target Price and Stock Card Playwright tests

## 1. Minimum Decimal Places

Extend the existing `formatEditableNumber()` helper to display at least two decimal places.

Expected behavior:

| Stored numeric value | German locale | English locale |
|---:|---:|---:|
| 14 | 14,00 | 14.00 |
| 14.3 | 14,30 | 14.30 |
| 14.35 | 14,35 | 14.35 |
| 14.357 | 14,357 | 14.357 |
| 0.0025 | 0,0025 | 0.0025 |
| 15000.5 | 15000,50 | 15000.50 |
| 1000000 | 1000000,00 | 1000000.00 |

## 2. Preserve Numeric Precision

The new rule is:

> Minimum two decimal places, not maximum two decimal places.

Do not round or truncate additional decimal places.

Do not use `toFixed(2)` as the general formatting solution.

The formatted representation must preserve the stored JavaScript numeric value.

## 3. No Thousands Separators

Editable Target Prices must continue to omit grouping separators.

For example, under German locale:

- Correct: `15000,50`
- Incorrect: `15.000,50`

Preserve compatibility with the existing Target Price input parser.

## 4. Scientific Notation

TASK-046 identified that very small positive values may currently be rendered using scientific notation.

For example:

| Stored value | Current representation | Desired German representation |
|---:|---|---|
| 0.0000001 | `1e-7` | `0,0000001` |
| 0.00000001 | `1e-8` | `0,00000001` |

Expand scientific notation into a plain decimal representation wherever the resulting value can be represented within the existing Target Price input-length constraint.

Do not introduce rounding, underflow to zero, or loss of precision.

## 5. Existing Input Boundary

Preserve the TASK-038 constraints:

- `maxlength=20`
- finite numeric value
- strictly greater than zero
- maximum value of `1,000,000`
- no fixed decimal-place restriction at the domain boundary

Not every valid positive JavaScript number can be represented as a plain decimal string within 20 characters.

Investigate this boundary explicitly.

If a stored value cannot be represented losslessly within the existing input constraint, preserve the stored value and ensure that merely focusing or leaving the input cannot trigger an unintended mutation.

Document any remaining representability limitation.

Do not silently increase the input-length limit, introduce a minimum Target Price, or change server-side validation to resolve this edge case.

## 6. TargetPriceCell Integration

Continue using the shared `formatEditableNumber()` helper in `TargetPriceCell.svelte`.

Both Table and Card presentations must automatically receive the corrected formatting through their existing shared component.

Do not introduce separate Table/Card formatting logic.

## 7. Editing Behavior

Preserve the established editing experience:

- both comma and dot decimal input remain accepted;
- users can freely edit the draft;
- do not insert trailing zeros while the user is typing;
- apply canonical display formatting when initializing the field and after successful save or another existing canonicalization point;
- preserve entered text after validation or server failures;
- unchanged numeric values must not trigger unnecessary PUT requests.

For example, changing `14,30` to `14,3` must not trigger a Target Price mutation solely because the textual representation differs.

## 8. Missing Target Price

Preserve the existing empty-input representation for an unavailable Target Price.

Do not display `0,00` for a missing value.

## 9. Unit Tests

Extend `format.spec.ts` with focused coverage for:

- integer values with two trailing decimal places;
- values with one decimal place;
- values with exactly two decimal places;
- values with more than two decimal places;
- German and English decimal separators;
- absence of grouping separators;
- preservation of numeric precision;
- small positive values normally represented in scientific notation;
- the existing 20-character representability boundary;
- numeric round-trip through the existing input parser.

Preserve all existing invalid-value behavior.

## 10. Playwright Regression Tests

Extend existing Target Price coverage to verify:

1. German locale displays `14,30` instead of `14,3`.
2. English locale displays `14.30` instead of `14.3`.
3. Integer Target Prices display two decimal places.
4. Additional decimal precision remains visible.
5. Table and Card presentations use identical formatting semantics.
6. Focusing and leaving an unchanged Target Price does not trigger a PUT request.
7. Numerically equivalent textual representations do not trigger unnecessary mutations.
8. Successful saves display the canonical formatted value.
9. Failed saves preserve the entered draft.
10. Missing Target Prices remain empty.

Do not weaken existing assertions to accommodate the formatting change.

## 11. Architecture Documentation

Update the relevant Target Price formatting section in `ARCHITECTURE.md`.

Document the distinction:

| Formatting property | Read-only financial values | Editable Target Price |
|---|---|---|
| Locale-aware decimal separator | Yes | Yes |
| Thousands separators | Yes | No |
| Decimal places | Exactly two | At least two |
| Additional stored precision preserved | Not required for display | Yes |

Add a concise follow-up note to TASK-046.

Do not rewrite its original implementation history.

## Non-Goals

Do not implement:

- changes to Target Price domain precision;
- changes to numeric upper or lower bounds;
- changes to the existing input-length limit;
- financial calculation changes;
- investment-allocation changes;
- API contract changes;
- persistence changes;
- Workspace refactoring;
- unrelated formatting changes;
- production deployment.

## Acceptance Criteria

The follow-up is complete when:

- Target Prices display at least two decimal places.
- German locale displays `14,30` instead of `14,3`.
- English locale displays `14.30` instead of `14.3`.
- Additional decimal precision is preserved without rounding.
- Editable values contain no grouping separators.
- Representable small positive values display without scientific notation.
- Any remaining representability limitation is documented.
- Formatting cannot cause unintended Target Price mutations.
- Existing input validation and length constraints remain unchanged.
- Table and Cards share the corrected formatting behavior.
- Existing financial calculations remain unchanged.
- Unit and Playwright regression tests pass.
- Architecture documentation reflects the final formatting rule.

## Verification

Execute:

```bash
npm run test
npm run test:e2e
npm run check
npm run lint
npm run build
```

Additionally, visually verify Target Price formatting in German and English locales in both Table and Card presentations.

Do not report verification as successful unless actually executed.

## Completion Report

Report:

1. Files changed.
2. Final `formatEditableNumber()` implementation strategy.
3. Minimum decimal-place behavior.
4. Numeric precision preservation.
5. German and English locale examples.
6. Scientific-notation handling.
7. Remaining representability limitations, if any.
8. Interaction with `maxlength=20`.
9. Proof that formatting does not trigger unintended mutations.
10. Table/Card consistency.
11. Unit and Playwright tests added or changed.
12. Verification results.
13. Documentation changes.
14. Assumptions or deviations.

Keep TASK-046 status Done and mark this follow-up Done after successful implementation and verification.

Do not deploy production.

Do not stage, commit, or push changes. Git operations are performed manually by the Product Owner.