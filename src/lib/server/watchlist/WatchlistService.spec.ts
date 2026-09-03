import { describe, expect, it } from 'vitest';
import type { WatchlistRepository, WatchlistsDocument } from '../persistence/WatchlistRepository';
import { WatchlistService } from './WatchlistService';
import {
	DuplicateSymbolError,
	InvalidSymbolError,
	InvalidWatchlistNameError,
	NoActiveWatchlistError,
	SymbolNotFoundError,
	WatchlistNotFoundError
} from './WatchlistServiceErrors';

class FakeWatchlistRepository implements WatchlistRepository {
	private readonly store = new Map<string, WatchlistsDocument>();
	saveCalls: { userId: string; document: WatchlistsDocument }[] = [];

	async get(userId: string): Promise<WatchlistsDocument> {
		return this.store.get(userId) ?? { activeWatchlistId: undefined, watchlists: [] };
	}

	async save(userId: string, document: WatchlistsDocument): Promise<void> {
		this.saveCalls.push({ userId, document });
		this.store.set(userId, document);
	}

	seed(userId: string, document: WatchlistsDocument): void {
		this.store.set(userId, document);
	}
}

function sequentialIdGenerator(prefix = 'wl'): () => string {
	let counter = 0;
	return () => `${prefix}-${++counter}`;
}

describe('WatchlistService.loadWatchlists', () => {
	it('returns the persisted document for an existing user', async () => {
		const repository = new FakeWatchlistRepository();
		const document: WatchlistsDocument = {
			activeWatchlistId: 'wl-1',
			watchlists: [{ id: 'wl-1', name: 'Main', symbols: ['AAPL'] }]
		};
		repository.seed('user-1', document);
		const service = new WatchlistService(repository);

		expect(await service.loadWatchlists('user-1')).toEqual(document);
	});

	it('returns the empty state for a user with no Watchlists, without saving', async () => {
		const repository = new FakeWatchlistRepository();
		const service = new WatchlistService(repository);

		const result = await service.loadWatchlists('user-1');

		expect(result).toEqual({ activeWatchlistId: undefined, watchlists: [] });
		expect(repository.saveCalls).toHaveLength(0);
	});
});

describe('WatchlistService.createWatchlist', () => {
	it('creates the first Watchlist as empty and active', async () => {
		const repository = new FakeWatchlistRepository();
		const service = new WatchlistService(repository, sequentialIdGenerator());

		const result = await service.createWatchlist('user-1', 'Main');

		expect(result.watchlist).toEqual({ id: 'wl-1', name: 'Main', symbols: [] });
		expect(result.document).toEqual({
			activeWatchlistId: 'wl-1',
			watchlists: [{ id: 'wl-1', name: 'Main', symbols: [] }]
		});
	});

	it('appends an additional Watchlist and makes it active', async () => {
		const repository = new FakeWatchlistRepository();
		repository.seed('user-1', {
			activeWatchlistId: 'wl-1',
			watchlists: [{ id: 'wl-1', name: 'Main', symbols: [] }]
		});
		const service = new WatchlistService(repository, sequentialIdGenerator('new'));

		const result = await service.createWatchlist('user-1', 'Dividend');

		expect(result.document.watchlists.map((w) => w.id)).toEqual(['wl-1', 'new-1']);
		expect(result.document.activeWatchlistId).toBe('new-1');
	});

	it('allows duplicate Watchlist names with different IDs', async () => {
		const repository = new FakeWatchlistRepository();
		const service = new WatchlistService(repository, sequentialIdGenerator());

		await service.createWatchlist('user-1', 'Dividend');
		const result = await service.createWatchlist('user-1', 'Dividend');

		expect(result.document.watchlists.map((w) => w.name)).toEqual(['Dividend', 'Dividend']);
		expect(result.document.watchlists[0].id).not.toBe(result.document.watchlists[1].id);
	});

	it('trims surrounding whitespace from the name before persisting', async () => {
		const repository = new FakeWatchlistRepository();
		const service = new WatchlistService(repository, sequentialIdGenerator());

		const result = await service.createWatchlist('user-1', '  Dividend  ');

		expect(result.watchlist.name).toBe('Dividend');
	});

	it('rejects an empty name without saving', async () => {
		const repository = new FakeWatchlistRepository();
		const service = new WatchlistService(repository, sequentialIdGenerator());

		await expect(service.createWatchlist('user-1', '')).rejects.toThrow(InvalidWatchlistNameError);
		expect(repository.saveCalls).toHaveLength(0);
	});

	it('rejects a whitespace-only name without saving', async () => {
		const repository = new FakeWatchlistRepository();
		const service = new WatchlistService(repository, sequentialIdGenerator());

		await expect(service.createWatchlist('user-1', '   ')).rejects.toThrow(
			InvalidWatchlistNameError
		);
		expect(repository.saveCalls).toHaveLength(0);
	});

	it('uses the injected ID generator rather than any client-supplied value', async () => {
		const repository = new FakeWatchlistRepository();
		const service = new WatchlistService(repository, () => 'deterministic-id');

		const result = await service.createWatchlist('user-1', 'Main');

		expect(result.watchlist.id).toBe('deterministic-id');
	});

	it('propagates a repository save failure rather than reporting success', async () => {
		const failingRepository: WatchlistRepository = {
			get: async () => ({ activeWatchlistId: undefined, watchlists: [] }),
			save: async () => {
				throw new Error('simulated KV write failure');
			}
		};
		const service = new WatchlistService(failingRepository, sequentialIdGenerator());

		await expect(service.createWatchlist('user-1', 'Main')).rejects.toThrow(
			'simulated KV write failure'
		);
	});
});

