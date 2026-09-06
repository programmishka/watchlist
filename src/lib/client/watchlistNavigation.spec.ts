import { describe, expect, it } from 'vitest';
import {
	MEDIUM_NAVIGATION_BREAKPOINT_PX,
	MEDIUM_NAVIGATION_CAPACITY,
	MOBILE_NAVIGATION_CAPACITY,
	WIDE_NAVIGATION_BREAKPOINT_PX,
	WIDE_NAVIGATION_CAPACITY,
	navigationCapacityForWidth,
	partitionWatchlistsForNavigation
} from './watchlistNavigation';
import type { WatchlistMetadata } from './watchlistApi';

function watchlists(count: number, namePrefix = 'Watchlist'): WatchlistMetadata[] {
	return Array.from({ length: count }, (_, index) => ({
		id: `wl-${index + 1}`,
		name: `${namePrefix} ${index + 1}`
	}));
}

describe('partitionWatchlistsForNavigation', () => {
	it('shows all watchlists when there are fewer than capacity', () => {
		const result = partitionWatchlistsForNavigation(watchlists(3), 'wl-1', 5);
		expect(result.visible.map((w) => w.id)).toEqual(['wl-1', 'wl-2', 'wl-3']);
		expect(result.overflow).toEqual([]);
	});

	it('shows all watchlists when there are exactly capacity', () => {
		const result = partitionWatchlistsForNavigation(watchlists(5), 'wl-1', 5);
		expect(result.visible.map((w) => w.id)).toEqual(['wl-1', 'wl-2', 'wl-3', 'wl-4', 'wl-5']);
		expect(result.overflow).toEqual([]);
	});

	it('splits into visible/overflow when there are more than capacity', () => {
		const result = partitionWatchlistsForNavigation(watchlists(8), 'wl-1', 5);
		expect(result.visible).toHaveLength(5);
		expect(result.overflow).toHaveLength(3);
	});

	it('keeps the earliest inactive watchlists visible without reshuffling when active is already within range', () => {
		const result = partitionWatchlistsForNavigation(watchlists(8), 'wl-1', 5);
		expect(result.visible.map((w) => w.id)).toEqual(['wl-1', 'wl-2', 'wl-3', 'wl-4', 'wl-5']);
		expect(result.overflow.map((w) => w.id)).toEqual(['wl-6', 'wl-7', 'wl-8']);
	});

	it('displaces the last otherwise-fitting inactive watchlist to keep a late active watchlist visible', () => {
		const result = partitionWatchlistsForNavigation(watchlists(13), 'wl-13', 5);
		expect(result.visible.map((w) => w.id)).toEqual(['wl-1', 'wl-2', 'wl-3', 'wl-4', 'wl-13']);
		expect(result.overflow.map((w) => w.id)).toEqual([
			'wl-5',
			'wl-6',
			'wl-7',
			'wl-8',
			'wl-9',
			'wl-10',
			'wl-11',
			'wl-12'
		]);
	});

	it('preserves source order rather than selection order', () => {
		// wl-13 is selected last (it is the active watchlist appended after
		// the earliest-fitting inactive ones), but must still be rendered in
		// its original source position among the visible watchlists.
		const result = partitionWatchlistsForNavigation(watchlists(13), 'wl-13', 5);
		const sourceIds = watchlists(13).map((w) => w.id);
		const visibleIds = result.visible.map((w) => w.id);
		const overflowIds = result.overflow.map((w) => w.id);

		expect(visibleIds).toEqual(sourceIds.filter((id) => visibleIds.includes(id)));
		expect(overflowIds).toEqual(sourceIds.filter((id) => overflowIds.includes(id)));
	});

	it('keeps two watchlists with identical names distinct by id', () => {
		const duplicateNamed: WatchlistMetadata[] = [
			{ id: 'wl-1', name: 'Dividend' },
			{ id: 'wl-2', name: 'Dividend' },
			{ id: 'wl-3', name: 'Dividend' },
			{ id: 'wl-4', name: 'Dividend' }
		];
		const result = partitionWatchlistsForNavigation(duplicateNamed, 'wl-4', 2);
		expect(result.visible.map((w) => w.id)).toEqual(['wl-1', 'wl-4']);
		expect(result.overflow.map((w) => w.id)).toEqual(['wl-2', 'wl-3']);
	});

	it('returns empty visible/overflow when there are no watchlists', () => {
		const result = partitionWatchlistsForNavigation([], undefined, 5);
		expect(result.visible).toEqual([]);
		expect(result.overflow).toEqual([]);
	});

	it('shows exactly the active watchlist at capacity one', () => {
		const result = partitionWatchlistsForNavigation(watchlists(5), 'wl-3', 1);
		expect(result.visible.map((w) => w.id)).toEqual(['wl-3']);
		expect(result.overflow.map((w) => w.id)).toEqual(['wl-1', 'wl-2', 'wl-4', 'wl-5']);
	});

	it('falls back to the earliest watchlists when no active id matches', () => {
		const result = partitionWatchlistsForNavigation(watchlists(5), undefined, 3);
		expect(result.visible.map((w) => w.id)).toEqual(['wl-1', 'wl-2', 'wl-3']);
		expect(result.overflow.map((w) => w.id)).toEqual(['wl-4', 'wl-5']);
	});
});

describe('navigationCapacityForWidth', () => {
	it('returns the mobile capacity below the medium breakpoint', () => {
		expect(navigationCapacityForWidth(MEDIUM_NAVIGATION_BREAKPOINT_PX - 1)).toBe(
			MOBILE_NAVIGATION_CAPACITY
		);
	});

	it('returns the medium capacity between the medium and wide breakpoints', () => {
		expect(navigationCapacityForWidth(MEDIUM_NAVIGATION_BREAKPOINT_PX)).toBe(
			MEDIUM_NAVIGATION_CAPACITY
		);
		expect(navigationCapacityForWidth(WIDE_NAVIGATION_BREAKPOINT_PX - 1)).toBe(
			MEDIUM_NAVIGATION_CAPACITY
		);
	});

	it('returns the wide capacity at and above the wide breakpoint', () => {
		expect(navigationCapacityForWidth(WIDE_NAVIGATION_BREAKPOINT_PX)).toBe(
			WIDE_NAVIGATION_CAPACITY
		);
		expect(navigationCapacityForWidth(3000)).toBe(WIDE_NAVIGATION_CAPACITY);
	});
});
