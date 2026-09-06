import { describe, expect, it } from 'vitest';
import {
	ExchangeRateProviderError,
	type ExchangeRateBatchResult,
	type ExchangeRateProvider
} from '../exchange-rates/ExchangeRateProvider';
import type {
	MarketDataBatchResult,
	MarketDataProvider,
	ResolvedMarketSymbol,
	StockMarketData
} from '../market-data/MarketDataProvider';
import type { TargetPriceRepository, TargetPrices } from '../persistence/TargetPriceRepository';
import type { WatchlistRepository, WatchlistsDocument } from '../persistence/WatchlistRepository';
import { AddStockToWatchlistService } from '../watchlist/AddStockToWatchlistService';
import {
	DuplicateSymbolError,
	SymbolNotFoundError,
	UnknownStockSymbolError,
	WatchlistNotFoundError
} from '../watchlist/WatchlistServiceErrors';
import { WatchlistQueryService } from '../watchlist/WatchlistQueryService';
import { WatchlistService } from '../watchlist/WatchlistService';
import {
	addStock,
	createWatchlist,
	deleteActiveWatchlist,
	getComposedWatchlist,
	listWatchlists,
	removeStock,
	selectActiveWatchlist
} from './watchlistHandlers';
import type { WatchlistViewResponse, WatchlistsMetadataResponse } from './watchlistDto';

class FakeWatchlistRepository implements WatchlistRepository {
	constructor(private readonly documents = new Map<string, WatchlistsDocument>()) {}

	async get(userId: string): Promise<WatchlistsDocument> {
		return this.documents.get(userId) ?? { activeWatchlistId: undefined, watchlists: [] };
	}

	async save(userId: string, document: WatchlistsDocument): Promise<void> {
		this.documents.set(userId, document);
	}
}

class FakeTargetPriceRepository implements TargetPriceRepository {
	constructor(private readonly documents = new Map<string, TargetPrices>()) {}

	async get(userId: string): Promise<TargetPrices> {
		return this.documents.get(userId) ?? {};
	}

	async save(userId: string, targetPrices: TargetPrices): Promise<void> {
		this.documents.set(userId, targetPrices);
	}
}

class FakeMarketDataProvider implements MarketDataProvider {
	constructor(private readonly quotesBySymbol = new Map<string, StockMarketData>()) {}

	async getQuote(symbol: string): Promise<StockMarketData | undefined> {
		return this.quotesBySymbol.get(symbol);
	}

	async getQuotes(symbols: string[]): Promise<MarketDataBatchResult> {
		const requested = new Set(symbols);
		const found = [...this.quotesBySymbol.values()].filter((quote) => requested.has(quote.symbol));
		const foundSymbols = new Set(found.map((quote) => quote.symbol));
		return { found, missing: symbols.filter((symbol) => !foundSymbols.has(symbol)) };
	}

	async resolveSymbol(symbol: string): Promise<ResolvedMarketSymbol | undefined> {
		const quote = this.quotesBySymbol.get(symbol);
		return quote && quote.symbol === symbol ? { symbol: quote.symbol } : undefined;
	}
}

class FakeExchangeRateProvider implements ExchangeRateProvider {
	constructor(private readonly rates: Record<string, number> = {}) {}

	async getRatesToUsd(currencies: string[]): Promise<ExchangeRateBatchResult> {
		const ratesToUsd: Record<string, number> = {};
		const missing: string[] = [];
		for (const currency of currencies) {
			if (currency === 'USD') {
				ratesToUsd.USD = 1;
				continue;
			}
			if (this.rates[currency] !== undefined) {
				ratesToUsd[currency] = this.rates[currency];
			} else {
				missing.push(currency);
			}
		}
		return { ratesToUsd, missing };
	}
}

function watchlistDocument(id: string, symbols: string[], name = 'Main'): WatchlistsDocument {
	return { activeWatchlistId: id, watchlists: [{ id, name, symbols }] };
}

