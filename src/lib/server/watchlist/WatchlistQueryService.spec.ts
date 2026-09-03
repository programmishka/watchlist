import { describe, expect, it } from 'vitest';
import { ExchangeRateProviderError } from '../exchange-rates/ExchangeRateProvider';
import type {
	ExchangeRateBatchResult,
	ExchangeRateProvider
} from '../exchange-rates/ExchangeRateProvider';
import { MarketDataProviderError } from '../market-data/MarketDataProvider';
import type {
	MarketDataBatchResult,
	MarketDataProvider,
	StockMarketData
} from '../market-data/MarketDataProvider';
import type { TargetPriceRepository, TargetPrices } from '../persistence/TargetPriceRepository';
import type { WatchlistRepository, WatchlistsDocument } from '../persistence/WatchlistRepository';
import { WatchlistNotFoundError } from './WatchlistServiceErrors';
import { WatchlistQueryService } from './WatchlistQueryService';

class FakeWatchlistRepository implements WatchlistRepository {
	saveCalls: { userId: string; document: WatchlistsDocument }[] = [];
	constructor(private readonly documents = new Map<string, WatchlistsDocument>()) {}

	async get(userId: string): Promise<WatchlistsDocument> {
		return this.documents.get(userId) ?? { activeWatchlistId: undefined, watchlists: [] };
	}

	async save(userId: string, document: WatchlistsDocument): Promise<void> {
		this.saveCalls.push({ userId, document });
	}
}

class FakeTargetPriceRepository implements TargetPriceRepository {
	saveCalls: { userId: string; targetPrices: TargetPrices }[] = [];
	constructor(private readonly documents = new Map<string, TargetPrices>()) {}

	async get(userId: string): Promise<TargetPrices> {
		return this.documents.get(userId) ?? {};
	}

	async save(userId: string, targetPrices: TargetPrices): Promise<void> {
		this.saveCalls.push({ userId, targetPrices });
	}
}

class FakeMarketDataProvider implements MarketDataProvider {
	getQuotesCalls: string[][] = [];
	constructor(
		private readonly quotesBySymbol = new Map<string, StockMarketData>(),
		private readonly batchError?: Error
	) {}

	async getQuote(symbol: string): Promise<StockMarketData | undefined> {
		return this.quotesBySymbol.get(symbol);
	}

	async getQuotes(symbols: string[]): Promise<MarketDataBatchResult> {
		this.getQuotesCalls.push(symbols);
		if (this.batchError) {
			throw this.batchError;
		}
		const requested = new Set(symbols);
		// Iterate in seeding order (not request order) so tests can prove the
		// service reorders results by Watchlist order, not provider order.
		const found = [...this.quotesBySymbol.values()].filter((quote) => requested.has(quote.symbol));
		const foundSymbols = new Set(found.map((quote) => quote.symbol));
		const missing = symbols.filter((symbol) => !foundSymbols.has(symbol));
		return { found, missing };
	}
}

class FakeExchangeRateProvider implements ExchangeRateProvider {
	getRatesToUsdCalls: string[][] = [];
	constructor(
		private readonly ratesToUsd: Record<string, number> = {},
		private readonly error?: Error
	) {}

	async getRatesToUsd(currencies: string[]): Promise<ExchangeRateBatchResult> {
		this.getRatesToUsdCalls.push(currencies);
		if (this.error) {
			throw this.error;
		}
		const resolved: Record<string, number> = {};
		const missing: string[] = [];
		for (const currency of currencies) {
			if (currency === 'USD') {
				resolved.USD = 1;
				continue;
			}
			if (this.ratesToUsd[currency] !== undefined) {
				resolved[currency] = this.ratesToUsd[currency];
			} else {
				missing.push(currency);
			}
		}
		return { ratesToUsd: resolved, missing };
	}
}

function watchlistDocument(id: string, symbols: string[]): WatchlistsDocument {
	return {
		activeWatchlistId: id,
		watchlists: [{ id, name: 'Main', symbols }]
	};
}

