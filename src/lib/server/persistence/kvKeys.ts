/**
 * Centralizes KV key construction so the `user:<userId>:...` format is
 * defined once. Callers should go through the repositories rather than
 * constructing or depending on these raw keys directly.
 */
export function watchlistsKey(userId: string): string {
	return `user:${userId}:watchlists`;
}

export function targetPricesKey(userId: string): string {
	return `user:${userId}:target-prices`;
}
