import { describe, expect, it } from 'vitest';
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
});
