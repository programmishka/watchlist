import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	addStock,
	createWatchlist,
	deleteActiveWatchlist,
	loadWatchlist,
	loadWatchlists,
	removeStock,
	selectActiveWatchlist,
	WatchlistApiError
} from './watchlistApi';

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

beforeEach(() => {
	vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('loadWatchlists', () => {
	it('issues a GET to /api/watchlists and parses the metadata response', async () => {
		vi.mocked(fetch).mockResolvedValue(
			jsonResponse(200, { activeWatchlistId: 'wl-1', watchlists: [{ id: 'wl-1', name: 'Main' }] })
		);

		const result = await loadWatchlists();

		expect(fetch).toHaveBeenCalledWith('/api/watchlists', undefined);
		expect(result).toEqual({
			activeWatchlistId: 'wl-1',
			watchlists: [{ id: 'wl-1', name: 'Main' }]
		});
	});

	it('throws a WatchlistApiError with the stable code/message/status on failure', async () => {
		vi.mocked(fetch).mockResolvedValue(
			jsonResponse(401, {
				error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' }
			})
		);

		await expect(loadWatchlists()).rejects.toMatchObject({
			name: 'WatchlistApiError',
			code: 'UNAUTHENTICATED',
			message: 'Authentication is required.',
			status: 401
		});
	});

	it('falls back to a generic error when the failure body is not JSON', async () => {
		vi.mocked(fetch).mockResolvedValue(new Response('not json', { status: 500 }));

		await expect(loadWatchlists()).rejects.toMatchObject({
			code: 'UNKNOWN_ERROR',
			status: 500
		});
	});
});

describe('selectActiveWatchlist', () => {
	it('issues a PUT to /api/watchlists/active with the selected watchlist id', async () => {
		vi.mocked(fetch).mockResolvedValue(
			jsonResponse(200, {
				activeWatchlistId: 'wl-2',
				watchlists: [{ id: 'wl-2', name: 'Dividend' }]
			})
		);

		const result = await selectActiveWatchlist('wl-2');

		expect(fetch).toHaveBeenCalledWith('/api/watchlists/active', {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ watchlistId: 'wl-2' })
		});
		expect(result.activeWatchlistId).toBe('wl-2');
	});

	it('throws a WatchlistApiError when the watchlist does not exist', async () => {
		vi.mocked(fetch).mockResolvedValue(
			jsonResponse(404, {
				error: { code: 'WATCHLIST_NOT_FOUND', message: 'The watchlist does not exist.' }
			})
		);

		await expect(selectActiveWatchlist('missing')).rejects.toBeInstanceOf(WatchlistApiError);
	});
});

describe('loadWatchlist', () => {
	it('issues a GET to /api/watchlists/{id} and parses the composed watchlist', async () => {
		vi.mocked(fetch).mockResolvedValue(
			jsonResponse(200, { id: 'wl-1', name: 'Main', stocks: [], warnings: [] })
		);

		const result = await loadWatchlist('wl-1');

		expect(fetch).toHaveBeenCalledWith('/api/watchlists/wl-1', undefined);
		expect(result).toEqual({ id: 'wl-1', name: 'Main', stocks: [], warnings: [] });
	});

	it('URL-encodes the watchlist id', async () => {
		vi.mocked(fetch).mockResolvedValue(
			jsonResponse(200, { id: 'a/b', name: 'Main', stocks: [], warnings: [] })
		);

		await loadWatchlist('a/b');

		expect(fetch).toHaveBeenCalledWith('/api/watchlists/a%2Fb', undefined);
	});

	it('throws a WatchlistApiError when the network request fails outright', async () => {
		vi.mocked(fetch).mockRejectedValue(new TypeError('network down'));

		await expect(loadWatchlist('wl-1')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
	});
});

describe('createWatchlist', () => {
	it('issues a POST to /api/watchlists with the given name', async () => {
		vi.mocked(fetch).mockResolvedValue(
			jsonResponse(200, {
				activeWatchlistId: 'wl-3',
				watchlists: [
					{ id: 'wl-1', name: 'Main' },
					{ id: 'wl-3', name: 'Tech' }
				]
			})
		);

		const result = await createWatchlist('Tech');

		expect(fetch).toHaveBeenCalledWith('/api/watchlists', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name: 'Tech' })
		});
		expect(result.activeWatchlistId).toBe('wl-3');
	});

	it('throws a WatchlistApiError with the stable code/message/status on failure', async () => {
		vi.mocked(fetch).mockResolvedValue(
			jsonResponse(400, {
				error: { code: 'INVALID_WATCHLIST_NAME', message: 'A watchlist name is required.' }
			})
		);

		await expect(createWatchlist('')).rejects.toMatchObject({
			name: 'WatchlistApiError',
			code: 'INVALID_WATCHLIST_NAME',
			status: 400
		});
	});
});

