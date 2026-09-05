/** Consistent placeholder for unavailable optional table values (TASK-017 §16). */
export const MISSING_VALUE_PLACEHOLDER = '—';

/**
 * Locale-aware number formatting for display only. Contains no business
 * formulas; `value` must already be the fully computed value to display.
 */
export function formatNumber(value: number | undefined, locale?: string): string {
	if (value === undefined || Number.isNaN(value)) {
		return MISSING_VALUE_PLACEHOLDER;
	}
	return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
}

/**
 * Locale-aware percentage formatting for a decimal ratio (e.g. `0.0266` -> `2.66%`).
 * Contains no business formulas; `value` must already be the ratio to display.
 */
export function formatPercentage(value: number | undefined, locale?: string): string {
	if (value === undefined || Number.isNaN(value)) {
		return MISSING_VALUE_PLACEHOLDER;
	}
	return new Intl.NumberFormat(locale, {
		style: 'percent',
		maximumFractionDigits: 2
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