describe('WatchlistQueryService.getWatchlist — basic queries', () => {
	it('composes a Watchlist with several symbols and complete market/FX data', async () => {
		const watchlistRepository = new FakeWatchlistRepository(
			new Map([['user-1', watchlistDocument('wl-1', ['AAPL'])]])
		);
		const targetPriceRepository = new FakeTargetPriceRepository(
			new Map([['user-1', { AAPL: 100 }]])
		);
		const marketDataProvider = new FakeMarketDataProvider(
			new Map([
				[
					'AAPL',
					{
						symbol: 'AAPL',
						name: 'Apple Inc.',
						price: 120,
						currency: 'USD',
						annualDividend: 1,
						marketCap: 2_500_000_000
					}
				]
			])
		);
		const exchangeRateProvider = new FakeExchangeRateProvider();
		const service = new WatchlistQueryService(
			watchlistRepository,
			targetPriceRepository,
			marketDataProvider,
			exchangeRateProvider
		);

		const result = await service.getWatchlist('user-1', 'wl-1');

		expect(result.id).toBe('wl-1');
		expect(result.name).toBe('Main');
		expect(result.warnings).toEqual([]);
		expect(result.stocks).toHaveLength(1);
		const [stock] = result.stocks;
		expect(stock.symbol).toBe('AAPL');
		expect(stock.name).toBe('Apple Inc.');
		expect(stock.price).toBe(120);
		expect(stock.currency).toBe('USD');
		expect(stock.targetPrice).toBe(100);
		expect(stock.distanceToTarget).toBeCloseTo(0.2);
		expect(stock.dividendYield).toBeCloseTo(1 / 120);
		expect(stock.marketCapBillionsUsd).toBe(2.5);
	});

	it('preserves Watchlist symbol order even when the provider returns a different order', async () => {
		const symbols = ['SAP.DE', 'AAPL', 'GAW.L'];
		const watchlistRepository = new FakeWatchlistRepository(
			new Map([['user-1', watchlistDocument('wl-1', symbols)]])
		);
		const targetPriceRepository = new FakeTargetPriceRepository();
		// Seeded in a different order than requested (AAPL, GAW.L, SAP.DE).
		const marketDataProvider = new FakeMarketDataProvider(
			new Map([
				['AAPL', { symbol: 'AAPL' }],
				['GAW.L', { symbol: 'GAW.L' }],
				['SAP.DE', { symbol: 'SAP.DE' }]
			])
		);
		const exchangeRateProvider = new FakeExchangeRateProvider();
		const service = new WatchlistQueryService(
			watchlistRepository,
			targetPriceRepository,
			marketDataProvider,
			exchangeRateProvider
		);

		const result = await service.getWatchlist('user-1', 'wl-1');

		expect(result.stocks.map((s) => s.symbol)).toEqual(symbols);
	});

	it('returns an empty stock list for an empty Watchlist without calling providers', async () => {
		const watchlistRepository = new FakeWatchlistRepository(
			new Map([['user-1', watchlistDocument('wl-1', [])]])
		);
		const targetPriceRepository = new FakeTargetPriceRepository();
		const marketDataProvider = new FakeMarketDataProvider();
		const exchangeRateProvider = new FakeExchangeRateProvider();
		const service = new WatchlistQueryService(
			watchlistRepository,
			targetPriceRepository,
			marketDataProvider,
			exchangeRateProvider
		);

		const result = await service.getWatchlist('user-1', 'wl-1');

		expect(result).toEqual({ id: 'wl-1', name: 'Main', stocks: [], warnings: [] });
		expect(marketDataProvider.getQuotesCalls).toHaveLength(0);
		expect(exchangeRateProvider.getRatesToUsdCalls).toHaveLength(0);
	});

	it('fails explicitly when the requested Watchlist does not exist', async () => {
		const watchlistRepository = new FakeWatchlistRepository();
		const service = new WatchlistQueryService(
			watchlistRepository,
			new FakeTargetPriceRepository(),
			new FakeMarketDataProvider(),
			new FakeExchangeRateProvider()
		);

		await expect(service.getWatchlist('user-1', 'missing-id')).rejects.toThrow(
			WatchlistNotFoundError
		);
	});
});