function buildServices(options?: {
	watchlists?: Map<string, WatchlistsDocument>;
	targetPrices?: Map<string, TargetPrices>;
	quotes?: Map<string, StockMarketData>;
	rates?: Record<string, number>;
}) {
	const watchlistRepository = new FakeWatchlistRepository(options?.watchlists);
	const targetPriceRepository = new FakeTargetPriceRepository(options?.targetPrices);
	const marketDataProvider = new FakeMarketDataProvider(options?.quotes);
	const exchangeRateProvider = new FakeExchangeRateProvider(options?.rates);

	const watchlistService = new WatchlistService(watchlistRepository);
	const addStockToWatchlistService = new AddStockToWatchlistService(
		marketDataProvider,
		watchlistService
	);
	const watchlistQueryService = new WatchlistQueryService(
		watchlistRepository,
		targetPriceRepository,
		marketDataProvider,
		exchangeRateProvider
	);

	return { watchlistService, addStockToWatchlistService, watchlistQueryService };
}

describe('listWatchlists', () => {
	it('returns existing watchlists including the active id', async () => {
		const { watchlistService } = buildServices({
			watchlists: new Map([
				[
					'user-1',
					{
						activeWatchlistId: 'wl-1',
						watchlists: [
							{ id: 'wl-1', name: 'Main', symbols: ['AAPL'] },
							{ id: 'wl-2', name: 'Dividend', symbols: [] }
						]
					}
				]
			])
		});

		const response = await listWatchlists('user-1', watchlistService);
		const body = (await response.json()) as WatchlistsMetadataResponse;

		expect(body).toEqual({
			activeWatchlistId: 'wl-1',
			watchlists: [
				{ id: 'wl-1', name: 'Main' },
				{ id: 'wl-2', name: 'Dividend' }
			]
		});
	});

	it('returns the empty state for a user with no watchlists', async () => {
		const { watchlistService } = buildServices();

		const body = (await (
			await listWatchlists('user-1', watchlistService)
		).json()) as WatchlistsMetadataResponse;

		expect(body).toEqual({ watchlists: [] });
	});

	it('preserves duplicate watchlist names', async () => {
		const { watchlistService } = buildServices({
			watchlists: new Map([
				[
					'user-1',
					{
						activeWatchlistId: 'wl-1',
						watchlists: [
							{ id: 'wl-1', name: 'Dividend', symbols: [] },
							{ id: 'wl-2', name: 'Dividend', symbols: [] }
						]
					}
				]
			])
		});

		const body = (await (
			await listWatchlists('user-1', watchlistService)
		).json()) as WatchlistsMetadataResponse;

		expect(body.watchlists.map((w: { name: string }) => w.name)).toEqual(['Dividend', 'Dividend']);
	});
});

describe('createWatchlist', () => {
	it('creates a watchlist and returns updated metadata with it active', async () => {
		const { watchlistService } = buildServices();

		const body = (await (
			await createWatchlist('user-1', 'Main', watchlistService)
		).json()) as WatchlistsMetadataResponse;

		expect(body.watchlists).toHaveLength(1);
		expect(body.watchlists[0].name).toBe('Main');
		expect(body.activeWatchlistId).toBe(body.watchlists[0].id);
	});

	it('allows a duplicate name for a second watchlist', async () => {
		const { watchlistService } = buildServices({
			watchlists: new Map([['user-1', watchlistDocument('wl-1', [], 'Dividend')]])
		});

		const body = (await (
			await createWatchlist('user-1', 'Dividend', watchlistService)
		).json()) as WatchlistsMetadataResponse;

		expect(body.watchlists.map((w: { name: string }) => w.name)).toEqual(['Dividend', 'Dividend']);
	});
});

describe('selectActiveWatchlist', () => {
	it('selects an existing watchlist as active', async () => {
		const { watchlistService } = buildServices({
			watchlists: new Map([
				[
					'user-1',
					{
						activeWatchlistId: 'wl-1',
						watchlists: [
							{ id: 'wl-1', name: 'Main', symbols: [] },
							{ id: 'wl-2', name: 'Dividend', symbols: [] }
						]
					}
				]
			])
		});

		const body = (await (
			await selectActiveWatchlist('user-1', 'wl-2', watchlistService)
		).json()) as WatchlistsMetadataResponse;

		expect(body.activeWatchlistId).toBe('wl-2');
	});

	it('rejects a missing watchlist with WatchlistNotFoundError', async () => {
		const { watchlistService } = buildServices();

		await expect(selectActiveWatchlist('user-1', 'missing-id', watchlistService)).rejects.toThrow(
			WatchlistNotFoundError
		);
	});
});

