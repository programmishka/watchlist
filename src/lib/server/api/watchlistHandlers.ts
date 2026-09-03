import { json } from '@sveltejs/kit';
import type { AddStockToWatchlistService } from '../watchlist/AddStockToWatchlistService';
import type { WatchlistQueryService } from '../watchlist/WatchlistQueryService';
import type { WatchlistService } from '../watchlist/WatchlistService';
import { toWatchlistViewResponse, toWatchlistsMetadataResponse } from './watchlistDto';

export async function listWatchlists(
	userId: string,
	watchlistService: WatchlistService
): Promise<Response> {
	const document = await watchlistService.loadWatchlists(userId);
	return json(toWatchlistsMetadataResponse(document));
}

export async function createWatchlist(
	userId: string,
	name: string,
	watchlistService: WatchlistService
): Promise<Response> {
	const { document } = await watchlistService.createWatchlist(userId, name);
	return json(toWatchlistsMetadataResponse(document));
}

export async function selectActiveWatchlist(
	userId: string,
	watchlistId: string,
	watchlistService: WatchlistService
): Promise<Response> {
	const document = await watchlistService.selectActiveWatchlist(userId, watchlistId);
	return json(toWatchlistsMetadataResponse(document));
}

export async function deleteActiveWatchlist(
	userId: string,
	watchlistService: WatchlistService
): Promise<Response> {
	const document = await watchlistService.deleteActiveWatchlist(userId);
	return json(toWatchlistsMetadataResponse(document));
}

export async function getComposedWatchlist(
	userId: string,
	watchlistId: string,
	watchlistQueryService: WatchlistQueryService
): Promise<Response> {
	const view = await watchlistQueryService.getWatchlist(userId, watchlistId);
	return json(toWatchlistViewResponse(view));
}

export async function addStock(
	userId: string,
	watchlistId: string,
	symbol: string,
	addStockToWatchlistService: AddStockToWatchlistService,
	watchlistQueryService: WatchlistQueryService
): Promise<Response> {
	await addStockToWatchlistService.addStock(userId, watchlistId, symbol);
	const view = await watchlistQueryService.getWatchlist(userId, watchlistId);
	return json(toWatchlistViewResponse(view));
}

export async function removeStock(
	userId: string,
	watchlistId: string,
	symbol: string,
	watchlistService: WatchlistService,
	watchlistQueryService: WatchlistQueryService
): Promise<Response> {
	await watchlistService.removeSymbol(userId, watchlistId, symbol);
	const view = await watchlistQueryService.getWatchlist(userId, watchlistId);
	return json(toWatchlistViewResponse(view));
}
