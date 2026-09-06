import { requireUserId } from '$lib/server/api/auth';
import { createApplicationServices } from '$lib/server/composition/createApplicationServices';
import { mapErrorToResponse } from '$lib/server/api/errorMapping';
import { getComposedWatchlist } from '$lib/server/api/watchlistHandlers';
import { requireValidWatchlistId } from '$lib/server/watchlist/watchlistIdBoundary';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, platform, params }) => {
	try {
		const userId = requireUserId(locals);
		const watchlistId = requireValidWatchlistId(params.watchlistId);
		const { watchlistQueryService } = createApplicationServices(platform);
		return await getComposedWatchlist(userId, watchlistId, watchlistQueryService);
	} catch (error) {
		return mapErrorToResponse(error);
	}
};
