import { describe, expect, it } from 'vitest';
import { MarketDataProviderError } from '../market-data/MarketDataProvider';
import type { MarketDataProvider, StockMarketData } from '../market-data/MarketDataProvider';
import type { TargetPriceRepository, TargetPrices } from '../persistence/TargetPriceRepository';
import { setTargetPrice } from '../api/targetPriceHandlers';
import type { TargetPriceMutationResponse } from '../api/targetPriceHandlers';
import { TargetPriceService } from './TargetPriceService';

class FakeTargetPriceRepository implements TargetPriceRepository {
	constructor(private readonly documents = new Map<string, TargetPrices>()) {}

	async get(userId: string): Promise<TargetPrices> {
		return this.documents.get(userId) ?? {};
	}

	async save(userId: string, targetPrices: TargetPrices): Promise<void> {
		this.documents.set(userId, targetPrices);
	}
}

function marketDataProvider(quote?: StockMarketData, error?: Error): MarketDataProvider {
	return {
		async getQuote(): Promise<StockMarketData | undefined> {
			if (error) {
				throw error;
			}
			return quote;
		},
		async getQuotes() {
			throw new Error('getQuotes should not be called by the Target Price route');
		},
		async resolveSymbol() {
			throw new Error('resolveSymbol should not be called by the Target Price route');
		}
	};
}

describe('setTargetPrice route handler', () => {
	it('persists the Target Price and returns the refreshed distance when market data is available', async () => {
		const targetPriceService = new TargetPriceService(new FakeTargetPriceRepository());
		const provider = marketDataProvider({ symbol: 'AAPL', price: 80 });

		const response = await setTargetPrice('user-1', 'AAPL', 100, targetPriceService, provider);
		const body = (await response.json()) as TargetPriceMutationResponse;

		expect(body.symbol).toBe('AAPL');
		expect(body.targetPrice).toBe(100);
		expect(body.distanceToTarget).toBeCloseTo(-0.2);
		expect(body.warnings).toEqual([]);
	});

	it('preserves a decimal target price', async () => {
		const targetPriceService = new TargetPriceService(new FakeTargetPriceRepository());
		const provider = marketDataProvider({ symbol: 'AAPL', price: 100 });

		const body = (await (
			await setTargetPrice('user-1', 'AAPL', 205.5, targetPriceService, provider)
		).json()) as TargetPriceMutationResponse;

		expect(body.targetPrice).toBe(205.5);
	});

	it('keeps the persisted Target Price when the market-data provider fails after save', async () => {
		const repository = new FakeTargetPriceRepository();
		const targetPriceService = new TargetPriceService(repository);
		const provider = marketDataProvider(undefined, new MarketDataProviderError('outage'));

		const response = await setTargetPrice('user-1', 'AAPL', 100, targetPriceService, provider);
		const body = (await response.json()) as TargetPriceMutationResponse;

		expect(await repository.get('user-1')).toEqual({ AAPL: 100 });
		expect(response.status).toBe(200);
		expect(body.symbol).toBe('AAPL');
		expect(body.targetPrice).toBe(100);
		expect(body.distanceToTarget).toBeUndefined();
		expect(body.warnings).toEqual([
			{
				code: 'MARKET_DATA_UNAVAILABLE',
				message: 'Current market data is temporarily unavailable.'
			}
		]);
	});

	it('keeps the persisted Target Price when Yahoo currently has no data for the symbol', async () => {
		const repository = new FakeTargetPriceRepository();
		const targetPriceService = new TargetPriceService(repository);
		const provider = marketDataProvider(undefined);

		const response = await setTargetPrice('user-1', 'AAPL', 100, targetPriceService, provider);
		const body = (await response.json()) as TargetPriceMutationResponse;

		expect(await repository.get('user-1')).toEqual({ AAPL: 100 });
		expect(response.status).toBe(200);
		expect(body.distanceToTarget).toBeUndefined();
		expect(body.warnings).toEqual([
			{
				code: 'MARKET_DATA_UNAVAILABLE',
				message: 'Current market data is temporarily unavailable.'
			}
		]);
	});

	it('propagates a non-provider error from the refresh step rather than swallowing it', async () => {
		const targetPriceService = new TargetPriceService(new FakeTargetPriceRepository());
		const provider = marketDataProvider(undefined, new TypeError('unexpected bug'));

		await expect(
			setTargetPrice('user-1', 'AAPL', 100, targetPriceService, provider)
		).rejects.toThrow(TypeError);
	});

	it('trims the symbol before persistence, lookup, and the response', async () => {
		const repository = new FakeTargetPriceRepository();
		const targetPriceService = new TargetPriceService(repository);
		const provider = marketDataProvider({ symbol: 'GAW.L', price: 150 });

		const body = (await (
			await setTargetPrice('user-1', '  GAW.L  ', 150, targetPriceService, provider)
		).json()) as TargetPriceMutationResponse;

		expect(body.symbol).toBe('GAW.L');
		expect(await repository.get('user-1')).toEqual({ 'GAW.L': 150 });
	});
});
