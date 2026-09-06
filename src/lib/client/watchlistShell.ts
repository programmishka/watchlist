import { parseStockSymbol } from '../shared/stockSymbol';
import {
	addStock,
	calculateInvestmentAllocation,
	createWatchlist,
	deleteActiveWatchlist,
	loadWatchlist,
	loadWatchlists,
	removeStock,
	selectActiveWatchlist,
	setTargetPrice,
	WatchlistApiError,
	type InvestmentAllocationResponse,
	type WatchlistsMetadataResponse,
	type WatchlistView
} from './watchlistApi';

/** User-facing message for a client-side syntax rejection (TASK-029 §29); mirrors the server's `INVALID_STOCK_SYMBOL` wording. */
export const INVALID_STOCK_SYMBOL_MESSAGE =
	'Invalid stock symbol format. Use letters, numbers, dots, or hyphens.';

export interface WatchlistShellApi {
	loadWatchlists: typeof loadWatchlists;
	selectActiveWatchlist: typeof selectActiveWatchlist;
	loadWatchlist: typeof loadWatchlist;
	createWatchlist: typeof createWatchlist;
	deleteActiveWatchlist: typeof deleteActiveWatchlist;
	addStock: typeof addStock;
	removeStock: typeof removeStock;
	setTargetPrice: typeof setTargetPrice;
	calculateInvestmentAllocation: typeof calculateInvestmentAllocation;
}

export const defaultWatchlistShellApi: WatchlistShellApi = {
	loadWatchlists,
	selectActiveWatchlist,
	loadWatchlist,
	createWatchlist,
	deleteActiveWatchlist,
	addStock,
	removeStock,
	setTargetPrice,
	calculateInvestmentAllocation
};

function toWatchlistApiError(error: unknown): WatchlistApiError {
	if (error instanceof WatchlistApiError) {
		return error;
	}
	return new WatchlistApiError('UNKNOWN_ERROR', 'An unexpected error occurred.', 0);
}

/**
 * Picks the initial active Watchlist per TASK-016 §9/§10: prefer the
 * server-persisted `activeWatchlistId` if it still refers to an existing
 * Watchlist, otherwise fall back locally to the first Watchlist.
 */
export function chooseInitialActiveWatchlistId(
	response: WatchlistsMetadataResponse
): string | undefined {
	if (
		response.activeWatchlistId &&
		response.watchlists.some((watchlist) => watchlist.id === response.activeWatchlistId)
	) {
		return response.activeWatchlistId;
	}
	return response.watchlists[0]?.id;
}

export interface LoadInitialWatchlistsHandlers {
	onMetadataLoading: () => void;
	onMetadataLoaded: (response: WatchlistsMetadataResponse, activeWatchlistId?: string) => void;
	onMetadataError: (error: WatchlistApiError) => void;
	onActiveWatchlistLoading: () => void;
	onActiveWatchlistLoaded: (view: WatchlistView) => void;
	onActiveWatchlistError: (error: WatchlistApiError) => void;
}

export async function loadInitialWatchlists(
	api: WatchlistShellApi,
	handlers: LoadInitialWatchlistsHandlers
): Promise<void> {
	handlers.onMetadataLoading();

	let response: WatchlistsMetadataResponse;
	try {
		response = await api.loadWatchlists();
	} catch (error) {
		handlers.onMetadataError(toWatchlistApiError(error));
		return;
	}

	const activeWatchlistId = chooseInitialActiveWatchlistId(response);
	handlers.onMetadataLoaded(response, activeWatchlistId);

	if (!activeWatchlistId) {
		return;
	}

	handlers.onActiveWatchlistLoading();
	try {
		const view = await api.loadWatchlist(activeWatchlistId);
		handlers.onActiveWatchlistLoaded(view);
	} catch (error) {
		handlers.onActiveWatchlistError(toWatchlistApiError(error));
	}
}

export interface SwitchActiveWatchlistHandlers {
	onSwitching: () => void;
	onSelectionFailed: (error: WatchlistApiError) => void;
	onSelected: (response: WatchlistsMetadataResponse) => void;
	onActiveWatchlistLoaded: (view: WatchlistView) => void;
	onActiveWatchlistError: (error: WatchlistApiError) => void;
}

/**
 * Implements TASK-016 §19-27: persists the selection before loading the
 * composed Watchlist, and never optimistically treats the new tab as active
 * before the `PUT` succeeds.
 */