describe('WatchlistQueryService.getWatchlist — Target Price composition', () => {
	it('includes an existing Target Price and reflects it in distanceToTarget', async () => {
		const watchlistRepository = new FakeWatchlistRepository(
			new Map([['user-1', watchlistDocument('wl-1', ['AAPL'])]])
		);
		const targetPriceRepository = new FakeTargetPriceRepository(
			new Map([['user-1', { AAPL: 100 }]])
		);
		const marketDataProvider = new FakeMarketDataProvider(
			new Map([['AAPL', { symbol: 'AAPL', price: 80 }]])
		);
		const service = new WatchlistQueryService(
			watchlistRepository,
			targetPriceRepository,
			marketDataProvider,
			new FakeExchangeRateProvider()
		);

		const result = await service.getWatchlist('user-1', 'wl-1');

		expect(result.stocks[0].targetPrice).toBe(100);
		expect(result.stocks[0].distanceToTarget).toBeCloseTo(-0.2);
	});

	it('leaves targetPrice undefined when none is stored, using existing distance semantics', async () => {
		const watchlistRepository = new FakeWatchlistRepository(
			new Map([['user-1', watchlistDocument('wl-1', ['AAPL'])]])
		);
		const marketDataProvider = new FakeMarketDataProvider(
			new Map([['AAPL', { symbol: 'AAPL', price: 80 }]])
		);
		const service = new WatchlistQueryService(
			watchlistRepository,
			new FakeTargetPriceRepository(),
			marketDataProvider,
			new FakeExchangeRateProvider()
		);

		const result = await service.getWatchlist('user-1', 'wl-1');

		expect(result.stocks[0].targetPrice).toBeUndefined();
		expect(result.stocks[0].distanceToTarget).toBe(0);
	});

	it("uses only the requested user's Target Prices", async () => {
		const watchlistDoc = watchlistDocument('wl-1', ['AAPL']);
		const watchlistRepository = new FakeWatchlistRepository(
			new Map([
				['user-1', watchlistDoc],
				['user-2', watchlistDoc]
			])
		);
		const targetPriceRepository = new FakeTargetPriceRepository(
			new Map([
				['user-1', { AAPL: 100 }],
				['user-2', { AAPL: 999 }]
			])
		);
		const marketDataProvider = new FakeMarketDataProvider(
			new Map([['AAPL', { symbol: 'AAPL', price: 80 }]])
		);
		const service = new WatchlistQueryService(
			watchlistRepository,
			targetPriceRepository,
			marketDataProvider,
			new FakeExchangeRateProvider()
		);

		const user1Result = await service.getWatchlist('user-1', 'wl-1');
		const user2Result = await service.getWatchlist('user-2', 'wl-1');

		expect(user1Result.stocks[0].targetPrice).toBe(100);
		expect(user2Result.stocks[0].targetPrice).toBe(999);
	});
});