describe('deleteActiveWatchlist', () => {
	it('deletes the active watchlist and returns the updated metadata', async () => {
		const { watchlistService } = buildServices({
			watchlists: new Map([
				[
					'user-1',
					{
						activeWatchlistId: 'a',
						watchlists: [
							{ id: 'a', name: 'A', symbols: [] },
							{ id: 'b', name: 'B', symbols: [] }
						]
					}
				]
			])
		});

		const body = (await (
			await deleteActiveWatchlist('user-1', watchlistService)
		).json()) as WatchlistsMetadataResponse;

		expect(body).toEqual({ activeWatchlistId: 'b', watchlists: [{ id: 'b', name: 'B' }] });
	});

	it('returns the empty state after deleting the final watchlist', async () => {
		const { watchlistService } = buildServices({
			watchlists: new Map([['user-1', watchlistDocument('wl-1', [])]])
		});

		const body = (await (
			await deleteActiveWatchlist('user-1', watchlistService)
		).json()) as WatchlistsMetadataResponse;

		expect(body).toEqual({ watchlists: [] });
	});
});

describe('getComposedWatchlist', () => {
	it('maps a representative WatchlistView, including a missing-field stock and an FX warning', async () => {
		const { watchlistQueryService } = buildServices({
			watchlists: new Map([['user-1', watchlistDocument('wl-1', ['AAPL', 'UNKNOWN', 'SAP.DE'])]]),
			targetPrices: new Map([['user-1', { AAPL: 100, UNKNOWN: 42 }]]),
			quotes: new Map([
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
				['SAP.DE', { symbol: 'SAP.DE', price: 180, currency: 'EUR', marketCap: 2_000_000_000 }]
				// EUR rate deliberately omitted -> partial FX unavailability for SAP.DE only
			])
		});

		const body = (await (
			await getComposedWatchlist('user-1', 'wl-1', watchlistQueryService)
		).json()) as WatchlistViewResponse;

		expect(body.id).toBe('wl-1');
		expect(body.stocks.map((s: { symbol: string }) => s.symbol)).toEqual([
			'AAPL',
			'UNKNOWN',
			'SAP.DE'
		]);

		const aapl = body.stocks[0];
		expect(aapl.name).toBe('Apple Inc.');
		expect(aapl.price).toBe(120);
		expect(aapl.currency).toBe('USD');
		expect(aapl.targetPrice).toBe(100);
		expect(aapl.marketCapBillionsUsd).toBe(1);
		expect(aapl.dividendYield).toBeCloseTo(1 / 120);

		const unknown = body.stocks[1];
		expect(unknown.targetPrice).toBe(42);
		expect(unknown.price).toBeUndefined();
		expect(unknown.marketCapBillionsUsd).toBeUndefined();

		const sapDe = body.stocks[2];
		expect(sapDe.marketCapBillionsUsd).toBeUndefined();
	});

	it('surfaces the FX_PROVIDER_UNAVAILABLE warning code for a global FX outage', async () => {
		class FailingExchangeRateProvider implements ExchangeRateProvider {
			async getRatesToUsd(): Promise<ExchangeRateBatchResult> {
				throw new ExchangeRateProviderError('outage');
			}
		}
		const watchlistRepository = new FakeWatchlistRepository(
			new Map([['user-1', watchlistDocument('wl-1', ['SAP.DE'])]])
		);
		const targetPriceRepository = new FakeTargetPriceRepository();
		const marketDataProvider = new FakeMarketDataProvider(
			new Map([['SAP.DE', { symbol: 'SAP.DE', currency: 'EUR', marketCap: 1_000_000_000 }]])
		);
		const watchlistQueryService = new WatchlistQueryService(
			watchlistRepository,
			targetPriceRepository,
			marketDataProvider,
			new FailingExchangeRateProvider()
		);

		const body = (await (
			await getComposedWatchlist('user-1', 'wl-1', watchlistQueryService)
		).json()) as WatchlistViewResponse;

		expect(body.warnings).toEqual([
			{ code: 'FX_PROVIDER_UNAVAILABLE', message: 'Currency conversion is currently unavailable.' }
		]);
	});

	it('rejects a missing watchlist with WatchlistNotFoundError', async () => {
		const { watchlistQueryService } = buildServices();

		await expect(
			getComposedWatchlist('user-1', 'missing-id', watchlistQueryService)
		).rejects.toThrow(WatchlistNotFoundError);
	});
});

