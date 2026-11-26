import { describe, expect, it } from 'vitest';
import { MAX_TARGET_PRICE } from '../shared/targetPrice';
import { parseTargetPriceInput } from './targetPriceInput';
import {
	formatEditableNumber,
	formatNumber,
	formatPercentage,
	formatPriceWithCurrency,
	formatSignedPercentage,
	formatWholeEuro,
	isDisplayableNumber,
	MISSING_VALUE_PLACEHOLDER
} from './format';

const LOCALE = 'en-US';
const GERMAN_LOCALE = 'de-DE';

describe('formatNumber', () => {
	it('formats a representative number with exactly two decimal places', () => {
		expect(formatNumber(248.79, LOCALE)).toBe('248.79');
	});

	it('forces trailing zeroes to exactly two decimal places', () => {
		expect(formatNumber(4669.7, LOCALE)).toBe('4,669.70');
		expect(formatNumber(182.5, LOCALE)).toBe('182.50');
	});

	it('formats zero as a real value rather than treating it as missing', () => {
		expect(formatNumber(0, LOCALE)).toBe('0.00');
	});

	it('formats a missing value as the placeholder', () => {
		expect(formatNumber(undefined, LOCALE)).toBe(MISSING_VALUE_PLACEHOLDER);
	});

	it('formats non-finite values as the missing placeholder rather than misleading numeric output', () => {
		expect(formatNumber(NaN, LOCALE)).toBe(MISSING_VALUE_PLACEHOLDER);
		expect(formatNumber(Infinity, LOCALE)).toBe(MISSING_VALUE_PLACEHOLDER);
		expect(formatNumber(-Infinity, LOCALE)).toBe(MISSING_VALUE_PLACEHOLDER);
	});
});

describe('formatPercentage', () => {
	it('formats a representative decimal ratio as a percentage with exactly two decimal places', () => {
		expect(formatPercentage(0.0266, LOCALE)).toBe('2.66%');
	});

	it('preserves the negative sign without forcing a positive sign', () => {
		expect(formatPercentage(-0.1, LOCALE)).toBe('-10.00%');
	});

	it('forces a trailing zero rather than truncating it', () => {
		expect(formatPercentage(0.025, LOCALE)).toBe('2.50%');
	});

	it('formats zero as a real value rather than treating it as missing', () => {
		expect(formatPercentage(0, LOCALE)).toBe('0.00%');
	});

	it('formats a missing value as the placeholder', () => {
		expect(formatPercentage(undefined, LOCALE)).toBe(MISSING_VALUE_PLACEHOLDER);
	});
});

describe('formatSignedPercentage', () => {
	it('adds an explicit + sign for a positive distance', () => {
		expect(formatSignedPercentage(0.152, LOCALE)).toBe('+15.20%');
	});

	it('retains the - sign for a negative distance', () => {
		expect(formatSignedPercentage(-0.152, LOCALE)).toBe('-15.20%');
	});

	it('displays a real zero distance neutrally, without a + sign', () => {
		expect(formatSignedPercentage(0, LOCALE)).toBe('0.00%');
	});

	it('formats a missing value as the placeholder', () => {
		expect(formatSignedPercentage(undefined, LOCALE)).toBe(MISSING_VALUE_PLACEHOLDER);
	});
});

describe('formatPriceWithCurrency', () => {
	it('combines a representative price and currency into one value', () => {
		expect(formatPriceWithCurrency(319.97, 'USD', LOCALE)).toBe('319.97 USD');
	});

	it('renders the price alone when currency is missing', () => {
		expect(formatPriceWithCurrency(319.97, undefined, LOCALE)).toBe('319.97');
	});

	it('renders the placeholder alone for a missing price, never a currency-only value', () => {
		expect(formatPriceWithCurrency(undefined, 'USD', LOCALE)).toBe(MISSING_VALUE_PLACEHOLDER);
	});

	it('renders the placeholder for a non-finite price', () => {
		expect(formatPriceWithCurrency(NaN, 'USD', LOCALE)).toBe(MISSING_VALUE_PLACEHOLDER);
	});
});

describe('formatWholeEuro', () => {
	it('formats a whole-Euro amount', () => {
		expect(formatWholeEuro(320, LOCALE)).toBe('€320');
	});

	it('formats a calculated zero as a real value rather than treating it as missing', () => {
		expect(formatWholeEuro(0, LOCALE)).toBe('€0');
	});

	it('formats a missing value as the placeholder', () => {
		expect(formatWholeEuro(undefined, LOCALE)).toBe(MISSING_VALUE_PLACEHOLDER);
	});
});

describe('isDisplayableNumber', () => {
	it('is true for a positive value', () => {
		expect(isDisplayableNumber(14310.75)).toBe(true);
	});

	it('is true for a real zero', () => {
		expect(isDisplayableNumber(0)).toBe(true);
	});

	it('is false for a missing value', () => {
		expect(isDisplayableNumber(undefined)).toBe(false);
	});

	it.each([
		['NaN', NaN],
		['Infinity', Infinity],
		['-Infinity', -Infinity]
	])('is false for %s', (_label, value) => {
		expect(isDisplayableNumber(value)).toBe(false);
	});
});

