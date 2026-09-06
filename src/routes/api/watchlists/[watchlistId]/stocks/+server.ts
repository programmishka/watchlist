import { requireUserId } from '$lib/server/api/auth';
import { createApplicationServices } from '$lib/server/composition/createApplicationServices';
import { mapErrorToResponse } from '$lib/server/api/errorMapping';
import { parseJsonBody, requireStringField } from '$lib/server/api/requestBody';
import { addStock } from '$lib/server/api/watchlistHandlers';
import { requireValidWatchlistId } from '$lib/server/watchlist/watchlistIdBoundary';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, platform, params, request }) => {
	try {
		const userId = requireUserId(locals);
		const watchlistId = requireValidWatchlistId(params.watchlistId);
		const body = await parseJsonBody(request);
		const symbol = requireStringField(body, 'symbol');
		const { addStockToWatchlistService, watchlistQueryService } =
			createApplicationServices(platform);
		return await addStock(
			userId,
			watchlistId,
			symbol,
			addStockToWatchlistService,
			watchlistQueryService
		);
	} catch (error) {
		return mapErrorToResponse(error);
	}
};
