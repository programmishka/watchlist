import { NoopDiagnosticLogger, type DiagnosticLogger } from '../diagnostics/DiagnosticLogger';
import { calculateDividendYield } from '../domain/dividendYield';
import { calculateTargetPriceDistance } from '../domain/investmentAllocation';
import {
	ExchangeRateProviderError,
	type ExchangeRateProvider
} from '../exchange-rates/ExchangeRateProvider';
import {
	calculateMarketCapInBillionsUsd,
	mapMarketCurrencyToFxCurrency,
	type MarketCapConversionResult
} from '../exchange-rates/marketCapConversion';
import type { MarketDataProvider, StockMarketData } from '../market-data/MarketDataProvider';
import type { TargetPriceRepository } from '../persistence/TargetPriceRepository';
import type { WatchlistRepository } from '../persistence/WatchlistRepository';
import { WatchlistNotFoundError } from './WatchlistServiceErrors';
import type { WatchlistQueryWarning, WatchlistStock, WatchlistView } from './WatchlistView';

/** The `StockMarketData` fields whose absence is worth diagnosing (TASK-040 §22-26). */
const DIAGNOSABLE_MARKET_DATA_FIELDS = ['price', 'marketCap', 'currency'] as const;

export class WatchlistQueryService {
	constructor(
		private readonly watchlistRepository: WatchlistRepository,
		private readonly targetPriceRepository: TargetPriceRepository,
		private readonly marketDataProvider: MarketDataProvider,
		private readonly exchangeRateProvider: ExchangeRateProvider,
		private readonly logger: DiagnosticLogger = new NoopDiagnosticLogger()
	) {}

	/** Emits `market_data_incomplete` for a missing quote or missing optional fields; never for a complete quote. */
	private logMarketDataIncompleteIfAny(
		symbol: string,
		marketData: StockMarketData | undefined
	): void {
		if (!marketData) {
			this.logger.warn('market_data_incomplete', { symbol, reason: 'provider_quote_missing' });
			return;
		}

		const missingFields = DIAGNOSABLE_MARKET_DATA_FIELDS.filter(
			(field) => marketData[field] === undefined
		);
		if (missingFields.length > 0) {
			this.logger.warn('market_data_incomplete', {
				symbol,
				missingFields,
				reason: 'provider_field_missing'
			});
		}
	}

	/** Emits `market_cap_conversion_unavailable`/`market_data_composition_anomaly` for an unavailable market-cap result. */
	private logMarketCapUnavailableIfAnomalous(
		symbol: string,
		currency: string | undefined,
		marketCapResult: MarketCapConversionResult
	): void {
		if (marketCapResult.status !== 'unavailable') {
			return;
		}

		if (
			marketCapResult.reason === 'unsupported-currency' ||
			marketCapResult.reason === 'invalid-exchange-rate'
		) {
			// `currency` is defined here: both reasons are only reachable once the
			// currency itself is present (marketCapConversion.ts checks `missing-currency` first).
			this.logger.warn('market_cap_conversion_unavailable', {
				symbol,
				fromCurrency: mapMarketCurrencyToFxCurrency(currency as string),
				toCurrency: 'USD',
				reason:
					marketCapResult.reason === 'unsupported-currency'
						? 'fx_rate_missing'
						: 'invalid_exchange_rate'
			});
		} else if (marketCapResult.reason === 'invalid-market-cap') {
			// marketCap/currency/rate were all present in some form, yet the
			// defensive numeric check still rejected the result — an anomaly
			// distinct from routine upstream-missing-data warnings (§33 TASK-040).
			this.logger.error('market_data_composition_anomaly', {
				symbol,
				reason: 'invalid_numeric_result'
			});
		}
		// 'missing-market-cap' / 'missing-currency' are already covered by
		// logMarketDataIncompleteIfAny above — not logged again here.
	}

	async getWatchlist(userId: string, watchlistId: string): Promise<WatchlistView> {
		const [watchlistsDocument, targetPrices] = await Promise.all([
			this.watchlistRepository.get(userId),
			this.targetPriceRepository.get(userId)
		]);

		const watchlist = watchlistsDocument.watchlists.find((w) => w.id === watchlistId);
		if (!watchlist) {
			throw new WatchlistNotFoundError(watchlistId);
		}

		if (watchlist.symbols.length === 0) {
			return { id: watchlist.id, name: watchlist.name, stocks: [], warnings: [] };
		}

		const { found } = await this.marketDataProvider.getQuotes(watchlist.symbols);
		const marketDataBySymbol = new Map(found.map((data) => [data.symbol, data]));

		const requiredCurrencies = [
			...new Set(
				found
					.filter((data) => data.marketCap !== undefined && data.currency !== undefined)
					.map((data) => mapMarketCurrencyToFxCurrency(data.currency as string))
			)
		];

		const warnings: WatchlistQueryWarning[] = [];
		let ratesToUsd: Record<string, number> = {};
		if (requiredCurrencies.length > 0) {
			try {
				ratesToUsd = (await this.exchangeRateProvider.getRatesToUsd(requiredCurrencies)).ratesToUsd;
			} catch (error) {
				if (!(error instanceof ExchangeRateProviderError)) {
					throw error;
				}
				// Global FX outage: degrade gracefully rather than failing the whole
				// query. USD needs no external rate, so USD market caps still convert;
				// every other currency becomes "unsupported" for this query.
				warnings.push('fx-provider-unavailable');
				ratesToUsd = { USD: 1 };
			}
		}

		const stocks: WatchlistStock[] = watchlist.symbols.map((symbol) => {
			const marketData = marketDataBySymbol.get(symbol);
			this.logMarketDataIncompleteIfAny(symbol, marketData);

			const price = marketData?.price;
			const currency = marketData?.currency;
			const targetPrice = targetPrices[symbol];

			const marketCapResult = calculateMarketCapInBillionsUsd(
				marketData?.marketCap,
				currency,
				ratesToUsd
			);
			this.logMarketCapUnavailableIfAnomalous(symbol, currency, marketCapResult);

			return {
				symbol,
				name: marketData?.name,
				price,
				currency,
				targetPrice,
				distanceToTarget: calculateTargetPriceDistance(price, targetPrice),
				dividendYield: calculateDividendYield(marketData?.annualDividend, price, currency),
				marketCapBillionsUsd:
					marketCapResult.status === 'converted' ? marketCapResult.billionsUsd : undefined
			};
		});

		return { id: watchlist.id, name: watchlist.name, stocks, warnings };
	}
}
