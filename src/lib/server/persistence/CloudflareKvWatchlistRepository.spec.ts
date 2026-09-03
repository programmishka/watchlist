import { describe, expect, it } from 'vitest';
import { CloudflareKvWatchlistRepository } from './CloudflareKvWatchlistRepository';
import type { KvNamespaceLike } from './KvNamespaceLike';
import { PersistenceError } from './PersistenceError';
import { InvalidUserIdError } from './UserId';
import type { WatchlistsDocument } from './WatchlistRepository';

class FakeKvNamespace implements KvNamespaceLike {
	private readonly store = new Map<string, string>();
	failNextGet = false;
	failNextPut = false;

	async get(key: string): Promise<string | null> {
		if (this.failNextGet) {
			this.failNextGet = false;
			throw new Error('simulated KV read failure');
		}
		return this.store.get(key) ?? null;
	}

	async put(key: string, value: string): Promise<void> {
		if (this.failNextPut) {
			this.failNextPut = false;
			throw new Error('simulated KV write failure');
		}
		this.store.set(key, value);
	}

	seed(key: string, value: string): void {
		this.store.set(key, value);
	}

	read(key: string): string | undefined {
		return this.store.get(key);
	}
}

describe('CloudflareKvWatchlistRepository.get', () => {
	it('returns the empty state when no document is persisted', async () => {
		const repository = new CloudflareKvWatchlistRepository(new FakeKvNamespace());

		const result = await repository.get('user-1');

		expect(result).toEqual({ activeWatchlistId: undefined, watchlists: [] });
	});

	it('parses and returns a valid persisted document', async () => {
		const kv = new FakeKvNamespace();
		const document: WatchlistsDocument = {
			activeWatchlistId: 'wl-1',
			watchlists: [{ id: 'wl-1', name: 'Main', symbols: ['AAPL', 'MSFT'] }]
		};
		kv.seed('user:user-1:watchlists', JSON.stringify(document));
		const repository = new CloudflareKvWatchlistRepository(kv);

		expect(await repository.get('user-1')).toEqual(document);
	});

	it('treats an empty watchlists array as valid', async () => {
		const kv = new FakeKvNamespace();
		kv.seed('user:user-1:watchlists', JSON.stringify({ watchlists: [] }));
		const repository = new CloudflareKvWatchlistRepository(kv);

		expect(await repository.get('user-1')).toEqual({
			activeWatchlistId: undefined,
			watchlists: []
		});
	});

	it('accepts duplicate Watchlist names', async () => {
		const kv = new FakeKvNamespace();
		const document: WatchlistsDocument = {
			watchlists: [
				{ id: 'wl-1', name: 'Main', symbols: [] },
				{ id: 'wl-2', name: 'Main', symbols: [] }
			]
		};
		kv.seed('user:user-1:watchlists', JSON.stringify(document));
		const repository = new CloudflareKvWatchlistRepository(kv);

		expect(await repository.get('user-1')).toEqual(document);
	});

	it('accepts the same symbol appearing in different Watchlists', async () => {
		const kv = new FakeKvNamespace();
		const document: WatchlistsDocument = {
			watchlists: [
				{ id: 'wl-1', name: 'Main', symbols: ['KO'] },
				{ id: 'wl-2', name: 'Dividend', symbols: ['KO', 'PEP'] }
			]
		};
		kv.seed('user:user-1:watchlists', JSON.stringify(document));
		const repository = new CloudflareKvWatchlistRepository(kv);

		expect(await repository.get('user-1')).toEqual(document);
	});

	it('rejects a duplicate symbol within one Watchlist as corrupt data', async () => {
		const kv = new FakeKvNamespace();
		kv.seed(
			'user:user-1:watchlists',
			JSON.stringify({ watchlists: [{ id: 'wl-1', name: 'Main', symbols: ['AAPL', 'AAPL'] }] })
		);
		const repository = new CloudflareKvWatchlistRepository(kv);

		await expect(repository.get('user-1')).rejects.toThrow(PersistenceError);
	});

	it('rejects duplicate Watchlist IDs as corrupt data', async () => {
		const kv = new FakeKvNamespace();
		kv.seed(
			'user:user-1:watchlists',
			JSON.stringify({
				watchlists: [
					{ id: 'wl-1', name: 'Main', symbols: [] },
					{ id: 'wl-1', name: 'Other', symbols: [] }
				]
			})
		);
		const repository = new CloudflareKvWatchlistRepository(kv);

		await expect(repository.get('user-1')).rejects.toThrow(PersistenceError);
	});

	it('rejects an activeWatchlistId that does not reference an existing Watchlist', async () => {
		const kv = new FakeKvNamespace();
		kv.seed(
			'user:user-1:watchlists',
			JSON.stringify({
				activeWatchlistId: 'missing-id',
				watchlists: [{ id: 'wl-1', name: 'Main', symbols: [] }]
			})
		);
		const repository = new CloudflareKvWatchlistRepository(kv);

		await expect(repository.get('user-1')).rejects.toThrow(PersistenceError);
	});

	it('preserves a valid activeWatchlistId', async () => {
		const kv = new FakeKvNamespace();
		const document: WatchlistsDocument = {
			activeWatchlistId: 'wl-2',
			watchlists: [
				{ id: 'wl-1', name: 'Main', symbols: [] },
				{ id: 'wl-2', name: 'Other', symbols: [] }
			]
		};
		kv.seed('user:user-1:watchlists', JSON.stringify(document));
		const repository = new CloudflareKvWatchlistRepository(kv);

		expect((await repository.get('user-1')).activeWatchlistId).toBe('wl-2');
	});

	it('throws PersistenceError for invalid JSON', async () => {
		const kv = new FakeKvNamespace();
		kv.seed('user:user-1:watchlists', '{ not valid json');
		const repository = new CloudflareKvWatchlistRepository(kv);

		await expect(repository.get('user-1')).rejects.toThrow(PersistenceError);
	});

	it('throws PersistenceError for a structurally invalid document', async () => {
		const kv = new FakeKvNamespace();
		kv.seed('user:user-1:watchlists', JSON.stringify({ watchlists: 'not-an-array' }));
		const repository = new CloudflareKvWatchlistRepository(kv);

		await expect(repository.get('user-1')).rejects.toThrow(PersistenceError);
	});

	it('maps a KV read failure to PersistenceError, preserving the cause', async () => {
		const kv = new FakeKvNamespace();
		kv.failNextGet = true;
		const repository = new CloudflareKvWatchlistRepository(kv);

		try {
			await repository.get('user-1');
			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(PersistenceError);
			expect((error as PersistenceError).cause).toBeInstanceOf(Error);
		}
	});
});

