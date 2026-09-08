import { describe, expect, it, vi } from 'vitest';
import {
	WatchlistApiError,
	type InvestmentAllocationResponse,
	type TargetPriceMutationResponse,
	type WatchlistView,
	type WatchlistsMetadataResponse
} from './watchlistApi';
import { INVALID_STOCK_SYMBOL_MESSAGE, type WatchlistShellApi } from './watchlistShell';
import { DEFAULT_WATCHLIST_SORT } from './watchlistSort';
import { WatchlistWorkspace } from './watchlistWorkspace.svelte';

function metadata(overrides?: Partial<WatchlistsMetadataResponse>): WatchlistsMetadataResponse {
	return {
		activeWatchlistId: 'wl-1',
		watchlists: [
			{ id: 'wl-1', name: 'Main' },
			{ id: 'wl-2', name: 'Dividend' }
		],
		...overrides
	};
}

function view(id: string, overrides?: Partial<WatchlistView>): WatchlistView {
	return { id, name: 'Main', stocks: [], warnings: [], ...overrides };
}

function allocation(): InvestmentAllocationResponse {
	return {
		totalSavings: 1000,
		invested: 900,
		allocations: [{ symbol: 'AAPL', factor: 0.5, savingsAmount: 900 }]
	};
}

function fakeApi(overrides?: Partial<WatchlistShellApi>): WatchlistShellApi {
	return {
		loadWatchlists: vi.fn(),
		selectActiveWatchlist: vi.fn(),
		loadWatchlist: vi.fn(),
		createWatchlist: vi.fn(),
		deleteActiveWatchlist: vi.fn(),
		addStock: vi.fn(),
		removeStock: vi.fn(),
		setTargetPrice: vi.fn(),
		calculateInvestmentAllocation: vi.fn(),
		...overrides
	};
}

describe('load', () => {
	it('establishes watchlists, active state, default sort, empty filter, and no allocation on success', async () => {
		const response = metadata();
		const api = fakeApi({
			loadWatchlists: vi.fn().mockResolvedValue(response),
			loadWatchlist: vi.fn().mockResolvedValue(view('wl-1'))
		});
		const workspace = new WatchlistWorkspace(api);

		await workspace.load();

		expect(workspace.watchlists).toEqual(response.watchlists);
		expect(workspace.activeWatchlistId).toBe('wl-1');
		expect(workspace.metadataStatus).toBe('loaded');
		expect(workspace.activeView).toEqual(view('wl-1'));
		expect(workspace.activeViewStatus).toBe('loaded');
		expect(workspace.sort).toEqual(DEFAULT_WATCHLIST_SORT);
		expect(workspace.companyNameFilter).toBe('');
		expect(workspace.investmentAllocation).toBeUndefined();
	});

	it('reports a metadata load failure and never loads an active watchlist', async () => {
		const error = new WatchlistApiError('INTERNAL_ERROR', 'boom', 500);
		const api = fakeApi({ loadWatchlists: vi.fn().mockRejectedValue(error) });
		const workspace = new WatchlistWorkspace(api);

		await workspace.load();

		expect(workspace.metadataStatus).toBe('error');
		expect(workspace.metadataError).toBe(error);
		expect(workspace.activeViewStatus).toBe('idle');
		expect(api.loadWatchlist).not.toHaveBeenCalled();
	});
});

