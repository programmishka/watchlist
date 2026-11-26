import { TARGET_PRICE_INPUT_MAX_LENGTH } from '../shared/targetPrice';

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
 * Combines Price and Currency into one display value for Card presentation
 * (TASK-036 §18-19): e.g. `319.97 USD`. A missing/non-finite price renders as
 * the plain missing-value placeholder rather than a misleading
 * currency-only value (e.g. `— USD`); a present price with no currency
 * renders the number alone. Contains no business formula and reuses
 * `formatNumber` rather than duplicating its rounding/placeholder rules.
 */
export function formatPriceWithCurrency(
	price: number | undefined,
	currency: string | undefined,
	locale?: string
): string {
	if (isMissing(price)) {
		return MISSING_VALUE_PLACEHOLDER;
	}
	const formattedPrice = formatNumber(price, locale);
	return currency ? `${formattedPrice} ${currency}` : formattedPrice;
}

/**
 * True when a value will render as a real formatted number rather than the
 * missing-value placeholder (TASK-046) — the same missing/non-finite rule
 * `formatNumber`/`formatPercentage`/`formatSignedPercentage` apply
 * internally, exposed so callers (native `title` attributes) can decide
 * whether a value is populated without duplicating or diverging from that
 * rule. A real `0` is populated; `undefined`/`NaN`/`Infinity` are not.
 */
export function isDisplayableNumber(value: number | undefined): value is number {
	return value !== undefined && Number.isFinite(value);
}

/**
 * Locale-aware decimal separator for a given locale (TASK-046), derived from
 * `Intl.NumberFormat` rather than hardcoded, so the editable Target Price
 * input (`formatEditableNumber` below) follows the exact same locale policy
 * as the display formatters above instead of a second, independently
 * maintained locale rule.
 */
function decimalSeparatorFor(locale?: string): string {
	const part = new Intl.NumberFormat(locale).formatToParts(1.1).find((p) => p.type === 'decimal');
	return part?.value ?? '.';
}

/**
 * `Number.prototype.toString()` switches to exponential notation (e.g.
 * `1e-7`) for a finite value whose absolute value is below `1e-6`. Expands
 * that back into a plain decimal string (TASK-046 follow-up §4) without
 * rounding or losing any significant digit — only the textual *form*
 * changes, never the digits themselves. Values that do not use exponential
 * notation are returned unchanged.
 */
function expandExponentialNotation(text: string): string {
	const match = /^(-?)(\d+)(?:\.(\d+))?e([+-]\d+)$/i.exec(text);
	if (!match) {
		return text;
	}
	const [, sign, integerDigits, fractionDigits = '', exponentText] = match;
	const exponent = Number(exponentText);
	const digits = integerDigits + fractionDigits;
	const pointIndex = integerDigits.length + exponent;

	let expanded: string;
	if (pointIndex <= 0) {
		expanded = `0.${'0'.repeat(-pointIndex)}${digits}`;
	} else if (pointIndex >= digits.length) {
		expanded = digits + '0'.repeat(pointIndex - digits.length);
	} else {
		expanded = `${digits.slice(0, pointIndex)}.${digits.slice(pointIndex)}`;
	}
	return sign + expanded;
}

/**
 * Pads a plain-decimal string's fractional part to at least
 * `minimumFractionDigits`, without ever shortening a longer fractional part
 * (TASK-046 follow-up §1-2: minimum, not maximum, decimal places). A value
 * with no `.` at all is treated as having zero fractional digits.
 */
function withMinimumFractionDigits(text: string, minimumFractionDigits: number): string {
	const [integerPart, fractionPart = ''] = text.split('.');
	if (fractionPart.length >= minimumFractionDigits) {
		return text;
	}
	return `${integerPart}.${fractionPart.padEnd(minimumFractionDigits, '0')}`;
}

/**
 * Locale-aware editable-number formatting dedicated to the Target Price
 * input (TASK-046, minimum-decimal-places follow-up). Unlike `formatNumber`,
 * this preserves the full stored precision (TASK-038 deliberately allows
 * more than two decimal places) rather than rounding to exactly two, and
 * never inserts thousands-grouping separators — the existing input parser
 * (`targetPriceInput.ts`) does not support them. `value` must already be the
 * raw stored Target Price; `undefined` renders as an empty string so the
 * input can keep showing empty rather than the `—` placeholder used
 * elsewhere for non-editable missing values.
 *
 * The rule is a *minimum* of two decimal places, not a maximum: `14` renders
 * as `14.00`, `14.3` as `14.30`, but `14.357` is left at three decimal places
 * rather than rounded to two.
 *
 * Representability limitation: a sufficiently small positive value (e.g.
 * `1e-18` and smaller) expands to a plain-decimal string longer than the
 * existing `TARGET_PRICE_INPUT_MAX_LENGTH` (20 characters, TASK-038); such a
 * value falls back to its original, shorter `Number.prototype.toString()`
 * form (which may itself still be exponential notation) rather than being
 * silently truncated or rounded. The domain only requires a Target Price to
 * be a positive finite number at most `MAX_TARGET_PRICE` (no documented
 * minimum), so a pre-existing value this small could in principle exist; the
 * existing input parser cannot read exponential notation back, so such a
 * value cannot currently be round-tripped through this input. This is a
 * pre-existing limitation of representing a stored number as plain decimal
 * text within a fixed-length input (not introduced by this formatter) and is
 * called out here rather than silently "fixed" by changing the numeric
 * contract, widening the input, or introducing a minimum Target Price.
 */
export function formatEditableNumber(value: number | undefined, locale?: string): string {
	if (value === undefined) {
		return '';
	}

	const rawText = String(value);
	const expanded = expandExponentialNotation(rawText);
	const padded = withMinimumFractionDigits(expanded, 2);
	// Prefer the fully-expanded, minimum-two-decimal form; fall back to a
	// shorter representation only when the preferred form would not fit the
	// existing input-length constraint (never the other way around).
	const candidates = [padded, expanded, rawText];
	const chosen =
		candidates.find((candidate) => candidate.length <= TARGET_PRICE_INPUT_MAX_LENGTH) ?? rawText;

	const separator = decimalSeparatorFor(locale);
	return separator === '.' ? chosen : chosen.replace('.', separator);
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
