import { describe, expect, it } from 'vitest';
import { MarketDataProviderError } from '../market-data/MarketDataProvider';
import type {
	MarketDataBatchResult,
	MarketDataProvider,
	ResolvedMarketSymbol
} from '../market-data/MarketDataProvider';
import type { WatchlistRepository, WatchlistsDocument } from '../persistence/WatchlistRepository';
import { AddStockToWatchlistService } from './AddStockToWatchlistService';
import { WatchlistService } from './WatchlistService';
import {
	DuplicateSymbolError,
	InvalidSymbolError,
	UnknownStockSymbolError,
	WatchlistNotFoundError
} from './WatchlistServiceErrors';

class FakeWatchlistRepository implements WatchlistRepository {
	saveCalls: { userId: string; document: WatchlistsDocument }[] = [];
	constructor(private readonly documents = new Map<string, WatchlistsDocument>()) {}

	async get(userId: string): Promise<WatchlistsDocument> {
		return this.documents.get(userId) ?? { activeWatchlistId: undefined, watchlists: [] };
	}

	async save(userId: string, document: WatchlistsDocument): Promise<void> {
		this.saveCalls.push({ userId, document });
		this.documents.set(userId, document);
	}
}

class FakeMarketDataProvider implements MarketDataProvider {
	resolveSymbolCalls: string[] = [];
	constructor(
		private readonly resolvableSymbols = new Map<string, ResolvedMarketSymbol>(),
		private readonly error?: Error
	) {}

	async getQuote(): Promise<undefined> {
		throw new Error('getQuote should not be called by AddStockToWatchlistService (TASK-030)');
	}

	async getQuotes(): Promise<MarketDataBatchResult> {
		throw new Error('getQuotes should not be called by AddStockToWatchlistService');
	}

	async resolveSymbol(symbol: string): Promise<ResolvedMarketSymbol | undefined> {
		this.resolveSymbolCalls.push(symbol);
		if (this.error) {
			throw this.error;
		}
		return this.resolvableSymbols.get(symbol);
	}
}

function watchlistDocument(id: string, symbols: string[]): WatchlistsDocument {
	return { activeWatchlistId: id, watchlists: [{ id, name: 'Main', symbols }] };
}

