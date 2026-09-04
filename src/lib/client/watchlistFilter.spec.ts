import { describe, expect, it } from 'vitest';
import { filterStocksByCompanyName, formatStockCount } from './watchlistFilter';
import type { WatchlistStock } from './watchlistApi';

function stock(symbol: string, name: string | undefined): WatchlistStock {
	return { symbol, name, dividendYield: 0 };
}

const GAMES_WORKSHOP = stock('GAW.L', 'Games Workshop Group PLC');
const APPLE = stock('AAPL', 'Apple Inc.');
const SAP = stock('SAP.DE', 'SAP SE');
const UNKNOWN = stock('UNKNOWN', undefined);

describe('filterStocksByCompanyName', () => {
	it('matches a substring anywhere in the company name', () => {
		expect(filterStocksByCompanyName([GAMES_WORKSHOP], 'shop')).toEqual([GAMES_WORKSHOP]);
	});

	it('matches case-insensitively', () => {
		expect(filterStocksByCompanyName([APPLE], 'APPLE')).toEqual([APPLE]);
	});

	it('ignores surrounding whitespace in the filter', () => {
		expect(filterStocksByCompanyName([SAP], '  sap  ')).toEqual([SAP]);
	});

	it('returns all stocks for an empty filter', () => {
		const stocks = [GAMES_WORKSHOP, APPLE, SAP];
		expect(filterStocksByCompanyName(stocks, '')).toEqual(stocks);
	});

	it('returns all stocks for a whitespace-only filter', () => {
		const stocks = [GAMES_WORKSHOP, APPLE, SAP];
		expect(filterStocksByCompanyName(stocks, '   ')).toEqual(stocks);
	});

	it('keeps a missing-name stock visible when the filter is empty', () => {
		expect(filterStocksByCompanyName([UNKNOWN], '')).toEqual([UNKNOWN]);
	});

	it('excludes a missing-name stock from a non-empty filter', () => {
		expect(filterStocksByCompanyName([UNKNOWN], 'unknown')).toEqual([]);
	});

	it('preserves the original stock order among matches', () => {
		const stocks = [SAP, APPLE, GAMES_WORKSHOP];
		expect(filterStocksByCompanyName(stocks, 'e')).toEqual([SAP, APPLE, GAMES_WORKSHOP]);
	});

	it('does not match a symbol when only the company name should be searched', () => {
		expect(filterStocksByCompanyName([UNKNOWN], 'UNKNOWN')).toEqual([]);
	});
});

describe('formatStockCount', () => {
	it('renders singular total count when unfiltered', () => {
		expect(formatStockCount(1, 1, false)).toBe('1 stock');
	});

	it('renders plural total count when unfiltered', () => {
		expect(formatStockCount(3, 3, false)).toBe('3 stocks');
	});

	it('renders filtered and total count when filtered', () => {
		expect(formatStockCount(3, 1, true)).toBe('1 of 3 stocks');
	});

	it('renders zero matches when filtered', () => {
		expect(formatStockCount(3, 0, true)).toBe('0 of 3 stocks');
	});
});