describe('WatchlistService.selectActiveWatchlist', () => {
	it('changes activeWatchlistId and persists it', async () => {
		const repository = new FakeWatchlistRepository();
		repository.seed('user-1', {
			activeWatchlistId: 'wl-1',
			watchlists: [
				{ id: 'wl-1', name: 'Main', symbols: [] },
				{ id: 'wl-2', name: 'Other', symbols: [] }
			]
		});
		const service = new WatchlistService(repository);

		const result = await service.selectActiveWatchlist('user-1', 'wl-2');

		expect(result.activeWatchlistId).toBe('wl-2');
		expect(repository.saveCalls).toHaveLength(1);
	});

	it('fails without saving when the Watchlist does not exist', async () => {
		const repository = new FakeWatchlistRepository();
		repository.seed('user-1', {
			activeWatchlistId: 'wl-1',
			watchlists: [{ id: 'wl-1', name: 'Main', symbols: [] }]
		});
		const service = new WatchlistService(repository);

		await expect(service.selectActiveWatchlist('user-1', 'missing-id')).rejects.toThrow(
			WatchlistNotFoundError
		);
		expect(repository.saveCalls).toHaveLength(0);
	});
});

describe('WatchlistService.deleteActiveWatchlist', () => {
	it('leaves the empty state when deleting the only Watchlist', async () => {
		const repository = new FakeWatchlistRepository();
		repository.seed('user-1', {
			activeWatchlistId: 'wl-1',
			watchlists: [{ id: 'wl-1', name: 'A', symbols: [] }]
		});
		const service = new WatchlistService(repository);

		const result = await service.deleteActiveWatchlist('user-1');

		expect(result).toEqual({ activeWatchlistId: undefined, watchlists: [] });
	});

	it('selects the new first Watchlist when the first is deleted', async () => {
		const repository = new FakeWatchlistRepository();
		repository.seed('user-1', {
			activeWatchlistId: 'a',
			watchlists: [
				{ id: 'a', name: 'A', symbols: [] },
				{ id: 'b', name: 'B', symbols: [] },
				{ id: 'c', name: 'C', symbols: [] }
			]
		});
		const service = new WatchlistService(repository);

		const result = await service.deleteActiveWatchlist('user-1');

		expect(result.activeWatchlistId).toBe('b');
		expect(result.watchlists.map((w) => w.id)).toEqual(['b', 'c']);
	});

	it('selects the previous Watchlist when a middle one is deleted', async () => {
		const repository = new FakeWatchlistRepository();
		repository.seed('user-1', {
			activeWatchlistId: 'b',
			watchlists: [
				{ id: 'a', name: 'A', symbols: [] },
				{ id: 'b', name: 'B', symbols: [] },
				{ id: 'c', name: 'C', symbols: [] }
			]
		});
		const service = new WatchlistService(repository);

		const result = await service.deleteActiveWatchlist('user-1');

		expect(result.activeWatchlistId).toBe('a');
		expect(result.watchlists.map((w) => w.id)).toEqual(['a', 'c']);
	});

	it('selects the previous Watchlist when the last one is deleted', async () => {
		const repository = new FakeWatchlistRepository();
		repository.seed('user-1', {
			activeWatchlistId: 'c',
			watchlists: [
				{ id: 'a', name: 'A', symbols: [] },
				{ id: 'b', name: 'B', symbols: [] },
				{ id: 'c', name: 'C', symbols: [] }
			]
		});
		const service = new WatchlistService(repository);

		const result = await service.deleteActiveWatchlist('user-1');

		expect(result.activeWatchlistId).toBe('b');
		expect(result.watchlists.map((w) => w.id)).toEqual(['a', 'b']);
	});

	it('preserves the relative order of remaining Watchlists', async () => {
		const repository = new FakeWatchlistRepository();
		repository.seed('user-1', {
			activeWatchlistId: 'b',
			watchlists: [
				{ id: 'a', name: 'A', symbols: [] },
				{ id: 'b', name: 'B', symbols: [] },
				{ id: 'c', name: 'C', symbols: [] },
				{ id: 'd', name: 'D', symbols: [] }
			]
		});
		const service = new WatchlistService(repository);

		const result = await service.deleteActiveWatchlist('user-1');

		expect(result.watchlists.map((w) => w.id)).toEqual(['a', 'c', 'd']);
	});

	it('fails explicitly without saving when there is no active Watchlist but others exist', async () => {
		const repository = new FakeWatchlistRepository();
		repository.seed('user-1', {
			activeWatchlistId: undefined,
			watchlists: [{ id: 'a', name: 'A', symbols: [] }]
		});
		const service = new WatchlistService(repository);

		await expect(service.deleteActiveWatchlist('user-1')).rejects.toThrow(NoActiveWatchlistError);
		expect(repository.saveCalls).toHaveLength(0);
	});

	it('fails explicitly without saving for a user with no Watchlists', async () => {
		const repository = new FakeWatchlistRepository();
		const service = new WatchlistService(repository);

		await expect(service.deleteActiveWatchlist('user-1')).rejects.toThrow(NoActiveWatchlistError);
		expect(repository.saveCalls).toHaveLength(0);
	});

	it('requires no TargetPriceRepository dependency (verified by the constructor signature)', async () => {
		const repository = new FakeWatchlistRepository();
		repository.seed('user-1', {
			activeWatchlistId: 'a',
			watchlists: [{ id: 'a', name: 'A', symbols: [] }]
		});
		// WatchlistService's constructor only accepts (WatchlistRepository, WatchlistIdGenerator?) —
		// there is no third parameter through which a TargetPriceRepository could be supplied.
		const service = new WatchlistService(repository);

		await expect(service.deleteActiveWatchlist('user-1')).resolves.toEqual({
			activeWatchlistId: undefined,
			watchlists: []
		});
	});
});