describe('selectWatchlist', () => {
	function setupActive(workspace: WatchlistWorkspace) {
		workspace.watchlists = metadata().watchlists;
		workspace.activeWatchlistId = 'wl-1';
		workspace.activeView = view('wl-1');
		workspace.activeViewStatus = 'loaded';
		workspace.companyNameFilter = 'existing filter';
		workspace.sort = { column: 'price', direction: 'desc' };
		workspace.investmentAllocation = allocation();
	}

	it('on success: changes active state, resets filter/sort, and clears allocation', async () => {
		const selectedMetadata = metadata({ activeWatchlistId: 'wl-2' });
		const api = fakeApi({
			selectActiveWatchlist: vi.fn().mockResolvedValue(selectedMetadata),
			loadWatchlist: vi.fn().mockResolvedValue(view('wl-2'))
		});
		const workspace = new WatchlistWorkspace(api);
		setupActive(workspace);

		await workspace.selectWatchlist('wl-2');

		expect(workspace.activeWatchlistId).toBe('wl-2');
		expect(workspace.activeView).toEqual(view('wl-2'));
		expect(workspace.companyNameFilter).toBe('');
		expect(workspace.sort).toEqual(DEFAULT_WATCHLIST_SORT);
		expect(workspace.investmentAllocation).toBeUndefined();
	});

	it('on failure: preserves previous active state/filter/sort/allocation and sets tabSwitchError', async () => {
		const error = new WatchlistApiError('WATCHLIST_NOT_FOUND', 'gone', 404);
		const api = fakeApi({ selectActiveWatchlist: vi.fn().mockRejectedValue(error) });
		const workspace = new WatchlistWorkspace(api);
		setupActive(workspace);
		const priorAllocation = workspace.investmentAllocation;
		const priorSort = workspace.sort;

		await workspace.selectWatchlist('wl-2');

		expect(workspace.activeWatchlistId).toBe('wl-1');
		expect(workspace.tabSwitchError).toBe(error);
		expect(workspace.companyNameFilter).toBe('existing filter');
		expect(workspace.sort).toEqual(priorSort);
		expect(workspace.investmentAllocation).toBe(priorAllocation);
		expect(workspace.activeViewStatus).toBe('loaded');
		expect(api.loadWatchlist).not.toHaveBeenCalled();
	});

	it('does nothing when selecting the already-active watchlist', async () => {
		const api = fakeApi();
		const workspace = new WatchlistWorkspace(api);
		workspace.activeWatchlistId = 'wl-1';

		await workspace.selectWatchlist('wl-1');

		expect(api.selectActiveWatchlist).not.toHaveBeenCalled();
	});

	it('does not start a second selection while the first is in flight (serialization)', () => {
		const api = fakeApi({
			selectActiveWatchlist: vi.fn().mockImplementation(() => new Promise(() => {}))
		});
		const workspace = new WatchlistWorkspace(api);
		workspace.activeWatchlistId = 'wl-1';

		workspace.selectWatchlist('wl-2');
		expect(workspace.managementBusy).toBe(true);

		workspace.selectWatchlist('wl-3');

		expect(api.selectActiveWatchlist).toHaveBeenCalledTimes(1);
		expect(api.selectActiveWatchlist).toHaveBeenCalledWith('wl-2');
	});
});

describe('createWatchlist', () => {
	it('does nothing for a blank/whitespace-only draft name', async () => {
		const api = fakeApi();
		const workspace = new WatchlistWorkspace(api);
		workspace.newWatchlistName = '   ';

		await workspace.createWatchlist();

		expect(api.createWatchlist).not.toHaveBeenCalled();
	});

	it('on success: created watchlist becomes active, input clears, filter/sort/allocation reset', async () => {
		const response = metadata({
			activeWatchlistId: 'wl-3',
			watchlists: [
				{ id: 'wl-1', name: 'Main' },
				{ id: 'wl-3', name: 'Tech' }
			]
		});
		const api = fakeApi({
			createWatchlist: vi.fn().mockResolvedValue(response),
			loadWatchlist: vi.fn().mockResolvedValue(view('wl-3'))
		});
		const workspace = new WatchlistWorkspace(api);
		workspace.newWatchlistName = '  Tech  ';
		workspace.companyNameFilter = 'existing';
		workspace.sort = { column: 'price', direction: 'desc' };
		workspace.investmentAllocation = allocation();

		await workspace.createWatchlist();

		expect(api.createWatchlist).toHaveBeenCalledWith('Tech');
		expect(workspace.activeWatchlistId).toBe('wl-3');
		expect(workspace.newWatchlistName).toBe('');
		expect(workspace.companyNameFilter).toBe('');
		expect(workspace.sort).toEqual(DEFAULT_WATCHLIST_SORT);
		expect(workspace.investmentAllocation).toBeUndefined();
		expect(workspace.createStatus).toBe('idle');
	});

	it('on failure: preserves the draft name and previous state, sets createError', async () => {
		const error = new WatchlistApiError('INVALID_WATCHLIST_NAME', 'bad name', 400);
		const api = fakeApi({ createWatchlist: vi.fn().mockRejectedValue(error) });
		const workspace = new WatchlistWorkspace(api);
		workspace.newWatchlistName = 'Tech';

		await workspace.createWatchlist();

		expect(workspace.createError).toBe(error);
		expect(workspace.newWatchlistName).toBe('Tech');
		expect(workspace.createStatus).toBe('idle');
	});
});

