import { describe, expect, it } from 'vitest';
import { InvalidTotalSavingsError } from '../domain/investmentAllocation';
import { MarketDataProviderError } from '../market-data/MarketDataProvider';
import { WatchlistNotFoundError } from '../watchlist/WatchlistServiceErrors';
import type { WatchlistQueryService } from '../watchlist/WatchlistQueryService';
import type { WatchlistStock, WatchlistView } from '../watchlist/WatchlistView';
import { InvestmentAllocationService } from './InvestmentAllocationService';

class FakeWatchlistQueryService implements Pick<WatchlistQueryService, 'getWatchlist'> {
	calls: { userId: string; watchlistId: string }[] = [];

	constructor(
		private readonly resolver: (userId: string, watchlistId: string) => Promise<WatchlistView>
	) {}

	async getWatchlist(userId: string, watchlistId: string): Promise<WatchlistView> {
		this.calls.push({ userId, watchlistId });
		return this.resolver(userId, watchlistId);
	}
}

function stock(
	symbol: string,
	distanceToTarget: number,
	overrides: Partial<WatchlistStock> = {}
): WatchlistStock {
	return { symbol, distanceToTarget, dividendYield: 0, ...overrides };
}

function view(stocks: WatchlistStock[], warnings: WatchlistView['warnings'] = []): WatchlistView {
	return { id: 'wl-1', name: 'Main', stocks, warnings };
}

function fixedQueryService(result: WatchlistView): FakeWatchlistQueryService {
	return new FakeWatchlistQueryService(async () => result);
}

describe('InvestmentAllocationService.calculateAllocation — normal allocation', () => {
	it('calculates factors, savings, and invested from concrete distanceToTarget values', async () => {
		const queryService = fixedQueryService(
			view([stock('AAPL', 1), stock('SAP.DE', -0.5), stock('GAW.L', 1)])
		);
		const service = new InvestmentAllocationService(queryService);

		const result = await service.calculateAllocation('user-1', 'wl-1', 300);

		expect(result.totalSavings).toBe(300);
		expect(result.allocations).toEqual([
			{ symbol: 'AAPL', factor: 0.5, savingsAmount: 50 },
			{ symbol: 'SAP.DE', factor: 2, savingsAmount: 200 },
			{ symbol: 'GAW.L', factor: 0.5, savingsAmount: 50 }
		]);
		expect(result.invested).toBe(300);
	});

	it('preserves Watchlist stock order in a deliberately non-alphabetical arrangement', async () => {
		const queryService = fixedQueryService(
			view([stock('SAP.DE', 1), stock('AAPL', -0.5), stock('GAW.L', 1)])
		);
		const service = new InvestmentAllocationService(queryService);

		const result = await service.calculateAllocation('user-1', 'wl-1', 300);

		expect(result.allocations.map((a) => a.symbol)).toEqual(['SAP.DE', 'AAPL', 'GAW.L']);
	});
});

describe('InvestmentAllocationService.calculateAllocation — rounding', () => {
	it('rounds each amount down without redistributing the remainder', async () => {
		const queryService = fixedQueryService(view([stock('A', 1), stock('B', 1), stock('C', 1)]));
		const service = new InvestmentAllocationService(queryService);

		const result = await service.calculateAllocation('user-1', 'wl-1', 100);

		expect(result.allocations.map((a) => a.savingsAmount)).toEqual([33, 33, 33]);
		expect(result.invested).toBe(99);
		expect(result.invested).toBeLessThan(result.totalSavings);
	});
});

describe('InvestmentAllocationService.calculateAllocation — zero-distance and missing data', () => {
	it('gives a zero-distance stock factor 0 and savings 0, per existing domain semantics', async () => {
		const queryService = fixedQueryService(view([stock('AAPL', 0), stock('SAP.DE', -0.5)]));
		const service = new InvestmentAllocationService(queryService);

		const result = await service.calculateAllocation('user-1', 'wl-1', 200);

		expect(result.allocations[0]).toEqual({ symbol: 'AAPL', factor: 0, savingsAmount: 0 });
		expect(result.allocations[1].savingsAmount).toBeGreaterThan(0);
	});

	it('treats missing-market-data distanceToTarget (0) the same as any other zero distance', async () => {
		// WatchlistQueryService already collapses missing price/target-price into distanceToTarget = 0.
		const queryService = fixedQueryService(view([stock('UNKNOWN', 0), stock('AAPL', 1)]));
		const service = new InvestmentAllocationService(queryService);

		const result = await service.calculateAllocation('user-1', 'wl-1', 100);

		expect(result.allocations[0]).toEqual({ symbol: 'UNKNOWN', factor: 0, savingsAmount: 0 });
		expect(result.allocations[1].savingsAmount).toBe(100);
	});

	it('produces invested 0 without NaN/Infinity when every stock has factor 0', async () => {
		const queryService = fixedQueryService(view([stock('A', 0), stock('B', 0), stock('C', 0)]));
		const service = new InvestmentAllocationService(queryService);

		const result = await service.calculateAllocation('user-1', 'wl-1', 1000);

		expect(result.allocations.map((a) => a.savingsAmount)).toEqual([0, 0, 0]);
		expect(result.invested).toBe(0);
		expect(Number.isFinite(result.invested)).toBe(true);
	});
});

