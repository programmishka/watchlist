import type {
	Watchlist,
	WatchlistRepository,
	WatchlistsDocument
} from '../persistence/WatchlistRepository';
import { isValidWatchlistName } from '../../shared/watchlistName';
import {
	DuplicateSymbolError,
	InvalidSymbolError,
	InvalidWatchlistNameError,
	NoActiveWatchlistError,
	SymbolNotFoundError,
	WatchlistNotFoundError,
	WatchlistStockLimitReachedError
} from './WatchlistServiceErrors';

export interface CreateWatchlistResult {
	watchlist: Watchlist;
	document: WatchlistsDocument;
}

/**
 * Maximum number of stocks a single Watchlist may contain (TASK-038). Bounds
 * provider/application work, persistence growth, and composition/allocation/
 * rendering workload for a single Watchlist.
 */
export const MAX_STOCKS_PER_WATCHLIST = 1_000;

/** Isolated for deterministic testing; defaults to a platform-standard UUID. */
export type WatchlistIdGenerator = () => string;

/**
 * Result of a successful admission check (TASK-038): the already-loaded
 * document and the matched Watchlist's index, so a caller that needs to
 * interleave provider work between admission and persistence (see
 * `AddStockToWatchlistService`) can commit without a second repository read.
 */
export interface PreparedSymbolAddition {
	readonly document: WatchlistsDocument;
	readonly watchlistIndex: number;
}

function normalize(value: string): string {
	return value.trim();
}

export class WatchlistService {
	constructor(
		private readonly repository: WatchlistRepository,
		private readonly generateWatchlistId: WatchlistIdGenerator = () => crypto.randomUUID()
	) {}

	async loadWatchlists(userId: string): Promise<WatchlistsDocument> {
		return this.repository.get(userId);
	}

	async createWatchlist(userId: string, name: string): Promise<CreateWatchlistResult> {
		const trimmedName = normalize(name);
		if (!isValidWatchlistName(trimmedName)) {
			throw new InvalidWatchlistNameError(name);
		}

		const document = await this.repository.get(userId);
		const watchlist: Watchlist = {
			id: this.generateWatchlistId(),
			name: trimmedName,
			symbols: []
		};
		const updatedDocument: WatchlistsDocument = {
			activeWatchlistId: watchlist.id,
			watchlists: [...document.watchlists, watchlist]
		};

		await this.repository.save(userId, updatedDocument);
		return { watchlist, document: updatedDocument };
	}

	async selectActiveWatchlist(userId: string, watchlistId: string): Promise<WatchlistsDocument> {
		const document = await this.repository.get(userId);
		if (!document.watchlists.some((watchlist) => watchlist.id === watchlistId)) {
			throw new WatchlistNotFoundError(watchlistId);
		}

		const updatedDocument: WatchlistsDocument = { ...document, activeWatchlistId: watchlistId };
		await this.repository.save(userId, updatedDocument);
		return updatedDocument;
	}

	async deleteActiveWatchlist(userId: string): Promise<WatchlistsDocument> {
		const document = await this.repository.get(userId);
		const activeIndex =
			document.activeWatchlistId === undefined
				? -1
				: document.watchlists.findIndex((watchlist) => watchlist.id === document.activeWatchlistId);

		if (activeIndex === -1) {
			throw new NoActiveWatchlistError();
		}

		const remaining = document.watchlists.filter((_, index) => index !== activeIndex);
		let newActiveWatchlistId: string | undefined;
		if (remaining.length === 0) {
			newActiveWatchlistId = undefined;
		} else if (activeIndex === 0) {
			newActiveWatchlistId = remaining[0].id;
		} else {
			newActiveWatchlistId = document.watchlists[activeIndex - 1].id;
		}

		const updatedDocument: WatchlistsDocument = {
			activeWatchlistId: newActiveWatchlistId,
			watchlists: remaining
		};
		await this.repository.save(userId, updatedDocument);
		return updatedDocument;
	}

	async addSymbol(
		userId: string,
		watchlistId: string,
		symbol: string
	): Promise<WatchlistsDocument> {
		const trimmedSymbol = normalize(symbol);
		if (trimmedSymbol.length === 0) {
			throw new InvalidSymbolError(symbol);
		}

		const prepared = await this.prepareAddSymbol(userId, watchlistId, trimmedSymbol);
		return this.commitAddSymbol(userId, prepared, trimmedSymbol);
	}

	/**
	 * Admission check only: loads the Watchlist, then rejects a missing
	 * Watchlist, a full Watchlist (`MAX_STOCKS_PER_WATCHLIST`), or a duplicate
	 * symbol — all before any persistence write. Split from `commitAddSymbol`
	 * so `AddStockToWatchlistService` can run `MarketDataProvider.resolveSymbol()`
	 * between admission and persistence without a wasted provider call for an
	 * addition that cannot succeed, and without loading the document twice
	 * (TASK-038 §65-67).
	 */
	async prepareAddSymbol(
		userId: string,
		watchlistId: string,
		symbol: string
	): Promise<PreparedSymbolAddition> {
		const document = await this.repository.get(userId);
		const watchlistIndex = document.watchlists.findIndex((w) => w.id === watchlistId);
		if (watchlistIndex === -1) {
			throw new WatchlistNotFoundError(watchlistId);
		}

		const watchlist = document.watchlists[watchlistIndex];
		if (watchlist.symbols.length >= MAX_STOCKS_PER_WATCHLIST) {
			throw new WatchlistStockLimitReachedError(watchlistId);
		}
		if (watchlist.symbols.includes(symbol)) {
			throw new DuplicateSymbolError(symbol, watchlistId);
		}

		return { document, watchlistIndex };
	}

	/** Persists the symbol admitted by a prior `prepareAddSymbol` call, reusing its already-loaded document. */
	async commitAddSymbol(
		userId: string,
		prepared: PreparedSymbolAddition,
		symbol: string
	): Promise<WatchlistsDocument> {
		const { document, watchlistIndex } = prepared;
		const watchlist = document.watchlists[watchlistIndex];
		const updatedWatchlist: Watchlist = {
			...watchlist,
			symbols: [...watchlist.symbols, symbol]
		};
		const updatedDocument: WatchlistsDocument = {
			...document,
			watchlists: document.watchlists.map((w, index) =>
				index === watchlistIndex ? updatedWatchlist : w
			)
		};

		await this.repository.save(userId, updatedDocument);
		return updatedDocument;
	}

	async removeSymbol(
		userId: string,
		watchlistId: string,
		symbol: string
	): Promise<WatchlistsDocument> {
		const trimmedSymbol = normalize(symbol);
		if (trimmedSymbol.length === 0) {
			throw new InvalidSymbolError(symbol);
		}

		const document = await this.repository.get(userId);
		const watchlistIndex = document.watchlists.findIndex((w) => w.id === watchlistId);
		if (watchlistIndex === -1) {
			throw new WatchlistNotFoundError(watchlistId);
		}

		const watchlist = document.watchlists[watchlistIndex];
		if (!watchlist.symbols.includes(trimmedSymbol)) {
			throw new SymbolNotFoundError(trimmedSymbol, watchlistId);
		}

		const updatedWatchlist: Watchlist = {
			...watchlist,
			symbols: watchlist.symbols.filter((s) => s !== trimmedSymbol)
		};
		const updatedDocument: WatchlistsDocument = {
			...document,
			watchlists: document.watchlists.map((w, index) =>
				index === watchlistIndex ? updatedWatchlist : w
			)
		};

		await this.repository.save(userId, updatedDocument);
		return updatedDocument;
	}
}
