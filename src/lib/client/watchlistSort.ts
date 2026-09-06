import type { WatchlistStock } from './watchlistApi';

export type WatchlistSortColumn =
	| 'symbol'
	| 'name'
	| 'marketCapBillionsUsd'
	| 'price'
	| 'dividendYield'
	| 'currency'
	| 'targetPrice'
	| 'distanceToTarget';

export type SortDirection = 'asc' | 'desc';

export interface WatchlistSort {
	column: WatchlistSortColumn;
	direction: SortDirection;
}

/**
 * Central default presentation sort (TASK-032): every newly active Watchlist
 * starts sorted by company Name ascending, as a real active sort state
 * rather than an unsorted table. Frozen so the shared reference can't be
 * mutated by a caller.
 */
export const DEFAULT_WATCHLIST_SORT: WatchlistSort = Object.freeze({
	column: 'name',
	direction: 'asc'
});

/** Columns compared as locale-aware, case-insensitive strings (TASK-023 §7-11); all other sortable columns are numeric. */
const STRING_COLUMNS: ReadonlySet<WatchlistSortColumn> = new Set(['symbol', 'name', 'currency']);

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

function getSortValue(
	stock: WatchlistStock,
	column: WatchlistSortColumn
): string | number | undefined {
	switch (column) {
		case 'symbol':
			return stock.symbol;
		case 'name':
			return stock.name;
		case 'marketCapBillionsUsd':
			return stock.marketCapBillionsUsd;
		case 'price':
			return stock.price;
		case 'dividendYield':
			return stock.dividendYield;
		case 'currency':
			return stock.currency;
		case 'targetPrice':
			return stock.targetPrice;
		case 'distanceToTarget':
			return stock.distanceToTarget;
	}
}

/**
 * Missing values always sort last regardless of direction (TASK-023 §16), so
 * only the comparison of two present values is flipped by `direction`.
 */
function compareWithMissingLast<T>(
	a: T | undefined,
	b: T | undefined,
	isMissing: (value: T | undefined) => boolean,
	compare: (a: T, b: T) => number,
	direction: SortDirection
): number {
	const aMissing = isMissing(a);
	const bMissing = isMissing(b);
	if (aMissing && bMissing) {
		return 0;
	}
	if (aMissing) {
		return 1;
	}
	if (bMissing) {
		return -1;
	}
	const result = compare(a as T, b as T);
	return direction === 'asc' ? result : -result;
}

function isMissingString(value: string | undefined): boolean {
	return value === undefined;
}

/** Treats non-finite numbers as missing (TASK-023 §18) without altering the source stock. */
function isMissingNumber(value: number | undefined): boolean {
	return value === undefined || !Number.isFinite(value);
}

/**
 * Sorts already-filtered watchlist stocks for display (TASK-023). Returns a
 * new array and never mutates `stocks`. With no active sort, the input order
 * is preserved.
 */
export function sortWatchlistStocks(
	stocks: WatchlistStock[],
	sort: WatchlistSort | undefined
): WatchlistStock[] {
	if (!sort) {
		return stocks;
	}

	const { column, direction } = sort;
	const isStringColumn = STRING_COLUMNS.has(column);

	return stocks
		.map((stock, index) => ({ stock, index }))
		.sort((a, b) => {
			const comparison = isStringColumn
				? compareWithMissingLast(
						getSortValue(a.stock, column) as string | undefined,
						getSortValue(b.stock, column) as string | undefined,
						isMissingString,
						(x, y) => collator.compare(x, y),
						direction
					)
				: compareWithMissingLast(
						getSortValue(a.stock, column) as number | undefined,
						getSortValue(b.stock, column) as number | undefined,
						isMissingNumber,
						(x, y) => x - y,
						direction
					);

			return comparison !== 0 ? comparison : a.index - b.index;
		})
		.map(({ stock }) => stock);
}

/**
 * First activation of a column sorts ascending; activating the already-active
 * column toggles direction; activating another column resets to ascending
 * (TASK-023 §3-5). There is no third/unsorted state once a column is active.
 */
export function toggleWatchlistSort(
	current: WatchlistSort | undefined,
	column: WatchlistSortColumn
): WatchlistSort {
	if (current && current.column === column) {
		return { column, direction: current.direction === 'asc' ? 'desc' : 'asc' };
	}
	return { column, direction: 'asc' };
}
