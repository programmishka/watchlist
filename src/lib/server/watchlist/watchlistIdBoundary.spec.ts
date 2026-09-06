import { describe, expect, it } from 'vitest';
import { InvalidRequestError } from '../api/errors';
import { MAX_WATCHLIST_ID_LENGTH, requireValidWatchlistId } from './watchlistIdBoundary';

describe('requireValidWatchlistId', () => {
	it('returns a 64-character ID unchanged', () => {
		const id = 'a'.repeat(MAX_WATCHLIST_ID_LENGTH);
		expect(requireValidWatchlistId(id)).toBe(id);
	});

	it('returns a normal UUID-shaped ID unchanged', () => {
		const id = '123e4567-e89b-42d3-a456-426614174000';
		expect(requireValidWatchlistId(id)).toBe(id);
	});

	it('throws InvalidRequestError for a 65-character ID', () => {
		const id = 'a'.repeat(MAX_WATCHLIST_ID_LENGTH + 1);
		expect(() => requireValidWatchlistId(id)).toThrow(InvalidRequestError);
	});

	it('throws InvalidRequestError for a pathologically long ID', () => {
		const id = 'a'.repeat(5000);
		expect(() => requireValidWatchlistId(id)).toThrow(InvalidRequestError);
	});
});
