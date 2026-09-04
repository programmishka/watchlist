import {
	loadWatchlist,
	loadWatchlists,
	selectActiveWatchlist,
	WatchlistApiError,
	type WatchlistsMetadataResponse,
	type WatchlistView
} from './watchlistApi';

export interface WatchlistShellApi {
	loadWatchlists: typeof loadWatchlists;
	selectActiveWatchlist: typeof selectActiveWatchlist;
	loadWatchlist: typeof loadWatchlist;
}

export const defaultWatchlistShellApi: WatchlistShellApi = {
	loadWatchlists,
	selectActiveWatchlist,
	loadWatchlist
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
