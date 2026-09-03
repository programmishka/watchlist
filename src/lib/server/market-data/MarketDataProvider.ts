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
}
