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
