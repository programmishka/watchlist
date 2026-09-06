import type { MarketDataProvider } from '../market-data/MarketDataProvider';
import type { WatchlistsDocument } from '../persistence/WatchlistRepository';
import { parseStockSymbol } from '../../shared/stockSymbol';
import { InvalidSymbolError, UnknownStockSymbolError } from './WatchlistServiceErrors';
import type { WatchlistService } from './WatchlistService';

/**
 * Validates a user-supplied symbol through `MarketDataProvider` before
 * adding it, closing the gap `WatchlistService.addSymbol()` intentionally
 * leaves open (TASK-009): it persists any well-formed symbol string without
 * checking Yahoo recognizes it. All Watchlist mutation rules (duplicate
 * detection, Watchlist lookup, persistence) remain owned by `WatchlistService`.
 *
 * TASK-029 supersedes TASK-012's no-canonicalization/no-case-normalization
 * decision: the input is normalized (trimmed, uppercased) and syntactically
 * validated before it ever reaches the provider, and that normalized symbol
 * — not the raw input — is what the provider validates and `WatchlistService`
 * persists.
 */
export class AddStockToWatchlistService {
	constructor(
		private readonly marketDataProvider: MarketDataProvider,
		private readonly watchlistService: WatchlistService
	) {}

	async addStock(userId: string, watchlistId: string, symbol: string): Promise<WatchlistsDocument> {
		const parsed = parseStockSymbol(symbol);
		if (!parsed.valid) {
			throw new InvalidSymbolError(symbol);
		}

		const marketData = await this.marketDataProvider.getQuote(parsed.symbol);
		if (!marketData) {
			throw new UnknownStockSymbolError(parsed.symbol);
		}

		return this.watchlistService.addSymbol(userId, watchlistId, parsed.symbol);
	}
}