describe('WatchlistService.addSymbol', () => {
	it('appends a symbol to an empty Watchlist', async () => {
		const repository = new FakeWatchlistRepository();
		repository.seed('user-1', {
			activeWatchlistId: 'wl-1',
			watchlists: [{ id: 'wl-1', name: 'Main', symbols: [] }]
		});
		const service = new WatchlistService(repository);

		const result = await service.addSymbol('user-1', 'wl-1', 'AAPL');

		expect(result.watchlists[0].symbols).toEqual(['AAPL']);
	});

	it('appends to existing symbols, preserving their order', async () => {
		const repository = new FakeWatchlistRepository();
		repository.seed('user-1', {
			activeWatchlistId: 'wl-1',
			watchlists: [{ id: 'wl-1', name: 'Main', symbols: ['AAPL', 'MSFT'] }]
		});
		const service = new WatchlistService(repository);

		const result = await service.addSymbol('user-1', 'wl-1', 'KO');

		expect(result.watchlists[0].symbols).toEqual(['AAPL', 'MSFT', 'KO']);
	});

	it('trims surrounding whitespace before persisting', async () => {
		const repository = new FakeWatchlistRepository();
		repository.seed('user-1', {
			activeWatchlistId: 'wl-1',
			watchlists: [{ id: 'wl-1', name: 'Main', symbols: [] }]
		});
		const service = new WatchlistService(repository);

		const result = await service.addSymbol('user-1', 'wl-1', '  GAW.L  ');

		expect(result.watchlists[0].symbols).toEqual(['GAW.L']);
	});

	it('rejects an empty symbol without saving', async () => {
		const repository = new FakeWatchlistRepository();
		repository.seed('user-1', {
			activeWatchlistId: 'wl-1',
			watchlists: [{ id: 'wl-1', name: 'Main', symbols: [] }]
		});
		const service = new WatchlistService(repository);

		await expect(service.addSymbol('user-1', 'wl-1', '')).rejects.toThrow(InvalidSymbolError);
		expect(repository.saveCalls).toHaveLength(0);
	});

	it('rejects a whitespace-only symbol without saving', async () => {
		const repository = new FakeWatchlistRepository();
		repository.seed('user-1', {
			activeWatchlistId: 'wl-1',
			watchlists: [{ id: 'wl-1', name: 'Main', symbols: [] }]
		});
		const service = new WatchlistService(repository);

		await expect(service.addSymbol('user-1', 'wl-1', '   ')).rejects.toThrow(InvalidSymbolError);
		expect(repository.saveCalls).toHaveLength(0);
	});

	it('rejects a duplicate symbol within the same Watchlist without saving', async () => {
		const repository = new FakeWatchlistRepository();
		repository.seed('user-1', {
			activeWatchlistId: 'wl-1',
			watchlists: [{ id: 'wl-1', name: 'Main', symbols: ['AAPL'] }]
		});
		const service = new WatchlistService(repository);

		await expect(service.addSymbol('user-1', 'wl-1', 'AAPL')).rejects.toThrow(DuplicateSymbolError);
		expect(repository.saveCalls).toHaveLength(0);
	});

	it('rejects adding to a missing Watchlist without saving', async () => {
		const repository = new FakeWatchlistRepository();
		const service = new WatchlistService(repository);

		await expect(service.addSymbol('user-1', 'missing-id', 'AAPL')).rejects.toThrow(
			WatchlistNotFoundError
		);
		expect(repository.saveCalls).toHaveLength(0);
	});

	it('allows the same symbol to exist in a different Watchlist', async () => {
		const repository = new FakeWatchlistRepository();
		repository.seed('user-1', {
			activeWatchlistId: 'a',
			watchlists: [
				{ id: 'a', name: 'A', symbols: ['AAPL'] },
				{ id: 'b', name: 'B', symbols: [] }
			]
		});
		const service = new WatchlistService(repository);

		const result = await service.addSymbol('user-1', 'b', 'AAPL');

		expect(result.watchlists.find((w) => w.id === 'a')?.symbols).toEqual(['AAPL']);
		expect(result.watchlists.find((w) => w.id === 'b')?.symbols).toEqual(['AAPL']);
	});

	it('persists Yahoo-style symbols unchanged, without rewriting them', async () => {
		const repository = new FakeWatchlistRepository();
		repository.seed('user-1', {
			activeWatchlistId: 'wl-1',
			watchlists: [{ id: 'wl-1', name: 'Main', symbols: [] }]
		});
		const service = new WatchlistService(repository);

		const result = await service.addSymbol('user-1', 'wl-1', 'HEXA-B.ST');

		expect(result.watchlists[0].symbols).toEqual(['HEXA-B.ST']);
	});
});

