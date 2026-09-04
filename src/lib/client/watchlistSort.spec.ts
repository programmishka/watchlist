import { describe, expect, it } from 'vitest';
import { sortWatchlistStocks, toggleWatchlistSort, type WatchlistSort } from './watchlistSort';
import type { WatchlistStock } from './watchlistApi';

function stock(overrides: Partial<WatchlistStock> & { symbol: string }): WatchlistStock {
	return { dividendYield: 0, ...overrides };
}

describe('sortWatchlistStocks', () => {
	it('preserves input order when no sort is active', () => {
		const stocks = [stock({ symbol: 'C' }), stock({ symbol: 'A' }), stock({ symbol: 'B' })];
		expect(sortWatchlistStocks(stocks, undefined)).toEqual(stocks);
	});

	it('does not mutate the input array', () => {
		const stocks = [
			stock({ symbol: 'SAP.DE' }),
			stock({ symbol: 'AAPL' }),
			stock({ symbol: 'GAW.L' })
		];
		const copy = [...stocks];

		sortWatchlistStocks(stocks, { column: 'symbol', direction: 'asc' });

		expect(stocks).toEqual(copy);
	});

	it('sorts a string column ascending', () => {
		const stocks = [
			stock({ symbol: 'SAP.DE' }),
			stock({ symbol: 'AAPL' }),
			stock({ symbol: 'GAW.L' })
		];
		const sorted = sortWatchlistStocks(stocks, { column: 'symbol', direction: 'asc' });
		expect(sorted.map((s) => s.symbol)).toEqual(['AAPL', 'GAW.L', 'SAP.DE']);
	});

	it('sorts a string column descending', () => {
		const stocks = [
			stock({ symbol: 'SAP.DE' }),
			stock({ symbol: 'AAPL' }),
			stock({ symbol: 'GAW.L' })
		];
		const sorted = sortWatchlistStocks(stocks, { column: 'symbol', direction: 'desc' });
		expect(sorted.map((s) => s.symbol)).toEqual(['SAP.DE', 'GAW.L', 'AAPL']);
	});

	it('sorts strings case-insensitively', () => {
		const stocks = [
			stock({ symbol: 'X', name: 'apple' }),
			stock({ symbol: 'Y', name: 'Banana' }),
			stock({ symbol: 'Z', name: 'APPLE2' })
		];
		const sorted = sortWatchlistStocks(stocks, { column: 'name', direction: 'asc' });
		expect(sorted.map((s) => s.name)).toEqual(['apple', 'APPLE2', 'Banana']);
	});

	it('does not split ticker/exchange when sorting symbols', () => {
		const stocks = [
			stock({ symbol: 'SAP.DE' }),
			stock({ symbol: 'HEXA-B.ST' }),
			stock({ symbol: 'AAPL' }),
			stock({ symbol: 'GAW.L' })
		];
		const sorted = sortWatchlistStocks(stocks, { column: 'symbol', direction: 'asc' });
		expect(sorted.map((s) => s.symbol)).toEqual(['AAPL', 'GAW.L', 'HEXA-B.ST', 'SAP.DE']);
	});

	it('sorts numeric columns ascending', () => {
		const stocks = [
			stock({ symbol: 'A', price: 100 }),
			stock({ symbol: 'B', price: 2 }),
			stock({ symbol: 'C', price: 10 })
		];
		const sorted = sortWatchlistStocks(stocks, { column: 'price', direction: 'asc' });
		expect(sorted.map((s) => s.price)).toEqual([2, 10, 100]);
	});

	it('sorts numeric columns descending', () => {
		const stocks = [
			stock({ symbol: 'A', price: 2 }),
			stock({ symbol: 'B', price: 100 }),
			stock({ symbol: 'C', price: 10 })
		];
		const sorted = sortWatchlistStocks(stocks, { column: 'price', direction: 'desc' });
		expect(sorted.map((s) => s.price)).toEqual([100, 10, 2]);
	});

	it('sorts negative, zero, and positive distance-to-target values numerically', () => {
		const stocks = [
			stock({ symbol: 'A', distanceToTarget: 0.1 }),
			stock({ symbol: 'B', distanceToTarget: -0.2 }),
			stock({ symbol: 'C', distanceToTarget: 0 }),
			stock({ symbol: 'D', distanceToTarget: -0.05 })
		];
		const sorted = sortWatchlistStocks(stocks, { column: 'distanceToTarget', direction: 'asc' });
		expect(sorted.map((s) => s.distanceToTarget)).toEqual([-0.2, -0.05, 0, 0.1]);
	});

	it('sorts missing optional values last ascending', () => {
		const stocks = [
			stock({ symbol: 'A', targetPrice: 100 }),
			stock({ symbol: 'B', targetPrice: undefined }),
			stock({ symbol: 'C', targetPrice: 50 })
		];
		const sorted = sortWatchlistStocks(stocks, { column: 'targetPrice', direction: 'asc' });
		expect(sorted.map((s) => s.symbol)).toEqual(['C', 'A', 'B']);
	});

	it('sorts missing optional values last descending too', () => {
		const stocks = [
			stock({ symbol: 'A', targetPrice: 100 }),
			stock({ symbol: 'B', targetPrice: undefined }),
			stock({ symbol: 'C', targetPrice: 50 })
		];
		const sorted = sortWatchlistStocks(stocks, { column: 'targetPrice', direction: 'desc' });
		expect(sorted.map((s) => s.symbol)).toEqual(['A', 'C', 'B']);
	});

	it('treats zero as a real value, not missing', () => {
		const stocks = [
			stock({ symbol: 'A', distanceToTarget: -0.1 }),
			stock({ symbol: 'B', distanceToTarget: undefined }),
			stock({ symbol: 'C', distanceToTarget: 0 }),
			stock({ symbol: 'D', distanceToTarget: 0.2 })
		];
		const sorted = sortWatchlistStocks(stocks, { column: 'distanceToTarget', direction: 'asc' });
		expect(sorted.map((s) => s.symbol)).toEqual(['A', 'C', 'D', 'B']);
	});

	it('treats non-finite numeric values as missing for presentation sorting', () => {
		const stocks = [
			stock({ symbol: 'A', price: 10 }),
			stock({ symbol: 'B', price: Number.NaN }),
			stock({ symbol: 'C', price: 5 })
		];
		const sorted = sortWatchlistStocks(stocks, { column: 'price', direction: 'asc' });
		expect(sorted.map((s) => s.symbol)).toEqual(['C', 'A', 'B']);
	});

	it('preserves original order for equal sort values (stable sort)', () => {
		const stocks = [
			stock({ symbol: 'AAPL', dividendYield: 0 }),
			stock({ symbol: 'SAP.DE', dividendYield: 0 }),
			stock({ symbol: 'GAW.L', dividendYield: 0 })
		];
		const sorted = sortWatchlistStocks(stocks, { column: 'dividendYield', direction: 'asc' });
		expect(sorted.map((s) => s.symbol)).toEqual(['AAPL', 'SAP.DE', 'GAW.L']);
	});
});

describe('toggleWatchlistSort', () => {
	it('starts ascending when no sort is active', () => {
		expect(toggleWatchlistSort(undefined, 'price')).toEqual({ column: 'price', direction: 'asc' });
	});

	it('toggles ascending to descending on the same column', () => {
		const current: WatchlistSort = { column: 'price', direction: 'asc' };
		expect(toggleWatchlistSort(current, 'price')).toEqual({ column: 'price', direction: 'desc' });
	});

	it('toggles descending back to ascending on the same column', () => {
		const current: WatchlistSort = { column: 'price', direction: 'desc' };
		expect(toggleWatchlistSort(current, 'price')).toEqual({ column: 'price', direction: 'asc' });
	});

	it('starts ascending when switching to a different column', () => {
		const current: WatchlistSort = { column: 'price', direction: 'desc' };
		expect(toggleWatchlistSort(current, 'name')).toEqual({ column: 'name', direction: 'asc' });
	});
});