describe('formatEditableNumber (TASK-046, minimum-decimal-places follow-up)', () => {
	it('pads an integer Target Price to two decimal places, in both locales', () => {
		expect(formatEditableNumber(14, LOCALE)).toBe('14.00');
		expect(formatEditableNumber(14, GERMAN_LOCALE)).toBe('14,00');
	});

	it('pads a value with one decimal place up to two', () => {
		expect(formatEditableNumber(14.3, LOCALE)).toBe('14.30');
		expect(formatEditableNumber(14.3, GERMAN_LOCALE)).toBe('14,30');
	});

	it('leaves a value with exactly two decimal places unchanged', () => {
		expect(formatEditableNumber(14.35, LOCALE)).toBe('14.35');
		expect(formatEditableNumber(14.35, GERMAN_LOCALE)).toBe('14,35');
	});

	it('preserves more than two decimal places rather than rounding (TASK-038): this is a minimum, not a maximum', () => {
		expect(formatEditableNumber(14.357, LOCALE)).toBe('14.357');
		expect(formatEditableNumber(14.357, GERMAN_LOCALE)).toBe('14,357');
		expect(formatEditableNumber(123.456789, LOCALE)).toBe('123.456789');
		expect(formatEditableNumber(123.456789, GERMAN_LOCALE)).toBe('123,456789');
	});

	it('pads a value whose single fractional digit is itself beyond the integer part (large magnitude)', () => {
		expect(formatEditableNumber(15000.5, LOCALE)).toBe('15000.50');
		expect(formatEditableNumber(15000.5, GERMAN_LOCALE)).toBe('15000,50');
	});

	it('does not round when padding would otherwise be tempting via toFixed(2)-style truncation', () => {
		// A regression guard against reintroducing `toFixed(2)` as the general
		// solution (explicitly disallowed): toFixed(2) would truncate this to
		// "0.00", silently discarding the entire stored value.
		expect(formatEditableNumber(0.0025, LOCALE)).toBe('0.0025');
		expect(formatEditableNumber(0.0025, GERMAN_LOCALE)).toBe('0,0025');
	});

	it('formats the maximum valid Target Price without thousands-grouping separators', () => {
		expect(formatEditableNumber(MAX_TARGET_PRICE, LOCALE)).toBe('1000000.00');
		expect(formatEditableNumber(MAX_TARGET_PRICE, GERMAN_LOCALE)).toBe('1000000,00');
	});

	it('renders an empty string for a missing value, not the "—" placeholder or "0.00"', () => {
		expect(formatEditableNumber(undefined, LOCALE)).toBe('');
		expect(formatEditableNumber(undefined, LOCALE)).not.toBe(MISSING_VALUE_PLACEHOLDER);
		expect(formatEditableNumber(undefined, LOCALE)).not.toBe('0.00');
	});

	describe('scientific-notation expansion', () => {
		it('expands a small value that would otherwise render in scientific notation', () => {
			expect(formatEditableNumber(0.0000001, LOCALE)).toBe('0.0000001');
			expect(formatEditableNumber(0.0000001, GERMAN_LOCALE)).toBe('0,0000001');
			expect(formatEditableNumber(0.00000001, LOCALE)).toBe('0.00000001');
			expect(formatEditableNumber(0.00000001, GERMAN_LOCALE)).toBe('0,00000001');
		});

		it('an expanded small value now round-trips through the input parser (improvement over plain scientific notation)', () => {
			const formatted = formatEditableNumber(0.0000001, LOCALE);
			expect(formatted).not.toMatch(/e/i);
			expect(parseTargetPriceInput(formatted)).toBe(0.0000001);
		});

		it('documents the remaining representability limitation: a value whose expansion would exceed the 20-character input limit falls back to scientific notation', () => {
			// 1e-18 expands to exactly 20 characters ("0." + 17 zeros + "1") and
			// is therefore still representable; 1e-19 would need 21 and is not.
			const justFits = formatEditableNumber(1e-18, LOCALE);
			expect(justFits).toBe('0.000000000000000001');
			expect(justFits.length).toBe(20);
			expect(parseTargetPriceInput(justFits)).toBe(1e-18);

			const tooSmall = formatEditableNumber(1e-19, LOCALE);
			expect(tooSmall).toBe('1e-19');
			expect(parseTargetPriceInput(tooSmall)).toBeUndefined();
		});
	});

	it.each([
		['integer', 14],
		['simple fraction', 200.5],
		['exactly two decimal places', 14.35],
		['many fractional digits', 0.123456],
		['maximum value', MAX_TARGET_PRICE]
	])('round-trips %s through the input parser in an English locale', (_label, value) => {
		expect(parseTargetPriceInput(formatEditableNumber(value, LOCALE))).toBe(value);
	});

	it.each([
		['integer', 14],
		['simple fraction', 200.5],
		['exactly two decimal places', 14.35],
		['many fractional digits', 0.123456],
		['maximum value', MAX_TARGET_PRICE]
	])('round-trips %s through the input parser in a German locale', (_label, value) => {
		expect(parseTargetPriceInput(formatEditableNumber(value, GERMAN_LOCALE))).toBe(value);
	});

	it('formatting an unchanged value twice is idempotent (no drift/precision loss on repeated formatting)', () => {
		const once = formatEditableNumber(149.3, GERMAN_LOCALE);
		const stillSameValue = parseTargetPriceInput(once);
		const twice = formatEditableNumber(stillSameValue, GERMAN_LOCALE);
		expect(twice).toBe(once);
	});

	it('never introduces a thousands-grouping separator for a large value', () => {
		expect(formatEditableNumber(15000.5, LOCALE)).toBe('15000.50');
		expect(formatEditableNumber(15000.5, LOCALE)).not.toContain(',');
		expect(formatEditableNumber(MAX_TARGET_PRICE, GERMAN_LOCALE)).toBe('1000000,00');
		expect(formatEditableNumber(MAX_TARGET_PRICE, GERMAN_LOCALE)).not.toMatch(/\d\.\d{3}/);
	});
});
