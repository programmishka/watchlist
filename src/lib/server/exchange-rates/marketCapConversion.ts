import type { StockMarketData } from '../market-data/MarketDataProvider';
import type { ExchangeRateProvider } from './ExchangeRateProvider';

export type MarketCapConversionResult =
	| { status: 'converted'; billionsUsd: number }
	| {
			status: 'unavailable';
			reason:
				| 'missing-market-cap'
				| 'invalid-market-cap'
				| 'missing-currency'
				| 'unsupported-currency'
				| 'invalid-exchange-rate';
	  };

export interface StockMarketCapUsd {
	symbol: string;
	marketCap: MarketCapConversionResult;
}

/**
 * Yahoo may report a market currency of "GBp" (pence), but TASK-002 found
 * this does not mean `marketCap` itself is pence-denominated. For market-cap
 * FX purposes only, GBp maps to the ISO currency GBP with no value scaling.
 * This must not be generalized to price/dividend fields (a later task).
 */
export function mapMarketCurrencyToFxCurrency(currency: string): string {
	return currency === 'GBp' ? 'GBP' : currency;
}

export function calculateMarketCapInBillionsUsd(
	marketCap: number | undefined,
	currency: string | undefined,
	ratesToUsd: Record<string, number>
): MarketCapConversionResult {
	if (marketCap === undefined) {
		return { status: 'unavailable', reason: 'missing-market-cap' };
	}
	if (!Number.isFinite(marketCap)) {
		return { status: 'unavailable', reason: 'invalid-market-cap' };
	}
	if (currency === undefined) {
		return { status: 'unavailable', reason: 'missing-currency' };
	}

	const rate = ratesToUsd[mapMarketCurrencyToFxCurrency(currency)];
	if (rate === undefined) {
		return { status: 'unavailable', reason: 'unsupported-currency' };
	}
	if (!Number.isFinite(rate) || rate <= 0) {
		return { status: 'unavailable', reason: 'invalid-exchange-rate' };
	}

	const marketCapInUsd = marketCap * rate;
	if (!Number.isFinite(marketCapInUsd)) {
		return { status: 'unavailable', reason: 'invalid-market-cap' };
	}

	return { status: 'converted', billionsUsd: marketCapInUsd / 1_000_000_000 };
}

/**
 * Converts market caps for a collection of stocks using a single exchange-
 * rate request for all distinct required currencies (never one request per
 * stock). Propagates `ExchangeRateProviderError` on a total provider
 * failure; recovering partial (non-FX-dependent) stock data from that
 * failure is left to a future application/composition layer.
 */
export async function calculateMarketCapsInBillionsUsd(
	stocks: Pick<StockMarketData, 'symbol' | 'marketCap' | 'currency'>[],
	exchangeRateProvider: ExchangeRateProvider
): Promise<StockMarketCapUsd[]> {
	const requiredCurrencies = [
		...new Set(
			stocks
				.map((stock) => stock.currency)
				.filter((currency): currency is string => currency !== undefined)
				.map(mapMarketCurrencyToFxCurrency)
		)
	];

	const { ratesToUsd } = await exchangeRateProvider.getRatesToUsd(requiredCurrencies);

	return stocks.map((stock) => ({
		symbol: stock.symbol,
		marketCap: calculateMarketCapInBillionsUsd(stock.marketCap, stock.currency, ratesToUsd)
	}));
}