describe('deleteWatchlist', () => {
	it('does nothing when there are no watchlists', async () => {
		const api = fakeApi();
		const workspace = new WatchlistWorkspace(api);

		await workspace.deleteWatchlist();

		expect(api.deleteActiveWatchlist).not.toHaveBeenCalled();
	});

	it('on success: activates the replacement watchlist and applies the transition reset', async () => {
		const response = metadata({
			activeWatchlistId: 'wl-2',
			watchlists: [{ id: 'wl-2', name: 'Dividend' }]
		});
		const api = fakeApi({
			deleteActiveWatchlist: vi.fn().mockResolvedValue(response),
			loadWatchlist: vi.fn().mockResolvedValue(view('wl-2'))
		});
		const workspace = new WatchlistWorkspace(api);
		workspace.watchlists = metadata().watchlists;
		workspace.companyNameFilter = 'existing';
		workspace.sort = { column: 'price', direction: 'desc' };
		workspace.investmentAllocation = allocation();

		await workspace.deleteWatchlist();

		expect(workspace.activeWatchlistId).toBe('wl-2');
		expect(workspace.companyNameFilter).toBe('');
		expect(workspace.sort).toEqual(DEFAULT_WATCHLIST_SORT);
		expect(workspace.investmentAllocation).toBeUndefined();
	});

	it('on success with no watchlists remaining: clears the active view without an extra GET', async () => {
		const response = metadata({ activeWatchlistId: undefined, watchlists: [] });
		const api = fakeApi({ deleteActiveWatchlist: vi.fn().mockResolvedValue(response) });
		const workspace = new WatchlistWorkspace(api);
		workspace.watchlists = metadata().watchlists;

		await workspace.deleteWatchlist();

		expect(workspace.watchlists).toEqual([]);
		expect(workspace.activeView).toBeUndefined();
		expect(workspace.activeViewStatus).toBe('idle');
		expect(api.loadWatchlist).not.toHaveBeenCalled();
	});

	it('on failure: preserves existing state and sets deleteError', async () => {
		const error = new WatchlistApiError('INTERNAL_ERROR', 'boom', 500);
		const api = fakeApi({ deleteActiveWatchlist: vi.fn().mockRejectedValue(error) });
		const workspace = new WatchlistWorkspace(api);
		workspace.watchlists = metadata().watchlists;
		workspace.activeWatchlistId = 'wl-1';
		workspace.investmentAllocation = allocation();
		const priorAllocation = workspace.investmentAllocation;

		await workspace.deleteWatchlist();

		expect(workspace.deleteError).toBe(error);
		expect(workspace.activeWatchlistId).toBe('wl-1');
		expect(workspace.investmentAllocation).toBe(priorAllocation);
	});
});

describe('addStock', () => {
	it('does nothing without an active watchlist', async () => {
		const api = fakeApi();
		const workspace = new WatchlistWorkspace(api);

		await workspace.addStock('AAPL');

		expect(api.addStock).not.toHaveBeenCalled();
	});

	it('rejects a syntactically invalid symbol without an API call and redisplays it normalized', async () => {
		const api = fakeApi();
		const workspace = new WatchlistWorkspace(api);
		workspace.activeWatchlistId = 'wl-1';

		await workspace.addStock('sap..de');

		expect(api.addStock).not.toHaveBeenCalled();
		expect(workspace.stockSymbolValidationError).toBe(INVALID_STOCK_SYMBOL_MESSAGE);
		expect(workspace.newStockSymbol).toBe('SAP..DE');
	});

	it('on success: updates activeView, clears the draft, preserves filter/sort, invalidates allocation', async () => {
		const updatedView = view('wl-1', { stocks: [{ symbol: 'AAPL', dividendYield: 0 }] });
		const api = fakeApi({ addStock: vi.fn().mockResolvedValue(updatedView) });
		const workspace = new WatchlistWorkspace(api);
		workspace.activeWatchlistId = 'wl-1';
		workspace.newStockSymbol = 'aapl';
		workspace.companyNameFilter = 'existing filter';
		workspace.sort = { column: 'price', direction: 'desc' };
		workspace.investmentAllocation = allocation();

		await workspace.addStock('AAPL');

		expect(workspace.activeView).toEqual(updatedView);
		expect(workspace.newStockSymbol).toBe('');
		expect(workspace.companyNameFilter).toBe('existing filter');
		expect(workspace.sort).toEqual({ column: 'price', direction: 'desc' });
		expect(workspace.investmentAllocation).toBeUndefined();
		expect(workspace.stockMutationBusy).toBe(false);
	});

	it('on failure: preserves activeView, filter, sort, and allocation, sets stockMutationError', async () => {
		const error = new WatchlistApiError('UNKNOWN_STOCK_SYMBOL', 'nope', 404);
		const api = fakeApi({ addStock: vi.fn().mockRejectedValue(error) });
		const workspace = new WatchlistWorkspace(api);
		workspace.activeWatchlistId = 'wl-1';
		const priorView = view('wl-1');
		workspace.activeView = priorView;
		workspace.companyNameFilter = 'existing filter';
		workspace.sort = { column: 'price', direction: 'desc' };
		workspace.investmentAllocation = allocation();
		const priorAllocation = workspace.investmentAllocation;

		await workspace.addStock('ZZZZ');

		expect(workspace.stockMutationError).toBe(error);
		expect(workspace.activeView).toBe(priorView);
		expect(workspace.companyNameFilter).toBe('existing filter');
		expect(workspace.sort).toEqual({ column: 'price', direction: 'desc' });
		expect(workspace.investmentAllocation).toBe(priorAllocation);
		expect(workspace.stockMutationBusy).toBe(false);
	});
});

