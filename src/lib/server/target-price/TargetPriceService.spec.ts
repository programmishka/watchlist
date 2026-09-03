import { describe, expect, it } from 'vitest';
import type { TargetPriceRepository, TargetPrices } from '../persistence/TargetPriceRepository';
import { TargetPriceService } from './TargetPriceService';
import { InvalidSymbolError, InvalidTargetPriceError } from './TargetPriceServiceErrors';

class FakeTargetPriceRepository implements TargetPriceRepository {
	private readonly store = new Map<string, TargetPrices>();
	getCalls = 0;
	saveCalls: { userId: string; targetPrices: TargetPrices }[] = [];

	async get(userId: string): Promise<TargetPrices> {
		this.getCalls++;
		return this.store.get(userId) ?? {};
	}

	async save(userId: string, targetPrices: TargetPrices): Promise<void> {
		this.saveCalls.push({ userId, targetPrices });
		this.store.set(userId, targetPrices);
	}

	seed(userId: string, targetPrices: TargetPrices): void {
		this.store.set(userId, targetPrices);
	}
}

describe('TargetPriceService.loadTargetPrices', () => {
	it('returns the persisted document for an existing user', async () => {
		const repository = new FakeTargetPriceRepository();
		repository.seed('user-1', { AAPL: 200, 'SAP.DE': 220 });
		const service = new TargetPriceService(repository);

		expect(await service.loadTargetPrices('user-1')).toEqual({ AAPL: 200, 'SAP.DE': 220 });
	});

	it('returns {} for a user with no persisted Target Prices, without saving', async () => {
		const repository = new FakeTargetPriceRepository();
		const service = new TargetPriceService(repository);

		expect(await service.loadTargetPrices('user-1')).toEqual({});
		expect(repository.saveCalls).toHaveLength(0);
	});

	it('propagates a repository read failure unchanged', async () => {
		const failingRepository: TargetPriceRepository = {
			get: async () => {
				throw new Error('simulated KV read failure');
			},
			save: async () => {}
		};
		const service = new TargetPriceService(failingRepository);

		await expect(service.loadTargetPrices('user-1')).rejects.toThrow('simulated KV read failure');
	});
});

describe('TargetPriceService.getTargetPrice', () => {
	it('returns the existing Target Price for a symbol', async () => {
		const repository = new FakeTargetPriceRepository();
		repository.seed('user-1', { AAPL: 200 });
		const service = new TargetPriceService(repository);

		expect(await service.getTargetPrice('user-1', 'AAPL')).toBe(200);
	});

	it('preserves a decimal Target Price without rounding', async () => {
		const repository = new FakeTargetPriceRepository();
		repository.seed('user-1', { AAPL: 200.5 });
		const service = new TargetPriceService(repository);

		expect(await service.getTargetPrice('user-1', 'AAPL')).toBe(200.5);
	});

	it('returns undefined for a missing Target Price without throwing', async () => {
		const repository = new FakeTargetPriceRepository();
		const service = new TargetPriceService(repository);

		await expect(service.getTargetPrice('user-1', 'AAPL')).resolves.toBeUndefined();
	});

	it('trims surrounding whitespace before lookup', async () => {
		const repository = new FakeTargetPriceRepository();
		repository.seed('user-1', { 'GAW.L': 185 });
		const service = new TargetPriceService(repository);

		expect(await service.getTargetPrice('user-1', '  GAW.L  ')).toBe(185);
	});

	it('rejects an empty symbol before repository access', async () => {
		const repository = new FakeTargetPriceRepository();
		const service = new TargetPriceService(repository);

		await expect(service.getTargetPrice('user-1', '')).rejects.toThrow(InvalidSymbolError);
		expect(repository.getCalls).toBe(0);
	});

	it('rejects a whitespace-only symbol before repository access', async () => {
		const repository = new FakeTargetPriceRepository();
		const service = new TargetPriceService(repository);

		await expect(service.getTargetPrice('user-1', '   ')).rejects.toThrow(InvalidSymbolError);
		expect(repository.getCalls).toBe(0);
	});

	it('does not treat differently-cased symbols as equivalent', async () => {
		const repository = new FakeTargetPriceRepository();
		repository.seed('user-1', { AAPL: 200 });
		const service = new TargetPriceService(repository);

		expect(await service.getTargetPrice('user-1', 'aapl')).toBeUndefined();
	});
});

