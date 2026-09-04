import {
	addStock,
	createWatchlist,
	deleteActiveWatchlist,
	loadWatchlist,
	loadWatchlists,
	removeStock,
	selectActiveWatchlist,
	WatchlistApiError,
	type WatchlistsMetadataResponse,
	type WatchlistView
} from './watchlistApi';

export interface WatchlistShellApi {
	loadWatchlists: typeof loadWatchlists;
	selectActiveWatchlist: typeof selectActiveWatchlist;
	loadWatchlist: typeof loadWatchlist;
	createWatchlist: typeof createWatchlist;
	deleteActiveWatchlist: typeof deleteActiveWatchlist;
	addStock: typeof addStock;
	removeStock: typeof removeStock;
}

export const defaultWatchlistShellApi: WatchlistShellApi = {
	loadWatchlists,
	selectActiveWatchlist,
	loadWatchlist,
	createWatchlist,
	deleteActiveWatchlist,
	addStock,
	removeStock
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
}

/**
 * Implements TASK-020 §1-14: sends the trimmed symbol and, on success,
 * replaces `activeView` directly from the mutation response with no
 * follow-up composed-Watchlist GET. A blank/whitespace-only symbol is
 * refused before any request is sent, and a failure leaves the previous
 * active view untouched so the caller can preserve the entered symbol.
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

	handlers.onAdding();

	try {
		const view = await api.addStock(watchlistId, trimmedSymbol);
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
