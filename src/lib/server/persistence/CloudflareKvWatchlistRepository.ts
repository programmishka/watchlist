import type { KvNamespaceLike } from './KvNamespaceLike';
import { PersistenceError } from './PersistenceError';
import { assertValidUserId } from './UserId';
import { watchlistsKey } from './kvKeys';
import type { Watchlist, WatchlistRepository, WatchlistsDocument } from './WatchlistRepository';

function isValidWatchlist(value: unknown, seenIds: Set<string>): value is Watchlist {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	const watchlist = value as Record<string, unknown>;

	if (typeof watchlist.id !== 'string' || typeof watchlist.name !== 'string') {
		return false;
	}
	if (!Array.isArray(watchlist.symbols) || !watchlist.symbols.every((s) => typeof s === 'string')) {
		return false;
	}
	if (seenIds.has(watchlist.id)) {
		// Duplicate Watchlist ID within the same user's document.
		return false;
	}
	if (new Set(watchlist.symbols).size !== watchlist.symbols.length) {
		// Duplicate symbol within a single Watchlist.
		return false;
	}

	seenIds.add(watchlist.id);
	return true;
}

function isValidWatchlistsDocument(value: unknown): value is WatchlistsDocument {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return false;
	}
	const doc = value as Record<string, unknown>;

	if (doc.activeWatchlistId !== undefined && typeof doc.activeWatchlistId !== 'string') {
		return false;
	}
	if (!Array.isArray(doc.watchlists)) {
		return false;
	}

	const seenIds = new Set<string>();
	for (const watchlist of doc.watchlists) {
		if (!isValidWatchlist(watchlist, seenIds)) {
			return false;
		}
	}

	if (doc.activeWatchlistId !== undefined && !seenIds.has(doc.activeWatchlistId)) {
		// activeWatchlistId must reference an existing Watchlist.
		return false;
	}

	return true;
}

export class CloudflareKvWatchlistRepository implements WatchlistRepository {
	constructor(private readonly kv: KvNamespaceLike) {}

	async get(userId: string): Promise<WatchlistsDocument> {
		assertValidUserId(userId);
		const key = watchlistsKey(userId);

		let raw: string | null;
		try {
			raw = await this.kv.get(key);
		} catch (error) {
			throw new PersistenceError('Failed to read watchlists from KV', { cause: error });
		}

		if (raw === null) {
			return { activeWatchlistId: undefined, watchlists: [] };
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(raw);
		} catch (error) {
			throw new PersistenceError('Stored watchlists document is not valid JSON', { cause: error });
		}

		if (!isValidWatchlistsDocument(parsed)) {
			throw new PersistenceError('Stored watchlists document has an invalid shape');
		}

		return parsed;
	}

	async save(userId: string, document: WatchlistsDocument): Promise<void> {
		assertValidUserId(userId);
		const key = watchlistsKey(userId);

		try {
			await this.kv.put(key, JSON.stringify(document));
		} catch (error) {
			throw new PersistenceError('Failed to write watchlists to KV', { cause: error });
		}
	}
}
