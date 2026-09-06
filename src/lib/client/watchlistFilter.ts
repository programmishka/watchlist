import type { WatchlistStock } from './watchlistApi';

/**
 * Maximum length of the local company-name filter (TASK-038). UX-only —
 * the filter never crosses the network, so this is not a security control
 * (see `docs/security/input-boundary-audit.md` §8).
 */
export const MAX_COMPANY_NAME_FILTER_LENGTH = 100;

/**
 * Case-insensitive substring match on `stock.name` only (TASK-022 §4-9).
 * An empty/whitespace-only filter matches everything; a stock with no
 * company name can never match a non-empty filter. An over-limit filter
 * (e.g. supplied programmatically, bypassing the input's `maxlength`) is
 * truncated to `MAX_COMPANY_NAME_FILTER_LENGTH` before matching, so this
 * helper behaves predictably regardless of caller (TASK-038).
 */
export function filterStocksByCompanyName(
	stocks: WatchlistStock[],
	filter: string
): WatchlistStock[] {
	const normalizedFilter = filter.trim().slice(0, MAX_COMPANY_NAME_FILTER_LENGTH).toLowerCase();
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
