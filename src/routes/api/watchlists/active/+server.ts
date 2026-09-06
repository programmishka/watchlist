import { requireUserId } from '$lib/server/api/auth';
import { createApplicationServices } from '$lib/server/composition/createApplicationServices';
import { mapErrorToResponse } from '$lib/server/api/errorMapping';
import { parseJsonBody, requireStringField } from '$lib/server/api/requestBody';
import { deleteActiveWatchlist, selectActiveWatchlist } from '$lib/server/api/watchlistHandlers';
import { requireValidWatchlistId } from '$lib/server/watchlist/watchlistIdBoundary';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ locals, platform, request }) => {
	try {
		const userId = requireUserId(locals);
		const body = await parseJsonBody(request);
		const watchlistId = requireValidWatchlistId(requireStringField(body, 'watchlistId'));
		const { watchlistService } = createApplicationServices(platform);
		return await selectActiveWatchlist(userId, watchlistId, watchlistService);
	} catch (error) {
		return mapErrorToResponse(error);
	}
};

export const DELETE: RequestHandler = async ({ locals, platform }) => {
	try {
		const userId = requireUserId(locals);
		const { watchlistService } = createApplicationServices(platform);
		return await deleteActiveWatchlist(userId, watchlistService);
	} catch (error) {
		return mapErrorToResponse(error);
	}
};