export async function switchActiveWatchlist(
	api: WatchlistShellApi,
	watchlistId: string,
	currentActiveWatchlistId: string | undefined,
	handlers: SwitchActiveWatchlistHandlers
): Promise<void> {
	if (watchlistId === currentActiveWatchlistId) {
		return;
	}

	handlers.onSwitching();

	let response: WatchlistsMetadataResponse;
	try {
		response = await api.selectActiveWatchlist(watchlistId);
	} catch (error) {
		handlers.onSelectionFailed(toWatchlistApiError(error));
		return;
	}

	handlers.onSelected(response);

	try {
		const view = await api.loadWatchlist(watchlistId);
		handlers.onActiveWatchlistLoaded(view);
	} catch (error) {
		handlers.onActiveWatchlistError(toWatchlistApiError(error));
	}
}

export interface CreateWatchlistHandlers {
	onCreating: () => void;
	onCreateFailed: (error: WatchlistApiError) => void;
	onCreated: (response: WatchlistsMetadataResponse, activeWatchlistId?: string) => void;
	onActiveWatchlistLoading: () => void;
	onActiveWatchlistLoaded: (view: WatchlistView) => void;
	onActiveWatchlistError: (error: WatchlistApiError) => void;
}

/**
 * Implements TASK-019 §2-4/§15: sends the trimmed name, treats the response
 * as the sole source of truth for which Watchlist became active (never
 * inventing the active id itself), then loads that composed Watchlist. A
 * blank/whitespace-only name is refused before any request is sent.
 */
export async function createWatchlistAndActivate(
	api: WatchlistShellApi,
	name: string,
	handlers: CreateWatchlistHandlers
): Promise<void> {
	const trimmedName = name.trim();
	if (!trimmedName) {
		return;
	}

	handlers.onCreating();

	let response: WatchlistsMetadataResponse;
	try {
		response = await api.createWatchlist(trimmedName);
	} catch (error) {
		handlers.onCreateFailed(toWatchlistApiError(error));
		return;
	}

	const activeWatchlistId = response.activeWatchlistId;
	handlers.onCreated(response, activeWatchlistId);

	if (!activeWatchlistId) {
		return;
	}

	handlers.onActiveWatchlistLoading();
	try {
		const view = await api.loadWatchlist(activeWatchlistId);
		handlers.onActiveWatchlistLoaded(view);
	} catch (error) {
		handlers.onActiveWatchlistError(toWatchlistApiError(error));
	}
}

export interface DeleteActiveWatchlistHandlers {
	onDeleting: () => void;
	onDeleteFailed: (error: WatchlistApiError) => void;
	onDeleted: (response: WatchlistsMetadataResponse) => void;
	onNoWatchlistsRemaining: () => void;
	onActiveWatchlistLoading: () => void;
	onActiveWatchlistLoaded: (view: WatchlistView) => void;
	onActiveWatchlistError: (error: WatchlistApiError) => void;
}

/**
 * Implements TASK-019 §22-28: deletes the server-side active Watchlist and
 * follows the returned metadata rather than reproducing the backend's
 * replacement-selection rule. When no Watchlist remains, it stops without
 * issuing a composed-Watchlist GET.
 */
export async function deleteActiveWatchlistAndTransition(
	api: WatchlistShellApi,
	handlers: DeleteActiveWatchlistHandlers
): Promise<void> {
	handlers.onDeleting();

	let response: WatchlistsMetadataResponse;
	try {
		response = await api.deleteActiveWatchlist();
	} catch (error) {
		handlers.onDeleteFailed(toWatchlistApiError(error));
		return;
	}

	handlers.onDeleted(response);

	if (response.watchlists.length === 0) {
		handlers.onNoWatchlistsRemaining();
		return;
	}

	const activeWatchlistId = response.activeWatchlistId;
	if (!activeWatchlistId) {
		return;
	}

	handlers.onActiveWatchlistLoading();
	try {
		const view = await api.loadWatchlist(activeWatchlistId);
		handlers.onActiveWatchlistLoaded(view);
	} catch (error) {
		handlers.onActiveWatchlistError(toWatchlistApiError(error));
	}
}

export interface AddStockHandlers {
	onAdding: () => void;
	onAddFailed: (error: WatchlistApiError) => void;
	onAdded: (view: WatchlistView) => void;
	/**
	 * Called instead of `onAdding`/`onAddFailed`/`onAdded` when the
	 * normalized symbol fails the shared syntax rule (TASK-029 §26-28) — no
	 * API call is made. Receives the normalized (trimmed, uppercased) symbol
	 * so the caller can redisplay it for correction.
	 */
	onInvalidSymbol: (normalizedSymbol: string) => void;
}

