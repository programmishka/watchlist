/** Consistent placeholder for unavailable optional table values (TASK-017 §16). */
export const MISSING_VALUE_PLACEHOLDER = '—';

/**
 * `undefined` and any non-finite value (`NaN`, `Infinity`, `-Infinity`) are
 * treated as unavailable for display (TASK-033 §24-25, §58): a real `0` is
 * never conflated with a missing value, but a non-finite result must never
 * be formatted as if it were a real number.
 */
function isMissing(value: number | undefined): value is undefined {
	return value === undefined || !Number.isFinite(value);
}

/**
 * Locale-aware number formatting for display only. Contains no business
 * formulas; `value` must already be the fully computed value to display.
 * Always renders exactly two decimal places (TASK-033 §15-16).
 */
export function formatNumber(value: number | undefined, locale?: string): string {
	if (isMissing(value)) {
		return MISSING_VALUE_PLACEHOLDER;
	}
	return new Intl.NumberFormat(locale, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(value);
}

/**
 * Locale-aware percentage formatting for a decimal ratio (e.g. `0.0266` -> `2.66%`).
 * Contains no business formulas; `value` must already be the ratio to display.
 * Always renders exactly two decimal places (TASK-033 §20-21) and never adds
 * a sign to a positive value.
 */
export function formatPercentage(value: number | undefined, locale?: string): string {
	if (isMissing(value)) {
		return MISSING_VALUE_PLACEHOLDER;
	}
	return new Intl.NumberFormat(locale, {
		style: 'percent',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(value);
}

/**
 * Signed percentage presentation dedicated to Target Price distance
 * (TASK-033 §22-23): an explicit `+` for a positive value, `-` retained for
 * a negative value, and a neutral (unsigned) `0.00%` for a real zero rather
 * than `+0.00%`. Contains no business formulas; `value` must already be the
 * ratio to display.
 */
export function formatSignedPercentage(value: number | undefined, locale?: string): string {
	if (isMissing(value)) {
		return MISSING_VALUE_PLACEHOLDER;
	}
	return new Intl.NumberFormat(locale, {
		style: 'percent',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
		signDisplay: 'exceptZero'
	}).format(value);
}

/**
 * Locale-aware whole-Euro formatting (TASK-024 §16-17). `value` must already
 * be the fully computed whole-Euro amount to display; a calculated `0` is a
 * real value and is formatted normally, distinct from the missing-value
 * placeholder used before any calculation exists.
 */
export function formatWholeEuro(value: number | undefined, locale?: string): string {
	if (value === undefined || Number.isNaN(value)) {
		return MISSING_VALUE_PLACEHOLDER;
	}
	return new Intl.NumberFormat(locale, {
		style: 'currency',
		currency: 'EUR',
		maximumFractionDigits: 0,
		minimumFractionDigits: 0
	}).format(value);
}
