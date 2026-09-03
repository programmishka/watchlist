import type { WatchlistsDocument } from '../persistence/WatchlistRepository';
import type { WatchlistView } from '../watchlist/WatchlistView';
import type { ApiWarning } from './apiWarnings';
import { toApiWarnings } from './apiWarnings';

export interface WatchlistMetadataDto {
	id: string;
	name: string;
}

export interface WatchlistsMetadataResponse {
	activeWatchlistId?: string;
	watchlists: WatchlistMetadataDto[];
}

/** Watchlist metadata for tab rendering — deliberately omits `symbols`, which the client doesn't need merely to render tabs. */
export function toWatchlistsMetadataResponse(
	document: WatchlistsDocument
): WatchlistsMetadataResponse {
	return {
		activeWatchlistId: document.activeWatchlistId,
		watchlists: document.watchlists.map((watchlist) => ({
			id: watchlist.id,
			name: watchlist.name
		}))
	};
}

export interface WatchlistStockDto {
	symbol: string;
	name?: string;
	price?: number;
	currency?: string;
	targetPrice?: number;
	distanceToTarget: number;
	dividendYield: number;
	marketCapBillionsUsd?: number;
}

export interface WatchlistViewResponse {
	id: string;
	name: string;
	stocks: WatchlistStockDto[];
	warnings: ApiWarning[];
}

export function toWatchlistViewResponse(view: WatchlistView): WatchlistViewResponse {
	return {
		id: view.id,
		name: view.name,
		stocks: view.stocks.map((stock) => ({
			symbol: stock.symbol,
			name: stock.name,
			price: stock.price,
			currency: stock.currency,
			targetPrice: stock.targetPrice,
			distanceToTarget: stock.distanceToTarget,
			dividendYield: stock.dividendYield,
			marketCapBillionsUsd: stock.marketCapBillionsUsd
		})),
		warnings: toApiWarnings(view.warnings)
	};
}
