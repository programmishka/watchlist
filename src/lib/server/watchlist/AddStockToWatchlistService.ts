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
 *
 * TASK-030 supersedes TASK-012's `getQuote`-based admission check with
 * `resolveSymbol()`: a symbol is only admitted when the provider confirms it
 * is a supported equity, not merely that it exists. `resolveSymbol()`
 * returning `undefined` covers both "unknown symbol" and "known but
 * unsupported instrument" — the service does not and must not distinguish
 * them, both surface as `UnknownStockSymbolError`.
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

		const resolved = await this.marketDataProvider.resolveSymbol(parsed.symbol);
		if (!resolved) {
			throw new UnknownStockSymbolError(parsed.symbol);
		}

		return this.watchlistService.addSymbol(userId, watchlistId, parsed.symbol);
	}
}