describe('WatchlistService.removeSymbol', () => {
	it('removes only the requested symbol', async () => {
		const repository = new FakeWatchlistRepository();
		repository.seed('user-1', {
			activeWatchlistId: 'wl-1',
			watchlists: [{ id: 'wl-1', name: 'Main', symbols: ['AAPL', 'MSFT'] }]
		});
		const service = new WatchlistService(repository);

		const result = await service.removeSymbol('user-1', 'wl-1', 'AAPL');

		expect(result.watchlists[0].symbols).toEqual(['MSFT']);
	});

	it('preserves the order of remaining symbols', async () => {
		const repository = new FakeWatchlistRepository();
		repository.seed('user-1', {
			activeWatchlistId: 'wl-1',
			watchlists: [{ id: 'wl-1', name: 'Main', symbols: ['AAPL', 'MSFT', 'KO'] }]
		});
		const service = new WatchlistService(repository);

		const result = await service.removeSymbol('user-1', 'wl-1', 'MSFT');

		expect(result.watchlists[0].symbols).toEqual(['AAPL', 'KO']);
	});

	it('removes the symbol from only the selected Watchlist', async () => {
		const repository = new FakeWatchlistRepository();
		repository.seed('user-1', {
			activeWatchlistId: 'a',
			watchlists: [
				{ id: 'a', name: 'A', symbols: ['AAPL', 'SAP.DE'] },
				{ id: 'b', name: 'B', symbols: ['AAPL', 'GAW.L'] }
			]
		});
		const service = new WatchlistService(repository);

		const result = await service.removeSymbol('user-1', 'a', 'AAPL');

		expect(result.watchlists.find((w) => w.id === 'a')?.symbols).toEqual(['SAP.DE']);
		expect(result.watchlists.find((w) => w.id === 'b')?.symbols).toEqual(['AAPL', 'GAW.L']);
	});

	it('fails without saving when the symbol does not exist in the Watchlist', async () => {
		const repository = new FakeWatchlistRepository();
		repository.seed('user-1', {
			activeWatchlistId: 'wl-1',
			watchlists: [{ id: 'wl-1', name: 'Main', symbols: ['AAPL'] }]
		});
		const service = new WatchlistService(repository);

		await expect(service.removeSymbol('user-1', 'wl-1', 'MSFT')).rejects.toThrow(
			SymbolNotFoundError
		);
		expect(repository.saveCalls).toHaveLength(0);
	});

	it('fails without saving when the Watchlist does not exist', async () => {
		const repository = new FakeWatchlistRepository();
		const service = new WatchlistService(repository);

		await expect(service.removeSymbol('user-1', 'missing-id', 'AAPL')).rejects.toThrow(
			WatchlistNotFoundError
		);
		expect(repository.saveCalls).toHaveLength(0);
	});

	it('trims surrounding whitespace before the exact lookup', async () => {
		const repository = new FakeWatchlistRepository();
		repository.seed('user-1', {
			activeWatchlistId: 'wl-1',
			watchlists: [{ id: 'wl-1', name: 'Main', symbols: ['AAPL'] }]
		});
		const service = new WatchlistService(repository);

		const result = await service.removeSymbol('user-1', 'wl-1', '  AAPL  ');

		expect(result.watchlists[0].symbols).toEqual([]);
	});

	it('requires no TargetPriceRepository dependency (verified by the constructor signature)', async () => {
		const repository = new FakeWatchlistRepository();
		repository.seed('user-1', {
			activeWatchlistId: 'wl-1',
			watchlists: [{ id: 'wl-1', name: 'Main', symbols: ['AAPL'] }]
		});
		const service = new WatchlistService(repository);

		await expect(service.removeSymbol('user-1', 'wl-1', 'AAPL')).resolves.toBeDefined();
	});
});

describe('WatchlistService user isolation', () => {
	it('keeps operations for different users isolated on a shared repository', async () => {
		const repository = new FakeWatchlistRepository();
		const service = new WatchlistService(repository, sequentialIdGenerator());

		await service.createWatchlist('user-1', 'User 1 List');
		await service.createWatchlist('user-2', 'User 2 List');

		const user1Document = await service.loadWatchlists('user-1');
		const user2Document = await service.loadWatchlists('user-2');

		expect(user1Document.watchlists.map((w) => w.name)).toEqual(['User 1 List']);
		expect(user2Document.watchlists.map((w) => w.name)).toEqual(['User 2 List']);

		await service.addSymbol('user-1', user1Document.watchlists[0].id, 'AAPL');
		const user2DocumentAfter = await service.loadWatchlists('user-2');
		expect(user2DocumentAfter.watchlists[0].symbols).toEqual([]);

		const saveCallUserIds = repository.saveCalls.map((call) => call.userId);
		expect(new Set(saveCallUserIds)).toEqual(new Set(['user-1', 'user-2']));
	});
});