describe('removeStock', () => {
	it('does nothing without an active watchlist', async () => {
		const api = fakeApi();
		const workspace = new WatchlistWorkspace(api);

		await workspace.removeStock('AAPL');

		expect(api.removeStock).not.toHaveBeenCalled();
	});

	it('on success: updates activeView, preserves filter/sort, invalidates allocation', async () => {
		const updatedView = view('wl-1', { stocks: [] });
		const api = fakeApi({ removeStock: vi.fn().mockResolvedValue(updatedView) });
		const workspace = new WatchlistWorkspace(api);
		workspace.activeWatchlistId = 'wl-1';
		workspace.companyNameFilter = 'existing filter';
		workspace.sort = { column: 'price', direction: 'desc' };
		workspace.investmentAllocation = allocation();

		await workspace.removeStock('AAPL');

		expect(workspace.activeView).toEqual(updatedView);
		expect(workspace.companyNameFilter).toBe('existing filter');
		expect(workspace.sort).toEqual({ column: 'price', direction: 'desc' });
		expect(workspace.investmentAllocation).toBeUndefined();
	});

	it('on failure: preserves activeView and allocation, sets stockMutationError', async () => {
		const error = new WatchlistApiError('INTERNAL_ERROR', 'boom', 500);
		const api = fakeApi({ removeStock: vi.fn().mockRejectedValue(error) });
		const workspace = new WatchlistWorkspace(api);
		workspace.activeWatchlistId = 'wl-1';
		const priorView = view('wl-1');
		workspace.activeView = priorView;
		workspace.investmentAllocation = allocation();
		const priorAllocation = workspace.investmentAllocation;

		await workspace.removeStock('AAPL');

		expect(workspace.stockMutationError).toBe(error);
		expect(workspace.activeView).toBe(priorView);
		expect(workspace.investmentAllocation).toBe(priorAllocation);
	});
});

