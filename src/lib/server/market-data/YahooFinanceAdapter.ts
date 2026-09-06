import YahooFinance from 'yahoo-finance2';
import {
	MarketDataProviderError,
	type MarketDataBatchResult,
	type MarketDataProvider,
	type ResolvedMarketSymbol,
	type StockMarketData
} from './MarketDataProvider';

/**
 * The subset of Yahoo's quote fields this adapter maps. Kept minimal and
 * independent of yahoo-finance2's own `Quote` union type so this file is the
 * only place that needs to understand Yahoo's field names/shape.
 *
 * `quoteType` (TASK-030) is the verified Yahoo discriminator field
 * (`quote.schema.d.ts`/`quote.d.ts` in the installed `yahoo-finance2@4.0.2`)
 * used only inside `resolveSymbol()` below to distinguish a supported
 * `"EQUITY"` from other instrument classes (`ETF`, `MUTUALFUND`, `OPTION`,
 * `FUTURE`, `INDEX`, `CRYPTOCURRENCY`, `CURRENCY`, ...); it is never mapped
 * into `StockMarketData` or exposed outside this adapter.
 */
interface YahooQuoteFields {
	symbol: string;
	quoteType?: string;
	longName?: string;
	regularMarketPrice?: number;
	currency?: string;
	trailingAnnualDividendRate?: number;
	marketCap?: number;
}

/**
 * The slice of yahoo-finance2's client this adapter depends on. Declared
 * locally (rather than importing yahoo-finance2's class type) so tests can
 * supply a fake without touching the network. `quote(symbol)` is typed to
 * resolve to `undefined` for an unknown symbol — yahoo-finance2's own types
 * claim `Promise<Quote>`, but TASK-002 empirically found it resolves to
 * `undefined` instead of throwing (see docs/spikes/002-yahoo-finance.md).
 */
export interface YahooQuoteClient {
	quote(symbol: string): Promise<YahooQuoteFields | undefined>;
	quote(symbols: string[]): Promise<YahooQuoteFields[]>;
}

function createDefaultClient(): YahooQuoteClient {
	return new YahooFinance({ suppressNotices: ['yahooSurvey'] });
}

function mapYahooQuote(quote: YahooQuoteFields): StockMarketData {
	return {
		symbol: quote.symbol,
		name: quote.longName,
		price: quote.regularMarketPrice,
		currency: quote.currency,
		annualDividend: quote.trailingAnnualDividendRate,
		marketCap: quote.marketCap
	};
}

export class YahooFinanceAdapter implements MarketDataProvider {
	constructor(private readonly client: YahooQuoteClient = createDefaultClient()) {}

	async getQuote(symbol: string): Promise<StockMarketData | undefined> {
		let quote: YahooQuoteFields | undefined;
		try {
			quote = await this.client.quote(symbol);
		} catch (error) {
			throw new MarketDataProviderError(`Failed to retrieve market data for symbol "${symbol}"`, {
				cause: error
			});
		}

		return quote ? mapYahooQuote(quote) : undefined;
	}

	async resolveSymbol(symbol: string): Promise<ResolvedMarketSymbol | undefined> {
		let quote: YahooQuoteFields | undefined;
		try {
			quote = await this.client.quote(symbol);
		} catch (error) {
			throw new MarketDataProviderError(`Failed to resolve symbol "${symbol}"`, {
				cause: error
			});
		}

		if (!quote || quote.symbol !== symbol || quote.quoteType !== 'EQUITY') {
			return undefined;
		}

		return { symbol: quote.symbol };
	}

	async getQuotes(symbols: string[]): Promise<MarketDataBatchResult> {
		if (symbols.length === 0) {
			return { found: [], missing: [] };
		}

		let quotes: YahooQuoteFields[];
		try {
			quotes = await this.client.quote(symbols);
		} catch (error) {
			throw new MarketDataProviderError('Failed to retrieve market data batch', {
				cause: error
			});
		}

		const found = quotes.map(mapYahooQuote);
		const foundSymbols = new Set(found.map((quote) => quote.symbol));
		const missing = symbols.filter((symbol) => !foundSymbols.has(symbol));

		return { found, missing };
	}
}