describe('CloudflareKvWatchlistRepository.save', () => {
	it('serializes the document under the user-scoped key', async () => {
		const kv = new FakeKvNamespace();
		const repository = new CloudflareKvWatchlistRepository(kv);
		const document: WatchlistsDocument = {
			activeWatchlistId: 'wl-1',
			watchlists: [{ id: 'wl-1', name: 'Main', symbols: ['AAPL'] }]
		};

		await repository.save('user-1', document);

		expect(JSON.parse(kv.read('user:user-1:watchlists')!)).toEqual(document);
	});

	it('maps a KV write failure to PersistenceError, preserving the cause', async () => {
		const kv = new FakeKvNamespace();
		kv.failNextPut = true;
		const repository = new CloudflareKvWatchlistRepository(kv);

		try {
			await repository.save('user-1', { watchlists: [] });
			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(PersistenceError);
			expect((error as PersistenceError).cause).toBeInstanceOf(Error);
		}
	});
});

describe('CloudflareKvWatchlistRepository user isolation', () => {
	it('scopes reads and writes to separate keys per user', async () => {
		const kv = new FakeKvNamespace();
		const repository = new CloudflareKvWatchlistRepository(kv);

		await repository.save('user-1', { watchlists: [{ id: 'wl-1', name: 'A', symbols: [] }] });
		await repository.save('user-2', { watchlists: [{ id: 'wl-2', name: 'B', symbols: [] }] });

		expect(await repository.get('user-1')).toEqual({
			activeWatchlistId: undefined,
			watchlists: [{ id: 'wl-1', name: 'A', symbols: [] }]
		});
		expect(await repository.get('user-2')).toEqual({
			activeWatchlistId: undefined,
			watchlists: [{ id: 'wl-2', name: 'B', symbols: [] }]
		});
		expect(kv.read('user:user-1:watchlists')).not.toBe(kv.read('user:user-2:watchlists'));
	});
});

describe('CloudflareKvWatchlistRepository user ID validation', () => {
	it.each(['', '   '])('rejects %j as a user ID', async (userId) => {
		const repository = new CloudflareKvWatchlistRepository(new FakeKvNamespace());

		await expect(repository.get(userId)).rejects.toThrow(InvalidUserIdError);
		await expect(repository.save(userId, { watchlists: [] })).rejects.toThrow(InvalidUserIdError);
	});

	it('accepts a simple non-empty user ID', async () => {
		const repository = new CloudflareKvWatchlistRepository(new FakeKvNamespace());

		await expect(repository.get('user-1')).resolves.toBeDefined();
	});
});