describe('saveTargetPrice', () => {
	it('returns a not-ok result when no watchlist is loaded, without calling the API', async () => {
		const api = fakeApi();
		const workspace = new WatchlistWorkspace(api);

		const result = await workspace.saveTargetPrice('AAPL', 200);

		expect(result).toEqual({ ok: false, message: 'No active watchlist is loaded.' });
		expect(api.setTargetPrice).not.toHaveBeenCalled();
	});

	it('on success: merges the confirmed price, preserves filter/sort, invalidates allocation', async () => {
		const response: TargetPriceMutationResponse = {
			symbol: 'AAPL',
			targetPrice: 200,
			distanceToTarget: 0.1,
			warnings: []
		};
		const api = fakeApi({ setTargetPrice: vi.fn().mockResolvedValue(response) });
		const workspace = new WatchlistWorkspace(api);
		workspace.activeView = view('wl-1', { stocks: [{ symbol: 'AAPL', dividendYield: 0 }] });
		workspace.companyNameFilter = 'existing filter';
		workspace.sort = { column: 'price', direction: 'desc' };
		workspace.investmentAllocation = allocation();

		const result = await workspace.saveTargetPrice('AAPL', 200);

		expect(result).toEqual({ ok: true, warningMessage: undefined });
		expect(workspace.activeView?.stocks[0]).toMatchObject({
			symbol: 'AAPL',
			targetPrice: 200,
			distanceToTarget: 0.1
		});
		expect(workspace.companyNameFilter).toBe('existing filter');
		expect(workspace.sort).toEqual({ column: 'price', direction: 'desc' });
		expect(workspace.investmentAllocation).toBeUndefined();
	});

	it('partial success (MARKET_DATA_UNAVAILABLE) is still a success and still invalidates allocation', async () => {
		const response: TargetPriceMutationResponse = {
			symbol: 'AAPL',
			targetPrice: 200,
			distanceToTarget: undefined,
			warnings: [{ code: 'MARKET_DATA_UNAVAILABLE', message: 'Distance unavailable' }]
		};
		const api = fakeApi({ setTargetPrice: vi.fn().mockResolvedValue(response) });
		const workspace = new WatchlistWorkspace(api);
		workspace.activeView = view('wl-1', { stocks: [{ symbol: 'AAPL', dividendYield: 0 }] });
		workspace.investmentAllocation = allocation();

		const result = await workspace.saveTargetPrice('AAPL', 200);

		expect(result).toEqual({ ok: true, warningMessage: 'Distance unavailable' });
		expect(workspace.investmentAllocation).toBeUndefined();
	});

	it('on failure: preserves the allocation and returns a not-ok result', async () => {
		const error = new WatchlistApiError('INVALID_TARGET_PRICE', 'bad price', 400);
		const api = fakeApi({ setTargetPrice: vi.fn().mockRejectedValue(error) });
		const workspace = new WatchlistWorkspace(api);
		workspace.activeView = view('wl-1', { stocks: [{ symbol: 'AAPL', dividendYield: 0 }] });
		workspace.investmentAllocation = allocation();
		const priorAllocation = workspace.investmentAllocation;

		const result = await workspace.saveTargetPrice('AAPL', -5);

		expect(result).toEqual({ ok: false, message: 'bad price' });
		expect(workspace.investmentAllocation).toBe(priorAllocation);
	});
});

describe('calculateAllocation', () => {
	it('does nothing without an active watchlist', async () => {
		const api = fakeApi();
		const workspace = new WatchlistWorkspace(api);

		await workspace.calculateAllocation('1000');

		expect(api.calculateInvestmentAllocation).not.toHaveBeenCalled();
	});

	it('sets a local input error for invalid input, without calling the API', async () => {
		const api = fakeApi();
		const workspace = new WatchlistWorkspace(api);
		workspace.activeWatchlistId = 'wl-1';

		await workspace.calculateAllocation('not a number');

		expect(api.calculateInvestmentAllocation).not.toHaveBeenCalled();
		expect(workspace.allocationInputError).toBe('Enter a whole number of Euros, 0 or greater.');
	});

	it('on success: stores the result', async () => {
		const result = allocation();
		const api = fakeApi({ calculateInvestmentAllocation: vi.fn().mockResolvedValue(result) });
		const workspace = new WatchlistWorkspace(api);
		workspace.activeWatchlistId = 'wl-1';

		await workspace.calculateAllocation('1000');

		expect(workspace.investmentAllocation).toEqual(result);
		expect(workspace.allocationBusy).toBe(false);
	});

	it('treats an explicit zero result as a successful stored result', async () => {
		const zeroResult: InvestmentAllocationResponse = {
			totalSavings: 0,
			invested: 0,
			allocations: []
		};
		const api = fakeApi({
			calculateInvestmentAllocation: vi.fn().mockResolvedValue(zeroResult)
		});
		const workspace = new WatchlistWorkspace(api);
		workspace.activeWatchlistId = 'wl-1';

		await workspace.calculateAllocation('0');

		expect(workspace.investmentAllocation).toEqual(zeroResult);
	});

	it('on failure: preserves the previous allocation result and sets allocationError', async () => {
		const error = new WatchlistApiError('INTERNAL_ERROR', 'boom', 500);
		const api = fakeApi({
			calculateInvestmentAllocation: vi.fn().mockRejectedValue(error)
		});
		const workspace = new WatchlistWorkspace(api);
		workspace.activeWatchlistId = 'wl-1';
		workspace.investmentAllocation = allocation();
		const priorAllocation = workspace.investmentAllocation;

		await workspace.calculateAllocation('1000');

		expect(workspace.allocationError).toBe(error);
		expect(workspace.investmentAllocation).toBe(priorAllocation);
	});

	it('does not start a second calculation while the first is in flight (serialization)', () => {
		const api = fakeApi({
			calculateInvestmentAllocation: vi.fn().mockImplementation(() => new Promise(() => {}))
		});
		const workspace = new WatchlistWorkspace(api);
		workspace.activeWatchlistId = 'wl-1';

		workspace.calculateAllocation('1000');
		expect(workspace.managementBusy).toBe(true);

		workspace.calculateAllocation('2000');

		expect(api.calculateInvestmentAllocation).toHaveBeenCalledTimes(1);
		expect(api.calculateInvestmentAllocation).toHaveBeenCalledWith('wl-1', 1000);
	});
});

