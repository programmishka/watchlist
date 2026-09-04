import { describe, expect, it } from 'vitest';
import { parseTargetPriceInput } from './targetPriceInput';

describe('parseTargetPriceInput', () => {
	it.each([
		['200', 200],
		['200.5', 200.5],
		['200,5', 200.5],
		[' 200,5 ', 200.5],
		['  200  ', 200]
	])('parses %s as %d', (input, expected) => {
		expect(parseTargetPriceInput(input)).toBe(expected);
	});

	it.each([
		[''],
		[' '],
		['abc'],
		['200abc'],
		['.'],
		[','],
		['1,234.56'],
		['1.234,56'],
		['0'],
		['-10'],
		['-10.5']
	])('rejects %s', (input) => {
		expect(parseTargetPriceInput(input)).toBeUndefined();
	});
});