describe('AddStockToWatchlistService.addStock', () => {
	it('validates through the provider once and adds the symbol via WatchlistService', async () => {
		const watchlistRepository = new FakeWatchlistRepository(
			new Map([['user-1', watchlistDocument('wl-1', [])]])
		);
		const watchlistService = new WatchlistService(watchlistRepository);
		const marketDataProvider = new FakeMarketDataProvider(new Map([['AAPL', { symbol: 'AAPL' }]]));
		const service = new AddStockToWatchlistService(marketDataProvider, watchlistService);

		const result = await service.addStock('user-1', 'wl-1', 'AAPL');

		expect(marketDataProvider.resolveSymbolCalls).toEqual(['AAPL']);
		expect(result.watchlists[0].symbols).toEqual(['AAPL']);
		expect(watchlistRepository.saveCalls).toHaveLength(1);
	});

	it('trims the symbol before both the provider lookup and persistence', async () => {
		const watchlistRepository = new FakeWatchlistRepository(
			new Map([['user-1', watchlistDocument('wl-1', [])]])
		);
		const watchlistService = new WatchlistService(watchlistRepository);
		const marketDataProvider = new FakeMarketDataProvider(
			new Map([['GAW.L', { symbol: 'GAW.L' }]])
		);
		const service = new AddStockToWatchlistService(marketDataProvider, watchlistService);

		const result = await service.addStock('user-1', 'wl-1', '  GAW.L  ');

		expect(marketDataProvider.resolveSymbolCalls).toEqual(['GAW.L']);
		expect(result.watchlists[0].symbols).toEqual(['GAW.L']);
	});

	it.each([
		'',
		'   ',
		'AAPL!',
		'SAP..DE',
		'SAP--DE',
		'SAP.-DE',
		'SAP-.DE',
		'SAP_DE',
		'SAP DE',
		'.SAP',
		'SAP.',
		'-SAP',
		'SAP-'
	])(
		'rejects %j as syntactically invalid without calling the provider or mutating the Watchlist',
		async (symbol) => {
			const watchlistRepository = new FakeWatchlistRepository(
				new Map([['user-1', watchlistDocument('wl-1', [])]])
			);
			const watchlistService = new WatchlistService(watchlistRepository);
			const marketDataProvider = new FakeMarketDataProvider();
			const service = new AddStockToWatchlistService(marketDataProvider, watchlistService);

			await expect(service.addStock('user-1', 'wl-1', symbol)).rejects.toThrow(InvalidSymbolError);
			expect(marketDataProvider.resolveSymbolCalls).toHaveLength(0);
			expect(watchlistRepository.saveCalls).toHaveLength(0);
		}
	);

	it('rejects an unknown symbol without mutating the Watchlist', async () => {
		const watchlistRepository = new FakeWatchlistRepository(
			new Map([['user-1', watchlistDocument('wl-1', [])]])
		);
		const watchlistService = new WatchlistService(watchlistRepository);
		const marketDataProvider = new FakeMarketDataProvider();
		const service = new AddStockToWatchlistService(marketDataProvider, watchlistService);

		await expect(service.addStock('user-1', 'wl-1', 'DOES-NOT-EXIST')).rejects.toThrow(
			UnknownStockSymbolError
		);
		expect(watchlistRepository.saveCalls).toHaveLength(0);
	});

	it('propagates a provider failure distinctly, without mutating the Watchlist', async () => {
		const watchlistRepository = new FakeWatchlistRepository(
			new Map([['user-1', watchlistDocument('wl-1', [])]])
		);
		const watchlistService = new WatchlistService(watchlistRepository);
		const marketDataProvider = new FakeMarketDataProvider(
			undefined,
			new MarketDataProviderError('provider outage')
		);
		const service = new AddStockToWatchlistService(marketDataProvider, watchlistService);

		await expect(service.addStock('user-1', 'wl-1', 'AAPL')).rejects.toThrow(
			MarketDataProviderError
		);
		await expect(service.addStock('user-1', 'wl-1', 'AAPL')).rejects.not.toThrow(
			UnknownStockSymbolError
		);
		expect(watchlistRepository.saveCalls).toHaveLength(0);
	});

	it('calls the provider before WatchlistService rejects a duplicate symbol', async () => {
		const watchlistRepository = new FakeWatchlistRepository(
			new Map([['user-1', watchlistDocument('wl-1', ['AAPL'])]])
		);
		const watchlistService = new WatchlistService(watchlistRepository);
		const marketDataProvider = new FakeMarketDataProvider(new Map([['AAPL', { symbol: 'AAPL' }]]));
		const service = new AddStockToWatchlistService(marketDataProvider, watchlistService);

		await expect(service.addStock('user-1', 'wl-1', 'AAPL')).rejects.toThrow(DuplicateSymbolError);
		expect(marketDataProvider.resolveSymbolCalls).toEqual(['AAPL']);
		expect(watchlistRepository.saveCalls).toHaveLength(0);
	});

	it('calls the provider before WatchlistService rejects a missing Watchlist', async () => {
		const watchlistRepository = new FakeWatchlistRepository();
		const watchlistService = new WatchlistService(watchlistRepository);
		const marketDataProvider = new FakeMarketDataProvider(new Map([['AAPL', { symbol: 'AAPL' }]]));
		const service = new AddStockToWatchlistService(marketDataProvider, watchlistService);

		await expect(service.addStock('user-1', 'wl-missing', 'AAPL')).rejects.toThrow(
			WatchlistNotFoundError
		);
		expect(marketDataProvider.resolveSymbolCalls).toEqual(['AAPL']);
		expect(watchlistRepository.saveCalls).toHaveLength(0);
	});

	it('persists Yahoo exchange-syntax symbols unchanged', async () => {
		const watchlistRepository = new FakeWatchlistRepository(
			new Map([['user-1', watchlistDocument('wl-1', [])]])
		);
		const watchlistService = new WatchlistService(watchlistRepository);
		const marketDataProvider = new FakeMarketDataProvider(
			new Map([['HEXA-B.ST', { symbol: 'HEXA-B.ST' }]])
		);
		const service = new AddStockToWatchlistService(marketDataProvider, watchlistService);

		const result = await service.addStock('user-1', 'wl-1', 'HEXA-B.ST');

		expect(result.watchlists[0].symbols).toEqual(['HEXA-B.ST']);
	});

	it('persists the validated input, not the provider-returned symbol', async () => {
		const watchlistRepository = new FakeWatchlistRepository(
			new Map([['user-1', watchlistDocument('wl-1', [])]])
		);
		const watchlistService = new WatchlistService(watchlistRepository);
		const marketDataProvider = new FakeMarketDataProvider(
			new Map([['AAPL', { symbol: 'AAPL-PROVIDER-VALUE' }]])
		);
		const service = new AddStockToWatchlistService(marketDataProvider, watchlistService);

		const result = await service.addStock('user-1', 'wl-1', 'AAPL');

		expect(result.watchlists[0].symbols).toEqual(['AAPL']);
	});

	it('normalizes lowercase input to uppercase before the provider lookup and persists the normalized symbol (TASK-029, supersedes TASK-012)', async () => {
		const watchlistRepository = new FakeWatchlistRepository(
			new Map([['user-1', watchlistDocument('wl-1', [])]])
		);
		const watchlistService = new WatchlistService(watchlistRepository);
		const marketDataProvider = new FakeMarketDataProvider(new Map([['AAPL', { symbol: 'AAPL' }]]));
		const service = new AddStockToWatchlistService(marketDataProvider, watchlistService);

		const result = await service.addStock('user-1', 'wl-1', 'aapl');

		expect(marketDataProvider.resolveSymbolCalls).toEqual(['AAPL']);
		expect(result.watchlists[0].symbols).toEqual(['AAPL']);
	});

	it('normalizes a lowercase exchange-suffix symbol to uppercase for both the provider and persistence', async () => {
		const watchlistRepository = new FakeWatchlistRepository(
			new Map([['user-1', watchlistDocument('wl-1', [])]])
		);
		const watchlistService = new WatchlistService(watchlistRepository);
		const marketDataProvider = new FakeMarketDataProvider(
			new Map([['SAP.DE', { symbol: 'SAP.DE' }]])
		);
		const service = new AddStockToWatchlistService(marketDataProvider, watchlistService);

		const result = await service.addStock('user-1', 'wl-1', 'sap.de');

		expect(marketDataProvider.resolveSymbolCalls).toEqual(['SAP.DE']);
		expect(result.watchlists[0].symbols).toEqual(['SAP.DE']);
	});

	it('normalizes a lowercase hyphenated symbol to uppercase, preserving the hyphen', async () => {
		const watchlistRepository = new FakeWatchlistRepository(
			new Map([['user-1', watchlistDocument('wl-1', [])]])
		);
		const watchlistService = new WatchlistService(watchlistRepository);
		const marketDataProvider = new FakeMarketDataProvider(
			new Map([['HEXA-B.ST', { symbol: 'HEXA-B.ST' }]])
		);
		const service = new AddStockToWatchlistService(marketDataProvider, watchlistService);

		const result = await service.addStock('user-1', 'wl-1', 'hexa-b.st');

		expect(marketDataProvider.resolveSymbolCalls).toEqual(['HEXA-B.ST']);
		expect(result.watchlists[0].symbols).toEqual(['HEXA-B.ST']);
	});

	it('rejects a case-only duplicate of an already-persisted canonical symbol', async () => {
		const watchlistRepository = new FakeWatchlistRepository(
			new Map([['user-1', watchlistDocument('wl-1', ['AAPL'])]])
		);
		const watchlistService = new WatchlistService(watchlistRepository);
		const marketDataProvider = new FakeMarketDataProvider(new Map([['AAPL', { symbol: 'AAPL' }]]));
		const service = new AddStockToWatchlistService(marketDataProvider, watchlistService);

		await expect(service.addStock('user-1', 'wl-1', 'aapl')).rejects.toThrow(DuplicateSymbolError);
		expect(marketDataProvider.resolveSymbolCalls).toEqual(['AAPL']);
		expect(watchlistRepository.saveCalls).toHaveLength(0);
	});

	it('requires no TargetPriceRepository/TargetPriceService dependency (verified by the constructor signature)', async () => {
		// AddStockToWatchlistService's constructor only accepts (MarketDataProvider, WatchlistService) —
		// there is no parameter through which a TargetPriceService/TargetPriceRepository could be supplied.
		const watchlistRepository = new FakeWatchlistRepository(
			new Map([['user-1', watchlistDocument('wl-1', [])]])
		);
		const watchlistService = new WatchlistService(watchlistRepository);
		const marketDataProvider = new FakeMarketDataProvider(new Map([['AAPL', { symbol: 'AAPL' }]]));
		const service = new AddStockToWatchlistService(marketDataProvider, watchlistService);

		await expect(service.addStock('user-1', 'wl-1', 'AAPL')).resolves.toBeDefined();
	});

	it('keeps operations for different users isolated on a shared repository', async () => {
		const watchlistRepository = new FakeWatchlistRepository(
			new Map([
				['user-1', watchlistDocument('wl-1', [])],
				['user-2', watchlistDocument('wl-1', [])]
			])
		);
		const watchlistService = new WatchlistService(watchlistRepository);
		const marketDataProvider = new FakeMarketDataProvider(new Map([['AAPL', { symbol: 'AAPL' }]]));
		const service = new AddStockToWatchlistService(marketDataProvider, watchlistService);

		await service.addStock('user-1', 'wl-1', 'AAPL');

		const user1Document = await watchlistService.loadWatchlists('user-1');
		const user2Document = await watchlistService.loadWatchlists('user-2');
		expect(user1Document.watchlists[0].symbols).toEqual(['AAPL']);
		expect(user2Document.watchlists[0].symbols).toEqual([]);
	});
});