describe('companyNameFilter', () => {
	it('updates filteredStocks/visibleStocks with no API call and no allocation change', () => {
		const api = fakeApi();
		const workspace = new WatchlistWorkspace(api);
		workspace.activeView = view('wl-1', {
			stocks: [
				{ symbol: 'AAPL', name: 'Apple', dividendYield: 0 },
				{ symbol: 'MSFT', name: 'Microsoft', dividendYield: 0 }
			]
		});
		workspace.investmentAllocation = allocation();

		workspace.companyNameFilter = 'apple';

		expect(workspace.filteredStocks.map((stock) => stock.symbol)).toEqual(['AAPL']);
		expect(workspace.visibleStocks.map((stock) => stock.symbol)).toEqual(['AAPL']);
		expect(workspace.investmentAllocation).toBeDefined();
		expect(api.loadWatchlists).not.toHaveBeenCalled();
	});
});

describe('changeSort', () => {
	it('updates visible order with no API call and no allocation change', () => {
		const api = fakeApi();
		const workspace = new WatchlistWorkspace(api);
		workspace.activeView = view('wl-1', {
			stocks: [
				{ symbol: 'MSFT', name: 'Microsoft', dividendYield: 0, price: 100 },
				{ symbol: 'AAPL', name: 'Apple', dividendYield: 0, price: 200 }
			]
		});
		workspace.investmentAllocation = allocation();

		workspace.changeSort('price');

		expect(workspace.sort).toEqual({ column: 'price', direction: 'asc' });
		expect(workspace.visibleStocks.map((stock) => stock.symbol)).toEqual(['MSFT', 'AAPL']);

		workspace.changeSort('price');

		expect(workspace.sort).toEqual({ column: 'price', direction: 'desc' });
		expect(workspace.visibleStocks.map((stock) => stock.symbol)).toEqual(['AAPL', 'MSFT']);
		expect(workspace.investmentAllocation).toBeDefined();
		expect(api.loadWatchlists).not.toHaveBeenCalled();
	});
});

describe('derived counts', () => {
	it('derives totalStockCount and stockCountText from source/filter state rather than a mutable counter', () => {
		const api = fakeApi();
		const workspace = new WatchlistWorkspace(api);
		workspace.activeView = view('wl-1', {
			stocks: [
				{ symbol: 'AAPL', name: 'Apple', dividendYield: 0 },
				{ symbol: 'MSFT', name: 'Microsoft', dividendYield: 0 }
			]
		});

		expect(workspace.totalStockCount).toBe(2);
		expect(workspace.stockCountText).toBe('Total: 2 stocks');

		workspace.companyNameFilter = 'apple';

		expect(workspace.totalStockCount).toBe(2);
		expect(workspace.stockCountText).toBe('Total: 2 stocks · Filtered: 1 stock');
	});
});

describe('managementBusy', () => {
	it('aggregates the busy state of every workflow operation', () => {
		const api = fakeApi();
		const workspace = new WatchlistWorkspace(api);

		expect(workspace.managementBusy).toBe(false);

		workspace.activeViewStatus = 'loading';
		expect(workspace.managementBusy).toBe(true);
		workspace.activeViewStatus = 'idle';

		workspace.createStatus = 'creating';
		expect(workspace.managementBusy).toBe(true);
		workspace.createStatus = 'idle';

		workspace.deleteStatus = 'deleting';
		expect(workspace.managementBusy).toBe(true);
		workspace.deleteStatus = 'idle';

		workspace.stockMutationBusy = true;
		expect(workspace.managementBusy).toBe(true);
		workspace.stockMutationBusy = false;

		workspace.targetPriceMutationBusy = true;
		expect(workspace.managementBusy).toBe(true);
		workspace.targetPriceMutationBusy = false;

		workspace.allocationBusy = true;
		expect(workspace.managementBusy).toBe(true);
		workspace.allocationBusy = false;

		expect(workspace.managementBusy).toBe(false);
	});
});