describe('WatchlistQueryService.getWatchlist — market-data partial success', () => {
	it('keeps all symbols, in order, when one has no market data', async () => {
		const watchlistRepository = new FakeWatchlistRepository(
			new Map([['user-1', watchlistDocument('wl-1', ['AAPL', 'UNKNOWN', 'SAP.DE'])]])
		);
		const targetPriceRepository = new FakeTargetPriceRepository(
			new Map([['user-1', { UNKNOWN: 42 }]])
		);
		const marketDataProvider = new FakeMarketDataProvider(
			new Map([
				['AAPL', { symbol: 'AAPL', price: 100, currency: 'USD' }],
				['SAP.DE', { symbol: 'SAP.DE', price: 200, currency: 'EUR' }]
			])
		);
		const service = new WatchlistQueryService(
			watchlistRepository,
			targetPriceRepository,
			marketDataProvider,
			new FakeExchangeRateProvider({ EUR: 1.1 })
		);

		const result = await service.getWatchlist('user-1', 'wl-1');

		expect(result.stocks.map((s) => s.symbol)).toEqual(['AAPL', 'UNKNOWN', 'SAP.DE']);
		const unknown = result.stocks[1];
		expect(unknown.symbol).toBe('UNKNOWN');
		expect(unknown.targetPrice).toBe(42);
		expect(unknown.price).toBeUndefined();
		expect(unknown.currency).toBeUndefined();
		expect(unknown.name).toBeUndefined();
		expect(unknown.marketCapBillionsUsd).toBeUndefined();
		expect(unknown.dividendYield).toBe(0);
		expect(unknown.distanceToTarget).toBe(0);
		expect(result.stocks[0].price).toBe(100);
		expect(result.stocks[2].price).toBe(200);
	});

	it('propagates a global market-data provider failure rather than treating symbols as individually missing', async () => {
		const watchlistRepository = new FakeWatchlistRepository(
			new Map([['user-1', watchlistDocument('wl-1', ['AAPL', 'SAP.DE'])]])
		);
		const marketDataProvider = new FakeMarketDataProvider(
			undefined,
			new MarketDataProviderError('provider outage')
		);
		const service = new WatchlistQueryService(
			watchlistRepository,
			new FakeTargetPriceRepository(),
			marketDataProvider,
			new FakeExchangeRateProvider()
		);

		await expect(service.getWatchlist('user-1', 'wl-1')).rejects.toThrow(MarketDataProviderError);
	});
});

describe('WatchlistQueryService.getWatchlist — dividend yield composition', () => {
	it('composes the standard dividend yield from raw market data', async () => {
		const watchlistRepository = new FakeWatchlistRepository(
			new Map([['user-1', watchlistDocument('wl-1', ['AAPL'])]])
		);
		const marketDataProvider = new FakeMarketDataProvider(
			new Map([['AAPL', { symbol: 'AAPL', price: 100, currency: 'USD', annualDividend: 5 }]])
		);
		const service = new WatchlistQueryService(
			watchlistRepository,
			new FakeTargetPriceRepository(),
			marketDataProvider,
			new FakeExchangeRateProvider()
		);

		const result = await service.getWatchlist('user-1', 'wl-1');

		expect(result.stocks[0].dividendYield).toBeCloseTo(0.05);
	});

	it('applies the existing GBp dividend unit normalization', async () => {
		const watchlistRepository = new FakeWatchlistRepository(
			new Map([['user-1', watchlistDocument('wl-1', ['SHEL.L'])]])
		);
		const marketDataProvider = new FakeMarketDataProvider(
			new Map([
				['SHEL.L', { symbol: 'SHEL.L', price: 18_000, currency: 'GBp', annualDividend: 4.85 }]
			])
		);
		const service = new WatchlistQueryService(
			watchlistRepository,
			new FakeTargetPriceRepository(),
			marketDataProvider,
			new FakeExchangeRateProvider()
		);

		const result = await service.getWatchlist('user-1', 'wl-1');

		expect(result.stocks[0].dividendYield).toBeCloseTo(0.026944, 5);
	});
});

