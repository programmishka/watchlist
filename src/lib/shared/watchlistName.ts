/**
 * Single application rule for Watchlist-name length bounding (TASK-038).
 * Pure and dependency-free so it can be imported unchanged by both server
 * application code and browser code, mirroring the `stockSymbol.ts` pattern
 * established by TASK-029.
 */
export const MAX_WATCHLIST_NAME_LENGTH = 50;

/**
 * Expects an already-trimmed name. Counts UTF-16 code units via the native
 * `string.length` — no grapheme-cluster segmentation (see
 * `docs/security/input-boundary-audit.md` §3 for the rationale).
 */
export function isValidWatchlistName(trimmedName: string): boolean {
	return trimmedName.length > 0 && trimmedName.length <= MAX_WATCHLIST_NAME_LENGTH;
}
