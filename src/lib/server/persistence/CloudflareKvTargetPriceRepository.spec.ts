import { describe, expect, it } from 'vitest';
import { CloudflareKvTargetPriceRepository } from './CloudflareKvTargetPriceRepository';
import type { KvNamespaceLike } from './KvNamespaceLike';
import { PersistenceError } from './PersistenceError';
import type { TargetPrices } from './TargetPriceRepository';
import { InvalidUserIdError } from './UserId';

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

describe('CloudflareKvTargetPriceRepository.get', () => {
	it('returns {} when no document is persisted', async () => {
		const repository = new CloudflareKvTargetPriceRepository(new FakeKvNamespace());

		expect(await repository.get('user-1')).toEqual({});
	});

	it('returns all persisted symbol/target-price entries', async () => {
		const kv = new FakeKvNamespace();
		const document: TargetPrices = { AAPL: 200, 'SAP.DE': 220 };
		kv.seed('user:user-1:target-prices', JSON.stringify(document));
		const repository = new CloudflareKvTargetPriceRepository(kv);

		expect(await repository.get('user-1')).toEqual(document);
	});

	it('preserves a decimal target price', async () => {
		const kv = new FakeKvNamespace();
		kv.seed('user:user-1:target-prices', JSON.stringify({ AAPL: 200.5 }));
		const repository = new CloudflareKvTargetPriceRepository(kv);

		expect((await repository.get('user-1')).AAPL).toBe(200.5);
	});

	it.each([
		['non-numeric', { AAPL: '200' }],
		['NaN', { AAPL: Number.NaN }],
		['Infinity', { AAPL: Number.POSITIVE_INFINITY }],
		['zero', { AAPL: 0 }],
		['negative', { AAPL: -5 }]
	])('rejects a %s target price as corrupt data', async (_label, document) => {
		const kv = new FakeKvNamespace();
		kv.seed('user:user-1:target-prices', JSON.stringify(document));
		const repository = new CloudflareKvTargetPriceRepository(kv);

		await expect(repository.get('user-1')).rejects.toThrow(PersistenceError);
	});

	it('throws PersistenceError for invalid JSON', async () => {
		const kv = new FakeKvNamespace();
		kv.seed('user:user-1:target-prices', '{ not valid json');
		const repository = new CloudflareKvTargetPriceRepository(kv);

		await expect(repository.get('user-1')).rejects.toThrow(PersistenceError);
	});

	it.each([
		['an array', '[1,2,3]'],
		['a string', '"AAPL"'],
		['a number', '5'],
		['null', 'null']
	])('throws PersistenceError when the root is %s', async (_label, raw) => {
		const kv = new FakeKvNamespace();
		kv.seed('user:user-1:target-prices', raw);
		const repository = new CloudflareKvTargetPriceRepository(kv);

		await expect(repository.get('user-1')).rejects.toThrow(PersistenceError);
	});

	it('maps a KV read failure to PersistenceError, preserving the cause', async () => {
		const kv = new FakeKvNamespace();
		kv.failNextGet = true;
		const repository = new CloudflareKvTargetPriceRepository(kv);

		try {
			await repository.get('user-1');
			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(PersistenceError);
			expect((error as PersistenceError).cause).toBeInstanceOf(Error);
		}
	});
});

describe('CloudflareKvTargetPriceRepository.save', () => {
	it('serializes the document under the user-scoped key', async () => {
		const kv = new FakeKvNamespace();
		const repository = new CloudflareKvTargetPriceRepository(kv);
		const document: TargetPrices = { AAPL: 200.5, 'GAW.L': 185 };

		await repository.save('user-1', document);

		expect(JSON.parse(kv.read('user:user-1:target-prices')!)).toEqual(document);
	});

	it('maps a KV write failure to PersistenceError, preserving the cause', async () => {
		const kv = new FakeKvNamespace();
		kv.failNextPut = true;
		const repository = new CloudflareKvTargetPriceRepository(kv);

		try {
			await repository.save('user-1', {});
			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(PersistenceError);
			expect((error as PersistenceError).cause).toBeInstanceOf(Error);
		}
	});
});

describe('CloudflareKvTargetPriceRepository user isolation', () => {
	it('scopes reads and writes to separate keys per user', async () => {
		const kv = new FakeKvNamespace();
		const repository = new CloudflareKvTargetPriceRepository(kv);

		await repository.save('user-1', { AAPL: 200 });
		await repository.save('user-2', { AAPL: 300 });

		expect(await repository.get('user-1')).toEqual({ AAPL: 200 });
		expect(await repository.get('user-2')).toEqual({ AAPL: 300 });
		expect(kv.read('user:user-1:target-prices')).not.toBe(kv.read('user:user-2:target-prices'));
	});
});

describe('CloudflareKvTargetPriceRepository user ID validation', () => {
	it.each(['', '   '])('rejects %j as a user ID', async (userId) => {
		const repository = new CloudflareKvTargetPriceRepository(new FakeKvNamespace());

		await expect(repository.get(userId)).rejects.toThrow(InvalidUserIdError);
		await expect(repository.save(userId, {})).rejects.toThrow(InvalidUserIdError);
	});

	it('accepts a simple non-empty user ID', async () => {
		const repository = new CloudflareKvTargetPriceRepository(new FakeKvNamespace());

		await expect(repository.get('user-1')).resolves.toBeDefined();
	});
});
