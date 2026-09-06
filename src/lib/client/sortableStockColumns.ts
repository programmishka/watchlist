import type { WatchlistSortColumn } from './watchlistSort';

export interface SortableStockColumn {
	key: WatchlistSortColumn;
	label: string;
	numeric: boolean;
}

/**
 * The eight sortable stock-data columns (§13.1), shared between
 * `WatchlistTable`'s sortable headers and `WatchlistCards`' compact sort
 * control (TASK-036 §48-49) so the two presentations cannot drift apart on
 * which columns are sortable or how they are labelled. `Actions`/`Savings
 * Amount` are deliberately excluded — neither is sortable in the table.
 */
export const SORTABLE_STOCK_COLUMNS: SortableStockColumn[] = [
	{ key: 'symbol', label: 'Symbol', numeric: false },
	{ key: 'name', label: 'Name', numeric: false },
	{ key: 'marketCapBillionsUsd', label: 'Market Cap (USD bn)', numeric: true },
	{ key: 'price', label: 'Price', numeric: true },
	{ key: 'currency', label: 'Currency', numeric: false },
	{ key: 'dividendYield', label: 'Dividend Yield', numeric: true },
	{ key: 'targetPrice', label: 'Target Price', numeric: true },
	{ key: 'distanceToTarget', label: 'Distance to Target', numeric: true }
];
