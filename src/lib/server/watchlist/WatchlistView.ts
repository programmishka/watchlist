/**
 * Display-ready stock data for one Watchlist entry. Does not include
 * `factor`/`savingsAmount`/`invested` — those belong to the separate,
 * user-triggered investment-allocation workflow, not the normal query.
 */
export interface WatchlistStock {
	symbol: string;
	name?: string;
	price?: number;
	/** The stock's raw market-data currency (e.g. "GBp"), not the FX-normalized code used internally for market-cap conversion. */
	currency?: string;
	targetPrice?: number;
	/**
	 * Undefined when the distance cannot be calculated (missing/invalid price
	 * or Target Price, TASK-031 §4) — never a fabricated `0`. A real `0` means
	 * current price exactly equals Target Price.
	 */
	distanceToTarget?: number;
	dividendYield: number;
	marketCapBillionsUsd?: number;
}

/** A missing individual market cap/FX rate is represented per-stock (`marketCapBillionsUsd: undefined`), not as a warning. */
export type WatchlistQueryWarning = 'fx-provider-unavailable';

export interface WatchlistView {
	id: string;
	name: string;
	stocks: WatchlistStock[];
	warnings: WatchlistQueryWarning[];
}
