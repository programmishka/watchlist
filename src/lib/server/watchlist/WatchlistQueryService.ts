import { calculateDividendYield } from '../domain/dividendYield';
import { calculateTargetPriceDistance } from '../domain/investmentAllocation';
import {
	ExchangeRateProviderError,
	type ExchangeRateProvider
} from '../exchange-rates/ExchangeRateProvider';
import {
	calculateMarketCapInBillionsUsd,
	mapMarketCurrencyToFxCurrency
} from '../exchange-rates/marketCapConversion';
import type { MarketDataProvider } from '../market-data/MarketDataProvider';
import type { TargetPriceRepository } from '../persistence/TargetPriceRepository';
import type { WatchlistRepository } from '../persistence/WatchlistRepository';
import { WatchlistNotFoundError } from './WatchlistServiceErrors';
import type { WatchlistQueryWarning, WatchlistStock, WatchlistView } from './WatchlistView';

export class WatchlistQueryService {
	constructor(
		private readonly watchlistRepository: WatchlistRepository,
		private readonly targetPriceRepository: TargetPriceRepository,
		private readonly marketDataProvider: MarketDataProvider,
		private readonly exchangeRateProvider: ExchangeRateProvider
	) {}

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
			const price = marketData?.price;
			const currency = marketData?.currency;
			const targetPrice = targetPrices[symbol];

			const marketCapResult = calculateMarketCapInBillionsUsd(
				marketData?.marketCap,
				currency,
				ratesToUsd
			);

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
