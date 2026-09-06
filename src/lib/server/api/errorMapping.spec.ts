import { describe, expect, it } from 'vitest';
import { InvalidTotalSavingsError } from '../domain/investmentAllocation';
import { MarketDataProviderError } from '../market-data/MarketDataProvider';
import { PersistenceError } from '../persistence/PersistenceError';
import {
	InvalidSymbolError as InvalidTargetPriceSymbolError,
	InvalidTargetPriceError
} from '../target-price/TargetPriceServiceErrors';
import {
	DuplicateSymbolError,
	InvalidSymbolError as InvalidWatchlistSymbolError,
	InvalidWatchlistNameError,
	NoActiveWatchlistError,
	SymbolNotFoundError,
	UnknownStockSymbolError,
	WatchlistNotFoundError,
	WatchlistStockLimitReachedError
} from '../watchlist/WatchlistServiceErrors';
import type { ApiErrorResponse } from './ApiError';
import { InvalidRequestError, PayloadTooLargeError, UnauthenticatedError } from './errors';
import { mapErrorToResponse } from './errorMapping';

async function statusAndCode(response: Response): Promise<{ status: number; code: string }> {
	const body = (await response.json()) as ApiErrorResponse;
	return { status: response.status, code: body.error.code };
}

describe('mapErrorToResponse', () => {
	it.each([
		[new UnauthenticatedError(), 401, 'UNAUTHENTICATED'],
		[new InvalidRequestError(), 400, 'INVALID_REQUEST'],
		[new PayloadTooLargeError(), 413, 'PAYLOAD_TOO_LARGE'],
		[new InvalidWatchlistNameError('  '), 400, 'INVALID_WATCHLIST_NAME'],
		[new InvalidWatchlistSymbolError(''), 400, 'INVALID_STOCK_SYMBOL'],
		[new InvalidTargetPriceSymbolError(''), 400, 'INVALID_SYMBOL'],
		[new InvalidTargetPriceError(-1), 400, 'INVALID_TARGET_PRICE'],
		[new InvalidTotalSavingsError(-1), 400, 'INVALID_TOTAL_SAVINGS'],
		[new WatchlistNotFoundError('wl-1'), 404, 'WATCHLIST_NOT_FOUND'],
		[new SymbolNotFoundError('AAPL', 'wl-1'), 404, 'SYMBOL_NOT_FOUND'],
		[new DuplicateSymbolError('AAPL', 'wl-1'), 409, 'DUPLICATE_SYMBOL'],
		[new WatchlistStockLimitReachedError('wl-1'), 409, 'WATCHLIST_STOCK_LIMIT_REACHED'],
		[new NoActiveWatchlistError(), 409, 'NO_ACTIVE_WATCHLIST'],
		[new UnknownStockSymbolError('DOES-NOT-EXIST'), 422, 'UNKNOWN_STOCK_SYMBOL'],
		[new MarketDataProviderError('outage'), 503, 'MARKET_DATA_UNAVAILABLE'],
		[new PersistenceError('kv failure'), 500, 'PERSISTENCE_ERROR'],
		[new Error('anything else'), 500, 'INTERNAL_ERROR'],
		[new TypeError('unexpected'), 500, 'INTERNAL_ERROR']
	])('maps %o to %i %s', async (error, expectedStatus, expectedCode) => {
		const { status, code } = await statusAndCode(mapErrorToResponse(error));
		expect(status).toBe(expectedStatus);
		expect(code).toBe(expectedCode);
	});

	it('gives a clear user-facing message for the stock-limit error, naming the capacity', async () => {
		const response = mapErrorToResponse(new WatchlistStockLimitReachedError('wl-1'));
		const body = (await response.json()) as ApiErrorResponse;

		expect(body.error.message).toContain('1,000');
		expect(body.error.message.toLowerCase()).toContain('stocks');
	});

	it('gives a generic public message for an oversized request body, not internal details', async () => {
		const response = mapErrorToResponse(new PayloadTooLargeError('internal buffer detail'));
		const body = (await response.json()) as ApiErrorResponse;

		expect(response.status).toBe(413);
		expect(body).toEqual({
			error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' }
		});
	});

	it('never leaks the original error message for unexpected errors', async () => {
		const response = mapErrorToResponse(new Error('leaked KV key: user:secret:watchlists'));
		const body = (await response.json()) as ApiErrorResponse;

		expect(body.error.message).not.toContain('leaked KV key');
		expect(body.error.message).toBe('An unexpected error occurred.');
	});
});
