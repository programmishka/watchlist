import { describe, expect, it } from 'vitest';
import { InvestmentAllocationService } from '../investment-allocation/InvestmentAllocationService';
import { AddStockToWatchlistService } from '../watchlist/AddStockToWatchlistService';
import { WatchlistQueryService } from '../watchlist/WatchlistQueryService';
import { WatchlistService } from '../watchlist/WatchlistService';
import { TargetPriceService } from '../target-price/TargetPriceService';
import { createApplicationServices, PlatformUnavailableError } from './createApplicationServices';

class FakeKv {
	async get(): Promise<string | null> {
		return null;
	}
	async put(): Promise<void> {}
}

describe('createApplicationServices', () => {
	it('throws PlatformUnavailableError when platform is undefined', () => {
		expect(() => createApplicationServices(undefined)).toThrow(PlatformUnavailableError);
	});

	it('throws PlatformUnavailableError when the WATCHLIST_KV binding is missing', () => {
		const platform = { env: {} } as unknown as App.Platform;

		expect(() => createApplicationServices(platform)).toThrow(PlatformUnavailableError);
	});

	it('constructs the full application service graph from a KV binding, without live network access', () => {
		const platform = { env: { WATCHLIST_KV: new FakeKv() } } as unknown as App.Platform;

		const services = createApplicationServices(platform);

		expect(services.watchlistService).toBeInstanceOf(WatchlistService);
		expect(services.targetPriceService).toBeInstanceOf(TargetPriceService);
		expect(services.addStockToWatchlistService).toBeInstanceOf(AddStockToWatchlistService);
		expect(services.watchlistQueryService).toBeInstanceOf(WatchlistQueryService);
		expect(services.investmentAllocationService).toBeInstanceOf(InvestmentAllocationService);
		expect(services.marketDataProvider).toBeDefined();
	});
});
