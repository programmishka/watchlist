import type { MarketDataProvider } from '../market-data/MarketDataProvider';
import type { WatchlistsDocument } from '../persistence/WatchlistRepository';
import { InvalidSymbolError, UnknownStockSymbolError } from './WatchlistServiceErrors';
import type { WatchlistService } from './WatchlistService';

/**
 * Validates a user-supplied symbol through `MarketDataProvider` before
 * adding it, closing the gap `WatchlistService.addSymbol()` intentionally
 * leaves open (TASK-009): it persists any well-formed symbol string without
 * checking Yahoo recognizes it. All Watchlist mutation rules (duplicate
 * detection, Watchlist lookup, persistence) remain owned by `WatchlistService`.
 */
export class AddStockToWatchlistService {
	constructor(
		private readonly marketDataProvider: MarketDataProvider,
		private readonly watchlistService: WatchlistService
	) {}

	async addStock(userId: string, watchlistId: string, symbol: string): Promise<WatchlistsDocument> {
		const trimmedSymbol = symbol.trim();
		if (trimmedSymbol.length === 0) {
			throw new InvalidSymbolError(symbol);
		}

		const marketData = await this.marketDataProvider.getQuote(trimmedSymbol);
		if (!marketData) {
			throw new UnknownStockSymbolError(trimmedSymbol);
		}

		return this.watchlistService.addSymbol(userId, watchlistId, trimmedSymbol);
	}
}
