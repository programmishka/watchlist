import { json } from '@sveltejs/kit';
import { InvalidTotalSavingsError } from '../domain/investmentAllocation';
import { MarketDataProviderError } from '../market-data/MarketDataProvider';
import { PersistenceError } from '../persistence/PersistenceError';
import {
	InvalidSymbolError as InvalidTargetPriceSymbolError,
	InvalidTargetPriceError
} from '../target-price/TargetPriceServiceErrors';
import { MAX_STOCKS_PER_WATCHLIST } from '../watchlist/WatchlistService';
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
import type { ApiErrorCode, ApiErrorResponse } from './ApiError';
import { InvalidRequestError, UnauthenticatedError } from './errors';

function errorResponse(status: number, code: ApiErrorCode, message: string): Response {
	const body: ApiErrorResponse = { error: { code, message } };
	return json(body, { status });
}

/**
 * Centralizes error-to-HTTP mapping so individual routes don't each
 * reproduce this `instanceof` chain. Business/domain/provider error classes
 * remain independent of HTTP; this is the one place that translates them.
 */
export function mapErrorToResponse(error: unknown): Response {
	if (error instanceof UnauthenticatedError) {
		return errorResponse(401, 'UNAUTHENTICATED', 'Authentication is required.');
	}
	if (error instanceof InvalidRequestError) {
		return errorResponse(400, 'INVALID_REQUEST', error.message);
	}
	if (error instanceof InvalidWatchlistNameError) {
		return errorResponse(400, 'INVALID_WATCHLIST_NAME', 'The watchlist name is invalid.');
	}
	if (error instanceof InvalidWatchlistSymbolError) {
		return errorResponse(
			400,
			'INVALID_STOCK_SYMBOL',
			'Invalid stock symbol format. Use letters, numbers, dots, or hyphens.'
		);
	}
	if (error instanceof InvalidTargetPriceSymbolError) {
		return errorResponse(400, 'INVALID_SYMBOL', 'The stock symbol is invalid.');
	}
	if (error instanceof InvalidTargetPriceError) {
		return errorResponse(400, 'INVALID_TARGET_PRICE', 'The target price is invalid.');
	}
	if (error instanceof InvalidTotalSavingsError) {
		return errorResponse(400, 'INVALID_TOTAL_SAVINGS', 'The total savings amount is invalid.');
	}
	if (error instanceof WatchlistNotFoundError) {
		return errorResponse(404, 'WATCHLIST_NOT_FOUND', 'The watchlist does not exist.');
	}
	if (error instanceof SymbolNotFoundError) {
		return errorResponse(
			404,
			'SYMBOL_NOT_FOUND',
			'The stock symbol was not found in this watchlist.'
		);
	}
	if (error instanceof DuplicateSymbolError) {
		return errorResponse(409, 'DUPLICATE_SYMBOL', 'The symbol already exists in this watchlist.');
	}
	if (error instanceof WatchlistStockLimitReachedError) {
		return errorResponse(
			409,
			'WATCHLIST_STOCK_LIMIT_REACHED',
			`This watchlist can contain up to ${MAX_STOCKS_PER_WATCHLIST.toLocaleString('en-US')} stocks.`
		);
	}
	if (error instanceof NoActiveWatchlistError) {
		return errorResponse(409, 'NO_ACTIVE_WATCHLIST', 'There is no active watchlist.');
	}
	if (error instanceof UnknownStockSymbolError) {
		return errorResponse(422, 'UNKNOWN_STOCK_SYMBOL', 'This is not a supported stock symbol.');
	}
	if (error instanceof MarketDataProviderError) {
		return errorResponse(503, 'MARKET_DATA_UNAVAILABLE', 'Market data is currently unavailable.');
	}
	if (error instanceof PersistenceError) {
		return errorResponse(500, 'PERSISTENCE_ERROR', 'A persistence error occurred.');
	}

	return errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
}
