/**
 * Provider-sourced market information for a single symbol. Represents raw
 * externally-supplied data only — no target prices, calculated distances,
 * dividend yields, investment factors, savings amounts, or converted USD
 * market cap belong here (see ARCHITECTURE.md §9.4/§9.5).
 */
export interface StockMarketData {
	symbol: string;
	name?: string;
	price?: number;
	currency?: string;
	annualDividend?: number;
	marketCap?: number;
}

export interface MarketDataBatchResult {
	/** Symbols the provider successfully resolved, mapped to application-owned data. */
	found: StockMarketData[];
	/** Requested symbols the provider did not return a result for. */
	missing: string[];
}

/**
 * Provider-neutral admission result for TASK-030 equity resolution. Kept
 * deliberately small — no `quoteType`, exchange metadata, names, or other
 * provider response detail — because it exists only to confirm "this exact
 * symbol is a supported equity", not to carry market data (see
 * `StockMarketData`/`getQuote` for that).
 */
export interface ResolvedMarketSymbol {
	symbol: string;
}

/**
 * Thrown when the underlying market-data provider itself fails (network,
 * outage, unexpected response) — distinct from an individual unknown symbol,
 * which is represented as a normal "not found" result instead of a throw.
 */
export class MarketDataProviderError extends Error {
	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = 'MarketDataProviderError';
	}
}

export interface MarketDataProvider {
	/** Resolves to `undefined` when the symbol is unknown, never for a provider failure. */
	getQuote(symbol: string): Promise<StockMarketData | undefined>;
	/** Uses the provider's batch capability; requested symbols it doesn't return are listed in `missing`. */
	getQuotes(symbols: string[]): Promise<MarketDataBatchResult>;
	/**
	 * TASK-030 admission check for adding a new stock: resolves only when the
	 * exact requested symbol represents a supported equity instrument.
	 * Resolves to `undefined` when the symbol is unknown OR resolves only to
	 * an unsupported (non-equity) instrument — the caller cannot and need not
	 * distinguish those two cases. Never used for ordinary Watchlist loading
	 * (that remains `getQuote`/`getQuotes`).
	 */
	resolveSymbol(symbol: string): Promise<ResolvedMarketSymbol | undefined>;
}
