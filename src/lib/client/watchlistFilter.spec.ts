import { describe, expect, it } from 'vitest';
import {
	MAX_COMPANY_NAME_FILTER_LENGTH,
	filterStocksByCompanyName,
	formatStockCount
} from './watchlistFilter';
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

	it('behaves predictably for a filter over the maximum length, truncating rather than erroring (TASK-038)', () => {
		const overLimitFilter = 'x'.repeat(MAX_COMPANY_NAME_FILTER_LENGTH + 50) + 'shop';
		expect(() => filterStocksByCompanyName([GAMES_WORKSHOP], overLimitFilter)).not.toThrow();
		expect(filterStocksByCompanyName([GAMES_WORKSHOP], overLimitFilter)).toEqual([]);
	});

	it('matches using only the first MAX_COMPANY_NAME_FILTER_LENGTH characters of an over-limit filter', () => {
		const nameWithinLimit = 'shop' + 'x'.repeat(MAX_COMPANY_NAME_FILTER_LENGTH - 4);
		const stock = { symbol: 'X', name: nameWithinLimit, dividendYield: 0 };
		const overLimitFilter = nameWithinLimit + 'extra-characters-beyond-the-limit';
		expect(filterStocksByCompanyName([stock], overLimitFilter)).toEqual([stock]);
	});
});

describe('formatStockCount', () => {
	it('renders a zero total count when unfiltered', () => {
		expect(formatStockCount(0, 0, false)).toBe('Total: 0 stocks');
	});

	it('renders singular total count when unfiltered', () => {
		expect(formatStockCount(1, 1, false)).toBe('Total: 1 stock');
	});

	it('renders plural total count when unfiltered', () => {
		expect(formatStockCount(50, 50, false)).toBe('Total: 50 stocks');
	});

	it('renders plural total and plural filtered counts when filtered', () => {
		expect(formatStockCount(50, 12, true)).toBe('Total: 50 stocks · Filtered: 12 stocks');
	});

	it('renders singular total and singular filtered counts when filtered', () => {
		expect(formatStockCount(1, 1, true)).toBe('Total: 1 stock · Filtered: 1 stock');
	});

	it('renders a singular total with a zero filtered count when filtered', () => {
		expect(formatStockCount(1, 0, true)).toBe('Total: 1 stock · Filtered: 0 stocks');
	});

	it('shows the filtered count even when the filter matches every stock', () => {
		expect(formatStockCount(50, 50, true)).toBe('Total: 50 stocks · Filtered: 50 stocks');
	});
});
