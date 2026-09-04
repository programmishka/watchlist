import { describe, expect, it, vi } from 'vitest';
import {
	WatchlistApiError,
	type WatchlistView,
	type WatchlistsMetadataResponse
} from './watchlistApi';
import {
	chooseInitialActiveWatchlistId,
	loadInitialWatchlists,
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
