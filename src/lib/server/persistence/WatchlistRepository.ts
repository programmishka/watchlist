export interface Watchlist {
	id: string;
	name: string;
	symbols: string[];
}

export interface WatchlistsDocument {
	activeWatchlistId?: string;
	watchlists: Watchlist[];
}

export interface WatchlistRepository {
	/** Returns `{ activeWatchlistId: undefined, watchlists: [] }` when the user has no persisted document. */
	get(userId: string): Promise<WatchlistsDocument>;
	save(userId: string, document: WatchlistsDocument): Promise<void>;
}
