/** Positional domain calculation results (TASK-003) associated back to their stock symbol. */
export interface StockAllocation {
	symbol: string;
	factor: number;
	savingsAmount: number;
}

/**
 * A temporary, unpersisted result of distributing `totalSavings` across all
 * stocks in one Watchlist. `allocations` preserves the Watchlist's stock
 * order. No `warnings` field: allocation correctness never depends on
 * market-cap/FX availability (see ARCHITECTURE.md), so forwarding
 * `WatchlistView.warnings` here would carry information this result has no
 * concrete use for.
 */
export interface InvestmentAllocation {
	totalSavings: number;
	invested: number;
	allocations: StockAllocation[];
}