describe('addStock', () => {
	it('validates and adds the symbol, returning the updated composed watchlist', async () => {
		const { addStockToWatchlistService, watchlistQueryService } = buildServices({
			watchlists: new Map([['user-1', watchlistDocument('wl-1', [])]]),
			quotes: new Map([['AAPL', { symbol: 'AAPL', name: 'Apple Inc.' }]])
		});

		const body = (await (
			await addStock('user-1', 'wl-1', 'AAPL', addStockToWatchlistService, watchlistQueryService)
		).json()) as WatchlistViewResponse;

		expect(body.stocks.map((s: { symbol: string }) => s.symbol)).toEqual(['AAPL']);
	});

	it('rejects an unknown Yahoo symbol with UnknownStockSymbolError', async () => {
		const { addStockToWatchlistService, watchlistQueryService } = buildServices({
			watchlists: new Map([['user-1', watchlistDocument('wl-1', [])]])
		});

		await expect(
			addStock(
				'user-1',
				'wl-1',
				'DOES-NOT-EXIST',
				addStockToWatchlistService,
				watchlistQueryService
			)
		).rejects.toThrow(UnknownStockSymbolError);
	});

	it('rejects a duplicate symbol with DuplicateSymbolError', async () => {
		const { addStockToWatchlistService, watchlistQueryService } = buildServices({
			watchlists: new Map([['user-1', watchlistDocument('wl-1', ['AAPL'])]]),
			quotes: new Map([['AAPL', { symbol: 'AAPL' }]])
		});

		await expect(
			addStock('user-1', 'wl-1', 'AAPL', addStockToWatchlistService, watchlistQueryService)
		).rejects.toThrow(DuplicateSymbolError);
	});

	it('rejects a missing watchlist with WatchlistNotFoundError', async () => {
		const { addStockToWatchlistService, watchlistQueryService } = buildServices({
			quotes: new Map([['AAPL', { symbol: 'AAPL' }]])
		});

		await expect(
			addStock('user-1', 'missing-id', 'AAPL', addStockToWatchlistService, watchlistQueryService)
		).rejects.toThrow(WatchlistNotFoundError);
	});
});

describe('removeStock', () => {
	it('removes the symbol and returns the updated composed watchlist', async () => {
		const { watchlistService, watchlistQueryService } = buildServices({
			watchlists: new Map([['user-1', watchlistDocument('wl-1', ['AAPL', 'MSFT'])]])
		});

		const body = (await (
			await removeStock('user-1', 'wl-1', 'AAPL', watchlistService, watchlistQueryService)
		).json()) as WatchlistViewResponse;

		expect(body.stocks.map((s: { symbol: string }) => s.symbol)).toEqual(['MSFT']);
	});

	it('handles representative dotted/hyphenated symbols', async () => {
		const { watchlistService, watchlistQueryService } = buildServices({
			watchlists: new Map([['user-1', watchlistDocument('wl-1', ['GAW.L', 'HEXA-B.ST'])]])
		});

		const body = (await (
			await removeStock('user-1', 'wl-1', 'HEXA-B.ST', watchlistService, watchlistQueryService)
		).json()) as WatchlistViewResponse;

		expect(body.stocks.map((s: { symbol: string }) => s.symbol)).toEqual(['GAW.L']);
	});

	it('rejects a missing symbol with SymbolNotFoundError', async () => {
		const { watchlistService, watchlistQueryService } = buildServices({
			watchlists: new Map([['user-1', watchlistDocument('wl-1', ['AAPL'])]])
		});

		await expect(
			removeStock('user-1', 'wl-1', 'MSFT', watchlistService, watchlistQueryService)
		).rejects.toThrow(SymbolNotFoundError);
	});

	it('rejects a missing watchlist with WatchlistNotFoundError', async () => {
		const { watchlistService, watchlistQueryService } = buildServices();

		await expect(
			removeStock('user-1', 'missing-id', 'AAPL', watchlistService, watchlistQueryService)
		).rejects.toThrow(WatchlistNotFoundError);
	});
});
