import { describe, expect, it, vi } from 'vitest';
import {
	WatchlistApiError,
	type InvestmentAllocationResponse,
	type TargetPriceMutationResponse,
	type WatchlistView,
	type WatchlistsMetadataResponse
} from './watchlistApi';
import {
	addStockToActiveWatchlist,
	calculateInvestmentAllocationForActiveWatchlist,
	chooseInitialActiveWatchlistId,
	createWatchlistAndActivate,
	deleteActiveWatchlistAndTransition,
	loadInitialWatchlists,
	removeStockFromActiveWatchlist,
	setTargetPriceForActiveStock,
	switchActiveWatchlist,
	type WatchlistShellApi
} from './watchlistShell';

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

function view(id: string): WatchlistView {
	return { id, name: 'Main', stocks: [], warnings: [] };
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

describe('chooseInitialActiveWatchlistId', () => {
	it('uses the persisted activeWatchlistId when it refers to an existing watchlist', () => {
		expect(chooseInitialActiveWatchlistId(metadata({ activeWatchlistId: 'wl-2' }))).toBe('wl-2');
	});

	it('falls back to the first watchlist when activeWatchlistId is absent', () => {
		expect(chooseInitialActiveWatchlistId(metadata({ activeWatchlistId: undefined }))).toBe('wl-1');
	});

	it('falls back to the first watchlist when activeWatchlistId refers to a nonexistent watchlist', () => {
		expect(chooseInitialActiveWatchlistId(metadata({ activeWatchlistId: 'ghost' }))).toBe('wl-1');
	});

	it('returns undefined when there are no watchlists', () => {
		expect(
			chooseInitialActiveWatchlistId(metadata({ activeWatchlistId: undefined, watchlists: [] }))
		).toBeUndefined();
	});
});

describe('loadInitialWatchlists', () => {
	it('loads metadata then the persisted active watchlist', async () => {
		const response = metadata();
		const api = fakeApi({
			loadWatchlists: vi.fn().mockResolvedValue(response),
			loadWatchlist: vi.fn().mockResolvedValue(view('wl-1'))
		});
		const calls: string[] = [];
		const handlers = {
			onMetadataLoading: () => calls.push('metadataLoading'),
			onMetadataLoaded: () => calls.push('metadataLoaded'),
			onMetadataError: () => calls.push('metadataError'),
			onActiveWatchlistLoading: () => calls.push('activeLoading'),
			onActiveWatchlistLoaded: () => calls.push('activeLoaded'),
			onActiveWatchlistError: () => calls.push('activeError')
		};

		await loadInitialWatchlists(api, handlers);

		expect(api.loadWatchlist).toHaveBeenCalledWith('wl-1');
		expect(calls).toEqual(['metadataLoading', 'metadataLoaded', 'activeLoading', 'activeLoaded']);
	});

	it('passes the defensively-chosen active id to onMetadataLoaded', async () => {
		const response = metadata({ activeWatchlistId: undefined });
		const api = fakeApi({
			loadWatchlists: vi.fn().mockResolvedValue(response),
			loadWatchlist: vi.fn().mockResolvedValue(view('wl-1'))
		});
		const onMetadataLoaded = vi.fn();

		await loadInitialWatchlists(api, {
			onMetadataLoading: () => {},
			onMetadataLoaded,
			onMetadataError: () => {},
			onActiveWatchlistLoading: () => {},
			onActiveWatchlistLoaded: () => {},
			onActiveWatchlistError: () => {}
		});

		expect(onMetadataLoaded).toHaveBeenCalledWith(response, 'wl-1');
	});

	it('does not load an active watchlist when there are none', async () => {
		const response = metadata({ activeWatchlistId: undefined, watchlists: [] });
		const api = fakeApi({ loadWatchlists: vi.fn().mockResolvedValue(response) });
		const calls: string[] = [];

		await loadInitialWatchlists(api, {
			onMetadataLoading: () => calls.push('metadataLoading'),
			onMetadataLoaded: () => calls.push('metadataLoaded'),
			onMetadataError: () => calls.push('metadataError'),
			onActiveWatchlistLoading: () => calls.push('activeLoading'),
			onActiveWatchlistLoaded: () => calls.push('activeLoaded'),
			onActiveWatchlistError: () => calls.push('activeError')
		});

		expect(api.loadWatchlist).not.toHaveBeenCalled();
		expect(calls).toEqual(['metadataLoading', 'metadataLoaded']);
	});

	it('reports a metadata error and never attempts the active-watchlist load', async () => {
		const error = new WatchlistApiError('INTERNAL_ERROR', 'boom', 500);
		const api = fakeApi({ loadWatchlists: vi.fn().mockRejectedValue(error) });
		const onMetadataError = vi.fn();

		await loadInitialWatchlists(api, {
			onMetadataLoading: () => {},
			onMetadataLoaded: () => {},
			onMetadataError,
			onActiveWatchlistLoading: () => {},
			onActiveWatchlistLoaded: () => {},
			onActiveWatchlistError: () => {}
		});

		expect(onMetadataError).toHaveBeenCalledWith(error);
		expect(api.loadWatchlist).not.toHaveBeenCalled();
	});

	it('keeps metadata but reports an active-watchlist load error', async () => {
		const error = new WatchlistApiError('INTERNAL_ERROR', 'boom', 500);
		const api = fakeApi({
			loadWatchlists: vi.fn().mockResolvedValue(metadata()),
			loadWatchlist: vi.fn().mockRejectedValue(error)
		});
		const onActiveWatchlistError = vi.fn();
		const onMetadataLoaded = vi.fn();

		await loadInitialWatchlists(api, {
			onMetadataLoading: () => {},
			onMetadataLoaded,
			onMetadataError: () => {},
			onActiveWatchlistLoading: () => {},
			onActiveWatchlistLoaded: () => {},
			onActiveWatchlistError
		});

		expect(onMetadataLoaded).toHaveBeenCalled();
		expect(onActiveWatchlistError).toHaveBeenCalledWith(error);
	});
});

describe('switchActiveWatchlist', () => {
	it('does nothing when the requested watchlist is already active', async () => {
		const api = fakeApi();

		await switchActiveWatchlist(api, 'wl-1', 'wl-1', {
			onSwitching: vi.fn(),
			onSelectionFailed: vi.fn(),
			onSelected: vi.fn(),
			onActiveWatchlistLoaded: vi.fn(),
			onActiveWatchlistError: vi.fn()
		});

		expect(api.selectActiveWatchlist).not.toHaveBeenCalled();
	});

	it('persists the selection before loading the composed watchlist', async () => {
		const selectedMetadata = metadata({ activeWatchlistId: 'wl-2' });
		const api = fakeApi({
			selectActiveWatchlist: vi.fn().mockResolvedValue(selectedMetadata),
			loadWatchlist: vi.fn().mockResolvedValue(view('wl-2'))
		});
		const calls: string[] = [];

		await switchActiveWatchlist(api, 'wl-2', 'wl-1', {
			onSwitching: () => calls.push('switching'),
			onSelectionFailed: () => calls.push('selectionFailed'),
			onSelected: () => calls.push('selected'),
			onActiveWatchlistLoaded: () => calls.push('loaded'),
			onActiveWatchlistError: () => calls.push('error')
		});

		expect(api.selectActiveWatchlist).toHaveBeenCalledWith('wl-2');
		expect(api.loadWatchlist).toHaveBeenCalledWith('wl-2');
		expect(calls).toEqual(['switching', 'selected', 'loaded']);
	});

	it('keeps the previous active watchlist and never issues the GET when the PUT fails', async () => {
		const error = new WatchlistApiError('WATCHLIST_NOT_FOUND', 'gone', 404);
		const api = fakeApi({ selectActiveWatchlist: vi.fn().mockRejectedValue(error) });
		const onSelectionFailed = vi.fn();

		await switchActiveWatchlist(api, 'wl-2', 'wl-1', {
			onSwitching: vi.fn(),
			onSelectionFailed,
			onSelected: vi.fn(),
			onActiveWatchlistLoaded: vi.fn(),
			onActiveWatchlistError: vi.fn()
		});

		expect(onSelectionFailed).toHaveBeenCalledWith(error);
		expect(api.loadWatchlist).not.toHaveBeenCalled();
	});

	it('keeps the new tab active and reports a content error when the GET fails after a successful PUT', async () => {
		const error = new WatchlistApiError('INTERNAL_ERROR', 'boom', 500);
		const api = fakeApi({
			selectActiveWatchlist: vi.fn().mockResolvedValue(metadata({ activeWatchlistId: 'wl-2' })),
			loadWatchlist: vi.fn().mockRejectedValue(error)
		});
		const onSelected = vi.fn();
		const onActiveWatchlistError = vi.fn();

		await switchActiveWatchlist(api, 'wl-2', 'wl-1', {
			onSwitching: vi.fn(),
			onSelectionFailed: vi.fn(),
			onSelected,
			onActiveWatchlistLoaded: vi.fn(),
			onActiveWatchlistError
		});

		expect(onSelected).toHaveBeenCalled();
		expect(onActiveWatchlistError).toHaveBeenCalledWith(error);
	});
});

describe('createWatchlistAndActivate', () => {
	function createHandlers() {
		const calls: string[] = [];
		return {
			calls,
			handlers: {
				onCreating: () => calls.push('creating'),
				onCreateFailed: () => calls.push('createFailed'),
				onCreated: () => calls.push('created'),
				onActiveWatchlistLoading: () => calls.push('activeLoading'),
				onActiveWatchlistLoaded: () => calls.push('activeLoaded'),
				onActiveWatchlistError: () => calls.push('activeError')
			}
		};
	}

	it('does not call the API for an empty or whitespace-only name', async () => {
		const api = fakeApi();
		const { calls, handlers } = createHandlers();

		await createWatchlistAndActivate(api, '   ', handlers);

		expect(api.createWatchlist).not.toHaveBeenCalled();
		expect(calls).toEqual([]);
	});

	it('sends the trimmed name, then loads the server-selected active watchlist', async () => {
		const response = metadata({
			activeWatchlistId: 'wl-3',
			watchlists: [
				{ id: 'wl-1', name: 'Main' },
				{ id: 'wl-2', name: 'Dividend' },
				{ id: 'wl-3', name: 'Tech' }
			]
		});
		const api = fakeApi({
			createWatchlist: vi.fn().mockResolvedValue(response),
			loadWatchlist: vi.fn().mockResolvedValue(view('wl-3'))
		});
		const { calls, handlers } = createHandlers();

		await createWatchlistAndActivate(api, '  Tech  ', handlers);

		expect(api.createWatchlist).toHaveBeenCalledWith('Tech');
		expect(api.loadWatchlist).toHaveBeenCalledWith('wl-3');
		expect(calls).toEqual(['creating', 'created', 'activeLoading', 'activeLoaded']);
	});

	it('reports a create failure without loading a watchlist', async () => {
		const error = new WatchlistApiError('INVALID_WATCHLIST_NAME', 'bad name', 400);
		const api = fakeApi({ createWatchlist: vi.fn().mockRejectedValue(error) });
		const onCreateFailed = vi.fn();

		await createWatchlistAndActivate(api, 'Tech', {
			onCreating: () => {},
			onCreateFailed,
			onCreated: () => {},
			onActiveWatchlistLoading: () => {},
			onActiveWatchlistLoaded: () => {},
			onActiveWatchlistError: () => {}
		});

		expect(onCreateFailed).toHaveBeenCalledWith(error);
		expect(api.loadWatchlist).not.toHaveBeenCalled();
	});

	it('keeps the newly active watchlist and reports a load error when the GET fails after a successful create', async () => {
		const error = new WatchlistApiError('INTERNAL_ERROR', 'boom', 500);
		const response = metadata({
			activeWatchlistId: 'wl-3',
			watchlists: [
				{ id: 'wl-1', name: 'Main' },
				{ id: 'wl-3', name: 'Tech' }
			]
		});
		const api = fakeApi({
			createWatchlist: vi.fn().mockResolvedValue(response),
			loadWatchlist: vi.fn().mockRejectedValue(error)
		});
		const onCreated = vi.fn();
		const onActiveWatchlistError = vi.fn();

		await createWatchlistAndActivate(api, 'Tech', {
			onCreating: () => {},
			onCreateFailed: () => {},
			onCreated,
			onActiveWatchlistLoading: () => {},
			onActiveWatchlistLoaded: () => {},
			onActiveWatchlistError
		});

		expect(onCreated).toHaveBeenCalledWith(response, 'wl-3');
		expect(onActiveWatchlistError).toHaveBeenCalledWith(error);
	});
});

describe('deleteActiveWatchlistAndTransition', () => {
	function deleteHandlers() {
		const calls: string[] = [];
		return {
			calls,
			handlers: {
				onDeleting: () => calls.push('deleting'),
				onDeleteFailed: () => calls.push('deleteFailed'),
				onDeleted: () => calls.push('deleted'),
				onNoWatchlistsRemaining: () => calls.push('noneRemaining'),
				onActiveWatchlistLoading: () => calls.push('activeLoading'),
				onActiveWatchlistLoaded: () => calls.push('activeLoaded'),
				onActiveWatchlistError: () => calls.push('activeError')
			}
		};
	}

	it('loads the server-selected replacement watchlist after a successful deletion', async () => {
		const response = metadata({
			activeWatchlistId: 'wl-1',
			watchlists: [{ id: 'wl-1', name: 'Main' }]
		});
		const api = fakeApi({
			deleteActiveWatchlist: vi.fn().mockResolvedValue(response),
			loadWatchlist: vi.fn().mockResolvedValue(view('wl-1'))
		});
		const { calls, handlers } = deleteHandlers();

		await deleteActiveWatchlistAndTransition(api, handlers);

		expect(api.loadWatchlist).toHaveBeenCalledWith('wl-1');
		expect(calls).toEqual(['deleting', 'deleted', 'activeLoading', 'activeLoaded']);
	});

	it('stops without issuing a composed-watchlist GET when the final watchlist is deleted', async () => {
		const response = metadata({ activeWatchlistId: undefined, watchlists: [] });
		const api = fakeApi({ deleteActiveWatchlist: vi.fn().mockResolvedValue(response) });
		const { calls, handlers } = deleteHandlers();

		await deleteActiveWatchlistAndTransition(api, handlers);

		expect(api.loadWatchlist).not.toHaveBeenCalled();
		expect(calls).toEqual(['deleting', 'deleted', 'noneRemaining']);
	});

	it('reports a delete failure without changing metadata or issuing a GET', async () => {
		const error = new WatchlistApiError('INTERNAL_ERROR', 'boom', 500);
		const api = fakeApi({ deleteActiveWatchlist: vi.fn().mockRejectedValue(error) });
		const onDeleteFailed = vi.fn();

		await deleteActiveWatchlistAndTransition(api, {
			onDeleting: () => {},
			onDeleteFailed,
			onDeleted: () => {},
			onNoWatchlistsRemaining: () => {},
			onActiveWatchlistLoading: () => {},
			onActiveWatchlistLoaded: () => {},
			onActiveWatchlistError: () => {}
		});

		expect(onDeleteFailed).toHaveBeenCalledWith(error);
		expect(api.loadWatchlist).not.toHaveBeenCalled();
	});

	it('keeps the replacement watchlist active and reports a load error when the GET fails after a successful delete', async () => {
		const error = new WatchlistApiError('INTERNAL_ERROR', 'boom', 500);
		const response = metadata({
			activeWatchlistId: 'wl-1',
			watchlists: [{ id: 'wl-1', name: 'Main' }]
		});
		const api = fakeApi({
			deleteActiveWatchlist: vi.fn().mockResolvedValue(response),
			loadWatchlist: vi.fn().mockRejectedValue(error)
		});
		const onDeleted = vi.fn();
		const onActiveWatchlistError = vi.fn();

		await deleteActiveWatchlistAndTransition(api, {
			onDeleting: () => {},
			onDeleteFailed: () => {},
			onDeleted,
			onNoWatchlistsRemaining: () => {},
			onActiveWatchlistLoading: () => {},
			onActiveWatchlistLoaded: () => {},
			onActiveWatchlistError
		});

		expect(onDeleted).toHaveBeenCalledWith(response);
		expect(onActiveWatchlistError).toHaveBeenCalledWith(error);
	});
});

describe('addStockToActiveWatchlist', () => {
	function addHandlers() {
		const calls: string[] = [];
		return {
			calls,
			handlers: {
				onAdding: () => calls.push('adding'),
				onAddFailed: () => calls.push('addFailed'),
				onAdded: () => calls.push('added')
			}
		};
	}

	it('does not call the API for an empty or whitespace-only symbol', async () => {
		const api = fakeApi();
		const { calls, handlers } = addHandlers();

		await addStockToActiveWatchlist(api, 'wl-1', '   ', handlers);

		expect(api.addStock).not.toHaveBeenCalled();
		expect(calls).toEqual([]);
	});

	it('sends the trimmed symbol and replaces activeView with the mutation response, with no follow-up GET', async () => {
		const updatedView = view('wl-1');
		const api = fakeApi({ addStock: vi.fn().mockResolvedValue(updatedView) });
		const { calls, handlers } = addHandlers();

		await addStockToActiveWatchlist(api, 'wl-1', '  AAPL  ', {
			...handlers,
			onAdded: (result) => {
				calls.push('added');
				expect(result).toBe(updatedView);
			}
		});

		expect(api.addStock).toHaveBeenCalledWith('wl-1', 'AAPL');
		expect(api.loadWatchlist).not.toHaveBeenCalled();
		expect(calls).toEqual(['adding', 'added']);
	});

	it('reports an add failure without touching the previous active view', async () => {
		const error = new WatchlistApiError('DUPLICATE_SYMBOL', 'already exists', 409);
		const api = fakeApi({ addStock: vi.fn().mockRejectedValue(error) });
		const onAddFailed = vi.fn();

		await addStockToActiveWatchlist(api, 'wl-1', 'AAPL', {
			onAdding: () => {},
			onAddFailed,
			onAdded: () => {
				throw new Error('should not be called');
			}
		});

		expect(onAddFailed).toHaveBeenCalledWith(error);
	});
});

describe('removeStockFromActiveWatchlist', () => {
	function removeHandlers() {
		const calls: string[] = [];
		return {
			calls,
			handlers: {
				onRemoving: () => calls.push('removing'),
				onRemoveFailed: () => calls.push('removeFailed'),
				onRemoved: () => calls.push('removed')
			}
		};
	}

	it('replaces activeView directly with the mutation response, with no follow-up GET', async () => {
		const updatedView = view('wl-1');
		const api = fakeApi({ removeStock: vi.fn().mockResolvedValue(updatedView) });
		const { calls, handlers } = removeHandlers();

		await removeStockFromActiveWatchlist(api, 'wl-1', 'AAPL', {
			...handlers,
			onRemoved: (result) => {
				calls.push('removed');
				expect(result).toBe(updatedView);
			}
		});

		expect(api.removeStock).toHaveBeenCalledWith('wl-1', 'AAPL');
		expect(api.loadWatchlist).not.toHaveBeenCalled();
		expect(calls).toEqual(['removing', 'removed']);
	});

	it('becomes the new activeView when the removed stock was the final row', async () => {
		const emptyView: WatchlistView = { id: 'wl-1', name: 'Main', stocks: [], warnings: [] };
		const api = fakeApi({ removeStock: vi.fn().mockResolvedValue(emptyView) });
		const onRemoved = vi.fn();

		await removeStockFromActiveWatchlist(api, 'wl-1', 'AAPL', {
			onRemoving: () => {},
			onRemoveFailed: () => {},
			onRemoved
		});

		expect(onRemoved).toHaveBeenCalledWith(emptyView);
	});

	it('reports a remove failure without touching the previous active view', async () => {
		const error = new WatchlistApiError('SYMBOL_NOT_FOUND', 'gone', 404);
		const api = fakeApi({ removeStock: vi.fn().mockRejectedValue(error) });
		const onRemoveFailed = vi.fn();

		await removeStockFromActiveWatchlist(api, 'wl-1', 'AAPL', {
			onRemoving: () => {},
			onRemoveFailed,
			onRemoved: () => {
				throw new Error('should not be called');
			}
		});

		expect(onRemoveFailed).toHaveBeenCalledWith(error);
	});
});

describe('setTargetPriceForActiveStock', () => {
	function activeViewWithStocks(): WatchlistView {
		return {
			id: 'wl-1',
			name: 'Main',
			warnings: [],
			stocks: [
				{ symbol: 'AAPL', targetPrice: 180, distanceToTarget: 0.1, dividendYield: 0 },
				{ symbol: 'SAP.DE', targetPrice: 150, distanceToTarget: -0.05, dividendYield: 0.03 }
			]
		};
	}

	function targetPriceHandlers() {
		const calls: string[] = [];
		return {
			calls,
			handlers: {
				onSaving: () => calls.push('saving'),
				onSaveFailed: () => calls.push('saveFailed'),
				onSaved: () => calls.push('saved')
			}
		};
	}

	it('updates only the matching stock, leaving the other stock and order unchanged', async () => {
		const response: TargetPriceMutationResponse = {
			symbol: 'AAPL',
			targetPrice: 200,
			distanceToTarget: -0.1,
			warnings: []
		};
		const api = fakeApi({ setTargetPrice: vi.fn().mockResolvedValue(response) });
		const activeView = activeViewWithStocks();
		const { calls, handlers } = targetPriceHandlers();
		let updatedView: WatchlistView | undefined;

		await setTargetPriceForActiveStock(api, activeView, 'AAPL', 200, {
			...handlers,
			onSaved: (view) => {
				calls.push('saved');
				updatedView = view;
			}
		});

		expect(api.setTargetPrice).toHaveBeenCalledWith('AAPL', 200);
		expect(calls).toEqual(['saving', 'saved']);
		expect(updatedView?.stocks.map((stock) => stock.symbol)).toEqual(['AAPL', 'SAP.DE']);
		expect(updatedView?.stocks[0]).toEqual({
			symbol: 'AAPL',
			targetPrice: 200,
			distanceToTarget: -0.1,
			dividendYield: 0
		});
		expect(updatedView?.stocks[1]).toEqual(activeView.stocks[1]);
	});

	it('does not issue a follow-up composed-Watchlist GET', async () => {
		const response: TargetPriceMutationResponse = {
			symbol: 'AAPL',
			targetPrice: 200,
			distanceToTarget: -0.1,
			warnings: []
		};
		const api = fakeApi({ setTargetPrice: vi.fn().mockResolvedValue(response) });
		const { handlers } = targetPriceHandlers();

		await setTargetPriceForActiveStock(api, activeViewWithStocks(), 'AAPL', 200, handlers);

		expect(api.loadWatchlist).not.toHaveBeenCalled();
	});

	it('leaves the previous active view untouched on save failure', async () => {
		const error = new WatchlistApiError('INVALID_TARGET_PRICE', 'invalid', 400);
		const api = fakeApi({ setTargetPrice: vi.fn().mockRejectedValue(error) });
		const onSaveFailed = vi.fn();

		await setTargetPriceForActiveStock(api, activeViewWithStocks(), 'AAPL', -10, {
			onSaving: () => {},
			onSaveFailed,
			onSaved: () => {
				throw new Error('should not be called');
			}
		});

		expect(onSaveFailed).toHaveBeenCalledWith(error);
	});

	it('treats a successful save with a MARKET_DATA_UNAVAILABLE warning as success and surfaces the warning message', async () => {
		const response: TargetPriceMutationResponse = {
			symbol: 'AAPL',
			targetPrice: 250,
			warnings: [
				{
					code: 'MARKET_DATA_UNAVAILABLE',
					message: 'Current market data is temporarily unavailable.'
				}
			]
		};
		const api = fakeApi({ setTargetPrice: vi.fn().mockResolvedValue(response) });
		let updatedView: WatchlistView | undefined;
		let warningMessage: string | undefined;

		await setTargetPriceForActiveStock(api, activeViewWithStocks(), 'AAPL', 250, {
			onSaving: () => {},
			onSaveFailed: () => {
				throw new Error('should not be called');
			},
			onSaved: (view, warning) => {
				updatedView = view;
				warningMessage = warning;
			}
		});

		expect(updatedView?.stocks[0].targetPrice).toBe(250);
		expect(updatedView?.stocks[0].distanceToTarget).toBeUndefined();
		expect(warningMessage).toBe('Current market data is temporarily unavailable.');
	});
});

describe('calculateInvestmentAllocationForActiveWatchlist', () => {
	function allocationHandlers() {
		const calls: string[] = [];
		return {
			calls,
			handlers: {
				onCalculating: () => calls.push('calculating'),
				onCalculationFailed: () => calls.push('calculationFailed'),
				onCalculated: () => calls.push('calculated')
			}
		};
	}

	it('calls the API with the given watchlist id and totalSavings, then reports the result', async () => {
		const response: InvestmentAllocationResponse = {
			totalSavings: 1000,
			invested: 997,
			allocations: [{ symbol: 'AAPL', factor: 0.8, savingsAmount: 320 }]
		};
		const api = fakeApi({ calculateInvestmentAllocation: vi.fn().mockResolvedValue(response) });
		const { calls, handlers } = allocationHandlers();
		let received: InvestmentAllocationResponse | undefined;

		await calculateInvestmentAllocationForActiveWatchlist(api, 'wl-1', 1000, {
			...handlers,
			onCalculated: (result) => {
				calls.push('calculated');
				received = result;
			}
		});

		expect(api.calculateInvestmentAllocation).toHaveBeenCalledWith('wl-1', 1000);
		expect(calls).toEqual(['calculating', 'calculated']);
		expect(received).toEqual(response);
	});

	it('reports a calculation failure without calling onCalculated', async () => {
		const error = new WatchlistApiError('MARKET_DATA_UNAVAILABLE', 'unavailable', 502);
		const api = fakeApi({ calculateInvestmentAllocation: vi.fn().mockRejectedValue(error) });
		const onCalculationFailed = vi.fn();

		await calculateInvestmentAllocationForActiveWatchlist(api, 'wl-1', 1000, {
			onCalculating: () => {},
			onCalculationFailed,
			onCalculated: () => {
				throw new Error('should not be called');
			}
		});

		expect(onCalculationFailed).toHaveBeenCalledWith(error);
	});
});