describe('InvestmentAllocationService.calculateAllocation — totalSavings', () => {
	it('accepts totalSavings = 0, giving every stock 0 and invested 0', async () => {
		const queryService = fixedQueryService(view([stock('AAPL', -0.5), stock('SAP.DE', 1)]));
		const service = new InvestmentAllocationService(queryService);

		const result = await service.calculateAllocation('user-1', 'wl-1', 0);

		expect(result.totalSavings).toBe(0);
		expect(result.invested).toBe(0);
		expect(result.allocations.map((a) => a.savingsAmount)).toEqual([0, 0]);
	});

	it.each([
		['negative', -1],
		['fractional', 12.5],
		['NaN', Number.NaN],
		['Infinity', Number.POSITIVE_INFINITY],
		['-Infinity', Number.NEGATIVE_INFINITY]
	])(
		'propagates the existing domain validation for a %s totalSavings',
		async (_label, totalSavings) => {
			const queryService = fixedQueryService(view([stock('AAPL', -0.5)]));
			const service = new InvestmentAllocationService(queryService);

			await expect(service.calculateAllocation('user-1', 'wl-1', totalSavings)).rejects.toThrow(
				InvalidTotalSavingsError
			);
		}
	);
});

describe('InvestmentAllocationService.calculateAllocation — Watchlist edge cases', () => {
	it('returns an empty, valid allocation for an existing empty Watchlist', async () => {
		const queryService = fixedQueryService(view([]));
		const service = new InvestmentAllocationService(queryService);

		const result = await service.calculateAllocation('user-1', 'wl-1', 500);

		expect(result).toEqual({ totalSavings: 500, invested: 0, allocations: [] });
	});

	it('propagates WatchlistNotFoundError rather than returning an empty allocation', async () => {
		const queryService = new FakeWatchlistQueryService(async () => {
			throw new WatchlistNotFoundError('wl-missing');
		});
		const service = new InvestmentAllocationService(queryService);

		await expect(service.calculateAllocation('user-1', 'wl-missing', 100)).rejects.toThrow(
			WatchlistNotFoundError
		);
	});

	it('propagates a global market-data provider failure without producing a partial allocation', async () => {
		const queryService = new FakeWatchlistQueryService(async () => {
			throw new MarketDataProviderError('provider outage');
		});
		const service = new InvestmentAllocationService(queryService);

		await expect(service.calculateAllocation('user-1', 'wl-1', 100)).rejects.toThrow(
			MarketDataProviderError
		);
	});

	it('succeeds normally when the composed Watchlist carries an fx-provider-unavailable warning', async () => {
		const queryService = fixedQueryService(
			view([stock('AAPL', -0.5), stock('SAP.DE', 1)], ['fx-provider-unavailable'])
		);
		const service = new InvestmentAllocationService(queryService);

		const result = await service.calculateAllocation('user-1', 'wl-1', 300);

		expect(result.invested).toBeGreaterThan(0);
		expect(result.allocations).toHaveLength(2);
	});
});

describe('InvestmentAllocationService — read-only and user isolation', () => {
	it('requires no WatchlistRepository/TargetPriceRepository dependency (verified by the constructor signature)', async () => {
		// InvestmentAllocationService's constructor only accepts Pick<WatchlistQueryService, 'getWatchlist'> —
		// there is no parameter through which a WatchlistRepository or TargetPriceRepository could be supplied.
		const queryService = fixedQueryService(view([stock('AAPL', -0.5)]));
		const service = new InvestmentAllocationService(queryService);

		await expect(service.calculateAllocation('user-1', 'wl-1', 100)).resolves.toBeDefined();
	});

	it('passes userId and watchlistId through to WatchlistQueryService unchanged', async () => {
		const queryService = fixedQueryService(view([]));
		const service = new InvestmentAllocationService(queryService);

		await service.calculateAllocation('user-1', 'wl-1', 0);
		await service.calculateAllocation('user-2', 'wl-2', 0);

		expect(queryService.calls).toEqual([
			{ userId: 'user-1', watchlistId: 'wl-1' },
			{ userId: 'user-2', watchlistId: 'wl-2' }
		]);
	});
});