/**
 * Implements TASK-020 §1-14 and TASK-029 §17-28: normalizes (trims,
 * uppercases) and syntactically validates the symbol using the same shared
 * rule the server enforces, sending the normalized symbol only when valid.
 * On success, `activeView` is replaced directly from the mutation response
 * with no follow-up composed-Watchlist GET. A blank/whitespace-only symbol
 * is refused before any request is sent (or validation), and a failure
 * leaves the previous active view untouched so the caller can preserve the
 * entered symbol. The server remains authoritative — this client-side check
 * is a UX optimization only.
 */
export async function addStockToActiveWatchlist(
	api: WatchlistShellApi,
	watchlistId: string,
	symbol: string,
	handlers: AddStockHandlers
): Promise<void> {
	const trimmedSymbol = symbol.trim();
	if (!trimmedSymbol) {
		return;
	}

	const parsed = parseStockSymbol(trimmedSymbol);
	if (!parsed.valid) {
		handlers.onInvalidSymbol(parsed.symbol);
		return;
	}

	handlers.onAdding();

	try {
		const view = await api.addStock(watchlistId, parsed.symbol);
		handlers.onAdded(view);
	} catch (error) {
		handlers.onAddFailed(toWatchlistApiError(error));
	}
}

export interface RemoveStockHandlers {
	onRemoving: () => void;
	onRemoveFailed: (error: WatchlistApiError) => void;
	onRemoved: (view: WatchlistView) => void;
}

/**
 * Implements TASK-020 §20-31: removes a stock from the given Watchlist and,
 * on success, replaces `activeView` directly from the mutation response
 * (including the `stocks = []` case) with no follow-up composed-Watchlist
 * GET. A failure leaves the previous active view untouched.
 */
export async function removeStockFromActiveWatchlist(
	api: WatchlistShellApi,
	watchlistId: string,
	symbol: string,
	handlers: RemoveStockHandlers
): Promise<void> {
	handlers.onRemoving();

	try {
		const view = await api.removeStock(watchlistId, symbol);
		handlers.onRemoved(view);
	} catch (error) {
		handlers.onRemoveFailed(toWatchlistApiError(error));
	}
}

export interface SetTargetPriceHandlers {
	onSaving: () => void;
	onSaved: (view: WatchlistView, marketDataWarningMessage?: string) => void;
	onSaveFailed: (error: WatchlistApiError) => void;
}

/**
 * Implements TASK-021 §16-32: persists a Target Price for one symbol and
 * merges only that symbol's server-confirmed `targetPrice`/`distanceToTarget`
 * into the given active Watchlist view, preserving every other stock, field,
 * and the existing stock order. No follow-up composed-Watchlist GET is
 * issued. A successful save whose market-data refresh failed (TASK-013 §19)
 * is still reported through `onSaved`, with the warning message surfaced
 * separately rather than treated as a failure.
 */
export async function setTargetPriceForActiveStock(
	api: WatchlistShellApi,
	activeView: WatchlistView,
	symbol: string,
	targetPrice: number,
	handlers: SetTargetPriceHandlers
): Promise<void> {
	handlers.onSaving();

	try {
		const response = await api.setTargetPrice(symbol, targetPrice);
		const stocks = activeView.stocks.map((stock) =>
			stock.symbol === response.symbol
				? {
						...stock,
						targetPrice: response.targetPrice,
						distanceToTarget: response.distanceToTarget
					}
				: stock
		);
		const marketDataWarning = response.warnings.find(
			(warning) => warning.code === 'MARKET_DATA_UNAVAILABLE'
		);
		handlers.onSaved({ ...activeView, stocks }, marketDataWarning?.message);
	} catch (error) {
		handlers.onSaveFailed(toWatchlistApiError(error));
	}
}

export interface CalculateInvestmentAllocationHandlers {
	onCalculating: () => void;
	onCalculated: (result: InvestmentAllocationResponse) => void;
	onCalculationFailed: (error: WatchlistApiError) => void;
}

/**
 * Implements TASK-024 §53: calls the investment-allocation endpoint for the
 * given Watchlist and totalSavings and reports the result through handlers.
 * It never reads or mutates Watchlist stock data — the caller (the page,
 * per §50) owns associating the result with displayed stocks and the
 * allocation's temporary UI-state lifecycle, including invalidation.
 */
export async function calculateInvestmentAllocationForActiveWatchlist(
	api: WatchlistShellApi,
	watchlistId: string,
	totalSavings: number,
	handlers: CalculateInvestmentAllocationHandlers
): Promise<void> {
	handlers.onCalculating();

	try {
		const result = await api.calculateInvestmentAllocation(watchlistId, totalSavings);
		handlers.onCalculated(result);
	} catch (error) {
		handlers.onCalculationFailed(toWatchlistApiError(error));
	}
}