describe('WatchlistQueryService.getWatchlist — market cap / FX composition', () => {
	it('converts a USD market cap without requiring external FX data', async () => {
		const watchlistRepository = new FakeWatchlistRepository(
			new Map([['user-1', watchlistDocument('wl-1', ['AAPL'])]])
		);
		const marketDataProvider = new FakeMarketDataProvider(
			new Map([['AAPL', { symbol: 'AAPL', currency: 'USD', marketCap: 2_500_000_000 }]])
		);
		const service = new WatchlistQueryService(
			watchlistRepository,
			new FakeTargetPriceRepository(),
			marketDataProvider,
			new FakeExchangeRateProvider()
		);

		const result = await service.getWatchlist('user-1', 'wl-1');

		expect(result.stocks[0].marketCapBillionsUsd).toBe(2.5);
	});

	it('converts a non-USD market cap using a deterministic exchange rate', async () => {
		const watchlistRepository = new FakeWatchlistRepository(
			new Map([['user-1', watchlistDocument('wl-1', ['SAP.DE'])]])
		);
		const marketDataProvider = new FakeMarketDataProvider(
			new Map([['SAP.DE', { symbol: 'SAP.DE', currency: 'EUR', marketCap: 10_000_000_000 }]])
		);
		const service = new WatchlistQueryService(
			watchlistRepository,
			new FakeTargetPriceRepository(),
			marketDataProvider,
			new FakeExchangeRateProvider({ EUR: 1.2 })
		);

		const result = await service.getWatchlist('user-1', 'wl-1');

		expect(result.stocks[0].marketCapBillionsUsd).toBe(12);
	});

	it('maps GBp to GBP for market-cap FX without scaling the raw value', async () => {
		const watchlistRepository = new FakeWatchlistRepository(
			new Map([['user-1', watchlistDocument('wl-1', ['SHEL.L'])]])
		);
		const marketDataProvider = new FakeMarketDataProvider(
			new Map([['SHEL.L', { symbol: 'SHEL.L', currency: 'GBp', marketCap: 187_662_401_536 }]])
		);
		const exchangeRateProvider = new FakeExchangeRateProvider({ GBP: 1 / 0.74167 });
		const service = new WatchlistQueryService(
			watchlistRepository,
			new FakeTargetPriceRepository(),
			marketDataProvider,
			exchangeRateProvider
		);

		const result = await service.getWatchlist('user-1', 'wl-1');

		expect(exchangeRateProvider.getRatesToUsdCalls[0]).toEqual(['GBP']);
		expect(result.stocks[0].marketCapBillionsUsd).toBeCloseTo(187.662401536 / 0.74167, 5);
	});

	it('leaves only the affected stock unavailable when its market cap is missing', async () => {
		const watchlistRepository = new FakeWatchlistRepository(
			new Map([['user-1', watchlistDocument('wl-1', ['AAPL', 'RELIANCE.NS'])]])
		);
		const marketDataProvider = new FakeMarketDataProvider(
			new Map([
				['AAPL', { symbol: 'AAPL', currency: 'USD', marketCap: 1_000_000_000 }],
				['RELIANCE.NS', { symbol: 'RELIANCE.NS', currency: 'INR' }]
			])
		);
		const service = new WatchlistQueryService(
			watchlistRepository,
			new FakeTargetPriceRepository(),
			marketDataProvider,
			new FakeExchangeRateProvider({ INR: 1 / 90 })
		);

		const result = await service.getWatchlist('user-1', 'wl-1');

		expect(result.stocks[0].marketCapBillionsUsd).toBe(1);
		expect(result.stocks[1].marketCapBillionsUsd).toBeUndefined();
	});

	it('leaves only the affected stocks unavailable when the FX provider omits one requested currency', async () => {
		const watchlistRepository = new FakeWatchlistRepository(
			new Map([['user-1', watchlistDocument('wl-1', ['AAPL', 'SWISS'])]])
		);
		const marketDataProvider = new FakeMarketDataProvider(
			new Map([
				['AAPL', { symbol: 'AAPL', currency: 'USD', marketCap: 1_000_000_000 }],
				['SWISS', { symbol: 'SWISS', currency: 'CHF', marketCap: 500_000_000 }]
			])
		);
		// CHF deliberately not included -> FakeExchangeRateProvider reports it missing.
		const service = new WatchlistQueryService(
			watchlistRepository,
			new FakeTargetPriceRepository(),
			marketDataProvider,
			new FakeExchangeRateProvider({})
		);

		const result = await service.getWatchlist('user-1', 'wl-1');

		expect(result.stocks[0].marketCapBillionsUsd).toBe(1);
		expect(result.stocks[1].marketCapBillionsUsd).toBeUndefined();
		expect(result.warnings).toEqual([]);
	});
});

