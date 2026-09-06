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
 * Renders the count footer text (TASK-022 §26-29, reworded by TASK-033
 * §39-47 for explicit `Total`/`Filtered` wording). Total and Filtered are
 * pluralized independently of each other.
 */
export function formatStockCount(
	totalCount: number,
	filteredCount: number,
	isFiltered: boolean
): string {
	const totalText = `Total: ${totalCount} ${pluralizeStocks(totalCount)}`;
	if (!isFiltered) {
		return totalText;
	}
	return `${totalText} · Filtered: ${filteredCount} ${pluralizeStocks(filteredCount)}`;
}
