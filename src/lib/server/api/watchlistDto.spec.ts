import { describe, expect, it } from 'vitest';
import type { WatchlistsDocument } from '../persistence/WatchlistRepository';
import type { WatchlistView } from '../watchlist/WatchlistView';
import { toWatchlistViewResponse, toWatchlistsMetadataResponse } from './watchlistDto';

describe('toWatchlistsMetadataResponse', () => {
	it('maps watchlists to id/name only, omitting symbols', () => {
		const document: WatchlistsDocument = {
			activeWatchlistId: 'wl-1',
			watchlists: [
				{ id: 'wl-1', name: 'Main', symbols: ['AAPL', 'MSFT'] },
				{ id: 'wl-2', name: 'Dividend', symbols: ['KO'] }
			]
		};

		const result = toWatchlistsMetadataResponse(document);

		expect(result).toEqual({
			activeWatchlistId: 'wl-1',
			watchlists: [
				{ id: 'wl-1', name: 'Main' },
				{ id: 'wl-2', name: 'Dividend' }
			]
		});
		expect(result.watchlists[0]).not.toHaveProperty('symbols');
	});

	it('preserves duplicate watchlist names', () => {
		const document: WatchlistsDocument = {
			activeWatchlistId: 'wl-1',
			watchlists: [
				{ id: 'wl-1', name: 'Dividend', symbols: [] },
				{ id: 'wl-2', name: 'Dividend', symbols: [] }
			]
		};

		const result = toWatchlistsMetadataResponse(document);

		expect(result.watchlists.map((w) => w.name)).toEqual(['Dividend', 'Dividend']);
	});

	it('omits activeWatchlistId from the serialized JSON when there are no watchlists', () => {
		const document: WatchlistsDocument = { activeWatchlistId: undefined, watchlists: [] };

		const result = toWatchlistsMetadataResponse(document);
		const serialized = JSON.parse(JSON.stringify(result));

		expect(serialized).toEqual({ watchlists: [] });
		expect('activeWatchlistId' in serialized).toBe(false);
	});
});

describe('toWatchlistViewResponse', () => {
	it('maps a complete composed stock', () => {
		const view: WatchlistView = {
			id: 'wl-1',
			name: 'Main',
			warnings: [],
			stocks: [
				{
					symbol: 'AAPL',
					name: 'Apple Inc.',
					price: 120,
					currency: 'USD',
					targetPrice: 100,
					distanceToTarget: 0.2,
					dividendYield: 0.05,
					marketCapBillionsUsd: 2.5
				}
			]
		};

		expect(toWatchlistViewResponse(view)).toEqual({
			id: 'wl-1',
			name: 'Main',
			warnings: [],
			stocks: [
				{
					symbol: 'AAPL',
					name: 'Apple Inc.',
					price: 120,
					currency: 'USD',
					targetPrice: 100,
					distanceToTarget: 0.2,
					dividendYield: 0.05,
					marketCapBillionsUsd: 2.5
				}
			]
		});
	});

	it('omits missing optional fields from the serialized JSON, while preserving a real zero distance', () => {
		const view: WatchlistView = {
			id: 'wl-1',
			name: 'Main',
			warnings: [],
			stocks: [{ symbol: 'UNKNOWN', distanceToTarget: 0, dividendYield: 0 }]
		};

		const serialized = JSON.parse(JSON.stringify(toWatchlistViewResponse(view)));

		expect(serialized.stocks[0]).toEqual({
			symbol: 'UNKNOWN',
			distanceToTarget: 0,
			dividendYield: 0
		});
	});

	it('never serializes distanceToTarget as 0 for an unavailable distance (TASK-031 §30)', () => {
		const view: WatchlistView = {
			id: 'wl-1',
			name: 'Main',
			warnings: [],
			stocks: [{ symbol: 'XYZ', targetPrice: 1, distanceToTarget: undefined, dividendYield: 0 }]
		};

		const serialized = JSON.parse(JSON.stringify(toWatchlistViewResponse(view)));

		expect(serialized.stocks[0]).toEqual({ symbol: 'XYZ', targetPrice: 1, dividendYield: 0 });
		expect('distanceToTarget' in serialized.stocks[0]).toBe(false);
	});

	it('maps the fx-provider-unavailable warning to a stable API code', () => {
		const view: WatchlistView = {
			id: 'wl-1',
			name: 'Main',
			warnings: ['fx-provider-unavailable'],
			stocks: []
		};

		expect(toWatchlistViewResponse(view).warnings).toEqual([
			{ code: 'FX_PROVIDER_UNAVAILABLE', message: 'Currency conversion is currently unavailable.' }
		]);
	});
});