describe('TargetPriceService.setTargetPrice', () => {
	it('creates a new Target Price starting from an empty document', async () => {
		const repository = new FakeTargetPriceRepository();
		const service = new TargetPriceService(repository);

		const result = await service.setTargetPrice('user-1', 'AAPL', 200);

		expect(result).toEqual({ AAPL: 200 });
		expect(repository.saveCalls).toEqual([{ userId: 'user-1', targetPrices: { AAPL: 200 } }]);
	});

	it('adds a new entry to an existing document, preserving other values', async () => {
		const repository = new FakeTargetPriceRepository();
		repository.seed('user-1', { 'SAP.DE': 220 });
		const service = new TargetPriceService(repository);

		const result = await service.setTargetPrice('user-1', 'AAPL', 200);

		expect(result).toEqual({ 'SAP.DE': 220, AAPL: 200 });
	});

	it('replaces an existing Target Price', async () => {
		const repository = new FakeTargetPriceRepository();
		repository.seed('user-1', { AAPL: 200 });
		const service = new TargetPriceService(repository);

		const result = await service.setTargetPrice('user-1', 'AAPL', 205.5);

		expect(result).toEqual({ AAPL: 205.5 });
	});

	it('allows setting the same value again', async () => {
		const repository = new FakeTargetPriceRepository();
		repository.seed('user-1', { AAPL: 200 });
		const service = new TargetPriceService(repository);

		const result = await service.setTargetPrice('user-1', 'AAPL', 200);

		expect(result).toEqual({ AAPL: 200 });
		expect(repository.saveCalls).toHaveLength(1);
	});

	it('preserves decimal values exactly', async () => {
		const repository = new FakeTargetPriceRepository();
		const service = new TargetPriceService(repository);

		const result = await service.setTargetPrice('user-1', 'AAPL', 200.75);

		expect(result.AAPL).toBe(200.75);
	});

	it('trims surrounding whitespace from the symbol before persisting', async () => {
		const repository = new FakeTargetPriceRepository();
		const service = new TargetPriceService(repository);

		const result = await service.setTargetPrice('user-1', '  GAW.L  ', 150);

		expect(result).toEqual({ 'GAW.L': 150 });
	});

	it('rejects an empty symbol before repository access', async () => {
		const repository = new FakeTargetPriceRepository();
		const service = new TargetPriceService(repository);

		await expect(service.setTargetPrice('user-1', '', 200)).rejects.toThrow(InvalidSymbolError);
		expect(repository.getCalls).toBe(0);
		expect(repository.saveCalls).toHaveLength(0);
	});

	it('rejects a whitespace-only symbol before repository access', async () => {
		const repository = new FakeTargetPriceRepository();
		const service = new TargetPriceService(repository);

		await expect(service.setTargetPrice('user-1', '   ', 200)).rejects.toThrow(InvalidSymbolError);
		expect(repository.getCalls).toBe(0);
		expect(repository.saveCalls).toHaveLength(0);
	});

	it.each([
		['zero', 0],
		['negative', -10],
		['NaN', Number.NaN],
		['Infinity', Number.POSITIVE_INFINITY],
		['-Infinity', Number.NEGATIVE_INFINITY]
	])('rejects a %s target price before repository access', async (_label, targetPrice) => {
		const repository = new FakeTargetPriceRepository();
		const service = new TargetPriceService(repository);

		await expect(service.setTargetPrice('user-1', 'AAPL', targetPrice)).rejects.toThrow(
			InvalidTargetPriceError
		);
		expect(repository.getCalls).toBe(0);
		expect(repository.saveCalls).toHaveLength(0);
	});

	it('persists Yahoo-style symbols unchanged, without rewriting them', async () => {
		const repository = new FakeTargetPriceRepository();
		const service = new TargetPriceService(repository);

		const result = await service.setTargetPrice('user-1', 'HEXA-B.ST', 99);

		expect(result).toEqual({ 'HEXA-B.ST': 99 });
	});

	it('propagates a repository save failure rather than reporting success', async () => {
		const failingRepository: TargetPriceRepository = {
			get: async () => ({}),
			save: async () => {
				throw new Error('simulated KV write failure');
			}
		};
		const service = new TargetPriceService(failingRepository);

		await expect(service.setTargetPrice('user-1', 'AAPL', 200)).rejects.toThrow(
			'simulated KV write failure'
		);
	});
});

describe('TargetPriceService independence', () => {
	it('operates using only a TargetPriceRepository — no other dependency is accepted', async () => {
		// TargetPriceService's constructor only accepts a TargetPriceRepository.
		// There is no parameter through which a WatchlistRepository, WatchlistService,
		// MarketDataProvider, or AuthenticationContext could be supplied.
		const repository = new FakeTargetPriceRepository();
		const service = new TargetPriceService(repository);

		const result = await service.setTargetPrice('user-1', 'AAPL', 200);

		expect(result).toEqual({ AAPL: 200 });
	});

	it('returns the raw numeric Target Price without calculating distance or savings', async () => {
		const repository = new FakeTargetPriceRepository();
		repository.seed('user-1', { AAPL: 200 });
		const service = new TargetPriceService(repository);

		const result = await service.getTargetPrice('user-1', 'AAPL');

		expect(result).toBe(200);
		expect(typeof result).toBe('number');
	});
});

describe('TargetPriceService user isolation', () => {
	it('keeps Target Prices for different users isolated on a shared repository', async () => {
		const repository = new FakeTargetPriceRepository();
		const service = new TargetPriceService(repository);

		await service.setTargetPrice('user-1', 'AAPL', 200);
		await service.setTargetPrice('user-2', 'AAPL', 250);
		await service.setTargetPrice('user-1', 'AAPL', 210);

		expect(await service.getTargetPrice('user-1', 'AAPL')).toBe(210);
		expect(await service.getTargetPrice('user-2', 'AAPL')).toBe(250);
	});
});