describe('deleteActiveWatchlist', () => {
	it('issues a DELETE to /api/watchlists/active with no body', async () => {
		vi.mocked(fetch).mockResolvedValue(
			jsonResponse(200, { activeWatchlistId: 'wl-1', watchlists: [{ id: 'wl-1', name: 'Main' }] })
		);

		const result = await deleteActiveWatchlist();

		expect(fetch).toHaveBeenCalledWith('/api/watchlists/active', { method: 'DELETE' });
		expect(result.watchlists).toEqual([{ id: 'wl-1', name: 'Main' }]);
	});

	it('throws a WatchlistApiError when there is no active watchlist to delete', async () => {
		vi.mocked(fetch).mockResolvedValue(
			jsonResponse(409, {
				error: { code: 'NO_ACTIVE_WATCHLIST', message: 'There is no active watchlist.' }
			})
		);

		await expect(deleteActiveWatchlist()).rejects.toBeInstanceOf(WatchlistApiError);
	});
});

describe('addStock', () => {
	it('issues a POST to /api/watchlists/{watchlistId}/stocks with the symbol and parses the composed watchlist', async () => {
		vi.mocked(fetch).mockResolvedValue(
			jsonResponse(200, {
				id: 'wl-1',
				name: 'Main',
				stocks: [{ symbol: 'AAPL', distanceToTarget: 0, dividendYield: 0 }],
				warnings: []
			})
		);

		const result = await addStock('wl-1', 'AAPL');

		expect(fetch).toHaveBeenCalledWith('/api/watchlists/wl-1/stocks', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ symbol: 'AAPL' })
		});
		expect(result.stocks).toEqual([{ symbol: 'AAPL', distanceToTarget: 0, dividendYield: 0 }]);
	});

	it('URL-encodes the watchlist id', async () => {
		vi.mocked(fetch).mockResolvedValue(
			jsonResponse(200, { id: 'a/b', name: 'Main', stocks: [], warnings: [] })
		);

		await addStock('a/b', 'AAPL');

		expect(fetch).toHaveBeenCalledWith(
			'/api/watchlists/a%2Fb/stocks',
			expect.objectContaining({ method: 'POST' })
		);
	});

	it('throws a WatchlistApiError with the stable code/message/status when the symbol is unknown', async () => {
		vi.mocked(fetch).mockResolvedValue(
			jsonResponse(422, {
				error: { code: 'UNKNOWN_STOCK_SYMBOL', message: 'The symbol could not be found.' }
			})
		);

		await expect(addStock('wl-1', 'BOGUS')).rejects.toMatchObject({
			name: 'WatchlistApiError',
			code: 'UNKNOWN_STOCK_SYMBOL',
			message: 'The symbol could not be found.',
			status: 422
		});
	});
});

describe('removeStock', () => {
	it('issues a DELETE to /api/watchlists/{watchlistId}/stocks/{symbol} with no body and parses the composed watchlist', async () => {
		vi.mocked(fetch).mockResolvedValue(
			jsonResponse(200, { id: 'wl-1', name: 'Main', stocks: [], warnings: [] })
		);

		const result = await removeStock('wl-1', 'AAPL');

		expect(fetch).toHaveBeenCalledWith('/api/watchlists/wl-1/stocks/AAPL', { method: 'DELETE' });
		expect(result).toEqual({ id: 'wl-1', name: 'Main', stocks: [], warnings: [] });
	});

	it('URL-encodes a punctuated symbol', async () => {
		vi.mocked(fetch).mockResolvedValue(
			jsonResponse(200, { id: 'wl-1', name: 'Main', stocks: [], warnings: [] })
		);

		await removeStock('wl-1', 'HEXA-B.ST');

		expect(fetch).toHaveBeenCalledWith('/api/watchlists/wl-1/stocks/HEXA-B.ST', {
			method: 'DELETE'
		});
	});

	it('URL-encodes a symbol containing URL-significant characters', async () => {
		vi.mocked(fetch).mockResolvedValue(
			jsonResponse(200, { id: 'wl-1', name: 'Main', stocks: [], warnings: [] })
		);

		await removeStock('wl-1', 'A/B C');

		expect(fetch).toHaveBeenCalledWith(
			`/api/watchlists/wl-1/stocks/${encodeURIComponent('A/B C')}`,
			{
				method: 'DELETE'
			}
		);
	});

	it('throws a WatchlistApiError with the stable code/message/status when the symbol is not found', async () => {
		vi.mocked(fetch).mockResolvedValue(
			jsonResponse(404, {
				error: { code: 'SYMBOL_NOT_FOUND', message: 'The symbol is not in this watchlist.' }
			})
		);

		await expect(removeStock('wl-1', 'AAPL')).rejects.toMatchObject({
			name: 'WatchlistApiError',
			code: 'SYMBOL_NOT_FOUND',
			status: 404
		});
	});
});
