import { describe, expect, it } from 'vitest';
import { MAX_TOTAL_SAVINGS } from '../shared/investmentSavings';
import { parseTotalSavingsInput } from './investmentSavingsInput';

describe('parseTotalSavingsInput', () => {
	it.each([
		['0', 0],
		['1', 1],
		['500', 500],
		['1000', 1000],
		['25000', 25000]
	])('parses %s as %d', (input, expected) => {
		expect(parseTotalSavingsInput(input)).toBe(expected);
	});

	it.each([[''], [' '], ['-1'], ['12.5'], ['abc']])('rejects %s', (input) => {
		expect(parseTotalSavingsInput(input)).toBeUndefined();
	});

	it('accepts the maximum value (TASK-038)', () => {
		expect(parseTotalSavingsInput(String(MAX_TOTAL_SAVINGS))).toBe(MAX_TOTAL_SAVINGS);
	});

	it('rejects a value above the maximum (TASK-038)', () => {
		expect(parseTotalSavingsInput(String(MAX_TOTAL_SAVINGS + 1))).toBeUndefined();
	});

	it('rejects an unsafe integer (TASK-038)', () => {
		expect(parseTotalSavingsInput('99999999999999999999')).toBeUndefined();
	});
});
