export class InvalidWatchlistNameError extends Error {
	constructor(name: string) {
		super(`Watchlist name must not be empty or whitespace-only. Received: ${JSON.stringify(name)}`);
		this.name = 'InvalidWatchlistNameError';
	}
}

export class WatchlistNotFoundError extends Error {
	constructor(watchlistId: string) {
		super(`Watchlist not found: ${watchlistId}`);
		this.name = 'WatchlistNotFoundError';
	}
}

export class NoActiveWatchlistError extends Error {
	constructor() {
		super('There is no active Watchlist to delete');
		this.name = 'NoActiveWatchlistError';
	}
}

/**
 * Covers both empty/whitespace-only input and, since TASK-029, symbols that
 * fail the stock-symbol syntax grammar (see `$lib/shared/stockSymbol.ts`).
 */
export class InvalidSymbolError extends Error {
	constructor(symbol: string) {
		super(`Symbol has invalid syntax. Received: ${JSON.stringify(symbol)}`);
		this.name = 'InvalidSymbolError';
	}
}

export class DuplicateSymbolError extends Error {
	constructor(symbol: string, watchlistId: string) {
		super(`Symbol "${symbol}" already exists in Watchlist ${watchlistId}`);
		this.name = 'DuplicateSymbolError';
	}
}

export class SymbolNotFoundError extends Error {
	constructor(symbol: string, watchlistId: string) {
		super(`Symbol "${symbol}" not found in Watchlist ${watchlistId}`);
		this.name = 'SymbolNotFoundError';
	}
}

/**
 * The market-data provider successfully answered but did not resolve the
 * symbol as a supported equity (TASK-030) — covers both an unrecognized
 * symbol and a symbol the provider knows but classifies as a non-equity
 * instrument (ETF, fund, option, etc.); the caller does not distinguish
 * these. Distinct from `MarketDataProviderError`, which means the provider
 * itself is unavailable/failed.
 */
export class UnknownStockSymbolError extends Error {
	constructor(symbol: string) {
		super(`Unknown stock symbol: ${symbol}`);
		this.name = 'UnknownStockSymbolError';
	}
}

/**
 * Thrown when a Watchlist has already reached `MAX_STOCKS_PER_WATCHLIST`
 * (TASK-038). Distinct from `DuplicateSymbolError` — this covers a full
 * Watchlist regardless of whether the attempted symbol is itself new.
 */
export class WatchlistStockLimitReachedError extends Error {
	constructor(watchlistId: string) {
		super(`Watchlist ${watchlistId} has reached its maximum stock capacity.`);
		this.name = 'WatchlistStockLimitReachedError';
	}
}
