import { describe, expect, it } from 'vitest';
import {
	formatNumber,
	formatPercentage,
	formatWholeEuro,
	MISSING_VALUE_PLACEHOLDER
} from './format';

const LOCALE = 'en-US';

describe('formatNumber', () => {
	it('formats a representative number with up to two fractional digits', () => {
		expect(formatNumber(248.79, LOCALE)).toBe('248.79');
	});

	it('does not force trailing zeroes', () => {
		expect(formatNumber(42.5, LOCALE)).toBe('42.5');
		expect(formatNumber(5, LOCALE)).toBe('5');
	});

	it('formats zero as a real value rather than treating it as missing', () => {
		expect(formatNumber(0, LOCALE)).toBe('0');
	});

	it('formats a missing value as the placeholder', () => {
		expect(formatNumber(undefined, LOCALE)).toBe(MISSING_VALUE_PLACEHOLDER);
	});
});

describe('formatPercentage', () => {
	it('formats a representative decimal ratio as a percentage', () => {
		expect(formatPercentage(0.0266, LOCALE)).toBe('2.66%');
	});

	it('preserves the negative sign', () => {
		expect(formatPercentage(-0.1, LOCALE)).toBe('-10%');
	});

	it('formats zero as a real value rather than treating it as missing', () => {
		expect(formatPercentage(0, LOCALE)).toBe('0%');
	});

	it('formats a missing value as the placeholder', () => {
		expect(formatPercentage(undefined, LOCALE)).toBe(MISSING_VALUE_PLACEHOLDER);
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
