import { describe, expect, it } from 'vitest';
import { calculateDividendYield, normalizeAnnualDividendForYield } from './dividendYield';

describe('calculateDividendYield', () => {
	it('calculates the standard ratio for a normal currency', () => {
		expect(calculateDividendYield(5, 100, 'USD')).toBeCloseTo(0.05);
	});

	it('applies no special conversion for EUR', () => {
		expect(calculateDividendYield(5, 100, 'EUR')).toBeCloseTo(0.05);
	});

	it('applies no legacy INR correction', () => {
		expect(calculateDividendYield(5, 100, 'INR')).toBeCloseTo(0.05);
	});

	it('applies the GBp unit correction (dividend treated as GBP, price in pence)', () => {
		expect(calculateDividendYield(4.85, 18_000, 'GBp')).toBeCloseTo(0.026944, 5);
	});

	it('does not mutate the values or any surrounding StockMarketData object', () => {
		const stock = {
			symbol: 'SHEL.L',
			name: 'Shell plc',
			price: 18_000,
			currency: 'GBp',
			annualDividend: 4.85,
			marketCap: 187_662_401_536
		};
		const snapshot = { ...stock };

		calculateDividendYield(stock.annualDividend, stock.price, stock.currency);

		expect(stock).toEqual(snapshot);
	});

	it('returns 0 for a missing dividend', () => {
		expect(calculateDividendYield(undefined, 100, 'USD')).toBe(0);
	});

	it('returns 0 for a genuine zero dividend', () => {
		expect(calculateDividendYield(0, 100, 'USD')).toBe(0);
	});

	it('returns 0 for a missing price', () => {
		expect(calculateDividendYield(5, undefined, 'USD')).toBe(0);
	});

	it('returns 0 for a zero price', () => {
		expect(calculateDividendYield(5, 0, 'USD')).toBe(0);
	});

	it('returns 0 for a negative price', () => {
		expect(calculateDividendYield(5, -100, 'USD')).toBe(0);
	});

	it('returns 0 for a negative dividend', () => {
		expect(calculateDividendYield(-5, 100, 'USD')).toBe(0);
	});

	it.each([
		['NaN', Number.NaN],
		['Infinity', Number.POSITIVE_INFINITY],
		['-Infinity', Number.NEGATIVE_INFINITY]
	])('returns 0 for a %s price', (_label, price) => {
		expect(calculateDividendYield(5, price, 'USD')).toBe(0);
	});

	it.each([
		['NaN', Number.NaN],
		['Infinity', Number.POSITIVE_INFINITY],
		['-Infinity', Number.NEGATIVE_INFINITY]
	])('returns 0 for a %s dividend', (_label, dividend) => {
		expect(calculateDividendYield(dividend, 100, 'USD')).toBe(0);
	});

	it('calculates normally when currency is missing', () => {
		expect(calculateDividendYield(5, 100, undefined)).toBeCloseTo(0.05);
	});

	it('applies no correction for an unfamiliar currency code', () => {
		expect(calculateDividendYield(5, 100, 'ZZZ')).toBeCloseTo(0.05);
	});
});

describe('normalizeAnnualDividendForYield', () => {
	it('multiplies by 100 for GBp', () => {
		expect(normalizeAnnualDividendForYield(4.85, 'GBp')).toBeCloseTo(485);
	});

	it('leaves other currencies, including INR, unchanged', () => {
		expect(normalizeAnnualDividendForYield(5, 'INR')).toBe(5);
		expect(normalizeAnnualDividendForYield(5, 'USD')).toBe(5);
		expect(normalizeAnnualDividendForYield(5, undefined)).toBe(5);
	});
});