describe('WatchlistQueryService.getWatchlist — global FX provider failure', () => {
	it('still converts USD market caps, leaves non-USD unavailable, keeps other fields, and warns', async () => {
		const watchlistRepository = new FakeWatchlistRepository(
			new Map([['user-1', watchlistDocument('wl-1', ['AAPL', 'SAP.DE'])]])
		);
		const targetPriceRepository = new FakeTargetPriceRepository(
			new Map([['user-1', { AAPL: 100, 'SAP.DE': 150 }]])
		);
		const marketDataProvider = new FakeMarketDataProvider(
			new Map([
				[
					'AAPL',
					{
						symbol: 'AAPL',
						name: 'Apple Inc.',
						price: 120,
						currency: 'USD',
						annualDividend: 1,
						marketCap: 1_000_000_000
					}
				],
				[
					'SAP.DE',
					{
						symbol: 'SAP.DE',
						name: 'SAP SE',
						price: 180,
						currency: 'EUR',
						annualDividend: 2,
						marketCap: 2_000_000_000
					}
				]
			])
		);
		const exchangeRateProvider = new FakeExchangeRateProvider(
			{},
			new ExchangeRateProviderError('Frankfurter unavailable')
		);
		const service = new WatchlistQueryService(
			watchlistRepository,
			targetPriceRepository,
			marketDataProvider,
			exchangeRateProvider
		);

		const result = await service.getWatchlist('user-1', 'wl-1');

		expect(result.warnings).toEqual(['fx-provider-unavailable']);

		const aapl = result.stocks[0];
		expect(aapl.marketCapBillionsUsd).toBe(1);
		expect(aapl.name).toBe('Apple Inc.');
		expect(aapl.price).toBe(120);
		expect(aapl.currency).toBe('USD');
		expect(aapl.dividendYield).toBeCloseTo(1 / 120);
		expect(aapl.targetPrice).toBe(100);
		expect(aapl.distanceToTarget).toBeCloseTo(0.2);

		const sapDe = result.stocks[1];
		expect(sapDe.marketCapBillionsUsd).toBeUndefined();
		expect(sapDe.name).toBe('SAP SE');
		expect(sapDe.price).toBe(180);
		expect(sapDe.currency).toBe('EUR');
		expect(sapDe.dividendYield).toBeCloseTo(2 / 180);
		expect(sapDe.targetPrice).toBe(150);
	});
});

describe('WatchlistQueryService.getWatchlist — read-only behavior', () => {
	it('never calls WatchlistRepository.save or TargetPriceRepository.save', async () => {
		const watchlistRepository = new FakeWatchlistRepository(
			new Map([['user-1', watchlistDocument('wl-1', ['AAPL'])]])
		);
		const targetPriceRepository = new FakeTargetPriceRepository(
			new Map([['user-1', { AAPL: 100 }]])
		);
		const marketDataProvider = new FakeMarketDataProvider(
			new Map([['AAPL', { symbol: 'AAPL', price: 120, currency: 'USD', marketCap: 1_000_000_000 }]])
		);
		const service = new WatchlistQueryService(
			watchlistRepository,
			targetPriceRepository,
			marketDataProvider,
			new FakeExchangeRateProvider()
		);

		await service.getWatchlist('user-1', 'wl-1');

		expect(watchlistRepository.saveCalls).toHaveLength(0);
		expect(targetPriceRepository.saveCalls).toHaveLength(0);
	});
});

describe('WatchlistQueryService.getWatchlist — user isolation', () => {
	it('composes the same watchlistId/symbol independently per user', async () => {
		const watchlistRepository = new FakeWatchlistRepository(
			new Map([
				['user-1', watchlistDocument('wl-1', ['AAPL'])],
				['user-2', watchlistDocument('wl-1', ['AAPL'])]
			])
		);
		const targetPriceRepository = new FakeTargetPriceRepository(
			new Map([
				['user-1', { AAPL: 100 }],
				['user-2', { AAPL: 999 }]
			])
		);
		const marketDataProvider = new FakeMarketDataProvider(
			new Map([['AAPL', { symbol: 'AAPL', price: 120 }]])
		);
		const service = new WatchlistQueryService(
			watchlistRepository,
			targetPriceRepository,
			marketDataProvider,
			new FakeExchangeRateProvider()
		);

		const user1Result = await service.getWatchlist('user-1', 'wl-1');
		const user2Result = await service.getWatchlist('user-2', 'wl-1');

		expect(user1Result.stocks[0].targetPrice).toBe(100);
		expect(user2Result.stocks[0].targetPrice).toBe(999);
	});
});
