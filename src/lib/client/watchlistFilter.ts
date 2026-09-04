import type { WatchlistStock } from './watchlistApi';

/**
 * Case-insensitive substring match on `stock.name` only (TASK-022 §4-9).
 * An empty/whitespace-only filter matches everything; a stock with no
 * company name can never match a non-empty filter.
 */
export function filterStocksByCompanyName(
	stocks: WatchlistStock[],
	filter: string
): WatchlistStock[] {
	const normalizedFilter = filter.trim().toLowerCase();
	if (!normalizedFilter) {
		return stocks;
	}
	return stocks.filter((stock) => stock.name?.toLowerCase().includes(normalizedFilter) ?? false);
}

function pluralizeStocks(count: number): string {
	return count === 1 ? 'stock' : 'stocks';
}

/**
 * Renders the count footer text (TASK-022 §26-29). Pluralization follows
 * `totalCount` in both the unfiltered and filtered representation.
 */
export function formatStockCount(
	totalCount: number,
	filteredCount: number,
	isFiltered: boolean
): string {
	const label = pluralizeStocks(totalCount);
	if (!isFiltered) {
		return `${totalCount} ${label}`;
	}
	return `${filteredCount} of ${totalCount} ${label}`;
}
