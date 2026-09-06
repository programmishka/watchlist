import { InvalidRequestError } from '../api/errors';

/**
 * Defensive maximum length for an externally supplied `watchlistId` (TASK-038).
 * Generous enough to remain compatible with every legitimately generated ID
 * (`crypto.randomUUID()` is 36 characters) while bounding the cost of a
 * pathologically long path/body parameter. This is a length-only bound —
 * deliberately not a stricter format/grammar check, since the ID generator is
 * an injectable seam and ARCHITECTURE.md does not commit to UUIDv4 as a
 * permanent format.
 */
export const MAX_WATCHLIST_ID_LENGTH = 64;

/**
 * Rejects an over-limit `watchlistId` as `400 INVALID_REQUEST` before any
 * repository/provider work, distinct from `404 WATCHLIST_NOT_FOUND` (a
 * structurally acceptable ID that simply doesn't belong to the authenticated
 * user). Apply at every route accepting a `watchlistId`, whether from a path
 * parameter or a request body field.
 */
export function requireValidWatchlistId(watchlistId: string): string {
	if (watchlistId.length > MAX_WATCHLIST_ID_LENGTH) {
		throw new InvalidRequestError(
			`The watchlist ID must not exceed ${MAX_WATCHLIST_ID_LENGTH} characters.`
		);
	}
	return watchlistId;
}
