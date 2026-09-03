/** Symbol -> user-defined target price. Belongs to User + Symbol, independent of any Watchlist (see ARCHITECTURE.md §9.3). */
export type TargetPrices = Record<string, number>;

export interface TargetPriceRepository {
	/** Returns `{}` when the user has no persisted target prices. */
	get(userId: string): Promise<TargetPrices>;
	save(userId: string, targetPrices: TargetPrices): Promise<void>;
}
