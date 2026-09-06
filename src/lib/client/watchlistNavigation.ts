import type { WatchlistMetadata } from './watchlistApi';

export interface WatchlistNavigationPartition {
	visible: WatchlistMetadata[];
	overflow: WatchlistMetadata[];
}

/**
 * Deterministic direct-vs-overflow split for Watchlist navigation
 * (TASK-035 §11-13, §56-57): the active Watchlist always occupies one of the
 * `capacity` visible slots, and the remaining slots are filled with the
 * earliest inactive Watchlists in source order ("take the earliest inactive
 * Watchlists that fit + always include active"). Both returned arrays
 * preserve the original source order rather than the selection order, so an
 * active Watchlist beyond the initial `capacity` window displaces the
 * otherwise-last-fitting inactive Watchlist rather than reshuffling the rest.
 * Identity is by `id`, so duplicate names never collapse together.
 */
export function partitionWatchlistsForNavigation(
	watchlists: WatchlistMetadata[],
	activeWatchlistId: string | undefined,
	capacity: number
): WatchlistNavigationPartition {
	const activeWatchlist = watchlists.find((watchlist) => watchlist.id === activeWatchlistId);

	const selectedIds = new Set<string>();
	if (activeWatchlist) {
		selectedIds.add(activeWatchlist.id);
	}
	for (const watchlist of watchlists) {
		if (selectedIds.size >= capacity) {
			break;
		}
		selectedIds.add(watchlist.id);
	}

	return {
		visible: watchlists.filter((watchlist) => selectedIds.has(watchlist.id)),
		overflow: watchlists.filter((watchlist) => !selectedIds.has(watchlist.id))
	};
}

/**
 * Responsive direct-tab capacity policy (TASK-035 §11, §93), verified against
 * the project's existing representative viewport widths (375/768/1280/1600):
 *
 * ```text
 * width < 768px    -> 1 (mobile: active Watchlist only)
 * 768-1279px       -> 5 (medium desktop/tablet)
 * width >= 1280px  -> 8 (wide desktop)
 * ```
 */
export const MOBILE_NAVIGATION_CAPACITY = 1;
export const MEDIUM_NAVIGATION_CAPACITY = 5;
export const WIDE_NAVIGATION_CAPACITY = 8;

export const MEDIUM_NAVIGATION_BREAKPOINT_PX = 768;
export const WIDE_NAVIGATION_BREAKPOINT_PX = 1280;

export function navigationCapacityForWidth(width: number): number {
	if (width < MEDIUM_NAVIGATION_BREAKPOINT_PX) {
		return MOBILE_NAVIGATION_CAPACITY;
	}
	if (width < WIDE_NAVIGATION_BREAKPOINT_PX) {
		return MEDIUM_NAVIGATION_CAPACITY;
	}
	return WIDE_NAVIGATION_CAPACITY;
}
