import { describe, expect, it } from 'vitest';
import {
	formatNumber,
	formatPercentage,
	formatSignedPercentage,
	formatWholeEuro,
	MISSING_VALUE_PLACEHOLDER
} from './format';

const LOCALE = 'en-US';

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
