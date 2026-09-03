/**
 * Deliberately not shared with `WatchlistServiceErrors.InvalidSymbolError`,
 * even though the validation rule is identical, so `TargetPriceService`
 * stays free of any import from the `watchlist` module (see TASK-010 §13:
 * this service must not depend on Watchlist code).
 */
export class InvalidSymbolError extends Error {
	constructor(symbol: string) {
		super(`Symbol must not be empty or whitespace-only. Received: ${JSON.stringify(symbol)}`);
		this.name = 'InvalidSymbolError';
	}
}

export class InvalidTargetPriceError extends Error {
	constructor(targetPrice: number) {
		super(`Target price must be a finite number greater than 0. Received: ${targetPrice}`);
		this.name = 'InvalidTargetPriceError';
	}
}
