import { FrankfurterAdapter } from '../exchange-rates/FrankfurterAdapter';
import type { ExchangeRateProvider } from '../exchange-rates/ExchangeRateProvider';
import { YahooFinanceAdapter } from '../market-data/YahooFinanceAdapter';
import type { MarketDataProvider } from '../market-data/MarketDataProvider';
import { InvestmentAllocationService } from '../investment-allocation/InvestmentAllocationService';
import { CloudflareKvTargetPriceRepository } from '../persistence/CloudflareKvTargetPriceRepository';
import { CloudflareKvWatchlistRepository } from '../persistence/CloudflareKvWatchlistRepository';
import { TargetPriceService } from '../target-price/TargetPriceService';
import { AddStockToWatchlistService } from '../watchlist/AddStockToWatchlistService';
import { WatchlistQueryService } from '../watchlist/WatchlistQueryService';
import { WatchlistService } from '../watchlist/WatchlistService';

/** Thrown when the Cloudflare platform bindings required to construct services are unavailable. Maps to HTTP 500. */
export class PlatformUnavailableError extends Error {
	constructor() {
		super(
			'The Cloudflare platform bindings required to construct application services are unavailable.'
		);
		this.name = 'PlatformUnavailableError';
	}
}

export interface ApplicationServices {
	watchlistService: WatchlistService;
	targetPriceService: TargetPriceService;
	addStockToWatchlistService: AddStockToWatchlistService;
	watchlistQueryService: WatchlistQueryService;
	investmentAllocationService: InvestmentAllocationService;
	/** Exposed directly for the Target Price route's post-save distance refresh (TASK-013 §18/§19). */
	marketDataProvider: MarketDataProvider;
}

/**
 * The application composition root. Constructs one request-scoped instance
 * of each concrete repository/provider/service from the current request's
 * Cloudflare platform bindings — never a mutable global, never a fallback
 * that silently bypasses the real KV binding.
 */
export function createApplicationServices(platform: App.Platform | undefined): ApplicationServices {
	const kv = platform?.env?.WATCHLIST_KV;
	if (!kv) {
		throw new PlatformUnavailableError();
	}

	const watchlistRepository = new CloudflareKvWatchlistRepository(kv);
	const targetPriceRepository = new CloudflareKvTargetPriceRepository(kv);
	const marketDataProvider: MarketDataProvider = new YahooFinanceAdapter();
	const exchangeRateProvider: ExchangeRateProvider = new FrankfurterAdapter();

	const watchlistService = new WatchlistService(watchlistRepository);
	const targetPriceService = new TargetPriceService(targetPriceRepository);
	const addStockToWatchlistService = new AddStockToWatchlistService(
		marketDataProvider,
		watchlistService
	);
	const watchlistQueryService = new WatchlistQueryService(
		watchlistRepository,
		targetPriceRepository,
		marketDataProvider,
		exchangeRateProvider
	);
	// Reuses the same watchlistQueryService instance above — no second
	// WatchlistQueryService/repository/provider graph is constructed solely
	// for investment allocation (TASK-015 §6).
	const investmentAllocationService = new InvestmentAllocationService(watchlistQueryService);

	return {
		watchlistService,
		targetPriceService,
		addStockToWatchlistService,
		watchlistQueryService,
		investmentAllocationService,
		marketDataProvider
	};
}
